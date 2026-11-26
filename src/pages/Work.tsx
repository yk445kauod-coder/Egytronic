import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import type { Locale } from "../i18n/useLocale";
import { PROJECTS } from "../data/projects";

export default function Work({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const path = en ? "/en/work/" : "/work/";

  return (
    <Layout
      locale={locale}
      path={path}
      cta={{ href: "/contact/", label: en ? "Contact" : "تواصل" }}
    >
      <Seo
        locale={locale}
        path={path}
        title={
          en
            ? "Egytronic work: sites we built and run"
            : "أعمال Egytronic | مواقع بُنيت وتعمل"
        }
        description={
          en
            ? "Three live sites built by Egytronic: Panda Wok restaurant ordering, Azura Cafe, and a chef's personal site. Every link opens the real thing."
            : "ثلاثة مواقع حية من بناء Egytronic: Panda Wok للمطاعم، Azura Cafe، وموقع شيف شخصي. كل رابط يفتح الموقع الحقيقي."
        }
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: PROJECTS.map((project, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: project.url,
            name: en ? project.en.name : project.ar.name,
          })),
        }}
      />
      <main id="main" className="work">
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h1>
                {en ? "Work that is running right now" : "أعمال تعمل الآن"}
              </h1>
              <p>
                {en
                  ? "Not mockups: three live sites. Open each one — the link is the proof."
                  : "مش موك أبات: ثلاثة مواقع حية. افتح أي واحد — الرابط هو الإثبات."}
              </p>
            </div>
            <ul className="work__list">
              {PROJECTS.map((project, index) => {
                const item = en ? project.en : project.ar;
                return (
                  <li key={project.slug} className="work__item">
                    <span className="work__n" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <p className="work__kind">{item.kind}</p>
                    <h2 className="work__name">{item.name}</h2>
                    <p className="work__what">{item.what}</p>
                    <div className="work__meta">
                      <a className="work__open" href={project.url} target="_blank" rel="noopener noreferrer">
                        {en ? "Open the site" : "افتح الموقع"} <span aria-hidden="true">↗</span>
                      </a>
                      <bdi dir="ltr" className="work__url">{project.url.replace("https://", "")}</bdi>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="work__foot">
              <a href={en ? "/en/contact/" : "/contact/"}>
                {en ? "Start a project" : "ابدأ مشروعك"}
              </a>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
