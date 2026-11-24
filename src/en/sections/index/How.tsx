export default function How() {
  return (
    <>
      <section className="section" id="how">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Process</span>
        <h2>Four stages to delivery</h2>
        <p>Each stage has a clear output before the next begins.</p>
      </div>

      <div className="pipeline">
        <div className="pipeline__stage reveal">
          <canvas data-pipeline aria-hidden="true"></canvas>
          <div className="pipeline__hud">
            <span>PIPELINE</span>
            <span><b>●</b> RUNNING</span>
          </div>
        </div>

        <ol className="steps reveal">
          <li>
            <div>
              <h3>Design</h3>
              <p>We set the goal, scope and limits before writing any code.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>Build</h3>
              <p>We build the agreed plan, one part at a time.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>Review</h3>
              <p>We check every output for security and structure before release.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>Launch</h3>
              <p>We publish the work and hand it over ready to run.</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
    </>
  );
}
