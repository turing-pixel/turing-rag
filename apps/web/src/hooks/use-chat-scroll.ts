"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseChatScrollOptions {
  /** Distance from bottom (px) still treated as "at bottom". */
  threshold?: number;
  /** Min interval between follow-scroll updates while streaming. */
  throttleMs?: number;
  /** Debounce delay for scroll-position reads (user scroll-up detection). */
  scrollDebounceMs?: number;
}

export function useChatScroll({
  threshold = 80,
  throttleMs = 100,
  scrollDebounceMs = 150,
}: UseChatScrollOptions = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const skipNextFollowRef = useRef(false);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttleTrailingRef = useRef(false);
  const throttleLastRunRef = useRef(0);
  const scrollDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const rafRef = useRef<number | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const runFollowScroll = useCallback(
    (behavior: ScrollBehavior) => {
      if (!pinnedToBottomRef.current) return;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        scrollToBottom(behavior);
      });
    },
    [scrollToBottom]
  );

  const scheduleFollowScroll = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      if (!pinnedToBottomRef.current) return;

      const now = Date.now();
      const elapsed = now - throttleLastRunRef.current;

      if (elapsed >= throttleMs) {
        throttleLastRunRef.current = now;
        throttleTrailingRef.current = false;
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        runFollowScroll(behavior);
        return;
      }

      throttleTrailingRef.current = true;
      if (throttleTimerRef.current) return;

      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        if (throttleTrailingRef.current) {
          throttleLastRunRef.current = Date.now();
          throttleTrailingRef.current = false;
          runFollowScroll(behavior);
        }
      }, throttleMs - elapsed);
    },
    [runFollowScroll, throttleMs]
  );

  const pinAndScrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      pinnedToBottomRef.current = true;
      runFollowScroll(behavior);
    },
    [runFollowScroll]
  );

  const markSkipNextFollow = useCallback(() => {
    skipNextFollowRef.current = true;
  }, []);

  const followContent = useCallback(
    (options?: { force?: boolean; streaming?: boolean }) => {
      if (skipNextFollowRef.current) {
        skipNextFollowRef.current = false;
        pinAndScrollToBottom("auto");
        return;
      }

      if (options?.force) {
        pinAndScrollToBottom(options.streaming ? "auto" : "smooth");
        return;
      }

      if (!pinnedToBottomRef.current) return;

      scheduleFollowScroll(options?.streaming ? "auto" : "smooth");
    },
    [pinAndScrollToBottom, scheduleFollowScroll]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
      scrollDebounceTimerRef.current = setTimeout(() => {
        scrollDebounceTimerRef.current = null;
        pinnedToBottomRef.current = isNearBottom();
      }, scrollDebounceMs);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
    };
  }, [isNearBottom, scrollDebounceMs]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) {
        scheduleFollowScroll("auto");
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [scheduleFollowScroll]);

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    scrollRef,
    contentRef,
    followContent,
    pinAndScrollToBottom,
    markSkipNextFollow,
    isNearBottom,
  };
}
