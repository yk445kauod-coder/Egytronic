export default function Contact() {
  return (
    <>
      <section className="section" id="contact">
    <div className="wrap">
      <div className="cta reveal">
        <canvas className="cta__rain" data-fx="rain" aria-hidden="true" width="320" height="150"></canvas>
        <canvas className="cta__fx" data-fx="confetti" aria-hidden="true"></canvas>
        <div className="cta__inner">
          <span className="px-tag px-tag--mint">Contact</span>
          <h2>Contact us</h2>
          <p>Write to us at the address below and we will get back to you.</p>
          <a className="cta__mail" href="mailto:egytronic.official@googlemail.com">egytronic.official@googlemail.com</a>
          <div className="cta__actions">
            <a className="px-btn" href="/contact/">
              Open the contact portal
              <svg className="icon" aria-hidden="true"><use href="#i-mail"></use></svg>
            </a>
            <a className="px-btn px-btn--ghost" href="mailto:egytronic.official@googlemail.com" data-confetti>
              Send email
              <svg className="icon" aria-hidden="true"><use href="#i-mail"></use></svg>
            </a>
            <button className="px-btn px-btn--ghost" type="button" data-copy-mail="egytronic.official@googlemail.com" data-confetti>
              Copy email
              <svg className="icon" aria-hidden="true"><use href="#i-copy"></use></svg>
            </button>
          </div>
          <span className="footer__note" data-copy-note role="status" aria-live="polite" data-message="Email copied" data-fail="Copy failed. Please copy the email manually."></span>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
