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
        title="Egytronic | Software and AI systems, public prices"
        description="We build your site or brand, and install and adapt a management system for your business. Five public-price packages from EGP 5,000, 50% upfront."
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
