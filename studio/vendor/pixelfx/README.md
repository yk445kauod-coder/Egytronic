# PixelFx (vendored subset)

Pixel-art VFX rendered from the real code of [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx),
commit `5294518` (2026-11-12). Nothing here is redrawn by hand: `scripts/gen-pixelfx.mjs` runs these
modules in Node, renders a frame of each effect and writes the PNGs in `assets/pixelfx/`.

Included: `core/` (colour, painting, particles, framing) and four effects —
`weather/aurora`, `fire/campfire`, `transitions/crt-off`, `ui/confetti`.

MIT License, Copyright (c) 2026 Patch and Hugo Duprez — see `LICENSE`. `NOTICE.md` lists the parts
that adapt Sprite Fusion's and Hollow Crown's work. The Patch Pixel font is **not** here: it is
outside the MIT grant.

Regenerate the art:

```bash
npm run art          # rewrites assets/pixelfx/*.png and manifest.json
```
