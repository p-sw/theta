import { FormFactory } from "@/components/ui/form-factory";
import { TOOL_CONFIG_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import type { ToolId } from "@/sdk/tools";
import { useTool } from "@/sdk/tools/hooks";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { IToolConfig } from "@/sdk/shared";

export function ToolConfigForm({ toolId }: { toolId: ToolId }) {
  const tool = useTool(toolId);
  const [config, setToolConfig] = useStorage<IToolConfig<unknown>>(
    TOOL_CONFIG_KEY(toolId),
    {
      disabled: false,
      config: tool.getDefaultConfig(),
    }
  );

  const [schema, schemaZod] = useMemo(() => tool.getConfigSchema(), [tool]);

  const onSubmit = useCallback(
    (data: unknown) => {
      setToolConfig((prev) => ({
        ...prev,
        config: data as object,
      }));
      toast("Config saved", {
        description: `Tool ${toolId} config saved`,
        action: {
          label: "Reset",
          onClick: () => {
            setToolConfig({
              disabled: false,
              config: tool.getDefaultConfig() as object,
            });
          },
        },
      });
    },
    [setToolConfig, toolId, tool]
  );

  return (
    <FormFactory
      schema={schema}
      schemaZod={schemaZod}
      defaultValues={config.config}
      onSubmit={onSubmit}
    />
  );
}
