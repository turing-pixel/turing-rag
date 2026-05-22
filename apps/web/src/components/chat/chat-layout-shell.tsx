"use client";

import { ChatHistoryProvider } from "@/components/chat/chat-history-context";
import { ChatHistorySidebar } from "@/components/chat/chat-history-sidebar";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatHistoryProvider>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <ChatHistorySidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </ChatHistoryProvider>
  );
}
