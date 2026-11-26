export default function Transform() {
  return (
    <>
      <section className="section section--transform" id="transform" aria-labelledby="transform-title">
    <div className="wrap">
      <div className="transform">
        <div className="transform__head reveal">
          <span className="px-tag px-tag--mint">Digital transformation</span>
          <h2 id="transform-title">From notebooks and spreadsheets to a system that runs itself</h2>
          <p>We change how the work itself runs: your data moved out of the files, permissions per role, and live reports instead of notebooks.</p>
        </div>

        <ol className="transform__steps reveal">
          <li>
            <span className="transform__n">01</span>
            <h3>One set of data</h3>
            <p>Instead of scattered files, everything lives in one database.</p>
          </li>
          <li>
            <span className="transform__n">02</span>
            <h3>Live reports</h3>
            <p>Sales, stock and collections without asking anyone.</p>
          </li>
          <li>
            <span className="transform__n">03</span>
            <h3>Permissions per role</h3>
            <p>Every employee sees only what concerns them.</p>
          </li>
          <li>
            <span className="transform__n">04</span>
            <h3>Integrations and automation</h3>
            <p>Payments, stock and WhatsApp talk to each other.</p>
          </li>
        </ol>

        <div className="transform__band reveal">
          <p className="transform__price"><span>Full transformation</span> priced after the scope is agreed</p>
          <p className="transform__note">After a first call we settle the scope and the details, then put the price in the offer. Pay 50% to start and 50% before delivery.</p>
          <a className="px-btn" href="/en/contact/">Request a project assessment</a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
