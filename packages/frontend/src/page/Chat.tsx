import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { useSelectedModel } from "@/lib/storage-hooks";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";

export default function Chat() {
  const [modelId, setModelId] = useSelectedModel();

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  return (
    <main className="h-svh flex flex-col">
      <section className="h-full overflow-y-auto p-8 flex flex-col gap-8"></section>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit((data) => {
              console.log(data);
            });
          }}
          className="relative p-4 h-2/5"
        >
          <TextareaContainer className="flex flex-col gap-1 h-full">
            <FormItem className="w-full h-full">
              <FormControl>
                <Textarea
                  {...form.register("message")}
                  className="resize-none text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <div className="flex flex-row-reverse justify-between">
              <Button
                type="submit"
                size="icon"
                disabled={!modelId || !form.watch("message").trim()}
              >
                <LucideSend className="size-4" />
              </Button>
              <ModelSelector modelId={modelId} setModelId={setModelId} />
            </div>
          </TextareaContainer>
        </form>
      </Form>
    </main>
  );
}
