# Motion engine — design (draft for approval)

## Intent

The studio today renders **scenes we hand-wrote**: ten blocks, thirty frames a second, no audio, and a
logo animation that draws path strings someone typed into the spec. What Yousef wants is the thing the
scenes come out of — a motion engine an agent can drive the way Claude drives a document: hand it a brand
and a brief, pick a skill, get a broadcast-quality file.

## Goals

- **Brand in, motion out.** Ingest the real asset once (SVG or transparent PNG) and every skill uses it:
  stroke-draw from the actual vector paths, or a supersampled raster reveal, never a redrawn lookalike.
- **Quality floor, not a hope:** 60 fps, 2× supersampled render downscaled with lanczos, H.264 high profile
  and VP9, poster, and an audio track (synthesized SFX bank + optional bed, loudness-normalised).
- **Agents compose, not code.** A skill is data: id, when it applies, parameters, the scene graph it emits.
  New motion ships by adding a skill file, not by editing the renderer.
- **One surface, three doors:** MCP tools for agents, a CLI for scripts, a gallery for humans.

## Non-goals

- Generative video (text-to-video). Every frame is deterministic and reproducible.
- 3D, character rigging, footage grading.
- Replacing the document/reel blocks that already work; the engine grows around them.

## Approaches considered

**A. Grow the current canvas engine block by block.** Cheapest, keeps the 16-bit identity and Arabic
shaping that already work. But "more skills" then means more hand-written draw code, and an agent can't
compose anything we didn't anticipate. Rejected: it produces one-off deliverables again, which is exactly
what this request rules out.

**B. Declarative motion spec + parameterised skills, canvas as the renderer (chosen).** The timeline becomes
data — layers, keyframes, easing, camera, transitions, audio cues — and skills are recipes that emit that
data. The renderer stays the only place that knows pixels, so quality is fixed centrally and an agent can
safely author new compositions.

**C. Adopt Remotion / Manim / Lottie.** Remotion gives React-driven video but drags in React + a headless
Chromium render farm and a company licence; Manim is aimed at maths animation; Lottie can't render Arabic
shaping or our pixel grid without a second renderer. Rejected: heavy dependency for capability we already
have, and a licence question on a client product.

## The shape

```
studio/
  brand/<slug>/brand.json      # palette, fonts, logo.paths[] (unit 1000), logo.png, safe area
  skills/*.json                # id, label, appliesTo (format), params, timeline template
  lib/motion/                  # timeline, keyframes, easing, camera, cues
  runtime/                     # canvas renderer (exists) + asset layer + audio layer
  scripts/motion-render.mjs    # frames → ffmpeg (+ audio mux, supersample, fps from spec)
  mcp.js                       # motion_skills / motion_compose / motion_render / motion_preview
```

- **Timeline**: `{layers:[{from,to,keys:[{t, props}]}], camera:{...}, transitions:[...], cues:[{t, sfx}]}`
  compiled to per-frame state. Skills are sugar over this; the old `scenes[]` form keeps working unchanged.
- **Asset layer**: `logo` block takes a brand slug. SVG paths come from a one-off ingest (`motion:brand`),
  which normalises every `<path>/<circle>/<rect>/<polygon>` into path data inside a 1000-unit box, so
  stroke-draw, mask wipe, pixel dissolve and glow all work on the *real* logo.
- **Audio layer**: a synthesized SFX bank (click, whoosh, riser, impact, sparkle, type-on) rendered offline
  with `OfflineAudioContext` to WAV, mixed at cue times, normalised to −16 LUFS, muxed AAC. No licensed
  samples, so every render is reproducible and client-safe.
- **Skills at launch (10):** logo.draw, logo.pixel-dissolve, logo.mask-wipe, kinetic-type, stat-count,
  price-card, end-card, lower-third, before-after, screen-demo (framed screenshot with pan/zoom).
- **Render**: `--fps 60 --scale 2` by default for social formats, 1× for drafts. Budget guard: a 6 s
  1080×1920 reel ≈ 360 frames × 4× pixels; renders in ~3–4 min per reel on this box.

## Phases

1. **Core** — brand ingest, timeline + keyframes + easing, 60 fps, 2× supersample, audio bank and mux.
   Unlocks: "my logo, animated properly, with sound".
2. **Skills + doors** — ten skills, MCP tools, CLI verbs, skill docs an agent can read.
3. **Polish** — transitions, camera moves, burned-in captions, GIF, gallery, and the deployable preview.

## Open questions

- Logo file: SVG at launch (vector, zero loss). PNG works through supersampled reveal; a screenshot needs
  it redrawn first.
- Audio direction: SFX-only vs SFX + a quiet bed. Default: SFX + bed at −22 LUFS under it.
