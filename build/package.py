"""Builds the sellable product: dist/n8n-AI-Agent-Starter-Pack-v<VERSION>.zip

Steps: generate workflows -> check sheet templates -> render PDFs -> stage the pack
folder -> zip -> verify the zip (contents, JSON, PDFs, files referenced in the docs).

Usage: python3 build/package.py [--skip-docs]
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
VERSION = "1.0"
NAME = "n8n-AI-Agent-Starter-Pack"
DIST = os.path.join(ROOT, "dist")
STAGE = os.path.join(DIST, "stage", NAME)
ZIP = os.path.join(DIST, f"{NAME}-v{VERSION}.zip")
DOCS_OUT = os.path.join(DIST, "docs")
PRODUCT = os.path.join(ROOT, "product")

LAYOUT = {
    # destination in the zip           : source
    "START HERE - Setup Guide.pdf": os.path.join(DOCS_OUT, "START HERE - Setup Guide.pdf"),
    "README.txt": os.path.join(PRODUCT, "README.txt"),
    "LICENSE.txt": os.path.join(PRODUCT, "LICENSE.txt"),
    "workflows/": os.path.join(PRODUCT, "workflows", "*.json"),
    "google-sheets-templates/": os.path.join(PRODUCT, "google-sheets-templates", "*.csv"),
    "website-chat-widget/": os.path.join(PRODUCT, "website-chat-widget", "*.html"),
    "self-hosting/": [os.path.join(PRODUCT, "self-hosting", f) for f in ("docker-compose.yml", "Caddyfile", "env.example")],
    "bonuses/": os.path.join(DOCS_OUT, "bonuses", "*.pdf"),
}


def run(*args):
    print("$", " ".join(os.path.relpath(a, ROOT) if os.path.isabs(a) else a for a in args))
    subprocess.run(args, check=True, cwd=ROOT)


def stage():
    shutil.rmtree(os.path.dirname(STAGE), ignore_errors=True)
    for dest, src in LAYOUT.items():
        sources = src if isinstance(src, list) else sorted(glob.glob(src)) if "*" in src else [src]
        if not sources:
            raise SystemExit(f"nothing found for {dest} ({src})")
        for path in sources:
            if not os.path.exists(path):
                raise SystemExit(f"missing: {path}")
            target = os.path.join(STAGE, dest, os.path.basename(path)) if dest.endswith("/") else os.path.join(STAGE, dest)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(path, target)


def make_zip():
    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder, _, files in sorted(os.walk(STAGE)):
            for f in sorted(files):
                full = os.path.join(folder, f)
                z.write(full, os.path.join(NAME, os.path.relpath(full, STAGE)))


def verify():
    problems = []
    with zipfile.ZipFile(ZIP) as z:
        names = z.namelist()
        bad = z.testzip()
        if bad:
            problems.append(f"corrupt entry: {bad}")
        files = {os.path.basename(n): n for n in names}
        workflows = [n for n in names if n.startswith(f"{NAME}/workflows/") and n.endswith(".json")]
        if len(workflows) != 11:
            problems.append(f"expected 11 workflows, found {len(workflows)}")
        for n in workflows:
            wf = json.loads(z.read(n))
            if not wf.get("nodes") or "connections" not in wf:
                problems.append(f"{n}: not a workflow")
            for node in wf["nodes"]:
                if node.get("credentials"):
                    problems.append(f"{n}: node '{node['name']}' ships with credentials")
        for n in names:
            if n.endswith(".pdf"):
                head = z.read(n)[:5]
                if head != b"%PDF-":
                    problems.append(f"{n}: not a PDF")
        # every file name the buyer is told to open must be in the zip
        texts = [open(os.path.join(HERE, "docs", "guide.md"), encoding="utf-8").read(), z.read(f"{NAME}/README.txt").decode()]
        for wf_name in workflows:
            for node in json.loads(z.read(wf_name))["nodes"]:
                if node["type"] == "n8n-nodes-base.stickyNote":
                    texts.append(node["parameters"]["content"])
        referenced = set()
        for text in texts:
            referenced |= set(re.findall(r"[\w .-]+\.(?:csv|json|html|pdf|yml)\b", text))
        for ref in sorted(referenced):
            base = os.path.basename(ref.strip())
            if base.startswith(("http", "www.")) or base in ("sitemap.xml",):
                continue
            if base not in files and not any(n.endswith("/" + ref.strip()) for n in names):
                problems.append(f"referenced but not in the zip: {ref.strip()}")
    # the listing copy and the guide must agree on the page count
    pages = int(subprocess.run(["pdfinfo", os.path.join(DOCS_OUT, "START HERE - Setup Guide.pdf")], check=True,
                               capture_output=True, text=True).stdout.split("Pages:")[1].split()[0])
    for doc in ("seller-kit/gumroad-listing.md",):
        for claimed in set(re.findall(r"(\d+)-page", open(os.path.join(ROOT, doc), encoding="utf-8").read())):
            if int(claimed) != pages:
                problems.append(f"{doc} says {claimed}-page guide, the PDF has {pages} pages")
    size = os.path.getsize(ZIP) / 1e6
    print(f"\n{os.path.relpath(ZIP, ROOT)}  ({size:.1f} MB, {len(names)} files)")
    for n in names:
        print("   ", n)
    if problems:
        print("\n".join("❌ " + p for p in problems))
        sys.exit(1)
    print("✅ zip verified")


def main():
    run(sys.executable, os.path.join(HERE, "build_workflows.py"))
    run(sys.executable, os.path.join(HERE, "build_templates.py"))
    if "--skip-docs" not in sys.argv:
        run(sys.executable, os.path.join(HERE, "build_docs.py"), DOCS_OUT)
    stage()
    make_zip()
    verify()


if __name__ == "__main__":
    main()
