import Layout from "../../layout/Layout";
import Seo from "../../layout/Seo";
import { faqNode, offerCatalogNode } from "../../layout/Schema";
import type { Locale } from "../../i18n/useLocale";
import GoogleCard from "../../sections/GoogleCard";
import { Block0, Products, Systems, Transform, Capabilities, How, About, Faq, Contact, Journal } from "../sections/index/index";

const og = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Egytronic",
  url: "https://egytronic.pages.dev/",
  logo: "https://egytronic.pages.dev/assets/img/icon-512.png",
  description:
    "A digital transformation for your business: websites, brand identities, business systems and AI, built in clear stages.",
  founder: { "@type": "Person", name: "Yousef Khamis" },
  sameAs: ["https://github.com/yk445kauod-coder/Egytronic"],
};

export default function Home({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/" : "/";
  return (
          <Layout locale={locale} path={path} subnav={[
        { href: "#products", label: "Packages" },
        { href: "#capabilities", label: "Services" },
        { href: "#how", label: "Process" },
        { href: "#about", label: "Company" },
        { href: "#faq", label: "FAQ" },
      ]} cta={{ href: "/pricing/", label: "Book your package" }}>
      <Seo
        locale={locale}
        path={path}
        title="Egytronic | Digital transformation for your business"
        description="A digital transformation for your business: websites, identity, business systems and AI, built in clear stages. Hosting free in year one."
        jsonLd={[faqNode(locale), offerCatalogNode(locale)]}
      />
      <main id="main">
        <Block0 />
        <Products />
        <Systems />
        <Transform />
        <Capabilities />
        <How />
        <About />
        <Journal />
        <Faq />
        <GoogleCard />
        <Contact />
      </main>
    </Layout>
  );
}
