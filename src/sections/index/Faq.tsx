export default function Faq() {
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
        <details className="faq__item">
          <summary>ماذا أستلم في النهاية؟</summary>
          <div className="faq__a"><p>عملًا جاهزًا للتشغيل حسب الباقة التي اخترتها: لوجو، أو لاندنج بيدج، أو موقعًا، أو هوية كاملة.</p></div>
        </details>
        <details className="faq__item">
          <summary>هل الاستضافة مشمولة؟</summary>
          <div className="faq__a"><p>الاستضافة والباكند مجانًا في السنة الأولى مع كل باقة. الدومين يُشترى منفصلًا أو يُضاف بفاتورة.</p></div>
        </details>
        <details className="faq__item">
          <summary>كيف يتم الدفع؟</summary>
          <div className="faq__a"><p>50% مقدمًا وقت البدء، و50% قبل التسليم النهائي. الأسعار بالجنيه المصري.</p></div>
        </details>
        <details className="faq__item">
          <summary>كم صفحة في الموقع الستاتيك؟</summary>
          <div className="faq__a"><p>حتى 5 صفحات بسعر 8,000 جنيه. أما الموقع الديناميك فيبدأ من 18,000 جنيه.</p></div>
        </details>
      </div>
    </div>
  </section>
    </>
  );
}
