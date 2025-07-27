import type {
  IConfigSchemaArray,
  IConfigSchemaBoolean,
  IConfigSchemaNumber,
  IConfigSchemaString,
  IConfigSchema,
  IConfigSchemaEnum,
  IConfigSchemaEnumGroup,
} from "@/sdk/shared";
import { useCallback, useId } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { z } from "zod";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FormFactoryProps<T = Record<string, unknown>> {
  schema: Record<string, IConfigSchema>;
  schemaZod: z.ZodSchema<T>;
  defaultValues: T;
  onSubmit: (data: T) => void;
  submitButtonText?: string;
  className?: string;
}

export function FormFactory<T = Record<string, unknown>>({
  schema,
  schemaZod,
  defaultValues,
  onSubmit,
  submitButtonText = "Save",
  className = "flex flex-col gap-6 px-4",
}: FormFactoryProps<T>) {
  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues as Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schemaZod as any),
  });

  const handleSubmit = useCallback(
    (data: T) => {
      onSubmit(data);
    },
    [onSubmit]
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={className}>
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
                  <FormControlArray
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                {fieldSchema.type === "enum" && (
                  <FormControlEnum
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                {fieldSchema.type === "enumgroup" && (
                  <FormControlEnumGroup
                    schema={fieldSchema}
                    field={field}
                    form={form}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button type="submit">
          <LucideSave />
          {submitButtonText}
        </Button>
      </form>
    </Form>
  );
}

interface FormControlProps<T> {
  schema: T;
  field: ControllerRenderProps;
  form: UseFormReturn;
}

function FormControlNumber({
  schema,
  field,
  form,
}: FormControlProps<IConfigSchemaNumber>) {
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
          typeof schema.disabled === "object"
            ? schema.disabled.not
              ? !form.watch(schema.disabled.$ref)
              : form.watch(schema.disabled.$ref)
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
            typeof schema.disabled === "object"
              ? schema.disabled.not
                ? !form.watch(schema.disabled.$ref)
                : form.watch(schema.disabled.$ref)
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
}: FormControlProps<IConfigSchemaString>) {
  return (
    <FormControl>
      <Input
        {...field}
        disabled={
          typeof schema.disabled === "object"
            ? schema.disabled.not
              ? !form.watch(schema.disabled.$ref)
              : form.watch(schema.disabled.$ref)
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
}: FormControlProps<IConfigSchemaBoolean>) {
  return (
    <FormControl>
      <Switch
        checked={field.value}
        onCheckedChange={field.onChange}
        disabled={
          typeof schema.disabled === "object"
            ? schema.disabled.not
              ? !form.watch(schema.disabled.$ref)
              : form.watch(schema.disabled.$ref)
            : (schema.disabled as boolean)
        }
      />
    </FormControl>
  );
}

function FormControlArray({
  schema,
  field,
}: FormControlProps<IConfigSchemaArray>) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      {field.value.map((item: string, index: number) => (
        <div
          key={`${id}-${index}`}
          className="flex flex-row gap-2 items-center"
        >
          <FormControl>
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

function FormControlEnum({
  schema,
  field,
}: FormControlProps<IConfigSchemaEnum>) {
  const id = useId();

  return (
    <Select onValueChange={field.onChange} defaultValue={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder={schema.placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {schema.items.map((item) => (
          <SelectItem key={`${id}-${item.value}`} value={item.value}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FormControlEnumGroup({
  schema,
  field,
}: FormControlProps<IConfigSchemaEnumGroup>) {
  const id = useId();

  return (
    <Select onValueChange={field.onChange} defaultValue={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder={schema.placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {schema.items.map((item) => (
          <SelectGroup key={`${id}-${item.label}`}>
            <SelectLabel>{item.label}</SelectLabel>
            {item.items.map((item2) => (
              <SelectItem key={`${id}-${item2.value}`} value={item2.value}>
                {item2.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  FormControlNumber,
  FormControlString,
  FormControlBoolean,
  FormControlArray,
  FormControlEnum,
  FormControlEnumGroup,
};
