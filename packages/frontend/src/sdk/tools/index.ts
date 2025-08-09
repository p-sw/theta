import type {
  IConfigSchema,
  ITool,
  IToolMetaJson,
  IToolProvider,
  IToolProviderMeta,
  IToolRegistry,
} from "@/sdk/shared";
import { OpenWeatherProvider } from "@/sdk/tools/providers/openweather";
import { GoogleCalendarProvider } from "@/sdk/tools/providers/google-calendar";
import { GoogleTasksProvider } from "@/sdk/tools/providers/google-tasks";
import { localStorage } from "@/lib/storage";
import {
  TOOL_ENABLED_KEY,
  TOOL_PROVIDER_AVAILABILITY_KEY,
  TOOL_PROVIDER_CONFIG_KEY,
  TOOL_PROVIDER_ENABLED_KEY,
  TOOL_PROVIDER_SEPARATOR,
} from "@/lib/const";
import { ToolRegistryError } from "@/sdk/tools/errors";
import { z } from "zod";
import type { JSONSchema7 } from "json-schema";
import { dispatchEvent } from "@/lib/utils";

export class ToolRegistry implements IToolRegistry {
  private providers: Record<string, IToolProvider<Record<string, unknown>>> =
    {};
  private availableProviders: Record<
    string,
    IToolProvider<Record<string, unknown>>
  > = {};

  constructor() {
    this.registerProvider(new OpenWeatherProvider() as never);
    this.registerProvider(new GoogleCalendarProvider() as never);
    this.registerProvider(new GoogleTasksProvider() as never);
    this.initProviders();
  }

  private registerProvider(provider: IToolProvider<Record<string, unknown>>) {
    if (provider.id in this.providers) {
      console.error(`Provider ${provider.id} already registered, skipping`);
      return;
    }
    this.providers[provider.id] = provider;
    window.addEventListener(TOOL_PROVIDER_CONFIG_KEY(provider.id), () => {
      this.initProvider(provider.id);
    });
  }

  private initProviders() {
    for (const providerId of Object.keys(this.providers)) {
      this.initProvider(providerId);
    }
  }

