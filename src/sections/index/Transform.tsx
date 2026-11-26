export default function Transform() {
  return (
    <>
      <section className="section section--transform" id="transform" aria-labelledby="transform-title">
    <div className="wrap">
      <div className="transform">
        <div className="transform__head reveal">
          <span className="px-tag px-tag--mint">التحول الرقمي</span>
          <h2 id="transform-title">من الدفاتر وملفات إكسل إلى نظام متكامل</h2>
          <p>نغيّر طريقة العمل نفسها: ترحيل بياناتك من الملفات، وصلاحيات لكل دور، وتقارير لحظية بدل الدفاتر.</p>
        </div>

        <ol className="transform__steps reveal">
          <li>
            <span className="transform__n">01</span>
            <h3>بيانات واحدة</h3>
            <p>بدل الملفات المتفرقة، تجتمع البيانات في قاعدة واحدة.</p>
          </li>
          <li>
            <span className="transform__n">02</span>
            <h3>تقارير لحظية</h3>
            <p>المبيعات والمخزون والتحصيل في تقرير واحد، دون سؤال أحد.</p>
          </li>
          <li>
            <span className="transform__n">03</span>
            <h3>صلاحيات لكل دور</h3>
            <p>كل موظف يرى ما يخصه فقط.</p>
          </li>
          <li>
            <span className="transform__n">04</span>
            <h3>ربط وأتمتة</h3>
            <p>الدفع والمخزون والواتساب مترابطة في تدفق واحد.</p>
          </li>
        </ol>

        <div className="transform__band reveal">
          <p className="transform__price"><span>التحول الكامل</span> سعره يتحدد بعد الاتفاق</p>
          <p className="transform__note">بعد أول مكالمة نحدد حدود العمل والتفاصيل، وبعدها بنكتب السعر في العرض. الدفع 50% عند البدء و50% بعد التسليم.</p>
          <a className="px-btn" href="/contact/">اطلب تقييم لمشروعك</a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
