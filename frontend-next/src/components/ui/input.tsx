import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-ink placeholder:text-ink-muted selection:bg-yellow-soft selection:text-ink border-line-strong h-11 w-full min-w-0 rounded-xl border bg-white px-4 py-2 text-base text-ink transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-yellow-strong focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-yellow-strong",
        "aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
