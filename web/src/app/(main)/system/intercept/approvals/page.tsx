"use client";

import { useUILocale } from "@/lib/i18n/react";
import { ApprovalRecords } from "@/components/approval-records";

export default function ApprovalsPage() {
  "use no memo";
  const uiLocale = useUILocale();

  return (
    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
      <ApprovalRecords />
    </div>
  );
}
