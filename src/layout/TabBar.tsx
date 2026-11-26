import { useEffect, useState } from "react";
import { localePath, useLocale } from "../i18n/useLocale";
import { sidebar } from "./sidebar-store";

type Item = { href: string; icon: string; label: string; active?: boolean; more?: boolean };

export default function TabBar({ path }: { path: string }) {
  const locale = useLocale();
  const en = locale === "en";
  const p = (href: string) => localePath(locale, href);
  const is = (part: string) => path.includes(part);

  const home = { href: p("/"), icon: "#i-home", label: en ? "Home" : "الرئيسية", active: path === "/" || path === "/en/" };
  const work = { href: p("/work/"), icon: "#i-grid", label: en ? "Work" : "أعمالنا", active: is("/work/") };
  const prices = { href: p("/pricing/"), icon: "#i-tag", label: en ? "Prices" : "الأسعار", active: is("/pricing/") };
  const software = { href: p("/software/"), icon: "#i-copy", label: en ? "Software" : "البرمجيات", active: is("/software/") };
  const blog = { href: p("/blog/"), icon: "#i-external-link", label: en ? "Journal" : "المدونة", active: is("/blog/") };
  const contact = { href: p("/contact/"), icon: "#i-mail", label: en ? "Contact" : "تواصل", active: is("/contact/") };

  // The bar answers "where am I" first, then offers the three nearest next steps.
  let items: Item[];
  if (is("/pricing/")) items = [prices, work, software, contact];
  else if (is("/work/")) items = [work, prices, contact, home];
  else if (is("/software/")) items = [software, work, prices, contact];
  else if (is("/blog/")) items = [blog, work, prices, contact];
  else if (is("/contact/")) items = [contact, prices, work, home];
  else items = [home, work, prices, contact];

  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        // never hide near the top, and ignore rubber-band jitter
        setHidden(y > 260 && y > last + 6);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className="tabbar" data-hidden={String(hidden)} aria-label={en ? "Quick navigation" : "تنقل سريع"}>
      {items.map((item) => (
        <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}>
          <svg className="icon" aria-hidden="true"><use href={item.icon} /></svg>
          <span>{item.label}</span>
        </a>
      ))}
      <button type="button" className="tabbar__more" onClick={() => sidebar.open()}>
        <svg className="icon" aria-hidden="true"><use href="#i-menu" /></svg>
        <span>{en ? "More" : "المزيد"}</span>
      </button>
    </nav>
  );
}
