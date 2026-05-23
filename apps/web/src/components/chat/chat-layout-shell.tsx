"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatHistoryProvider } from "@/components/chat/chat-history-context";
import { ChatHistorySidebar } from "@/components/chat/chat-history-sidebar";

const SIDEBAR_STORAGE_KEY = "chat-history-sidebar-open";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "true") {
        setSidebarOpen(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    } catch {
      // ignore storage errors
    }
  }, []);

  return (
    <ChatHistoryProvider>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <ChatHistorySidebar
          open={sidebarOpen}
          onOpenChange={handleSidebarOpenChange}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </ChatHistoryProvider>
  );
}
