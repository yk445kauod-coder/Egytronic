import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import type { Locale } from "../i18n/useLocale";
import { PRIVACY, TERMS } from "../data/legal";

export type LegalKind = "terms" | "privacy";

export default function Legal({
  locale,
  kind,
}: {
  locale: Locale;
  kind: LegalKind;
}) {
  const en = locale === "en";
  const doc = (kind === "terms" ? TERMS : PRIVACY)[en ? "en" : "ar"];
  const path = `${en ? "/en" : ""}/${kind}/`;

  return (
    <Layout
      locale={locale}
      path={path}
      cta={{ href: "/contact/", label: en ? "Contact" : "تواصل" }}
    >
      <Seo
        locale={locale}
        path={path}
        title={`${doc.title} | Egytronic`}
        description={doc.intro.slice(0, 150)}
      />
      <main id="main" className="legal">
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h1>{doc.title}</h1>
              <p>{doc.intro}</p>
              <p className="legal__updated">
                {en ? "Last updated:" : "آخر تحديث:"} {doc.updated}
              </p>
            </div>
            {doc.blocks.map((block) => (
              <section key={block.h} className="legal__block">
                <h2>{block.h}</h2>
                {block.p.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
            <p className="legal__foot">
              <a href={en ? "/en/terms/" : "/terms/"}>
                {en ? "Terms" : "الشروط والأحكام"}
              </a>
              {" · "}
              <a href={en ? "/en/privacy/" : "/privacy/"}>
                {en ? "Privacy" : "سياسة الخصوصية"}
              </a>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
