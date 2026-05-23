import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  chatConversationContentClass,
  chatConversationFooterClass,
  chatMessageViewportClass,
} from "@/lib/chat-conversation-layout";
import { cn } from "@/lib/utils";

interface ChatConversationSkeletonProps {
  className?: string;
}

export function ChatConversationSkeleton({
  className,
}: ChatConversationSkeletonProps) {
  return (
    <>
      <ScrollArea
        className={cn("min-h-0 flex-1", className)}
        viewportClassName={chatMessageViewportClass}
        aria-busy
      >
        <div className={chatConversationContentClass}>
          <div className="flex justify-end">
            <Skeleton className="h-16 w-[min(100%,18rem)] rounded-2xl" />
          </div>
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-[min(100%,14rem)] rounded-2xl" />
          </div>
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </ScrollArea>

      <footer className={chatConversationFooterClass}>
        <div className="mx-auto w-full max-w-5xl space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="mx-auto hidden h-3 w-48 sm:block" />
        </div>
      </footer>
    </>
  );
}
