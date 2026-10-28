"use client";

import * as React from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { LLMHTTPStats } from "@/lib/llm-rate-limits";
import type { LLMProfile } from "@/lib/types";

const dateText = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");

function Headers({ values }: { values: Record<string, string> }) {
  const entries = Object.entries(values);
  if (!entries.length) return <p className="text-muted-foreground text-xs">网关未返回限额响应头，实际配额未知。</p>;
  return (
    <dl className="grid gap-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="break-all font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RateLimitPanel({ profiles }: { profiles: LLMProfile[] }) {
  const [hours, setHours] = React.useState("24");
  const [stats, setStats] = React.useState<LLMHTTPStats | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    let disposed = false;
    let loading = false;
    const load = async () => {
      if (loading || disposed) return;
      loading = true;
      setBusy(true);
      try {
        const next = await api.llmHTTPStats(Number(hours));
        if (!disposed) {
          setStats(next);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "读取限流统计失败");
      } finally {
        loading = false;
        if (!disposed) setBusy(false);
      }
    };
    setStats(null);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [hours, refresh]);

  const attempts = stats?.models.reduce((sum, row) => sum + row.attempts, 0) ?? 0;
  const limits = stats?.models.reduce((sum, row) => sum + row.rate_limited, 0) ?? 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">HTTP 请求与限流</h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-xs">
            按真实 HTTP 尝试统计（包含自动重试），不保存提示词、响应正文或凭据。
            本地请求节流不等于服务商配额；不同模型也可能共享网关限额。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-36" aria-label="统计时间范围"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">最近 1 小时</SelectItem>
              <SelectItem value="24">最近 24 小时</SelectItem>
              <SelectItem value="168">最近 7 天</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>
            {busy ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} 刷新
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="text-destructive text-sm">刷新失败：{error}。下方如有数据，为上次成功读取的结果。</p>}
      {busy && !stats && <p role="status" className="text-muted-foreground text-sm">正在读取统计…</p>}
      {stats && (
        <>
          <p className="text-sm">
            HTTP 尝试 <b>{attempts.toLocaleString()}</b> · 429 响应 <b>{limits.toLocaleString()}</b>
            <span className="text-muted-foreground ml-3 text-xs">更新于 {dateText(stats.as_of)} · 每 30 秒刷新</span>
          </p>
          <p className="text-muted-foreground text-xs">
            首条记录：{dateText(stats.tracking_since)}。仅统计此功能启用后的请求，不补算历史日志。
            429 比例以收到的 HTTP 响应为分母，不包含未收到响应的网络错误。
          </p>
          {!stats.models.length && (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              该时间范围暂无 HTTP 记录。没有记录不代表没有历史限流；新请求完成后会自动显示。
            </div>
          )}
          {stats.models.map((row) => {
            const profile = profiles.find((p) => p.name === row.profile_name && p.model === row.model);
            return (
              <Card key={`${row.profile_name}:${row.model}`}>
                <CardContent className="grid gap-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{row.model}</h3>
                      <p className="text-muted-foreground text-xs">{row.profile_name || "未命名配置"}</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      本地节流：{profile ? `${profile.rate_per_second || "不限"}/s · ${profile.rate_per_minute || "不限"}/min` : "配置已更改"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div>HTTP 尝试<br /><b>{row.attempts.toLocaleString()}</b></div>
                    <div>429 响应<br /><b>{row.rate_limited.toLocaleString()} ({row.rate_limit_pct.toFixed(1)}%)</b></div>
                    <div>HTTP 错误（含 429）<br /><b>{row.http_errors.toLocaleString()}</b></div>
                    <div>网络错误<br /><b>{row.transport_errors.toLocaleString()}</b></div>
                    <div title="同一次底层模型调用中的第 2 次及以后 HTTP 尝试；不含上层任务重新发起的调用。">SDK 内部重试<br /><b>{row.sdk_retries.toLocaleString()}</b></div>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    最近请求：{dateText(row.last_attempt_at)} · 最近 429：{dateText(row.last_limit_at)}
                  </div>
                  <div className="grid gap-2 border-t pt-3">
                    <p className="text-xs font-medium">最近观察到的网关限额响应头 · {dateText(row.headers_at)}</p>
                    <Headers values={row.rate_headers} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!!stats.recent_limits.length && (
            <Card>
              <CardContent className="grid gap-3 p-4">
                <h3 className="font-medium">最近 429 事件（最多 20 条）</h3>
                {stats.recent_limits.map((event) => (
                  <div key={event.id} className="grid gap-2 border-t pt-3">
                    <p className="text-sm">{dateText(event.ts)} · {event.model} · {event.profile_name}</p>
                    <p className="text-muted-foreground text-xs">
                      任务 {event.task_id || "—"} · {event.worker || "—"} · HTTP 尝试 #{event.attempt}
                    </p>
                    <Headers values={event.rate_headers} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
