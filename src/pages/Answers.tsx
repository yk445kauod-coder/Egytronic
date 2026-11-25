import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import type { Locale } from "../i18n/useLocale";
import { ANSWERS } from "../data/answers";

export default function Answers({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/answers/" : "/answers/";
  const en = locale === "en";
  return (
    <Layout locale={locale} path={path} cta={{ href: "/contact/", label: en ? "Contact" : "تواصل" }}>
      <Seo
        locale={locale}
        path={path}
        title={en ? "Egytronic answers: prices, delivery, code ownership" : "أسئلة شائعة عن Egytronic | الأسعار والتسليم والملكية"}
        description={en
          ? "Straight answers about Egytronic: what a site costs in Egypt, static versus dynamic, hosting, who owns the code, delivery times."
          : "إجابات مباشرة عن Egytronic: تكلفة الموقع في مصر، الفرق بين الستاتيك والديناميك، الاستضافة، ملكية الكود، ومدد التسليم."}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: ANSWERS.map((item) => ({
            "@type": "Question",
            name: en ? item.en_q : item.q,
            acceptedAnswer: { "@type": "Answer", text: en ? item.en_a : item.a },
          })),
        }}
      />
      <main id="main" className="answers">
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h1>{en ? "Straight answers" : "إجابات مباشرة"}</h1>
              <p>
                {en
                  ? "The questions clients ask before buying, answered with the numbers we publish. Prices are fixed; the scope of each package is written down."
                  : "الأسئلة التي تُطرح قبل الشراء، بإجابات فيها الأرقام المعلنة. الأسعار ثابتة، ونطاق كل باقة مكتوب."}
              </p>
            </div>
            <dl className="answers__list">
              {ANSWERS.map((item) => (
                <div key={item.q} className="answers__item">
                  <dt>{en ? item.en_q : item.q}</dt>
                  <dd>{en ? item.en_a : item.a}</dd>
                </div>
              ))}
            </dl>
            <p className="answers__foot">
              <a href={en ? "/en/pricing/" : "/pricing/"}>{en ? "See the packages" : "شوف الباقات"}</a>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
