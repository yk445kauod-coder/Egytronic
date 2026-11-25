// Gemini voice: TTS returns WAV (PCM wrapped), STT returns timed segments.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { ARTIFACT_DIR, resolveArtifact } from "./artifacts.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_VOICES = ["Kore", "Puck", "Zephyr", "Charon", "Fenrir", "Aoede", "Leda", "Orus"];

function key() {
  const value = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!value) throw new Error("GEMINI_API_KEY is not set (needed for TTS/STT)");
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

export async function tts({ text, voice = "Kore", style = "", model = "gemini-2.5-flash-preview-tts", out = "voice.wav" }) {
  if (!text) throw new Error("tts needs text");
  const prompt = style ? `${style}\n\nاقرأ النص التالي حرفيًا:\n${text}` : text;
  const data = await callModel(model, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const inline = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) throw new Error("gemini returned no audio");
  const rate = Number((/rate=(\d+)/.exec(inline.mimeType || "") || [])[1] || 24000);
  const wav = pcmToWav(Buffer.from(inline.data, "base64"), rate);
  const target = out.startsWith("/") ? out : join(ARTIFACT_DIR, out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, wav);
  const seconds = (wav.length - 44) / (rate * 2);
  return { path: target, voice, sampleRate: rate, seconds: Number(seconds.toFixed(2)), bytes: wav.length };
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
