import { Head } from "vite-react-ssg";
import type { Locale } from "../i18n/useLocale";
import catalog from "../data/catalog.json";
import { buildGraph } from "./Schema";

const BASE = catalog.site;
const OG_IMAGE = `${BASE}/assets/img/og-image.png`;

export default function Seo({
  locale,
  path,
  title,
  description,
  ogTitle,
  jsonLd,
  pageType,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  pageType?: "website" | "article";
}) {
  const canonical = BASE + path;
  const counterpart = locale === "en"
    ? (path === "/en/" ? "/" : path.slice(3))
    : (path === "/" ? "/en/" : `/en${path}`);

  const isPost = path.startsWith("/blog/") || path.startsWith("/en/blog/");
  const graph = buildGraph({
    locale,
    path,
    title,
    description,
    pageType: isPost ? "Article" : "WebPage",
    extra: jsonLd ?? null,
  });

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
      <meta name="theme-color" content="#161616" />
      <meta property="og:type" content={pageType ?? "website"} />
      <meta property="og:title" content={ogTitle ?? title} />
      <meta property="og:description" content={description} />
      <meta property="og:locale" content={locale === "en" ? "en_US" : "ar_EG"} />
      <meta property="og:locale:alternate" content={locale === "en" ? "ar_EG" : "en_US"} />
      <meta property="og:site_name" content="Egytronic" />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogTitle ?? title} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle ?? title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="ar" href={BASE + (locale === "en" ? counterpart : path)} />
      <link rel="alternate" hrefLang="en" href={BASE + (locale === "en" ? path : counterpart)} />
      <link rel="alternate" hrefLang="x-default" href={BASE + (locale === "en" ? counterpart : path)} />
      <link rel="alternate" type="application/rss+xml" title="Egytronic blog feed" href={`${BASE}/feed.xml`} />
      <link rel="alternate" type="application/json" href={`${BASE}/pricing.json`} title="Egytronic package catalogue (JSON)" />
      <link rel="alternate" type="text/plain" href={`${BASE}/llms.txt`} title="Egytronic site guide for AI systems" />
      <script type="application/ld+json">{JSON.stringify(graph)}</script>
    </Head>
  );
}
