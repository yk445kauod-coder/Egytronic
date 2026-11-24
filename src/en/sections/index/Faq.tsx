export default function Faq() {
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
        <details className="faq__item">
          <summary>What do I get at the end?</summary>
          <div className="faq__a"><p>Work that is ready to run, according to the package you chose: a logo, landing page, website or full identity.</p></div>
        </details>
        <details className="faq__item">
          <summary>Is hosting included?</summary>
          <div className="faq__a"><p>Hosting and backend are free in the first year with every package. The domain is bought separately or added by invoice.</p></div>
        </details>
        <details className="faq__item">
          <summary>How does payment work?</summary>
          <div className="faq__a"><p>50% upfront when we start and 50% before final delivery. Prices are in Egyptian pounds.</p></div>
        </details>
        <details className="faq__item">
          <summary>How many pages in the static site?</summary>
          <div className="faq__a"><p>Up to 5 pages for EGP 8,000. The dynamic site starts from EGP 18,000.</p></div>
        </details>
      </div>
    </div>
  </section>
    </>
  );
}
