import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { DashboardHomeSkeleton } from "@/components/skeletons/dashboard-home-skeleton";

export default function DashboardLoading() {
  return (
    <DashboardPageContainer>
        <DashboardHomeSkeleton />
    </DashboardPageContainer>
  );
}
