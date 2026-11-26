export default function Software() {
  return (
    <>
      <section className="section page-top" id="software" aria-labelledby="software-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Software</span>
        <h1 id="software-title">What we build in software</h1>
        <p>Websites, systems and tools built in stages and handed over running; some of them published for everyone.</p>
      </div>

      <ol className="pricelist reveal">
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">01</span>
          <div className="pricerow__top">
            <h3>Websites</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">WEB</span></p>
          </div>
          <p className="pricerow__desc">A landing page, a static site of up to 5 pages, or a dynamic site with a backend.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">02</span>
          <div className="pricerow__top">
            <h3>Smart systems</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">SYSTEMS</span></p>
          </div>
          <p className="pricerow__desc">Business systems and AI shaped around your work, and built to grow with it.</p>
        </li>
        <li className="pricerow">
          <span className="pricerow__n" aria-hidden="true">03</span>
          <div className="pricerow__top">
            <h3>Open tools</h3>
            <span className="pricerow__dots" aria-hidden="true"></span>
            <p className="pricerow__price"><span className="pricerow__cur">OPEN</span></p>
          </div>
          <p className="pricerow__desc">We publish some of our tools on GitHub for anyone to use and review.</p>
        </li>
      </ol>
    </div>
  </section>
    </>
  );
}
