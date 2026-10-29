import { t as uiText } from "@/lib/i18n/core";
import {
  Activity,
  Ban,
  BellRing,
  Bot,
  Brain,
  Bug,
  ClipboardList,
  FolderOpen,
  FolderSync,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Network,
  Plug,
  Radio,
  ScrollText,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Terminal,
  Wrench,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    get label() { return uiText("功能"); },
    items: [
      { id: "dashboard", get title() { return uiText("仪表盘"); }, url: "/dashboard", icon: LayoutDashboard },
      { id: "chat", get title() { return uiText("对话"); }, url: "/chat", icon: MessageSquare },
      { id: "tasks", get title() { return uiText("任务"); }, url: "/function/tasks", icon: Target },
      { id: "findings", get title() { return uiText("发现"); }, url: "/function/findings", icon: Bug },
      { id: "traffic", get title() { return uiText("流量"); }, url: "/function/traffic", icon: Activity },
      { id: "commands", get title() { return uiText("工具执行"); }, url: "/function/commands", icon: Terminal },
      { id: "llm-records", get title() { return uiText("LLM 录制"); }, url: "/function/llm-records", icon: Radio },
      { id: "assets", get title() { return uiText("资产"); }, url: "/function/assets", icon: Network },
      { id: "sync", get title() { return uiText("资产同步"); }, url: "/function/sync", icon: FolderSync },
      { id: "workspace", get title() { return uiText("工作空间"); }, url: "/function/workspace", icon: FolderOpen },
    ],
  },
  {
    id: 2,
    get label() { return uiText("系统"); },
    items: [
      { id: "llm", title: "LLM", url: "/system/llm", icon: Brain },
      { id: "agents", title: "Agent", url: "/system/agents", icon: Bot },
      { id: "mcp", title: "MCP", url: "/system/mcp", icon: Plug },
      { id: "skills", title: "Skill", url: "/system/skills", icon: Sparkles },
      { id: "tools", get title() { return uiText("工具"); }, url: "/system/tools", icon: Wrench },
      { id: "notify", get title() { return uiText("通知推送"); }, url: "/system/notify", icon: BellRing },
      { id: "intercept", get title() { return uiText("拦截规则"); }, url: "/system/intercept", icon: ShieldAlert },
      { id: "asset-intercept", get title() { return uiText("资产拦截"); }, url: "/system/intercept/assets", icon: Ban },
      { id: "approvals", get title() { return uiText("审批记录"); }, url: "/system/intercept/approvals", icon: ClipboardList },
      { id: "logs", get title() { return uiText("日志"); }, url: "/system/logs", icon: ScrollText },
      { id: "settings", get title() { return uiText("系统配置"); }, url: "/system/settings", icon: Settings2 },
    ],
  },
];
