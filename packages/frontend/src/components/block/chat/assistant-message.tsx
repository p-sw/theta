import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  IMessageResult,
  IMessageResultToolUse,
  SessionTurnsResponseStop,
} from "@/sdk/shared";
import LucidAlertCircle from "~icons/lucide/alert-circle";
import LucidInfo from "~icons/lucide/info";
import Markdown from "react-markdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import rehypeHighlight from "@/markdown-plugin/rehype-highlight";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LucideMaximize2 from "~icons/lucide/maximize-2";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import { Button } from "@/components/ui/button";
import { useToolInformation } from "@/lib/tools";

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
      <Separator className="relative mb-2">
        <div className="bg-background dark:bg-background rounded-md px-2 absolute left-4 inset-y-0 flex flex-row justify-end items-center gap-1">
          <span className="text-sm text-muted-foreground">Assistant</span>
        </div>
      </Separator>
      <div className="flex flex-col items-start justify-start gap-4 w-full">
        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <div
                key={`${sessionId}-${messageId}-${index}`}
                className="prose dark:prose-invert w-full prose-neutral max-w-full"
              >
                <Markdown rehypePlugins={[rehypeHighlight]}>
                  {message.text}
                </Markdown>
              </div>
            );
          }
          if (message.type === "thinking") {
            return (
              <Accordion
                key={`${sessionId}-${messageId}-${index}`}
                type="single"
                collapsible
                className="w-full"
              >
                <AccordionItem value="thinking" className="w-full">
                  <AccordionTrigger className="pt-0 pb-2 max-w-fit">
                    Thinking
                  </AccordionTrigger>
                  <AccordionContent className="border-l-2 border-muted-foreground/20 pl-4 prose dark:prose-invert prose-sm opacity-60 max-w-full py-2">
                    <Markdown>
                      {/* intentionally not highlighted */}
                      {message.thinking}
                    </Markdown>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          }
          if (message.type === "tool_use") {
            return <ToolUseCard message={message} />;
          }
        })}
        <StopIndicator stop={stop} />
      </div>
    </div>
  );
}

function ToolUseCard({ message }: { message: IMessageResultToolUse }) {
  const { provider, tool } = useToolInformation(message.name);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <LucideLoaderCircle className="w-4 h-4 animate-spin inline-block mr-2" />
          {tool?.displayName ?? "Unknown tool"}
        </CardTitle>
        <CardDescription>
          {provider?.displayName ?? "Unknown provider"}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon">
            <LucideMaximize2 className="w-4 h-4" />
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
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
