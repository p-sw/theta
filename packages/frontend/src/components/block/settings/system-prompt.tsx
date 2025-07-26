import { useCallback } from "react";
import {
  useForm,
  type ControllerRenderProps,
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
import { Button } from "@/components/ui/button";
import { LucideSave, LucideTrash, LucidePlus } from "lucide-react";
import { SYSTEM_PROMPTS_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import {
  SettingsSubSection,
} from "@/components/layout/settings";
import type { ISystemPrompt } from "@/sdk/shared";

// Define the schema for system prompts
const systemPromptsSchema = z.object({
  systemPrompts: z.array(z.string()),
});

// FormControlArray component specifically for textareas
function FormControlTextareaArray({
  field,
}: {
  field: ControllerRenderProps<ISystemPrompt, "systemPrompts">;
}) {
  return (
    <div className="flex flex-col gap-2">
      {field.value.map((item: string, index: number) => (
        <div key={index} className="flex flex-row gap-2 items-start">
          <FormControl id={`systemPrompts-${index}`}>
            <Textarea
              placeholder="Enter system prompt"
              className="min-h-24 resize-y"
              onBlur={field.onBlur}
              value={item}
              onChange={(e) => {
                const newValue = [...field.value];
                newValue[index] = e.target.value;
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

export function SystemPromptForm() {
  const [systemPrompts, setSystemPrompts] = useStorage<ISystemPrompt>(
    SYSTEM_PROMPTS_KEY,
    { systemPrompts: [] }
  );

  const form = useForm<ISystemPrompt>({
    defaultValues: systemPrompts,
    resolver: zodResolver(systemPromptsSchema),
  });

  const onSubmit = useCallback(
    (data: ISystemPrompt) => {
      setSystemPrompts(data);
      toast("System prompts saved", {
        description: "System prompts configuration saved",
        action: {
          label: "Reset",
          onClick: () => {
            setSystemPrompts({ systemPrompts: [] });
            form.reset({ systemPrompts: [] });
          },
        },
      });
    },
    [setSystemPrompts, form]
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="systemPrompts"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row justify-between items-center">
                <FormLabel>System Prompts</FormLabel>
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
              <FormDescription>
                Add system prompts that will be used by the AI provider. Each prompt will be sent as a separate system message.
              </FormDescription>
              <FormControlTextareaArray field={field} />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">
          <LucideSave />
          Save
        </Button>
      </form>
    </Form>
  );
}

export function SystemPromptSection() {
  return (
    <SettingsSubSection title="System Prompts">
      <SystemPromptForm />
    </SettingsSubSection>
  );
}