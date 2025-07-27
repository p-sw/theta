import { TOOL_CONFIG_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import type { IToolConfig, IToolWithConfig } from "@/sdk/shared";
import { TOOLS, type ToolId } from "@/sdk/tools";
import { useMemo } from "react";

export function useTool<T>(toolId: ToolId): IToolWithConfig<T> {
  const tool = useMemo(() => {
    return TOOLS[toolId];
  }, [toolId]);

  const [toolConfig] = useStorage<IToolConfig<T>>(TOOL_CONFIG_KEY(toolId), {
    disabled: false,
    config: tool.getDefaultConfig() as T,
  });

  return {
    ...tool,
    ...toolConfig,
  } as IToolWithConfig<T>; // fuck
}
