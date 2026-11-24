"""Rewrites ?v= on every CSS/JS reference to a hash of that file.

Without this the stamp is a hand-written string: edit a stylesheet, forget to bump
it, and returning visitors keep the old CSS next to the new HTML (the layout breaks
in ways only they can see). Run before build-en.py so the English tree inherits it.
"""
from hashlib import sha1
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PATTERN = re.compile(r"(assets/(?:css|js)/[A-Za-z0-9_./-]+\.(?:css|js))(\?v=[A-Za-z0-9]+)?")


def digest(path: Path) -> str:
    return sha1(path.read_bytes()).hexdigest()[:8]


def main() -> None:
    versions = {p.relative_to(ROOT).as_posix(): digest(p) for p in ASSETS.rglob("*") if p.suffix in {".css", ".js"}}

    def swap(match: re.Match) -> str:
        path, _ = match.group(1), match.group(2)
        version = versions.get(path)
        return f"{path}?v={version}" if version else match.group(0)

    changed = 0
    for html in list(ROOT.glob("*.html")) + list(ROOT.glob("*/index.html")) + list(ROOT.glob("*/*/index.html")):
        original = html.read_text(encoding="utf-8")
        updated = PATTERN.sub(swap, original)
        # inline modules import fx-runner with an absolute path; PATTERN already covers it
        if updated != original:
            html.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"stamped {changed} files")


if __name__ == "__main__":
    main()
