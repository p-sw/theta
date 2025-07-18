import { API_KEY, type IApiKey } from "@/lib/const";
import { AnthropicProvider } from "@/sdk/providers/anthropic";

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
}

export const AiSdk = new AISDK();
