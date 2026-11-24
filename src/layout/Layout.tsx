import { useEffect, type ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import TabBar from "./TabBar";
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

  return (
    <LocaleContext.Provider value={locale}>
      <div className="rail" aria-hidden="true"><i /></div>
      <Symbols />
      <a className="skip" href="#main">{locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}</a>
      <Boot />
      <Header path={path} />
      <SubNav items={subnav} cta={cta} />
      {children}
      <Endcap />
      <Footer />
      <TabBar path={path} />
    </LocaleContext.Provider>
  );
}
