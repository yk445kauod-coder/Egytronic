export type Project = {
  slug: string;
  url: string;
  ar: { name: string; kind: string; what: string };
  en: { name: string; kind: string; what: string };
};

export const PROJECTS: Project[] = [
  {
    slug: "panda-wok",
    url: "https://panda-wok.pages.dev",
    ar: {
      name: "Panda Wok",
      kind: "مطعم آسيوي · الإسكندرية",
      what: "قائمة كاملة، سلة وطلب توصيل، وتتبع للطلب من المطبخ للباب، بواجهة عربية وإنجليزية.",
    },
    en: {
      name: "Panda Wok",
      kind: "Asian kitchen · Alexandria",
      what: "Full menu, basket and delivery ordering, and order tracking from the kitchen to the door, in Arabic and English.",
    },
  },
  {
    slug: "azura",
    url: "https://azura-app.pages.dev",
    ar: {
      name: "Azura Cafe",
      kind: "مقهى · تطبيق ويب",
      what: "واجهة المقهى على الويب بهوية بصرية موحّدة، مصممة للموبايل أولًا.",
    },
    en: {
      name: "Azura Cafe",
      kind: "Café · web app",
      what: "The café's web front, built mobile-first on one visual identity.",
    },
  },
  {
    slug: "chef-ibrahim",
    url: "https://cheif-ibrahim-sabry.pages.dev",
    ar: {
      name: "إبراهيم صبري",
      kind: "موقع شخصي · شيف",
      what: "موقع شخصي لشيف من الإسكندرية، يعرض خبرته في المطبخ الساخن والمأكولات الإيطالية.",
    },
    en: {
      name: "Ibrahim Sabry",
      kind: "Personal site · chef",
      what: "A personal site for an Alexandria chef, covering his work in the hot kitchen and Italian cooking.",
    },
  },
];
