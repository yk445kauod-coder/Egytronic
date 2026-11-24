export default function Prices() {
  return (
    <>
      <section className="section page-top" id="prices" aria-labelledby="prices-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Public pricing</span>
        <h2 id="prices-title">Five packages, clear prices</h2>
        <p>Pay 50% upfront to start and 50% before final delivery, in Egyptian pounds.</p>
      </div>

      <ol className="pricelist reveal">
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">01</span>
          <div className="pricerow__top">
            <h3>Logo</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">5,000</span><span className="pricerow__cur">EGP</span></p>
          </div>
          <p className="pricerow__desc">A logo for your business, delivered ready to use.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">02</span>
          <div className="pricerow__top">
            <h3>Landing page</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">6,000</span><span className="pricerow__cur">EGP</span></p>
          </div>
          <p className="pricerow__desc">One page that introduces your business and services.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">03</span>
          <div className="pricerow__top">
            <h3>Static site</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">8,000</span><span className="pricerow__cur">EGP</span></p>
          </div>
          <p className="pricerow__desc">An informational site of up to 5 pages.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">04</span>
          <div className="pricerow__top">
            <h3>Full brand identity</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__amount">10,000</span><span className="pricerow__cur">EGP</span></p>
          </div>
          <p className="pricerow__desc">A complete visual identity for your business.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">05</span>
          <div className="pricerow__top">
            <h3>Dynamic site</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__from">Starting at</span><span className="pricerow__amount">18,000</span><span className="pricerow__cur">EGP</span></p>
          </div>
          <p className="pricerow__desc">A site with a backend for changing content and features.</p>
        </li>
      </ol>
    </div>
  </section>
    </>
  );
}
