import { t as uiText } from "@/lib/i18n/core";
// Centralised status → color/label semantics, reused across the whole app.
// Spec §8.3: 意图 / 覆盖 / 任务 / 严重度 each have a consistent color set.

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "rose" | "violet" | "slate";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  red: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  // rose 用作「严重」——实心高强调,视觉上明显高于「高危」的软红描边。
  rose: "bg-rose-600 text-white border-rose-600 dark:bg-rose-600 dark:text-white",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

export const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  rose: "bg-white",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
};

interface StatusMeta {
  label: string;
  tone: Tone;
}

const intent: Record<string, StatusMeta> = {
  open: { get label() { return uiText("待领"); }, tone: "slate" },
  running: { get label() { return uiText("执行中"); }, tone: "blue" },
  paused: { get label() { return uiText("已暂停"); }, tone: "amber" },
  done: { get label() { return uiText("已完成"); }, tone: "green" },
  // blocked = 模型/API/网络故障重试用尽，这条意图基本没真正探成（非目标拦截）。
  blocked: { get label() { return uiText("执行出错"); }, tone: "red" },
  // exhausted = 达到步数/时间预算被中途掐断、只写回部分结果（非方向已探尽）。
  exhausted: { get label() { return uiText("预算耗尽"); }, tone: "violet" },
  // stopped = 历史软删除状态（保留,历史数据）。
  stopped: { get label() { return uiText("已停止"); }, tone: "slate" },
  // deleted = 用户假删除了该意图（保留节点与血缘，删除原因见 delete_reason 字段）。
  deleted: { get label() { return uiText("已删除"); }, tone: "slate" },
};

const task: Record<string, StatusMeta> = {
  created: { get label() { return uiText("已创建"); }, tone: "slate" },
  queued: { get label() { return uiText("排队中"); }, tone: "amber" },
  running: { get label() { return uiText("运行中"); }, tone: "blue" },
  paused: { get label() { return uiText("已暂停"); }, tone: "amber" },
  done: { get label() { return uiText("已完成"); }, tone: "green" },
  failed: { get label() { return uiText("失败"); }, tone: "red" },
  timeout: { get label() { return uiText("已超时"); }, tone: "amber" },
};

const severity: Record<string, StatusMeta> = {
  critical: { get label() { return uiText("严重"); }, tone: "rose" },
  high: { get label() { return uiText("高危"); }, tone: "red" },
  medium: { get label() { return uiText("中危"); }, tone: "amber" },
  low: { get label() { return uiText("低危"); }, tone: "slate" },
};

const finding: Record<string, StatusMeta> = {
  pending: { get label() { return uiText("待处理"); }, tone: "amber" },
  in_progress: { get label() { return uiText("处理中"); }, tone: "blue" },
  confirmed: { get label() { return uiText("已确认"); }, tone: "red" },
  resolved: { get label() { return uiText("已处理"); }, tone: "green" },
  fixed: { get label() { return uiText("已修复"); }, tone: "green" },
  false_positive: { get label() { return uiText("误报"); }, tone: "slate" },
  ignored: { get label() { return uiText("忽略"); }, tone: "neutral" },
  duplicate: { get label() { return uiText("重复"); }, tone: "neutral" },
  risk_accepted: { get label() { return uiText("风险接受"); }, tone: "violet" },
};

const engine: Record<string, StatusMeta> = {
  exploring: { get label() { return uiText("探索中"); }, tone: "blue" },
  paused: { get label() { return uiText("已暂停"); }, tone: "amber" },
  stalled: { get label() { return uiText("停滞"); }, tone: "red" },
  idle: { get label() { return uiText("空闲"); }, tone: "neutral" },
};

const goal: Record<string, StatusMeta> = {
  open: { get label() { return uiText("进行中"); }, tone: "blue" },
  met: { get label() { return uiText("已达成"); }, tone: "green" },
  abandoned: { get label() { return uiText("已放弃"); }, tone: "slate" },
};

const audit: Record<string, StatusMeta> = {
  allow: { get label() { return uiText("放行"); }, tone: "green" },
  block: { get label() { return uiText("拦截"); }, tone: "red" },
};

const node: Record<string, StatusMeta> = {
  observed: { get label() { return uiText("观测"); }, tone: "slate" },
  confirmed: { get label() { return uiText("确认"); }, tone: "green" },
  tombstoned: { get label() { return uiText("废弃"); }, tone: "neutral" },
};

// 推送投递状态。sending 用 blue 而不是 amber：它不是「有问题」，
// 而是「已被领取、正在发」，与 pending 的等待语义要能区分开。
const delivery: Record<string, StatusMeta> = {
  pending: { get label() { return uiText("待发送"); }, tone: "amber" },
  sending: { get label() { return uiText("发送中"); }, tone: "blue" },
  sent: { get label() { return uiText("已送达"); }, tone: "green" },
  failed: { get label() { return uiText("失败"); }, tone: "red" },
  skipped: { get label() { return uiText("已跳过"); }, tone: "neutral" },
};

const maps = {
  intent,
  task,
  severity,
  finding,
  engine,
  goal,
  audit,
  node,
  delivery,
} as const;

export type StatusDomain = keyof typeof maps;

export function statusMeta(domain: StatusDomain, key: string): StatusMeta {
  return maps[domain][key] ?? { label: key, tone: "neutral" };
}
