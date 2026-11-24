import Layout from "../../layout/Layout";
import Seo from "../../layout/Seo";
import type { Locale } from "../../i18n/useLocale";
import { Block0, Products, Systems, Transform, Capabilities, How, About, Faq, Contact } from "../sections/index/index";

const og = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Egytronic",
  url: "https://egytronic.pages.dev/",
  logo: "https://egytronic.pages.dev/assets/img/icon-512.png",
  description:
    "An Egyptian software company building websites, brand identities and AI systems, delivered ready to run.",
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
        title="Egytronic | Software delivered ready, at public prices"
        description="Websites, brand identity, business systems and AI, in five packages from EGP 5,000. Fixed scope, a public price and a delivery date. Hosting and backend free in year one."
        jsonLd={og}
      />
      <main id="main">
        <Block0 />
        <Products />
        <Systems />
        <Transform />
        <Capabilities />
        <How />
        <About />
        <Faq />
        <Contact />
      </main>
    </Layout>
  );
}
