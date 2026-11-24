import catalog from "../data/catalog.json";
import type { Locale } from "../i18n/useLocale";

export const BASE = catalog.site;

const lang = (locale: Locale) => (locale === "ar" ? "ar" : "en");

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: catalog.brand,
    alternateName: "Egytronic Software",
    url: `${BASE}/`,
    logo: {
      "@type": "ImageObject",
      "@id": `${BASE}/#logo`,
      url: `${BASE}/assets/img/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: { "@id": `${BASE}/#logo` },
    email: catalog.email,
    description: catalog.facts.en,
    founder: { "@id": `${BASE}/#founder` },
    sameAs: [catalog.founder.github],
    knowsLanguage: ["ar", "en"],
    areaServed: { "@type": "Country", name: "Egypt" },
    currenciesAccepted: catalog.currency,
    paymentAccepted: "Bank transfer, cash",
    priceRange: "EGP 5,000 - EGP 28,000",
  };
}

export function founderNode() {
  return {
    "@type": "Person",
    "@id": `${BASE}/#founder`,
    name: catalog.founder.ar,
    alternateName: catalog.founder.en,
    jobTitle: { ar: "مؤسس Egytronic", en: "Founder of Egytronic" },
    worksFor: { "@id": `${BASE}/#organization` },
    sameAs: [catalog.founder.github],
    knowsLanguage: ["ar", "en"],
  };
}

export function websiteNode(locale: Locale) {
  return {
    "@type": "WebSite",
    "@id": `${BASE}/#website`,
    url: `${BASE}/`,
    name: catalog.brand,
    inLanguage: lang(locale),
    publisher: { "@id": `${BASE}/#organization` },
  };
}

function serviceOffer(node: (typeof catalog.packages)[number], locale: Locale) {
  const t = node[locale];
  return {
    "@type": "Offer",
    name: t.name,
    description: `${t.summary} ${node.delivery[locale]}`,
    priceCurrency: catalog.currency,
    ...(node.priceFrom
      ? { priceSpecification: { "@type": "PriceSpecification", minPrice: node.price, priceCurrency: catalog.currency } }
      : { price: node.price }),
    availability: "https://schema.org/InStock",
    itemOffered: {
      "@type": "Service",
      name: t.name,
      serviceType: t.name,
      description: t.summary,
      provider: { "@id": `${BASE}/#organization` },
      areaServed: { "@type": "Country", name: "Egypt" },
    },
  };
}

export function offerCatalogNode(locale: Locale) {
  const bundle = catalog.bundle;
  return {
    "@type": "OfferCatalog",
    "@id": `${BASE}/#packages`,
    name: { ar: "باقات Egytronic", en: "Egytronic packages" },
    itemListElement: [
      ...catalog.packages.map((pkg) => serviceOffer(pkg, locale)),
      {
        "@type": "Offer",
        name: bundle[locale].name,
        description: bundle[locale].summary,
        priceCurrency: catalog.currency,
        priceSpecification: { "@type": "PriceSpecification", minPrice: bundle.price, priceCurrency: catalog.currency },
        availability: "https://schema.org/InStock",
        itemOffered: {
          "@type": "Service",
          name: bundle[locale].name,
          serviceType: bundle[locale].name,
          description: bundle[locale].summary,
          provider: { "@id": `${BASE}/#organization` },
        },
      },
    ],
  };
}

export function faqNode(locale: Locale) {
  return {
    "@type": "FAQPage",
    "@id": `${BASE}/#faq`,
    inLanguage: lang(locale),
    mainEntity: catalog.faq.map((item) => ({
      "@type": "Question",
      name: item[locale].q,
      acceptedAnswer: { "@type": "Answer", text: item[locale].a },
    })),
  };
}

export function systemsNode(locale: Locale, path: string) {
  return {
    "@type": "CollectionPage",
    "@id": `${BASE}${path}#software`,
    url: `${BASE}${path}`,
    inLanguage: lang(locale),
    about: { "@id": `${BASE}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      name: locale === "ar" ? "أنظمة Egytronic" : "Egytronic systems",
      itemListElement: catalog.systems.map((system, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: system[locale],
        item: { "@type": "Service", name: system[locale], provider: { "@id": `${BASE}/#organization` } },
      })),
    },
  };
}

export function contactNode(locale: Locale, path: string) {
  return {
    "@type": "ContactPage",
    "@id": `${BASE}${path}#contact`,
    url: `${BASE}${path}`,
    inLanguage: lang(locale),
    mainEntity: {
      "@type": "Organization",
      "@id": `${BASE}/#organization`,
      email: catalog.email,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: catalog.email,
        availableLanguage: ["ar", "en"],
        areaServed: "EG",
      },
    },
  };
}

export function pageNode(locale: Locale, path: string, title: string, description: string, type = "WebPage") {
  return {
    "@type": type,
    "@id": `${BASE}${path}#webpage`,
    url: `${BASE}${path}`,
    name: title,
    description,
    inLanguage: lang(locale),
    isPartOf: { "@id": `${BASE}/#website` },
    about: { "@id": `${BASE}/#organization` },
    primaryImageOfPage: { "@id": `${BASE}/#logo` },
  };
}

/** Full graph for a page: organisation, founder, site, the page itself and any extra entity. */
export function buildGraph(options: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  pageType?: string;
  extra?: Record<string, unknown> | Record<string, unknown>[] | null;
}) {
  const { locale, path, title, description, pageType, extra } = options;
  const graph: Record<string, unknown>[] = [
    organizationNode(),
    founderNode(),
    websiteNode(locale),
    pageNode(locale, path, title, description, pageType),
  ];
  const extras = Array.isArray(extra) ? extra : extra ? [extra] : [];
  for (const item of extras) {
    const { "@context": _ignored, ...rest } = item as Record<string, unknown>;
    graph.push(rest);
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
