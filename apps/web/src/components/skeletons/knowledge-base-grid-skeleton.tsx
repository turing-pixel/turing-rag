import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KnowledgeBaseGridSkeletonProps {
  count?: number;
  className?: string;
}

export function KnowledgeBaseGridSkeleton({
  count = 8,
  className,
}: KnowledgeBaseGridSkeletonProps) {
  return (
    <div
      className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-4", className)}
      aria-busy
      aria-label="Loading knowledge bases"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} size="sm" className="flex h-full flex-col">
          <CardContent className="flex min-h-44 flex-1 flex-col items-start gap-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
          <CardFooter className="mt-auto flex w-full flex-col items-start gap-2 border-t">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
