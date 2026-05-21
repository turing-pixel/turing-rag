import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatConversationSkeletonProps {
  className?: string;
}

export function ChatConversationSkeleton({
  className,
}: ChatConversationSkeletonProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", className)} aria-busy>
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 sm:px-6 lg:px-8">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <div className="flex justify-end">
            <Skeleton className="h-16 w-[min(100%,18rem)] rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-[min(100%,14rem)] rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </div>
      </div>

      <footer className="shrink-0 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="mx-auto hidden h-3 w-48 sm:block" />
        </div>
      </footer>
    </div>
  );
}
