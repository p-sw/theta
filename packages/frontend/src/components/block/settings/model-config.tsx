import { AiSdk } from "@/sdk";
import type { IProvider } from "@/sdk/shared";
import { useCallback, useMemo } from "react";
import { FormFactory } from "@/components/ui/form-factory";
import { PER_MODEL_CONFIG_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { toast } from "sonner";

export function ModelConfigForm({
  provider,
  modelId,
}: {
  provider: IProvider;
  modelId: string;
}) {
  const [config, setModelConfig] = useStorage(
    PER_MODEL_CONFIG_KEY(provider, modelId),
    AiSdk.getDefaultModelConfig(provider, modelId)
  );

  const [schema, schemaZod] = useMemo(
    () => AiSdk.getModelConfigSchema(provider, modelId),
    [provider, modelId]
  );

  const onSubmit = useCallback(
    (data: typeof config) => {
      setModelConfig(data);
      toast("Config saved", {
        description: `Model ${modelId} config saved`,
        action: {
          label: "Reset",
          onClick: () => {
            setModelConfig(AiSdk.getDefaultModelConfig(provider, modelId));
          },
        },
      });
    },
    [modelId, provider, setModelConfig]
  );

  return (
    <FormFactory
      schema={schema}
      schemaZod={schemaZod}
      defaultValues={config}
      onSubmit={onSubmit}
    />
  );
}
