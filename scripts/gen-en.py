"""Generate the English component tree from the Arabic source components.

The Arabic components are the source of truth. This mirrors them into src/en/ with the
phrase map produced by gen-copy.py, then fails if any Arabic is left behind.
"""

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = SRC / "en"
DIRS = ["sections", "pages"]
ESCAPES = ("js/", "vendor/", "i18n/", "styles/", "layout/")
ARABIC = re.compile(r"[\u0600-\u06FF]")

pairs = json.loads((SRC / "i18n/copy.json").read_text(encoding="utf-8"))
ordered = sorted(pairs.items(), key=lambda kv: len(kv[0]), reverse=True)


def convert(text: str) -> str:
    for ar, en in ordered:
        if ar in text:
            text = text.replace(ar, en)
    return text


def fix_imports(text: str, depth: int) -> str:
    prefix = "../" * depth
    for name in ESCAPES:
        text = text.replace(f'from "../{name}', f'from "{prefix}{name}')
    return text


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    missing = []
    written = 0
    for top in DIRS:
        for src in (SRC / top).rglob("*"):
            if src.is_dir() or src.suffix not in {".tsx", ".ts"}:
                continue
            rel = src.relative_to(SRC)
            depth = 1 + len(rel.parts) - 1  # ../ per directory between src/ and the file
            out = OUT / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            text = fix_imports(convert(src.read_text(encoding="utf-8")), depth)
            out.write_text(text, encoding="utf-8")
            written += 1
            for line_no, line in enumerate(text.splitlines(), 1):
                if ARABIC.search(line):
                    missing.append(f"{rel}:{line_no}: {line.strip()[:90]}")
    print(f"{written} files -> {OUT.relative_to(ROOT)}")
    if missing:
        print("untranslated Arabic:", file=sys.stderr)
        for row in missing[:40]:
            print("  " + row, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
