export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  blocks: { h: string; p: string[] }[];
};

export const TERMS: { ar: LegalDoc; en: LegalDoc } = {
  ar: {
    title: "الشروط والأحكام",
    updated: "نوفمبر 2026",
    intro:
      "تنطبق على كل باقة أو مشروع يُطلب من Egytronic. إرسال الطلب يعني قراءتها والموافقة عليها.",
    blocks: [
      {
        h: "طبيعة العمل: أساس مفتوح المصدر وتخصيص كامل",
        p: [
          "المواقع تُبنى لطلبك: التصميم والمحتوى والواجهات تُكتب من أجلك.",
          "الأنظمة الإدارية (ERP، CRM، POS، الفنادق، العيادات، منصات التعليم) قائمة على أساس مفتوح المصدر (Open Source)، ونطوّرها ونخصّصها بالكامل على طريقة عمل فريقك: الصلاحيات، الفواتير، التقارير، المصطلحات، مخرجات الطباعة، والترحيل من ملفاتك الحالية، مع الكود متاحًا لك بلا قيود ترخيص.",
          "لو كان عندك إجراء تشغيلي خاص لا يغطيه الأساس المفتوح، نبنيه لك كإضافة مخصّصة، ويُتفق على نطاقها وسعرها كتابة قبل التنفيذ.",
        ],
      },
      {
        h: "النطاق والتعديلات",
        p: [
          "كل باقة لها نطاق مكتوب في صفحة الأسعار: عدد الصفحات وما يشمله التسليم ومدة التنفيذ.",
          "أي طلب خارج النطاق يُسعَّر منفصلًا ويُتفق عليه كتابة قبل التنفيذ.",
          "التعديلات داخل النطاق تُنفَّذ دون مقابل حتى التسليم. بعده، التعديلات تُطلب كتابة وتُنفَّذ بحسب حجمها.",
        ],
      },
      {
        h: "الأسعار والدفع",
        p: [
          "الأسعار بالجنيه المصري وتشمل ما تذكره الباقة فقط.",
          "الدفع على مرحلتين: 50% عند بدء التنفيذ و50% بعد التسليم، ولا يبدأ العمل قبل الدفعة الأولى.",
          "التحول الرقمي الكامل يُسعَّر بعد مكالمة تحديد النطاق، بنفس شرط الدفع.",
        ],
      },
      {
        h: "المدد والتسليم",
        p: [
          "المدة تبدأ من الاتفاق على النطاق واستلام محتواك (نصوص، صور، شعار، بيانات دخول).",
          "لاندنج بيدج 5–7 أيام، موقع ستاتيك 10 أيام، موقع ديناميك أسبوعين. أي مشروع أكبر من ذلك تُتفق مدته كتابة قبل البدء حسب تفاصيل الشغل. تأخّر المحتوى يؤجّل الموعد بنفس المدة.",
        ],
      },
      {
        h: "الاستضافة والدومين والملكية",
        p: [
          "الاستضافة والباكند مجانًا في السنة الأولى؛ الدومين منفصل ويبقى ملكك.",
          "الكود والمحتوى والتصميم ملكك بعد سداد كامل القيمة، مع دليل تشغيل.",
          "الأساس المفتوح المصدر يبقى تحت ترخيصه الحر، وأنت تملك بياناتك وتخصيصاتك وإضافاتك بالكامل.",
        ],
      },
      {
        h: "الإلغاء وحدود المسؤولية",
        p: [
          "الإلغاء قبل البدء: يُرد المبلغ كاملًا. بعده: يُحتسب ما نُفِّذ فعلًا ويُرد الباقي.",
          "لا نضمن نتيجة تجارية محددة (مبيعات، زوار، ترتيب بحث). نضمن تنفيذ النطاق المتفق عليه بجودة وبالموعد.",
        ],
      },
      {
        h: "التواصل الرسمي",
        p: [
          "كل اتفاق يُوثَّق كتابة عبر egytronic.official@googlemail.com أو واتساب +201277593815، ولا يُعتد بأي اتفاق شفهي.",
        ],
      },
    ],
  },
  en: {
    title: "Terms and conditions",
    updated: "November 2026",
    intro:
      "These apply to every package or project ordered from Egytronic. Sending an enquiry means you have read and accepted them.",
    blocks: [
      {
        h: "The work: an open-source foundation, customised for you",
        p: [
          "Websites are built for you: design, content and interfaces are written for your project.",
          "Management systems (ERP, CRM, POS, hotel, clinic, learning platforms) are based on open-source foundations, and we develop and customise them fully to fit how your team works: permissions, invoices, reports, terminology, printed output, and migration from your current files, with the code available to you without licence restrictions.",
          "If you have a process the open-source foundation does not cover, we build it for you as a custom extension, agreed in writing with its own scope and price before work starts.",
        ],
      },
      {
        h: "Scope and changes",
        p: [
          "Every package has a written scope on the pricing page: pages, what delivery includes, and how long it takes.",
          "Anything outside the scope is priced separately and agreed in writing before work starts.",
          "Changes inside the scope are free until delivery; afterwards they are requested in writing and handled by size.",
        ],
      },
      {
        h: "Prices and payment",
        p: [
          "Prices are in Egyptian pounds and cover only what the package states.",
          "Payment is 50% when work starts and 50% after delivery; work does not begin before the first payment.",
          "A full digital transformation is priced after a scoping call, on the same terms.",
        ],
      },
      {
        h: "Timelines",
        p: [
          "The clock starts when the scope is agreed and your content arrives (text, images, logo, access).",
          "Landing page 5-7 days, static site 10 days, dynamic site 2 weeks. Anything larger has its timeline agreed in writing before work starts, according to the details. Late content moves the date by the same amount.",
        ],
      },
      {
        h: "Hosting, domain and ownership",
        p: [
          "Hosting and backend are free for the first year; the domain is separate and stays yours.",
          "Code, content and design are yours once the full amount is paid, with an operations guide.",
          "The open-source foundation stays under its free licence; you own your data, your customisations and your extensions outright.",
        ],
      },
      {
        h: "Cancellation and limits",
        p: [
          "Cancel before work starts: full refund. After it starts: what was done is charged, the rest refunded.",
          "We do not promise a specific business outcome (sales, visitors, ranking). We promise the agreed scope, done well and on time.",
        ],
      },
      {
        h: "Official communication",
        p: [
          "Every agreement is recorded in writing at egytronic.official@googlemail.com or on WhatsApp at +201277593815; verbal agreements do not count.",
        ],
      },
    ],
  },
};

