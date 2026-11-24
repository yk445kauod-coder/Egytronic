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
    "<title>Egytronic — هندسة برمجيات وأنظمة ذكاء اصطناعي</title>":
        "<title>Egytronic — Software engineering and AI systems</title>",
    "Egytronic شركة برمجيات مصرية تبني الأنظمة والبرمجيات وأنظمة الذكاء الاصطناعي، وتنشر نماذجها بأوزان مفتوحة. أول إصدار: Egytronic 16-bit المبني على Llama 3.1 8B.":
        "Egytronic is an Egyptian software company building systems, software and AI, and publishing its models with open weights. First release: Egytronic 16-bit, built on Llama 3.1 8B.",
    "Egytronic — هندسة برمجيات وأنظمة ذكاء اصطناعي":
        "Egytronic — Software engineering and AI systems",
    "شركة برمجيات مصرية تبني الأنظمة وأنظمة الذكاء الاصطناعي. Egytronic 16-bit مبني على Llama 3.1 8B بأوزان مفتوحة.":
        "An Egyptian software company building systems and AI. Egytronic 16-bit is built on Llama 3.1 8B with open weights.",
    "Egytronic — برمجيات وأنظمة ذكية، مبنية في مصر":
        "Egytronic — software and intelligent systems, built in Egypt",
    "شركة برمجيات مصرية تبني الأنظمة وأنظمة الذكاء الاصطناعي وتنشر نماذجها بأوزان مفتوحة.":
        "An Egyptian software company building systems and AI, and publishing its models with open weights.",
    '<meta property="og:locale" content="ar_EG">':
        '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ar_EG">',

    # ── shell ───────────────────────────────────────────────
    '<html lang="ar" dir="rtl">': '<html lang="en" dir="ltr">',
    '<a class="skip" href="#main">تخطَّ إلى المحتوى</a>': '<a class="skip" href="#main">Skip to content</a>',
    'aria-label="Egytronic — الرئيسية"': 'aria-label="Egytronic — home"',
    'aria-label="التنقل الرئيسي"': 'aria-label="Main navigation"',
    '<a class="lang" href="/en/" hreflang="en" lang="en" aria-label="Switch to English">EN</a>':
        '<a class="lang" href="/" hreflang="ar" lang="ar" aria-label="Switch to Arabic">AR</a>',
    'aria-label="فتح القائمة" data-label-open="فتح القائمة" data-label-close="إغلاق القائمة"':
        'aria-label="Open menu" data-label-open="Open menu" data-label-close="Close menu"',
    '<a href="#top">الرئيسية</a>': '<a href="#top">Home</a>',
    '<a href="#model">النموذج</a>': '<a href="#model">Model</a>',
    '<a href="#how">منهجية العمل</a>': '<a href="#how">Process</a>',
    '<a href="#about">عن الشركة</a>': '<a href="#about">Company</a>',
    '<a href="#capabilities">القدرات</a>': '<a href="#capabilities">Capabilities</a>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="/en/pricing/">Prices</a></li>',
    '<a href="#contact">تواصل</a>': '<a href="#contact">Contact</a>',
    '<li><a href="#faq">الأسئلة</a></li>': '<li><a href="#faq">FAQ</a></li>',

    # ── hero ────────────────────────────────────────────────
    '<span class="px-tag">شركة برمجيات وذكاء اصطناعي — مصر</span>':
        '<span class="px-tag">Software &amp; AI company — Egypt</span>',
    '<span class="line">برمجيات وأنظمة ذكية.</span>': '<span class="line">Software and AI systems.</span>',
    '<span class="line"><em>نبنيها في مصر، ونفتحها</em>.</span>':
        '<span class="line"><em>Built in Egypt, and open</em>.</span>',
    "نبني البرمجيات وأنظمة الذكاء الاصطناعي، وننشر ما نبنيه بأوزان مفتوحة.":
        "We build software and AI systems, and publish what we build with open weights.",
    '<span class="nowrap">أول إصدار:</span> <bdi>Egytronic 16-bit</bdi> المبني على <bdi>Llama 3.1 8B</bdi>.':
        '<span class="nowrap">First release:</span> <bdi>Egytronic 16-bit</bdi>, built on <bdi>Llama 3.1 8B</bdi>.',
    "عرض النموذج على HuggingFace": "View the model on HuggingFace",
    '<a class="px-btn px-btn--ghost" href="#contact">تحدث معنا</a>':
        '<a class="px-btn px-btn--ghost" href="#contact">Talk to us</a>',
    '<span class="stat__l">المعاملات</span>': '<span class="stat__l">Parameters</span>',
    '<span class="stat__l">طول السياق</span>': '<span class="stat__l">Context length</span>',
    '<span class="stat__l">صيغة الأوزان</span>': '<span class="stat__l">Weight format</span>',
    '<span class="stat__n">مفتوحة</span>': '<span class="stat__n">Open</span>',
    '<span class="stat__l">الأوزان</span>': '<span class="stat__l">Weights</span>',

    # ── model ───────────────────────────────────────────────
    '<span class="px-tag px-tag--mint">الإصدار الأول</span>':
        '<span class="px-tag px-tag--mint">First release</span>',
    "نموذج لغوي كبير مبني على <bdi>Llama 3.1 8B</bdi>، متاح بأوزان مفتوحة للتنزيل والتشغيل على بنيتك التحتية.":
        "A large language model built on <bdi>Llama 3.1 8B</bdi>, published with open weights you can download and run on your own infrastructure.",
    "مواصفات نموذج Egytronic 16-bit": "Egytronic 16-bit model specifications",
    '<th scope="row">المعمارية</th>': '<th scope="row">Architecture</th>',
    '<th scope="row">طول السياق</th>': '<th scope="row">Context length</th>',
    '<th scope="row">صيغة الأوزان</th>': '<th scope="row">Weight format</th>',
    '<th scope="row">ملف الأوزان</th>': '<th scope="row">Weight file</th>',
    '<th scope="row">اللغات</th>': '<th scope="row">Languages</th>',
    '<th scope="row">الترخيص</th>': '<th scope="row">License</th>',
    '<th scope="row">الاستضافة</th>': '<th scope="row">Hosting</th>',
    "131,072 توكن": "131,072 tokens",
    "GGUF \u00b7 F16 (حوالي 16GB)": "GGUF \u00b7 F16 (~16GB)",
    "العربية والإنجليزية": "Arabic and English",
    "فتح على HuggingFace": "Open on HuggingFace",
    "بطاقة النموذج": "Model card",

    # ── capabilities ────────────────────────────────────────
    '<span class="px-tag">ما نبنيه</span>': '<span class="px-tag">What we build</span>',
    "ثلاث قدرات، بمعيار واحد": "Three capabilities, one standard",
    "نفس مستوى الهندسة يُطبَّق على كل ما نسلّمه: البرمجيات، النماذج، والتشغيل.":
        "The same engineering standard applies to everything we deliver: software, models and operations.",
    "<h3>برمجيات</h3>": "<h3>Software</h3>",
    "أنظمة خلفية وواجهات وأدوات داخلية تُبنى لتُشغَّل وتُصان بعد الإطلاق، لا للعرض فقط.":
        "Backend systems, interfaces and internal tools built to run and be maintained after launch, not just to demo.",
    "<h3>نماذج</h3>": "<h3>Models</h3>",
    "بناء النماذج اللغوية ونشرها بأوزان مفتوحة، مع بطاقة نموذج ونسخة قابلة للتشغيل على جهازك.":
        "Building language models and publishing them with open weights, with a model card and a build you can run on your own machine.",
    "<h3>تشغيل</h3>": "<h3>Operations</h3>",
    "حزم ونشر ومراقبة. النموذج يعمل على بنيتك التحتية أو سحابتك بخطوات موثّقة وقابلة للتكرار.":
        "Packaging, deployment and monitoring. The model runs on your infrastructure or cloud with documented, repeatable steps.",

    # ── process ─────────────────────────────────────────────
    '<span class="px-tag">منهجية العمل</span>': '<span class="px-tag">How we work</span>',
    "أربع مراحل واضحة": "Four clear stages",
    "لكل مرحلة مخرج محدد قبل الانتقال إلى المرحلة التالية.":
        "Each stage has a defined output before the next one starts.",
    "<h3>التصميم</h3>": "<h3>Design</h3>",
    "تحديد المشكلة والنطاق والقيود قبل كتابة أي كود.":
        "Define the problem, scope and constraints before writing any code.",
    "<h3>البناء</h3>": "<h3>Build</h3>",
    "تنفيذ المكوّنات وفق مخطط معماري واضح، بمسؤولية محددة لكل جزء.":
        "Implement components on a clear architecture, with a defined responsibility for each part.",
    "<h3>المراجعة</h3>": "<h3>Review</h3>",
    "فحص أمني ومعماري لكل مخرج قبل النشر.":
        "Security and architecture review of every output before release.",
    "<h3>الإطلاق</h3>": "<h3>Launch</h3>",
    "نشر وقياس على استخدام فعلي، ثم تحسين متكرر.":
        "Ship and measure on real usage, then iterate.",

    # ── company ─────────────────────────────────────────────
    '<span class="px-tag">عن الشركة</span>': '<span class="px-tag">Company</span>',
    "استوديو هندسي، بأوزان مفتوحة": "An engineering studio, open weights",
    "نبني البرمجيات المحيطة بالنماذج — الأدوات والواجهات وبنية التشغيل — وننشرها بأوزان مفتوحة لتستفيد منها الفرق والمطورون.":
        "We build the software around models — tooling, interfaces and runtime — and publish it with open weights for teams and developers to use.",
    '<div class="founder__role">المؤسس</div>': '<div class="founder__role">Founder</div>',
    "<h3>يوسف خميس</h3>": "<h3>Yousef Khamis</h3>",
    "يتولى رؤية المنتج ومعمارية النماذج والإطلاق.":
        "Leads product vision, model architecture and release.",
    "<h3>أوزان مفتوحة</h3>": "<h3>Open weights</h3>",
    "ننشر النماذج بأوزان قابلة للتنزيل والتشغيل على بنيتك التحتية.":
        "We publish models as downloadable weights you can run on your own infrastructure.",
    "<h3>مراجعة قبل النشر</h3>": "<h3>Review before release</h3>",
    "كل مخرج يمر بفحص أمني ومعماري قبل الإطلاق.":
        "Every output goes through a security and architecture review before release.",
    "<h3>قياس وتحسين</h3>": "<h3>Measure and improve</h3>",
    "نحدد مؤشرات النجاح لكل إصدار ونحسّن بناءً على نتائج القياس.":
        "We set success metrics for each release and improve based on what they show.",

    # ── faq ─────────────────────────────────────────────────
    '<span class="px-tag">أسئلة متكررة</span>': '<span class="px-tag">FAQ</span>',
    "أسئلة يطرحها المطوّرون": "Questions developers ask",
    "إجابات مباشرة عن الأوزان والترخيص والتشغيل، وإذا احتجت تفصيلًا أكثر راسلنا.":
        "Direct answers on weights, licensing and local use. If you need more detail, write to us.",
    "ما الذي أحتاج تشغيله محليًا؟": "What do I need to run it locally?",
    "ملف واحد بصيغة <bdi>GGUF</bdi> بحجم قريب من 16GB، ومكتبة تقرأ GGUF مثل <bdi>llama.cpp</bdi> أو <bdi>llama-cpp-python</bdi>. شغّله على ذاكرة (RAM أو VRAM) تكفي لتحميل الأوزان كما هي.":
        "One <bdi>GGUF</bdi> file of about 16GB, and a library that reads GGUF such as <bdi>llama.cpp</bdi> or <bdi>llama-cpp-python</bdi>. Run it with enough RAM or VRAM to hold the weights as they are.",
    "هل يمكن تشغيله على جهاز بذاكرة أقل؟": "Can it run on a machine with less memory?",
    "الملف المتاح حاليًا بدقة <bdi>F16</bdi>. لتقليل الذاكرة يمكنك تكميمه بنفسك بأدوات <bdi>llama.cpp</bdi> قبل التشغيل، مع العلم أن التكميم يقلل الحجم وقد يؤثر على جودة المخرجات.":
        "The published file is <bdi>F16</bdi>. To use less memory, quantise it yourself with <bdi>llama.cpp</bdi> tooling before running. Quantising shrinks the file and may affect output quality.",
    "ما شروط استخدام الأوزان؟": "What are the terms of use?",
    "الأوزان منشورة تحت رخصة <bdi>LLaMA Community</bdi>. الاستخدام التجاري متاح ضمن شروط هذه الرخصة، فراجع نصها في بطاقة النموذج قبل الاعتماد عليه في منتج.":
        "The weights are published under the <bdi>LLaMA Community</bdi> licence. Commercial use is allowed within that licence's terms, so read it on the model card before relying on the model in a product.",
    "كيف أبلغ عن خطأ أو أقترح تحسينًا؟": "How do I report a bug or suggest an improvement?",
    "أرسل التفاصيل على ": "Send the details to ",
    " مع الخطوات التي أدت إلى المشكلة، وسنعود إليك بالرد.":
        " with the steps that led to the problem and we'll get back to you.",

    # ── contact + footer ────────────────────────────────────
    '<span class="px-tag px-tag--mint">تواصل</span>': '<span class="px-tag px-tag--mint">Contact</span>',
    "لنبدأ الحديث": "Let's talk",
    "للاستفسارات والتعاون، تواصل معنا عبر البريد الإلكتروني.":
        "For questions and collaboration, reach us by email.",
    "إرسال بريد": "Send email",
    "نسخ البريد": "Copy email",
    'data-message="تم نسخ البريد الإلكتروني"': 'data-message="Email copied"',
    "البريد الإلكتروني": "Email",
    "صُنع في مصر — ": "Made in Egypt — ",
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
    "صُنع في مصر — ": "Made in Egypt — ",
}

