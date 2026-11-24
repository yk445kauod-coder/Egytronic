import { localePath, useLocale } from "../i18n/useLocale";
import { useT } from "../i18n/useT";

export default function TabBar({ path }: { path: string }) {
  const locale = useLocale();
  const t = useT();
  const p = (href: string) => localePath(locale, href);
  const is = (part: string) => path.includes(part);

  return (
    <nav className="tabbar" aria-label={t("تنقل سريع")}>
      <a href={p("/")} aria-current={path === "/" || path === "/en/" ? "page" : undefined}>
        <svg className="icon" aria-hidden="true"><use href="#i-home" /></svg><span>{t("الرئيسية")}</span>
      </a>
      <a href={`${p("/")}#capabilities`}>
        <svg className="icon" aria-hidden="true"><use href="#i-grid" /></svg><span>{t("الخدمات")}</span>
      </a>
      <a href={p("/pricing/")} aria-current={is("/pricing/") ? "page" : undefined}>
        <svg className="icon" aria-hidden="true"><use href="#i-tag" /></svg><span>{t("الأسعار")}</span>
      </a>
      <a href={p("/contact/")} aria-current={is("/contact/") ? "page" : undefined}>
        <svg className="icon" aria-hidden="true"><use href="#i-mail" /></svg><span>{t("تواصل")}</span>
      </a>
    </nav>
  );
}
