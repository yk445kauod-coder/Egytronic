"""Generate the English pages from the Arabic ones.

The Arabic pages are the single source of truth. Keep the structure identical so
both languages stay in sync; only the strings below are swapped. A page that
still contains Arabic after translation fails the build.
Usage: python3 scripts/build-en.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Markup-bearing keys where a phrase is reused in more than one place; the map
# is applied longest-key-first so whole sentences win over their fragments.
INDEX = {
    # ── head ────────────────────────────────────────────────
    "Egytronic — هندسة برمجيات وأنظمة ذكاء اصطناعي":
        "Egytronic — Software engineering and AI systems",
    "Egytronic — برمجيات وأنظمة ذكية، مبنية في مصر":
        "Egytronic — software and intelligent systems, built in Egypt",
    '<meta property="og:locale" content="ar_EG">':
        '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ar_EG">',

    # ── shell ───────────────────────────────────────────────
    '<html lang="ar" dir="rtl">': '<html lang="en" dir="ltr">',
    '<a class="skip" href="#main">تخطَّ إلى المحتوى</a>': '<a class="skip" href="#main">Skip to content</a>',
    'aria-label="Egytronic — الرئيسية"': 'aria-label="Egytronic — home"',
    'aria-label="التنقل الرئيسي"': 'aria-label="Main navigation"',
    'aria-label="فتح القائمة" data-label-open="فتح القائمة" data-label-close="إغلاق القائمة"':
        'aria-label="Open menu" data-label-open="Open menu" data-label-close="Close menu"',
    '<a href="#top">الرئيسية</a>': '<a href="#top">Home</a>',
    '<a href="#about">عن الشركة</a>': '<a href="#about">Company</a>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="/en/pricing/">Prices</a></li>',
    '<a href="#contact">تواصل</a>': '<a href="#contact">Contact</a>',
    '<li><a href="#faq">الأسئلة</a></li>': '<li><a href="#faq">FAQ</a></li>',

    # ── hero ────────────────────────────────────────────────

    # ── model ───────────────────────────────────────────────

    # ── capabilities ────────────────────────────────────────

    # ── process ─────────────────────────────────────────────
    "<h3>التصميم</h3>": "<h3>Design</h3>",
    "<h3>البناء</h3>": "<h3>Build</h3>",
    "<h3>المراجعة</h3>": "<h3>Review</h3>",
    "<h3>الإطلاق</h3>": "<h3>Launch</h3>",

    # ── company ─────────────────────────────────────────────
    '<span class="px-tag">عن الشركة</span>': '<span class="px-tag">Company</span>',
    '<div class="founder__role">المؤسس</div>': '<div class="founder__role">Founder</div>',
    "<h3>يوسف خميس</h3>": "<h3>Yousef Khamis</h3>",

    # ── faq ─────────────────────────────────────────────────

    # ── contact + footer ────────────────────────────────────
    '<span class="px-tag px-tag--mint">تواصل</span>': '<span class="px-tag px-tag--mint">Contact</span>',
    "إرسال بريد": "Send email",
    "نسخ البريد": "Copy email",
    "البريد الإلكتروني": "Email",
}



# ── shared shell strings ────────────────────────────────────
SHARED = {
    '<html lang="ar" dir="rtl">': '<html lang="en" dir="ltr">',
    '<a class="skip" href="#main">تخطَّ إلى المحتوى</a>': '<a class="skip" href="#main">Skip to content</a>',
    'aria-label="Egytronic — الرئيسية"': 'aria-label="Egytronic — home"',
    'aria-label="التنقل الرئيسي"': 'aria-label="Main navigation"',
    'aria-label="فتح القائمة" data-label-open="فتح القائمة" data-label-close="إغلاق القائمة"':
        'aria-label="Open menu" data-label-open="Open menu" data-label-close="Close menu"',
    "البريد الإلكتروني": "Email",
}

# ── pricing page ────────────────────────────────────────────
PRICING = {
    "قايمة الأسعار — Egytronic": "Price list — Egytronic",
    "Egytronic — قايمة الأسعار": "Egytronic — price list",

    # shell
    '<a href="/">الرئيسية</a>': '<a href="../">Home</a>',
    '<a href="/pricing/" class="is-active" aria-current="page">الأسعار</a>':
        '<a href="./" class="is-active" aria-current="page">Prices</a>',
    '<a href="/#about">عن الشركة</a>': '<a href="../#about">Company</a>',
    '<a href="/#contact">تواصل</a>': '<a href="../#contact">Contact</a>',
    '<a href="/#faq">الأسئلة</a>': '<a href="../#faq">FAQ</a>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="./">Prices</a></li>',

    # sheet
    "<h3>لوجو</h3>": "<h3>Logo</h3>",
    "<h3>لاندنج بيدج</h3>": "<h3>Landing page</h3>",
    "<h3>موقع ستاتيك</h3>": "<h3>Static site</h3>",
    "<h3>هوية كاملة</h3>": "<h3>Full brand identity</h3>",
    "<h3>موقع ديناميك</h3>": "<h3>Dynamic site</h3>",
    '<span class="pricerow__cur">جنيه</span>': '<span class="pricerow__cur">EGP</span>',
    "<span>جنيه</span>": "<span>EGP</span>",

    # bundle
    "التحول الرقمي الكامل": "End-to-end digital transformation",
    "جلسة تشخيص وتقرير بالأولويات": "Diagnostic session and a prioritised report",
    "هوية كاملة (لوجو وألوان وخطوط)": "Full brand identity (logo, colours, type)",
    "موقع ديناميك بباكند وقاعدة بيانات": "Dynamic site with backend and database",
    "Google Business وحسابات سوشيال جاهزة": "Google Business profile and social accounts set up",
    "تدريب على الاستخدام": "Training on how to use it",
    "شهر متابعة بعد التسليم": "One month of follow-up after delivery",

    # terms + sheet foot
}

# src → out, plus how many directories deep the output sits (asset paths).

SOFT = {
    "<title>البرمجيات والأدوات المفتوحة | Egytronic</title>":
        "<title>Software and Open Tools | Egytronic</title>",
    '<meta name="description" content="ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، تُسلَّم جاهزة للتشغيل.">':
        '<meta name="description" content="What Egytronic builds: websites, AI systems and tools published in the open, delivered ready to run.">',
    '<meta property="og:title" content="البرمجيات والأدوات المفتوحة | Egytronic">':
        '<meta property="og:title" content="Software and Open Tools | Egytronic">',
    '<meta property="og:description" content="ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، تُسلَّم جاهزة للتشغيل.">':
        '<meta property="og:description" content="What Egytronic builds: websites, AI systems and tools published in the open, delivered ready to run.">',
    '<meta property="og:image:alt" content="Egytronic — قايمة الأسعار">':
        '<meta property="og:image:alt" content="Egytronic — software and open tools">',
    '<meta name="twitter:title" content="البرمجيات والأدوات المفتوحة | Egytronic">':
        '<meta name="twitter:title" content="Software and Open Tools | Egytronic">',
    '<meta name="twitter:description" content="ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، تُسلَّم جاهزة للتشغيل.">':
        '<meta name="twitter:description" content="What Egytronic builds: websites, AI systems and tools published in the open, delivered ready to run.">',
    '<a class="lang" href="/en/software/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/software/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="px-tag">البرمجيات</span>': '<span class="px-tag">Software</span>',
    '<h2 id="software-title">ما نبنيه من برمجيات</h2>': '<h2 id="software-title">What we build in software</h2>',
    '<p>مواقع وأنظمة وأدوات نسلّمها جاهزة للتشغيل، وننشر بعضها للجميع.</p>':
        '<p>Websites, systems and tools delivered ready to run; some of them published for everyone.</p>',
    '<h3>مواقع</h3>': '<h3>Websites</h3>',
    '<p class="pricerow__desc">لاندنج بيدج، أو موقع ستاتيك حتى 5 صفحات، أو موقع ديناميك بباكند.</p>':
        '<p class="pricerow__desc">A landing page, a static site of up to 5 pages, or a dynamic site with a backend.</p>',
    '<h3>أنظمة ذكية</h3>': '<h3>Smart systems</h3>',
    '<p class="pricerow__desc">برمجيات وأنظمة ذكاء اصطناعي تُبنى حسب حاجة مشروعك وتُسلَّم جاهزة.</p>':
        "<p class=\"pricerow__desc\">Software and AI systems built to your project's needs and delivered ready.</p>",
    '<h3>أدوات مفتوحة</h3>': '<h3>Open tools</h3>',
    '<p class="pricerow__desc">ننشر بعض أدواتنا علنًا على GitHub، ويمكن لأي شخص استخدامها ومراجعتها.</p>':
        '<p class="pricerow__desc">We publish some of our tools on GitHub for anyone to use and review.</p>',
    '<span class="px-tag">أدوات مفتوحة</span>': '<span class="px-tag">Open tools</span>',
    '<p>نموذج لغوي منشور بأوزان مفتوحة، بطاقة النموذج متاحة للجميع.</p>':
        '<p>A language model published with open weights; the model card is public.</p>',
    '<h3>نموذج مبني على Llama 3.1 8B</h3>': '<h3>A model built on Llama 3.1 8B</h3>',
    '<p class="bundle__lead">سياق 131,072 توكن، أوزان GGUF، ورخصة LLaMA Community. لا تحتاجه لطلب أي باقة، والاستخدام وفق الرخصة.</p>':
        '<p class="bundle__lead">131,072-token context, GGUF weights, LLaMA Community license. You do not need it to order any package; use follows the license.</p>',
    '<li>الأساس: Llama 3.1 8B · 8.03B معامل</li>': '<li>Base: Llama 3.1 8B · 8.03B parameters</li>',
    '<li>السياق: 131,072 توكن</li>': '<li>Context: 131,072 tokens</li>',
    '<li>الصيغة: GGUF</li>': '<li>Format: GGUF</li>',
    '<li>الرخصة: LLaMA Community</li>': '<li>License: LLaMA Community</li>',
    '<h3 id="terms-title">السعر معلن قبل أن تبدأ</h3>': '<h3 id="terms-title">The price is public before you start</h3>',
    '<li>خمس باقات بالجنيه المصري</li>': '<li>Five packages in Egyptian pounds</li>',
    '<li>50% مقدمًا و50% قبل التسليم</li>': '<li>50% upfront, 50% before delivery</li>',
    '<li>احجز باقتك من صفحة الأسعار</li>': '<li>Book your package from the pricing page</li>',
}

SOFT.update({
    '<li><a href="/">الرئيسية</a></li>': '<li><a href="../">Home</a></li>',
    '<li><a href="/#capabilities">الخدمات</a></li>': '<li><a href="../#capabilities">Services</a></li>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="../pricing/">Prices</a></li>',
    '<li><a href="/#how">المنهجية</a></li>': '<li><a href="../#how">Process</a></li>',
    '<li><a href="/#about">عن الشركة</a></li>': '<li><a href="../#about">Company</a></li>',
    '<li><a href="/#contact">تواصل</a></li>': '<li><a href="../#contact">Contact</a></li>',
    '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">Book a package ↗</a></li>',
    '<li><a href="/#faq">الأسئلة</a></li>': '<li><a href="../#faq">FAQ</a></li>',
    '<p class="footer__note">صُنع في مصر — <bdi>Egytronic</bdi></p>':
        '<p class="footer__note">Made in Egypt — <bdi>Egytronic</bdi></p>',
})

INDEX.update({
    '<span class="px-tag">الباقات والأسعار</span>': '<span class="px-tag">Packages and prices</span>',
    '<h2 id="products-title">خمس باقات، والسعر مكتوب</h2>':
        '<h2 id="products-title">Five packages, price on the label</h2>',
    '<p>بالجنيه المصري. تدفع 50% عند البدء و50% قبل التسليم.</p>':
        '<p>In Egyptian pounds. Pay 50% to start and 50% before delivery.</p>',
    '<h3>لوجو</h3>': '<h3>Logo</h3>',
    '<h3>لاندنج بيدج</h3>': '<h3>Landing page</h3>',
    '<h3>موقع ستاتيك</h3>': '<h3>Static site</h3>',
    '<h3>هوية كاملة</h3>': '<h3>Full identity</h3>',
    '<h3>موقع ديناميك</h3>': '<h3>Dynamic site</h3>',
    '<p class="prod__desc">شعار لمشروعك يُسلَّم جاهزًا للاستخدام.</p>':
        '<p class="prod__desc">A logo for your business, delivered ready to use.</p>',
    '<p class="prod__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>':
        '<p class="prod__desc">One page that introduces your business and services.</p>',
    '<p class="prod__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>':
        '<p class="prod__desc">An informational site of up to 5 pages.</p>',
    '<p class="prod__desc">هوية بصرية متكاملة لمشروعك.</p>':
        '<p class="prod__desc">A complete visual identity for your business.</p>',
    '<p class="prod__desc">موقع بباكند يناسب المحتوى والوظائف المتغيرة.</p>':
        '<p class="prod__desc">A site with a backend for changing content and features.</p>',
    '<span class="prod__amt">5,000</span> <span class="prod__cur">جنيه</span>':
        '<span class="prod__amt">5,000</span> <span class="prod__cur">EGP</span>',
    '<span class="prod__amt">6,000</span> <span class="prod__cur">جنيه</span>':
        '<span class="prod__amt">6,000</span> <span class="prod__cur">EGP</span>',
    '<span class="prod__amt">8,000</span> <span class="prod__cur">جنيه</span>':
        '<span class="prod__amt">8,000</span> <span class="prod__cur">EGP</span>',
    '<span class="prod__amt">10,000</span> <span class="prod__cur">جنيه</span>':
        '<span class="prod__amt">10,000</span> <span class="prod__cur">EGP</span>',
    '<span class="prod__cur">من</span> <span class="prod__amt">18,000</span> <span class="prod__cur">جنيه</span>':
        '<span class="prod__cur">from</span> <span class="prod__amt">18,000</span> <span class="prod__cur">EGP</span>',
    '<a class="px-btn" href="/pricing/">التفاصيل وحجز الباقة</a>':
        '<a class="px-btn" href="pricing/">Details and booking</a>',
    '<p class="prods__note">التحول الرقمي الكامل من 28,000 جنيه · استضافة وباكند مجانًا في السنة الأولى · الدومين منفصل أو بفاتورة</p>':
        '<p class="prods__note">Full digital transformation from EGP 28,000 · hosting and backend free in the first year · domain separate or by invoice</p>',
    '<a href="/software/">': '<a href="software/">',
    '          البرمجيات\n': '          Software\n',
})

INDEX.update({
    'شركة برمجيات مصرية تبني المواقع والهويات وأنظمة الذكاء الاصطناعي وتسلّمها جاهزة للتشغيل.':
        'An Egyptian software company building websites, brand identities and AI systems, delivered ready to run.',
})

SOFT.update({
    '            بطاقة النموذج\n': '            Model card\n',
})

SOFT.update({
    '        احجز باقتك\n': '        Book a package\n',
})

PRICING.update({
    'اطلب عرضًا': 'Request a quote',
})

PAGES = [
    {
        "src": "index.html",
        "out": "en/index.html",
        "tables": [INDEX],
        "urls": ("https://egytronic.pages.dev/", "https://egytronic.pages.dev/en/"),
        "prefix": "",
    },
    {
        "src": "software/index.html",
        "out": "en/software/index.html",
        "tables": [SHARED, SOFT],
        "urls": ("https://egytronic.pages.dev/software/", "https://egytronic.pages.dev/en/software/"),
        "prefix": "../",
    },
    {
        "src": "pricing/index.html",
        "out": "en/pricing/index.html",
        "tables": [SHARED, PRICING],
        "urls": ("https://egytronic.pages.dev/pricing/", "https://egytronic.pages.dev/en/pricing/"),
        "prefix": "../",
    },
]

ARABIC = re.compile(r"[\u0600-\u06FF][\u0600-\u06FF\s«»،.\u064B-\u0652]*")


def build(page) -> bool:
    html = (ROOT / page["src"]).read_text(encoding="utf-8")

    missing = []
    for table in page["tables"]:
        for key in sorted(table, key=len, reverse=True):
            if key not in html:
                missing.append(key)
                continue
            html = html.replace(key, table[key])
    if missing:
        print(f"{page['src']}: missing keys:\n  " + "\n  ".join(missing), file=sys.stderr)
        return False

    left = ARABIC.findall(html)
    if left:
        print(f"{page['src']}: untranslated Arabic left:\n  " + "\n  ".join(sorted(set(left))[:20]),
              file=sys.stderr)
        return False

    ar_url, en_url = page["urls"]
    html = html.replace(f'<link rel="canonical" href="{ar_url}">', f'<link rel="canonical" href="{en_url}">')
    html = html.replace(f'<meta property="og:url" content="{ar_url}">', f'<meta property="og:url" content="{en_url}">')

    # the English page sits one level deeper, so asset paths step up a directory
    prefix = page["prefix"]
    deeper = "../" + prefix
    for attr in ("href", "src"):
        html = html.replace(f'{attr}="{prefix}assets/', f'{attr}="{deeper}assets/')
    html = html.replace(f'href="{prefix}favicon.ico"', f'href="{deeper}favicon.ico"')

    out = ROOT / page["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {page['out']} ({len(html)} bytes)")
    return True


def main() -> int:
    return 0 if all([build(page) for page in PAGES]) else 1


# ── 2026-11-24: the open model is a side note, not the pitch ──
INDEX.update({
    # shadowed by a longer key: "See prices",
})



# ── 2026-11-24: copy deck approved (UX writer) ─────────────
INDEX.update({
    "<title>Egytronic | برمجيات وأنظمة ذكية بأسعار معلنة</title>":
        "<title>Egytronic | Software and AI Systems, Public Prices</title>",
    "نبني موقعك أو هويتك أو نظامك ونسلّمه جاهزًا للتشغيل. خمس باقات بأسعار معلنة من 5,000 جنيه، والدفع 50% مقدمًا.":
        "Egyptian software company. We build your site, brand or system and deliver it ready to run. Five public-price packages from EGP 5,000, 50% upfront.",
    "شركة برمجيات مصرية. نبني موقعك أو هويتك أو نظامك ونسلّمه جاهزًا للتشغيل. خمس باقات من 5,000 جنيه.":
        "An Egyptian software company. We build your site, brand or system and deliver it ready to run. Five packages from EGP 5,000.",
    '<li><a href="#capabilities">الخدمات</a></li>': '<li><a href="#capabilities">Services</a></li>',
    '<li><a href="#how">المنهجية</a></li>': '<li><a href="#how">Process</a></li>',
    '<li class="nav-ext"><a href="/pricing/">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="../pricing/">Book a package ↗</a></li>',
    '<a class="lang" href="/en/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="px-tag">برمجيات مصرية جاهزة للتشغيل</span>':
        '<span class="px-tag">Egyptian software, ready to run</span>',
    "<span class=\"line\">نبني موقعك وهويتك</span>":
        "<span class=\"line\">We build your site and brand</span>",
    "<span class=\"line\"><em>ونسلّمهما جاهزين</em></span>":
        "<span class=\"line\"><em>and deliver them ready</em></span>",
    "لوجو بـ5,000 جنيه وموقع ستاتيك بـ8,000. تدفع 50% عند البدء و50% قبل التسليم، والاستضافة مجانًا أول سنة.":
        "A logo costs EGP 5,000 and a static site EGP 8,000. Pay 50% to start, 50% before delivery. Hosting is free for the first year.",
    '<a class="px-btn" href="/pricing/">شوف الأسعار</a>': '<a class="px-btn" href="pricing/">See pricing</a>',
    '<a class="px-btn px-btn--ghost" href="#contact">تواصل معنا</a>':
        '<a class="px-btn px-btn--ghost" href="#contact">Contact us</a>',
    '<span class="stat__n">5,000</span><span class="stat__l">تبدأ من — جنيه</span>':
        '<span class="stat__n">5,000</span><span class="stat__l">from, in EGP</span>',
    '<span class="stat__n">50%</span><span class="stat__l">مقدم</span>':
        '<span class="stat__n">50%</span><span class="stat__l">upfront</span>',
    '<span class="stat__n">سنة</span><span class="stat__l">استضافة مجانًا</span>':
        '<span class="stat__n">Year 1</span><span class="stat__l">free hosting</span>',
    '<span class="stat__l">عربي وإنجليزي</span>': '<span class="stat__l">Arabic and English</span>',
    '<span class="px-tag">الخدمات</span>': '<span class="px-tag">Services</span>',
    '<h2>ماذا نبني لك</h2>': '<h2>What we build</h2>',
    '<p>اختر ما يحتاجه مشروعك الآن.</p>': '<p>Choose what your project needs now.</p>',
    '<span class="ledger__k">WEB</span>': '<span class="ledger__k">WEB</span>',
    '<h3>مواقع</h3>': '<h3>Websites</h3>',
    '<p>لاندنج بيدج، أو موقع ستاتيك حتى 5 صفحات، أو موقع ديناميك بباكند.</p>':
        '<p>A landing page, a static site of up to 5 pages, or a dynamic site with a backend.</p>',
    '<span class="ledger__k">BRAND</span>': '<span class="ledger__k">BRAND</span>',
    '<h3>هوية</h3>': '<h3>Brand</h3>',
    '<p>لوجو وحده، أو هوية كاملة تجمع عناصر مشروعك البصرية.</p>':
        '<p>A logo on its own, or a full identity covering your visual elements.</p>',
    '<h3>أنظمة ذكية</h3>': '<h3>Smart systems</h3>',
    '<p>برمجيات وأنظمة ذكاء اصطناعي تُبنى حسب حاجة مشروعك وتُسلَّم جاهزة.</p>':
        "<p>Software and AI systems built to your project's needs and delivered ready.</p>",
    '<span class="px-tag">المنهجية</span>': '<span class="px-tag">Process</span>',
    '<h2>أربع مراحل حتى التسليم</h2>': '<h2>Four stages to delivery</h2>',
    '<p>لكل مرحلة مخرج واضح قبل أن تبدأ التي بعدها.</p>':
        '<p>Each stage has a clear output before the next begins.</p>',
    '<p>نحدد المطلوب والنطاق والقيود قبل كتابة أي كود.</p>':
        '<p>We set the goal, scope and limits before writing any code.</p>',
    '<p>ننفذ المخطط المتفق عليه جزءًا جزءًا.</p>': '<p>We build the agreed plan, one part at a time.</p>',
    '<p>نفحص كل مخرج من ناحية الأمان والبنية قبل النشر.</p>':
        '<p>We check every output for security and structure before release.</p>',
    '<p>ننشر العمل ونسلّمه لك جاهزًا للتشغيل.</p>': '<p>We publish the work and hand it over ready to run.</p>',
    '<h2>من يبني مشروعك</h2>': '<h2>Who builds your project</h2>',
    '<p>شركة برمجيات مصرية يقودها مؤسسها، وتسلّم العمل جاهزًا للتشغيل.</p>':
        '<p>An Egyptian software company led by its founder, delivering work ready to run.</p>',
    '<p>يتولى رؤية المنتج ومعمارية الأنظمة والإطلاق.</p>':
        '<p>Leads product vision, system architecture and launch.</p>',
    '<span class="principle__k">01 / DELIVERY</span>': '<span class="principle__k">01 / DELIVERY</span>',
    '<h3>تسليم جاهز</h3>': '<h3>Ready on delivery</h3>',
    '<p>لا نعدّ العمل منتهيًا قبل أن يعمل عندك.</p>': "<p>We don't count work as done until it runs for you.</p>",
    '<span class="principle__k">02 / PRICING</span>': '<span class="principle__k">02 / PRICING</span>',
    '<h3>أسعار معلنة</h3>': '<h3>Public prices</h3>',
    "<p>ترى سعر كل باقة قبل أن تتواصل معنا.</p>": "<p>You see each package's price before you contact us.</p>",
    '<h3>أدوات مفتوحة</h3>': '<h3>Open tools</h3>',
    '<p>ننشر بعض أدواتنا علنًا ليراها الجميع.</p>': '<p>We publish some of our tools publicly for anyone to see.</p>',
    '<span class="px-tag">الأسئلة</span>': '<span class="px-tag">FAQ</span>',
    '<h2>أسئلة قبل الحجز</h2>': '<h2>Questions before booking</h2>',
    '<p>إجابات عن التسليم والاستضافة والدفع.</p>': '<p>Answers on delivery, hosting and payment.</p>',
    '<summary>ماذا أستلم في النهاية؟</summary>': '<summary>What do I get at the end?</summary>',
    '<p>عملًا جاهزًا للتشغيل حسب الباقة التي اخترتها: لوجو، أو لاندنج بيدج، أو موقعًا، أو هوية كاملة.</p>':
        '<p>Work that is ready to run, according to the package you chose: a logo, landing page, website or full identity.</p>',
    '<summary>هل الاستضافة مشمولة؟</summary>': '<summary>Is hosting included?</summary>',
    '<p>الاستضافة والباكند مجانًا في السنة الأولى مع كل باقة. الدومين يُشترى منفصلًا أو يُضاف بفاتورة.</p>':
        '<p>Hosting and backend are free in the first year with every package. The domain is bought separately or added by invoice.</p>',
    '<summary>كيف يتم الدفع؟</summary>': '<summary>How does payment work?</summary>',
    '<p>50% مقدمًا وقت البدء، و50% قبل التسليم النهائي. الأسعار بالجنيه المصري.</p>':
        '<p>50% upfront when we start and 50% before final delivery. Prices are in Egyptian pounds.</p>',
    '<summary>كم صفحة في الموقع الستاتيك؟</summary>': '<summary>How many pages in the static site?</summary>',
    '<p>حتى 5 صفحات بسعر 8,000 جنيه. أما الموقع الديناميك فيبدأ من 18,000 جنيه.</p>':
        '<p>Up to 5 pages for EGP 8,000. The dynamic site starts from EGP 18,000.</p>',
    '<h2>تواصل معنا</h2>': '<h2>Contact us</h2>',
    '<p>راسلنا على البريد التالي، ونرد عليك في أقرب وقت.</p>':
        '<p>Write to us at the address below and we will get back to you.</p>',
    'صُنع في مصر — <bdi>Egytronic</bdi>': 'Made in Egypt — <bdi>Egytronic</bdi>',
    'data-message="تم نسخ البريد"': 'data-message="Email copied"',
    # shadowed by a longer key: 'FAQ</a>',
    'البريد الإلكتروني': 'Email',
    'إرسال بريد': 'Send email',
    'نسخ البريد': 'Copy email',
    # shadowed by a longer key: 'Contact</a>',
    # shadowed by a longer key: 'Services</a>',
    # shadowed by a longer key: 'Process</a>',
    '<span class="px-tag px-tag--mint">تواصل</span>': '<span class="px-tag px-tag--mint">Contact</span>',
})

PRICING.update({
    "<title>أسعار باقات Egytronic | من 5,000 جنيه</title>":
        "<title>Egytronic Pricing | From EGP 5,000</title>",
    '<span class="px-tag">الأسعار المعلنة</span>': '<span class="px-tag">Public pricing</span>',
    '<h2 id="prices-title">خمس باقات بسعر واضح</h2>': '<h2 id="prices-title">Five packages, clear prices</h2>',
    '<p>تدفع 50% مقدمًا عند البدء و50% قبل التسليم النهائي، بالجنيه المصري.</p>':
        '<p>Pay 50% upfront to start and 50% before final delivery, in Egyptian pounds.</p>',
    '<p class="pricerow__desc">شعار لمشروعك يُسلَّم جاهزًا للاستخدام.</p>':
        '<p class="pricerow__desc">A logo for your business, delivered ready to use.</p>',
    '<p class="pricerow__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>':
        '<p class="pricerow__desc">One page that introduces your business and services.</p>',
    '<p class="pricerow__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>':
        '<p class="pricerow__desc">An informational site of up to 5 pages.</p>',
    '<p class="pricerow__desc">هوية بصرية متكاملة لمشروعك.</p>':
        '<p class="pricerow__desc">A complete visual identity for your business.</p>',
    '<p class="pricerow__desc">موقع بباكند يناسب المحتوى والوظائف المتغيرة.</p>':
        '<p class="pricerow__desc">A site with a backend for changing content and features.</p>',
    '<p class="bundle__lead">من 28,000 جنيه. للمشاريع الأكبر، ونحدد النطاق معك بعد التواصل.</p>':
        '<p class="bundle__lead">From EGP 28,000. For larger projects; we set the scope with you after we talk.</p>',
    '<h3 id="terms-title">في كل باقة</h3>': '<h3 id="terms-title">In every package</h3>',
    '<li>استضافة وباكند مجانًا في السنة الأولى</li>':
        '<li>Hosting and backend free in the first year</li>',
    '<li>الدومين منفصل أو بفاتورة</li>': '<li>Domain separate or by invoice</li>',
    '<li>50% مقدمًا و50% قبل التسليم</li>': '<li>50% upfront, 50% before delivery</li>',
    'احجز باقتك': 'Book your package',
    '<li><a href="/#capabilities">الخدمات</a></li>': '<li><a href="../#capabilities">Services</a></li>',
    '<li><a href="/#how">المنهجية</a></li>': '<li><a href="../#how">Process</a></li>',
    '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">Book a package ↗</a></li>',
})


PRICING.update({
    "<title>أسعار باقات Egytronic | من 5,000 جنيه</title>":
        "<title>Egytronic Pricing | From EGP 5,000</title>",
    '<meta name="description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta name="description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta property="og:description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta property="og:description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta name="twitter:description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta name="twitter:description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta property="og:title" content="أسعار باقات Egytronic | من 5,000 جنيه">':
        '<meta property="og:title" content="Egytronic Pricing | From EGP 5,000">',
    '<a class="lang" href="/en/pricing/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/pricing/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="pricerow__cur">جنيه</span>': '<span class="pricerow__cur">EGP</span>',
    '<span>جنيه</span>': '<span>EGP</span>',
    '<span class="pricerow__from">ابتداءً من</span>': '<span class="pricerow__from">Starting at</span>',
    '<h2 id="prices-title">': '<h2 id="prices-title">',
})

INDEX.update({
    '<a class="px-btn px-btn--ghost px-btn--sm" href="/pricing/" aria-label="انتقل إلى صفحة الأسعار لحجز باقة">\n        احجز باقتك\n      </a>':
        '<a class="px-btn px-btn--ghost px-btn--sm" href="pricing/" aria-label="Go to the pricing page to book a package">\n        Book a package\n      </a>',
})

PRICING.update({
    'صُنع في مصر — <bdi>Egytronic</bdi>': 'Made in Egypt — <bdi>Egytronic</bdi>',
})

if __name__ == "__main__":
    raise SystemExit(main())
