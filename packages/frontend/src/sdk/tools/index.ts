import type {
  ITool,
  IToolRegistry,
  IToolSchema,
  IToolSchemaRegistry,
} from "../shared";
import { openWeatherTool } from "./openweather";
import { getToolConfig } from "@/sdk/tools/lib/utils";

export const TOOLS = {
  openweather: openWeatherTool,
} as const;
export type ToolId = keyof typeof TOOLS;

export default {
  get<T>(toolId: ToolId): ITool<T> | undefined {
    return TOOLS[toolId] as ITool<T>;
  },
  getAll<T>(): ITool<T>[] {
    return Object.values(TOOLS) as ITool<T>[];
  },
  getToolSchema(toolId: ToolId): IToolSchema {
    return TOOLS[toolId].schema;
  },
  getEnabledTools(): IToolSchemaRegistry {
    return Object.entries(TOOLS)
      .filter(
        ([toolId, tool]) =>
          !getToolConfig(
            toolId as ToolId,
            tool.getDefaultConfig(),
            tool.getConfigSchema()[1]
          ).disabled
      )
      .map(([_, tool]) => tool.schema);
  },
  isToolEnabled(toolId: ToolId): boolean {
    const tool = TOOLS[toolId];

    const config = getToolConfig(
      toolId,
      tool.getDefaultConfig(),
      tool.getConfigSchema()[1]
    );

    return config.disabled;
  },
} satisfies IToolRegistry;
