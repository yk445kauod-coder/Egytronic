# How this pack runs inside Egytronic

Vendored from https://github.com/charlie947/motion-graphics-skills (MIT, © Charlie Hills).
These skills are the **playbook** (what a launch/loop/explainer video should say and how it
should feel). The renderer is the local studio in `studio/`, exposed to agents as MCP tools.

The pack assumes "one HTML file with `window.seek(seconds)`". That is exactly what
`studio_reel` emits, and the artifact exposes `window.seek`, `window.duration` and
`window.__studio` for automation.

## Mapping beats → studio blocks

| Playbook beat | Block |
|---|---|
| Hook words, one-per-beat typography | `type.headline` (`accentWords` for the stressed word) |
| Title + eyebrow | `type.stack` |
| Word-timed subtitles | `captions.karaoke` (preset `pill`, `underline` or block) |
| Logo stinger / end card mark | `logo.reveal` (SVG `d` paths, draw-on then fill) |
| Name tag over footage | `lowerThird` |
| One big number with its source | `stat` |
| Quote / testimonial card | `quote.card` |
| Chapter progress | `progress.bar` |
| Background | `bg.gradient` (blobs + grain; always on) |

If a beat needs a block that does not exist yet (charts, 3D type, masked video), say so
in the answer instead of faking it — the library grows by request.

## Flow

1. `studio_catalog` → blocks, props, fonts, presets, artifact dir.
2. Compose the spec (Arabic is the default; `fontFamily` from the 16 built-in families).
3. `studio_reel` → `studio/artifacts/<name>.html`.
4. The creator opens it: `Space` plays, `R` records (MP4 via WebCodecs, WebM fallback,
   PNG ZIP for editors), `S` saves a still. `?frame=1200&bare=1` renders a single frame.
5. Voice: `studio_tts` → WAV in `artifacts/`, embed with `audio: [{src: "data:audio/wav;base64,…", at: 0}]`.
6. Transcripts/subtitles: `studio_stt` → timed segments → `studio_captions` (SRT/VTT/ASS).

## Brand rules that override the pack

- Arabic is the source of truth; English is a translation, never an addition.
- No invented proof, prices, dates, counts or testimonials — the pack says this too; keep it.
- Fonts: Alexandria (display), Cairo/Almarai (UI), Amiri (serif), Bebas (condensed Latin).
