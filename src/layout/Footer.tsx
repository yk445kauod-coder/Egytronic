import { localePath, useLocale } from "../i18n/useLocale";
import { useT } from "../i18n/useT";

export default function Footer() {
  const locale = useLocale();
  const t = useT();
  const p = (path: string) => localePath(locale, path);

  return (
    <footer className="site-footer">
      <div className="wrap footer__grid">
        <a className="brand" href={p("/")} aria-label={`Egytronic — ${t("الرئيسية")}`}>
          <span className="brand__mark">E</span>
          <span>EGYTRONIC</span>
          <span className="brand__dot" aria-hidden="true" />
        </a>

        <ul className="footer__links">
          <li><a href={`${p("/")}#faq`}>{t("الأسئلة")}</a></li>
          <li><a href={p("/privacy/")}>{t("الخصوصية")}</a></li>
          <li><a href={p("/terms/")}>{t("الشروط")}</a></li>
          <li><a href={p("/work/")}>{t("أعمالنا")}</a></li>
          <li><a href={p("/pricing/")}>{t("الأسعار")}</a></li>
          <li><a href={p("/blog/")}>{t("المدونة")}</a></li>
          <li><a href={p("/software/")}>{t("البرمجيات")}</a></li>
          <li>
            <a href="https://github.com/yk445kauod-coder/Egytronic" target="_blank" rel="noopener">
              <svg className="icon icon--sm" aria-hidden="true"><use href="#i-github" /></svg>
              GitHub
            </a>
          </li>
          <li>
            <a href="tel:+201277593815">
              {t("واتساب")} <bdi dir="ltr">+20 127 759 3815</bdi>
            </a>
          </li>
          <li>
            <a href="mailto:egytronic.official@googlemail.com">
              <svg className="icon icon--sm" aria-hidden="true"><use href="#i-mail" /></svg>
              {t("البريد الإلكتروني")}
            </a>
          </li>
        </ul>

        <p className="footer__note">{t("صُنع في مصر")} — <bdi>Egytronic</bdi></p>
      </div>
    </footer>
  );
}
