"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileIcon, defaultStyles } from "react-file-icon";
import {
  ArrowRight,
  Plus,
  Settings,
  Trash2,
  Search,
  Pencil,
  MessageSquare,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  documents: Document[];
  created_at: string;
}
interface Document {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  knowledge_base_id: number;
  created_at: string;
  updated_at: string;
  processing_tasks: any[];
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [startingChatKbId, setStartingChatKbId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const data = await api.get("/api/knowledge-base");
      setKnowledgeBases(data);
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (kb: KnowledgeBase) => {
    setEditingKb(kb);
    setEditName(kb.name);
    setEditDescription(kb.description || "");
  };

  const closeEditDialog = (force = false) => {
    if (isSaving && !force) return;
    setEditingKb(null);
    setEditName("");
    setEditDescription("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKb) return;

    const name = editName.trim();
    if (!name) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.put(`/api/knowledge-base/${editingKb.id}`, {
        name,
        description: editDescription.trim() || null,
      });
      setKnowledgeBases((prev) =>
        prev.map((kb) =>
          kb.id === editingKb.id
            ? { ...kb, name: updated.name, description: updated.description }
            : kb
        )
      );
      toast({
        title: "Success",
        description: "Knowledge base updated successfully",
      });
      closeEditDialog(true);
    } catch (error) {
      console.error("Failed to update knowledge base:", error);
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickChat = async (kb: KnowledgeBase) => {
    setStartingChatKbId(kb.id);
    try {
      const data = await api.post("/api/chat", {
        title: `Chat - ${kb.name}`,
        knowledge_base_ids: [kb.id],
      });
      router.push(`/dashboard/chat/${data.id}`);
    } catch (error) {
      console.error("Failed to start chat:", error);
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to start chat",
          variant: "destructive",
        });
      }
    } finally {
      setStartingChatKbId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this knowledge base?"))
      return;
    try {
      await api.delete(`/api/knowledge-base/${id}`);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      toast({
        title: "Success",
        description: "Knowledge base deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete knowledge base:", error);
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Knowledge Bases
            </h2>
            <p className="text-muted-foreground">
              Manage your knowledge bases and documents
            </p>
          </div>
          <Link
            href="/dashboard/knowledge/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Knowledge Base
          </Link>
        </div>

        <div className="grid gap-6">
          {knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className="rounded-lg border bg-card p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{kb.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {kb.description || "No description"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {kb.documents.length} documents •{" "}
                    {new Date(kb.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleQuickChat(kb)}
                    disabled={startingChatKbId === kb.id}
                    className="inline-flex items-center justify-center rounded-md bg-primary w-8 h-8 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    title="Start chat with this knowledge base"
                  >
                    {startingChatKbId === kb.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDialog(kb)}
                    className="inline-flex items-center justify-center rounded-md bg-secondary w-8 h-8 hover:bg-secondary/80"
                    title="Edit knowledge base"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/dashboard/knowledge/${kb.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-secondary w-8 h-8"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/dashboard/test-retrieval/${kb.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-secondary w-8 h-8"
                  >
                    <Search className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(kb.id)}
                    className="inline-flex items-center justify-center rounded-md bg-destructive/10 hover:bg-destructive/20 w-8 h-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>

              {kb.documents.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Documents</h4>
                  <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto">
                    {kb.documents.slice(0, 9).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors w-[150px] h-[150px] justify-center"
                      >
                        <div className="w-8 h-8 mb-2">
                          {doc.content_type.toLowerCase().includes("pdf") ? (
                            <FileIcon extension="pdf" {...defaultStyles.pdf} />
                          ) : doc.content_type.toLowerCase().includes("doc") ? (
                            <FileIcon extension="doc" {...defaultStyles.docx} />
                          ) : doc.content_type.toLowerCase().includes("txt") ? (
                            <FileIcon extension="txt" {...defaultStyles.txt} />
                          ) : doc.content_type.toLowerCase().includes("md") ? (
                            <FileIcon extension="md" {...defaultStyles.md} />
                          ) : (
                            <FileIcon
                              extension={doc.file_name.split(".").pop() || ""}
                              color="#E2E8F0"
                              labelColor="#94A3B8"
                            />
                          )}
                        </div>
                        <div className="text-sm font-medium text-center max-w-[100px]">
                          <div className="line-clamp-2 overflow-hidden text-ellipsis">
                            {doc.file_name}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {kb.documents.length > 9 && (
                      <Link
                        href={`/dashboard/knowledge/${kb.id}`}
                        className="flex flex-col items-center p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors w-[150px] h-[150px] justify-center"
                      >
                        <div className="w-8 h-8 mb-2 flex items-center justify-center">
                          <ArrowRight className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-center">
                          View All Documents
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {kb.documents.length} total
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && knowledgeBases.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No knowledge bases found. Create one to get started.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="space-y-4">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                <p className="text-muted-foreground animate-pulse">
                  Loading knowledge bases...
                </p>
              </div>
            </div>
          )}
        </div>

        <Dialog
          open={editingKb !== null}
          onOpenChange={(open) => !open && closeEditDialog()}
        >
          <DialogContent>
            <form onSubmit={handleSaveEdit}>
              <DialogHeader>
                <DialogTitle>Edit Knowledge Base</DialogTitle>
                <DialogDescription>
                  Update the name and description of this knowledge base.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="edit-name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Knowledge base name"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="edit-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => closeEditDialog()}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent h-10 px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
