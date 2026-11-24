"""Fold the static extras into dist/ and fix each page's document language."""

import hashlib
import re
import shutil
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
    pages = ["/", "/pricing/", "/software/", "/contact/"]
    today = date.today().isoformat()
    rows = []
    for path in pages:
        en = "/en/" if path == "/" else f"/en{path}"
        rows.append(
            f"  <url>\n"
            f"    <loc>https://egytronic.pages.dev{path}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f"    <changefreq>monthly</changefreq>\n"
            f"    <priority>{'1.0' if path == '/' else '0.8'}</priority>\n"
            f'    <xhtml:link rel="alternate" hreflang="ar" href="https://egytronic.pages.dev{path}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="en" href="https://egytronic.pages.dev{en}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://egytronic.pages.dev{path}"/>\n'
            f"  </url>\n"
        )
    for path in ["/en/", "/en/pricing/", "/en/software/", "/en/contact/"]:
        ar = path[3:] or "/"
        rows.append(
            f"  <url>\n"
            f"    <loc>https://egytronic.pages.dev{path}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f"    <changefreq>monthly</changefreq>\n"
            f"    <priority>{'1.0' if path == '/en/' else '0.8'}</priority>\n"
            f'    <xhtml:link rel="alternate" hreflang="ar" href="https://egytronic.pages.dev{ar}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="en" href="https://egytronic.pages.dev{path}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://egytronic.pages.dev{ar}"/>\n'
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
    print("postbuild ok")


if __name__ == "__main__":
    main()
