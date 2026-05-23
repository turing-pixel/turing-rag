import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

export default function AccountLoading() {
  return (
    <DashboardPageContainer>
      <PageHeaderSkeleton className="mb-8" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-80 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    </DashboardPageContainer>
  );
}
