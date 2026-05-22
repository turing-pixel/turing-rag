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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full flex-1" />
        <Skeleton className="h-9 w-20 shrink-0 self-end sm:self-auto" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
              <TableHead className="h-11 px-4">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="h-11 w-28 px-4">
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="h-11 w-40 px-4">
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead className="h-11 w-32 px-4">
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="h-11 w-14 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, index) => (
              <TableRow key={index}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-full max-w-xs" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="px-2 py-3 text-right">
                  <Skeleton className="ml-auto size-8 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
