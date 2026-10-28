"use client";
import { useUILocale } from "@/lib/i18n/react";


import { ApprovalRecords } from "@/components/approval-records";

export function InterceptTab({ taskId }: { taskId: string }) {
  "use no memo";
  const uiLocale = useUILocale();

  return <ApprovalRecords key={taskId} taskId={taskId} />;
}
