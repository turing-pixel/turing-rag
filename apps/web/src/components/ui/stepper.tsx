"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

type StepperContextValue = {
  value: number
  stepCount: number
}

const StepperContext = React.createContext<StepperContextValue | null>(null)

function useStepperContext() {
  const context = React.useContext(StepperContext)
  if (!context) {
    throw new Error("Stepper components must be used within <Stepper>")
  }
  return context
}

type StepperItemContextValue = {
  step: number
  state: "completed" | "active" | "inactive"
  isFirst: boolean
  isLast: boolean
}

const StepperItemContext = React.createContext<StepperItemContextValue | null>(
  null
)

function useStepperItemContext() {
  const context = React.useContext(StepperItemContext)
  if (!context) {
    throw new Error("Stepper subcomponents must be used within <StepperItem>")
  }
  return context
}

function Stepper({
  value,
  stepCount,
  className,
  children,
  ...props
}: React.ComponentProps<"nav"> & {
  value: number
  stepCount: number
}) {
  return (
    <StepperContext.Provider value={{ value, stepCount }}>
      <nav
        data-slot="stepper"
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </nav>
    </StepperContext.Provider>
  )
}

function StepperList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="stepper-list"
      className={cn(
        "flex w-full list-none items-start gap-0 p-0",
        className
      )}
      {...props}
    />
  )
}

function StepperItem({
  step,
  className,
  children,
  ...props
}: React.ComponentProps<"li"> & { step: number }) {
  const { value, stepCount } = useStepperContext()
  const state =
    value > step ? "completed" : value === step ? "active" : "inactive"

  return (
    <StepperItemContext.Provider
      value={{
        step,
        state,
        isFirst: step === 1,
        isLast: step === stepCount,
      }}
    >
      <li
        data-slot="stepper-item"
        data-state={state}
        className={cn(
          "flex min-w-0 flex-1 list-none flex-col items-center",
          className
        )}
        {...props}
      >
        {children}
      </li>
    </StepperItemContext.Provider>
  )
}

function StepperTrack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stepper-track"
      className={cn("flex w-full items-center", className)}
      {...props}
    />
  )
}

const stepperConnectorVariants = cva(
  "h-px min-w-2 flex-1 rounded-full transition-colors",
  {
    variants: {
      filled: {
        true: "bg-primary",
        false: "bg-border",
      },
      hidden: {
        true: "opacity-0",
        false: "",
      },
    },
    defaultVariants: {
      filled: false,
      hidden: false,
    },
  }
)

function StepperConnector({
  position,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  position: "leading" | "trailing"
}) {
  const { step, isFirst, isLast } = useStepperItemContext()
  const { value, stepCount } = useStepperContext()

  const hidden = position === "leading" ? isFirst : isLast
  const filled =
    position === "leading"
      ? step > 1 && value >= step
      : step < stepCount && value > step

  return (
    <span
      data-slot="stepper-connector"
      data-position={position}
      aria-hidden
      className={cn(
        stepperConnectorVariants({ filled, hidden }),
        className
      )}
      {...props}
    />
  )
}

const stepperIndicatorVariants = cva(
  "mx-2 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors sm:size-9 [&_svg]:size-4",
  {
    variants: {
      state: {
        completed: "border-primary bg-primary text-primary-foreground",
        active: "border-primary bg-background text-primary shadow-xs",
        inactive: "border-border bg-muted/40 text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "inactive",
    },
  }
)

function StepperIndicator({
  className,
  children,
  completedIcon,
  ...props
}: React.ComponentProps<"span"> & {
  completedIcon?: React.ReactNode
}) {
  const { step, state } = useStepperItemContext()

  return (
    <span
      data-slot="stepper-indicator"
      data-state={state}
      aria-current={state === "active" ? "step" : undefined}
      className={cn(stepperIndicatorVariants({ state }), className)}
      {...props}
    >
      {state === "completed" && completedIcon != null
        ? completedIcon
        : children ?? step}
    </span>
  )
}

const stepperTitleVariants = cva(
  "mt-2 max-w-28 text-center text-xs leading-tight font-medium sm:max-w-32 sm:text-sm",
  {
    variants: {
      state: {
        active: "text-foreground",
        completed: "text-muted-foreground",
        inactive: "text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "inactive",
    },
  }
)

function StepperTitle({
  className,
  showIndex = true,
  children,
  ...props
}: React.ComponentProps<"span"> & { showIndex?: boolean }) {
  const { step, state } = useStepperItemContext()

  return (
    <span
      data-slot="stepper-title"
      data-state={state}
      className={cn(stepperTitleVariants({ state }), className)}
      {...props}
    >
      {showIndex ? (
        <span className="text-muted-foreground">{step}. </span>
      ) : null}
      {children}
    </span>
  )
}

export {
  Stepper,
  StepperList,
  StepperItem,
  StepperTrack,
  StepperConnector,
  StepperIndicator,
  StepperTitle,
}
