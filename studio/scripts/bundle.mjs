import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync(new URL("../runtime/dist/", import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL("../runtime/index.js", import.meta.url).pathname],
  bundle: true,
  format: "iife",
  target: ["chrome111", "safari16.4", "firefox130"],
  minify: true,
  legalComments: "none",
  outfile: new URL("../runtime/dist/studio.runtime.js", import.meta.url).pathname,
  logLevel: "warning",
});
const bytes = (await import("node:fs")).statSync(new URL("../runtime/dist/studio.runtime.js", import.meta.url)).size;
console.log(`runtime bundle: ${(bytes / 1024).toFixed(0)} KB`);
