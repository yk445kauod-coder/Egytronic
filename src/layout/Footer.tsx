import { localePath, useLocale } from "../i18n/useLocale";

const GITHUB = "https://github.com/yk445kauod-coder/Egytronic";
const PROFILE = "https://g.page/r/CZxZjGcYazbKEBM";
const REVIEW = `${PROFILE}/review`;
const PHONE = "+201277593815";
const MAIL = "egytronic.official@googlemail.com";

type Link = { href: string; label: string; external?: boolean };

export default function Footer() {
  const locale = useLocale();
  const en = locale === "en";
  const p = (path: string) => localePath(locale, path);

  const columns: { title: string; links: Link[] }[] = [
    {
      title: en ? "Services" : "الخدمات",
      links: [
        { href: p("/#capabilities"), label: en ? "What we do" : "اللي بنعمله" },
        { href: p("/pricing/"), label: en ? "Packages and prices" : "الباقات والأسعار" },
        { href: p("/software/"), label: en ? "Software" : "البرمجيات" },
        { href: p("/#how"), label: en ? "How we work" : "المنهجية" },
      ],
    },
    {
      title: en ? "Company" : "الشركة",
      links: [
        { href: p("/#about"), label: en ? "About" : "عن الشركة" },
        { href: p("/work/"), label: en ? "Work" : "أعمالنا" },
        { href: p("/blog/"), label: en ? "Journal" : "المدونة" },
        { href: p("/#faq"), label: en ? "Questions" : "الأسئلة" },
      ],
    },
    {
      title: en ? "Contact" : "تواصل",
      links: [
        { href: `tel:${PHONE}`, label: en ? "WhatsApp" : "واتساب" },
        { href: `mailto:${MAIL}`, label: en ? "Email" : "البريد" },
        { href: PROFILE, label: en ? "Google profile" : "بروفايل جوجل", external: true },
        { href: REVIEW, label: en ? "Rate us" : "قيّمنا على جوجل", external: true },
      ],
    },
    {
      title: en ? "Legal" : "قانوني",
      links: [
        { href: p("/privacy/"), label: en ? "Privacy" : "الخصوصية" },
        { href: p("/terms/"), label: en ? "Terms" : "الشروط" },
        { href: GITHUB, label: "GitHub", external: true },
      ],
    },
  ];

  return (
    <footer className="site-footer">
      <div className="wrap footer__top">
        <div className="footer__brand">
          <a className="brand" href={p("/")} aria-label={en ? "Egytronic — home" : "Egytronic — الرئيسية"}>
            <img className="brand__mark" src="/assets/img/brand-mark.png" alt="" width="44" height="30" />
            <span>EGYTRONIC</span>
            <span className="brand__dot" aria-hidden="true" />
          </a>
          <p className="footer__blurb">
            {en
              ? "An Egyptian digital studio: websites, brand identity, business systems and AI — built in clear stages and handed over running."
              : "استوديو رقمي مصري: مواقع، هوية بصرية، أنظمة إدارية، وذكاء اصطناعي — بتُنفَّذ على مراحل وتنزل تشتغل."}
          </p>
        </div>

        <nav className="footer__cols" aria-label={en ? "Site map" : "خريطة الموقع"}>
          {columns.map((column) => (
            <div key={column.title} className="footer__col">
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                      {link.external ? <span aria-hidden="true"> ↗</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="wrap footer__base">
        <p>© {new Date().getFullYear()} Egytronic — {en ? "made in Egypt" : "صُنع في مصر"}</p>
        <p>
          {en ? "Official site:" : "الموقع الرسمي:"} <bdi dir="ltr">egytronic.pages.dev</bdi>
        </p>
      </div>
    </footer>
  );
}
