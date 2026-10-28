import packageJson from "../../package.json";
import { t as uiText } from "@/lib/i18n/core";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "ARTEX",
  version: packageJson.version,
  copyright: `© ${currentYear}, ARTEX.`,
  meta: {
    get title() { return uiText("ARTEX — 自主渗透测试控制台"); },
    get description() { return uiText("LLM 驱动的自主渗透测试系统控制台"); },
  },
};