# ── pricing page ────────────────────────────────────────────
PRICING = {
    "<title>قايمة الأسعار — Egytronic</title>": "<title>Price list — Egytronic</title>",
    "باقات Egytronic وأسعارها: لوجو، لاندنج بيدج، موقع ستاتيك، هوية كاملة، موقع ديناميك، والتحول الرقمي الكامل من 28,000 جنيه. الاستضافة والباكند مجاناً أول سنة.":
        "Egytronic packages and prices: logo, landing page, static site, full brand identity, dynamic site, and the end-to-end digital transformation from EGP 28,000. Hosting and backend are free for the first year.",
    "باقات واضحة وأسعار معلنة: من اللوجو للتحول الرقمي الكامل.":
        "Clear packages, published prices: from a logo to a full digital transformation.",
    "قايمة الأسعار — Egytronic": "Price list — Egytronic",
    "Egytronic — قايمة الأسعار": "Egytronic — price list",

    # shell
    '<a class="lang" href="/en/pricing/" hreflang="en" lang="en" aria-label="Switch to English">EN</a>':
        '<a class="lang" href="/pricing/" hreflang="ar" lang="ar" aria-label="Switch to Arabic">AR</a>',
    '<a href="/">الرئيسية</a>': '<a href="../">Home</a>',
    '<a href="/#capabilities">القدرات</a>': '<a href="../#capabilities">Capabilities</a>',
    '<a href="/pricing/" class="is-active" aria-current="page">الأسعار</a>':
        '<a href="./" class="is-active" aria-current="page">Prices</a>',
    '<a href="/#model">النموذج</a>': '<a href="../#model">Model</a>',
    '<a href="/#how">منهجية العمل</a>': '<a href="../#how">Process</a>',
    '<a href="/#about">عن الشركة</a>': '<a href="../#about">Company</a>',
    '<a href="/#contact">تواصل</a>': '<a href="../#contact">Contact</a>',
    '<a href="/#faq">الأسئلة</a>': '<a href="../#faq">FAQ</a>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="./">Prices</a></li>',
    "اطلب عرضًا": "Request a quote",

    # sheet
    '<span class="px-tag">قايمة الأسعار</span>': '<span class="px-tag">Price list</span>',
    "التكنولوجيا اللي فعلاً تساعد بيزنسك يكبر":
        "Technology that actually helps your business grow",
    "من غير وجع دماغ. أسعار معلنة لكل باقة، والدفع مقسّم على مرحلتين.":
        "Without the headache. Every package is priced up front, and payment is split in two stages.",
    "<h3>لوجو</h3>": "<h3>Logo</h3>",
    "شعار مميز لبيزنسك، بملفات جاهزة للاستخدام على الموقع والسوشيال.":
        "A distinctive mark for your business, with files ready for your site and social.",
    "<h3>لاندنج بيدج</h3>": "<h3>Landing page</h3>",
    "صفحة واحدة قوية تعرّف بيزنسك وتحوّل الزيارة لتواصل وحجز.":
        "One focused page that explains the business and turns a visit into a call or a booking.",
    "<h3>موقع ستاتيك</h3>": "<h3>Static site</h3>",
    "موقع سريع وثابت بحد أقصى 5 صفحات، مناسب للتعريف بالنشاط والخدمات.":
        "A fast, fixed site of up to 5 pages for presenting the business and its services.",
    "<h3>هوية كاملة</h3>": "<h3>Full brand identity</h3>",
    "لوجو وألوان وخطوط وعناصر بصرية موحّدة تظهر بيزنسك بشكل احترافي.":
        "Logo, colours, type and visual elements working as one system, so the business looks professional everywhere.",
    "<h3>موقع ديناميك</h3>": "<h3>Dynamic site</h3>",
    "موقع بباكند وقاعدة بيانات، للأنظمة اللي بتتغير وتتحدث وتتفاعل مع عملائك.":
        "A site with a backend and a database, for systems that change, update and respond to your customers.",
    "ابتداءً من": "Starting at",
    '<span class="pricerow__cur">جنيه</span>': '<span class="pricerow__cur">EGP</span>',
    "<span>جنيه</span>": "<span>EGP</span>",

    # bundle
    "التحول الرقمي الكامل": "End-to-end digital transformation",
    "الباقة اللي بتجمع كل حاجة — من الهوية لحد التشغيل، في تسليم واحد.":
        "The package that covers everything — from identity to running it — in one delivery.",
    "جلسة تشخيص وتقرير بالأولويات": "Diagnostic session and a prioritised report",
    "هوية كاملة (لوجو وألوان وخطوط)": "Full brand identity (logo, colours, type)",
    "موقع ديناميك بباكند وقاعدة بيانات": "Dynamic site with backend and database",
    "Google Business وحسابات سوشيال جاهزة": "Google Business profile and social accounts set up",
    "تدريب على الاستخدام": "Training on how to use it",
    "شهر متابعة بعد التسليم": "One month of follow-up after delivery",
    "احجز الباقة": "Book the package",

    # terms + sheet foot
    "معاك في كل باقة": "Included with every package",
    "الاستضافة والباكند مجاناً أول سنة.": "Hosting and backend are free for the first year.",
    "الدومين بيتدفع منفصلاً، أو نتولى الدفع ونحاسبك بفاتورة.":
        "The domain is paid separately, or we pay it and invoice you.",
    "الدفع: 50% مقدم قبل البدء، و50% قبل التسليم النهائي.":
        "Payment: 50% up front before work starts, 50% before final delivery.",
    "الرد في أقل من 24 ساعة": "We reply within 24 hours",
}

# src → out, plus how many directories deep the output sits (asset paths).
PAGES = [
    {
        "src": "index.html",
        "out": "en/index.html",
        "tables": [INDEX],
        "urls": ("https://egytronic.pages.dev/", "https://egytronic.pages.dev/en/"),
        "prefix": "",
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


if __name__ == "__main__":
    raise SystemExit(main())
