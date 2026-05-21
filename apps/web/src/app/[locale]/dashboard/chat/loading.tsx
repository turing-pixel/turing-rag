import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { ChatListSkeleton } from "@/components/skeletons/chat-list-skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

export default function ChatListLoading() {
  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-6">
        <PageHeaderSkeleton />
        <ChatListSkeleton />
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
