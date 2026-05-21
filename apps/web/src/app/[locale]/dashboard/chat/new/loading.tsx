import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { NewChatPageSkeleton } from "@/components/skeletons/new-chat-page-skeleton";

export default function NewChatLoading() {
  return (
    <DashboardLayout>
      <DashboardPageContainer>
        <NewChatPageSkeleton />
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
