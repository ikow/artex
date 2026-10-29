"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { getClientCookie } from "@/lib/cookie.client";
import { persistPreference } from "@/lib/preferences/preferences-storage";

import {
  DEFAULT_LOCALE,
  getLocale,
  isLocale,
  resolveLocale,
  setLocale,
  subscribeLocale,
  translate,
  type Locale,
} from "./core";
import { LocalizedMetadata } from "./metadata";

const serverLocale = () => DEFAULT_LOCALE;

export function useUILocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, serverLocale);
}

/** An explicit interface label, also usable in otherwise locale-neutral primitives. */
export function UIMessage({ message, values }: { message: string; values?: readonly unknown[] }) {
  const locale = useUILocale();
  return <>{translate(locale, message, values)}</>;
}

export async function chooseLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;
  setLocale(value);
  document.documentElement.lang = value;
  await persistPreference("locale", value);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useUILocale();

  useEffect(() => {
    let saved: string | undefined;
    try {
      saved = getClientCookie("locale");
    } catch {
      // Storage can be unavailable in privacy-restricted browsers. Initial
      // language detection still works without changing authentication cookies.
    }
    const initial = resolveLocale(saved, navigator.languages ?? [navigator.language]);
    setLocale(initial);
    document.documentElement.lang = initial;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // No locale key or page reload: drafts, dialogs and ongoing subscriptions stay
  // mounted when the language changes. Static export hydrates in English first.
  return (
    <>
      <LocalizedMetadata locale={locale} />
      {children}
    </>
  );
}
