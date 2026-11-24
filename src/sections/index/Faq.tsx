import catalog from "../../data/catalog.json";
import { useLocale } from "../../i18n/useLocale";

export default function Faq() {
  const locale = useLocale();

  return (
    <>
      <section className="section" id="faq">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">الأسئلة</span>
        <h2>أسئلة قبل الحجز</h2>
        <p>إجابات عن التسليم والاستضافة والدفع.</p>
      </div>
      <div className="faq reveal">
        {catalog.faq.map((item) => (
          <details className="faq__item" key={item.id}>
            <summary>{item[locale].q}</summary>
            <div className="faq__a"><p>{item[locale].a}</p></div>
          </details>
        ))}
      </div>
    </div>
  </section>
    </>
  );
}
