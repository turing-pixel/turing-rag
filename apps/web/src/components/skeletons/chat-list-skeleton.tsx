import { Item, ItemContent } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatListSkeletonProps {
  count?: number;
  className?: string;
}

export function ChatListSkeleton({
  count = 4,
  className,
}: ChatListSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy>
      {Array.from({ length: count }).map((_, index) => (
        <Item key={index} variant="outline" size="sm">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <ItemContent className="gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
