"""Convert the reference page markup into JSX components.

The current site is the design; this keeps the DOM byte-for-byte while the renderer
becomes React. Output is plain components with no logic, then split by hand.
"""

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
CAMEL = {
    "class": "className",
    "for": "htmlFor",
    "tabindex": "tabIndex",
    "readonly": "readOnly",
    "maxlength": "maxLength",
    "minlength": "minLength",
    "autocomplete": "autoComplete",
    "autofocus": "autoFocus",
    "novalidate": "noValidate",
    "crossorigin": "crossOrigin",
    "referrerpolicy": "referrerPolicy",
    "srcset": "srcSet",
    "viewbox": "viewBox",
    "preserveaspectratio": "preserveAspectRatio",
    "gradientunits": "gradientUnits",
    "patternunits": "patternUnits",
    "clippathunits": "clipPathUnits",
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-dasharray": "strokeDasharray",
    "fill-rule": "fillRule",
    "clip-rule": "clipRule",
    "stop-color": "stopColor",
    "text-anchor": "textAnchor",
    "shape-rendering": "shapeRendering",
    "image-rendering": "imageRendering",
    "font-family": "fontFamily",
    "font-size": "fontSize",
    "font-weight": "fontWeight",
    "letter-spacing": "letterSpacing",
    "dominant-baseline": "dominantBaseline",
    "xlink:href": "xlinkHref",
    "xmlns:xlink": "xmlnsXlink",
    "aria-hidden": "aria-hidden",
}
TEXT_ESC = [("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ("{", "&#123;"), ("}", "&#125;")]


def style_obj(value):
    decls = [d for d in value.split(";") if d.strip()]
    parts = []
    for decl in decls:
        if ":" not in decl:
            continue
        prop, val = decl.split(":", 1)
        key = prop.strip()
        if "-" in key:
            head, *rest = key.split("-")
            key = head + "".join(p.title() for p in rest)
        parts.append(f'{key}: "{val.strip().replace(chr(34), chr(39))}"')
    return "{{ " + ", ".join(parts) + " }}"


class Jsx(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_starttag(self, tag, attrs):
        self.out.append(f"<{tag}{self.attrs(attrs)}>")
        if tag in VOID:
            self.out[-1] = f"<{tag}{self.attrs(attrs)} />"

    def handle_startendtag(self, tag, attrs):
        self.out.append(f"<{tag}{self.attrs(attrs)} />")

    def handle_endtag(self, tag):
        if tag not in VOID:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not data.strip():
            self.out.append(data.replace("{", "&#123;").replace("}", "&#125;"))
            return
        text = data
        for a, b in TEXT_ESC:
            text = text.replace(a, b)
        self.out.append(text)

    def attrs(self, attrs):
        parts = []
        for name, value in attrs:
            key = CAMEL.get(name, name)
            if value is None:
                parts.append(f" {key}")
                continue
            if name == "style":
                parts.append(f" style={style_obj(value)}")
                continue
            escaped = value.replace("&", "&amp;").replace('"', "&quot;")
            parts.append(f' {key}="{escaped}"')
        return "".join(parts)


def convert(html: str) -> str:
    parser = Jsx()
    parser.feed(html)
    parser.close()
    return "".join(parser.out)


def slice_between(html: str, start_marker: str, end_marker: str) -> str:
    i = html.index(start_marker)
    j = html.index(end_marker, i) + len(end_marker)
    return html[i:j]


def sections(main_inner: str):
    """Split top-level <section> blocks, keeping their id as the component name."""
    out = []
    depth = 0
    start = None
    for match in re.finditer(r"<section\b[^>]*>|</section>", main_inner):
        if match.group(0).startswith("</"):
            depth -= 1
            if depth == 0 and start is not None:
                out.append(main_inner[start:match.end()])
                start = None
        else:
            if depth == 0:
                start = match.start()
            depth += 1
    return out


def name_of(block: str, index: int) -> str:
    m = re.search(r'id="([^"]+)"', block[:200])
    raw = m.group(1) if m else f"block{index}"
    return "".join(p.title() for p in re.split(r"[-_]", raw)) or f"Block{index}"


def pascal(text: str) -> str:
    return text


def main():
    page = sys.argv[1]
    ref = ROOT / ".ref" / f"{page}.html"
    html = ref.read_text(encoding="utf-8")
    main_block = slice_between(html, '<main id="main">', "</main>")
    inner = main_block[len('<main id="main">'): -len("</main>")]
    parts = sections(inner)
    target = ROOT / "src/sections" / page
    target.mkdir(parents=True, exist_ok=True)
    used = set()
    index_lines = []
    for i, block in enumerate(parts):
        name = name_of(block, i)
        while name in used:
            name = f"{name}{i}"
        used.add(name)
        jsx = convert(block)
        (target / f"{name}.tsx").write_text(
            f"export default function {name}() {{\n  return (\n    <>\n      {jsx.strip()}\n    </>\n  );\n}}\n",
            encoding="utf-8",
        )
        index_lines.append(name)
    (target / "index.ts").write_text(
        "".join(f'export {{ default as {n} }} from "./{n}";\n' for n in index_lines),
        encoding="utf-8",
    )
    print(f"{page}: {len(parts)} sections -> {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
