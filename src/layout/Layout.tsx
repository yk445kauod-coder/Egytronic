import { useEffect, type ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import TabBar from "./TabBar";
import Sidebar from "./Sidebar";
import Symbols from "./Symbols";
import Boot from "./Boot";
import SubNav, { type SubNavItem } from "./SubNav";
import Endcap from "./Endcap";
import { LocaleContext, type Locale } from "../i18n/useLocale";

import { mountSiteEffects } from "../js/site-effects";

export default function Layout({
  path,
  locale,
  children,
  subnav = [],
  cta,
}: {
  path: string;
  locale: Locale;
  children: ReactNode;
  subnav?: SubNavItem[];
  cta?: SubNavItem;
}) {
  useEffect(() => mountSiteEffects(document.body), []);

  const localize = (href: string) =>
    locale === "en" && href.startsWith("/") && !href.startsWith("/en") ? `/en${href}` : href;
  const rail = subnav.map((item) => ({ ...item, href: localize(item.href) }));
  const railCta = cta ? { ...cta, href: localize(cta.href) } : undefined;

  return (
    <LocaleContext.Provider value={locale}>
      <div className="rail" aria-hidden="true"><i /></div>
      <Symbols />
      <a className="skip" href="#main">{locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}</a>
      <Boot />
      <Header path={path} />
      <SubNav items={rail} cta={railCta} />
      {children}
      <Endcap />
      <Footer />
      <TabBar path={path} />
      <Sidebar path={path} />
    </LocaleContext.Provider>
  );
}
