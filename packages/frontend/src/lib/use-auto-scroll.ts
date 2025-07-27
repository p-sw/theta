import { useEffect, useRef, useState } from "react";

/**
 * Custom hook that provides auto-scroll functionality for chat interfaces.
 * Automatically scrolls to bottom when new content is added, but only if user is near the bottom.
 */
export function useAutoScroll<T extends HTMLElement>() {
  const scrollContainerRef = useRef<T>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Threshold in pixels to determine if user is "near" the bottom
  const BOTTOM_THRESHOLD = 100;

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

  // Handle scroll events to track user position
  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);

    // Enable auto-scroll when user scrolls to bottom
    if (nearBottom && !shouldAutoScroll) {
      setShouldAutoScroll(true);
    }
    // Disable auto-scroll when user scrolls up
    else if (!nearBottom && shouldAutoScroll) {
      setShouldAutoScroll(false);
    }
  };

  // Auto-scroll effect that triggers when content changes
  const triggerAutoScroll = () => {
    if (shouldAutoScroll && isNearBottom) {
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
  }, [shouldAutoScroll]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottomInstant();
  }, []);

  return {
    scrollContainerRef,
    isNearBottom,
    shouldAutoScroll,
    scrollToBottom,
    scrollToBottomInstant,
    triggerAutoScroll,
  };
}
