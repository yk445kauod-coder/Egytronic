export default function About() {
  return (
    <>
      <section className="section section--alt" id="about">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">عن الشركة</span>
        <h2>من يبني مشروعك</h2>
        <p>شركة برمجيات مصرية يعمل عليها المؤسس مباشرة، من تحديد حدود العمل حتى التشغيل.</p>
      </div>

      <div className="founder reveal">
        <div className="founder__plate" aria-hidden="true">
          <svg className="icon" aria-hidden="true"><use href="#i-user"></use></svg>
          <span>FOUNDER</span>
        </div>
        <div>
          <div className="founder__role">المؤسس</div>
          <h3>يوسف خميس</h3>
          <p>يتولى رؤية المنتج ومعمارية الأنظمة والإطلاق.</p>
          <a className="founder__link" href="/software/">
            البرمجيات
            <svg className="icon icon--sm" aria-hidden="true"><use href="#i-external-link"></use></svg>
          </a>
        </div>
      </div>

      <div className="principles reveal">
        <div className="principle">
          <span className="principle__k">01 / DELIVERY</span>
          <h3>تسليم جاهز</h3>
          <p>لا نعدّ العمل منتهيًا قبل تشغيله لديك.</p>
        </div>
        <div className="principle">
          <span className="principle__k">02 / PRICING</span>
          <h3>أسعار معلنة</h3>
          <p>ترى سعر كل باقة قبل أن تتواصل معنا.</p>
        </div>
        <div className="principle">
          <span className="principle__k">03 / OPEN</span>
          <h3>أدوات مفتوحة</h3>
          <p>ننشر بعض أدواتنا على GitHub، متاحة للاستخدام والمراجعة.</p>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
