import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { dispatchEvent, useEventListener, useStorage } from "@/lib/utils";
import { useSelectedModel } from "@/lib/storage-hooks";
import { useAutoScroll } from "@/lib/use-auto-scroll";
import { AiSdk } from "@/sdk";
import { use, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";
import {
  NEW_SESSION_EVENT,
  SAVE_SESSION_EVENT,
  SESSION_STORAGE_KEY,
  STORAGE_CHANGE_EVENT_ALL,
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
import { DesktopNav } from "@/components/block/chat/desktop-nav.tsx";

export default function Chat() {
  const {
    sessionId,
    setNewSession,
    isPermanentSession,
    setIsPermanentSession,
  } = use(ChatContext);
  const [[provider, modelId], setModelId] = useSelectedModel();
  const { scrollContainerRef, triggerAutoScroll } =
    useAutoScroll<HTMLElement>();

  const [session] = useStorage<
    typeof isPermanentSession extends true ? PermanentSession : TemporarySession
  >(
    SESSION_STORAGE_KEY(sessionId),
    { id: sessionId, turns: [], createdAt: Date.now(), updatedAt: Date.now() },
    undefined,
    {
      temp: !isPermanentSession,
    },
  );

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  const handleSubmit = (data: { message: string }) => {
    form.reset();
    AiSdk.message(sessionId, isPermanentSession, provider!, modelId!, [
      { type: "text", text: data.message },
    ]).catch((e) => {
      toast.error(`${e.name ?? "Error"}: ${e.message}`);
    });
  };

  const handleNewSession = useCallback(() => {
    setIsPermanentSession(false);
    setNewSession();
  }, [setIsPermanentSession, setNewSession]);
  const handleSaveSession = useCallback(
    (e: CustomEvent<SaveSessionForm & { sessionId?: string }>) => {
      // copy from sessionStorage to localStorage
      localStorage.setItem(
        SESSION_STORAGE_KEY(e.detail.sessionId ?? sessionId),
        JSON.stringify({
          ...session,
          title: e.detail.title,
          updatedAt: Date.now(),
        }),
      );
      // make this page use localStorage
      setIsPermanentSession(true);
      // remove from sessionStorage
      sessionStorage.removeItem(SESSION_STORAGE_KEY(sessionId));

      dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
    },
    [sessionId, session, setIsPermanentSession],
  );
  useEventListener(NEW_SESSION_EVENT, handleNewSession);
  useEventListener(SAVE_SESSION_EVENT, handleSaveSession);

  // Trigger auto-scroll when session turns change (new messages)
  useEffect(() => {
    triggerAutoScroll();
  }, [session.turns.length, triggerAutoScroll]);

  return (
    <div className="w-full h-svhfull flex flex-row">
      <DesktopNav />
      <main className="h-svhfull flex flex-col w-full max-w-4xl mx-auto">
        <section
          ref={scrollContainerRef}
          className="h-full overflow-y-auto p-8 flex flex-col gap-8"
        >
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
            ),
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
    </div>
  );
}
