import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { DashboardHomeSkeleton } from "@/components/skeletons/dashboard-home-skeleton";

export default function DashboardLoading() {
  return (
    <DashboardLayout>
      <DashboardPageContainer>
        <DashboardHomeSkeleton />
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
