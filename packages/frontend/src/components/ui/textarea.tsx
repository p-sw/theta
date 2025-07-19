import * as React from "react";

import { cn } from "@/lib/utils";

const TextareaContainerContext = React.createContext<{
  isInsideContainer: boolean;
  setFocused: (focused: boolean) => void;
  setInvalid: (invalid: boolean) => void;
}>({
  isInsideContainer: false,
  setFocused: () => {},
  setInvalid: () => {},
});

interface TextareaContainerProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

function TextareaContainer({
  className,
  children,
  ...props
}: TextareaContainerProps) {
  const [isFocused, setFocused] = React.useState(false);
  const [isInvalid, setInvalid] = React.useState(false);

  return (
    <TextareaContainerContext
      value={{
        isInsideContainer: true,
        setFocused,
        setInvalid,
      }}
    >
      <div
        data-slot="textarea-container"
        className={cn(
          "border-input placeholder:text-muted-foreground dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isFocused && "border-ring ring-ring/50 ring-[3px]",
          isInvalid &&
            "ring-destructive/20 dark:ring-destructive/40 border-destructive",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TextareaContainerContext>
  );
}

export { TextareaContainer };

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const containerContext = React.use(TextareaContainerContext);

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        containerContext.isInsideContainer &&
          "w-full h-full bg-transparent border-none outline-none resize-none p-0 m-0 shadow-none focus-visible:border-none focus-visible:ring-0 aria-invalid:ring-0 dark:aria-invalid:ring-0 aria-invalid:border-none dark:bg-transparent",
        className
      )}
      {...props}
      onFocus={(e) => {
        containerContext.setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        containerContext.setFocused(false);
        props.onBlur?.(e);
      }}
      onInvalid={(e) => {
        containerContext.setInvalid(true);
        props.onInvalid?.(e);
      }}
      onInput={(e) => {
        containerContext.setInvalid(false);
        props.onInput?.(e);
      }}
    />
  );
}

export { Textarea };
