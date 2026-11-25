# Egytronic Studio — MCP tools for motion graphics, docs and voice

2026-11-24 · owner: Yousef Khamis

## Intent

An agent-driven studio: an AI agent (Claude, Cursor, OpenHands…) calls MCP tools to
compose reels, kinetic-typography pieces, animated logos, captions, voice-over and
print-ready documents. Every render is a **single self-contained HTML file**; the
creator opens it and the video is encoded **on their machine**. Nothing renders on
the server, there is no timeline UI, and no ffmpeg or headless browser is required
anywhere — the deliverable is HTML, the output is whatever the creator's browser
records.

## Why this shape

The site is Cloudflare Pages + a Worker: no ffmpeg, no Chromium, tight CPU. A
server-side renderer (Remotion/ffmpeg) would need a separate always-on machine and
would make every iteration a deploy. Handing the creator an HTML file keeps the
heavy work on their GPU/CPU, keeps the artifact portable (offline, flash drive,
email), and makes the agent loop instant: generate → open → record.

## Goals

- MCP server that exposes a composable, documented library to any MCP client.
- Deterministic motion: the recorded video matches the preview frame for frame.
- Arabic-first typography: correct shaping, bidi, and letter-spacing in Canvas.
- One artifact format: `.html`, self-contained (fonts, audio, JS inlined).
- Studio-grade export: MP4 (WebCodecs) with WebM fallback, plus PNG frame ZIP.
- Documents: InDesign-like print HTML → PDF through the browser's print engine.
- Voice: TTS (Gemini), STT and transcripts, word-timed captions (SRT/VTT/ASS).
- Zero cloud dependency at playback time.

## Non-goals

- No timeline editor, no drag-and-drop UI, no multi-track NLE.
- No server-side rendering, no render farm, no queue.
- No live streaming, no 3D, no compositing of user video footage in v1.
- No client-facing SaaS surface in v1 (the tools are for the owner and his agents).

## Anti-goals

- Shipping an HTML that only plays on the machine that generated it (CDN fonts,
  remote audio, `file://` fetch) — a failure even if the preview looks right.
- Drifting preview vs. export (CSS animations recorded from the wall clock).
- Arabic text rendered as disconnected letters or reversed order.
- Silent quality loss: an export that is 720p or 30fps when 1080×1920@60 was asked.

## Constraints

- Node 20+ on the creator's machine; MCP over stdio.
- Browsers: Chrome/Edge 111+ (WebCodecs H.264), Safari 16.4+, Firefox 130+; the
  exporter degrades to `MediaRecorder` WebM, then to PNG frames.
- Arabic fonts must be OFL and embedded; no CDN at playback.
- Each artifact stays under ~12 MB ideally (font + voice + runtime).

## Approaches considered

1. **Server-side renderer (Remotion or canvas + ffmpeg).** Highest fidelity and a
   real queue, but needs an always-on box, a deploy per change, and the creator
   can't tweak and re-record locally. Rejected: contradicts the stated mechanism.
2. **DOM + CSS animations, scrubbed, captured via `getDisplayMedia`.** Cheap to
   write, but capture is not deterministic, quality depends on the screen recorder,
   and frame-accurate export is impossible. Rejected.
3. **Canvas scene graph with `renderFrame(t)` + WebCodecs export (chosen).**
   Deterministic by construction (pure function of `t`), exact fps/size, audio
   muxed in the same pass, and the same code path powers preview. Arabic shaping
   comes free from Canvas `fillText`. Print documents reuse the same "generate HTML"
   pipeline with Paged.js instead of Canvas.

## Design

### Packages and layout

```
studio/
  package.json            # type: module, deps below
  mcp.js                  # MCP stdio server (tools/list, tools/call)
  cli.js                  # node studio/cli.js reel examples/reel.json
  lib/
    schema.js             # Composition/Motion/Doc schemas + validation
    reel.js               # high-level builder used by tools and CLI
    blocks/               # library: type, captions, logo, lowerThirds, grid, quote…
    html.js               # artifact assembly (runtime + fonts + audio + JSON scene)
    fonts.js              # OFL fonts, base64 inlining, subset by used codepoints
    voice.js              # TTS/STT/transcribe via Gemini REST
    captions.js           # word timing, SRT/VTT/ASS writers
    doc.js                # print model → HTML (Paged.js)
    artifacts.js          # output paths, manifest, cleanup
  runtime/
    index.js              # bundles into one IIFE; boots from #studio-data
    engine.js             # clock, renderFrame(t), layers, easing, keyframes
    canvas.js             # text layout (RTL/AR), shapes, masks, grain, safe areas
    export.js             # mediabunny MP4, MediaRecorder fallback, PNG ZIP
    player.js             # overlay: play/pause/scrub, record, progress, download
  assets/fonts/*.woff2    # Alexandria + Cairo (OFL), vendored
  artifacts/              # generated .html (gitignored)
  examples/               # one reel, one logo, one doc, each committed
```

### Motion model

A composition is data, not code:

