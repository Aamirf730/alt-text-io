import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-yellow-soft text-ink [a&]:hover:bg-brand-yellow",
        secondary:
          "border-line bg-yellow-tint text-ink [a&]:hover:bg-yellow-soft",
        destructive:
          "border-red-200 bg-red-50 text-error",
        outline:
          "border-line-strong bg-white text-ink [a&]:hover:bg-yellow-tint",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
