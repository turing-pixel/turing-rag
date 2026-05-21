import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function RagPipelineLoading() {
  return (
    <DashboardLayout>
      <DashboardPageContainer className="max-w-none space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-full max-w-3xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[min(78vh,820px)] min-h-[640px] w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
