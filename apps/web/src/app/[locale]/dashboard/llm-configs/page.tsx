"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  Check,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TableRowsSkeleton } from "@/components/skeletons/table-rows-skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProviderIcon } from "@/components/llm/provider-icon";
import { api, ApiError } from "@/lib/api";
import { getProviderLabel } from "@/lib/llm-providers";

interface LlmEnvDefault {
  configured: boolean;
  is_default?: boolean;
  provider?: string;
  model?: string;
  api_base?: string | null;
  api_key_masked?: string;
}

interface LlmConfig {
  id: number;
  name: string;
  provider: string;
  model: string;
  api_base: string | null;
  api_key_masked: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ProviderMeta {
  provider: string;
  label: string;
  default_api_base: string;
  default_model: string;
  requires_api_key: boolean;
}

interface FetchedModel {
  id: string;
  label: string;
}

interface FormState {
  name: string;
  provider: string;
  model: string;
  api_base: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
}

interface ProbePayload {
  provider: string;
  api_base: string | null;
  api_key?: string;
  model?: string;
  config_id?: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  provider: "openai",
  model: "",
  api_base: "",
  api_key: "",
  is_active: true,
  is_default: false,
};

export default function LlmConfigsPage() {
  const t = useTranslations("llmConfigsPage");
  const tToast = useTranslations("toasts");
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [envDefault, setEnvDefault] = useState<LlmEnvDefault | null>(null);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const selectedProviderMeta = useMemo(
    () => providers.find((item) => item.provider === form.provider),
    [providers, form.provider]
  );

  const credentialsReady = useMemo(() => {
    const apiBaseReady = Boolean(form.api_base.trim());
    if (!apiBaseReady) return false;
    if (!selectedProviderMeta?.requires_api_key) return true;
    return (
      Boolean(form.api_key.trim()) || Boolean(editingConfig?.api_key_masked)
    );
  }, [
    form.api_base,
    form.api_key,
    editingConfig?.api_key_masked,
    selectedProviderMeta?.requires_api_key,
  ]);

  const canVerify = credentialsReady && Boolean(form.model.trim());

  const fetchData = useCallback(async () => {
    try {
      const [configsData, providersData, envDefaultData] = await Promise.all([
        api.get("/api/llm-configs") as Promise<LlmConfig[]>,
        api.get("/api/llm-configs/providers") as Promise<{ providers: ProviderMeta[] }>,
        api.get("/api/llm-configs/env-default") as Promise<LlmEnvDefault>,
      ]);
      setConfigs(configsData);
      setProviders(providersData.providers);
      setEnvDefault(envDefaultData);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigLoadError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [tToast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const buildProbePayload = useCallback(
    (modelOverride?: string): ProbePayload => ({
      provider: form.provider,
      api_base: form.api_base.trim() || null,
      ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
      ...(modelOverride ?? form.model.trim()
        ? { model: (modelOverride ?? form.model).trim() }
        : {}),
      ...(editingConfig ? { config_id: editingConfig.id } : {}),
    }),
    [form, editingConfig]
  );

  const invalidateVerification = useCallback(() => {
    setIsVerified(false);
  }, []);

  const patchForm = useCallback(
    (patch: Partial<FormState>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      invalidateVerification();
    },
    [invalidateVerification]
  );

  const openCreateDialog = () => {
    const defaultProvider = providers[0]?.provider ?? "openai";
    const defaultApiBase =
      providers.find((item) => item.provider === defaultProvider)?.default_api_base ?? "";
    setEditingConfig(null);
    const meta = providers.find((item) => item.provider === defaultProvider);
    setFetchedModels([]);
    setIsVerified(false);
    setForm({
      ...EMPTY_FORM,
      provider: defaultProvider,
      api_base: defaultApiBase,
      model: meta?.default_model ?? "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (config: LlmConfig) => {
    setEditingConfig(config);
    setFetchedModels([{ id: config.model, label: config.model }]);
    setIsVerified(true);
    setForm({
      name: config.name,
      provider: config.provider,
      model: config.model,
      api_base: config.api_base ?? "",
      api_key: "",
      is_active: config.is_active,
      is_default: config.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    const meta = providers.find((item) => item.provider === provider);
    setFetchedModels([]);
    setForm((prev) => ({
      ...prev,
      provider,
      api_base: meta?.default_api_base ?? prev.api_base,
      model: meta?.default_model ?? prev.model,
    }));
    invalidateVerification();
  };

  const handleFetchModels = async () => {
    if (!credentialsReady) {
      toast.error(t("credentialsIncomplete"));
      return;
    }

    setIsFetchingModels(true);
    try {
      const data = (await api.post("/api/llm-configs/fetch-models", buildProbePayload())) as {
        models: FetchedModel[];
        source: string;
      };
      setFetchedModels(data.models);
      if (data.models.length > 0) {
        const hasCurrent = data.models.some((item) => item.id === form.model);
        if (!hasCurrent) {
          patchForm({ model: data.models[0].id });
        }
      }
      if (data.source === "api") {
        toast.success(t("modelsFetched", { count: data.models.length }));
      } else {
        toast.message(t("modelsFetchedCatalog"));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigFetchModelsError"));
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleVerify = async () => {
    if (!credentialsReady) {
      toast.error(t("credentialsIncomplete"));
      return;
    }
    if (!form.model.trim()) {
      toast.error(t("verifyNeedModel"));
      return;
    }

    setIsVerifying(true);
    try {
      const data = (await api.post(
        "/api/llm-configs/verify",
        buildProbePayload()
      )) as { success: boolean; message: string };
      if (data.success) {
        setIsVerified(true);
        toast.success(tToast("llmConfigVerifySuccess"));
      } else {
        setIsVerified(false);
        toast.error(data.message || tToast("llmConfigVerifyFailed"));
      }
    } catch (error) {
      setIsVerified(false);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigVerifyFailed"));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.model.trim()) {
      toast.error(tToast("llmConfigValidationError"));
      return;
    }
    if (!editingConfig && selectedProviderMeta?.requires_api_key && !form.api_key.trim()) {
      toast.error(tToast("llmConfigApiKeyRequired"));
      return;
    }
    if (!isVerified) {
      toast.error(t("verifyRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        model: form.model.trim(),
        api_base: form.api_base.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
        ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
      };

      if (editingConfig) {
        const updated = await api.put(`/api/llm-configs/${editingConfig.id}`, payload);
        setConfigs((prev) =>
          prev.map((item) => (item.id === editingConfig.id ? updated : item))
        );
        toast.success(tToast("llmConfigUpdateSuccess"));
      } else {
        const created = await api.post("/api/llm-configs", payload);
        setConfigs((prev) => [created, ...prev]);
        toast.success(tToast("llmConfigCreateSuccess"));
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(
          editingConfig ? tToast("llmConfigUpdateError") : tToast("llmConfigCreateError")
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteConfig = async (id: number) => {
    try {
      await api.delete(`/api/llm-configs/${id}`);
      setConfigs((prev) => prev.filter((item) => item.id !== id));
      toast.success(tToast("llmConfigDeleteSuccess"));
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigDeleteError"));
      }
    }
  };

  const toggleActive = async (config: LlmConfig) => {
    try {
      await api.put(`/api/llm-configs/${config.id}`, {
        is_active: !config.is_active,
      });
      toast.success(tToast("llmConfigUpdateSuccess"));
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigUpdateError"));
      }
    }
  };

  const setAsDefault = async (config: LlmConfig) => {
    if (config.is_default) return;
    if (!config.is_active) {
      toast.error(tToast("llmConfigSetDefaultRequiresActive"));
      return;
    }
    try {
      await api.put(`/api/llm-configs/${config.id}`, {
        is_default: true,
      });
      toast.success(tToast("llmConfigDefaultSuccess"));
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigUpdateError"));
      }
    }
  };

  const setEnvAsDefault = async () => {
    if (envDefault?.is_default) return;
    try {
      await api.post("/api/llm-configs/env-default/set-default");
      toast.success(tToast("llmConfigDefaultSuccess"));
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToast("llmConfigUpdateError"));
      }
    }
  };

  return (
    <DashboardPageContainer>
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="size-4" />
            {t("create")}
          </Button>
        </header>

        {isLoading ? (
          <TableRowsSkeleton
            columns={3}
            rows={4}
            columnWidths={["w-32", "w-20", "w-8"]}
          />
        ) : envDefault?.configured ||
          configs.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("moreActions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envDefault?.configured &&
                envDefault.provider &&
                envDefault.model ? (
                  <TableRow className="bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProviderIcon provider={envDefault.provider} size={20} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {t("envDefaultDisplayName")}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {getProviderLabel(
                              envDefault.provider,
                              providers.find(
                                (p) => p.provider === envDefault.provider
                              )?.label
                            )}
                            <span className="mx-1.5 text-muted-foreground/60">
                              /
                            </span>
                            <span className="font-mono text-xs">
                              {envDefault.model}
                            </span>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {envDefault.is_default ? (
                          <Badge variant="secondary">{t("defaultBadge")}</Badge>
                        ) : null}
                        <Badge variant="outline">{t("envDefaultReadOnlyBadge")}</Badge>
                        <Badge variant="default">{t("statusActive")}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("configActionsAria", {
                              name: t("envDefaultDisplayName"),
                            })}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="bottom"
                          sideOffset={8}
                          className="min-w-44"
                        >
                          <DropdownMenuLabel className="max-w-48 truncate font-normal">
                            {t("envDefaultDisplayName")}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              disabled={envDefault.is_default}
                              onSelect={(e) => {
                                e.preventDefault();
                                void setEnvAsDefault();
                              }}
                            >
                              {envDefault.is_default ? (
                                <Check className="size-4" />
                              ) : (
                                <Star className="size-4" />
                              )}
                              {t("actionSetDefault")}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ) : null}
                {configs.map((config) => {
                  const providerLabel = getProviderLabel(
                    config.provider,
                    providers.find((p) => p.provider === config.provider)?.label
                  );

                  return (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProviderIcon provider={config.provider} size={20} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{config.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {providerLabel}
                              <span className="mx-1.5 text-muted-foreground/60">
                                /
                              </span>
                              <span className="font-mono text-xs">
                                {config.model}
                              </span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {config.is_default ? (
                            <Badge variant="secondary">{t("defaultBadge")}</Badge>
                          ) : null}
                          <Badge variant={config.is_active ? "default" : "outline"}>
                            {config.is_active
                              ? t("statusActive")
                              : t("statusInactive")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("configActionsAria", {
                                name: config.name,
                              })}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            side="bottom"
                            sideOffset={8}
                            className="min-w-44"
                          >
                            <DropdownMenuLabel className="max-w-48 truncate font-normal">
                              {config.name}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  openEditDialog(config);
                                }}
                              >
                                <Pencil className="size-4" />
                                {t("actionEdit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={config.is_default || !config.is_active}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  void setAsDefault(config);
                                }}
                              >
                                {config.is_default ? (
                                  <Check className="size-4" />
                                ) : (
                                  <Star className="size-4" />
                                )}
                                {t("actionSetDefault")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  void toggleActive(config);
                                }}
                              >
                                {config.is_active
                                  ? t("actionDisable")
                                  : t("actionEnable")}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  void deleteConfig(config.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                                {t("actionDelete")}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Bot className="size-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t("emptyTitle")}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t("emptySubtitle")}
              </p>
              <Button className="mt-6 gap-2" onClick={openCreateDialog}>
                <Plus className="size-4" />
                {t("create")}
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? t("editTitle") : t("createTitle")}
              </DialogTitle>
              <DialogDescription>
                {editingConfig ? t("editDescription") : t("createDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="llm-name">{t("nameLabel")}</Label>
                <Input
                  id="llm-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t("namePlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="llm-provider">{t("providerLabel")}</Label>
                <Select value={form.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger id="llm-provider">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <ProviderIcon provider={form.provider} size={16} />
                        {getProviderLabel(
                          form.provider,
                          selectedProviderMeta?.label
                        )}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem
                        key={provider.provider}
                        value={provider.provider}
                      >
                        <span className="flex items-center gap-2">
                          <ProviderIcon provider={provider.provider} size={16} />
                          {getProviderLabel(provider.provider, provider.label)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="llm-api-base">{t("apiBaseLabel")}</Label>
                <Input
                  id="llm-api-base"
                  value={form.api_base}
                  onChange={(e) => patchForm({ api_base: e.target.value })}
                  placeholder={selectedProviderMeta?.default_api_base}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="llm-api-key">{t("apiKeyLabel")}</Label>
                <Input
                  id="llm-api-key"
                  type="password"
                  value={form.api_key}
                  onChange={(e) => patchForm({ api_key: e.target.value })}
                  placeholder={
                    editingConfig ? t("apiKeyEditPlaceholder") : t("apiKeyPlaceholder")
                  }
                  autoComplete="off"
                />
                {editingConfig ? (
                  <p className="text-xs text-muted-foreground">
                    {t("apiKeyEditHint")}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="llm-model">{t("modelLabel")}</Label>
                  <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("fetchModelsTooltip")}
                              onClick={() => void handleFetchModels()}
                              disabled={
                                !credentialsReady ||
                                isFetchingModels ||
                                isVerifying
                              }
                            >
                              {isFetchingModels ? (
                                <Spinner className="size-4" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {!credentialsReady
                            ? t("credentialsIncomplete")
                            : t("fetchModelsTooltip")}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("verifyConnectionTooltip")}
                              onClick={() => void handleVerify()}
                              disabled={
                                !canVerify || isVerifying || isFetchingModels
                              }
                            >
                              {isVerifying ? (
                                <Spinner className="size-4" />
                              ) : (
                                <Unplug className="size-4" />
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {!credentialsReady
                            ? t("credentialsIncomplete")
                            : !form.model.trim()
                              ? t("verifyNeedModel")
                              : t("verifyConnectionTooltip")}
                        </TooltipContent>
                      </Tooltip>
                  </div>
                </div>

                {fetchedModels.length > 0 ? (
                  <Select
                    value={
                      fetchedModels.some((item) => item.id === form.model)
                        ? form.model
                        : undefined
                    }
                    onValueChange={(value) => patchForm({ model: value })}
                  >
                    <SelectTrigger id="llm-model-select">
                      <SelectValue placeholder={t("modelPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <Input
                  id="llm-model"
                  value={form.model}
                  onChange={(e) => patchForm({ model: e.target.value })}
                  placeholder={
                    selectedProviderMeta?.default_model ?? t("modelPlaceholder")
                  }
                />

                {fetchedModels.length > 0 ? (
                  <p className="text-xs text-muted-foreground">{t("manualModelHint")}</p>
                ) : null}

                {isVerified ? (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    {t("verifiedBadge")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("verifyRequired")}</p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="llm-active">{t("activeLabel")}</Label>
                <Switch
                  id="llm-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_active: checked === true }))
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="llm-default"
                  checked={form.is_default}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      is_default: checked === true,
                    }))
                  }
                />
                <Label htmlFor="llm-default">{t("defaultLabel")}</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSaving || !isVerified || !form.model.trim()}
              >
                {isSaving ? t("saving") : editingConfig ? t("save") : t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </DashboardPageContainer>
  );
}
