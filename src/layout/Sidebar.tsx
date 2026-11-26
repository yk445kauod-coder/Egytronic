import { useEffect, useRef } from "react";
import { localePath, switchPath, useLocale } from "../i18n/useLocale";
import { sidebar, useSidebarOpen } from "./sidebar-store";

const PROFILE = "https://g.page/r/CZxZjGcYazbKEBM";
const REVIEW = `${PROFILE}/review`;
const PHONE = "+201277593815";
const MAIL = "egytronic.official@googlemail.com";
const GITHUB = "https://github.com/yk445kauod-coder/Egytronic";

type Item = { href: string; label: string; external?: boolean };

export default function Sidebar({ path }: { path: string }) {
  const locale = useLocale();
  const en = locale === "en";
  const open = useSidebarOpen();
  const panel = useRef<HTMLElement>(null);
  const p = (href: string) => localePath(locale, href);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") sidebar.close();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: en ? "Start here" : "ابدأ من هنا",
      items: [
        { href: p("/pricing/"), label: en ? "Packages and prices" : "الباقات والأسعار" },
        { href: p("/#capabilities"), label: en ? "What we do" : "اللي بنعمله" },
        { href: p("/#how"), label: en ? "How we work" : "المنهجية" },
        { href: p("/#faq"), label: en ? "Questions" : "الأسئلة الشائعة" },
      ],
    },
    {
      title: en ? "See the work" : "شوف الشغل",
      items: [
        { href: p("/work/"), label: en ? "Live sites" : "مواقع شغّالة" },
        { href: p("/software/"), label: en ? "Software and tools" : "البرمجيات والأدوات" },
        { href: p("/blog/"), label: en ? "Journal" : "المدونة" },
        { href: p("/#about"), label: en ? "About Egytronic" : "عن Egytronic" },
      ],
    },
    {
      title: en ? "Talk to us" : "كلّمنا",
      items: [
        { href: p("/contact/"), label: en ? "Contact page" : "صفحة التواصل" },
        { href: `tel:${PHONE}`, label: en ? "WhatsApp" : "واتساب" },
        { href: `mailto:${MAIL}`, label: en ? "Email" : "البريد" },
        { href: REVIEW, label: en ? "Rate us on Google" : "قيّمنا على جوجل", external: true },
        { href: PROFILE, label: en ? "Google profile" : "بروفايل جوجل", external: true },
      ],
    },
    {
      title: en ? "More" : "أكتر",
      items: [
        { href: GITHUB, label: "GitHub", external: true },
        { href: p("/privacy/"), label: en ? "Privacy" : "الخصوصية" },
        { href: p("/terms/"), label: en ? "Terms" : "الشروط" },
      ],
    },
  ];

  return (
    <div className="drawer" id="site-drawer" data-open={String(open)} aria-hidden={String(!open)}>
      <button className="drawer__scrim" tabIndex={-1} aria-label={en ? "Close menu" : "إغلاق القائمة"} onClick={() => sidebar.close()} />
      <aside
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={en ? "Site menu" : "قائمة الموقع"}
        tabIndex={-1}
        ref={panel}
      >
        <div className="drawer__head">
          <span className="drawer__title">{en ? "Everything" : "كل حاجة"}</span>
          <button className="drawer__close" onClick={() => sidebar.close()} aria-label={en ? "Close menu" : "إغلاق القائمة"}>
            <svg className="icon" aria-hidden="true"><use href="#i-close" /></svg>
          </button>
        </div>

        <a className="px-btn drawer__cta" href={p("/pricing/")} onClick={() => sidebar.close()}>
          {en ? "Book a package" : "احجز باقتك"} ↗
        </a>

        <nav className="drawer__nav">
          {groups.map((group) => (
            <div key={group.title} className="drawer__group">
              <h2>{group.title}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href + item.label}>
                    <a
                      href={item.href}
                      onClick={() => sidebar.close()}
                      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {item.label}
                      {item.external ? <span aria-hidden="true"> ↗</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="drawer__foot">
          <a className="lang" href={switchPath(locale, path)} hrefLang={en ? "ar" : "en"} lang={en ? "ar" : "en"}>
            {en ? "AR" : "EN"}
          </a>
          <span className="drawer__note">
            {en ? "Official site: " : "الموقع الرسمي: "}
            <bdi dir="ltr">egytronic.pages.dev</bdi>
          </span>
        </div>
      </aside>
    </div>
  );
}
