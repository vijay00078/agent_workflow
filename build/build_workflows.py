"""Generate every workflow JSON file of the pack.

Usage:  python3 build/build_workflows.py [output_dir]
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

MODULES = [
    ("wf01_inbox", "01-ai-inbox-assistant.json"),
    ("wf02_whatsapp", "02-whatsapp-ai-auto-reply-bot.json"),
    ("wf03_website_chatbot", "03-ai-website-chatbot.json"),
    ("wf04_telegram", "04-telegram-ai-personal-assistant.json"),
    ("wf05_maps_leads", "05-google-maps-lead-finder.json"),
    ("wf06_lead_qualifier", "06-ai-lead-qualifier-instant-reply.json"),
    ("wf07_repurposer", "07-blog-to-social-repurposer.json"),
    ("wf08_blog_writer", "08-ai-seo-blog-writer.json"),
    ("wf09_invoices", "09-invoice-receipt-extractor-gst.json"),
    ("wf10_news_digest", "10-daily-ai-news-digest.json"),
    ("wf_bonus_error_alerts", "BONUS-workflow-error-alerts.json"),
]


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "product", "workflows")
    only = set(sys.argv[2:])
    os.makedirs(out_dir, exist_ok=True)
    for module_name, filename in MODULES:
        if only and module_name not in only:
            continue
        try:
            module = importlib.import_module(f"workflows.{module_name}")
        except ModuleNotFoundError as exc:
            if exc.name and exc.name.endswith(module_name):
                print(f"skip {module_name} (not written yet)")
                continue
            raise
        wf = module.build()
        path = os.path.join(out_dir, filename)
        wf.save(path)
        print(f"wrote {path} ({len(wf.nodes)} nodes)")


if __name__ == "__main__":
    main()
