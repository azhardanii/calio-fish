import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "danger" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2",
        {
          "bg-ocean-100 text-ocean-800": variant === "default",
          "bg-slate-l text-slate": variant === "secondary",
          "border border-border2 text-text": variant === "outline",
          "bg-coral-l text-coral": variant === "danger",
          "bg-seafoam-l text-seafoam": variant === "success",
          "bg-sand-l text-sand": variant === "warning",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
