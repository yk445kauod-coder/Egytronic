#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { renderToFile, PRESETS } from "./lib/reel.js";
import { listFonts } from "./lib/fonts.js";
import { BLOCKS } from "./runtime/blocks.js";
import { listArtifacts } from "./lib/artifacts.js";

const [command, ...rest] = process.argv.slice(2);

function arg(name, fallback) {
  const index = rest.findIndex((value) => value === `--${name}` || value === `-${name[0]}`);
  if (index === -1) return fallback;
  return rest[index + 1] ?? true;
}

function print(usageError) {
  if (usageError) console.error(usageError);
  console.error(`egx-studio <command>

  reel <spec.json> [--out name.html]   compose a motion piece into artifacts/
  catalog                              list blocks, fonts and presets
  artifacts                            list generated renders
  tts --text "..." [--voice Kore]      voice-over to artifacts/voice.wav
  stt <audio>                          transcript of an audio file
  captions <words.json>                SRT/VTT/ASS from timed words`);
  process.exit(usageError ? 1 : 0);
}

try {
  if (command === "reel") {
    const file = rest.find((value) => !value.startsWith("-") && !rest[rest.indexOf(value) - 1]?.startsWith("--"));
    const spec = JSON.parse(readFileSync(file, "utf8"));
    const { file: out, comp } = renderToFile(spec, arg("out", `${comp_name(spec)}.html`));
    console.log(JSON.stringify({ ok: true, artifact: out.path, bytes: out.bytes, durationMs: comp.durationMs, size: comp.size, fps: comp.fps, font: comp.fontFamily }, null, 2));
  } else if (command === "catalog") {
    console.log(JSON.stringify({
      blocks: Object.values(BLOCKS).map((block) => ({ id: block.id, label: block.label, props: block.props })),
      fonts: listFonts(),
      presets: PRESETS,
      artifacts: listArtifacts(),
    }, null, 2));
  } else if (command === "artifacts") {
    console.log(JSON.stringify(listArtifacts(), null, 2));
  } else if (command === "tts" || command === "stt" || command === "captions") {
    const mod = await import("./lib/voice.js");
    const output = await mod.runCli(command, rest, arg);
    console.log(JSON.stringify(output, null, 2));
  } else {
    print(command ? `unknown command: ${command}` : "");
  }
} catch (error) {
  console.error(String(error.stack || error));
  process.exit(1);
}

function comp_name(spec) {
  return spec.name || "studio-render";
}
