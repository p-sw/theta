import { useEffect, useRef } from "react";

const BOTTOM_THRESHOLD = 30;

/**
 * Custom hook that provides auto-scroll functionality for chat interfaces.
 * Automatically scrolls to bottom when new content is added, but only if user is near the bottom.
 */
export function useAutoScroll<T extends HTMLElement>() {
  const scrollContainerRef = useRef<T>(null);
  const isNearBottom = useRef(true);

  // Check if user is near the bottom of the scroll container
  const checkIfNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= BOTTOM_THRESHOLD;
  };

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  };

  // Force scroll to bottom without smooth behavior
  const scrollToBottomInstant = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  };

  const handleScroll = () => {
    isNearBottom.current = checkIfNearBottom();
  };

  // Auto-scroll effect that triggers when content changes
  const triggerAutoScroll = () => {
    if (isNearBottom.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  };

  // Set up scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottomInstant();
  }, []);

  return {
    scrollContainerRef,
    isNearBottom: isNearBottom.current,
    scrollToBottom,
    scrollToBottomInstant,
    triggerAutoScroll,
  };
}
