import { POSTS, postPath } from "../../data/posts";
import { useLocale } from "../../i18n/useLocale";

export default function Journal() {
  const locale = useLocale();
  const latest = [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <>
      <section className="section section--alt" id="journal" aria-labelledby="journal-title">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="px-tag">المدونة</span>
            <h2 id="journal-title">التحول الرقمي والذكاء الاصطناعي</h2>
            <p>مقالات من عمل فعلي: القرار، التكلفة، والخطوة التالية.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {latest.map((post) => (
              <li key={post.slug}>
                <a
                  href={postPath(locale, post.slug)}
                  className="group flex h-full flex-col gap-3 border border-line/70 bg-panel/40 p-5 transition-colors duration-150 hover:border-gold/60 hover:bg-panel"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{post.tag[locale]}</span>
                  <span className="font-display text-xl leading-snug text-text">{post.title[locale]}</span>
                  <span className="mt-auto font-mono text-[11px] tracking-[0.08em] text-muted">
                    {post.read} دقائق قراءة ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
