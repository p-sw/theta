import type { IMessageRequest } from "@/sdk/shared";
import Markdown from "react-markdown";
import { dispatchEvent } from "@/lib/utils";
import { CHECKOUT_MESSAGE_EVENT } from "@/lib/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <div
      className="group flex flex-col items-end gap-2 w-full pb-8"
      data-message-role="user"
    >
      <Separator className="relative mb-4">
        <div className="bg-background dark:bg-background rounded-md px-2 absolute right-4 inset-y-0 flex flex-row justify-end items-center gap-1">
          <span className="text-sm text-muted-foreground">User</span>
        </div>
      </Separator>
      {/* message content with checkout button */}
      <div className="flex flex-col items-end w-full">
        <Card className="w-full max-w-md gap-4">
          <CardContent>
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
          </CardContent>
        </Card>
        <Button
          variant="link"
          size="sm"
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
          className="self-end text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}
