export default function Prices() {
  return (
    <>
      <section className="section page-top" id="prices" aria-labelledby="prices-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">الأسعار المعلنة</span>
        <h2 id="prices-title">خمس باقات بأسعار واضحة</h2>
        <p>الدفع 50% مقدمًا عند البدء و50% قبل التسليم النهائي، بالجنيه المصري.</p>
      </div>

      <ol className="pricelist reveal">
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">01</span>
          <div className="pricerow__top">
            <h3>لوجو</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">5,000</span><span className="pricerow__cur">جنيه</span></p>
          </div>
          <p className="pricerow__desc">شعار لمشروعك يُسلَّم جاهزًا للاستخدام.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">02</span>
          <div className="pricerow__top">
            <h3>لاندنج بيدج</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">6,000</span><span className="pricerow__cur">جنيه</span></p>
          </div>
          <p className="pricerow__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">03</span>
          <div className="pricerow__top">
            <h3>موقع ستاتيك</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">8,000</span><span className="pricerow__cur">جنيه</span></p>
          </div>
          <p className="pricerow__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">04</span>
          <div className="pricerow__top">
            <h3>هوية كاملة</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">10,000</span><span className="pricerow__cur">جنيه</span></p>
          </div>
          <p className="pricerow__desc">هوية بصرية متكاملة لمشروعك.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">05</span>
          <div className="pricerow__top">
            <h3>موقع ديناميك</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__from">ابتداءً من</span><span className="pricerow__amount">18,000</span><span className="pricerow__cur">جنيه</span></p>
          </div>
          <p className="pricerow__desc">موقع بباكند يناسب المحتوى والوظائف المتغيرة.</p>
        </li>
      </ol>
    </div>
  </section>
    </>
  );
}
