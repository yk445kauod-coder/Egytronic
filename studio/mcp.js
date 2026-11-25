#!/usr/bin/env node
// Egytronic Studio MCP server (stdio). Files, not footage: every tool writes a
// self-contained print document into studio/artifacts/ that prints to PDF.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listFonts } from "./lib/fonts.js";
import { ARTIFACT_DIR, listArtifacts, resolveArtifact } from "./lib/artifacts.js";
import { statSync } from "node:fs";
import { buildDocToFile, PAGE_PRESETS, PAGE_SIZES, listTemplates, DOC_THEMES, DOC_BLOCKS } from "./lib/doc.js";

const server = new McpServer({ name: "egytronic-studio", version: "0.1.0" });

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const fail = (error) => ({ isError: true, content: [{ type: "text", text: String(error?.message || error) }] });

function catalogue() {
  return {
    docBlocks: DOC_BLOCKS,
    docTemplates: listTemplates(),
    docThemes: Object.entries(DOC_THEMES).map(([id, theme]) => ({ id, label: theme.label, tokens: theme.tokens })),
    docPresets: PAGE_PRESETS,
    pageSizes: Object.keys(PAGE_SIZES),
    fonts: listFonts(),
    artifactDir: ARTIFACT_DIR,
    contract: {
      artifact: "one .html file with fonts inlined; opens offline",
      print: "open the file and press the print button — the browser saves it as PDF",
      model: "{name,template,theme,preset|page,margin,lang,rtl,fontFamily,styles,master,content[]}",
    },
  };
}

server.registerTool(
  "studio_catalog",
  {
    title: "Studio catalog",
    description: "List document blocks, templates with their design tokens, named themes, page presets, page sizes and the Arabic/Latin fonts available for print.",
    inputSchema: {},
  },
  async () => json(catalogue()),
);

server.registerTool(
  "studio_tts",
  {
    title: "Voice-over (TTS)",
    description: "Generate a voice-over WAV with Gemini TTS. Returns the path to the audio file.",
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
  "studio_doc",
  {
    title: "Print document (InDesign-like)",
    description:
      "Build a paginated print document: cover page, page size and margins, master page with running head and folio, named colour themes, paragraph styles, columns, figures, tables, callouts, automatic TOC with page numbers. Opens as HTML, prints to PDF from the browser.",
    inputSchema: {
      doc: z.any().describe("Document model: {name,template,theme,preset|page,margin,lang,fontFamily,styles,master,content[]}"),
      out: z.string().optional(),
    },
  },
  async ({ doc, out }) => {
    try {
      const { file } = buildDocToFile(doc, out || `${doc.name || "document"}.html`);
      return json({ ok: true, artifact: file.path, bytes: file.bytes, template: doc.template || "editorial", theme: doc.theme || "default", page: doc.page || PAGE_PRESETS[doc.preset]?.size || "A4", print: "open the file, press the print button (window.print) → save as PDF" });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "studio_doc_themes",
  {
    title: "Document themes",
    description:
      "The design system behind the documents: every template with the paragraph styles it sets, the named colour themes, and how to override tokens per document. Read this before composing, so the file matches the brand instead of the defaults.",
    inputSchema: {},
  },
  async () =>
    json({
      templates: listTemplates(),
      themes: Object.entries(DOC_THEMES).map(([id, theme]) => ({ id, label: theme.label, use: theme.use, tokens: theme.tokens })),
      override: "Pass doc.theme as a theme id, or as {accent,ink,muted,rule,paper,screen,callout,bodySize,h1Size} to override single tokens.",
      blocks: DOC_BLOCKS,
      print: "open the artifact and press the print button; the browser writes the PDF",
    }),
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
