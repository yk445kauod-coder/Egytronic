import { useContext, createContext } from "react";

export type Locale = "ar" | "en";
export const LocaleContext = createContext<Locale>("ar");
export const useLocale = () => useContext(LocaleContext);

export function localePath(locale: Locale, path: string) {
  const clean = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return locale === "en" ? (clean === "/" ? "/en/" : `/en${clean}`) : clean;
}

export function switchPath(locale: Locale, path: string) {
  return locale === "en" ? (path === "/en/" ? "/" : path.slice(3) || "/") : localePath("en", path);
}
