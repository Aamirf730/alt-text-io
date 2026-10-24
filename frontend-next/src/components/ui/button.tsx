import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * One button shape everywhere (docs/design-system.md):
 * 44px high (36px small), 12px radius, 0 20px padding, 15px/600 label,
 * 18px icon with an 8px gap, icon and label centred.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold leading-none no-underline transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-yellow-strong",
  {
    variants: {
      variant: {
        // Primary: yellow surface, ink label.
        default: "bg-brand-yellow text-ink hover:bg-yellow-strong active:bg-yellow-strong",
        primary: "bg-brand-yellow text-ink hover:bg-yellow-strong active:bg-yellow-strong",
        // Secondary: white surface, ink label, line-strong border.
        secondary: "border border-line-strong bg-white text-ink hover:bg-yellow-tint",
        outline: "border border-line-strong bg-white text-ink hover:bg-yellow-tint",
        // Ghost / link: transparent, ink label.
        ghost: "bg-transparent text-ink hover:bg-yellow-soft hover:underline underline-offset-4",
        link: "bg-transparent text-ink underline-offset-4 hover:underline",
        // Destructive: white surface, error label and border.
        destructive: "border border-error bg-white text-error hover:bg-red-50",
      },
      size: {
        default: "h-11 px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        lg: "h-11 px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        sm: "h-9 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [
      { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
