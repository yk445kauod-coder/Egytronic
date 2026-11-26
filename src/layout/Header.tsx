import { sidebar, useSidebarOpen } from "./sidebar-store";
import { localePath, switchPath, useLocale } from "../i18n/useLocale";
import { useT } from "../i18n/useT";

const MAIL = "mailto:egytronic.official@googlemail.com";

export default function Header({ path }: { path: string }) {
  const locale = useLocale();
  const t = useT();
  const open = useSidebarOpen();
  const home = path === "/" || path === "/en/";

  const items = [
    { href: "/", label: t("الرئيسية"), active: home },
    { href: "/#capabilities", label: t("الخدمات"), active: false },
    { href: "/work/", label: t("أعمالنا"), active: path.includes("/work/") },
    { href: "/software/", label: t("البرمجيات"), active: path.includes("/software/") },
    { href: "/pricing/", label: t("الأسعار"), active: path.includes("/pricing/") },
    { href: "/blog/", label: t("المدونة"), active: path.includes("/blog/") },
    { href: "/contact/", label: t("تواصل"), active: path.includes("/contact/") },
  ];

  return (
    <header className="site-nav">
      <div className="wrap">
        <a className="brand" href={localePath(locale, "/")} aria-label={`Egytronic — ${t("الرئيسية")}`}>
          <img className="brand__mark" src="/assets/img/brand-mark.png" alt="" width="44" height="30" />
          <span>EGYTRONIC</span>
          <span className="brand__dot" aria-hidden="true" />
        </a>

        <nav aria-label={t("التنقل الرئيسي")}>
          <ul className="nav-links">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={localePath(locale, item.href)}
                  className={item.active ? "is-active" : undefined}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="nav-ext">
              <a href={home ? localePath(locale, "/pricing/") : MAIL}>{t("احجز باقتك")} ↗</a>
            </li>
          </ul>
        </nav>

        <div className="nav-actions">
          <a
            className="lang"
            href={switchPath(locale, path)}
            hrefLang={locale === "ar" ? "en" : "ar"}
            lang={locale === "ar" ? "en" : "ar"}
            aria-label={t("التبديل إلى النسخة الإنجليزية")}
            title={t("عرض الموقع بالإنجليزية")}
          >
            {locale === "ar" ? "EN" : "AR"}
          </a>
          {home ? (
            <a className="px-btn px-btn--ghost px-btn--sm" href={localePath(locale, "/pricing/")} aria-label={t("انتقل إلى صفحة الأسعار لحجز باقة")}>
              {t("احجز باقتك")}
            </a>
          ) : (
            <a className="px-btn px-btn--ghost px-btn--sm" href={MAIL}>
              <svg className="icon icon--sm" aria-hidden="true"><use href="#i-mail" /></svg>
              {t("اطلب عرضًا")}
            </a>
          )}
          <button
            className="nav-toggle"
            aria-expanded={String(open)}
            aria-controls="site-drawer"
            aria-label={t("فتح القائمة")}
            onClick={() => sidebar.toggle()}
          >
            <svg className="icon" aria-hidden="true"><use href="#i-menu" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
