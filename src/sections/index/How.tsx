export default function How() {
  return (
    <>
      <section className="section" id="how">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">المنهجية</span>
        <h2>أربع مراحل حتى التسليم</h2>
        <p>لكل مرحلة مخرج واضح قبل أن تبدأ التي بعدها.</p>
      </div>

      <div className="pipeline">
        <div className="pipeline__stage reveal">
          <canvas data-pipeline aria-hidden="true"></canvas>
          <div className="pipeline__hud">
            <span>PIPELINE</span>
            <span><b>●</b> RUNNING</span>
          </div>
        </div>

        <ol className="steps reveal">
          <li>
            <div>
              <h3>التصميم</h3>
              <p>نحدد المطلوب وحدود العمل والقيود، ثم نصمم الواجهات والتدفقات قبل كتابة أي كود.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>البناء</h3>
              <p>ننفذ المخطط المتفق عليه جزءًا جزءًا.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>المراجعة</h3>
              <p>نفحص كل مخرج من ناحية الأمان والبنية قبل النشر.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>الإطلاق</h3>
              <p>ننشر العمل ونسلّمه لك جاهزًا للتشغيل.</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
    </>
  );
}
