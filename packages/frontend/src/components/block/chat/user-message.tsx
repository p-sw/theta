import { Separator } from "@/components/ui/separator";
import type { IMessageRequest } from "@/sdk/shared";
import Markdown from "react-markdown";

export function UserMessage({
  sessionId,
  messageId,
  messages,
}: {
  sessionId: string;
  messageId: string;
  messages: IMessageRequest[];
}) {
  return (
    <div className="flex flex-col items-end gap-2 w-full">
      <Separator className="relative mb-2">
        <div className="bg-background dark:bg-background rounded-md px-2 absolute right-4 inset-y-0 flex flex-row justify-end items-center gap-1">
          <span className="text-sm text-muted-foreground">User</span>
        </div>
      </Separator>
      <div className="flex flex-col items-end justify-start prose dark:prose-invert w-full">
        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <Markdown key={`${sessionId}-${messageId}-${index}`}>
                {message.text}
              </Markdown>
            );
          }
        })}
      </div>
    </div>
  );
}
