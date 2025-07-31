import { Separator } from "@/components/ui/separator";
import type { IMessageRequest } from "@/sdk/shared";
import Markdown from "react-markdown";
import { CheckoutButton } from "./checkout-button";
import { useState } from "react";

export function UserMessage({
  sessionId,
  messageId,
  messages,
  onCheckout,
}: {
  sessionId: string;
  messageId: string;
  messages: IMessageRequest[];
  onCheckout?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const messageContent = messages
    .filter((message) => message.type === "text")
    .map((message) => message.text)
    .join("\n");

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout();
    }
  };

  return (
    <div 
      className="flex flex-col items-end gap-2 w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Separator className="relative mb-2">
        <div className="bg-background dark:bg-background rounded-md px-2 absolute right-4 inset-y-0 flex flex-row justify-end items-center gap-1">
          <span className="text-sm text-muted-foreground">User</span>
        </div>
      </Separator>
      <div className="flex flex-col items-end justify-start prose dark:prose-invert w-full max-w-full relative">
        {messages.map((message, index) => {
          if (message.type === "text") {
            return (
              <Markdown key={`${sessionId}-${messageId}-${index}`}>
                {message.text}
              </Markdown>
            );
          }
        })}
        {onCheckout && (
          <div className="absolute top-0 right-0 -translate-y-8">
            <CheckoutButton
              onCheckout={handleCheckout}
              isVisible={isHovered}
            />
          </div>
        )}
      </div>
    </div>
  );
}
