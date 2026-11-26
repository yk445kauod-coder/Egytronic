import { localePath, useLocale } from "../i18n/useLocale";
import { useT } from "../i18n/useT";

/** The same closing block on every page, so the page bottom is a template, not bespoke. */
export default function Endcap() {
  const locale = useLocale();
  const t = useT();
  const p = (href: string) => localePath(locale, href);

  const tiles = [
    { href: p("/pricing/"), kicker: t("الأسعار"), title: t("خمس باقات بأسعار معلنة"), note: t("من 5,000 جنيه · دفع 50%") },
    { href: p("/software/"), kicker: t("البرمجيات"), title: t("أدوات مفتوحة نستخدمها"), note: t("مستودعات وأدوات حقيقية") },
    { href: p("/contact/"), kicker: t("تواصل"), title: t("ناقش مشروعك معنا"), note: t("رد على نفس البريد") },
  ];

  return (
    <section aria-labelledby="endcap-title" className="border-t border-line/60 bg-ink-2">
      <div className="wrap grid gap-8 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-end">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 border border-line/70 px-2 py-1 font-mono text-[13px] uppercase tracking-[0.18em] text-gold">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-gold" />
            {t("الخطوة التالية")}
          </p>
          <h2 id="endcap-title" className="font-display text-3xl font-normal leading-tight text-text md:text-4xl">
            {t("اعرف التكلفة قبل أن تبدأ")}
          </h2>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-7 text-muted">
            {t("نوضح أي باقة تكفي عملك وأيها زائدة عن الحاجة، قبل أي دفع.")}
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.href}>
              <a
                href={tile.href}
                className="group flex h-full flex-col gap-2 border border-line/70 bg-panel/60 p-4 transition-colors duration-150 hover:border-gold/60 hover:bg-panel"
              >
                <span className="font-mono text-[13px] uppercase tracking-[0.18em] text-gold">{tile.kicker}</span>
                <span className="font-display text-lg font-normal leading-tight text-text">{tile.title}</span>
                <span className="mt-auto text-[13px] text-muted">{tile.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
