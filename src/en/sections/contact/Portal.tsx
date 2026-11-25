export default function Portal() {
  return (
    <>
      <section className="section page-top portal" id="portal" aria-labelledby="portal-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Contact portal</span>
        <h1 id="portal-title">Tell us about your project</h1>
        <p>Choose the package that suits you, leave a way to reach you, and we will reply shortly.</p>
      </div>

      <div className="portal__grid">
        <form className="portal__form reveal" id="contact-form" data-contact-form noValidate data-msg-invalid="Check the missing fields: a name, a valid email and a message of at least 10 characters." data-msg-sending="Sending…" data-msg-ok="We received your message and will reply using the contact details you left." data-msg-rate="Too many messages from this device. Wait a little and try again." data-msg-down="Sending is unavailable right now." data-msg-offline="No network connection." data-msg-button="Send the request">
          <div className="field">
            <label htmlFor="cf-name">Name</label>
            <input id="cf-name" name="name" type="text" autoComplete="name" required minLength="2" maxLength="80" placeholder="Your name or business" />
          </div>

          <div className="field">
            <label htmlFor="cf-email">Email</label>
            <input id="cf-email" name="email" type="email" autoComplete="email" inputmode="email" required maxLength="120" placeholder="name@example.com" dir="ltr" />
          </div>

          <div className="field">
            <label htmlFor="cf-phone">WhatsApp or mobile <span className="field__opt">(optional)</span></label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" inputmode="tel" maxLength="32" placeholder="01xxxxxxxxx" dir="ltr" />
          </div>

          <div className="field">
            <label htmlFor="cf-package">Package</label>
            <select id="cf-package" name="package">
              <option value="unsure">Not sure yet</option>
              <option value="logo">Logo — EGP 5,000</option>
              <option value="landing">Landing page — EGP 6,000</option>
              <option value="static">Static site — EGP 8,000</option>
              <option value="identity">Full identity — EGP 10,000</option>
              <option value="dynamic">Dynamic site — from EGP 18,000</option>
              <option value="transform">Full transformation — priced by agreement</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="cf-message">Message</label>
            <textarea id="cf-message" name="message" rows="5" required minLength="10" maxLength="2000" placeholder="What is the project, and what matters most to you?"></textarea>
          </div>

          <div className="field field--trap" aria-hidden="true">
            <label htmlFor="cf-website">Your website</label>
            <input id="cf-website" name="website" type="text" tabIndex="-1" autoComplete="off" />
          </div>

          <div className="portal__actions">
            <button className="px-btn" type="submit" data-submit>Send the request</button>
            <a className="portal__mail" href="mailto:egytronic.official@googlemail.com">Or email us directly</a>
          </div>

          <div className="portal__done">
            <img className="portal__ok" data-ok-art src="/assets/img/pixel/g-check.svg" alt="" width="52" height="52" hidden />
            <p className="portal__status" data-status role="status" aria-live="polite"></p>
          </div>
          <p className="portal__fallback" data-fallback hidden>
            Sending failed. Write to us at
            <button type="button" className="linkish" data-copy-mail="egytronic.official@googlemail.com" data-message="Email copied" data-fail="Copy failed. Please copy the email manually.">Copy email</button>
          </p>
        </form>

        <aside className="portal__side reveal">
          <div className="portal__card">
            <h3>What happens after you send</h3>
            <ol className="portal__steps">
              <li><span>01</span> We read the request and the package you picked.</li>
              <li><span>02</span> We reply on the email or WhatsApp you left.</li>
              <li><span>03</span> If it fits, we agree the scope and start.</li>
            </ol>
          </div>

          <div className="portal__card portal__card--quiet">
            <h3>The price is public up front</h3>
            <p>Every package has its printed price: 50% to start and 50% before delivery.</p>
            <a className="px-btn px-btn--ghost px-btn--sm" href="/pricing/">See prices</a>
          </div>
        </aside>
      </div>
    </div>
  </section>
    </>
  );
}
