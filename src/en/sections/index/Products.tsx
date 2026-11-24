export default function Products() {
  return (
    <>
      <section className="section section--products" id="products" aria-labelledby="products-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Packages and prices</span>
        <h2 id="products-title">Five packages, public prices</h2>
        <p>Fixed scope, a published price and a delivery date agreed before we start. Payment in two instalments.</p>
      </div>

      <ul className="prods reveal">
        <li className="prod">
          <span className="prod__n">01</span>
          <img className="prod__art" src="/assets/img/pixel/g-logo.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>Logo</h3>
          <p className="prod__desc">A logo that distinguishes your business, ready for print and digital.</p>
          <p className="prod__who"><span>For whom</span> A project just starting</p>
          <ul className="prod__inc">
            <li>A primary logo in two versions</li>
            <li>Files ready for print and social</li>
            <li>Delivered in 3–5 days</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">5,000</span> <span className="prod__cur">EGP</span></p>
          <a className="prod__link" href="/contact/">Book this package</a>
        </li>
        <li className="prod prod--pick">
          <span className="prod__flag">Best place to start</span>
          <span className="prod__n">02</span>
          <img className="prod__art" src="/assets/img/pixel/g-landing.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>Landing page</h3>
          <p className="prod__desc">One page that introduces your business and services.</p>
          <p className="prod__who"><span>For whom</span> One service or one product</p>
          <ul className="prod__inc">
            <li>One page with structured content</li>
            <li>Contact form and WhatsApp button</li>
            <li>Delivered in 5–7 days</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">6,000</span> <span className="prod__cur">EGP</span></p>
          <a className="prod__link" href="/contact/">Book this package</a>
        </li>
        <li className="prod">
          <span className="prod__n">03</span>
          <img className="prod__art" src="/assets/img/pixel/g-static.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>Static site</h3>
          <p className="prod__desc">An informational site of up to 5 pages.</p>
          <p className="prod__who"><span>For whom</span> A company with services and pages</p>
          <ul className="prod__inc">
            <li>Up to 5 pages</li>
            <li>Basic SEO and fast loading</li>
            <li>Delivered in 7–10 days</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">8,000</span> <span className="prod__cur">EGP</span></p>
          <a className="prod__link" href="/contact/">Book this package</a>
        </li>
        <li className="prod">
          <span className="prod__n">04</span>
          <img className="prod__art" src="/assets/img/pixel/g-identity.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>Full brand identity</h3>
          <p className="prod__desc">A full identity: logo, colours, type and a usage guide.</p>
          <p className="prod__who"><span>For whom</span> A growing brand that needs applications</p>
          <ul className="prod__inc">
            <li>Logo, colours and type</li>
            <li>Business cards and social media</li>
            <li>A short usage guide</li>
          </ul>
          <p className="prod__price"><span className="prod__amt">10,000</span> <span className="prod__cur">EGP</span></p>
          <a className="prod__link" href="/contact/">Book this package</a>
        </li>
        <li className="prod prod--from">
          <span className="prod__n">05</span>
          <img className="prod__art" src="/assets/img/pixel/g-dynamic.svg" alt="" width="44" height="44" loading="lazy" decoding="async" />
          <h3>Dynamic site</h3>
          <p className="prod__desc">A site with a backend for changing content and features.</p>
          <p className="prod__who"><span>For whom</span> Content that changes weekly</p>
          <ul className="prod__inc">
            <li>Backend and admin panel</li>
            <li>A database and content you manage yourself</li>
            <li>Delivered in 3–4 weeks</li>
          </ul>
          <p className="prod__price"><span className="prod__cur">from</span> <span className="prod__amt">18,000</span> <span className="prod__cur">EGP</span></p>
          <a className="prod__link" href="/contact/">Discuss your project</a>
        </li>
      </ul>

      <ul className="prods__why reveal">
        <li>
          <b>The price is on the table</b>
          <span>Five packages with their numbers, and no price renegotiation after we agree.</span>
        </li>
        <li>
          <b>Hosting free for a year</b>
          <span>Hosting and backend are on us in the first year with every package.</span>
        </li>
        <li>
          <b>You pay in two steps</b>
          <span>50% when we start and 50% before delivery. You do not pay it all before you see anything.</span>
        </li>
      </ul>

      <div className="prods__foot reveal">
        <a className="px-btn" href="/pricing/">Details and booking</a>
        <p className="prods__note">Full digital transformation from EGP 28,000 · hosting and backend free in the first year · domain separate or by invoice</p>
      </div>
    </div>
  </section>
    </>
  );
}
