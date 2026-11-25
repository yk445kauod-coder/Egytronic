"""Fold the static extras into dist/ and fix each page's document language."""

import hashlib
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

EXTRAS = ["_worker.js", "_headers", "robots.txt", "admin"]


def localise() -> None:
    for page in DIST.glob("en/**/index.html"):
        html = page.read_text(encoding="utf-8")
        html = html.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
        page.write_text(html, encoding="utf-8")
    home = DIST / "en/index.html"
    if home.exists():
        html = home.read_text(encoding="utf-8").replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
        home.write_text(html, encoding="utf-8")


def fingerprint_admin() -> None:
    page = DIST / "admin/index.html"
    if not page.exists():
        return
    html = page.read_text(encoding="utf-8")
    for url in ("/assets/js/admin.js", "/assets/css/admin.css"):
        asset = DIST / url.lstrip("/")
        if not asset.exists():
            continue
        digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:8]
        html = re.sub(rf"{re.escape(url)}(\?v=[0-9a-zA-Z]+)?", f"{url}?v={digest}", html)
    page.write_text(html, encoding="utf-8")


def sitemap() -> None:
    import json
    import subprocess

    catalog = json.loads((ROOT / "src/data/catalog.json").read_text(encoding="utf-8"))
    site = catalog["site"]
    raw = (ROOT / "src/data/posts.ts").read_text(encoding="utf-8")
    posts = re.findall(r'slug: "([a-z0-9-]+)",\s*\n\s*date: "([0-9-]+)"', raw)

    def lastmod(path: str, fallback: str) -> str:
        try:
            out = subprocess.run(
                ["git", "log", "-1", "--format=%cs", "--", path],
                cwd=ROOT, capture_output=True, text=True, check=False,
            ).stdout.strip()
            return out or fallback
        except Exception:
            return fallback

    today = date.today().isoformat()
    pages = [
        ("/", "1.0", "src/pages/Home.tsx", today),
        ("/pricing/", "0.9", "src/pages/Pricing.tsx", today),
        ("/software/", "0.7", "src/pages/Software.tsx", today),
        ("/blog/", "0.9", "src/data/posts.ts", today),
        ("/contact/", "0.7", "src/pages/Contact.tsx", today),
        ("/answers/", "0.8", "src/pages/Answers.tsx", today),
    ]
    for slug, day in posts:
        pages.append((f"/blog/{slug}/", "0.6", "src/data/posts.ts", day))

    rows = []
    for path, priority, source, fallback in pages:
        en = "/en/" if path == "/" else f"/en{path}"
        mod = lastmod(source, fallback)
        for loc, ar_href, en_href in ((path, path, en), (en, path, en)):
            rows.append(
                f"  <url>\n"
                f"    <loc>{site}{loc}</loc>\n"
                f"    <lastmod>{mod}</lastmod>\n"
                f"    <changefreq>{'weekly' if '/blog/' in loc else 'monthly'}</changefreq>\n"
                f"    <priority>{'1.0' if loc == '/' else ('0.8' if loc == '/en/' else priority)}</priority>\n"
                f'    <xhtml:link rel="alternate" hreflang="ar" href="{site}{ar_href}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{site}{en_href}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{site}{ar_href}"/>\n'
                f"  </url>\n"
            )

    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "".join(rows)
        + "</urlset>\n",
        encoding="utf-8",
    )


def main() -> None:
    localise()
    for name in EXTRAS:
        src = ROOT / name
        dst = DIST / name
        if src.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        elif src.exists():
            shutil.copy2(src, dst)
    fingerprint_admin()
    not_found = ROOT / "404.html"
    if not_found.exists():
        shutil.copy2(not_found, DIST / "404.html")
    sitemap()
    agent = subprocess.run(["node", "scripts/agent-files.mjs"], cwd=ROOT, check=False)
    if agent.returncode != 0:
        raise SystemExit("agent files failed")
    print("postbuild ok")


if __name__ == "__main__":
    main()
