"""Builds the PDF documents of the pack from build/docs/*.md.

markdown --(pandoc)--> HTML (build/docs/template.html + style.css) --(Chromium)--> PDF

Usage: python3 build/build_docs.py [output_dir]      (default: dist/docs)
Needs: pandoc, pdftotext, Node 18+ with Playwright (see build/lib/pdf.js).
"""
import html
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "docs")
NODE = os.environ.get("NODE", "/opt/node24/package/bin/node")

DOCUMENTS = [
    {
        "source": "guide.md",
        "output": "START HERE - Setup Guide.pdf",
        "theme": "guide",
        "kicker": "n8n · AI automation templates",
        "chips": ["10 workflows + bonus", "Tested on n8n 2.x", "Works with n8n 1.100+", "No code"],
        "toc_groups": {"welcome": "Getting started", "wf01": "The workflows", "sheets": "Reference"},
    },
    {
        "source": "agency-playbook.md",
        "output": "bonuses/AI Automation Agency Playbook.pdf",
        "theme": "playbook",
        "kicker": "Bonus · n8n AI Agent Starter Pack",
        "chips": ["Offers & pricing", "Outreach scripts", "Delivery checklists"],
    },
    {
        "source": "prompt-pack.md",
        "output": "bonuses/AI Prompt Pack.pdf",
        "theme": "prompts",
        "kicker": "Bonus · n8n AI Agent Starter Pack",
        "chips": ["Industry presets", "Copy & paste", "For all 10 workflows"],
    },
]


def postprocess(body: str, toc_groups: dict) -> str:
    # pandoc's fixed column widths make narrow tables look odd: let the browser size them
    body = re.sub(r"<colgroup>.*?</colgroup>", "", body, flags=re.S)
    # "01 · Title" / "★ BONUS · Title" chapter headings get a number badge
    body = re.sub(r"(<h1[^>]*>)(\d{1,2}|★)\s·\s", r'\1<span class="num">\2</span>', body)

    # "**Setup** 5 min · **Needs** …" boxes become chips
    def chips(match):
        parts = [p.strip() for p in match.group(1).split(" · ")]
        out = []
        for part in parts:
            m = re.match(r"<strong>(.*?)</strong>\s*(.*)", part, flags=re.S)
            if m:
                out.append(f'<span class="chip"><span class="k">{m.group(1)}</span><span class="v">{m.group(2)}</span></span>')
        return '<div class="wfmeta">' + "".join(out) + "</div>"

    body = re.sub(r'<div class="wfmeta">\s*<p>(.*?)</p>\s*</div>', chips, body, flags=re.S)

    # group headings inside the table of contents
    for anchor, label in toc_groups.items():
        body, count = re.subn(r'(<li>\s*<a href="#' + re.escape(anchor) + r'")', f'<li class="toc-group">{html.escape(label)}</li>\\1', body, count=1)
        if not count:
            raise SystemExit(f"TOC anchor #{anchor} not found")
    return body


def downscale_images(page: str, max_width: int = 2200) -> str:
    """Points the HTML at smaller JPEG copies of the big screenshots (keeps the PDFs light)."""
    from PIL import Image

    def swap(match):
        src = match.group(1)
        full = os.path.join(HERE, src)
        small_rel = os.path.join("docs", "_out", "img", os.path.splitext(src)[0] + ".jpg")
        small = os.path.join(HERE, small_rel)
        if not os.path.exists(small) or os.path.getmtime(small) < os.path.getmtime(full):
            os.makedirs(os.path.dirname(small), exist_ok=True)
            img = Image.open(full).convert("RGBA")
            flat = Image.new("RGB", img.size, (255, 255, 255))
            flat.paste(img, mask=img.split()[3])
            if flat.width > max_width:
                flat = flat.resize((max_width, round(flat.height * max_width / flat.width)), Image.LANCZOS)
            flat.save(small, "JPEG", quality=88, optimize=True, progressive=True)
        return f'src="{small_rel}"'

    return re.sub(r'src="(screenshots/[^"]+\.png)"', swap, page)


def build(doc: dict, out_dir: str) -> str:
    src = os.path.join(DOCS, doc["source"])
    html_path = os.path.join(DOCS, "_out", os.path.splitext(doc["source"])[0] + ".html")
    os.makedirs(os.path.dirname(html_path), exist_ok=True)
    args = [
        "pandoc", src, "-f", "markdown-implicit_figures+implicit_figures", "-t", "html5",
        "--section-divs", "--toc", "--toc-depth=1", "--no-highlight", "--wrap=none",
        "--template", os.path.join(DOCS, "template.html"),
        "-V", "base=file://" + HERE + "/",
        "-V", "theme=" + doc["theme"],
        "-V", "kicker=" + doc["kicker"],
    ]
    for chip in doc["chips"]:
        args += ["-V", "chips=" + chip]
    page = subprocess.run(args, check=True, capture_output=True, text=True).stdout
    page = postprocess(page, doc.get("toc_groups", {}))
    page = downscale_images(page)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(page)
    pdf_path = os.path.join(out_dir, doc["output"])
    subprocess.run([NODE, os.path.join(HERE, "lib", "pdf.js"), html_path, pdf_path], check=True)
    return pdf_path


def main():
    out_dir = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", "dist", "docs")
    only = os.environ.get("ONLY")
    for doc in DOCUMENTS:
        if only and only not in doc["source"]:
            continue
        if not os.path.exists(os.path.join(DOCS, doc["source"])):
            print("skip (missing):", doc["source"])
            continue
        build(doc, out_dir)


if __name__ == "__main__":
    main()
