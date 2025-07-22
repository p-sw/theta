import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { IMessageResult, SessionTurnsResponseStop } from "@/sdk/shared";
import LucidAlertCircle from "~icons/lucide/alert-circle";
import LucidInfo from "~icons/lucide/info";
import Markdown from "react-markdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function AssistantMessage({
  sessionId,
  messageId,
  messages,
  stop,
}: {
  sessionId: string;
  messageId: string;
  messages: IMessageResult[];
  stop?: SessionTurnsResponseStop;
}) {
  return (
    <div className="flex flex-col items-start gap-2 w-full">
      <div className="flex flex-row justify-end items-center gap-1">
        <span className="text-sm text-muted-foreground">Assistant</span>
      </div>
      <div className="flex flex-col items-start justify-start gap-4 w-full">
        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <div className="prose dark:prose-invert w-full">
                <Markdown key={`${sessionId}-${messageId}-${index}`}>
                  {message.text}
                </Markdown>
              </div>
            );
          }
          if (message.type === "thinking") {
            return (
              <Accordion type="single" collapsible>
                <AccordionItem value="thinking">
                  <AccordionTrigger>Thinking</AccordionTrigger>
                  <AccordionContent>{message.thinking}</AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          }
        })}
        <StopIndicator stop={stop} />
      </div>
    </div>
  );
}

function StopIndicator({ stop }: { stop?: SessionTurnsResponseStop }) {
  if (!stop) return null;
  if (stop.type === "log") return;

  if (stop.type === "message") {
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
      default:
        return null;
    }
  }
  return null; // fallback for unknown stop type
}
