import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { faqNode, offerCatalogNode } from "../layout/Schema";
import type { Locale } from "../i18n/useLocale";
import { Block0, Products, Systems, Transform, Capabilities, How, About, Faq, Contact, Journal } from "../sections/index/index";

const og = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Egytronic",
  url: "https://egytronic.pages.dev/",
  logo: "https://egytronic.pages.dev/assets/img/icon-512.png",
  description:
    "شركة برمجيات مصرية تبني المواقع والهويات والأنظمة الإدارية وأنظمة الذكاء الاصطناعي، بأسعار معلنة تُنشر قبل البدء.",
  founder: { "@type": "Person", name: "Yousef Khamis" },
  sameAs: ["https://github.com/yk445kauod-coder/Egytronic"],
};

export default function Home({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/" : "/";
  return (
          <Layout locale={locale} path={path} subnav={[
        { href: "#products", label: "الباقات" },
        { href: "#capabilities", label: "الخدمات" },
        { href: "#how", label: "المنهجية" },
        { href: "#about", label: "عن الشركة" },
        { href: "#faq", label: "الأسئلة" },
      ]} cta={{ href: "/pricing/", label: "احجز باقتك" }}>
      <Seo
        locale={locale}
        path={path}
        title="Egytronic | برمجيات تُسلَّم جاهزة، بأسعار معلنة"
        description="مواقع وهوية وأنظمة إدارية وذكاء اصطناعي، بخمس باقات تبدأ من 5,000 جنيه. حدود محددة وسعر معلن وموعد تسليم، والاستضافة والباكند مجانًا في السنة الأولى."
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
        <Contact />
      </main>
    </Layout>
  );
}
