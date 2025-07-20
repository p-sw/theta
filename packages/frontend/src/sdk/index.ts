import { API_KEY, SESSION_STORAGE_KEY, type IApiKey } from "@/lib/const";
import { dispatchStorageEvent, hyperidInstance } from "@/lib/utils";
import { AnthropicProvider } from "@/sdk/providers/anthropic";
import type {
  IMessageRequest,
  IMessageResult,
  IProvider,
  IProviderInfo,
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
    session.turns.push({
      type: "response",
      messageId: hyperidInstance(),
      message: resultMessage,
    });

    function updateSession(updator: (message: IMessageResult[]) => void) {
      updator(resultMessage);
      storage.setItem(SESSION_STORAGE_KEY(sessionId), JSON.stringify(session));
      dispatchStorageEvent(SESSION_STORAGE_KEY(sessionId));
    }

    switch (provider) {
      case "anthropic":
        return this.anthropic?.message(
          session.turns.slice(
            0,
            -1
          ) /* removes just inserted empty response buffer */,
          model,
          updateSession
        );
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  }
}

export const AiSdk = new AISDK();
