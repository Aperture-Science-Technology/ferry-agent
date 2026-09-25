import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Pen Input/Search — 400×50, pill, pad [12,20], gap 12, icon 20, text 18/600.
 * Dedicated to header search; do not reuse for Form/Field geometry.
 */
function SearchInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <div
      className={cn(
        "flex h-[50px] w-full min-w-0 items-center gap-3 rounded-full border border-input-border bg-input px-5 py-3 md:w-[400px]",
        "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        className
      )}
    >
      <Search className="size-5 shrink-0 text-placeholder" aria-hidden />
      <InputPrimitive
        data-slot="search-input"
        className={cn(
          "h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-semibold text-foreground outline-none",
          "placeholder:text-placeholder",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        {...props}
      />
    </div>
  )
}

export { SearchInput }
