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
    '<a href="/contact/">تواصل</a>': '<a href="contact/">Contact</a>',
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
    "الأسعار — Egytronic": "Price list — Egytronic",
    "Egytronic — الأسعار": "Egytronic — price list",

    # shell
    '<a href="/">الرئيسية</a>': '<a href="../">Home</a>',
    '<a href="/pricing/" class="is-active" aria-current="page">الأسعار</a>':
        '<a href="./" class="is-active" aria-current="page">Prices</a>',
    '<a href="/#about">عن الشركة</a>': '<a href="../#about">Company</a>',
    '<a href="/contact/">تواصل</a>': '<a href="../contact/">Contact</a>',
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
    "Google Business وحسابات التواصل جاهزة": "Google Business profile and social accounts set up",
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
    '<meta property="og:image:alt" content="Egytronic — الأسعار">':
        '<meta property="og:image:alt" content="Egytronic — software and open tools">',
    '<meta name="twitter:title" content="البرمجيات والأدوات المفتوحة | Egytronic">':
        '<meta name="twitter:title" content="Software and Open Tools | Egytronic">',
    '<meta name="twitter:description" content="ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، تُسلَّم جاهزة للتشغيل.">':
        '<meta name="twitter:description" content="What Egytronic builds: websites, AI systems and tools published in the open, delivered ready to run.">',
    '<a class="lang" href="/en/software/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/software/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="px-tag">البرمجيات</span>': '<span class="px-tag">Software</span>',
    '<h1 id="software-title">ما نبنيه من برمجيات</h1>': '<h1 id="software-title">What we build in software</h1>',
    '<p>مواقع وأنظمة وأدوات نسلّمها جاهزة للتشغيل، وننشر بعضها للجميع.</p>':
        '<p>Websites, systems and tools delivered ready to run; some of them published for everyone.</p>',
    '<h3>مواقع</h3>': '<h3>Websites</h3>',
    '<p class="pricerow__desc">لاندنج بيدج، أو موقع ستاتيك حتى 5 صفحات، أو موقع ديناميك بباكند.</p>':
        '<p class="pricerow__desc">A landing page, a static site of up to 5 pages, or a dynamic site with a backend.</p>',
    '<h3>أنظمة ذكية</h3>': '<h3>Smart systems</h3>',
    '<p class="pricerow__desc">برمجيات وأنظمة ذكاء اصطناعي تُبنى بحسب احتياج مشروعك وتُسلَّم جاهزة.</p>':
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
    '<li><a href="/contact/">تواصل</a></li>': '<li><a href="../contact/">Contact</a></li>',
    '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">Book a package ↗</a></li>',
    '<li><a href="/#faq">الأسئلة</a></li>': '<li><a href="../#faq">FAQ</a></li>',
    '<p class="footer__note">صُنع في مصر — <bdi>Egytronic</bdi></p>':
        '<p class="footer__note">Made in Egypt — <bdi>Egytronic</bdi></p>',
})

INDEX.update({
    '<span class="px-tag">الباقات والأسعار</span>': '<span class="px-tag">Packages and prices</span>',
    '<h2 id="products-title">خمس باقات بأسعار معلنة</h2>':
        '<h2 id="products-title">Five packages, price on the label</h2>',
    '<p>نطاق محدد وسعر معلن وموعد تسليم مكتوب قبل البدء، والدفع على مرحلتين.</p>':
        '<p>Fixed scope, a published price and a delivery date agreed before we start. Payment in two instalments.</p>',
    '<h3>لوجو</h3>': '<h3>Logo</h3>',
    '<h3>لاندنج بيدج</h3>': '<h3>Landing page</h3>',
    '<h3>موقع ستاتيك</h3>': '<h3>Static site</h3>',
    '<h3>هوية كاملة</h3>': '<h3>Full identity</h3>',
    '<h3>موقع ديناميك</h3>': '<h3>Dynamic site</h3>',
    '<p class="prod__desc">شعار يميّز مشروعك، ويصلح للطباعة والاستخدام الرقمي.</p>':
        '<p class="prod__desc">A logo that distinguishes your business, ready for print and digital.</p>',
    '<p class="prod__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>':
        '<p class="prod__desc">One page that introduces your business and services.</p>',
    '<p class="prod__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>':
        '<p class="prod__desc">An informational site of up to 5 pages.</p>',
    '<p class="prod__desc">هوية كاملة: شعار وألوان وخطوط ودليل استخدام.</p>':
        '<p class="prod__desc">A full identity: logo, colours, type and a usage guide.</p>',
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
    '<p class="prods__note">التحول الرقمي الكامل سعره يتحدد بعد الاتفاق على التفاصيل · استضافة وباكند مجانًا في السنة الأولى · الدومين منفصل أو بفاتورة</p>':
        '<p class="prods__note">Full digital transformation is priced after the scope is agreed · hosting and backend free in the first year · domain separate or by invoice</p>',
    '<a href="/software/">': '<a href="software/">',
    '          البرمجيات\n': '          Software\n',
})

