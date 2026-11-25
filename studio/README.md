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
| `studio_open` | path + `file://` URL + size |

## Blocks

`bg.gradient` · `type.headline` · `type.stack` · `captions.karaoke` · `logo.reveal` ·
`quote.card` · `lowerThird` · `stat` · `progress.bar`

## Fonts (built in, OFL, embedded per render)

Arabic+Lagion: Alexandria, Cairo, Almarai, Tajawal, Noto Kufi Arabic, Readex Pro,
IBM Plex Sans Arabic, Rubik, Amiri, Noto Naskh Arabic.
Latin: Inter, Space Grotesk, DM Serif Display, Bebas Neue, Playfair Display, JetBrains Mono.

## The render contract

- Deterministic: every frame is `renderFrame(t)`, never the wall clock.
- Arabic is shaped by the browser and laid out word by word (letters are never split —
  that breaks the joins).
- Export: MP4 (H.264/AAC via WebCodecs) → WebM (MediaRecorder) → PNG frames ZIP.
- `?frame=<ms>` seeks, `?bare=1` hides the player, `?record=1` records on load.

## Not built yet

Print documents (Paged.js pipeline), charts, 3D type, video-in-video. Ask before assuming.
