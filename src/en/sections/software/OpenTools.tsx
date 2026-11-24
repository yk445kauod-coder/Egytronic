export default function OpenTools() {
  return (
    <>
      <section className="section section--alt" id="open-tools" aria-labelledby="open-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Open tools</span>
        <h2 id="open-title">Egytronic 16-bit</h2>
        <p>A language model published with open weights; the model card is public.</p>
      </div>

      <div className="bundle reveal">
        <div className="bundle__head">
          <span className="bundle__badge">OPAR WEIGHTS</span>
          <h3>A model built on Llama 3.1 8B</h3>
        </div>
        <p className="bundle__lead">131,072-token context, GGUF weights, LLaMA Community license. You do not need it to order any package; use follows the license.</p>

        <ul className="bundle__list">
          <li>Base: Llama 3.1 8B · 8.03B parameters</li>
          <li>Context: 131,072 tokens</li>
          <li>Format: GGUF</li>
          <li>License: LLaMA Community</li>
        </ul>

        <div className="bundle__foot">
          <a className="px-btn" href="https://huggingface.co/YousefKhamis/Egytronic_1.0" target="_blank" rel="noopener">
            Model card
            <svg className="icon" aria-hidden="true"><use href="#i-external-link"></use></svg>
          </a>
          <a className="px-btn px-btn--ghost" href="https://github.com/yk445kauod-coder/Egytronic" target="_blank" rel="noopener">
            GitHub
            <svg className="icon" aria-hidden="true"><use href="#i-github"></use></svg>
          </a>
        </div>
      </div>
    </div>
  </section>
    </>
  );
}