INDEX.update({
    'شركة برمجيات مصرية تبني المواقع والهويات والأنظمة الإدارية وأنظمة الذكاء الاصطناعي، بأسعار معلنة تُنشر قبل البدء.':
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

INDEX.update({
    'data-fail="تعذّر النسخ. انسخ البريد يدويًا."':
        'data-fail="Copy failed. Please copy the email manually."',
})

INDEX.update({
    '<span class="prod__flag">الأنسب للبدء</span>':
        '<span class="prod__flag">Best place to start</span>',
    '<a class="prod__link" href="/contact/">احجز الباقة</a>':
        '<a class="prod__link" href="contact/">Book this package</a>',
    '<b>السعر معلن قبل البدء</b>': '<b>The price is on the table</b>',
    '<span>خمس باقات بأرقامها المعلنة، بلا تفاوض على السعر بعد الاتفاق.</span>':
        '<span>Five packages with their numbers, and no price renegotiation after we agree.</span>',
    '<b>استضافة مجانًا سنة</b>': '<b>Hosting free for a year</b>',
    '<span>الاستضافة والباكند على حسابنا في السنة الأولى مع كل باقة.</span>':
        '<span>Hosting and backend are on us in the first year with every package.</span>',
    '<b>الدفع على مرحلتين</b>': '<b>You pay in two steps</b>',
    '<span>50% عند البدء و50% قبل التسليم. لا تُدفع كامل القيمة قبل رؤية العمل.</span>':
        '<span>50% when we start and 50% before delivery. You do not pay it all before you see anything.</span>',
    '<a class="px-btn" href="/contact/">\n              افتح بوابة التواصل\n':
        '<a class="px-btn" href="contact/">\n              Open the contact portal\n',
})

CONTACT = {
    "<title>بوابة التواصل | Egytronic</title>": "<title>Contact Portal | Egytronic</title>",
    '<meta name="description" content="ابدأ مشروعك مع Egytronic: اكتب الباقة التي تهمك ووسيلة التواصل، وسنرد عليك في أقرب وقت.">':
        '<meta name="description" content="Start your project with Egytronic: tell us the package you want and how to reach you, and we will get back to you.">',
    '<meta property="og:title" content="بوابة التواصل | Egytronic">':
        '<meta property="og:title" content="Contact Portal | Egytronic">',
    '<meta property="og:description" content="ابدأ مشروعك مع Egytronic: اكتب الباقة التي تهمك ووسيلة التواصل، وسنرد عليك في أقرب وقت.">':
        '<meta property="og:description" content="Start your project with Egytronic: tell us the package you want and how to reach you, and we will get back to you.">',
    '<meta name="twitter:title" content="بوابة التواصل | Egytronic">':
        '<meta name="twitter:title" content="Contact Portal | Egytronic">',
    '<meta name="twitter:description" content="ابدأ مشروعك مع Egytronic: اكتب الباقة التي تهمك ووسيلة التواصل، وسنرد عليك في أقرب وقت.">':
        '<meta name="twitter:description" content="Start your project with Egytronic: tell us the package you want and how to reach you, and we will get back to you.">',
    '<meta property="og:image:alt" content="Egytronic — بوابة التواصل">':
        '<meta property="og:image:alt" content="Egytronic — contact portal">',
    '<a class="lang" href="/en/contact/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/contact/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="px-tag">بوابة التواصل</span>': '<span class="px-tag">Contact portal</span>',
    '<h1 id="portal-title">أخبرنا عن مشروعك</h1>': '<h1 id="portal-title">Tell us about your project</h1>',
    '<p>اختر الباقة المناسبة واترك وسيلة تواصل، وسنرد عليك في أقرب وقت.</p>':
        '<p>Choose the package that suits you, leave a way to reach you, and we will reply shortly.</p>',
    'data-msg-invalid="راجع الحقول الناقصة: الاسم، وبريد إلكتروني صحيح، ورسالة لا تقل عن 10 أحرف."':
        'data-msg-invalid="Check the missing fields: a name, a valid email and a message of at least 10 characters."',
    'data-msg-sending="جاري الإرسال…"': 'data-msg-sending="Sending…"',
    'data-msg-ok="وصلتنا رسالتك، وسنرد على وسيلة التواصل التي أدخلتها."':
        'data-msg-ok="We received your message and will reply using the contact details you left."',
    'data-msg-rate="وردتنا طلبات كثيرة من هذا الجهاز. يُرجى المحاولة بعد قليل."':
        'data-msg-rate="Too many messages from this device. Wait a little and try again."',
    'data-msg-down="الإرسال غير متاح حاليًا."': 'data-msg-down="Sending is unavailable right now."',
    'data-msg-offline="لا يوجد اتصال بالشبكة."': 'data-msg-offline="No network connection."',
    'data-msg-button="إرسال الطلب"': 'data-msg-button="Send the request"',
    '<label for="cf-name">الاسم</label>': '<label for="cf-name">Name</label>',
    'placeholder="اسمك أو اسم المشروع"': 'placeholder="Your name or business"',
    '<label for="cf-phone">واتساب أو موبايل <span class="field__opt">(اختياري)</span></label>':
        '<label for="cf-phone">WhatsApp or mobile <span class="field__opt">(optional)</span></label>',
    '<label for="cf-package">الباقة</label>': '<label for="cf-package">Package</label>',
    '<option value="unsure">لم يُحدَّد بعد</option>': '<option value="unsure">Not sure yet</option>',
    '<option value="logo">لوجو — 5,000 جنيه</option>': '<option value="logo">Logo — EGP 5,000</option>',
    '<option value="landing">لاندنج بيدج — 6,000 جنيه</option>': '<option value="landing">Landing page — EGP 6,000</option>',
    '<option value="static">موقع ستاتيك — 8,000 جنيه</option>': '<option value="static">Static site — EGP 8,000</option>',
    '<option value="identity">هوية كاملة — 10,000 جنيه</option>': '<option value="identity">Full identity — EGP 10,000</option>',
    '<option value="dynamic">موقع ديناميك — من 18,000 جنيه</option>': '<option value="dynamic">Dynamic site — from EGP 18,000</option>',
    '<option value="transform">تحول كامل — السعر بالاتفاق</option>': '<option value="transform">Full transformation — priced by agreement</option>',
    '<label for="cf-message">الرسالة</label>': '<label for="cf-message">Message</label>',
    'placeholder="ما المشروع؟ وما أهم ما تحتاجه؟"': 'placeholder="What is the project, and what matters most to you?"',
    '<label for="cf-website">موقعك</label>': '<label for="cf-website">Your website</label>',
    '<button class="px-btn" type="submit" data-submit>إرسال الطلب</button>':
        '<button class="px-btn" type="submit" data-submit>Send the request</button>',
    '<a class="portal__mail" href="mailto:egytronic.official@googlemail.com">أو راسلنا على البريد</a>':
        '<a class="portal__mail" href="mailto:egytronic.official@googlemail.com">Or email us directly</a>',
    'data-message="تم نسخ البريد" data-fail="تعذّر النسخ. انسخ البريد يدويًا.">نسخ البريد</button>':
        'data-message="Email copied" data-fail="Copy failed. Please copy the email manually.">Copy email</button>',
    '<h3>ماذا يحدث بعد الإرسال</h3>': '<h3>What happens after you send</h3>',
    '<li><span>01</span> نقرأ الطلب والباقة المختارة.</li>': '<li><span>01</span> We read the request and the package you picked.</li>',
    '<li><span>02</span> نرد على البريد الإلكتروني أو رقم واتساب الذي أدخلته.</li>': '<li><span>02</span> We reply on the email or WhatsApp you left.</li>',
    '<li><span>03</span> إن كان الطلب مناسبًا، نحدد النطاق ونبدأ.</li>': '<li><span>03</span> If it fits, we agree the scope and start.</li>',
    '<h3>السعر معلن مقدمًا</h3>': '<h3>The price is public up front</h3>',
    '<p>كل باقة بسعرها المعلن، والدفع 50% عند البدء و50% قبل التسليم.</p>':
        '<p>Every package has its printed price: 50% to start and 50% before delivery.</p>',
    '<a class="px-btn px-btn--ghost px-btn--sm" href="/pricing/">اطّلع على الأسعار</a>':
        '<a class="px-btn px-btn--ghost px-btn--sm" href="../pricing/">See prices</a>',
    '            تعذّر إرسال الطلب. راسلنا على\n': '            Sending failed. Write to us at\n',
}

CONTACT.update({
    '<li><a href="/">الرئيسية</a></li>': '<li><a href="../">Home</a></li>',
    '<li><a href="/#capabilities">الخدمات</a></li>': '<li><a href="../#capabilities">Services</a></li>',
    '<li><a href="/pricing/">الأسعار</a></li>': '<li><a href="../pricing/">Prices</a></li>',
    '<li><a href="/#how">المنهجية</a></li>': '<li><a href="../#how">Process</a></li>',
    '<li><a href="/#about">عن الشركة</a></li>': '<li><a href="../#about">Company</a></li>',
    '<li><a href="/contact/">تواصل</a></li>': '<li><a href="../contact/">Contact</a></li>',
    '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="mailto:egytronic.official@googlemail.com">Book a package ↗</a></li>',
    'اطلب عرضًا': 'Request a quote',
    '<li><a href="/#faq">الأسئلة</a></li>': '<li><a href="../#faq">FAQ</a></li>',
    '<p class="footer__note">صُنع في مصر — <bdi>Egytronic</bdi></p>':
        '<p class="footer__note">Made in Egypt — <bdi>Egytronic</bdi></p>',
})

TAB = {
    'aria-label="تنقل سريع"': 'aria-label="Quick navigation"',
    '<span>الرئيسية</span>': '<span>Home</span>',
    '<span>الخدمات</span>': '<span>Services</span>',
    '<span>الأسعار</span>': '<span>Prices</span>',
    '<span>تواصل</span>': '<span>Contact</span>',
}


def fix_tabbar(html: str, prefix: str) -> str:
    """The bottom bar is shared markup; only its hrefs depend on page depth."""
    start = html.find('<nav class="tabbar"')
    if start == -1:
        return html
    end = html.find("</nav>", start) + len("</nav>")
    block = html[start:end]
    for href, target in (
        ('href="/"', f'href="{prefix}"'),
        ('href="/#capabilities"', f'href="{prefix}#capabilities"'),
        ('href="/pricing/"', f'href="{prefix}pricing/"'),
        ('href="/contact/"', f'href="{prefix}contact/"'),
    ):
        block = block.replace(href, target)
    return html[:start] + block + html[end:]


PAGES = [
    {
        "src": "index.html",
        "out": "en/index.html",
        "tables": [INDEX],
        "urls": ("https://egytronic.pages.dev/", "https://egytronic.pages.dev/en/"),
        "prefix": "",
    },
    {
        "src": "contact/index.html",
        "out": "en/contact/index.html",
        "tables": [SHARED, CONTACT],
        "urls": ("https://egytronic.pages.dev/contact/", "https://egytronic.pages.dev/en/contact/"),
        "prefix": "../",
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
    for table in page["tables"] + [TAB]:
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
    html = fix_tabbar(html, prefix)

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
    "<title>Egytronic | برمجيات تُسلَّم جاهزة، بأسعار معلنة</title>":
        "<title>Egytronic | Software and AI Systems, Public Prices</title>",
    "مواقع وهوية وأنظمة إدارية وذكاء اصطناعي، بخمس باقات تبدأ من 5,000 جنيه. نطاق محدد وسعر معلن وموعد تسليم، والاستضافة والباكند مجانًا في السنة الأولى.":
        "Websites, brand identity, business systems and AI, in five packages from EGP 5,000. A published price and delivery date. Hosting and backend free in year one.",
    "شركة برمجيات مصرية. نبني موقعك أو هويتك، ونسطّب نظامك الإداري ونكيّفه على شغلك. خمس باقات من 5,000 جنيه.":
        "An Egyptian software company. We build your site or brand, and install and adapt a management system for your business. Five packages from EGP 5,000.",
    '<li><a href="#capabilities">الخدمات</a></li>': '<li><a href="#capabilities">Services</a></li>',
    '<li><a href="#how">المنهجية</a></li>': '<li><a href="#how">Process</a></li>',
    '<li class="nav-ext"><a href="/pricing/">احجز باقتك ↗</a></li>':
        '<li class="nav-ext"><a href="../pricing/">Book a package ↗</a></li>',
    '<a class="lang" href="/en/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="px-tag">شركة برمجيات مصرية · أسعار معلنة</span>':
        '<span class="px-tag">Egyptian software studio · public pricing</span>',
    "<span class=\"line\">برمجيات تُسلَّم جاهزة</span>":
        "<span class=\"line\">Software delivered ready</span>",
    "<span class=\"line\"><em>بسعر معلن قبل أن تبدأ</em></span>":
        "<span class=\"line\"><em>at a published price</em></span>",
    "مواقع وهوية وأنظمة إدارية وذكاء اصطناعي، بخمس باقات تبدأ من 5,000 جنيه، ولكل باقة نطاق محدد وموعد تسليم. الاستضافة والباكند مجانًا في السنة الأولى.":
        "Websites, brand identity, business systems and AI, in five packages from EGP 5,000. Each has a fixed scope and a delivery date. Hosting and backend are free in year one.",
    '<a class="px-btn" href="/pricing/">اطّلع على الأسعار</a>': '<a class="px-btn" href="pricing/">See prices</a>',
    '<a class="px-btn px-btn--ghost" href="#contact">أرسل تفاصيل مشروعك</a>':
        '<a class="px-btn px-btn--ghost" href="#contact">Send your project brief</a>',
    '<span class="stat__n">5,000</span><span class="stat__l">أقل باقة · جنيه</span>':
        '<span class="stat__n">5,000</span><span class="stat__l">lowest package · EGP</span>',
    '<span class="stat__n">50%</span><span class="stat__l">دفعة مقدمة</span>':
        '<span class="stat__n">50%</span><span class="stat__l">upfront payment</span>',
    '<span class="stat__n">سنة</span><span class="stat__l">استضافة وباكند</span>':
        '<span class="stat__n">Year 1</span><span class="stat__l">hosting + backend</span>',
    '<span class="stat__l">عربي وإنجليزي</span>': '<span class="stat__l">Arabic and English</span>',
    '<span class="px-tag">الخدمات</span>': '<span class="px-tag">Services</span>',
    '<h2>ثلاث خدمات، بأسعار معلنة</h2>': '<h2>Three services, public prices</h2>',
    '<p>كل خدمة تبدأ من باقة محددة النطاق، وتُسلَّم جاهزة للاستخدام.</p>': '<p>Each one starts from a package with a fixed scope and is delivered ready to use.</p>',
    '<span class="ledger__k">WEB</span>': '<span class="ledger__k">WEB</span>',
    '<h3>مواقع</h3>': '<h3>Websites</h3>',
    '<p>لاندنج بيدج، أو موقع ستاتيك حتى 5 صفحات، أو موقع ديناميك بباكند.</p>':
        '<p>A landing page, a static site of up to 5 pages, or a dynamic site with a backend.</p>',
    '<span class="ledger__k">BRAND</span>': '<span class="ledger__k">BRAND</span>',
    '<h3>هوية</h3>': '<h3>Brand</h3>',
    '<p>لوجو وحده، أو هوية كاملة تجمع عناصر مشروعك البصرية.</p>':
        '<p>A logo on its own, or a full identity covering your visual elements.</p>',
    '<h3>أنظمة ذكية</h3>': '<h3>Smart systems</h3>',
    '<p>برمجيات وأنظمة ذكاء اصطناعي تُبنى بحسب احتياج مشروعك وتُسلَّم جاهزة.</p>':
        "<p>Software and AI systems built to your project's needs and delivered ready.</p>",
    '<span class="px-tag">المنهجية</span>': '<span class="px-tag">Process</span>',
    '<h2>أربع مراحل حتى التسليم</h2>': '<h2>Four stages to delivery</h2>',
    '<p>لكل مرحلة مخرج واضح قبل أن تبدأ التي بعدها.</p>':
        '<p>Each stage has a clear output before the next begins.</p>',
    '<p>نحدد المطلوب والنطاق والقيود، ثم نصمم الواجهات والتدفقات قبل كتابة أي كود.</p>':
        '<p>We set the goal, scope and limits before writing any code.</p>',
    '<p>ننفذ المخطط المتفق عليه جزءًا جزءًا.</p>': '<p>We build the agreed plan, one part at a time.</p>',
    '<p>نفحص كل مخرج من ناحية الأمان والبنية قبل النشر.</p>':
        '<p>We check every output for security and structure before release.</p>',
    '<p>ننشر العمل ونسلّمه لك جاهزًا للتشغيل.</p>': '<p>We publish the work and hand it over ready to run.</p>',
    '<h2>من يبني مشروعك</h2>': '<h2>Who builds your project</h2>',
    '<p>شركة برمجيات مصرية يعمل عليها المؤسس مباشرة، من تحديد النطاق حتى التشغيل.</p>':
        '<p>An Egyptian software company where the founder works directly, from scope to launch.</p>',
    '<p>يتولى رؤية المنتج ومعمارية الأنظمة والإطلاق.</p>':
        '<p>Leads product vision, system architecture and launch.</p>',
    '<span class="principle__k">01 / DELIVERY</span>': '<span class="principle__k">01 / DELIVERY</span>',
    '<h3>تسليم جاهز</h3>': '<h3>Ready on delivery</h3>',
    '<p>لا نعدّ العمل منتهيًا قبل تشغيله لديك.</p>': "<p>We don't count work as done until it runs for you.</p>",
    '<span class="principle__k">02 / PRICING</span>': '<span class="principle__k">02 / PRICING</span>',
    '<h3>أسعار معلنة</h3>': '<h3>Public prices</h3>',
    "<p>ترى سعر كل باقة قبل أن تتواصل معنا.</p>": "<p>You see each package's price before you contact us.</p>",
    '<h3>أدوات مفتوحة</h3>': '<h3>Open tools</h3>',
    '<p>ننشر بعض أدواتنا على GitHub، متاحة للاستخدام والمراجعة.</p>': '<p>We publish some of our tools on GitHub, open to use and review.</p>',
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
    "<title>أسعار باقات Egytronic | تبدأ من 5,000 جنيه</title>":
        "<title>Egytronic Pricing | From EGP 5,000</title>",
    '<span class="px-tag">الأسعار المعلنة</span>': '<span class="px-tag">Public pricing</span>',
    '<h1 id="prices-title">خمس باقات بأسعار معلنة</h1>': '<h1 id="prices-title">Five packages, public prices</h1>',
    '<p>الدفع 50% مقدمًا عند البدء و50% قبل التسليم النهائي، بالجنيه المصري.</p>':
        '<p>Pay 50% upfront to start and 50% before final delivery, in Egyptian pounds.</p>',
    '<p class="pricerow__desc">شعار يميّز مشروعك، ويصلح للطباعة والاستخدام الرقمي.</p>':
        '<p class="pricerow__desc">A logo that distinguishes your business, ready for print and digital.</p>',
    '<p class="pricerow__desc">صفحة واحدة تعرّف بمشروعك وخدماتك.</p>':
        '<p class="pricerow__desc">One page that introduces your business and services.</p>',
    '<p class="pricerow__desc">موقع تعريفي بحد أقصى 5 صفحات.</p>':
        '<p class="pricerow__desc">An informational site of up to 5 pages.</p>',
    '<p class="pricerow__desc">هوية كاملة: شعار وألوان وخطوط ودليل استخدام.</p>':
        '<p class="pricerow__desc">A full identity: logo, colours, type and a usage guide.</p>',
    '<p class="pricerow__desc">موقع بباكند يناسب المحتوى والوظائف المتغيرة.</p>':
        '<p class="pricerow__desc">A site with a backend for changing content and features.</p>',
    '<p class="bundle__lead">سعره يتحدد بعد الاتفاق على التفاصيل: بنحدد النطاق معك الأول، وبعدها بنكتب السعر في العرض قبل بدء أي شغل.</p>':
        '<p class="bundle__lead">Its price is set after the scope is agreed: we settle the scope with you first, then write the price into the offer before any work starts.</p>',
    '<p class="bundle__price">\n            <span class="pricerow__from">السعر</span>\n            <strong>يتحدد بعد الاتفاق</strong>\n          </p>':
        '<p class="bundle__price">\n            <span class="pricerow__from">Price</span>\n            <strong>set after the scope is agreed</strong>\n          </p>',
    'السعر': 'Price',
    'يتحدد بعد الاتفاق': 'set after the scope is agreed',
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
    "<title>أسعار باقات Egytronic | تبدأ من 5,000 جنيه</title>":
        "<title>Egytronic Pricing | From EGP 5,000</title>",
    '<meta name="description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta name="description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta property="og:description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta property="og:description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta name="twitter:description" content="لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.">':
        '<meta name="twitter:description" content="Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.">',
    '<meta property="og:title" content="أسعار باقات Egytronic | تبدأ من 5,000 جنيه">':
        '<meta property="og:title" content="Egytronic Pricing | From EGP 5,000">',
    '<a class="lang" href="/en/pricing/" hreflang="en" lang="en" aria-label="التبديل إلى النسخة الإنجليزية" title="عرض الموقع بالإنجليزية">EN</a>':
        '<a class="lang" href="/pricing/" hreflang="ar" lang="ar" aria-label="Switch to the Arabic version" title="View the site in Arabic">AR</a>',
    '<span class="pricerow__cur">جنيه</span>': '<span class="pricerow__cur">EGP</span>',
    '<span>جنيه</span>': '<span>EGP</span>',
    '<span class="pricerow__from">ابتداءً من</span>': '<span class="pricerow__from">Starting at</span>',

})

INDEX.update({
    '<a class="px-btn px-btn--ghost px-btn--sm" href="/pricing/" aria-label="انتقل إلى صفحة الأسعار لحجز باقة">\n        احجز باقتك\n      </a>':
        '<a class="px-btn px-btn--ghost px-btn--sm" href="pricing/" aria-label="Go to the pricing page to book a package">\n        Book a package\n      </a>',
})

PRICING.update({
    'صُنع في مصر — <bdi>Egytronic</bdi>': 'Made in Egypt — <bdi>Egytronic</bdi>',
})

# ── 2026-11-24: package cards sell themselves; systems + transformation ──
INDEX.update({
    '<p class="prod__who"><span>مناسب لـ</span> مشروع في بدايته</p>':
        '<p class="prod__who"><span>For whom</span> A project just starting</p>',
    '<p class="prod__who"><span>مناسب لـ</span> خدمة واحدة أو منتج واحد</p>':
        '<p class="prod__who"><span>For whom</span> One service or one product</p>',
    '<p class="prod__who"><span>مناسب لـ</span> شركة لديها خدمات وصفحات</p>':
        '<p class="prod__who"><span>For whom</span> A company with services and pages</p>',
    '<p class="prod__who"><span>مناسب لـ</span> علامة تتوسّع وتحتاج تطبيقات</p>':
        '<p class="prod__who"><span>For whom</span> A growing brand that needs applications</p>',
    '<p class="prod__who"><span>مناسب لـ</span> محتوى يتغيّر أسبوعيًا</p>':
        '<p class="prod__who"><span>For whom</span> Content that changes weekly</p>',
    "<li>لوجو أساسي بنسختين</li>": "<li>A primary logo in two versions</li>",
    "<li>ملفات جاهزة للطباعة ووسائل التواصل</li>": "<li>Files ready for print and social</li>",
    "<li>تسليم في 3–5 أيام</li>": "<li>Delivered in 3–5 days</li>",
    "<li>صفحة واحدة بمحتوى منظم</li>": "<li>One page with structured content</li>",
    "<li>نموذج تواصل وزر واتساب</li>": "<li>Contact form and WhatsApp button</li>",
    "<li>تسليم في 5–7 أيام</li>": "<li>Delivered in 5–7 days</li>",
    "<li>حتى 5 صفحات</li>": "<li>Up to 5 pages</li>",
    "<li>تهيئة أساسية لمحركات البحث وسرعة تحميل</li>": "<li>Basic SEO and fast loading</li>",
    "<li>تسليم في 7–10 أيام</li>": "<li>Delivered in 7–10 days</li>",
    "<li>لوجو وألوان وخطوط</li>": "<li>Logo, colours and type</li>",
    "<li>بطاقات أعمال وتصاميم لوسائل التواصل</li>": "<li>Business cards and social media</li>",
    "<li>دليل استخدام مختصر</li>": "<li>A short usage guide</li>",
    "<li>باكند ولوحة تحكم</li>": "<li>Backend and admin panel</li>",
    "<li>قاعدة بيانات ومحتوى تديره بنفسك</li>": "<li>A database and content you manage yourself</li>",
    "<li>تسليم في 3–4 أسابيع</li>": "<li>Delivered in 3–4 weeks</li>",
    '<a class="prod__link" href="/contact/">ناقش مشروعك</a>':
        '<a class="prod__link" href="contact/">Discuss your project</a>',

    '<span class="px-tag">أنظمة إدارية</span>': '<span class="px-tag">Business systems</span>',
    '<h2 id="systems-title">اجمع أعمالك كلها في نظام واحد</h2>':
        '<h2 id="systems-title">Get your whole business running on one system</h2>',
    "<p>نختار معك النظام المناسب لنشاطك، ونثبّته لدى فريقك، ونكيّفه على طريقة عملك: الصلاحيات والتقارير والفواتير والمصطلحات التي يستخدمها فريقك، مع تدريب حتى يعمل عليه بثقة.</p>":
        "<p>We pick the right system for your line of work with you, install it, and tailor it to how you operate: permissions, reports, invoices and the words your team already uses — with training until they run it with confidence.</p>",
    "<h3>إدارة موارد</h3>": "<h3>Resource planning</h3>",
    "<p>مخزون وفواتير ومشتريات وحسابات في نظام واحد.</p>":
        "<p>Stock, invoices, purchasing and accounts in one system.</p>",
    "<h3>إدارة فنادق</h3>": "<h3>Hotel management</h3>",
    "<p>حجوزات وغرف وإقامة وفواتير ومحاسبة نزلاء.</p>":
        "<p>Bookings, rooms, stays, folios and guest billing.</p>",
    "<h3>علاقات عملاء</h3>": "<h3>Customer relations</h3>",
    "<p>عملاء ومتابعات وصفقات وتقارير مبيعات.</p>":
        "<p>Customers, follow-ups, deals and sales reports.</p>",
    "<h3>نقاط بيع</h3>": "<h3>Point of sale</h3>",
    "<p>كاشير وورديات ومخزون لكل فرع.</p>":
        "<p>Checkout, shifts and stock per branch.</p>",
    "<h3>منصة تعليم</h3>": "<h3>Learning platform</h3>",
    "<p>كورسات ودروس واختبارات وشهادات.</p>": "<p>Courses, lessons, quizzes and certificates.</p>",
    "<h3>إدارة عيادات</h3>": "<h3>Clinic management</h3>",
    "<p>مواعيد وملفات مرضى وفواتير وروشتات.</p>":
        "<p>Appointments, patient records, invoices and prescriptions.</p>",
    "<li><b>تسطيب</b> بياناتك ومستخدميك الحاليين</li>":
        "<li><b>Install</b> Existing data and users</li>",
    "<li><b>تكييف</b> الصلاحيات والفواتير والتقارير والمصطلحات</li>":
        "<li><b>Adapt</b> Permissions, invoices, reports and wording</li>",
    "<li><b>تدريب</b> فريقك وتسليم دليل التشغيل</li>":
        "<li><b>Train</b> Your team, plus a runbook</li>",
    '<p class="systems__note reveal">لم تجد ما تحتاجه؟ <a href="/contact/">اطلب نظام مخصص</a> ونحدد النطاق معك.</p>':
        '<p class="systems__note reveal">Not seeing what you need? <a href="contact/">Ask for a custom system</a> and we will scope it with you.</p>',

    '<span class="px-tag px-tag--mint">التحول الرقمي</span>':
        '<span class="px-tag px-tag--mint">Digital transformation</span>',
    '<h2 id="transform-title">من الدفاتر وملفات إكسل إلى نظام متكامل</h2>':
        '<h2 id="transform-title">From notebooks and spreadsheets to a system that runs itself</h2>',
    "<p>نغيّر طريقة العمل نفسها: ترحيل بياناتك من الملفات، وصلاحيات لكل دور، وتقارير لحظية بدل الدفاتر.</p>":
        "<p>We change how the work itself runs: your data moved out of the files, permissions per role, and live reports instead of notebooks.</p>",
    "<h3>بيانات واحدة</h3>": "<h3>One set of data</h3>",
    "<p>بدل الملفات المتفرقة، تجتمع البيانات في قاعدة واحدة.</p>":
        "<p>Instead of scattered files, everything lives in one database.</p>",
    "<h3>تقارير لحظية</h3>": "<h3>Live reports</h3>",
    "<p>المبيعات والمخزون والتحصيل في تقرير واحد، دون سؤال أحد.</p>":
        "<p>Sales, stock and collections without asking anyone.</p>",
    "<h3>صلاحيات لكل دور</h3>": "<h3>Permissions per role</h3>",
    "<p>كل موظف يرى ما يخصه فقط.</p>": "<p>Every employee sees only what concerns them.</p>",
    "<h3>ربط وأتمتة</h3>": "<h3>Integrations and automation</h3>",
    "<p>الدفع والمخزون والواتساب مترابطة في تدفق واحد.</p>":
        "<p>Payments, stock and WhatsApp talk to each other.</p>",
    '<p class="transform__price"><span>التحول الكامل</span> سعره يتحدد بعد الاتفاق</p>':
        '<p class="transform__price"><span>Full transformation</span> priced after the scope is agreed</p>',
    '<p class="transform__note">بعد أول مكالمة نحدد النطاق والتفاصيل، وبعدها بنكتب السعر في العرض. الدفع 50% عند البدء و50% قبل التسليم.</p>':
        '<p class="transform__note">After a first call we settle the scope and the details, then put the price in the offer. Pay 50% to start and 50% before delivery.</p>',
    '<a class="px-btn" href="/contact/">اطلب تقييم لمشروعك</a>':
        '<a class="px-btn" href="contact/">Request a project assessment</a>',
})

if __name__ == "__main__":
    raise SystemExit(main())
