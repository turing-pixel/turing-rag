import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DocumentListSkeletonProps {
  rows?: number;
  className?: string;
}

export function DocumentListSkeleton({
  rows = 6,
  className,
}: DocumentListSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} aria-busy>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full flex-1" />
        <Skeleton className="h-9 w-20 shrink-0 self-end sm:self-auto" />
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-0">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-24">
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead className="w-36">
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead className="w-28">
              <Skeleton className="h-4 w-12" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="flex items-start gap-3">
                  <Skeleton className="size-8 shrink-0 rounded" />
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-14" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
