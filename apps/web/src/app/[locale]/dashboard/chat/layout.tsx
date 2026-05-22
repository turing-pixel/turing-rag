import { Suspense } from "react";
import { ChatLayoutShell } from "@/components/chat/chat-layout-shell";
import { ChatConversationSkeleton } from "@/components/skeletons/chat-conversation-skeleton";

export default function ChatSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full min-h-0 w-full overflow-hidden">
            <aside className="w-70 shrink-0 border-r border-border bg-muted/20" />
            <div className="min-h-0 min-w-0 flex-1">
              <ChatConversationSkeleton />
            </div>
          </div>
        }
      >
        <ChatLayoutShell>{children}</ChatLayoutShell>
      </Suspense>
    </div>
  );
}
