import Layout from "../../layout/Layout";
import Seo from "../../layout/Seo";
import { systemsNode } from "../../layout/Schema";

import type { Locale } from "../../i18n/useLocale";
import { Software, OpenTools, Build } from "../sections/software/index";

export default function SoftwarePage({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/software/" : "/software/";
  return (
    <Layout
      locale={locale}
      path={path}
      subnav={[
        { href: "#software", label: "What we build" },
        { href: "#open-tools", label: "Open tools" },
        { href: "#build", label: "Delivery" },
      ]}
      cta={{ href: "/pricing/", label: "Prices" }}
    >
      <Seo
        locale={locale}
        path={path}
        title="Software and open tools | Egytronic"
        description="What Egytronic builds: websites, AI systems and tools published in the open, built in stages and handed over running."
        jsonLd={systemsNode(locale, path)}
      />
      <main id="main">
        <Software />
        <OpenTools />
        <Build />
      </main>
    </Layout>
  );
}
