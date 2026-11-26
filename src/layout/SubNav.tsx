import { useT } from "../i18n/useT";

export type SubNavItem = { href: string; label: string };

/** Sticky anchor rail: the NVIDIA pattern for making a long page readable. */
export default function SubNav({ items, cta }: { items: SubNavItem[]; cta?: SubNavItem }) {
  const t = useT();
  if (!items.length) return null;

  return (
    <nav
      aria-label={t("أقسام الصفحة")}
      className="sticky top-[var(--nav-h)] z-40 border-b border-line/60 bg-ink/88 backdrop-blur-md"
    >
      <div className="wrap flex items-center gap-4 overflow-x-auto py-0">
        <ul className="flex min-w-0 flex-1 items-center gap-1">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <a
                href={item.href}
                className="inline-flex min-h-[44px] items-center px-3 font-mono text-[13px] uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:text-gold"
              >
                {t(item.label)}
              </a>
            </li>
          ))}
        </ul>
        {cta ? (
          <a
            href={cta.href}
            className="hidden shrink-0 items-center gap-2 border border-line/70 px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.14em] text-text transition-colors duration-150 hover:border-gold/70 hover:text-gold sm:inline-flex"
          >
            {t(cta.label)}
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </nav>
  );
}
