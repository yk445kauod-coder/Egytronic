export default function About() {
  return (
    <>
      <section className="section section--alt" id="about">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Company</span>
        <h2>Who builds your project</h2>
        <p>An Egyptian software company where the founder works directly, from scope to launch.</p>
      </div>

      <div className="founder reveal">
        <div className="founder__plate" aria-hidden="true">
          <svg className="icon" aria-hidden="true"><use href="#i-user"></use></svg>
          <span>FOUNDER</span>
        </div>
        <div>
          <div className="founder__role">Founder</div>
          <h3>Yousef Khamis</h3>
          <p>Leads product vision, system architecture and launch.</p>
          <a className="founder__link" href="/en/software/">
            Software
            <svg className="icon icon--sm" aria-hidden="true"><use href="#i-external-link"></use></svg>
          </a>
        </div>
      </div>

      <div className="principles reveal">
        <div className="principle">
          <span className="principle__k">01 / DELIVERY</span>
          <h3>Ready on delivery</h3>
          <p>We don't count work as done until it runs for you.</p>
        </div>
        <div className="principle">
          <span className="principle__k">02 / PRICING</span>
          <h3>Public prices</h3>
          <p>You see each package's price before you contact us.</p>
        </div>
        <div className="principle">
          <span className="principle__k">03 / OPEN</span>
          <h3>Open tools</h3>
          <p>We publish some of our tools on GitHub, open to use and review.</p>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
