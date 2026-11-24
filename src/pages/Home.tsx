import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import type { Locale } from "../i18n/useLocale";
import { Block0, Products, Systems, Transform, Capabilities, How, About, Faq, Contact } from "../sections/index/index";

const og = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Egytronic",
  url: "https://egytronic.pages.dev/",
  logo: "https://egytronic.pages.dev/assets/img/icon-512.png",
  description:
    "شركة برمجيات مصرية تبني المواقع والهويات وأنظمة الذكاء الاصطناعي وتسلّمها جاهزة للتشغيل.",
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
        title="Egytronic | برمجيات وأنظمة ذكية بأسعار معلنة"
        description="نبني موقعك أو هويتك، ونثبّت نظامك الإداري ونكيّفه على طبيعة عملك. خمس باقات بأسعار معلنة تبدأ من 5,000 جنيه، والدفع 50% مقدمًا."
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
