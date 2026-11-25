# Egytronic Studio

Agent-driven **print documents** — as MCP tools. Every document is one self-contained HTML file
with its fonts inlined; the browser's print dialog writes the PDF. No server renderer, no ffmpeg,
no headless browser anywhere.

Video and reel export were removed on 2026-11-24: the studio does files, not footage.

## Run

```bash
cd studio
npm install
npm run catalog                        # templates, themes, blocks, fonts
npm run doc                            # examples/doc-proposal.json → artifacts/proposal.html
node cli.js doc my.json --template proposal --theme desert --out offer.html
open artifacts/offer.html              # press the print button → save as PDF
```

MCP (stdio): `node studio/mcp.js`. Register it in Claude Desktop / Cursor / OpenHands:

```json
{ "mcpServers": { "egytronic-studio": { "command": "node", "args": ["/abs/path/studio/mcp.js"] } } }
```

## Tools

| Tool | Does |
|---|---|
| `studio_catalog` | templates, themes, blocks, page presets and sizes, 16 fonts |
| `studio_doc_themes` | the design system: every template with the styles it sets, the named themes, how to override tokens |
| `studio_doc` | document model → paginated artifact → PDF from the browser |
| `studio_tts` | Gemini voice-over → WAV (needs `GEMINI_API_KEY`) |
| `studio_stt` | transcript + timed segments |
| `studio_open` | path + `file://` URL + size |

## Document model

```json
{
  "name": "offer",
  "template": "proposal",
  "theme": "egytronic",
  "preset": "a4-portrait",
  "lang": "ar",
  "master": { "header": "Egytronic — عرض تعاون" },
  "content": [
    { "type": "cover", "kicker": "Egytronic", "title": "عرض تعاون", "subtitle": "…", "meta": ["لـ: …", "المدة: …"] },
    { "type": "h2", "text": "نطاق العمل" },
    { "type": "columns", "count": 2, "text": ["…", "…"] }
  ]
}
```

`preset` (`a4-portrait`, `a5-portrait`, `a4-two-column`, `letter`) or an explicit `page` +
`margin`; `styles` overrides any paragraph style for one document.

| Block | Notes |
|---|---|
| `cover` | kicker, title, subtitle, `meta[]`; closes its own sheet, no running head, no folio |
| `h1` `h2` `h3` | anchors get ids automatically; `h1` feeds the running head |
| `p` `lead` | `html: true` passes the text through as markup |
| `columns` | `count`, `gap` — real CSS columns with a rule |
| `quote` `callout` `list` | break-inside avoided |
| `figure` | `src`, `caption`, `fit` (`cover`/`contain`), `ratio` |
| `table` | `head`, `rows`, `caption` |
| `toc` | page numbers written onto each link after pagination |
| `break` `spacer` `rule` | structure (a `break` right after a `cover` is dropped, the cover already breaks) |

## Pixel art (PixelFx)

`assets/pixelfx/` holds four frames rendered from the real code of
[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) (MIT, vendored under `vendor/pixelfx/`):
aurora, campfire, a CRT switch-off and confetti. Nothing is drawn by hand and nothing is fetched at
print time — `scripts/gen-pixelfx.mjs` runs the effect modules in Node, composites a frame and writes
a PNG; the theme carries it into the document as a base64 data URI.

```bash
npm run art          # re-render assets/pixelfx/*.png + manifest.json (deterministic)
npm run quote        # the pixel quotation example → artifacts/quote.html
```

- Themes `pixel` and `pixel-night` set `--art-banner` and `--art-mark`; `.pixel-art` paints them with
  `image-rendering: pixelated`, a 2px ink border and 4px offset shadows, no radius anywhere.
- Blocks: `cover` with `"art": "banner"|"mark"`, and `{ "type": "art", "name": "aurora", "variant": "strip" }`.
  `studio_catalog` lists every art id; `studio_doc_themes` shows which theme uses which.
- Regenerating changes the bytes; `npm run verify` compares each file to the manifest hash, so commit
  both.

## Themes

Tokens map onto the custom properties in `base.css`; pass a theme id, or a partial object to move
one token.

| Theme | For |
|---|---|
| `egytronic` | company documents (orange on white) |
| `press` | reports and studies — ink only, no accent |
| `desert` | warm proposals (terracotta on cream) |
| `sea` | technical files and research (calm blue) |
| `ink` | dark, screen reading |
| `pixel` | quotations and client files, ink on paper, PixelFx art on the cover |
| `pixel-night` | the same in the dark, aurora cover |

```json
{ "theme": { "accent": "#0F6E8C", "h1Size": "34pt" } }
```

Values are validated before they reach the CSS: colours must be `#hex`, `rgb()` or `hsl()`, sizes
must carry a unit. Anything else is dropped, not escaped.

## Printing

The only export is `window.print()` — the toolbar button calls it (Ctrl+P works too). The print
contract (`@page { size; margin: 0 }`, sheet sizing, colour fidelity) is injected by the artifact's
own script **after** pagination, so the paginator never reads it. Keep it that way: a
`@media print { @page { margin: 0 } }` block in `base.css` is read by Paged.js during pagination and
silently removes every page margin. `npm run verify` fails if the margins go.

## Templates — edit these, not the code

```
studio/templates/doc/
  base.css        structure for every document (margins, columns, tables, cover, TOC, page furniture)
  editorial.css   look: title block, hairlines        editorial.json  defaults: font, page, styles
  report.css      look: dense two columns, accents    report.json
  brief.css       look: A5, generous leading          brief.json
  proposal.css    look: scope table, total callout    proposal.json
  quote.css       look: pixel quotation, totals, sign  quote.json
```

`<name>.json` sets the defaults (font family, preset, paragraph styles) and `<name>.css` sets the
look; both are inlined into the artifact with `base.css`. Choose one with `template` in the model
or `--template report`. Drop `<name>.json` + `<name>.css` in that folder and it is listed by
`studio_doc`, `studio_doc_themes` and the CLI immediately.

## Fonts (built in, OFL, embedded per document)

Arabic+Latin: Alexandria, Cairo, Almarai, Tajawal, Noto Kufi Arabic, Readex Pro,
IBM Plex Sans Arabic, Rubik, Amiri, Noto Naskh Arabic.
Latin: Inter, Space Grotesk, DM Serif Display, Bebas Neue, Playfair Display, JetBrains Mono.

## Verify

```bash
npm run verify     # builds every artifact, opens it in Chromium, prints the PDF, asserts
```

34 checks (art hashes, the pixel theme and the quotation among them): sheets/pages, embedded font active, page margins hold, TOC folios resolved and ordered,
theme tokens applied and hostile values dropped, cover on its own sheet, print media (toolbar
hidden, sheets stack flat), PDF is A4 `595×842pt` with no blank page and a folio on every sheet
after the cover, all four templates build, 16 font families embedded, voice refusing without a key.
Needs `npx playwright install chromium`.

## Not built yet

Charts, footnotes, flowing a text frame into the next page's frame (Paged.js can, the model does
not expose it yet), and DOCX/PPTX output. Ask before assuming.
