import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { contactNode } from "../layout/Schema";

import type { Locale } from "../i18n/useLocale";
import { Portal } from "../sections/contact/index";
import GoogleCard from "../sections/GoogleCard";

export default function ContactPage({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/contact/" : "/contact/";
  return (
    <Layout locale={locale} path={path}>
      <Seo
        locale={locale}
        path={path}
        title="بوابة التواصل | Egytronic"
        description="ابدأ مشروعك مع Egytronic: اكتب الباقة التي تهمك ووسيلة التواصل، وسنرد عليك في أقرب وقت."
        jsonLd={contactNode(locale, path)}
      />
      <main id="main">
        <Portal />
        <GoogleCard />
      </main>
    </Layout>
  );
}
