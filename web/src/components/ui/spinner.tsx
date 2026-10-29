"use client"

import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"
import { useUILocale } from "@/lib/i18n/react"
import { translate } from "@/lib/i18n/core"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const locale = useUILocale()
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={translate(locale, "加载中")} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
