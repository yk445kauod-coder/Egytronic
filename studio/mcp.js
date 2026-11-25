#!/usr/bin/env node
// Egytronic Studio MCP server (stdio). Every tool writes a self-contained HTML
// render into studio/artifacts/; the video is encoded in the creator's browser.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { renderToFile, PRESETS } from "./lib/reel.js";
import { listFonts } from "./lib/fonts.js";
import { BLOCKS } from "./runtime/blocks.js";
import { ARTIFACT_DIR, listArtifacts, resolveArtifact } from "./lib/artifacts.js";
import { statSync } from "node:fs";
import { buildDocToFile, PAGE_PRESETS, PAGE_SIZES } from "./lib/doc.js";

const server = new McpServer({ name: "egytronic-studio", version: "0.1.0" });

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const fail = (error) => ({ isError: true, content: [{ type: "text", text: String(error?.message || error) }] });

function catalogue() {
  return {
    blocks: Object.values(BLOCKS).map((block) => ({ id: block.id, label: block.label, props: block.props })),
    docBlocks: ["h1", "h2", "h3", "p", "lead", "columns", "quote", "callout", "list", "figure", "table", "toc", "break", "spacer", "rule"],
    fonts: listFonts(),
    presets: PRESETS,
    docPresets: PAGE_PRESETS,
    artifactDir: ARTIFACT_DIR,
    renderContract: {
      artifact: "one .html file, fonts + audio inlined, opens offline",
      export: "in the page press R (or ?record=1) — MP4 via WebCodecs, WebM fallback, PNG ZIP option",
      seek: "?frame=<ms> renders a single frame, ?bare=1 hides the player bar",
    },
  };
}

server.registerTool(
  "studio_catalog",
  {
    title: "Studio catalog",
    description: "List motion blocks with their props, the built-in Arabic/Latin fonts, size presets and the render contract.",
    inputSchema: {},
  },
  async () => json(catalogue()),
);

server.registerTool(
  "studio_reel",
  {
    title: "Compose a reel",
    description:
      "Compose motion graphics into one self-contained HTML artifact. Provide scenes (block id + props + at/durationMs). Returns the artifact path the creator opens to record.",
    inputSchema: {
      spec: z.object({}).describe("Composition spec: {name,size|preset,fps,seconds,fontFamily,theme,scenes[],audio[]}"),
      out: z.string().optional().describe("File name inside studio/artifacts (default: <name>.html)"),
    },
  },
  async ({ spec, out }) => {
    try {
      const { file, comp } = renderToFile(spec, out || `${spec.name || "studio-render"}.html`);
      return json({
        ok: true,
        artifact: file.path,
        bytes: file.bytes,
        durationMs: comp.durationMs,
        size: comp.size,
        fps: comp.fps,
        font: comp.fontFamily,
        scenes: comp.scenes.length,
        open: `file://${file.path}`,
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_logo",
  {
    title: "Animated logo",
    description: "Build an animated logo reveal from SVG path data (draw-on stroke, then fill, optional glow).",
    inputSchema: {
      paths: z.array(z.string()).optional().describe("SVG path d strings"),
      svg: z.string().optional().describe("Raw SVG markup; paths are extracted from it"),
      seconds: z.number().optional(),
      color: z.string().optional(),
      size: z.string().optional(),
      fontFamily: z.string().optional(),
      glow: z.boolean().optional(),
      name: z.string().optional(),
    },
  },
  async ({ paths, svg, seconds = 4, color, size = "1080x1080", fontFamily, glow = true, name = "logo-reveal" }) => {
    try {
      const extracted = paths?.length ? paths : [...String(svg || "").matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
      if (!extracted.length) throw new Error("no paths: pass paths[] or svg with <path d=\"...\">");
      const { file, comp } = renderToFile(
        {
          name,
          size,
          fps: 60,
          seconds,
          fontFamily: fontFamily || "Alexandria",
          scenes: [{ at: 0, durationMs: seconds * 1000, block: "logo.reveal", props: { paths: extracted.map((d) => ({ d })), color, glow, width: 0.42 } }],
        },
        `${name}.html`,
      );
      return json({ ok: true, artifact: file.path, bytes: file.bytes, paths: extracted.length, durationMs: comp.durationMs, size: comp.size });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_tts",
  {
    title: "Voice-over (TTS)",
    description: "Generate a voice-over WAV with Gemini TTS. Returns the path; pass it to studio_reel audio[] as a data URI or file path.",
    inputSchema: {
      text: z.string(),
      voice: z.string().optional().describe("Gemini: Kore, Puck, Zephyr… | OpenRouter: alloy, verse, shimmer"),
      style: z.string().optional().describe("Delivery instruction, e.g. 'حماسي وهادئ'"),
      provider: z.enum(["auto", "gemini", "openrouter"]).optional(),
      out: z.string().optional(),
    },
  },
  async ({ text, voice, style, provider, out }) => {
    try {
      const { tts } = await import("./lib/voice.js");
      return json(await tts({ text, voice, style, provider, out }));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_stt",
  {
    title: "Transcribe audio (STT)",
    description: "Transcribe an audio file with Gemini and return timed segments (seconds) suitable for karaoke captions.",
    inputSchema: { audio: z.string(), language: z.string().optional() },
  },
  async ({ audio, language }) => {
    try {
      const { stt } = await import("./lib/voice.js");
      return json(await stt({ audio, language }));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_captions",
  {
    title: "Caption files",
    description: "Write SRT, VTT and ASS from timed words. Words in seconds; values above 1000 are treated as milliseconds.",
    inputSchema: {
      words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number().optional() })),
      out: z.string().optional(),
    },
  },
  async ({ words, out }) => {
    try {
      const { writeCaptions } = await import("./lib/captions.js");
      return json(await writeCaptions(words, out || "captions"));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_doc",
  {
    title: "Print document (InDesign-like)",
    description:
      "Build a paginated print document: page size and margins, master page with running head and folio, paragraph styles, columns, figures, tables, callouts, automatic TOC with page numbers. Opens as HTML, prints to PDF from the browser.",
    inputSchema: {
      doc: z.object({}).describe("Document model: {name,preset|page,margin,bleed,lang,fontFamily,styles,master,content[]}"),
      out: z.string().optional(),
    },
  },
  async ({ doc, out }) => {
    try {
      const { file } = buildDocToFile(doc, out || `${doc.name || "document"}.html`);
      return json({ ok: true, artifact: file.path, bytes: file.bytes, page: doc.page || PAGE_PRESETS[doc.preset]?.size || "A4", sizes: Object.keys(PAGE_SIZES), print: "open then press the print button (or Ctrl+P) → save as PDF" });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_open",
  {
    title: "Inspect a render",
    description: "Return size, path and file URL for a rendered artifact so the creator can open and record it.",
    inputSchema: { artifact: z.string() },
  },
  async ({ artifact }) => {
    try {
      const path = resolveArtifact(artifact);
      const stats = statSync(path);
      return json({ path, bytes: stats.size, open: `file://${path}` });
    } catch (error) {
      return fail(error);
    }
  },
);

await server.connect(new StdioServerTransport());
