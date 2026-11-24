import Layout from "../layout/Layout";
import Seo from "../layout/Seo";
import { offerCatalogNode } from "../layout/Schema";
import type { Locale } from "../i18n/useLocale";
import { AllInOne, Prices, Terms } from "../sections/pricing/index";

export default function Pricing({ locale }: { locale: Locale }) {
  const path = locale === "en" ? "/en/pricing/" : "/pricing/";
  return (
    <Layout
      locale={locale}
      path={path}
      subnav={[
        { href: "#prices", label: "الباقات" },
        { href: "#all-in-one", label: "الكل في واحد" },
        { href: "#terms", label: "الشروط" },
      ]}
      cta={{ href: "/contact/", label: "تواصل" }}
    >
      <Seo
        locale={locale}
        path={path}
        title="أسعار باقات Egytronic | تبدأ من 5,000 جنيه"
        description="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا."
        jsonLd={offerCatalogNode(locale)}
      />
      <main id="main">
        <Prices />
        <AllInOne />
        <Terms />
      </main>
    </Layout>
  );
}
