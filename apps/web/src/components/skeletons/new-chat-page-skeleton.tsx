import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface NewChatPageSkeletonProps {
  className?: string;
}

export function NewChatPageSkeleton({ className }: NewChatPageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} aria-busy>
      <header className="flex items-start gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}
