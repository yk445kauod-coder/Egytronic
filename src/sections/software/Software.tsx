export default function Software() {
  return (
    <>
      <section className="section page-top" id="software" aria-labelledby="software-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">البرمجيات</span>
        <h1 id="software-title">ما نبنيه من برمجيات</h1>
        <p>مواقع وأنظمة وأدوات بنبنيها على مراحل وبتنزل تشتغل عند العميل، وننشر بعضها للجميع.</p>
      </div>

      <ol className="pricelist reveal">
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">01</span>
          <div className="pricerow__top">
            <h3>مواقع</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">WEB</span></p>
          </div>
          <p className="pricerow__desc">لاندنج بيدج، أو موقع ستاتيك حتى 5 صفحات، أو موقع ديناميك بباكند.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">02</span>
          <div className="pricerow__top">
            <h3>أنظمة ذكية</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">SYSTEMS</span></p>
          </div>
          <p className="pricerow__desc">أنظمة إدارية وذكاء اصطناعي بيتفصّلوا على شغلك ويوسّعوه مع الوقت.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">03</span>
          <div className="pricerow__top">
            <h3>أدوات مفتوحة</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">OPEN</span></p>
          </div>
          <p className="pricerow__desc">ننشر بعض أدواتنا علنًا على GitHub، ويمكن لأي شخص استخدامها ومراجعتها.</p>
        </li>
      </ol>
    </div>
  </section>
    </>
  );
}
