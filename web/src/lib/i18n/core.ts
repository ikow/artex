import { chinese, english } from "./catalog";

export const LOCALES = ["en", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

/** An explicit preference wins; otherwise use the first supported browser language. */
export function resolveLocale(saved: unknown, languages: readonly string[] = []): Locale {
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return "zh-CN";
    if (/^en(?:-|$)/i.test(language)) return "en";
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || currentLocale === locale) return;
  currentLocale = locale;
  for (const listener of listeners) listener();
}

export function translate(
  locale: Locale,
  message: string,
  values: readonly unknown[] = [],
  context?: string,
): string {
  const catalog = locale === "zh-CN" ? chinese : english;
  const key = context ? `${context}\u0004${message}` : message;
  const text = Object.hasOwn(catalog, key)
    ? catalog[key]
    : Object.hasOwn(catalog, message) ? catalog[message] : message;
  // A callback, not String.replace's replacement-string overload: user text
  // containing "$&", "$1", braces or markup must remain literal.
  return text.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : placeholder,
  );
}

/** Translate explicit interface messages only, never arbitrary user content. */
export function t(message: string, values: readonly unknown[] = [], context?: string): string {
  return translate(getLocale(), message, values, context);
}
