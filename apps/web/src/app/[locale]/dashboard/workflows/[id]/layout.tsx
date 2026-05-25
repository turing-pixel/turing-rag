/** Workflow editor: full-width, edge-to-edge canvas below the dashboard chrome. */
export default function WorkflowEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 w-full flex-col overflow-hidden">
      {children}
    </div>
  );
}
