export default function Products() {
  return (
    <>
      <section className="section section--products" id="products" aria-labelledby="products-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">الباقات والأسعار</span>
        <h2 id="products-title">خمس باقات بأسعار معلنة</h2>
        <p>نطاق محدد وسعر معلن وموعد تسليم مكتوب قبل البدء، والدفع على مرحلتين.</p>
      </div>

      <ul className="prods reveal">
        <li className="prod">
          <span className="prod__n">01</span>
          <img className="prod__art" src="/assets/img/pixel/g-logo.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>لوجو</h3>
          <p className="prod__desc">شعار يميّز مشروعك، ويصلح للطباعة والاستخدام الرقمي.</p>
          <p className="prod__who"><span>مناسب لـ</span> مشروع في بدايته</p>
          <ul className="prod__inc">
            <li>لوجو أساسي بنسختين</li>
            <li>ملفات جاهزة للطباعة ووسائل التواصل</li>
            <li>تسليم في 3–5 أيام</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">5,000</span> <span className="prod__cur">جنيه</span></p>
          <a className="prod__link" href="/contact/">احجز الباقة</a>
        </li>
        <li className="prod prod--pick">
          <span className="prod__flag">الأنسب للبدء</span>
          <span className="prod__n">02</span>
          <img className="prod__art" src="/assets/img/pixel/g-landing.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>لاندنج بيدج</h3>
          <p className="prod__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>
          <p className="prod__who"><span>مناسب لـ</span> خدمة واحدة أو منتج واحد</p>
          <ul className="prod__inc">
            <li>صفحة واحدة بمحتوى منظم</li>
            <li>نموذج تواصل وزر واتساب</li>
            <li>تسليم في 5–7 أيام</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">6,000</span> <span className="prod__cur">جنيه</span></p>
          <a className="prod__link" href="/contact/">احجز الباقة</a>
        </li>
        <li className="prod">
          <span className="prod__n">03</span>
          <img className="prod__art" src="/assets/img/pixel/g-static.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>موقع ستاتيك</h3>
          <p className="prod__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>
          <p className="prod__who"><span>مناسب لـ</span> شركة لديها خدمات وصفحات</p>
          <ul className="prod__inc">
            <li>حتى 5 صفحات</li>
            <li>تهيئة أساسية لمحركات البحث وسرعة تحميل</li>
            <li>تسليم في 7–10 أيام</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">8,000</span> <span className="prod__cur">جنيه</span></p>
          <a className="prod__link" href="/contact/">احجز الباقة</a>
        </li>
        <li className="prod">
          <span className="prod__n">04</span>
          <img className="prod__art" src="/assets/img/pixel/g-identity.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>هوية كاملة</h3>
          <p className="prod__desc">هوية كاملة: شعار وألوان وخطوط ودليل استخدام.</p>
          <p className="prod__who"><span>مناسب لـ</span> علامة تتوسّع وتحتاج تطبيقات</p>
          <ul className="prod__inc">
            <li>لوجو وألوان وخطوط</li>
            <li>بطاقات أعمال وتصاميم لوسائل التواصل</li>
            <li>دليل استخدام مختصر</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">10,000</span> <span className="prod__cur">جنيه</span></p>
          <a className="prod__link" href="/contact/">احجز الباقة</a>
        </li>
        <li className="prod prod--from">
          <span className="prod__n">05</span>
          <img className="prod__art" src="/assets/img/pixel/g-dynamic.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>موقع ديناميك</h3>
          <p className="prod__desc">موقع بباكند يناسب المحتوى والوظائف المتغيرة.</p>
          <p className="prod__who"><span>مناسب لـ</span> محتوى يتغيّر أسبوعيًا</p>
          <ul className="prod__inc">
            <li>باكند ولوحة تحكم</li>
            <li>قاعدة بيانات ومحتوى تديره بنفسك</li>
            <li>تسليم في 3–4 أسابيع</li>
          </ul>
          <p className="prod__price"><span className="prod__cur">من</span> <span className="prod__amt">18,000</span> <span className="prod__cur">جنيه</span></p>
          <a className="prod__link" href="/contact/">ناقش مشروعك</a>
        </li>
      </ul>

      <ul className="prods__why reveal">
        <li>
          <b>السعر معلن قبل البدء</b>
          <span>خمس باقات بأرقامها المعلنة، بلا تفاوض على السعر بعد الاتفاق.</span>
        </li>
        <li>
          <b>استضافة مجانًا سنة</b>
          <span>الاستضافة والباكند على حسابنا في السنة الأولى مع كل باقة.</span>
        </li>
        <li>
          <b>الدفع على مرحلتين</b>
          <span>50% عند البدء و50% قبل التسليم. لا تُدفع كامل القيمة قبل رؤية العمل.</span>
        </li>
      </ul>

      <div className="prods__foot reveal">
        <a className="px-btn" href="/pricing/">التفاصيل وحجز الباقة</a>
        <p className="prods__note">التحول الرقمي الكامل سعره يتحدد بعد الاتفاق على التفاصيل · استضافة وباكند مجانًا في السنة الأولى · الدومين منفصل أو بفاتورة</p>
      </div>
    </div>
  </section>
    </>
  );
}
