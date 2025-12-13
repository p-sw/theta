import { ToolAgent } from "./tool-agent";
import { GoogleCalendarProvider } from "./tool-agents/google-calendar";
import { GoogleContactsProvider } from "./tool-agents/google-contacts";
import { GoogleDocsProvider } from "./tool-agents/google-docs";
import { GoogleDriveProvider } from "./tool-agents/google-drive";
import { GoogleGmailProvider } from "./tool-agents/google-gmail";
import { GoogleSheetsProvider } from "./tool-agents/google-sheets";
import { GoogleTasksProvider } from "./tool-agents/google-tasks";
import { OpenWeatherProvider } from "./tool-agents/openweather";
import {
  type IToolMetaJson,
  type IToolProviderClass,
  type SessionTurns,
  type IMessageRequest,
  type IMessageResult,
} from "../shared";
import { localStorage } from "@/lib/storage";
import {
  TOOL_AGENT_PATCH_PREFIX,
  TOOL_PROVIDER_ENABLED_KEY,
  TOOL_PROVIDER_SEPARATOR,
} from "@/lib/const";
import { z } from "zod";
import type { JSONSchema7 } from "json-schema";
import { ToolRegistryError } from "./tool-agents/errors";

export const toolAgentSchema = z.object({
  prompt: z
    .string()
    .nonempty()
    .describe(
      "The content of the request. It should contains the contexts and additional informations that might be needed to call the third-party API and helps agent's thinking."
    ),
});

export class ToolAgentManager {
  toolAgents: Map<string, ToolAgent> = new Map();

  constructor() {
    this.registerProvider(GoogleCalendarProvider as never);
    this.registerProvider(GoogleContactsProvider as never);
    this.registerProvider(GoogleDocsProvider as never);
    this.registerProvider(GoogleDriveProvider as never);
    this.registerProvider(GoogleGmailProvider as never);
    this.registerProvider(GoogleSheetsProvider as never);
    this.registerProvider(GoogleTasksProvider as never);
    this.registerProvider(OpenWeatherProvider as never);
  }

  registerProvider(
    toolProviderClass: IToolProviderClass<Record<string, unknown>>
  ) {
    const toolAgent = new ToolAgent(toolProviderClass);
    this.toolAgents.set(toolProviderClass.id, toolAgent);
  }

  getEnabledTools(): IToolMetaJson[] {
    const tools: IToolMetaJson[] = [];

    const enabledProvidersString = localStorage.getItem(
      TOOL_PROVIDER_ENABLED_KEY
    );
    if (!enabledProvidersString) return [];
    let enabledProviders: string[] = [];
    try {
      enabledProviders = JSON.parse(enabledProvidersString);
    } catch (e) {
      console.error(
        `Unexpected error while parsing enabled tool provider list: ${enabledProvidersString}`,
        e
      );
      return [];
    }

    for (const providerId of enabledProviders) {
      const agent = this.toolAgents.get(providerId);
      if (!agent) continue;
      if (!agent.toolProviderInstance) continue;

      tools.push({
        id:
          TOOL_AGENT_PATCH_PREFIX +
          TOOL_PROVIDER_SEPARATOR +
          agent.toolProviderId,
        displayName: agent.toolProviderDisplayName,
        description: `Request to ${agent.toolProviderDisplayName} agent`,
        schema: toolAgentSchema,
        jsonSchema: z.toJSONSchema(toolAgentSchema) as JSONSchema7,
      });
    }
    return tools;
  }

  async execute(
    toolProviderId: string,
    sessionTurns: SessionTurns,
    saveSession: (throttle?: boolean) => void,
    refreshSession: () => Promise<SessionTurns>,
    updateResult: (
      resultMessage: IMessageResult[],
      updator: (message: IMessageResult[]) => Promise<unknown>
    ) => Promise<void>,
    requestMessage: IMessageRequest[],
    onUsage: (delta: {
      inputTokensDelta?: number;
      outputTokensDelta?: number;
    }) => void,
    abortController: AbortController,
    onFinish: () => Promise<void>
  ): Promise<void> {
    const [_, providerId] = toolProviderId.split(TOOL_PROVIDER_SEPARATOR);

    const agent = this.toolAgents.get(providerId);
    if (!agent) {
      throw new ToolRegistryError(`Tool agent ${providerId} not found`);
    }

    await agent.message(
      sessionTurns,
      saveSession,
      refreshSession,
      updateResult,
      requestMessage,
      onUsage,
      abortController,
      onFinish
    );
  }
}
