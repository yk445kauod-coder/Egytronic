import catalog from "../../../data/catalog.json";
import { useLocale } from "../../../i18n/useLocale";

export default function Faq() {
  const locale = useLocale();

  return (
    <>
      <section className="section" id="faq">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">FAQ</span>
        <h2>Questions before booking</h2>
        <p>Answers on delivery, hosting and payment.</p>
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
