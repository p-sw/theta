import { API_KEY, SESSION, type IApiKey } from "@/lib/const";
import { dispatchStorageEvent } from "@/lib/utils";
import { AnthropicProvider } from "@/sdk/providers/anthropic";
import type {
  IMessageRequest,
  IMessageResult,
  IProvider,
  IProviderInfo,
  Session,
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
    provider: IProvider,
    model: string,
    requestMessage: IMessageRequest[]
  ) {
    const session = JSON.parse(
      localStorage.getItem(SESSION(sessionId)) ?? "[]"
    ) as Session;

    session.push({
      type: "request",
      message: requestMessage,
    });

    const resultMessage: IMessageResult[] = [];
    session.push({
      type: "response",
      message: resultMessage,
    });

    function updateSession(updator: (message: IMessageResult[]) => void) {
      updator(resultMessage);
      localStorage.setItem(SESSION(sessionId), JSON.stringify(session));
      dispatchStorageEvent(SESSION(sessionId));
    }

    switch (provider) {
      case "anthropic":
        return this.anthropic?.message(session, model, updateSession);
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  }
}

export const AiSdk = new AISDK();
