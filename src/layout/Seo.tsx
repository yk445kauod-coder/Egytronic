import type { Locale } from "../i18n/useLocale";

const BASE = "https://egytronic.pages.dev";
const OG_IMAGE = `${BASE}/assets/img/og-image.png`;

export default function Seo({
  locale,
  path,
  title,
  description,
  ogTitle,
  jsonLd,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  jsonLd?: Record<string, unknown>;
}) {
  const canonical = BASE + path;
  const counterpart = locale === "en"
    ? (path === "/en/" ? "/" : path.slice(3))
    : (path === "/" ? "/en/" : `/en${path}`);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={ogTitle ?? title} />
      <meta property="og:description" content={description} />
      <meta property="og:locale" content={locale === "en" ? "en_US" : "ar_EG"} />
      <meta property="og:locale:alternate" content={locale === "en" ? "ar_EG" : "en_US"} />
      <meta property="og:site_name" content="Egytronic" />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle ?? title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="ar" href={BASE + (locale === "en" ? counterpart : path)} />
      <link rel="alternate" hrefLang="en" href={BASE + (locale === "en" ? path : counterpart)} />
      <link rel="alternate" hrefLang="x-default" href={BASE + (locale === "en" ? counterpart : path)} />
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </>
  );
}
