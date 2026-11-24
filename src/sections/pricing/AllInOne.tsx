export default function AllInOne() {
  return (
    <>
      <section className="section section--alt" id="all-in-one" aria-labelledby="bundle-title">
    <div className="wrap">
      <div className="bundle reveal">
        <div className="bundle__head">
          <span className="bundle__badge">ALL-IN-ONE</span>
          <h3 id="bundle-title">التحول الرقمي الكامل</h3>
        </div>
        <p className="bundle__lead">من 28,000 جنيه. للمشاريع الأكبر، ونحدد النطاق معك بعد التواصل.</p>

        <ul className="bundle__list">
          <li>جلسة تشخيص وتقرير بالأولويات</li>
          <li>هوية كاملة (لوجو وألوان وخطوط)</li>
          <li>موقع ديناميك بباكند وقاعدة بيانات</li>
          <li>Google Business وحسابات سوشيال جاهزة</li>
          <li>تدريب على الاستخدام</li>
          <li>شهر متابعة بعد التسليم</li>
        </ul>

        <div className="bundle__foot">
          <p className="bundle__price">
            <span className="pricerow__from">ابتداءً من</span>
            <strong>28,000</strong>
            <span>جنيه</span>
          </p>
          <a className="px-btn" href="mailto:egytronic.official@googlemail.com">
            احجز باقتك
            <svg className="icon" aria-hidden="true"><use href="#i-mail"></use></svg>
          </a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
