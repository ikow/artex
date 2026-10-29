import packageJson from "../../package.json";
import { getLocale, translate, type Locale } from "@/lib/i18n/core";

const currentYear = new Date().getFullYear();

export function localizedAppMetadata(locale: Locale) {
  return {
    title: translate(locale, "ARTEX — 自主渗透测试控制台"),
    description: translate(locale, "LLM 驱动的自主渗透测试系统控制台"),
  };
}

export const APP_CONFIG = {
  name: "ARTEX",
  version: packageJson.version,
  copyright: `© ${currentYear}, ARTEX.`,
  meta: {
    get title() { return localizedAppMetadata(getLocale()).title; },
    get description() { return localizedAppMetadata(getLocale()).description; },
  },
};
