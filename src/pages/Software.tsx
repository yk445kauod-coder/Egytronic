import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { systemsNode } from "../layout/Schema";

import type { Locale } from "../i18n/useLocale";
import { Software, OpenTools, Build } from "../sections/software/index";

export default function SoftwarePage({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/software/" : "/software/";
  return (
    <Layout
      locale={locale}
      path={path}
      subnav={[
        { href: "#software", label: "ما نبنيه" },
        { href: "#open-tools", label: "الأدوات المفتوحة" },
        { href: "#build", label: "طريقة التسليم" },
      ]}
      cta={{ href: "/pricing/", label: "الأسعار" }}
    >
      <Seo
        locale={locale}
        path={path}
        title="البرمجيات والأدوات المفتوحة | Egytronic"
        description="ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، بتُنفَّذ على مراحل وتنزل تشتغل."
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
