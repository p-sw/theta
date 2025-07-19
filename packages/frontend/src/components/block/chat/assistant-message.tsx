import type { IMessageResult } from "@/sdk/shared";

export function AssistantMessage({
  sessionId,
  messageId,
  messages,
}: {
  sessionId: string;
  messageId: string;
  messages: IMessageResult[];
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
      </div>
    </div>
  );
}
