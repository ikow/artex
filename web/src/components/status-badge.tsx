"use client";

import { useUILocale } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import {
  statusMeta,
  toneClasses,
  toneDot,
  type StatusDomain,
  type Tone,
} from "@/lib/status";

export function StatusBadge({
  domain,
  value,
  dot = false,
  className,
}: {
  domain: StatusDomain;
  value: string;
  dot?: boolean;
  className?: string;
}) {
  "use no memo";
  const uiLocale = useUILocale();

  const meta = statusMeta(domain, value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[meta.tone],
        className,
      )}
    >
      {dot && (
        <span className={cn("size-1.5 rounded-full", toneDot[meta.tone])} />
      )}
      {meta.label}
    </span>
  );
}

export function ToneDot({ tone }: { tone: Tone }) {
  "use no memo";
  const uiLocale = useUILocale();

  return <span className={cn("size-2 rounded-full", toneDot[tone])} />;
}
