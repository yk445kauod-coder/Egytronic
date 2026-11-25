# Egytronic Studio

Agent-driven motion graphics, voice and print — as MCP tools. Every render is **one
self-contained HTML file**; the video is encoded in the creator's browser, so there is no
server renderer, no ffmpeg and no headless browser anywhere.

Design: `docs/superpowers/specs/2026-11-24-studio-design.md`.

## Run

```bash
cd studio
npm install
npm run bundle          # builds runtime/dist (esbuild)
node cli.js catalog
node cli.js reel examples/reel-egytronic.json --out my-reel.html
open artifacts/my-reel.html
```

MCP (stdio): `node studio/mcp.js`. Register it in Claude Desktop / Cursor / OpenHands:

```json
{ "mcpServers": { "egytronic-studio": { "command": "node", "args": ["/abs/path/studio/mcp.js"] } } }
```

## Tools

| Tool | Does |
|---|---|
| `studio_catalog` | blocks + props, 16 built-in fonts, presets, render contract |
| `studio_reel` | compose scenes → artifact |
| `studio_logo` | SVG paths → animated logo reveal |
| `studio_tts` | Gemini voice-over → WAV (needs `GEMINI_API_KEY`) |
| `studio_stt` | transcript + timed segments |
| `studio_captions` | SRT / VTT / ASS from timed words |
| `studio_doc` | paginated print document (Paged.js) → PDF from the browser |
| `studio_open` | path + `file://` URL + size |

## Blocks

`bg.gradient` · `bg.pixels` · `type.headline` · `type.stack` · `captions.karaoke` · `logo.reveal` ·
`quote.card` · `lowerThird` · `stat` · `progress.bar` · `confetti`

## Fonts (built in, OFL, embedded per render)

Arabic+Lagion: Alexandria, Cairo, Almarai, Tajawal, Noto Kufi Arabic, Readex Pro,
IBM Plex Sans Arabic, Rubik, Amiri, Noto Naskh Arabic.
Latin: Inter, Space Grotesk, DM Serif Display, Bebas Neue, Playfair Display, JetBrains Mono.

## Verify

```bash
npm run verify     # builds every artifact, opens it in Chromium, prints the PDF, asserts
```

31 checks: sheets/pages, embedded font active, TOC counters, print media (toolbar hidden, margin 0,
A4 sheet height), PDF is A4 `595×842pt` with no blank page, reel frames differ and contain type,
logo pixels, SRT/VTT/ASS output, 16 font families embedded, voice refusing without a key.
Needs `npx playwright install chromium`.

## The render contract

- Deterministic: every frame is `renderFrame(t)`, never the wall clock.
- Arabic is shaped by the browser and laid out word by word (letters are never split —
  that breaks the joins).
- Export: MP4 (H.264/AAC via WebCodecs) → WebM (MediaRecorder) → PNG frames ZIP.
- `?frame=<ms>` seeks, `?bare=1` hides the player, `?record=1` records on load.

## Documents

`studio_doc` takes a document model — `preset` (`a4-portrait`, `a5-portrait`, `a4-two-column`,
`letter`) or an explicit `page` + `margin`, `master.header`, `styles`, and `content[]`:

| Block | Notes |
|---|---|
| `h1` `h2` `h3` | anchors get ids automatically; `h1` feeds the running head |
| `p` `lead` | `style` picks a named paragraph style |
| `columns` | `count`, `gap` — real CSS columns with a rule |
| `quote` `callout` `list` | break-inside avoided |
| `figure` | `src`, `caption`, `fit` (`cover`/`contain`), `ratio` |
| `table` | `head`, `rows`, `caption` |
| `toc` | page numbers computed by Paged.js `target-counter` |
| `break` `spacer` `rule` | structure |

### Printing

The only export is `window.print()` — the toolbar button calls it (Ctrl+P works too). The print
stylesheet zeroes the paper margin (`@page { margin: 0 }`) because every Paged.js sheet already
carries the document margins; leaving a paper margin there shrinks each page and adds blank sheets.
Colours are forced (`print-color-adjust: exact`) so callouts and table heads survive the printer.

### Templates — edit these, not the code

```
studio/templates/doc/
  base.css        structure for every document (margins, columns, tables, TOC, print rules)
  editorial.css   look: title block, hairlines        editorial.json  defaults: font, page, styles
  report.css      look: dense two columns, accents    report.json
  brief.css       look: A5, generous leading          brief.json
```

`<name>.json` sets the defaults (font family, preset, paragraph styles) and `<name>.css` sets the
look; the two are inlined into the artifact together with `base.css`. Choose one with
`template` in the model or `--template report`. To add a template, drop `<name>.json` +
`<name>.css` in that folder — it is listed by `studio_doc` and the CLI immediately.

Document `styles` still win over the template for one-off adjustments:

```json
{ "template": "report", "styles": { "h1": { "size": "26pt" }, "body": { "size": "9pt" } } }
```

Bleed and crop marks only when `marks: true` is asked for.

## Reels → video

```bash
npm run reels            # examples/reels/*.json → artifacts/reels/*.{mp4,webm,jpg} + manifest.json
npm run reels:check      # mp4 decodes end to end (ffmpeg) + webm plays in Chromium
npm run reels:gallery    # builds the preview gallery straight into ../dist/reels/
```

Frames are rendered one at a time through the studio engine, written as PNG, and assembled by
ffmpeg (`libx264 -crf 18`, plus a VP9 sibling for browsers without H.264). Don't route the export
back through `window.__studio.recordNow()`: the in-browser encoder path blurs one frame into the
next on fast re-render, so text from the previous scene ghosts over the current one in the file
even though the canvas itself is correct.

## Not built yet

Charts, 3D type, video-in-video, and flowing a text frame into the next page's frame
(Paged.js can, the model does not expose it yet). Ask before assuming.
