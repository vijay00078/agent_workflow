"""Renders Instagram ad creatives (seller-kit/instagram) from real screenshots.

Feed ads: 1080x1350 (4:5). Stories/Reels ads: 1080x1920 (9:16), text kept inside the
safe zone (no text in the top 250 px or the bottom 340 px, where Instagram's UI sits).

Usage: python3 build/build_instagram_ads.py
"""
import os
import subprocess

from build_seller_kit import HERE, ROOT, SRC, SHOTS, NODE, doc

OUT = os.path.join(ROOT, "seller-kit", "instagram")

BASE_CSS = """
.kicker { font-size: 11px; padding: 6px 11px; letter-spacing: 0.14em; }
.checks { gap: 9px; }
.checks li { font-size: 16px; gap: 10px; }
.checks li::before { width: 22px; height: 22px; font-size: 13px; }
.card { border-radius: 12px; padding: 5px; box-shadow: 0 18px 40px rgba(10,5,40,0.5), 0 0 0 1px rgba(255,255,255,0.4); }
.card img { border-radius: 8px; }
.phone { border-radius: 18px; padding: 5px; }
.phone img { border-radius: 14px; }
.cta { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #4c1d95; font-weight: 800;
       font-size: 15px; padding: 11px 18px; border-radius: 99px; box-shadow: 0 10px 24px rgba(10,5,40,0.35); }
.price { display: inline-block; background: #10b981; color: #fff; font-weight: 800; font-size: 15px; padding: 9px 14px; border-radius: 99px; }
.foot { position: absolute; left: 34px; right: 34px; display: flex; justify-content: space-between; align-items: center; }
"""


def feed_chatbot():
    css = BASE_CSS + """
    .top { position: absolute; left: 34px; right: 34px; top: 34px; }
    h1 { font-size: 46px; margin-top: 16px; }
    p.sub { font-size: 18px; margin-top: 12px; color: rgba(255,255,255,0.85); line-height: 1.4; max-width: 420px; }
    .canvas { position: absolute; left: 24px; top: 300px; width: 330px; transform: rotate(-4deg); }
    .phone { position: absolute; right: 30px; top: 245px; width: 220px; transform: rotate(3deg); }
    .foot { bottom: 30px; }
    """
    body = f"""
    <div class="top"><span class="kicker">n8n AI agents</span>
      <h1 class="display">Your website answers customers at <span class="grad-text">2&nbsp;AM.</span></h1>
      <p class="sub">An AI chatbot that learns your website and replies 24/7, while you sleep.</p></div>
    <div class="card canvas"><img src="{SHOTS}/canvas/03-ai-website-chatbot.png"></div>
    <div class="card phone"><img src="{SHOTS}/chat/chat-answer.png"></div>
    <div class="foot"><span class="price">10 AI agents · $9</span><span class="cta">Get the pack →</span></div>
    """
    return doc(body, 540, 675, css)


AGENTS = [
    ("📬", "AI email assistant"), ("💬", "WhatsApp AI bot"), ("🌐", "Website chatbot"), ("🎯", "Lead finder"),
    ("⚡", "Instant lead replies"), ("🧠", "Telegram assistant"), ("♻️", "Social media posts"),
    ("✍️", "SEO blog writer"), ("🧾", "Invoice reader"), ("☕", "Daily news digest"),
]


def feed_bundle():
    tiles = "".join(f'<div class="t"><span>{e}</span>{n}</div>' for e, n in AGENTS)
    css = BASE_CSS + """
    .top { position: absolute; left: 34px; right: 34px; top: 34px; }
    h1 { font-size: 50px; margin-top: 16px; }
    p.sub { font-size: 17px; margin-top: 10px; color: rgba(255,255,255,0.85); }
    .grid { position: absolute; left: 34px; right: 34px; top: 252px; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    .t { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; padding: 12px 13px; border-radius: 12px;
         background: rgba(255,255,255,0.11); border: 1px solid rgba(255,255,255,0.24); }
    .t span { font-size: 22px; }
    .foot { bottom: 30px; }
    """
    body = f"""
    <div class="top"><span class="kicker">n8n workflow templates</span>
      <h1 class="display">10 AI agents.<br><span class="grad-text">One download.</span></h1>
      <p class="sub">Ready to import into n8n. Step-by-step guide included.</p></div>
    <div class="grid">{tiles}</div>
    <div class="foot"><span class="price">Only $9</span><span class="cta">Get the pack →</span></div>
    """
    return doc(body, 540, 675, css)


