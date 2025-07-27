import { TOOL_CONFIG_KEY } from "@/lib/const";
import type { TOOLS } from "@/sdk/tools/index";
import { ToolRegistryError } from "./errors";
import { z } from "zod";
import { localStorage } from "@/lib/storage";
import type { IToolConfig } from "@/sdk/shared";

export function getToolConfig<T>(
  toolId: keyof typeof TOOLS,
  defaultConfig: T,
  configSchema: z.ZodSchema
): IToolConfig<T> {
  const key = TOOL_CONFIG_KEY(toolId);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        disabled: parsed.disabled ?? false,
        config: configSchema.parse(parsed.config) as T,
      };
    } catch (e) {
      throw new ToolRegistryError(
        `Failed to parse config for tool ${toolId}: ${e}`
      );
    }
  }
  return {
    disabled: false,
    config: defaultConfig,
  };
}
