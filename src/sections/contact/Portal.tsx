export default function Portal() {
  return (
    <>
      <section className="section page-top portal" id="portal" aria-labelledby="portal-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">بوابة التواصل</span>
        <h2 id="portal-title">قولنا على مشروعك</h2>
        <p>اختار الباقة اللي تهمك، وسيب وسيلة تواصل. بنرد عليك في أقرب وقت.</p>
      </div>

      <div className="portal__grid">
        <form className="portal__form reveal" id="contact-form" data-contact-form noValidate data-msg-invalid="راجع الحقول الناقصة: الاسم، بريد صحيح، ورسالة 10 أحرف على الأقل." data-msg-sending="جاري الإرسال…" data-msg-ok="وصلتنا رسالتك. هنرد عليك على وسيلة التواصل اللي كتبتها." data-msg-rate="وصلتنا رسايل كتير من نفس الجهاز. استنى شوية وحاول تاني." data-msg-down="الإرسال مش متاح دلوقتي." data-msg-offline="مفيش اتصال بالشبكة." data-msg-button="إرسال الطلب">
          <div className="field">
            <label htmlFor="cf-name">الاسم</label>
            <input id="cf-name" name="name" type="text" autoComplete="name" required minLength="2" maxLength="80" placeholder="اسمك أو اسم المشروع" />
          </div>

          <div className="field">
            <label htmlFor="cf-email">البريد الإلكتروني</label>
            <input id="cf-email" name="email" type="email" autoComplete="email" inputmode="email" required maxLength="120" placeholder="name@example.com" dir="ltr" />
          </div>

          <div className="field">
            <label htmlFor="cf-phone">واتساب أو موبايل <span className="field__opt">(اختياري)</span></label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" inputmode="tel" maxLength="32" placeholder="01xxxxxxxxx" dir="ltr" />
          </div>

          <div className="field">
            <label htmlFor="cf-package">الباقة</label>
            <select id="cf-package" name="package">
              <option value="unsure">مش محدد لسه</option>
              <option value="logo">لوجو — 5,000 جنيه</option>
              <option value="landing">لاندنج بيدج — 6,000 جنيه</option>
              <option value="static">موقع ستاتيك — 8,000 جنيه</option>
              <option value="identity">هوية كاملة — 10,000 جنيه</option>
              <option value="dynamic">موقع ديناميك — من 18,000 جنيه</option>
              <option value="transform">تحول كامل — من 28,000 جنيه</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="cf-message">الرسالة</label>
            <textarea id="cf-message" name="message" rows="5" required minLength="10" maxLength="2000" placeholder="إيه المشروع؟ وإيه أهم حاجة محتاجها؟"></textarea>
          </div>

          <div className="field field--trap" aria-hidden="true">
            <label htmlFor="cf-website">موقعك</label>
            <input id="cf-website" name="website" type="text" tabIndex="-1" autoComplete="off" />
          </div>

          <div className="portal__actions">
            <button className="px-btn" type="submit" data-submit>إرسال الطلب</button>
            <a className="portal__mail" href="mailto:egytronic.official@googlemail.com">أو راسلنا على البريد</a>
          </div>

          <div className="portal__done">
            <img className="portal__ok" data-ok-art src="/assets/img/pixel/g-check.svg" alt="" width="52" height="52" hidden />
            <p className="portal__status" data-status role="status" aria-live="polite"></p>
          </div>
          <p className="portal__fallback" data-fallback hidden>
            تعذّر إرسال الطلب. راسلنا على
            <button type="button" className="linkish" data-copy-mail="egytronic.official@googlemail.com" data-message="تم نسخ البريد" data-fail="تعذّر النسخ. انسخ البريد يدويًا.">نسخ البريد</button>
          </p>
        </form>

        <aside className="portal__side reveal">
          <div className="portal__card">
            <h3>إيه اللي بيحصل بعد الإرسال</h3>
            <ol className="portal__steps">
              <li><span>01</span> بنقرأ الطلب والباقة المختارة.</li>
              <li><span>02</span> بنرد عليك على البريد أو الواتساب اللي كتبته.</li>
              <li><span>03</span> لو مناسب، بنحدد النطاق ونبدأ.</li>
            </ol>
          </div>

          <div className="portal__card portal__card--quiet">
            <h3>السعر معلن مقدمًا</h3>
            <p>كل باقة بسعرها المكتوب، والدفع 50% عند البدء و50% قبل التسليم.</p>
            <a className="px-btn px-btn--ghost px-btn--sm" href="/pricing/">شوف الأسعار</a>
          </div>
        </aside>
      </div>
    </div>
  </section>
    </>
  );
}
