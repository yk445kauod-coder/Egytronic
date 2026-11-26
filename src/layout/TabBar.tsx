import { localePath, useLocale } from "../i18n/useLocale";

export default function TabBar({ path }: { path: string }) {
  const locale = useLocale();
  const en = locale === "en";
  const p = (href: string) => localePath(locale, href);
  const is = (part: string) => path.includes(part);

  const items = [
    { href: p("/"), icon: "#i-home", label: en ? "Home" : "الرئيسية", active: path === "/" || path === "/en/" },
    { href: p("/work/"), icon: "#i-grid", label: en ? "Work" : "أعمالنا", active: is("/work/") },
    { href: p("/pricing/"), icon: "#i-tag", label: en ? "Prices" : "الأسعار", active: is("/pricing/") },
    { href: p("/software/"), icon: "#i-external-link", label: en ? "Software" : "البرمجيات", active: is("/software/") },
    { href: p("/contact/"), icon: "#i-mail", label: en ? "Contact" : "تواصل", active: is("/contact/") },
  ];

  return (
    <nav className="tabbar" aria-label={en ? "Quick navigation" : "تنقل سريع"}>
      {items.map((item) => (
        <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}>
          <svg className="icon" aria-hidden="true"><use href={item.icon} /></svg>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
