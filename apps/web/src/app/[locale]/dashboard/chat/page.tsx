"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { chatConversationPath } from "@/lib/chat-paths";
import { loadWorkspaceChat } from "@/lib/chat-session";
import { ChatConversationSkeleton } from "@/components/skeletons/chat-conversation-skeleton";

function ChatIndexRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const workspace = await loadWorkspaceChat();
        if (cancelled) return;
        router.replace(chatConversationPath(workspace.uuid, searchParams));
      } catch {
        if (!cancelled) {
          router.replace("/dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <ChatConversationSkeleton />;
}

export default function ChatIndexPage() {
  return (
    <Suspense fallback={<ChatConversationSkeleton />}>
      <ChatIndexRedirect />
    </Suspense>
  );
}
