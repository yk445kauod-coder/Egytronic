export default function OpenTools() {
  return (
    <>
      <section className="section section--alt" id="open-tools" aria-labelledby="open-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">أدوات مفتوحة</span>
        <h2 id="open-title">Egytronic 16-bit</h2>
        <p>نموذج لغوي منشور بأوزان مفتوحة، بطاقة النموذج متاحة للجميع.</p>
      </div>

      <div className="bundle reveal">
        <div className="bundle__head">
          <span className="bundle__badge">OPEN WEIGHTS</span>
          <h3>نموذج مبني على Llama 3.1 8B</h3>
        </div>
        <p className="bundle__lead">سياق 131,072 توكن، أوزان GGUF، ورخصة LLaMA Community. لا تحتاجه لطلب أي باقة، والاستخدام وفق الرخصة.</p>

        <ul className="bundle__list">
          <li>الأساس: Llama 3.1 8B · 8.03B معامل</li>
          <li>السياق: 131,072 توكن</li>
          <li>الصيغة: GGUF</li>
          <li>الرخصة: LLaMA Community</li>
        </ul>

        <div className="bundle__foot">
          <a className="px-btn" href="https://huggingface.co/YousefKhamis/Egytronic_1.0" target="_blank" rel="noopener">
            بطاقة النموذج
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
