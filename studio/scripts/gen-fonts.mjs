/* Adds Google Fonts families to the document font set, self-hosted.

   Fetches the CSS2 stylesheet with a modern UA (that is what returns woff2 with a unicode-range
   per subset), downloads only the arabic and latin subsets, and records them in
   assets/fonts/fonts.json — which lib/fonts.js embeds as data URIs at build time.

   node scripts/gen-fonts.mjs            add the families in FAMILIES that are missing
   node scripts/gen-fonts.mjs --list     print what is installed
   node scripts/gen-fonts.mjs Manrope    add one family by name   */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../assets/fonts");
const MANIFEST = join(DIR, "fonts.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const FAMILIES = [
  // arabic-first
  ["Noto Sans Arabic", "body-ar"], ["Changa", "display-ar"], ["El Messiri", "display-ar"],
  ["Lalezar", "display-ar"], ["Reem Kufi", "display-ar"], ["Markazi Text", "serif-ar"],
  ["Mada", "body-ar"], ["Baloo Bhaijaan 2", "display-ar"], ["Kufam", "display-ar"],
  ["Vazirmatn", "body-ar"], ["Aref Ruqaa", "serif-ar"], ["Harmattan", "body-ar"],
  // latin
  ["Manrope", "body-latin"], ["Outfit", "display-latin"], ["Sora", "display-latin"],
  ["Figtree", "body-latin"], ["Plus Jakarta Sans", "body-latin"], ["Libre Franklin", "body-latin"],
  ["Lora", "serif-latin"], ["Newsreader", "serif-latin"], ["Fraunces", "serif-latin"],
  ["Bricolage Grotesque", "display-latin"], ["Archivo", "body-latin"], ["Crimson Pro", "serif-latin"],
  ["Fira Code", "mono-latin"], ["IBM Plex Sans", "body-latin"], ["Space Mono", "mono-latin"],
  ["Instrument Serif", "serif-latin"], ["Montserrat", "display-latin"], ["Work Sans", "body-latin"],
];
const WEIGHTS = [400, 700];
const slugOf = (family) => family.toLowerCase().replace(/[+\s]+/g, "-");
const subsetOf = (range) => (/U\+0600/.test(range || "") ? "arabic" : /U\+0000-00FF/.test(range || "") ? "latin" : null);

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const have = new Set(manifest.map((e) => e.family.toLowerCase()));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function addFamily(family, role = "body-latin") {
  const slug = slugOf(family);
  const query = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${WEIGHTS.join(";")}&display=block`;
  const css = await fetchText(query);
  const faces = [];
  for (const block of css.split("@font-face").slice(1)) {
    const weight = Number((block.match(/font-weight:\s*(\d+)/) || [])[1] || 400);
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1]?.trim();
    const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    const subset = subsetOf(range);
    if (!url || !subset || !WEIGHTS.includes(weight)) continue;
    const file = `${slug}-${subset}-${weight}.woff2`;
    const bytes = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    writeFileSync(join(DIR, file), bytes);
    faces.push({ subset, weight, file, bytes: bytes.length, unicodeRange: range });
  }
  if (!faces.length) throw new Error("no arabic/latin woff2 in the stylesheet");
  try {
    const licence = await fetchText(`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`);
    writeFileSync(join(DIR, `OFL-${slug.replace(/-/g, "")}.txt`), licence);
  } catch { /* some families live under a different directory; the family ships OFL anyway */ }
  manifest.push({ family, slug, role, files: faces.map(({ subset, weight, file, unicodeRange }) => ({ subset, weight, file, unicodeRange })) });
  return faces.length;
}

const args = process.argv.slice(2);
if (args.includes("--list")) {
  console.log(manifest.map((e) => `${e.family}  (${e.files.length} faces)`).join("\n"));
  process.exit(0);
}

const wanted = args.length ? args.map((name) => [name, manifest.find((e) => e.family === name)?.role || "body-latin"]) : FAMILIES;
let added = 0, faces = 0;
for (const [family, role] of wanted) {
  if (have.has(family.toLowerCase())) continue;
  try {
    const n = await addFamily(family, role);
    added += 1;
    faces += n;
    console.log(`+ ${family} — ${n} faces`);
  } catch (error) {
    console.log(`! ${family} — ${error.message}`);
  }
}
manifest.sort((a, b) => a.family.localeCompare(b.family));
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${added} families, ${faces} faces added · ${manifest.length} families total`);