  private initProvider(providerId: string) {
    const onFail = () => {
      if (providerId in this.availableProviders)
        delete this.availableProviders[providerId];
      dispatchEvent(TOOL_PROVIDER_AVAILABILITY_KEY, {});
    };

    const config = localStorage.getItem(TOOL_PROVIDER_CONFIG_KEY(providerId));
    if (!config) {
      onFail();
      return;
    }
    const provider = this.providers[providerId];

    // try parse
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(config);
    } catch {
      console.error(
        `Failed to parse tool provider config for ${providerId}: ${config}`
      );
      onFail();
      return;
    }
    // back up with default config
    parsed = {
      ...provider.getDefaultConfig(),
      ...parsed,
    };
    // try setup
    try {
      provider.setup(parsed);
      this.availableProviders[providerId] = provider;
      dispatchEvent(TOOL_PROVIDER_AVAILABILITY_KEY, {});
    } catch (e) {
      onFail();
      if (e instanceof ToolRegistryError) {
        // failure of config validation - skip
      } else {
        throw new ToolRegistryError(
          `Unexpected error while setting up provider ${provider.id}: ${
            (e as Error).message
          }`
        );
      }
    }
  }

  private patchTool(providerId: string, tool: ITool): IToolMetaJson {
    return {
      id: providerId + TOOL_PROVIDER_SEPARATOR + tool.id,
      displayName: tool.displayName,
      description: tool.description,
      schema: tool.schema,
      jsonSchema: z.toJSONSchema(tool.schema) as JSONSchema7,
    };
  }

  private patchTools(providerId: string, tools: ITool[]): IToolMetaJson[] {
    return tools.map((tool) => this.patchTool(providerId, tool));
  }

  get(providerToolId: string): IToolMetaJson | undefined;
  get(providerId: string, toolId: string): IToolMetaJson | undefined;
  get(providerIdToolId: string, toolId?: string): IToolMetaJson | undefined {
    if (!toolId) {
      const [providerId, toolId] = providerIdToolId.split(
        TOOL_PROVIDER_SEPARATOR
      );
      return this.get(providerId, toolId);
    }
    const provider = this.providers[providerIdToolId];
    if (!provider) {
      return undefined;
    }
    const tool = provider.tools.find((tool) => tool.id === toolId);
    if (!tool) {
      return undefined;
    }
    return this.patchTool(provider.id, tool);
  }

  getAll(providerId: string): IToolMetaJson[];
  getAll(): IToolMetaJson[];
  getAll(providerId?: string): IToolMetaJson[] {
    if (providerId) {
      return this.patchTools(providerId, this.providers[providerId].tools);
    }
    const tools: IToolMetaJson[] = [];
    for (const providerId of Object.keys(this.providers)) {
      tools.push(
        ...this.patchTools(providerId, this.providers[providerId].tools)
      );
    }
    return tools;
  }

  getEnabledTools(): IToolMetaJson[];
  getEnabledTools(providerId: string): IToolMetaJson[];
  getEnabledTools(providerIdOrAll?: string): IToolMetaJson[] {
    const tools: IToolMetaJson[] = [];
    const providers: string[] = providerIdOrAll
      ? [providerIdOrAll]
      : Object.keys(this.providers);

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

    const enabledToolsString = localStorage.getItem(TOOL_ENABLED_KEY);
    if (!enabledToolsString) return [];
    let enabledTools: string[] = [];
    try {
      enabledTools = JSON.parse(enabledToolsString);
    } catch (e) {
      console.error(
        `Unexpected error while parsing enabled tool list: ${enabledToolsString}`,
        e
      );
      return [];
    }
    // before parse: ['provider1:tool1', 'provider1:tool2', 'provider2:tool1']
    // after parse: { provider1: ['tool1', 'tool2'], provider2: ['tool1'] }
    const enabledToolsMap: Record<string, string[]> = {};
    for (const providerIdToolId of enabledTools) {
      const [providerId, toolId] = providerIdToolId.split(
        TOOL_PROVIDER_SEPARATOR
      );
      if (!enabledToolsMap[providerId]) enabledToolsMap[providerId] = [];
      enabledToolsMap[providerId].push(toolId);
    }

    for (const providerId of providers) {
      if (!enabledProviders.includes(providerId)) continue;
      if (!(providerId in enabledToolsMap)) continue;
      tools.push(
        ...this.patchTools(
          providerId,
          this.providers[providerId].tools.filter((tool) =>
            enabledToolsMap[providerId].includes(tool.id)
          )
        )
      );
    }
    return tools;
  }

  isToolEnabled(providerToolId: string): boolean;
  isToolEnabled(providerId: string, toolId: string): boolean;
  isToolEnabled(providerIdToolId: string, _toolId?: string): boolean {
    const providerId = _toolId
      ? providerIdToolId
      : providerIdToolId.split(TOOL_PROVIDER_SEPARATOR)[0];
    const toolId = _toolId
      ? _toolId
      : providerIdToolId.split(TOOL_PROVIDER_SEPARATOR)[1];

    const enabledProvidersString = localStorage.getItem(
      TOOL_PROVIDER_ENABLED_KEY
    );
    if (!enabledProvidersString) return false;
    let enabledProviders: string[] = [];
    try {
      enabledProviders = JSON.parse(enabledProvidersString);
    } catch (e) {
      console.error(
        `Unexpected error while parsing enabled tool provider list: ${enabledProvidersString}`,
        e
      );
      return false;
    }
    if (!enabledProviders.includes(providerId)) return false;

    const enabledToolsString = localStorage.getItem(TOOL_ENABLED_KEY);
    if (!enabledToolsString) return false;
    let enabledTools: string[] = [];
    try {
      enabledTools = JSON.parse(enabledToolsString);
    } catch (e) {
      console.error(
        `Unexpected error while parsing enabled tool list: ${enabledToolsString}`,
        e
      );
      return false;
    }
    return enabledTools.includes(providerId + TOOL_PROVIDER_SEPARATOR + toolId);
  }

  async execute(providerToolId: string, parameters: unknown): Promise<string> {
    const [providerId, toolId] = providerToolId.split(TOOL_PROVIDER_SEPARATOR);
    if (!toolId) {
      throw new ToolRegistryError(`toolId was not provided`);
    }

    if (!(providerId in this.providers)) {
      throw new ToolRegistryError(`Provider ${providerId} not found`);
    }

    return await this.providers[providerId].execute(toolId, parameters);
  }

  getProviders(): IToolProviderMeta[] {
    return Object.values(this.providers).map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      description: provider.description,
    }));
  }

  isProviderAvailable(providerId: string): boolean {
    return providerId in this.availableProviders;
  }

  getProviderConfig(
    providerId: string
  ): [object, Record<string, IConfigSchema>, z.ZodSchema<object>] {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new ToolRegistryError(`Provider ${providerId} not found`);
    }
    return [provider.getDefaultConfig(), ...provider.getConfigSchema()];
  }
}

export const toolRegistry = new ToolRegistry();
