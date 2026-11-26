import { PROJECTS } from "../../../data/projects";

export default function Block0() {
  return (
    <>
      <section className="hero">
    <canvas className="hero__fx" data-fx="aurora" data-parallax="0.16" aria-hidden="true"></canvas>
    <div className="hero__glow" data-parallax="0.08" aria-hidden="true"></div>
    <img className="hero__skyline" src="/assets/img/pixel/skyline.svg" alt="" aria-hidden="true" decoding="async" />

    <div className="wrap hero__inner">
      <div className="hero__copy">
        <span className="px-tag">Egyptian software studio · public pricing</span>
        <h1>
          <span className="line">Software delivered ready</span>
          <span className="line"><em>at a published price</em></span>
        </h1>
        <p className="hero__sub">
          Websites, brand identity, business systems and AI, in five packages from EGP 5,000. Each has a fixed scope and a delivery date. Hosting and backend are free in year one.
        </p>
        <div className="hero__actions">
          <a className="px-btn" href="/en/pricing/">Book your package</a>
          <a className="px-btn px-btn--ghost" href="#contact">Send your project brief</a>
        </div>
        <p className="hero__proof">
          <span>Live right now:</span>
          {PROJECTS.map((project) => (
            <a key={project.slug} href={project.url} target="_blank" rel="noopener noreferrer">
              {project.en.name}
            </a>
          ))}
          <a className="hero__proof-more" href="/en/work/">See the work ↗</a>
        </p>
        <div className="hero__stats">
          <div className="stat"><span className="stat__n">5,000</span><span className="stat__l">lowest package · EGP</span></div>
          <div className="stat"><span className="stat__n">50%</span><span className="stat__l">upfront payment</span></div>
          <div className="stat"><span className="stat__n">Year 1</span><span className="stat__l">hosting + backend</span></div>
          <div className="stat"><span className="stat__n"><bdi>AR / EN</bdi></span><span className="stat__l">Arabic and English</span></div>
        </div>
      </div>

      <div className="hero__term">
        <div className="px-window">
          <div className="px-window__bar">
            <span>egytronic://prices</span>
            <span className="px-window__dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
          <div className="px-window__body">
<pre><span className="tl"><span className="c-dim">EGYTRONIC::/PACKAGES</span></span><span className="tl"><span className="c-mint">01</span>  logo            <span className="c-gold">5,000</span></span><span className="tl"><span className="c-mint">02</span>  landing page    <span className="c-gold">6,000</span></span><span className="tl"><span className="c-mint">03</span>  static site     <span className="c-gold">8,000</span>   <span className="c-dim">&lt;= 5 pages</span></span><span className="tl"><span className="c-mint">04</span>  full identity  <span className="c-gold">10,000</span></span><span className="tl"><span className="c-mint">05</span>  dynamic site    <span className="c-gold">18,000+</span></span><span className="tl"> </span><span className="tl"><span className="c-dim">deposit 50% · hosting free (year 1)</span> <span className="caret"></span></span></pre>
          </div>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
