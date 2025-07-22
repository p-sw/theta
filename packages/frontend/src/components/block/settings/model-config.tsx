import { AiSdk } from "@/sdk";
import type {
  IModelConfigSchemaArray,
  IModelConfigSchemaBoolean,
  IModelConfigSchemaNumber,
  IModelConfigSchemaString,
  IProvider,
} from "@/sdk/shared";
import { useCallback, useMemo } from "react";
import {
  useForm,
  type ControllerRenderProps,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LucideSave, LucideTrash, LucidePlus } from "lucide-react";
import { PER_MODEL_CONFIG_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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

  const form = useForm({
    defaultValues: AiSdk.getDefaultModelConfig(provider, modelId),
    resolver: zodResolver(schemaZod as any),
  });

  const onSubmit = useCallback(
    (data: typeof config) => {
      setModelConfig(data);
    },
    [setModelConfig]
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6 px-4"
      >
        {Object.entries(schema).map(([fieldId, fieldSchema]) => (
          <FormField
            key={fieldId}
            control={form.control}
            name={fieldId}
            render={({ field }) => (
              <FormItem>
                {fieldSchema.type === "array" ? (
                  <div className="flex flex-row justify-between items-center">
                    <FormLabel>{fieldSchema.displayName}</FormLabel>
                    <Button
                      variant="secondary"
                      size="icon"
                      type="button"
                      onClick={() => {
                        field.onChange([...field.value, ""]);
                      }}
                    >
                      <LucidePlus />
                    </Button>
                  </div>
                ) : (
                  <FormLabel>{fieldSchema.displayName}</FormLabel>
                )}
                <FormDescription>{fieldSchema.description}</FormDescription>
                {fieldSchema.type === "number" && (
                  <FormControlNumber
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                {fieldSchema.type === "string" && (
                  <FormControlString
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                {fieldSchema.type === "boolean" && (
                  <FormControlBoolean
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                {fieldSchema.type === "array" && (
                  <FormControlArray schema={fieldSchema} field={field} />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button type="submit">
          <LucideSave />
          Save
        </Button>
      </form>
    </Form>
  );
}

function FormControlNumber({
  schema,
  field,
  form,
}: {
  schema: IModelConfigSchemaNumber;
  field: ControllerRenderProps;
  form: UseFormReturn;
}) {
  return (
    <div className="flex flex-row gap-1 items-center">
      <Slider
        min={
          typeof schema.min === "object" && schema.min.$ref
            ? form.watch(schema.min.$ref)
            : schema.min
        }
        max={
          typeof schema.max === "object" && schema.max.$ref
            ? form.watch(schema.max.$ref)
            : schema.max
        }
        step={schema.step}
        value={[field.value]}
        onValueChange={(v) => field.onChange(v[0])}
        disabled={
          typeof schema.disabled === "object" && schema.disabled.$ref
            ? !form.watch(schema.disabled.$ref)
            : (schema.disabled as boolean)
        }
      />
      <FormControl>
        <Input
          type="number"
          className="w-24 text-xs"
          min={
            typeof schema.min === "object" && schema.min.$ref
              ? form.watch(schema.min.$ref)
              : schema.min
          }
          max={
            typeof schema.max === "object" && schema.max.$ref
              ? form.watch(schema.max.$ref)
              : schema.max
          }
          step={schema.step}
          value={field.value}
          onChange={(e) => field.onChange(parseFloat(e.target.value))}
          disabled={
            typeof schema.disabled === "object" && schema.disabled.$ref
              ? !form.watch(schema.disabled.$ref)
              : (schema.disabled as boolean)
          }
        />
      </FormControl>
    </div>
  );
}

function FormControlString({
  schema,
  field,
  form,
}: {
  schema: IModelConfigSchemaString;
  field: ControllerRenderProps;
  form: UseFormReturn;
}) {
  return (
    <FormControl>
      <Input
        {...field}
        disabled={
          typeof schema.disabled === "object" && schema.disabled.$ref
            ? !form.watch(schema.disabled.$ref)
            : (schema.disabled as boolean)
        }
      />
    </FormControl>
  );
}

function FormControlBoolean({
  schema,
  field,
  form,
}: {
  schema: IModelConfigSchemaBoolean;
  field: ControllerRenderProps;
  form: UseFormReturn;
}) {
  return (
    <FormControl>
      <Switch
        checked={field.value}
        onCheckedChange={field.onChange}
        disabled={
          typeof schema.disabled === "object" && schema.disabled.$ref
            ? !form.watch(schema.disabled.$ref)
            : (schema.disabled as boolean)
        }
      />
    </FormControl>
  );
}

function FormControlArray({
  schema,
  field,
}: {
  schema: IModelConfigSchemaArray;
  field: ControllerRenderProps;
}) {
  return (
    <div className="flex flex-col gap-2">
      {field.value.map((item: string, index: number) => (
        <div key={index} className="flex flex-row gap-2 items-center">
          <FormControl id={`stopSequences-${index}`}>
            <Input
              type={schema.items.type === "string" ? "text" : "number"}
              onBlur={field.onBlur}
              value={item}
              onChange={(e) => {
                const newValue = [...field.value];
                newValue[index] =
                  schema.items.type === "string"
                    ? e.target.value
                    : parseFloat(e.target.value);
                field.onChange(newValue);
              }}
            />
          </FormControl>
          <Button
            variant="secondary"
            size="icon"
            type="button"
            onClick={() => {
              const newValue = [...field.value];
              newValue.splice(index, 1);
              field.onChange(newValue);
            }}
          >
            <LucideTrash />
          </Button>
        </div>
      ))}
    </div>
  );
}

export { FormControlNumber, FormControlString, FormControlArray };
