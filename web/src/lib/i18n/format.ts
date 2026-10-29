import { getLocale } from "./core";

/** Local time, preserving the backend's Unix-seconds timestamp convention. */
export function formatUnixTimestamp(unix?: number, compact = false): string {
  if (!unix || unix <= 0 || !Number.isFinite(unix)) return "—";
  const date = new Date(unix * 1000);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    getLocale(),
    compact
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { dateStyle: "medium", timeStyle: "medium" },
  ).format(date);
}
