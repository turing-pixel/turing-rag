import { redirect } from "next/navigation";

/** Avoid matching `runs` as workflow `[id]`; send users to the workflow list. */
export default function WorkflowRunsIndexPage() {
  redirect("/dashboard/workflows");
}
