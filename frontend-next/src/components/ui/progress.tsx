"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<"progress">) {
  return (
    <progress
      data-slot="progress"
      max={100}
      className={cn(
        "bg-primary/20 h-2 w-full overflow-hidden rounded-full",
        className
      )}
      value={value ?? 0}
      {...props}
    />
  )
}

export { Progress }
