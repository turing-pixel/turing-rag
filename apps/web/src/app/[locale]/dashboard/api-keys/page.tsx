"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Copy, Check, List, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { TableRowsSkeleton } from "@/components/skeletons/table-rows-skeleton";

export interface APIKey {
  id: number;
  name: string;
  key: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface APIKeyCreate {
  name: string;
  is_active?: boolean;
}

export interface APIKeyUpdate {
  name?: string;
  is_active?: boolean;
}

export default function APIKeysPage() {
  const tToast = useTranslations("toasts");
  const t = useTranslations("apiKeysPage");
  const locale = useLocale();
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAPIListDialogOpen, setIsAPIListDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchAPIKeys = async () => {
    try {
      const data = await api.get("/api/api-keys");
      setApiKeys(data);
    } catch {
      toast.error(tToast("apiKeysLoadError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const createAPIKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(tToast("apiKeyNameRequired"));
      return;
    }

    setIsCreating(true);
    try {
      const data = await api.post("/api/api-keys", {
        name: newKeyName,
        is_active: true,
      });

      setApiKeys([...apiKeys, data]);
      setNewKeyName("");
      setIsDialogOpen(false);
      toast.success(tToast("apiKeyCreateSuccess"));
    } catch {
      toast.error(tToast("apiKeyCreateError"));
    } finally {
      setIsCreating(false);
    }
  };

  const deleteAPIKey = async (id: number) => {
    try {
      await api.delete(`/api/api-keys/${id}`);

      setApiKeys(apiKeys.filter((key) => key.id !== id));
      toast.success(tToast("apiKeyDeleteSuccess"));
    } catch {
      toast.error(tToast("apiKeyDeleteError"));
    }
  };

  const toggleAPIKeyStatus = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/api/api-keys/${id}`, {
        is_active: !currentStatus,
      });

      setApiKeys(
        apiKeys.map((key) =>
          key.id === id ? { ...key, is_active: !currentStatus } : key
        )
      );

      toast.success(tToast("apiKeyUpdateSuccess"));
    } catch {
      toast.error(tToast("apiKeyUpdateError"));
    }
  };

  const copyAPIKey = async (id: number, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 3000);
      toast.success(tToast("copySuccess"));
    } catch {
      toast.error(tToast("copyError"));
    }
  };

  return (
    <DashboardPageContainer>
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={isAPIListDialogOpen}
              onOpenChange={setIsAPIListDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <List className="h-4 w-4" />
                  {t("apiList")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("apiListTitle")}</DialogTitle>
                  <DialogDescription>{t("apiListDescription")}</DialogDescription>
                </DialogHeader>
                <section
                  aria-label={t("kbQueryTitle")}
                  className="mt-4 overflow-hidden rounded-lg border bg-muted/40"
                >
                  <h3 className="border-b px-4 py-3 text-sm font-semibold">
                    {t("kbQueryTitle")}
                  </h3>
                  <dl className="divide-y">
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr] sm:items-baseline sm:gap-x-4">
                      <dt className="text-sm text-muted-foreground">
                        {t("method")}
                      </dt>
                      <dd className="min-w-0">
                        <code className="block rounded-md border bg-background px-3 py-2 font-mono text-sm text-primary">
                          GET
                        </code>
                      </dd>
                    </div>
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr] sm:items-baseline sm:gap-x-4">
                      <dt className="text-sm text-muted-foreground">
                        {t("endpoint")}
                      </dt>
                      <dd className="min-w-0">
                        <code className="block break-all rounded-md border bg-background px-3 py-2 font-mono text-sm">
                          /openapi/knowledge/{"{id}"}/query
                        </code>
                      </dd>
                    </div>
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr] sm:items-start sm:gap-x-4">
                      <dt className="text-sm text-muted-foreground">
                        {t("queryParams")}
                      </dt>
                      <dd className="space-y-2 text-sm">
                        <p>
                          <code className="mr-2 text-primary">query</code>
                          {t("paramQuery")}
                        </p>
                        <p>
                          <code className="mr-2 text-primary">top_k</code>
                          {t("paramTopK")}
                        </p>
                      </dd>
                    </div>
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr] sm:items-baseline sm:gap-x-4">
                      <dt className="text-sm text-muted-foreground">
                        {t("headers")}
                      </dt>
                      <dd className="text-sm">
                        <code className="mr-2 text-primary">X-API-Key</code>
                        {t("headerKeyValue")}
                      </dd>
                    </div>
                  </dl>
                </section>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("createKey")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createTitle")}</DialogTitle>
                  <DialogDescription>{t("createDescription")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t("nameLabel")}</Label>
                    <Input
                      id="name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={createAPIKey}
                    disabled={isCreating || !newKeyName.trim()}
                  >
                    {isCreating ? t("creating") : t("create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {isLoading ? (
          <TableRowsSkeleton
            columns={6}
            rows={5}
            columnWidths={["w-24", "w-40", "w-16", "w-20", "w-20", "w-16"]}
          />
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <KeyRound className="size-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t("emptyTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("emptySubtitle")}
              </p>
              <Button
                className="mt-6 gap-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="size-4" />
                {t("createKey")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colKey")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colCreated")}</TableHead>
                  <TableHead>{t("colLastUsed")}</TableHead>
                  <TableHead>{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>{apiKey.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                          {apiKey.key}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("copyKeyAria")}
                          onClick={() => copyAPIKey(apiKey.id, apiKey.key)}
                        >
                          {copiedId === apiKey.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={apiKey.is_active}
                        onCheckedChange={() =>
                          toggleAPIKeyStatus(apiKey.id, apiKey.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(apiKey.created_at).toLocaleDateString(
                        dateLocale
                      )}
                    </TableCell>
                    <TableCell>
                      {apiKey.last_used_at
                        ? new Date(apiKey.last_used_at).toLocaleDateString(
                            dateLocale
                          )
                        : t("never")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteAPIKey(apiKey.id)}
                      >
                        {t("delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </DashboardPageContainer>
  );
}
