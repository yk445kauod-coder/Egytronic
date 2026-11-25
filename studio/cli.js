#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { listFonts } from "./lib/fonts.js";
import { listArtifacts } from "./lib/artifacts.js";
import { buildDocToFile, listTemplates, DOC_THEMES, DOC_BLOCKS, PAGE_PRESETS } from "./lib/doc.js";

const [command, ...rest] = process.argv.slice(2);

function arg(name, fallback) {
  const index = rest.findIndex((value) => value === `--${name}` || value === `-${name[0]}`);
  if (index === -1) return fallback;
  return rest[index + 1] ?? true;
}

function print(usageError) {
  if (usageError) console.error(usageError);
  console.error(`egx-studio <command>

  doc <doc.json> [--template id] [--theme id] [--out name.html]   print document → artifacts/
  catalog                                                         templates, themes, blocks, fonts
  artifacts                                                       list generated documents
  tts --text "..." [--voice Kore]                                 voice-over to artifacts/voice.wav
  stt <audio>                                                     transcript of an audio file`);
  process.exit(usageError ? 1 : 0);
}

try {
  if (command === "doc") {
    const file = rest.find((value) => !value.startsWith("-"));
    if (!file) print("doc needs a JSON document");
    const doc = JSON.parse(readFileSync(file, "utf8"));
    if (arg("template")) doc.template = arg("template");
    if (arg("theme")) doc.theme = arg("theme");
    const { file: out } = buildDocToFile(doc, arg("out", `${doc.name || "document"}.html`));
    console.log(JSON.stringify({ ok: true, artifact: out.path, bytes: out.bytes, template: doc.template || "editorial", theme: doc.theme || "default", preset: doc.preset || "a4-portrait" }, null, 2));
  } else if (command === "catalog") {
    console.log(JSON.stringify({
      templates: listTemplates(),
      themes: Object.entries(DOC_THEMES).map(([id, theme]) => ({ id, label: theme.label, use: theme.use })),
      blocks: DOC_BLOCKS,
      presets: PAGE_PRESETS,
      fonts: listFonts(),
      artifacts: listArtifacts(),
    }, null, 2));
  } else if (command === "artifacts") {
    console.log(JSON.stringify(listArtifacts(), null, 2));
  } else if (command === "tts" || command === "stt") {
    const mod = await import("./lib/voice.js");
    console.log(JSON.stringify(await mod.runCli(command, rest, arg), null, 2));
  } else {
    print(command ? `unknown command: ${command}` : "");
  }
} catch (error) {
  console.error(String(error.stack || error));
  process.exit(1);
}
