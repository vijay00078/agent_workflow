"""Renders the Gumroad listing images (seller-kit/images) from HTML + real screenshots.

Usage: python3 build/build_seller_kit.py
Needs: the guide PDFs in dist/docs (python3 build/build_docs.py), pdftoppm, pdftotext,
Node + Playwright (build/lib/shot.js).
"""
import glob
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "seller-kit", "src")
ASSETS = os.path.join(SRC, "assets")
OUT = os.path.join(ROOT, "seller-kit", "images")
NODE = os.environ.get("NODE", "/opt/node24/package/bin/node")
GUIDE = os.path.join(ROOT, "dist", "docs", "START HERE - Setup Guide.pdf")
PLAYBOOK = os.path.join(ROOT, "dist", "docs", "bonuses", "AI Automation Agency Playbook.pdf")
PROMPTS = os.path.join(ROOT, "dist", "docs", "bonuses", "AI Prompt Pack.pdf")
SHOTS = "../../build/screenshots"  # relative to seller-kit/src

WORKFLOWS = [
    ("01", "📬", "AI Inbox Assistant", "Labels every email and drafts replies in your voice"),
    ("02", "💬", "WhatsApp AI Bot", "Answers text, voice notes & photos 24/7"),
    ("03", "🤖", "AI Website Chatbot", "Trained on your website, captures leads"),
    ("04", "🧠", "Telegram AI Assistant", "Calendar, Gmail & to-dos by voice"),
    ("05", "🎯", "Google Maps Lead Finder", "Local leads with emails & AI openers"),
    ("06", "⚡", "AI Lead Qualifier", "Scores leads, replies in 60 seconds"),
    ("07", "♻️", "Blog-to-Social Repurposer", "1 article → 9 ready-to-post pieces"),
    ("08", "✍️", "AI SEO Blog Writer", "Sheet topics → full Google Docs articles"),
    ("09", "🧾", "Invoice Extractor (GST)", "PDFs & photos → Google Sheets register"),
    ("10", "☕", "Daily AI News Digest", "Your personal AI editor every morning"),
    ("★", "🚨", "BONUS: Error Alerts", "Failures explained, with AI fix tips"),
]


def page_of(pdf, text):
    pages = subprocess.run(["pdftotext", "-layout", pdf, "-"], check=True, capture_output=True, text=True).stdout.split("\f")
    for i, p in enumerate(pages):
        head = "\n".join(line for line in p.splitlines() if line.strip())[:300]
        if text in head:
            return i + 1
    raise SystemExit(f"'{text}' not found in {pdf}")


def render_pdf_page(pdf, page, name):
    base = os.path.join(ASSETS, name)
    subprocess.run(["pdftoppm", "-r", "110", "-png", "-singlefile", "-f", str(page), "-l", str(page), pdf, base],
                   check=True, stderr=subprocess.DEVNULL)
    return f"assets/{name}.png"


