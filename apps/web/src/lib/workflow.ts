import { api } from "@/lib/api";

export interface WorkflowTemplate {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  input_schema: Record<string, unknown>;
  step_schema: WorkflowStep[];
  output_schema?: Record<string, unknown> | null;
  default_graph?: WorkflowGraph | null;
  is_system: boolean;
}

export interface WorkflowStep {
  key: string;
  type: "retrieve" | "llm" | "condition" | "format";
  prompt?: string;
  query_template?: string;
  template?: string;
  format?: string;
  when?: string;
  message?: string;
  [key: string]: unknown;
}

export interface WorkflowGraph {
  nodes: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges: Array<{ id?: string; source: string; target: string }>;
  stepDefinitions?: Record<string, WorkflowStep>;
}

export interface WorkflowDefinition {
  uuid: string;
  template_key: string;
  name: string;
  description?: string | null;
  config: Record<string, unknown>;
  resolved_steps: WorkflowStep[];
  graph?: WorkflowGraph | null;
  llm_config_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_run_status?: string | null;
  last_run_at?: string | null;
}

export interface WorkflowRunStep {
  step_key: string;
  step_type: string;
  status: string;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  citations?: Array<Record<string, unknown>> | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
}

export interface WorkflowRun {
  uuid: string;
  workflow_uuid: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error_message?: string | null;
  template_key: string;
  created_at: string;
  updated_at: string;
  steps: WorkflowRunStep[];
}

export interface WorkflowWebhook {
  id: number;
  url: string;
  events: string[];
  is_active: boolean;
}

export interface WorkflowSchedule {
  uuid: string;
  name: string;
  cron_expression: string;
  input_defaults: Record<string, unknown>;
  timezone: string;
  is_active: boolean;
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return api.get("/api/workflow-templates") as Promise<WorkflowTemplate[]>;
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  return api.get("/api/workflows") as Promise<WorkflowDefinition[]>;
}

export async function getWorkflow(uuid: string): Promise<WorkflowDefinition> {
  return api.get(`/api/workflows/${uuid}`) as Promise<WorkflowDefinition>;
}

export async function createWorkflow(
  body: Partial<WorkflowDefinition> & {
    template_key: string;
    name: string;
  }
): Promise<WorkflowDefinition> {
  return api.post("/api/workflows", body) as Promise<WorkflowDefinition>;
}

export async function updateWorkflow(
  uuid: string,
  body: Partial<WorkflowDefinition>
): Promise<WorkflowDefinition> {
  return api.patch(`/api/workflows/${uuid}`, body) as Promise<WorkflowDefinition>;
}

export async function deleteWorkflow(uuid: string): Promise<void> {
  return api.delete(`/api/workflows/${uuid}`);
}

export async function resetWorkflowFromTemplate(
  uuid: string
): Promise<WorkflowDefinition> {
  return api.post(
    `/api/workflows/${uuid}/reset-template`,
    {}
  ) as Promise<WorkflowDefinition>;
}

export async function runWorkflow(
  uuid: string,
  input: Record<string, unknown>
): Promise<WorkflowRun> {
  return api.post(`/api/workflows/${uuid}/runs`, { input }) as Promise<WorkflowRun>;
}

export async function getWorkflowRun(runUuid: string): Promise<WorkflowRun> {
  return api.get(`/api/workflow-runs/${runUuid}`) as Promise<WorkflowRun>;
}

export async function listWorkflowRuns(
  workflowUuid: string
): Promise<Array<{ uuid: string; status: string; created_at: string; updated_at: string }>> {
  return api.get(`/api/workflows/${workflowUuid}/runs`);
}

export async function listWorkflowWebhooks(
  workflowUuid: string
): Promise<WorkflowWebhook[]> {
  return api.get(`/api/workflows/${workflowUuid}/webhooks`) as Promise<WorkflowWebhook[]>;
}

export async function listWorkflowSchedules(
  workflowUuid: string
): Promise<WorkflowSchedule[]> {
  return api.get(`/api/workflows/${workflowUuid}/schedules`) as Promise<
    WorkflowSchedule[]
  >;
}
