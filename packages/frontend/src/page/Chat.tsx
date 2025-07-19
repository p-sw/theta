import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { useHyperId, useStorage } from "@/lib/utils";
import { useSelectedModel } from "@/lib/storage-hooks";
import { AiSdk } from "@/sdk";
import { useState } from "react";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";
import { SESSION_STORAGE_KEY } from "@/lib/const";
import type { Session } from "@/sdk/shared";
import { UserMessage } from "@/components/block/chat/user-message";
import { AssistantMessage } from "@/components/block/chat/assistant-message";
import { toast } from "sonner";

export default function Chat() {
  const [[provider, modelId], setModelId] = useSelectedModel();
  const newSessionId = useHyperId();
  const [sessionId] = useState<string>(newSessionId);

  const [session] = useStorage<Session>(SESSION_STORAGE_KEY(sessionId), []);

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  const handleSubmit = (data: { message: string }) => {
    AiSdk.message(sessionId, provider!, modelId!, [
      { type: "text", text: data.message },
    ]).catch((e) => {
      toast.error(`${e.name ?? "Error"}: ${e.message}`);
    });
  };

  return (
    <main className="h-svh flex flex-col">
      <section className="h-full overflow-y-auto p-8 flex flex-col gap-8">
        {session.map((message) =>
          message.type === "request" ? (
            <UserMessage
              key={`${sessionId}-${message.messageId}`}
              sessionId={sessionId}
              messageId={message.messageId}
              messages={message.message}
            />
          ) : (
            <AssistantMessage
              key={`${sessionId}-${message.messageId}`}
              sessionId={sessionId}
              messageId={message.messageId}
              messages={message.message}
            />
          )
        )}
      </section>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(handleSubmit)(e);
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
                disabled={
                  !modelId || !provider || !form.watch("message").trim()
                }
              >
                <LucideSend className="size-4" />
              </Button>
              <ModelSelector
                provider={provider}
                modelId={modelId}
                setModelId={setModelId}
              />
            </div>
          </TextareaContainer>
        </form>
      </Form>
    </main>
  );
}
