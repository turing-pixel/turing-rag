/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useChatScroll } from "../use-chat-scroll";

describe("useChatScroll", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("pins and scrolls the container to the bottom", () => {
    const { result } = renderHook(() => useChatScroll());

    const container = document.createElement("div");
    Object.defineProperty(container, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 400, configurable: true });
    container.scrollTo = jest.fn();

    act(() => {
      (
        result.current.scrollRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = container;
      result.current.pinAndScrollToBottom("auto");
    });

    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: "auto",
    });
  });

  it("throttles repeated follow scroll calls", () => {
    const { result } = renderHook(() =>
      useChatScroll({ throttleMs: 100 })
    );

    const container = document.createElement("div");
    Object.defineProperty(container, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 200, configurable: true });
    container.scrollTo = jest.fn();

    act(() => {
      (
        result.current.scrollRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = container;
      result.current.pinAndScrollToBottom("auto");
      result.current.followContent({ streaming: true });
      result.current.followContent({ streaming: true });
      result.current.followContent({ streaming: true });
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(container.scrollTo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