def feed_leads():
    css = BASE_CSS + """
    .top { position: absolute; left: 34px; right: 34px; top: 34px; }
    h1 { font-size: 44px; margin-top: 16px; }
    .shot { position: absolute; left: 24px; right: 24px; top: 236px; transform: rotate(-1.5deg); }
    .checks { position: absolute; left: 34px; right: 34px; top: 455px; }
    .foot { bottom: 30px; }
    """
    body = f"""
    <div class="top"><span class="kicker">n8n AI agents</span>
      <h1 class="display">Still replying to every lead <span class="grad-text">by hand?</span></h1></div>
    <div class="card shot"><img src="{SHOTS}/canvas/06-ai-lead-qualifier-instant-reply.png"></div>
    <ul class="checks">
      <li>Scores every new lead from 0 to 100</li>
      <li>Replies with your booking link in under a minute</li>
      <li>Alerts you the moment a hot lead arrives</li>
    </ul>
    <div class="foot"><span class="price">+ 9 more AI agents · $9</span><span class="cta">Get the pack →</span></div>
    """
    return doc(body, 540, 675, css)


def story_bundle():
    css = BASE_CSS + """
    .top { position: absolute; left: 34px; right: 34px; top: 140px; }
    h1 { font-size: 56px; margin-top: 16px; }
    p.sub { font-size: 19px; margin-top: 12px; color: rgba(255,255,255,0.85); line-height: 1.4; }
    .canvas { position: absolute; left: 22px; top: 390px; width: 330px; transform: rotate(-4deg); }
    .phone { position: absolute; right: 28px; top: 345px; width: 200px; transform: rotate(4deg); }
    .checks { position: absolute; left: 34px; right: 34px; top: 640px; }
    .foot { top: 738px; }
    """
    body = f"""
    <div class="top"><span class="kicker">n8n starter pack</span>
      <h1 class="display">10 AI agents<br>for <span class="grad-text">n8n</span></h1>
      <p class="sub">WhatsApp bot, website chatbot, lead finder, AI inbox and more. Ready to import.</p></div>
    <div class="card canvas"><img src="{SHOTS}/canvas/02-whatsapp-ai-auto-reply-bot.png"></div>
    <div class="card phone"><img src="{SHOTS}/chat/chat-answer.png"></div>
    <ul class="checks">
      <li>No coding needed</li>
      <li>38-page step-by-step setup guide</li>
      <li>n8n Cloud or self-hosted</li>
    </ul>
    <div class="foot"><span class="price">Only $9</span><span class="cta">Get it below ↓</span></div>
    """
    return doc(body, 540, 960, css)


def story_leads():
    css = BASE_CSS + """
    .top { position: absolute; left: 34px; right: 34px; top: 140px; }
    h1 { font-size: 46px; margin-top: 16px; }
    .query { display: inline-block; margin-top: 18px; background: #fff; color: #1f1b2e; font-size: 19px; font-weight: 600;
             padding: 12px 18px; border-radius: 12px; box-shadow: 0 10px 24px rgba(10,5,40,0.35); }
    .shot { position: absolute; left: 20px; right: 20px; top: 430px; transform: rotate(-2deg); }
    .checks { position: absolute; left: 34px; right: 34px; top: 612px; }
    .foot { top: 724px; }
    """
    body = f"""
    <div class="top"><span class="kicker">AI lead generation</span>
      <h1 class="display">Type a business and a city. Get <span class="grad-text">60 leads.</span></h1>
      <div class="query">🔎 dentists in Austin</div></div>
    <div class="card shot"><img src="{SHOTS}/canvas/05-google-maps-lead-finder.png"></div>
    <ul class="checks">
      <li>Emails, phone numbers and socials</li>
      <li>A lead score for each business</li>
      <li>A personal opening line, written by AI</li>
    </ul>
    <div class="foot"><span class="price">+ 9 more agents · $9</span><span class="cta">Get it below ↓</span></div>
    """
    return doc(body, 540, 960, css)


def main():
    os.makedirs(OUT, exist_ok=True)
    shot = os.path.join(HERE, "lib", "shot.js")
    feeds = {"feed-1-website-chatbot": feed_chatbot(), "feed-2-ten-agents": feed_bundle(), "feed-3-lead-replies": feed_leads()}
    stories = {"story-1-ten-agents": story_bundle(), "story-2-lead-finder": story_leads()}
    for size, pages in (("675", feeds), ("960", stories)):
        jobs = []
        for name, html in pages.items():
            path = os.path.join(SRC, f"ig-{name}.html")
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            jobs += [path, os.path.join(OUT, f"{name}.png")]
        subprocess.run([NODE, shot, "540", size, "2", *jobs], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
