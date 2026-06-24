import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-gradient-to-b from-ocean-500 to-ocean-600 text-white shadow hover:from-ocean-600 hover:to-ocean-700 hover:shadow-md": variant === "default",
            "border border-border2 bg-white text-ocean-900 shadow-sm hover:bg-ocean-50 hover:border-ocean-300": variant === "outline",
            "hover:bg-ocean-50 hover:text-ocean-900": variant === "ghost",
            "bg-coral text-white hover:bg-coral/90 shadow-sm": variant === "danger",
            "bg-cyan-100 text-cyan-700 hover:bg-cyan-200": variant === "secondary",
            "h-10 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-12 rounded-md px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
