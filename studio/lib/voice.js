// Gemini voice: TTS returns WAV (PCM wrapped), STT returns timed segments.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { ARTIFACT_DIR, resolveArtifact } from "./artifacts.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_VOICES = ["Kore", "Puck", "Zephyr", "Charon", "Fenrir", "Aoede", "Leda", "Orus"];

export const PROVIDERS = {
  gemini: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  openrouter: () => Boolean(process.env.OPENROUTER_API_KEY),
};

function pickProvider(requested) {
  if (requested && requested !== "auto") {
    if (!PROVIDERS[requested]) throw new Error(`${requested} is not configured (missing ${requested === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY"})`);
    return requested;
  }
  if (PROVIDERS.gemini()) return "gemini";
  if (PROVIDERS.openrouter()) return "openrouter";
  throw new Error("no voice provider configured: set GEMINI_API_KEY or OPENROUTER_API_KEY");
}

function key() {
  const value = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!value) throw new Error("GEMINI_API_KEY is not set (needed for Gemini TTS/STT)");
  return value;
}

async function callModel(model, body) {
  const response = await fetch(`${BASE}/${model}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`gemini ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const MIME = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".webm": "audio/webm", ".flac": "audio/flac" };

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function saveAudio(buffer, outPath) {
  const target = outPath.startsWith("/") ? outPath : join(ARTIFACT_DIR, outPath);
  mkdirSync(dirname(target), { recursive: true });
  let wav = buffer;
  const isWav = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF";
  if (!isWav) wav = pcmToWav(buffer, 24000);
  writeFileSync(target, wav);
  const sampleRate = isWav ? wav.readUInt32LE(24) : 24000;
  const seconds = Math.max(0, (wav.length - 44) / (sampleRate * 2));
  return { path: target, sampleRate, seconds: Number(seconds.toFixed(2)), bytes: wav.length };
}

async function ttsOpenRouter({ text, voice = "alloy", style, model, out }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const prompt = style ? `${style}\n\nRead this text verbatim:\n${text}` : text;
  const response = await fetch(OPENROUTER, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "x-title": "Egytronic Studio" },
    body: JSON.stringify({
      model: model || "openai/gpt-audio-mini",
      modalities: ["text", "audio"],
      audio: { voice, format: "wav" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const text_ = await response.text();
  if (!response.ok) throw new Error(`openrouter ${response.status}: ${text_.slice(0, 300)}`);
  const payload = JSON.parse(text_);
  const base64 = payload.choices?.[0]?.message?.audio?.data;
  if (!base64) throw new Error("openrouter returned no audio");
  const saved = saveAudio(Buffer.from(base64, "base64"), out);
  return { ...saved, voice, provider: "openrouter", model: model || "openai/gpt-audio-mini" };
}

export async function tts({ text, voice, style = "", model, out = "voice.wav", provider = "auto" }) {
  if (!text) throw new Error("tts needs text");
  const chosen = pickProvider(provider);
  if (chosen === "openrouter") return ttsOpenRouter({ text, voice, style, model, out });
  const voiceName = voice || "Kore";
  const prompt = style ? `${style}\n\nاقرأ النص التالي حرفيًا:\n${text}` : text;
  const data = await callModel(model || "gemini-2.5-flash-preview-tts", {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
    },
  });
  const inline = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) throw new Error("gemini returned no audio");
  const rate = Number((/rate=(\d+)/.exec(inline.mimeType || "") || [])[1] || 24000);
  return { ...saveAudio(Buffer.from(inline.data, "base64"), out), voice: voiceName, provider: "gemini" };
}

export function wavDataUri(path) {
  const wav = readFileSync(path);
  return `data:audio/wav;base64,${wav.toString("base64")}`;
}

export async function stt({ audio, language = "ar", model = "gemini-2.5-flash" }) {
  const path = resolveArtifact(audio);
  const buffer = readFileSync(path);
  const mimeType = MIME[extname(path).toLowerCase()] || "audio/wav";
  const data = await callModel(model, {
    contents: [
      {
        parts: [
          { text: `Transcribe this audio (language: ${language}). Return JSON only: {"text": "...", "segments": [{"text": "...", "start": 0, "end": 1.4}]} with seconds from the start.` },
          { inlineData: { mimeType, data: buffer.toString("base64") } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("") || "{}";
  let parsed;
  try {
    parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    parsed = { text, segments: [] };
  }
  return { path, language, text: parsed.text || "", segments: parsed.segments || [] };
}

export async function runCli(command, rest, arg) {
  const out = arg("out", undefined);
  if (command === "tts") {
    return tts({ text: arg("text"), voice: arg("voice", "Kore"), style: arg("style", ""), out: out || "voice.wav" });
  }
  if (command === "stt") {
    const file = rest.find((value) => !value.startsWith("-"));
    return stt({ audio: file, language: arg("lang", "ar") });
  }
  const mod = await import("./captions.js");
  const input = JSON.parse(readFileSync(rest.find((value) => !value.startsWith("-")), "utf8"));
  return mod.writeCaptions(input.words || input.segments || input, out);
}