def doc(body, w, h, extra_css=""):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="kit.css">
<style>:root {{ --w: {w}px; --h: {h}px; }} {extra_css}</style></head><body>{body}</body></html>"""


def cover():
    css = """
    .left { position: absolute; left: 64px; top: 58px; width: 560px; }
    h1 { font-size: 118px; margin-top: 26px; }
    h2 { font-size: 40px; margin-top: 10px; font-weight: 700; letter-spacing: -0.02em; }
    .checks { margin-top: 34px; }
    .bottom { position: absolute; left: 64px; bottom: 44px; display: flex; gap: 10px; }
    .canvas1 { position: absolute; left: 650px; top: 70px; width: 640px; transform: rotate(-4deg); }
    .canvas2 { position: absolute; left: 600px; top: 330px; width: 520px; transform: rotate(3deg); }
    .phone { position: absolute; right: 52px; top: 210px; width: 250px; transform: rotate(4deg); border-radius: 26px; padding: 7px; }
    .phone img { border-radius: 20px; }
    """
    body = f"""
    <div class="card canvas1"><img src="{SHOTS}/canvas/04-telegram-ai-personal-assistant.png"></div>
    <div class="card canvas2"><img src="{SHOTS}/canvas/05-google-maps-lead-finder.png"></div>
    <div class="card phone"><img src="{SHOTS}/chat/chat-answer.png"></div>
    <div class="left">
      <span class="kicker">n8n · Starter Pack</span>
      <h1 class="display">10 AI <span class="grad-text">Agents</span></h1>
      <h2>ready to run in n8n</h2>
      <ul class="checks">
        <li>WhatsApp bot & website chatbot</li>
        <li>Lead finder + 60-second lead replies</li>
        <li>AI inbox, invoices, blog & social</li>
        <li>Step-by-step PDF guide + 2 bonuses</li>
      </ul>
    </div>
    <div class="bottom"><span class="chip">⚡ Import in seconds</span><span class="chip">🧩 No code</span><span class="chip">☁️ Cloud & self-hosted</span></div>
    """
    return doc(body, 1280, 720, css)


def thumbnail():
    css = """
    .wrap { position: absolute; left: 44px; top: 40px; right: 44px; }
    h1 { font-size: 112px; margin-top: 18px; }
    .canvas { position: absolute; left: 34px; bottom: 34px; width: 340px; transform: rotate(-4deg); }
    .phone { position: absolute; right: 38px; bottom: 22px; width: 148px; transform: rotate(5deg); border-radius: 20px; padding: 6px; }
    .phone img { border-radius: 16px; }
    .kicker { font-size: 17px; }
    """
    body = f"""
    <div class="wrap"><span class="kicker">n8n starter pack</span>
      <h1 class="display">10 AI<br><span class="grad-text">Agents</span></h1></div>
    <div class="card canvas"><img src="{SHOTS}/canvas/02-whatsapp-ai-auto-reply-bot.png"></div>
    <div class="card phone"><img src="{SHOTS}/chat/chat-answer.png"></div>
    """
    return doc(body, 600, 600, css)


def inside():
    cards = "\n".join(
        f"""<div class="wf{' bonus' if n == '★' else ''}"><div class="num">{n}</div><div class="emo">{e}</div><div><b>{t}</b><span>{d}</span></div></div>"""
        for n, e, t, d in WORKFLOWS
    )
    css = """
    .head { position: absolute; left: 60px; top: 46px; right: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 64px; }
    .head .label { font-size: 19px; text-align: right; line-height: 1.5; }
    .grid { position: absolute; left: 60px; right: 60px; top: 160px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .wf { display: flex; gap: 14px; align-items: center; background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.22);
          border-radius: 16px; padding: 14px 16px; min-height: 104px; }
    .wf.bonus { background: linear-gradient(135deg, rgba(251,191,36,0.28), rgba(236,72,153,0.25)); border-color: rgba(253,230,138,0.6); }
    .num { font: 800 15px Inter; color: #c4b5fd; width: 24px; }
    .emo { font-size: 34px; width: 44px; text-align: center; }
    .wf b { display: block; font-size: 20px; line-height: 1.2; }
    .wf span { display: block; font-size: 15px; color: rgba(255,255,255,0.78); margin-top: 4px; line-height: 1.3; }
    .foot { position: absolute; left: 60px; right: 60px; bottom: 34px; display: flex; gap: 10px; }
    """
    body = f"""
    <div class="head"><h1 class="display">What's inside</h1>
      <div class="label">10 workflows + bonus · tested on n8n 2.x<br>works with n8n 1.100 and newer</div></div>
    <div class="grid">{cards}
      <div class="wf" style="background: rgba(16,185,129,0.22); border-color: rgba(110,231,183,0.6);"><div class="num">+</div><div class="emo">📚</div><div><b>Setup guide & bonuses</b><span>Guide, Agency Playbook, Prompt Pack, sheets, widget</span></div></div>
    </div>
    """
    return doc(body, 1280, 720, css)


def chatbot():
    css = """
    .left { position: absolute; left: 60px; top: 70px; width: 470px; }
    h1 { font-size: 60px; }
    p.sub { font-size: 23px; line-height: 1.4; color: rgba(255,255,255,0.85); margin: 18px 0 30px; }
    .checks li { font-size: 21px; }
    .browser { position: absolute; left: 560px; top: 64px; width: 680px; transform: rotate(1.5deg); }
    .tag { position: absolute; left: 60px; bottom: 44px; }
    """
    body = f"""
    <div class="left">
      <h1 class="display">A chatbot trained on <span class="grad-text">your website</span></h1>
      <p class="sub">Paste your URL. The bot reads your pages and answers visitors 24/7, with links to the right page.</p>
      <ul class="checks">
        <li>Re-learns your site every night</li>
        <li>Saves interested visitors as leads</li>
        <li>Copy-paste widget for any website</li>
        <li>WordPress, Webflow, Shopify, Wix…</li>
      </ul>
    </div>
    <div class="browser"><div class="bar"><i></i><i></i><i></i><span>yourwebsite.com</span></div>
      <img src="{SHOTS}/chat/widget-on-website.png"></div>
    <div class="tag label">Real screenshot of workflow 03 with the included chat widget</div>
    """
    return doc(body, 1280, 720, css)


def canvas():
    css = """
    .head { position: absolute; left: 60px; top: 42px; right: 60px; }
    h1 { font-size: 60px; }
    .steps { display: flex; gap: 12px; margin-top: 18px; }
    .shot { position: absolute; left: 60px; right: 60px; top: 196px; }
    .caption { position: absolute; left: 60px; right: 60px; bottom: 16px; text-align: center; }
    """
    body = f"""
    <div class="head"><h1 class="display">Import. Connect. <span class="grad-text">Done.</span></h1>
      <div class="steps"><span class="chip">1 · Import the file</span><span class="chip">2 · Connect your accounts</span><span class="chip">3 · Fill in one Config node</span><span class="chip">4 · Publish ✅</span></div></div>
    <div class="card shot"><img src="{SHOTS}/canvas/06-ai-lead-qualifier-instant-reply.png"></div>
    <div class="caption label">Real n8n canvas of workflow 06 · every workflow has a 🟨 START HERE note, one ✏️ Config node and color-coded steps</div>
    """
    return doc(body, 1280, 720, css)


def guide(pages):
    css = """
    .left { position: absolute; left: 60px; top: 74px; width: 440px; }
    h1 { font-size: 60px; }
    p.sub { font-size: 22px; line-height: 1.4; color: rgba(255,255,255,0.85); margin: 18px 0 28px; }
    .checks li { font-size: 21px; }
    .pg { position: absolute; width: 300px; border-radius: 6px; overflow: hidden; box-shadow: 0 24px 50px rgba(10,5,40,0.55); background: #fff; }
    .pg img { display: block; width: 100%; }
    .p1 { left: 520px; top: 60px; transform: rotate(-6deg); }
    .p2 { left: 700px; top: 92px; transform: rotate(-1deg); }
    .p3 { left: 880px; top: 60px; transform: rotate(5deg); }
    .b1 { left: 610px; top: 420px; width: 250px; transform: rotate(-4deg); }
    .b2 { left: 900px; top: 410px; width: 250px; transform: rotate(4deg); }
    .bonus { position: absolute; left: 836px; top: 395px; z-index: 5; background: #10b981; font-weight: 800; font-size: 17px; padding: 8px 14px; border-radius: 99px; transform: rotate(-3deg); }
    """
    body = f"""
    <div class="left">
      <h1 class="display">Step-by-step, <span class="grad-text">no guesswork</span></h1>
      <p class="sub">A {pages['count']}-page setup guide walks you through every account, key and click.</p>
      <ul class="checks">
        <li>WhatsApp, Google & Telegram setup</li>
        <li>Costs, troubleshooting & FAQ</li>
        <li>Agency Playbook: sell to clients</li>
        <li>Prompt Pack: industry presets</li>
      </ul>
    </div>
    <div class="pg p1"><img src="{pages['cover']}"></div>
    <div class="pg p3"><img src="{pages['accounts']}"></div>
    <div class="pg p2"><img src="{pages['chapter']}"></div>
    <div class="pg b1"><img src="{pages['playbook']}"></div>
    <div class="pg b2"><img src="{pages['prompts']}"></div>
    <div class="bonus">+ 2 BONUS PDFs</div>
    """
    return doc(body, 1280, 720, css)


def main():
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(ASSETS, "*.png")):
        os.remove(f)
    count = int(subprocess.run(["pdfinfo", GUIDE], check=True, capture_output=True, text=True).stdout.split("Pages:")[1].split()[0])
    pages = {
        "count": count,
        "cover": render_pdf_page(GUIDE, 1, "guide-cover"),
        "chapter": render_pdf_page(GUIDE, page_of(GUIDE, "AI Lead Qualifier & Instant Reply"), "guide-chapter"),
        "accounts": render_pdf_page(GUIDE, page_of(GUIDE, "Accounts & credentials"), "guide-accounts"),
        "playbook": render_pdf_page(PLAYBOOK, 1, "playbook-cover"),
        "prompts": render_pdf_page(PROMPTS, 1, "prompts-cover"),
    }
    pages_1280 = {
        "1-cover": cover(),
        "3-whats-inside": inside(),
        "4-website-chatbot": chatbot(),
        "5-import-connect-done": canvas(),
        "6-setup-guide-and-bonuses": guide(pages),
    }
    jobs_1280, jobs_600 = [], []
    for name, html in pages_1280.items():
        path = os.path.join(SRC, name + ".html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        jobs_1280 += [path, os.path.join(OUT, name + ".png")]
    thumb = os.path.join(SRC, "2-thumbnail.html")
    with open(thumb, "w", encoding="utf-8") as f:
        f.write(thumbnail())
    jobs_600 += [thumb, os.path.join(OUT, "2-thumbnail.png")]
    shot = os.path.join(HERE, "lib", "shot.js")
    subprocess.run([NODE, shot, "1280", "720", "2", *jobs_1280], check=True, cwd=ROOT)
    subprocess.run([NODE, shot, "600", "600", "2", *jobs_600], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