export const PRIVACY: { ar: LegalDoc; en: LegalDoc } = {
  ar: {
    title: "سياسة الخصوصية",
    updated: "نوفمبر 2026",
    intro:
      "ما نجمعه منك، ولماذا، وأين يُخزَّن، وكيف تطلبه أو تحذفه. لا نبيع بيانات ولا نشاركها للإعلان.",
    blocks: [
      {
        h: "ما نجمعه",
        p: [
          "من نموذج التواصل: الاسم أو اسم المشروع، وسيلة التواصل (بريد أو واتساب)، الباقة، نص الرسالة، وتاريخ الإرسال.",
          "لا نطلب بيانات دفع على الموقع، ولا نستخدم ملفات تعريف ارتباط للتتبع أو الإعلان.",
        ],
      },
      {
        h: "لماذا نجمعه",
        p: [
          "للرد على طلبك وتحديد النطاق وإصدار العرض، ولتنفيذ المشروع ومتابعته بعد التسليم.",
          "لا نستخدم بياناتك في تسويق طرف ثالث ولا نرسل رسائل لم تطلبها.",
        ],
      },
      {
        h: "أين يُخزَّن",
        p: [
          "الرسائل في قاعدة بيانات على Cloudflare (D1) داخل حسابنا، وتُدار من لوحة خاصة بنا.",
          "البريد على egytronic.official@googlemail.com، والواتساب على +201277593815.",
        ],
      },
      {
        h: "المشاركة والاحتفاظ",
        p: [
          "لا نبيع بياناتك ولا نشاركها تجاريًا. قد نشارك الحد الأدنى مع مزوّد يعمل على مشروعك بعد إبلاغك.",
          "نحتفظ بالرسالة للرد والمتابعة، ويمكنك طلب حذفها في أي وقت ما لم يمنع ذلك التزام محاسبي.",
        ],
      },
      {
        h: "حقوقك",
        p: [
          "طلب نسخة من بياناتك، أو تصحيحها، أو حذفها، أو إيقاف التواصل معك.",
          "تُقدَّم الطلبات على البريد أو الواتساب أعلاه، ونرد خلال أيام العمل.",
        ],
      },
      {
        h: "بيانات الأنظمة والأمان",
        p: [
          "في الأنظمة الإدارية، بيانات عملك تُخزَّن في قاعدة بيانات النظام، وتخصيصاتك تبقى ملكك، ولا نطّلع عليها بعد التسليم إلا بطلب منك.",
          "الاتصال بالموقع عبر HTTPS، والوصول إلى قاعدة بيانات الطلبات محصور بحساب المالك بمفتاح محدود الصلاحية.",
        ],
      },
      {
        h: "تغييرات السياسة",
        p: [
          "أي تغيير جوهري يُنشر هنا بتاريخ تحديثه، والاستمرار في استخدام الموقع يعني الموافقة على النسخة المحدَّثة.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "November 2026",
    intro:
      "What we collect, why, where it is stored, and how to request or delete it. We do not sell data or share it for advertising.",
    blocks: [
      {
        h: "What we collect",
        p: [
          "From the contact form: name or project name, a contact method (email or WhatsApp), the package, the message, and when it was sent.",
          "We ask for no payment details on the site and use no tracking or advertising cookies.",
        ],
      },
      {
        h: "Why we collect it",
        p: [
          "To reply, define the scope and issue a proposal, and to deliver and follow up on the project.",
          "We never use your data in third-party marketing and never send messages you did not ask for.",
        ],
      },
      {
        h: "Where it is stored",
        p: [
          "Messages live in a Cloudflare D1 database inside our account, managed from our own console.",
          "Email at egytronic.official@googlemail.com, WhatsApp at +201277593815.",
        ],
      },
      {
        h: "Sharing and retention",
        p: [
          "We do not sell your data or share it commercially. We may share the minimum with a provider working on your project, after telling you.",
          "We keep an enquiry to reply and follow up; you can ask us to delete it at any time unless an accounting obligation prevents it.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "Ask for a copy of your data, correct it, delete it, or ask us to stop contacting you.",
          "Send requests to the email or WhatsApp above; we reply within working days.",
        ],
      },
      {
        h: "System data and security",
        p: [
          "In a management system, your business data lives in that system's database and your customisations stay yours; we do not look at it after delivery unless you ask.",
          "The site is served over HTTPS, and access to the enquiries database is limited to the owner's account with a scoped key.",
        ],
      },
      {
        h: "Changes",
        p: [
          "Any material change is published here with its date; continuing to use the site means you accept the updated version.",
        ],
      },
    ],
  },
};
