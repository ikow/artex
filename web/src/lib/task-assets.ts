import { t as uiText } from "@/lib/i18n/core";
import type { NewAssetType } from "@/lib/types";

const ASSET_TYPE_LABELS: Record<NewAssetType, string> = {
  get app() { return uiText("应用"); },
  get endpoint() { return uiText("接口"); },
  ip: "IP",
  get root_domain() { return uiText("根域名"); },
  get service() { return uiText("服务"); },
  get subdomain() { return uiText("子域名"); },
};

const TASK_ASSET_SOURCE_LABELS: Record<string, string> = {
  get agent() { return uiText("Agent 发现"); },
  get anchor() { return uiText("黑板锚点"); },
  get api() { return uiText("资产 API"); },
  get company() { return uiText("企业关联"); },
  get legacy() { return uiText("历史关联"); },
  get manual() { return uiText("人工加入"); },
  get system() { return uiText("系统关联"); },
  get task() { return uiText("任务初始化"); },
};

export function taskAssetTypeLabel(type: NewAssetType): string {
  return ASSET_TYPE_LABELS[type];
}

export function taskAssetSourceLabel(source: string): string {
  return TASK_ASSET_SOURCE_LABELS[source] ?? source;
}
