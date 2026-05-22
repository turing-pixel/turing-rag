import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableRowsSkeleton } from "@/components/skeletons/table-rows-skeleton";

export default function LlmConfigsLoading() {
  return (
    <DashboardPageContainer>
            <PageHeaderSkeleton className="mb-8" showAction />
            <TableRowsSkeleton
              columns={3}
              rows={4}
              columnWidths={["w-32", "w-20", "w-8"]}
            />
          </DashboardPageContainer>
  );
}
