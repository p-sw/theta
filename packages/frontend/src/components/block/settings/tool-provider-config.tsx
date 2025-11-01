import { FormFactory } from "@/components/ui/form-factory";
import { useToolProvidersConfig } from "@/lib/tools";
import type { IToolProviderMeta } from "@/sdk/shared";
import { useCallback } from "react";
import { toast } from "sonner";

export function ToolProviderConfigForm({
  provider,
}: {
  provider: IToolProviderMeta;
}) {
  const [config, setConfig, schema, schemaZod] = useToolProvidersConfig(
    provider.id
  );

  const onSubmit = useCallback(
    (data: typeof config) => {
      setConfig(data);
      toast("Config saved", {
        description: `Provider ${provider.displayName} config saved`,
      });
    },
    [provider, setConfig]
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
