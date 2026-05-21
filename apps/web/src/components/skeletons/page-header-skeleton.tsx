import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageHeaderSkeletonProps {
  className?: string;
  showAction?: boolean;
  showSubtitle?: boolean;
}

export function PageHeaderSkeleton({
  className,
  showAction = true,
  showSubtitle = true,
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        {showSubtitle ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
      </div>
      {showAction ? (
        <Skeleton className="h-9 w-full shrink-0 sm:w-36" />
      ) : null}
    </div>
  );
}
