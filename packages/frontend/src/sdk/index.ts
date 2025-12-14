import {
  API_KEY,
  SESSION_STORAGE_KEY,
  STORAGE_CHANGE_EVENT,
  MODELS,
  type IApiKey,
} from "@/lib/const";
import { AnthropicProvider } from "@/sdk/providers/anthropic";
import { OpenAIProvider } from "@/sdk/providers/openai";
import type {
  IMessageRequest,
  IMessageResult,
  IModelInfo,
  IProvider,
  IProviderInfo,
  TemporarySession,
} from "@/sdk/shared";
import { localStorage, sessionStorage } from "@/lib/storage";
import { MasterAgent } from "./agent/master-agent";

export const providerRegistry: Record<IProvider, IProviderInfo> = {
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
  },
  openai: {
    id: "openai",
    displayName: "OpenAI",
  },
};

export class AISDK {
  anthropic: AnthropicProvider | null = null;
  openai: OpenAIProvider | null = null;
  /** Holds the abort controller for the currently streaming request (if any) */
  public currentAbortController: AbortController | null = null;

  constructor() {
    // Initialise providers from the current content of localStorage.
    this.initProviders();

    // Re-initialise providers whenever the API key changes in storage.
    window.addEventListener(STORAGE_CHANGE_EVENT(API_KEY), () => {
      this.initProviders();
    });
  }

  /**
   * (Re)initialise provider instances based on the latest API key values.
   * If a provider already exists its API key is updated, otherwise a new
   * instance is created. Providers are set to null when their key is removed.
   */
  private async initProviders() {
    const apiKey: IApiKey = JSON.parse(localStorage.getItem(API_KEY) ?? "{}");

    // Anthropic
    if (apiKey.anthropic) {
      if (this.anthropic) {
        this.anthropic.setApiKey(apiKey.anthropic);
      } else {
        this.anthropic = new AnthropicProvider(apiKey.anthropic);
      }
    } else {
      this.anthropic = null;
    }

    // OpenAI
    if (apiKey.openai) {
      if (this.openai) {
        this.openai.setApiKey(apiKey.openai);
      } else {
        this.openai = new OpenAIProvider(apiKey.openai);
      }
    } else {
      this.openai = null;
    }

    // Refresh models list after provider updates
    await this.refreshModels();
  }

  private async refreshModels() {
    try {
      const fetchedModels = await this.getAvailableModels();

      // Parse previously stored models (if any)
      let prevModels: IModelInfo[] = [];
      const prevRaw = localStorage.getItem(MODELS);
      if (prevRaw) {
        try {
          prevModels = JSON.parse(prevRaw) as IModelInfo[];
        } catch {
          // Malformed json – ignore and treat as empty
        }
      }

      // Merge: keep existing flags (e.g. disabled) for models that still exist
      const mergedModels: IModelInfo[] = fetchedModels.map((model) => {
        const prev = prevModels.find(
          (m) => m.id === model.id && m.provider === model.provider
        );
        return prev ?? model;
      });

      const next = JSON.stringify(mergedModels);

      if (prevRaw !== next) {
        localStorage.setItem(MODELS, next);
      }
    } catch (err) {
      console.error("Failed to refresh models list", err);
    }
  }

  async abortCurrent() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  async getAvailableModels() {
    const anthropicModels = (await this.anthropic?.getModels()) ?? [];
    const openaiModels = (await this.openai?.getModels()) ?? [];

    return [...anthropicModels, ...openaiModels];
  }

  async message(
    sessionId: string,
    isPermanentSession: boolean,
    provider: IProvider,
    model: string,
    requestMessage: IMessageRequest[]
  ): Promise<void> {
    const storage = isPermanentSession ? localStorage : sessionStorage;

    async function getSessionFromStorage() {
      return JSON.parse(
        storage.getItem(SESSION_STORAGE_KEY(sessionId)) ?? "{}"
      ) as TemporarySession;
    }
    let session = await getSessionFromStorage();

    // Saving the whole session (which grows over time) to storage on *every*
    // streamed token is expensive – the JSON.stringify call allocates a big
    // string and the subsequent custom Storage event causes a React render.
    // When a long answer is streamed these calls can fire hundreds of times
    // per second which results in visible lag / stuttering.

    // To keep the UI responsive we rate-limit the writes so we only hit
    // localStorage at most once every 150 ms.  The very last call is always
    // flushed to make sure nothing is lost.

    let lastSave = 0;
    let pendingFlush: number | null = null;

    function flushSession() {
      if (pendingFlush) {
        cancelAnimationFrame(pendingFlush);
      }
      pendingFlush = null;
      lastSave = performance.now();
      storage.setItem(SESSION_STORAGE_KEY(sessionId), JSON.stringify(session));
    }

    function saveSession(throttle = true) {
      if (!throttle) {
        flushSession();
        return;
      }

      const now = performance.now();
      // If the last save was long enough ago – save immediately.
      if (now - lastSave > 150) {
        flushSession();
      } else if (pendingFlush === null) {
        // Otherwise schedule a write on the next animation frame so we never
        // block the main thread for too long during rapid streaming.
        pendingFlush = requestAnimationFrame(flushSession);
      }
    }

    if (!session.provider || !session.modelId) {
      session.provider = provider;
      session.modelId = model;
      saveSession(false);
    }

    const abortController = new AbortController();
    this.currentAbortController = abortController;

    async function updateSession(
      resultMessage: IMessageResult[],
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) {
      await updator(resultMessage);
      session.updatedAt = Date.now();
      saveSession();
    }

    async function refreshSession() {
      session = await getSessionFromStorage();
      return session.turns;
    }

    const masterAgent = new MasterAgent();

    try {
      let newContextWindowUsage = 0;
      await masterAgent.message(
        session.turns,
        saveSession,
        refreshSession,
        updateSession,
        requestMessage,
        (delta) => {
          const inputDelta = delta.inputTokensDelta ?? 0;
          const outputDelta = delta.outputTokensDelta ?? 0;
          const anyDelta = inputDelta !== 0 || outputDelta !== 0;
          if (anyDelta) {
            newContextWindowUsage =
              newContextWindowUsage + inputDelta + outputDelta;
            session.contextWindowUsage = newContextWindowUsage;
            saveSession();
          }
        },
        abortController,
        async () => flushSession()
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // no-op
      } else {
        throw e;
      }
    }

    if (this.currentAbortController === abortController) {
      this.currentAbortController = null;
    }
  }

  getModelContextWindow(provider: IProvider, modelId: string) {
    if (!this[provider]) {
      throw new Error(`Provider ${provider} not supported`);
    }
    return this[provider].getModelContextWindow(modelId);
  }
}

export const AiSdk = new AISDK();
