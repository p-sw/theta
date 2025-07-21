import {
  API_KEY,
  SESSION_STORAGE_KEY,
  STORAGE_CHANGE_EVENT_ALL,
  type IApiKey,
} from "@/lib/const";
import {
  dispatchEvent,
  dispatchStorageEvent,
  hyperidInstance,
} from "@/lib/utils";
import { AnthropicProvider } from "@/sdk/providers/anthropic";
import type {
  IMessageRequest,
  IMessageResult,
  IProvider,
  IProviderInfo,
  SessionTurnsResponse,
  TemporarySession,
} from "@/sdk/shared";

export const providerRegistry: Record<IProvider, IProviderInfo> = {
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
  },
};

export class AISDK {
  private anthropic: AnthropicProvider | null = null;

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

    session.turns.push({
      type: "request",
      messageId: hyperidInstance(),
      message: requestMessage,
    });

    const resultMessage: IMessageResult[] = [];
    const resultTurn: SessionTurnsResponse = {
      type: "response" as const,
      messageId: hyperidInstance(),
      message: resultMessage,
    };
    session.turns.push(resultTurn);

    function saveSession() {
      storage.setItem(SESSION_STORAGE_KEY(sessionId), JSON.stringify(session));
      dispatchStorageEvent(SESSION_STORAGE_KEY(sessionId));
      dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
    }

    function updateSession(updator: (message: IMessageResult[]) => void) {
      updator(resultMessage);
      session.updatedAt = Date.now();
      saveSession();
    }

    switch (provider) {
      case "anthropic":
        return this.anthropic?.message(
          session.turns.slice(
            0,
            -1
          ) /* removes just inserted empty response buffer */,
          model,
          updateSession,
          (stop) => {
            resultTurn.stop = stop;
            saveSession();
          }
        );
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  }
}

export const AiSdk = new AISDK();
