export default function Transform() {
  return (
    <>
      <section className="section section--transform" id="transform" aria-labelledby="transform-title">
    <div className="wrap">
      <div className="transform">
        <div className="transform__head reveal">
          <span className="px-tag px-tag--mint">التحول الرقمي</span>
          <h2 id="transform-title">من دفاتر وإكسل لنظام بيشتغل لوحده</h2>
          <p>بنحوّل طريقة الشغل نفسها: ترحيل بياناتك من الملفات، صلاحيات لكل دور، وتقارير لحظية بدل الدفاتر.</p>
        </div>

        <ol className="transform__steps reveal">
          <li>
            <span className="transform__n">01</span>
            <h3>بيانات واحدة</h3>
            <p>بدل ملفات متفرقة، كل حاجة في قاعدة بيانات واحدة.</p>
          </li>
          <li>
            <span className="transform__n">02</span>
            <h3>تقارير لحظية</h3>
            <p>المبيعات والمخزون والتحصيل من غير ما تسأل حد.</p>
          </li>
          <li>
            <span className="transform__n">03</span>
            <h3>صلاحيات لكل دور</h3>
            <p>كل موظف بيشوف اللي يخصه بس.</p>
          </li>
          <li>
            <span className="transform__n">04</span>
            <h3>ربط وأتمتة</h3>
            <p>الدفع والمخزون والواتساب بيتكلموا مع بعض.</p>
          </li>
        </ol>

        <div className="transform__band reveal">
          <p className="transform__price"><span>التحول الكامل</span> من <b>28,000</b> جنيه</p>
          <p className="transform__note">بعد أول مكالمة بنحدد النطاق: ترحيل البيانات، التكييف، والتدريب. الدفع 50% عند البدء و50% قبل التسليم.</p>
          <a className="px-btn" href="/contact/">اطلب تقييم لمشروعك</a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
