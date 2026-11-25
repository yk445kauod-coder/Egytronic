// Build a preview gallery for exported reels and copy it (with the media) to a target dir.
// usage: node scripts/reel-gallery.mjs [targetDir]   (default: <repo>/dist/reels)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const src = resolve("artifacts/reels");
const target = resolve(process.argv[2] || "../dist/reels");
mkdirSync(target, { recursive: true });
const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));

const COPY = {
  "reel-hook": { title: "الافتتاحية", desc: "عنوان حركي + شريط سفلي: أول ٣ ثواني بتحدد إذا حد هيكمّل." },
  "reel-numbers": { title: "أرقام", desc: "رقم كبير يتبدّل مرتين، ووراه فكرة «مصدر واحد»." },
  "reel-logo": { title: "اللوجو", desc: "مسارات SVG ترسم بحبر ثم تتلوّن — علامة بيكسل ١٦-بت." },
  "reel-captions": { title: "كابشن", desc: "كاريوكي كلمة-بكلمة ثم كارت الاسم ولينك الموقع." },
};

for (const m of manifest) {
  for (const ext of ["mp4", "webm", "jpg"]) {
    const file = join(src, `${m.name}.${ext}`);
    if (existsSync(file)) copyFileSync(file, join(target, `${m.name}.${ext}`));
  }
  const scene = join("artifacts", `${m.name}.html`);
  if (existsSync(scene)) copyFileSync(scene, join(target, `scene-${m.name.replace(/^reel-/, "")}.html`));
}

const cards = manifest.map((m) => {
  const copy = COPY[m.name] || { title: m.name, desc: "" };
  return `
    <article class="card">
      <div class="card__media">
        <video poster="${m.name}.jpg" controls muted loop playsinline preload="metadata">
          <source src="${m.name}.mp4" type="video/mp4">
          <source src="${m.name}.webm" type="video/webm">
        </video>
      </div>
      <header>
        <h2>${copy.title}</h2>
        <p>${copy.desc}</p>
      </header>
      <dl>
        <div><dt>المدة</dt><dd>${m.seconds}s</dd></div>
        <div><dt>المقاس</dt><dd>${m.size} · ${m.fps}fps</dd></div>
        <div><dt>المشاهد</dt><dd>${m.scenes}</dd></div>
        <div><dt>الحجم</dt><dd>${(m.mp4 / 1e6).toFixed(2)}MB</dd></div>
      </dl>
      <footer>
        <a href="${m.name}.mp4" download>تنزيل MP4</a>
        <a href="scene-${m.name.replace(/^reel-/, "")}.html">المشهد التفاعلي</a>
      </footer>
    </article>`;
}).join("");

const page = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ريلز Egytronic — معاينة</title>
<style>
:root{--bg:#08080A;--fg:#F5F1E8;--muted:#A3A3A3;--accent:#FF6A00;--line:#22222A;--card:#111116}
*{box-sizing:border-box}
body{margin:0;background:
  linear-gradient(#0d0d11 1px,transparent 1px) 0 0/88px 88px,
  linear-gradient(90deg,#0d0d11 1px,transparent 1px) 0 0/88px 88px,var(--bg);
  color:var(--fg);font-family:"Alexandria","Cairo",system-ui,sans-serif;padding:44px 24px 72px}
.wrap{max-width:1360px;margin:0 auto}
header.top{display:flex;align-items:baseline;justify-content:space-between;gap:24px;flex-wrap:wrap}
h1{font-size:clamp(28px,3.6vw,42px);margin:0;letter-spacing:-.02em}
h1 span{color:var(--accent)}
.sub{color:var(--muted);margin:8px 0 32px;font-size:15px;line-height:1.75;max-width:70ch}
.grid{display:grid;gap:22px;grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:1180px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.card__media{background:#000;aspect-ratio:9/16;display:grid;place-items:center}
video{width:100%;height:100%;object-fit:contain;display:block}
.card header{padding:14px 14px 0}
.card h2{margin:0 0 6px;font-size:17px}
.card p{margin:0;color:var(--muted);font-size:13px;line-height:1.65}
dl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 14px 0;padding:0}
dl div{border:1px solid var(--line);border-radius:9px;padding:7px 9px}
dt{color:var(--muted);font-size:10.5px;margin-bottom:2px}
dd{margin:0;font-size:12.5px;font-variant-numeric:tabular-nums}
footer{display:flex;gap:8px;padding:14px}
footer a{flex:1;text-align:center;text-decoration:none;font-size:12.5px;padding:10px;border-radius:9px;border:1px solid var(--line);color:var(--fg);min-height:42px;display:grid;place-items:center}
footer a:first-child{background:var(--accent);border-color:var(--accent);color:#140A02;font-weight:700}
.note{margin-top:44px;color:var(--muted);font-size:13px;line-height:1.9;border-top:1px solid var(--line);padding-top:18px}
code{color:var(--fg);background:#15151b;padding:2px 6px;border-radius:6px;font-size:12px}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>ريلز <span>Egytronic</span></h1>
    <span class="sub" style="margin:0">1080×1920 · 30fps · H.264</span>
  </header>
  <p class="sub">أربع نماذج من استوديو الموشن. كل واحدة ملف HTML تفاعلي + فيديو جاهز للنشر.</p>
  <div class="grid">${cards}</div>
  <p class="note">الإخراج من الاستوديو: <code>window.print()</code> للوثائق، و<code>node scripts/export-clean.mjs</code> للفيديو — كل إطار يتولّد من محرك الاستوديو كـ PNG ثم يُجمَّع H.264 عبر ffmpeg.</p>
</div>
</body>
</html>`;
writeFileSync(join(target, "index.html"), page);
console.log(`gallery → ${join(target, "index.html")} (${manifest.length} reels)`);
