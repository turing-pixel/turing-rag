import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { DocumentListSkeleton } from "@/components/skeletons/document-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function KnowledgeDetailLoading() {
  return (
    <DashboardPageContainer className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </header>
        <DocumentListSkeleton />
    </DashboardPageContainer>
  );
}
