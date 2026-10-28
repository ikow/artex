"use client";
import { useUILocale } from "@/lib/i18n/react";


import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  "use no memo";
  const uiLocale = useUILocale();

  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">Page not found.</h1>
      <p className="text-muted-foreground">The page you are looking for could not be found.</p>
      <Link prefetch={false} replace href="/function/tasks">
        <Button variant="outline">Go back home</Button>
      </Link>
    </div>
  );
}
