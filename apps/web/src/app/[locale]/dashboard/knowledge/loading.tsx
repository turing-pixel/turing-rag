import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { KnowledgeBaseGridSkeleton } from "@/components/skeletons/knowledge-base-grid-skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

export default function KnowledgeLoading() {
  return (
    <DashboardPageContainer className="space-y-6">
        <PageHeaderSkeleton />
        <KnowledgeBaseGridSkeleton />
    </DashboardPageContainer>
  );
}
