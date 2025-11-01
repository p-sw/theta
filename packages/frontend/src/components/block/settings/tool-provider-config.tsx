import { FormFactory } from "@/components/ui/form-factory";
import { useToolProvidersConfig } from "@/lib/tools";
import type { IToolProviderMeta } from "@/sdk/shared";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

export function ToolProviderConfigForm({
  provider,
}: {
  provider: IToolProviderMeta;
}) {
  const [config, setConfig, schema, schemaZod] = useToolProvidersConfig(
    provider.id
  );

  const hasAutoSaved = useRef(false);

  useEffect(() => {
    if (hasAutoSaved.current) return;
    if (Object.keys(schema).length === 0) {
      hasAutoSaved.current = true;
      setConfig((prev) => ({ ...prev }));
    }
  }, [schema, setConfig]);

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