```js
{ size:"1080x1920", fps:60, durationMs:8000, rtl:true, theme:{…},
  scenes:[ { at:0, durationMs:2600, block:"type.headline",
             props:{ text:"صفحتك في ٣ ثواني", staggerMs:40, easing:"expo.out" },
             enter:"rise", exit:"fade" }, … ],
  audio:[ { src:"data:audio/mpeg;base64,…", at:0, gain:1 } ] }
```

`renderFrame(t)` walks scenes, resolves each block's props at local time (easing
functions: linear, quad, cubic, expo, back, elastic; keyframe tracks support
`{ t, v, ease }`), and paints to the canvas. No wall-clock reads inside blocks.

### Blocks (v1 library)

- `type.headline` / `type.words` / `type.stack` — kinetic typography: per-word or
  per-letter stagger, mask reveals, scale/blur/skew, RTL by default.
- `captions.karaoke` — reads word timings, highlights the active word, safe-area
  aware, 3 presets (pill, underline, block).
- `logo.reveal` — SVG path draw-on (stroke dash), then fill, shine sweep, glow.
- `lowerThird`, `quote`, `stat`, `grid.reveal`, `bg.gradient`, `bg.grain`,
  `progress.bar`, `endCard`.
- `doc.*` lives in `doc.js`, not here.

Every block exports `{ id, props: zodSchema, draw(ctx, t, props, frame) }` and is
listed by `studio_catalog` with a JSON-schema for its props, so an agent can
compose without reading source.

### Export

`runtime/export.js`: `canvas.captureStream(fps)` + audio graph →
`AudioContext` → `MediaStreamDestination` → mediabunny `Output` muxing H.264/AAC
into MP4 (WebCodecs). Fallback chain: `VideoEncoder` missing → `MediaRecorder`
(`video/webm;codecs=vp9,opus`) → PNG frames zipped with `fflate` (for editors).
The overlay shows fps, bitrate, elapsed, and a download button; `R` records,
`Space` plays/pauses, `←/→` steps frames, `S` saves a still.

### Voice

`voice.js` (MCP side): TTS via Gemini `:generateContent` with
`responseModalities:["AUDIO"]` → PCM → WAV → embedded as a data URI; STT and
transcript via Gemini audio understanding; word timings from the model when
available, else proportional within segments, refined later by a local whisper
pass. Captions writer emits SRT, VTT and ASS (ASS for styling in editors).

### Documents (InDesign-like)

`doc.js`: page size and margins, master pages with running heads/footers and page
numbers, paragraph/character styles, text frames with columns and overflow chains,
image frames with fit modes, auto TOC, footnotes. Output is print HTML that loads
Paged.js (vendored) for real pagination; the creator prints to PDF. Same
"self-contained HTML" promise, no server.

### MCP surface

`studio_catalog`, `studio_reel`, `studio_motion`, `studio_scene_add`,
`studio_logo`, `studio_tts`, `studio_stt`, `studio_captions`, `studio_doc`,
`studio_export`, `studio_open`. Each returns the artifact path, a one-line summary,
and the HTML as an MCP resource; `studio_export` returns a manifest for batch use.

### Dependencies (external libraries allowed)

- `@modelcontextprotocol/sdk` + `zod` — MCP plumbing and tool schemas.
- `mediabunny` — WebCodecs MP4/WebM muxing, the modern successor to mp4-muxer.
- `fflate` — PNG frame ZIP.
- `pagedjs` — print pagination for documents.
- `svgpath` — transform/normalise logo paths before draw-on.
- `esbuild` (dev) — bundle `runtime/` into one IIFE string inlined in artifacts.
- Fonts: Alexandria, Cairo (OFL), vendored as woff2.
- Voice: Gemini REST via `fetch` (no SDK, avoids model/SDK churn).

### Stages

1. Core: engine, canvas text (Arabic), artifact assembly, MCP server, `studio_reel`
   with `type.headline` + `captions.karaoke`, MP4/WebM export. Proof: a real 9:16
   reel recorded in Chrome.
2. Motion library: remaining blocks, keyframe tracks, safe areas, themes.
3. Voice: TTS/STT/transcript/captions end to end, audio-reactive blocks.
4. Documents: Paged.js pipeline, styles, masters, TOC, export.
5. Catalogue and examples: every block measured, three real artifacts committed.

## Risks

- WebCodecs H.264 support varies; the fallback chain is mandatory, and the overlay
  must say which encoder ran.
- Long reels + grain effects can drop frames; encode from `renderFrame` on a fixed
  step (never `requestAnimationFrame` timing) and report measured fps.
- Gemini TTS quota/latency; artifacts cache the generated audio as data URIs.
- Font subsetting must not drop Arabic presentation forms; subset by codepoints
  actually used, and keep a full fallback font inlined.

## Open decisions (builder may settle)

- Default theme tokens (palette, type scale) — start from the site's Material 3
  tokens so studio output matches the brand.
- Whether `studio_open` also uploads the artifact to the console (needs an API key
  we already have) — defer to stage 5.
