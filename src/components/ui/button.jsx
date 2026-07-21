import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button btn-elevated inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out outline-none select-none cursor-pointer hover:-translate-y-px active:translate-y-0 focus-visible:ring-3 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: brand teal bg with off-white text + a strong off-white inner ring so it stays visible on both teal page bg and white cards
        default:
          "bg-[#156c6b] text-white ring-1 ring-inset ring-white/30 shadow-lg shadow-black/20 hover:bg-[#0f5453] hover:ring-white/60 hover:shadow-xl hover:shadow-black/30",
        // Outline: transparent with off-white border + off-white text (for dark bg)
        outline:
          "bg-transparent border-2 border-white/80 text-white hover:bg-white hover:text-[#156c6b] shadow-md shadow-black/15",
        // Secondary: off-white bg with teal text (for dark bg surfaces)
        secondary:
          "bg-white text-[#156c6b] hover:bg-[#f8fafc] shadow-lg shadow-black/20 hover:shadow-xl",
        // Ghost: subtle hover, no chrome
        ghost:
          "bg-transparent text-white hover:bg-white/10 shadow-none",
        // Destructive: red action
        destructive:
          "bg-rose-600 text-white ring-1 ring-inset ring-white/30 hover:bg-rose-700 shadow-lg shadow-black/20",
        // Link: underline only
        link:
          "bg-transparent text-white underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-10 px-4",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8rem]",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
