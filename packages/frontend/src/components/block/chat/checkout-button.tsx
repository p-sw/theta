import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LucideUndo2 from "~icons/lucide/undo-2";

interface CheckoutButtonProps {
  onCheckout: () => void;
  isVisible: boolean;
  className?: string;
}

export function CheckoutButton({ onCheckout, isVisible, className }: CheckoutButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onCheckout}
      className={cn(
        "transition-opacity duration-200 text-xs underline decoration-1 underline-offset-2 hover:decoration-2 text-muted-foreground hover:text-foreground",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100", // Always visible on mobile, hidden on desktop until hover
        isVisible && "md:opacity-100", // Show when explicitly visible
        className
      )}
      aria-label="Checkout this message"
    >
      <LucideUndo2 className="size-3 mr-1" />
      Checkout
    </Button>
  );
}