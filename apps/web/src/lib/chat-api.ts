import { api } from "@/lib/api";

export type MessageFeedback = "like" | "dislike" | null;

export interface ApiMessage {
  id: number;
  content: string;
  role: "assistant" | "user";
  feedback?: string | null;
  created_at: string;
  updated_at: string;
}

export async function patchChatMessage(
  chatId: string,
  messageId: number,
  body: { content?: string; feedback?: MessageFeedback }
): Promise<ApiMessage> {
  return api.patch(`/api/chat/${chatId}/messages/${messageId}`, body) as Promise<
    ApiMessage
  >;
}
