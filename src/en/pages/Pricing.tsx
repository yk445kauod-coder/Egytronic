import Layout from "../../layout/Layout";
import Seo from "../../layout/Seo";
import type { Locale } from "../../i18n/useLocale";
import { AllInOne, Prices, Terms } from "../sections/pricing/index";

export default function Pricing({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/pricing/" : "/pricing/";
  return (
    <Layout
      locale={locale}
      path={path}
      subnav={[
        { href: "#prices", label: "Packages" },
        { href: "#all-in-one", label: "All in one" },
        { href: "#terms", label: "Terms" },
      ]}
      cta={{ href: "/contact/", label: "Contact" }}
    >
      <Seo
        locale={locale}
        path={path}
        title="Egytronic package prices | from EGP 5,000"
        description="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront."
      />
      <main id="main">
        <Prices />
        <AllInOne />
        <Terms />
      </main>
    </Layout>
  );
}
