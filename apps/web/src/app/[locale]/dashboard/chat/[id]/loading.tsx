import DashboardLayout from "@/components/layout/dashboard-layout";
import { ChatConversationSkeleton } from "@/components/skeletons/chat-conversation-skeleton";

export default function ChatDetailLoading() {
  return (
    <DashboardLayout>
      <ChatConversationSkeleton />
    </DashboardLayout>
  );
}
