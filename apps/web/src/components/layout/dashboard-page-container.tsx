import { cn } from "@/lib/utils";

interface DashboardPageContainerProps extends React.ComponentProps<"div"> {}

export function DashboardPageContainer({
  children,
  className,
  ...props
}: DashboardPageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-4 pt-6 pb-8 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
