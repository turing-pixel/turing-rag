import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { TableRowsSkeleton } from "@/components/skeletons/table-rows-skeleton";

export default function ApiKeysLoading() {
  return (
    <DashboardPageContainer>
        <PageHeaderSkeleton className="mb-8" />
        <TableRowsSkeleton
          columns={6}
          rows={5}
          columnWidths={["w-24", "w-40", "w-16", "w-20", "w-20", "w-16"]}
        />
    </DashboardPageContainer>
  );
}
