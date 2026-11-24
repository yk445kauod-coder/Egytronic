import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { POSTS, formatDate, postPath } from "../data/posts";
import type { Locale } from "../i18n/useLocale";

const BASE = "https://egytronic.pages.dev";

const copy = {
  ar: {
    title: "المدونة | التحول الرقمي وأنظمة الذكاء الاصطناعي",
    description:
      "مقالات عملية عن التحول الرقمي والذكاء الاصطناعي وأنظمة إدارة الأعمال: تكلفة، ترتيب خطوات، وأسئلة تُطرح قبل الشراء.",
    tag: "المدونة",
    h1: "التحول الرقمي والذكاء الاصطناعي، بلا حشو",
    lede:
      "مقالات مبنية على عمل فعلي: كيف تبدأ، ما يكلّف، وما لا يستحق الدفع. تُحدَّث مع كل مشروع نسلّمه.",
    minutes: "دقائق قراءة",
    all: "كل المقالات",
    cta: "اقرأ المقال",
  },
  en: {
    title: "Journal | Digital transformation and AI systems",
    description:
      "Practical writing on digital transformation, AI systems and business software: what it costs, what order to do it in, and what to ask before buying.",
    tag: "Journal",
    h1: "Digital transformation and AI, without the padding",
    lede:
      "Notes written from real delivery work: where to start, what it costs, and what is not worth paying for.",
    minutes: "min read",
    all: "All posts",
    cta: "Read",
  },
} as const;

export default function Blog({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const path = locale === "en" ? "/en/blog/" : "/blog/";
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${BASE}${path}#blog`,
    url: `${BASE}${path}`,
    name: c.title,
    description: c.description,
    inLanguage: locale === "ar" ? "ar" : "en",
    publisher: { "@id": `${BASE}/#organization` },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title[locale],
      url: `${BASE}${postPath(locale, p.slug)}`,
      datePublished: p.date,
      description: p.excerpt[locale],
    })),
  };

  return (
    <Layout locale={locale} path={path}>
      <Seo locale={locale} path={path} title={c.title} description={c.description} jsonLd={jsonLd} />
      <main id="main">
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="px-tag">{c.tag}</span>
              <h1 className="font-display text-4xl leading-tight text-text md:text-5xl">{c.h1}</h1>
              <p>{c.lede}</p>
            </div>

            <ul className="grid gap-3 md:grid-cols-2">
              {posts.map((post) => (
                <li key={post.slug}>
                  <a
                    href={postPath(locale, post.slug)}
                    className="group flex h-full flex-col gap-3 border border-line/70 bg-panel/50 p-5 transition-colors duration-150 hover:border-gold/60 hover:bg-panel"
                  >
                    <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                      <span>{post.tag[locale]}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={post.date}>{formatDate(post.date, locale)}</time>
                    </span>
                    <span className="font-display text-2xl leading-snug text-text">{post.title[locale]}</span>
                    <span className="text-[15px] leading-7 text-muted">{post.excerpt[locale]}</span>
                    <span className="mt-auto font-mono text-[11px] tracking-[0.08em] text-gold">
                      {post.read} {c.minutes} ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </Layout>
  );
}
