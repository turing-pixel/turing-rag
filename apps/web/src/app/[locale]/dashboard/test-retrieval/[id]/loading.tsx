import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { TestRetrievalPageSkeleton } from "@/components/skeletons/test-retrieval-page-skeleton";

export default function TestRetrievalLoading() {
  return (
    <DashboardLayout>
      <DashboardPageContainer>
        <TestRetrievalPageSkeleton />
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
