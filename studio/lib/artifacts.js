import { mkdirSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STUDIO_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const ARTIFACT_DIR = join(STUDIO_ROOT, "artifacts");

export function writeArtifact(html, target) {
  const path = isAbsolute(target) ? target : join(ARTIFACT_DIR, target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html, "utf8");
  const bytes = statSync(path).size;
  return { path, bytes };
}

export function listArtifacts() {
  try {
    return readdirSync(ARTIFACT_DIR)
      .filter((name) => name.endsWith(".html"))
      .map((name) => ({ name, bytes: statSync(join(ARTIFACT_DIR, name)).size }));
  } catch {
    return [];
  }
}

export function resolveArtifact(path) {
  return isAbsolute(path) ? path : resolve(ARTIFACT_DIR, path);
}
