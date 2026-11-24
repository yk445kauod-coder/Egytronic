import type { ReactElement } from "react";
import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { bySlug, formatDate, postPath, type Post } from "../data/posts";
import type { Locale } from "../i18n/useLocale";

const BASE = "https://egytronic.pages.dev";

const ui = {
  ar: {
    back: "كل المقالات",
    minutes: "دقائق قراءة",
    cta: "اطّلع على الأسعار",
    ctaNote: "الأسعار معلنة بالجنيه المصري قبل البدء.",
    missing: "هذا المقال غير متوفر.",
  },
  en: {
    back: "All posts",
    minutes: "min read",
    cta: "See prices",
    ctaNote: "Prices are published in Egyptian pounds before work starts.",
    missing: "This post is not available.",
  },
} as const;

function renderBlocks(blocks: string[]) {
  const out: ReactElement[] = [];
  let list: string[] = [];

  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-4 grid gap-2 ps-6">
        {list.map((item, i) => (
          <li key={i} className="list-disc text-[16.5px] leading-8 text-muted">
            {item}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  blocks.forEach((block, i) => {
    if (block.startsWith("- ")) {
      list.push(block.slice(2));
      return;
    }
    flush();
    if (block.startsWith("## ")) {
      out.push(
        <h2 key={i} className="mt-10 mb-3 font-display text-3xl leading-snug text-text">
          {block.slice(3)}
        </h2>
      );
      return;
    }
    out.push(
      <p key={i} className="my-4 text-[16.5px] leading-8 text-muted">
        {block}
      </p>
    );
  });
  flush();
  return out;
}

export default function PostPage({ locale, post }: { locale: Locale; post: Post }) {
  const path = postPath(locale, post.slug);
  const uiCopy = ui[locale];

  const branded = `${post.title[locale]} | Egytronic`;
  const seoTitle = branded.length <= 70 ? branded : post.title[locale];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${BASE}${path}#article`,
    mainEntityOfPage: `${BASE}${path}`,
    headline: post.title[locale],
    description: post.excerpt[locale],
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: locale === "ar" ? "ar" : "en",
    articleSection: post.tag[locale],
    wordCount: post.body[locale].join(" ").split(/\s+/).length,
    author: { "@id": `${BASE}/#founder` },
    publisher: { "@id": `${BASE}/#organization` },
    image: `${BASE}/assets/img/og-image.png`,
    isAccessibleForFree: true,
  };

  return (
    <Layout locale={locale} path={path}>
      <Seo
        locale={locale}
        path={path}
        title={seoTitle}
        description={post.excerpt[locale]}
        jsonLd={jsonLd}
      />
      <main id="main">
        <article className="section">
          <div className="wrap max-w-[74ch]">
            <a href={locale === "en" ? "/en/blog/" : "/blog/"} className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
              ← {uiCopy.back}
            </a>
            <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <span className="text-gold">{post.tag[locale]}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={post.date}>{formatDate(post.date, locale)}</time>
              <span aria-hidden="true">·</span>
              <span>
                {post.read} {uiCopy.minutes}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight text-text md:text-4xl">{post.title[locale]}</h1>
            <p className="mt-4 border-s-2 border-gold/70 ps-4 text-[17px] leading-8 text-surface/90">{post.excerpt[locale]}</p>
            <div className="mt-8">{renderBlocks(post.body[locale])}</div>

            <aside className="mt-12 border border-line/70 bg-panel/50 p-5">
              <p className="text-[15px] leading-7 text-muted">{uiCopy.ctaNote}</p>
              <a className="mt-4 inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-gold" href={locale === "en" ? "/en/pricing/" : "/pricing/"}>
                {uiCopy.cta} ↗
              </a>
            </aside>
          </div>
        </article>
      </main>
    </Layout>
  );
}

export function postOrDefault(locale: Locale, slug: string) {
  const post = bySlug(slug);
  if (!post) throw new Error(`Unknown post: ${slug}`);
  return <PostPage locale={locale} post={post} />;
}
