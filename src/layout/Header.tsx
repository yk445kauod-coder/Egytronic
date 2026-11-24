import { useNavToggle } from "./useNavToggle";
import { localePath, switchPath, useLocale } from "../i18n/useLocale";
import { useT } from "../i18n/useT";

const MAIL = "mailto:egytronic.official@googlemail.com";

export default function Header({ path }: { path: string }) {
  const locale = useLocale();
  const t = useT();
  const { open, toggle, close } = useNavToggle();
  const home = path === "/" || path === "/en/";

  const items = [
    { href: "/", label: t("الرئيسية"), active: home },
    { href: "/#capabilities", label: t("الخدمات"), active: false },
    { href: "/pricing/", label: t("الأسعار"), active: path.includes("/pricing/") },
    { href: "/blog/", label: t("المدونة"), active: path.includes("/blog/") },
    { href: "/#how", label: t("المنهجية"), active: false },
    { href: "/#about", label: t("عن الشركة"), active: false },
    { href: "/contact/", label: t("تواصل"), active: path.includes("/contact/") },
  ];

  return (
    <header className="site-nav">
      <div className="wrap">
        <a className="brand" href={localePath(locale, "/")} aria-label={`Egytronic — ${t("الرئيسية")}`}>
          <span className="brand__mark">E</span>
          <span>EGYTRONIC</span>
          <span className="brand__dot" aria-hidden="true" />
        </a>

        <nav aria-label={t("التنقل الرئيسي")}>
          <ul className="nav-links" data-nav-links data-open={String(open)}>
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={localePath(locale, item.href)}
                  className={item.active ? "is-active" : undefined}
                  aria-current={item.active ? "page" : undefined}
                  onClick={close}
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
            data-nav-toggle
            aria-expanded={String(open)}
            aria-label={t("فتح القائمة")}
            data-label-open={t("فتح القائمة")}
            data-label-close={t("إغلاق القائمة")}
            onClick={toggle}
          >
            <svg className="icon" aria-hidden="true"><use href="#i-menu" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
