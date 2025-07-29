import { API_KEY, SESSION_STORAGE_KEY, type IApiKey } from "@/lib/const";
import { hyperidInstance } from "@/lib/utils";
import { AnthropicProvider } from "@/sdk/providers/anthropic";
import type {
  IMessageRequest,
  IMessageResult,
  IProvider,
  IProviderInfo,
  SessionTurnsResponse,
  SessionTurnsToolInProgress,
  TemporarySession,
} from "@/sdk/shared";
import { localStorage, sessionStorage } from "@/lib/storage";
import { toolRegistry } from "@/sdk/tools";

export const providerRegistry: Record<IProvider, IProviderInfo> = {
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
  },
};

export class AISDK {
  anthropic: AnthropicProvider | null = null;

  constructor() {
    const apiKey: IApiKey = JSON.parse(localStorage.getItem(API_KEY) ?? "{}");

    if (apiKey.anthropic) {
      this.anthropic = new AnthropicProvider(apiKey.anthropic);
    }
  }

  async getAvailableModels() {
    const anthropicModels = (await this.anthropic?.getModels()) ?? [];

    return [...anthropicModels];
  }

  async message(
    sessionId: string,
    isPermanentSession: boolean,
    provider: IProvider,
    model: string,
    requestMessage: IMessageRequest[]
  ) {
    const storage = isPermanentSession ? localStorage : sessionStorage;
    const session = JSON.parse(
      storage.getItem(SESSION_STORAGE_KEY(sessionId)) ?? "{}"
    ) as TemporarySession;

    function saveSession() {
      storage.setItem(SESSION_STORAGE_KEY(sessionId), JSON.stringify(session));
    }

    session.turns.push({
      type: "request",
      messageId: hyperidInstance(),
      message: requestMessage,
    });
    saveSession();

    const resultMessage: IMessageResult[] = [];
    const resultTurn: SessionTurnsResponse = {
      type: "response" as const,
      messageId: hyperidInstance(),
      message: resultMessage,
    };
    session.turns.push(resultTurn);
    saveSession();

    async function updateSession(
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) {
      await updator(resultMessage);
      session.updatedAt = Date.now();
      saveSession();
    }

    switch (provider) {
      case "anthropic":
        await this.anthropic?.message(
          session.turns.slice(
            0,
            -1
          ) /* removes just inserted empty response buffer */,
          model,
          updateSession,
          (stop) => {
            resultTurn.stop = stop;
            saveSession();
          },
          toolRegistry.getEnabledTools()
        );
        break;
      default:
        throw new Error(`Provider ${provider} not supported`);
    }

    // tool use handling
    if (resultTurn.stop?.type === "tool_use") {
      const toolUses = resultTurn.message.filter(
        (message) => message.type === "tool_use"
      );
      // const toolUseResult: IMessageRequestToolResult[] = [];

      toolUses.forEach((toolUse) => {
        const toolTurn: SessionTurnsToolInProgress = {
          type: "tool",
          useId: toolUse.id,
          toolName: toolUse.name,
          granted: false,
          requestContent: toolUse.input,
          done: false,
        };
        session.turns.push(toolTurn);
        console.debug("Adding tool to run: ", toolTurn);
        saveSession();
      });
    }
  }

  getDefaultModelConfig(provider: IProvider, modelId: string) {
    if (!this[provider]) {
      throw new Error(`Provider ${provider} not supported`);
    }

    return this[provider].getDefaultModelConfig(modelId);
  }

  getModelConfigSchema(provider: IProvider, modelId: string) {
    if (!this[provider]) {
      throw new Error(`Provider ${provider} not supported`);
    }

    return this[provider].getModelConfigSchema(modelId);
  }
}

export const AiSdk = new AISDK();
