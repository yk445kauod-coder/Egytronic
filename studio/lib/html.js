import { readFileSync } from "node:fs";
import { fontCss, resolveFamily, FALLBACK_STACK } from "./fonts.js";

const RUNTIME = new URL("../runtime/dist/studio.runtime.js", import.meta.url);

const STYLE = `
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#08080A;color:#F5F1E8;font-family:${FALLBACK_STACK};overflow:hidden}
body{display:grid;place-items:center}
#stage{display:block;max-width:100vw;max-height:100vh;background:#000;box-shadow:0 24px 80px rgba(0,0,0,.6)}
body[data-bare="1"] .studio-bar{display:none}
.studio-bar{position:fixed;inset-inline:0;bottom:0;padding:14px 18px 16px;background:linear-gradient(180deg,rgba(8,8,10,0),rgba(8,8,10,.92) 40%);display:grid;gap:10px;z-index:9}
.studio-bar__row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.studio-btn{border:1px solid #2A2A2E;background:#151517;color:#F5F1E8;font:600 13px/1 ${FALLBACK_STACK};padding:10px 14px;border-radius:10px;cursor:pointer;min-height:40px}
.studio-btn:hover{background:#1D1D20}
.studio-btn:disabled{opacity:.5;cursor:progress}
.studio-btn--primary{background:#FF6A00;border-color:#FF6A00;color:#120A02}
.studio-btn--primary:hover{background:#FF7B1F}
.studio-state,.studio-clock,.studio-plan{font:500 12px/1 ui-monospace,monospace;color:#A3A3A3}
.studio-state{margin-inline-start:auto;color:#12B886}
.studio-scrub{width:100%;accent-color:#FF6A00;height:22px}
.studio-status{font:500 12px/1.5 ${FALLBACK_STACK};color:#A3A3A3;min-height:18px}
.studio-status[data-error="1"]{color:#FF5C5C}
`;

function runtimeCode() {
  try {
    return readFileSync(RUNTIME, "utf8");
  } catch {
    throw new Error("runtime bundle missing — run `npm run bundle` inside studio/ first");
  }
}

export function buildHtml(comp) {
  const family = resolveFamily(comp.fontFamily);
  const payload = JSON.stringify({ ...comp, fontFamily: family.family, width: comp.width, height: comp.height }).replace(/</g, "\\u003c");
  const plan = `${family.family} · ${comp.size || `${comp.width}x${comp.height}`} · ${comp.fps || 60}fps`;
  return `<!doctype html>
<html lang="${comp.lang || "ar"}" dir="${comp.rtl === false ? "ltr" : "rtl"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${(comp.name || "studio").replace(/[<>&]/g, "")} · Egytronic Studio</title>
<meta name="generator" content="egytronic-studio">
<meta name="studio-plan" content="${plan}">
<style>${fontCss(family.family)}</style>
<style>${STYLE}</style>
</head>
<body>
<canvas id="stage" width="${comp.width}" height="${comp.height}"></canvas>
<script type="application/json" id="studio-data">${payload}</script>
<script>${runtimeCode()}</script>
</body>
</html>`;
}
