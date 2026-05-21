import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TestRetrievalPageSkeletonProps {
  className?: string;
}

export function TestRetrievalPageSkeleton({
  className,
}: TestRetrievalPageSkeletonProps) {
  return (
    <div className={cn("space-y-8", className)} aria-busy>
      <header className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      <section className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </section>
    </div>
  );
}
