"""Build the EN/AR phrase map used by the React renderer from the page tables in
scripts/build-en.py, so the two languages keep a single source of truth."""

import importlib.util
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

spec = importlib.util.spec_from_file_location("build_en", ROOT / "scripts/build-en.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Runs(HTMLParser):
    """Collect the text nodes of a fragment, ignoring whitespace-only nodes."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.runs = []
        self.depth = 0

    def handle_starttag(self, tag, attrs):
        self.depth += 1

    def handle_endtag(self, tag):
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data):
        text = data.strip()
        if text:
            self.runs.append(text)


def runs(fragment: str):
    parser = Runs()
    parser.feed(fragment)
    parser.close()
    return parser.runs


ATTR_ONLY = re.compile(r'^([a-z-]+)="([^"<>]{3,})"$')

pairs = {}
stats = {"fragments": 0, "runs": 0, "skipped": 0, "attr": 0}

tables = [mod.INDEX, mod.TAB]
for page in mod.PAGES:
    tables.extend(page["tables"])

for table in tables:
    for ar, en in table.items():
        stats["fragments"] += 1
        attr = ATTR_ONLY.match(ar)
        if attr:
            attr_en = ATTR_ONLY.match(en)
            if attr_en and attr.group(2) != attr_en.group(2):
                pairs[attr.group(2)] = attr_en.group(2)
                stats["attr"] += 1
            continue
        if "<" not in ar:
            if ar != en:
                pairs[ar] = en
                stats["runs"] += 1
            continue
        a, e = runs(ar), runs(en)
        if not a or len(a) != len(e):
            stats["skipped"] += 1
            continue
        for ar_run, en_run in zip(a, e):
            if ar_run != en_run:
                pairs[ar_run] = en_run
                stats["runs"] += 1


OVERRIDES = {
    "فتح القائمة": "Open menu",
    "إغلاق القائمة": "Close menu",
    "صُنع في مصر": "Built in Egypt",
    "انتقل إلى صفحة الأسعار لحجز باقة": "Go to the pricing page to book a package",
    "التبديل إلى النسخة الإنجليزية": "Switch to English",
    "عرض الموقع بالإنجليزية": "View the site in English",
    "التنقل الرئيسي": "Main navigation",
    "تنقل سريع": "Quick navigation",
    "تخطَّ إلى المحتوى": "Skip to content",
    "احجز باقتك": "Book your package",
    "اطلب عرضًا": "Request a quote",
    "لوجو 5,000، لاندنج بيدج 6,000، موقع ستاتيك 8,000، هوية 10,000، وموقع ديناميك من 18,000 جنيه. الدفع 50% مقدمًا.":
        "Logo 5,000, landing page 6,000, static site 8,000, identity 10,000, dynamic site from 18,000 EGP. Pay 50% upfront.",
    "ما تبنيه Egytronic: مواقع وأنظمة ذكاء اصطناعي وأدوات منشورة علنًا، تُسلَّم جاهزة للتشغيل.":
        "What Egytronic builds: websites, AI systems and tools published in the open, delivered ready to run.",
    "ابدأ مشروعك مع Egytronic: اكتب لنا الباقة اللي تهمك ووسيلة التواصل، ونرد عليك في أقرب وقت.":
        "Start your project with Egytronic: tell us the package you want and how to reach you, and we will get back to you.",
    "نبني موقعك أو هويتك، ونسطّب نظامك الإداري ونكيّفه على شغلك. خمس باقات بأسعار معلنة من 5,000 جنيه، والدفع 50% مقدمًا.":
        "We build your site or brand, and install and adapt a management system for your business. Five public-price packages from EGP 5,000, 50% upfront.",
    "أسعار باقات Egytronic | من 5,000 جنيه": "Egytronic package prices | from EGP 5,000",
    "البرمجيات والأدوات المفتوحة | Egytronic": "Software and open tools | Egytronic",
    "بوابة التواصل | Egytronic": "Contact portal | Egytronic",
    "Egytronic | برمجيات وأنظمة ذكية بأسعار معلنة": "Egytronic | Software and AI systems, public prices",
    "أقسام الصفحة": "Page sections",
    "الخطوة التالية": "Next step",
    "الأسعار معلنة. ابدأ بمكالمة قصيرة": "Prices are public. Start with a short call.",
    "نقول لك أي باقة تكفي شغلك وأيها زيادة، قبل أي دفع.":
        "We tell you which package covers your work and which is overkill, before any payment.",
    "خمس باقات بسعر معلن": "Five packages, public prices",
    "من 5,000 جنيه · دفع 50%": "From EGP 5,000 · 50% upfront",
    "أدوات مفتوحة نستخدمها": "Open tools we use",
    "مستودعات وأدوات حقيقية": "Real repositories and tools",
    "ناقش مشروعك معنا": "Talk through your project",
    "رد على نفس البريد": "Reply on the same email",
    "الباقات": "Packages",
    "ما نبنيه": "What we build",
    "الأدوات المفتوحة": "Open tools",
    "طريقة التسليم": "Delivery",
    "الكل في واحد": "All in one",
    "الشروط": "Terms",
    "الخطوات": "Steps",
}
pairs.update(OVERRIDES)

out = ROOT / "src/i18n/copy.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(pairs, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
print(f"{len(pairs)} phrases -> {out.relative_to(ROOT)}")
print(stats)
