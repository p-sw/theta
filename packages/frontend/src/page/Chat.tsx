import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { useEventListener, useStorage } from "@/lib/utils";
import { useSelectedModel } from "@/lib/storage-hooks";
import { AiSdk } from "@/sdk";
import { use, useCallback } from "react";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";
import {
  CLEAR_SESSION_EVENT,
  NEW_SESSION_EVENT,
  SAVE_SESSION_EVENT,
  SESSION_STORAGE_KEY,
} from "@/lib/const";
import type { PermanentSession, TemporarySession } from "@/sdk/shared";
import { UserMessage } from "@/components/block/chat/user-message";
import { AssistantMessage } from "@/components/block/chat/assistant-message";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveSessionForm } from "@/components/block/menu";
import { ChatContext } from "./context/Chat";

export default function Chat() {
  const {
    sessionId,
    setNewSession,
    isPermanentSession,
    setIsPermanentSession,
  } = use(ChatContext);
  const [[provider, modelId], setModelId] = useSelectedModel();

  const [session, setSession] = useStorage<
    typeof isPermanentSession extends true ? PermanentSession : TemporarySession
  >(
    SESSION_STORAGE_KEY(sessionId),
    { id: sessionId, turns: [], createdAt: Date.now(), updatedAt: Date.now() },
    undefined,
    {
      temp: !isPermanentSession,
    }
  );

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  const handleSubmit = (data: { message: string }) => {
    AiSdk.message(sessionId, isPermanentSession, provider!, modelId!, [
      { type: "text", text: data.message },
    ]).catch((e) => {
      toast.error(`${e.name ?? "Error"}: ${e.message}`);
    });
  };

  const handleNewSession = useCallback(() => {
    setNewSession();
  }, [setNewSession]);
  const handleClearSession = useCallback(() => {
    setSession((prev) => ({
      id: sessionId,
      turns: [],
      createdAt: prev.createdAt,
      updatedAt: Date.now(),
    }));
  }, [sessionId]);
  const handleSaveSession = useCallback(
    (e: CustomEvent<SaveSessionForm>) => {
      // copy from sessionStorage to localStorage
      localStorage.setItem(
        SESSION_STORAGE_KEY(sessionId),
        JSON.stringify({
          ...session,
          title: e.detail.title,
          updatedAt: Date.now(),
        })
      );
      // make this page use localStorage
      setIsPermanentSession(true);
      // remove from sessionStorage
      sessionStorage.removeItem(SESSION_STORAGE_KEY(sessionId));
    },
    [sessionId, session]
  );
  useEventListener(NEW_SESSION_EVENT, handleNewSession);
  useEventListener(CLEAR_SESSION_EVENT, handleClearSession);
  useEventListener(SAVE_SESSION_EVENT, handleSaveSession);

  return (
    <main className="h-svhfull flex flex-col">
      <section className="h-full overflow-y-auto p-8 flex flex-col gap-8">
        {session.turns.map((message) =>
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
              stop={message.stop}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      e.preventDefault();
                      form.handleSubmit(handleSubmit)(e);
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <div className="flex flex-row-reverse justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      !modelId || !provider || !form.watch("message").trim()
                    }
                  >
                    <LucideSend className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send</p>
                </TooltipContent>
              </Tooltip>
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
