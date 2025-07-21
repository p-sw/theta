import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { IMessageResult, SessionTurnsResponse } from "@/sdk/shared";
import LucidAlertCircle from "~icons/lucide/alert-circle";
import LucidInfo from "~icons/lucide/info";

export function AssistantMessage({
  sessionId,
  messageId,
  messages,
  stop,
}: {
  sessionId: string;
  messageId: string;
  messages: IMessageResult[];
  stop: SessionTurnsResponse["stop"];
}) {
  return (
    <div className="flex flex-col items-start gap-2 w-full">
      <div className="flex flex-row justify-end items-center gap-1">
        <span className="text-sm text-muted-foreground">Assistant</span>
      </div>
      <div className="flex flex-col items-center justify-start">
        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <span key={`${sessionId}-${messageId}-${index}`}>
                {message.text}
              </span>
            );
          }
        })}
        <StopIndicator stop={stop} />
      </div>
    </div>
  );
}

function StopIndicator({ stop }: { stop: SessionTurnsResponse["stop"] }) {
  if (!stop) return null;

  switch (stop.level) {
    case "error":
      return (
        <Alert variant="destructive">
          <LucidAlertCircle className="w-4 h-4" />
          <AlertTitle>Error while generating response</AlertTitle>
          <AlertDescription>{stop.reason}</AlertDescription>
        </Alert>
      );
    case "info":
      return (
        <Alert variant="default">
          <LucidInfo className="w-4 h-4" />
          <AlertTitle>{stop.reason}</AlertTitle>
        </Alert>
      );
    case "subtext":
      return (
        <span className="text-sm text-muted-foreground">{stop.reason}</span>
      );
    case "none":
      return null;
    default:
      return null;
  }
}
