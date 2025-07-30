import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { useEventListener, useStorage } from "@/lib/utils";
import { useSelectedModel } from "@/lib/storage-hooks";
import { useAutoScroll } from "@/lib/use-auto-scroll";
import { AiSdk } from "@/sdk";
import { useCallback, useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";
import {
  NEW_SESSION_EVENT,
  SAVE_SESSION_EVENT,
  SESSION_STORAGE_KEY,
} from "@/lib/const";
import type {
  PermanentSession,
  SessionTurnsResponse,
  SessionTurnsTool,
  TemporarySession,
} from "@/sdk/shared";
import { UserMessage } from "@/components/block/chat/user-message";
import { AssistantMessage } from "@/components/block/chat/assistant-message";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveSessionForm } from "@/components/block/dialogs/save-session";
import { ChatContext } from "./context/Chat";
import { DesktopNav } from "@/components/block/chat/desktop-nav.tsx";
import { localStorage, sessionStorage } from "@/lib/storage";
import { ToolUseCard } from "@/components/block/chat/tool-block";
import { toolRegistry } from "@/sdk/tools";

export default function Chat() {
  const {
    sessionId,
    setNewSession,
    isPermanentSession,
    setIsPermanentSession,
  } = useContext(ChatContext);
  const [[provider, modelId], setModelId] = useSelectedModel();
  const { scrollContainerRef, triggerAutoScroll } =
    useAutoScroll<HTMLElement>();

  const [session, setSession] = useStorage<
    typeof isPermanentSession extends true ? PermanentSession : TemporarySession
  >(
    SESSION_STORAGE_KEY(sessionId),
    {
      id: sessionId,
      title: new Date(Date.now()).toLocaleString(),
      turns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
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

  const handleSubmit = useCallback(
    (data: { message: string }) => {
      if (!modelId || !provider || data.message.trim() === "") return;
      form.reset();
      AiSdk.message(sessionId, isPermanentSession, provider!, modelId!, [
        { type: "text", text: data.message },
      ]).catch((e) => {
        toast.error(`${e.name ?? "Error"}: ${e.message}`);
      });
    },
    [sessionId, isPermanentSession, provider, modelId, form]
  );

  useEffect(() => {
    //// if all tools are done, send message to ai
    const lastAssistantTurn = session.turns.reduce<SessionTurnsResponse | null>(
      (prev, turn) => (turn.type === "response" ? turn : prev),
      null
    );
    if (!lastAssistantTurn || lastAssistantTurn.stop?.type !== "tool_use")
      return;
    const lastAssistantToolUseId = lastAssistantTurn.message
      .filter((message) => message.type === "tool_use")
      .map((message) => message.id);
    const usedTools = session.turns.filter(
      (turn): turn is SessionTurnsTool =>
        turn.type === "tool" && lastAssistantToolUseId.includes(turn.useId)
    );
    if (usedTools.length > 0 && usedTools.every((tool) => tool.done)) {
      AiSdk.message(
        sessionId,
        isPermanentSession,
        provider!,
        modelId!,
        usedTools.map((toolResult) => ({
          type: "tool_result",
          tool_use_id: toolResult.useId,
          content: toolResult.responseContent,
          is_error: toolResult.isError,
        }))
      ).catch((e) => {
        toast.error(`${e.name ?? "Error"}: ${e.message}`);
      });
    }
  }, [session.turns, sessionId, isPermanentSession, provider, modelId]);

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
        })
      );
      // make this page use localStorage
      setIsPermanentSession(true);
      // remove from sessionStorage
      sessionStorage.removeItem(SESSION_STORAGE_KEY(sessionId));
    },
    [sessionId, session, setIsPermanentSession]
  );
  useEventListener(NEW_SESSION_EVENT, handleNewSession);
  useEventListener(SAVE_SESSION_EVENT, handleSaveSession);

  // Auto-grant whitelisted tools
  useEffect(() => {
    const handleAutoGrant = async (event: CustomEvent) => {
      const { useId } = event.detail;
      await onToolGrant(useId);
    };
    
    window.addEventListener("auto-grant-tool", handleAutoGrant as EventListener);
    return () => {
      window.removeEventListener("auto-grant-tool", handleAutoGrant as EventListener);
    };
  }, [onToolGrant]);

  const onToolGrant = useCallback(
    async (useId: string) => {
      const toolTurnIndex = session.turns.findIndex(
        (turn) => turn.type === "tool" && turn.useId === useId
      );
      if (toolTurnIndex === -1) return;
      const turn = session.turns[toolTurnIndex] as SessionTurnsTool;
      if (turn.done) return;

      try {
        const toolResult = await toolRegistry.execute(
          turn.toolName,
          JSON.parse(turn.requestContent)
        );
        setSession((prev) => {
          const newSession = { ...prev };
          newSession.turns[toolTurnIndex] = {
            ...turn,
            done: true,
            granted: true,
            isError: false,
            responseContent: toolResult,
          };
          return newSession;
        });
      } catch (e) {
        setSession((prev) => {
          const newSession = { ...prev };
          newSession.turns[toolTurnIndex] = {
            ...turn,
            done: true,
            granted: true,
            isError: true,
            responseContent:
              (e as Error).message ?? "Unexpected error while executing tool",
          };
          return newSession;
        });
        return;
      }
    },
    [session.turns, setSession]
  );

  const onToolReject = useCallback(
    (useId: string) => {
      setSession((prev) => {
        const newSession = { ...prev };
        const toolTurnIndex = newSession.turns.findIndex(
          (turn) => turn.type === "tool" && turn.useId === useId
        );
        if (toolTurnIndex === -1) return newSession;
        newSession.turns[toolTurnIndex] = {
          ...newSession.turns[toolTurnIndex],
          done: true,
          granted: false,
          isError: true,
          responseContent: "User rejected tool use",
        };
        return newSession;
      });
    },
    [setSession]
  );

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
          className="h-full overflow-y-auto p-8 flex flex-col gap-16"
        >
          {session.turns.map((message) => {
            if (message.type === "request") {
              const displayableMessages = message.message.filter(
                (message) => message.type === "text"
              );
              if (displayableMessages.length === 0) return null;
              return (
                <UserMessage
                  key={`${sessionId}-${message.messageId}`}
                  sessionId={sessionId}
                  messageId={message.messageId}
                  messages={displayableMessages}
                />
              );
            } else if (message.type === "response") {
              return (
                <AssistantMessage
                  key={`${sessionId}-${message.messageId}`}
                  sessionId={sessionId}
                  messageId={message.messageId}
                  messages={message.message}
                  stop={message.stop}
                />
              );
            } else if (message.type === "tool") {
              return (
                <ToolUseCard
                  key={`${sessionId}-${message.useId}`}
                  message={message}
                  onGrant={() => onToolGrant(message.useId)}
                  onReject={() => onToolReject(message.useId)}
                />
              );
            }
          })}
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
