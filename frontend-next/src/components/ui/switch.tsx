"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-brand-yellow data-[state=checked]:border-yellow-strong data-[state=unchecked]:bg-yellow-tint data-[state=unchecked]:border-line-strong inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-yellow-strong disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-white shadow-notebook ring-1 ring-line-strong transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:ring-ink/20 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
