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

interface TableRowsSkeletonProps {
  columns: number;
  rows?: number;
  className?: string;
  columnWidths?: string[];
}

export function TableRowsSkeleton({
  columns,
  rows = 5,
  className,
  columnWidths,
}: TableRowsSkeletonProps) {
  return (
    <div className={cn("rounded-md border", className)} aria-busy>
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <Skeleton
                  className={cn(
                    "h-4",
                    columnWidths?.[index] ?? "w-20"
                  )}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton
                    className={cn(
                      "h-4",
                      columnWidths?.[colIndex] ?? "w-full max-w-32"
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
