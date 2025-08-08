import { ModelSelector } from "@/components/block/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea, TextareaContainer } from "@/components/ui/textarea";
import { useEventListener, useStorage } from "@/lib/utils";
import { useSelectedModel } from "@/lib/storage-hooks";
import { useAutoScroll } from "@/lib/use-auto-scroll";
import { AiSdk } from "@/sdk";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";
import LucidePause from "~icons/lucide/pause";
import {
  NEW_SESSION_EVENT,
  SAVE_SESSION_EVENT,
  SESSION_STORAGE_KEY,
  CHECKOUT_MESSAGE_EVENT,
} from "@/lib/const";
import type {
  PermanentSession,
  SessionTurnsRequest,
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
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";

export default function Chat() {
  const {
    sessionId,
    setNewSession,
    isPermanentSession,
    setIsPermanentSession,
  } = useContext(ChatContext);
  const [[provider, modelId], setModelId] = useSelectedModel();
  const { scrollContainerRef, triggerAutoScroll } =
    useAutoScroll<HTMLDivElement>();

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

  const [isStreaming, setIsStreaming] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  const handleSubmit = useCallback(
    (data: { message: string }) => {
      if (!modelId || !provider || data.message.trim() === "" || isStreaming)
        return;
      form.reset();
      setIsStreaming(true);
      setAutoContinue(true);
      AiSdk.message(sessionId, isPermanentSession, provider!, modelId!, [
        { type: "text", text: data.message },
      ]).catch((e) => {
        toast.error(`${e.name ?? "Error"}: ${e.message}`);
        setIsStreaming(false);
        setAutoContinue(false);

        const sessionRef = JSON.parse(
          (isPermanentSession ? localStorage : sessionStorage).getItem(
            SESSION_STORAGE_KEY(sessionId)
          ) ?? "{}"
        ) as TemporarySession;
        const lastTurn = sessionRef.turns.at(-1);
        if (lastTurn?.type === "response" && lastTurn.message.length === 0) {
          form.setValue("message", data.message);
          sessionRef.turns.pop();
          sessionRef.turns.pop();

          (isPermanentSession ? localStorage : sessionStorage).setItem(
            SESSION_STORAGE_KEY(sessionId),
            JSON.stringify(sessionRef)
          );
        }
      });
    },
    [modelId, provider, isStreaming, form, sessionId, isPermanentSession]
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
    if (
      autoContinue &&
      usedTools.length > 0 &&
      usedTools.every((tool) => tool.done)
    ) {
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
        setIsStreaming(false);
        setAutoContinue(false);
        setSession((prev) => {
          const newSession = { ...prev };
          const lastTurn = newSession.turns.at(-1);
          if (lastTurn?.type === "response" && lastTurn.message.length === 0) {
            newSession.turns.pop(); // remove unfinished response
          }
          return newSession;
        });
      });
    }
  }, [session.turns, sessionId, isPermanentSession, provider, modelId]);

  const handlePause = useCallback(() => {
    AiSdk.abortCurrent();
    setIsStreaming(false);
    setSession((prev) => {
      const newSession = { ...prev } as typeof prev;
      newSession.turns = newSession.turns.map((turn) => {
        if (turn.type === "tool" && !turn.done) {
          return {
            ...turn,
            done: true,
            granted: false,
            isError: true,
            responseContent: "User rejected tool use",
          } as SessionTurnsTool;
        }
        return turn;
      });
      return newSession;
    });
  }, [setSession]);

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

  const handleCheckoutMessage = useCallback(
    (
      e: CustomEvent<{ sessionId: string; messageId: string; content: string }>
    ) => {
      const detail = e.detail;
      if (detail.sessionId !== sessionId) return;

      // Set textarea content to the selected message
      form.setValue("message", detail.content);

      // Remove turns AFTER the selected user message (keep the message itself)
      setSession((prev) => {
        const index = prev.turns.findIndex(
          (t) => t.type === "request" && t.messageId === detail.messageId
        );
        if (index === -1) return prev;
        const newSession = { ...prev } as typeof prev;
        newSession.turns = newSession.turns.slice(0, index);
        return newSession;
      });
    },
    [sessionId, form, setSession]
  );

  useEventListener(CHECKOUT_MESSAGE_EVENT, handleCheckoutMessage);

  const onToolGrant = useCallback(
    async (useId: string) => {
      const toolTurnIndex = session.turns.findIndex(
        (turn) => turn.type === "tool" && turn.useId === useId
      );
      if (toolTurnIndex === -1) return;
      const turn = session.turns[toolTurnIndex] as SessionTurnsTool;
      if (turn.done) return;

      // Only set to pending state if not already granted (for manual grants)
      if (!turn.granted) {
        setSession((prev) => {
          const newSession = { ...prev };
          newSession.turns[toolTurnIndex] = {
            ...turn,
            granted: true,
            done: false,
          };
          return newSession;
        });
      }

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

  // Update streaming state based on session turns
  useEffect(() => {
    if (!isStreaming) return;
    const hasPendingTool = session.turns.some(
      (t): t is SessionTurnsTool => t.type === "tool" && !t.done
    );
    const lastAssistant = [...session.turns]
      .reverse()
      .find((t): t is SessionTurnsResponse => t.type === "response");
    const assistantStillStreaming = lastAssistant ? !lastAssistant.stop : false;
    const assistantUsingTool = lastAssistant?.stop?.type === "tool_use";

    setIsStreaming(
      hasPendingTool || assistantStillStreaming || assistantUsingTool
    );
  }, [session.turns, isStreaming]);

  // Auto-execute tools that are granted but not done yet
  useEffect(() => {
    const toolTurns = session.turns.filter(
      (turn): turn is SessionTurnsTool => turn.type === "tool"
    );
    if (toolTurns.length === 0) return;

    const executeGrantedTools = async () => {
      for (const toolTurn of toolTurns) {
        // Execute tools that are granted but not done yet
        // This includes whitelisted tools (auto-granted) and manually granted tools
        if (!toolTurn.done && toolTurn.granted) {
          console.log("Executing granted tool:", toolTurn.toolName);
          // Small delay to ensure the UI has rendered
          setTimeout(() => {
            onToolGrant(toolTurn.useId);
          }, 100);
          break; // Execute one at a time to avoid race conditions
        }
      }
    };

    executeGrantedTools();
  }, [session.turns, onToolGrant]);

  // Trigger auto-scroll when session turns change (new messages)
  useEffect(() => {
    triggerAutoScroll();
  }, [session.turns.length, triggerAutoScroll]);

  const displaySession = useMemo<
    (SessionTurnsRequest | SessionTurnsResponse | SessionTurnsTool[])[]
  >(() => {
    const turns: (
      | SessionTurnsRequest
      | SessionTurnsResponse
      | SessionTurnsTool[]
    )[] = [];

    for (const turn of session.turns) {
      if (turn.type === "request") {
        const displayableMessages = turn.message.filter(
          (message) => message.type === "text" && message.text.trim().length > 0
        );
        if (displayableMessages.length === 0) continue;
        turns.push({
          ...turn,
          message: displayableMessages,
        });
      } else if (turn.type === "response") {
        const displayableMessages = turn.message.filter(
          (message) =>
            (message.type === "text" && message.text.trim().length > 0) ||
            (message.type === "thinking" && message.thinking.trim().length > 0)
        );
        turns.push({
          ...turn,
          message: displayableMessages,
        });
      } else if (turn.type === "tool") {
        if (Array.isArray(turns.at(-1)))
          (turns.at(-1) as SessionTurnsTool[]).push(turn);
        else turns.push([turn]);
      }
    }
    return turns;
  }, [session.turns]);

  return (
    <div className="w-full h-svhfull flex flex-row">
      <DesktopNav />
      <main className="h-svhfull grid grid-rows-[3fr_1fr] w-full max-w-4xl mx-auto">
        <ScrollArea className="h-full overflow-y-auto">
          <ScrollAreaViewport ref={scrollContainerRef}>
            <div className="h-full p-8 flex flex-col">
              {displaySession.map((message) => {
                if (Array.isArray(message)) {
                  return message.map((tool) => (
                    <ToolUseCard
                      key={`${sessionId}-${tool.useId}`}
                      message={tool}
                      onGrant={() => onToolGrant(tool.useId)}
                      onReject={() => onToolReject(tool.useId)}
                    />
                  ));
                } else if (message.type === "request") {
                  return (
                    <UserMessage
                      key={`${sessionId}-${message.messageId}`}
                      sessionId={sessionId}
                      messageId={message.messageId}
                      messages={message.message}
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
                }
              })}
            </div>
          </ScrollAreaViewport>
        </ScrollArea>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="relative p-4 h-full"
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
                {isStreaming ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" onClick={handlePause}>
                        <LucidePause className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pause</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
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
                )}
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
