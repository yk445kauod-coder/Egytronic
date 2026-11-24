import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import type { Locale } from "../i18n/useLocale";
import { Portal } from "../sections/contact/index";

export default function ContactPage({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/contact/" : "/contact/";
  return (
    <Layout locale={locale} path={path}>
      <Seo
        locale={locale}
        path={path}
        title="بوابة التواصل | Egytronic"
        description="ابدأ مشروعك مع Egytronic: اكتب لنا الباقة اللي تهمك ووسيلة التواصل، ونرد عليك في أقرب وقت."
      />
      <main id="main">
        <Portal />
      </main>
    </Layout>
  );
}
