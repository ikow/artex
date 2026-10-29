import { localizedAppMetadata } from "@/config/app-config";

import type { Locale } from "./core";

/** React owns these head elements so static Next metadata cannot overwrite them. */
export function LocalizedMetadata({ locale }: { locale: Locale }) {
  const metadata = localizedAppMetadata(locale);
  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
    </>
  );
}
