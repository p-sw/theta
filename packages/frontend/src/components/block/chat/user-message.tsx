import { Separator } from "@/components/ui/separator";
import type { IMessageRequest } from "@/sdk/shared";
import Markdown from "react-markdown";
import { dispatchEvent } from "@/lib/utils";
import { CHECKOUT_MESSAGE_EVENT } from "@/lib/const";

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
      {/* message content with checkout button */}
      <div
        className="group relative flex flex-col items-end justify-start prose dark:prose-invert w-full max-w-full"
      >
        {/* Checkout button */}
        <button
          type="button"
          onClick={() => {
            const content = messages
              .filter((msg) => msg.type === "text")
              .map((msg) => (msg as { type: "text"; text: string }).text)
              .join("\n\n");
            dispatchEvent(CHECKOUT_MESSAGE_EVENT, {
              detail: {
                sessionId,
                messageId,
                content,
              },
            });
          }}
          className="absolute -top-2 -right-2 text-xs underline text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          Checkout
        </button>

        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <Markdown key={`${sessionId}-${messageId}-${index}`}>
                {message.text}
              </Markdown>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
