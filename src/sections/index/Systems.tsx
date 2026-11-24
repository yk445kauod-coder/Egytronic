export default function Systems() {
  return (
    <>
      <section className="section section--systems" id="systems" aria-labelledby="systems-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">أنظمة إدارية</span>
        <h2 id="systems-title">خلّي شغلك كله يشتغل على نظام واحد</h2>
        <p>بنختار معاك النظام المناسب لنشاطك، بنسطّبه عندك، ونكيّفه على طريقة عملك: الصلاحيات، التقارير، الفواتير، والمصطلحات اللي فريقك بيفهمها — ومعاه تدريب لفريقك لحد ما يشتغل عليه بثقة.</p>
      </div>

      <ul className="systems reveal">
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-erp.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">ERP</span>
          <h3>إدارة موارد</h3>
          <p>مخزون وفواتير ومشتريات وحسابات في نظام واحد.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-crm.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">CRM</span>
          <h3>علاقات عملاء</h3>
          <p>عملاء ومتابعات وصفقات وتقارير مبيعات.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-pos.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">POS</span>
          <h3>نقاط بيع</h3>
          <p>كاشير وورديات ومخزون لكل فرع.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-hotel.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">HMS</span>
          <h3>إدارة فنادق</h3>
          <p>حجوزات وغرف وإقامة وفواتير ومحاسبة نزلاء.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-lms.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">LMS</span>
          <h3>منصة تعليم</h3>
          <p>كورسات ودروس واختبارات وشهادات.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-hms.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">CLINIC</span>
          <h3>إدارة عيادات</h3>
          <p>مواعيد وملفات مرضى وفواتير وروشتات.</p>
        </li>
      </ul>

      <ul className="systems__how reveal">
        <li><b>تسطيب</b> بياناتك ومستخدميك الحاليين</li>
        <li><b>تكييف</b> الصلاحيات والفواتير والتقارير والمصطلحات</li>
        <li><b>تدريب</b> فريقك وتسليم دليل التشغيل</li>
      </ul>

      <p className="systems__note reveal">مش لاقي احتياجك؟ <a href="/contact/">اطلب نظام مخصص</a> ونحدد النطاق معاك.</p>
    </div>
  </section>
    </>
  );
}
