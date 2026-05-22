import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { TestRetrievalPageSkeleton } from "@/components/skeletons/test-retrieval-page-skeleton";

export default function TestRetrievalLoading() {
  return (
    <DashboardPageContainer>
        <TestRetrievalPageSkeleton />
    </DashboardPageContainer>
  );
}
