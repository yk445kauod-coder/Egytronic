# Motion engine — cancelled

**Status: cancelled 2026-11-24.** Yousef dropped the video feature: the studio does files, not
footage. Everything the engine was going to serve (scenes, 60 fps export, logo reveals, reels)
is out of scope, and the video pipeline that already existed was deleted in the same pass:
`lib/reel.js`, `lib/html.js`, `lib/captions.js`, `runtime/`, the `export-*` / `check-video` /
`reel-gallery` scripts, `examples/reels/`, and the `studio_reel`, `studio_logo` and
`studio_captions` MCP tools.

What replaced it: the document path. `studio_doc` now carries a cover block, named colour
themes (validated tokens), a `proposal` template, and a print contract that keeps real page
margins — with `npm run verify` guarding each of those. See `studio/README.md`.

The original engine design is in git history (`git log -- docs/design/2026-11-24-motion-engine.md`)
if the decision is ever revisited.
