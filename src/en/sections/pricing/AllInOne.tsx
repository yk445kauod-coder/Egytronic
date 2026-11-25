export default function AllInOne() {
  return (
    <>
      <section className="section section--alt" id="all-in-one" aria-labelledby="bundle-title">
    <div className="wrap">
      <div className="bundle reveal">
        <div className="bundle__head">
          <span className="bundle__badge">ALL-IN-ONE</span>
          <h3 id="bundle-title">End-to-end digital transformation</h3>
        </div>
        <p className="bundle__lead">Its price is set after the scope is agreed: we settle the scope with you first, then write the price into the offer before any work starts.</p>

        <ul className="bundle__list">
          <li>Diagnostic session and a prioritised report</li>
          <li>Full brand identity (logo, colours, type)</li>
          <li>Dynamic site with backend and database</li>
          <li>Google Business profile and social accounts set up</li>
          <li>Training on how to use it</li>
          <li>One month of follow-up after delivery</li>
        </ul>

        <div className="bundle__foot">
          <p className="bundle__price bundle__price--quote">
            <span className="pricerow__from">Price</span>
            <strong>set after the scope is agreed</strong>
          </p>
          <a className="px-btn" href="mailto:egytronic.official@googlemail.com">
            Book a package
            <svg className="icon" aria-hidden="true"><use href="#i-mail"></use></svg>
          </a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
