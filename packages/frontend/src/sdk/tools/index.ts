import type { ITool, IToolRegistry, IToolSchemaRegistry } from "../shared";
import { openWeatherTool } from "./openweather";
import { getToolConfig } from "@/sdk/tools/lib/utils";

export const TOOLS = {
  openweather: openWeatherTool,
} as const;
export type ToolId = keyof typeof TOOLS;

export default {
  get<T>(toolId: keyof typeof TOOLS): ITool<T> | undefined {
    return TOOLS[toolId] as ITool<T>;
  },
  getAll<T>(): ITool<T>[] {
    return Object.values(TOOLS) as ITool<T>[];
  },
  getToolSchemas(): IToolSchemaRegistry {
    return Object.values(TOOLS).map((tool) => tool.schema);
  },
  isToolEnabled(toolId: keyof typeof TOOLS): boolean {
    const tool = TOOLS[toolId];

    const config = getToolConfig(
      toolId,
      tool.getDefaultConfig(),
      tool.getConfigSchema()[1]
    );

    return config.disabled;
  },
} satisfies IToolRegistry;
