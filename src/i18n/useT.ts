import { useCallback } from "react";
import dict from "./copy.json";
import { useLocale } from "./useLocale";

const map = dict as Record<string, string>;

/** Chrome strings (nav, labels) translate at render time; page copy is pre-generated. */
export function useT() {
  const locale = useLocale();
  return useCallback((text: string) => (locale === "ar" ? text : map[text] ?? text), [locale]);
}

export const tr = (text: string) => text;
