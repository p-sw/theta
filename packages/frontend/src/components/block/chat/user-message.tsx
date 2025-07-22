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
      <div className="flex flex-row justify-end items-center gap-1">
        <span className="text-sm text-muted-foreground">User</span>
      </div>
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
