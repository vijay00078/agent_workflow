"""Writes the Google Sheets CSV templates of the pack (product/google-sheets-templates)
and checks that their columns match exactly what the workflows write.

Usage: python3 build/build_templates.py
"""
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
WF_DIR = os.path.join(ROOT, "product", "workflows")
OUT = os.path.join(ROOT, "product", "google-sheets-templates")

# Column order is chosen for humans; the workflows match columns by name.
TEMPLATES = {
    "Leads.csv": {
        "columns": [
            "Business Name", "Lead Score", "Why this score", "Email", "Phone", "Website", "AI Opener", "Email subject",
            "Personalization hook", "Best channel", "Signals", "Category", "Rating", "Reviews", "Address", "Google Maps",
            "Instagram", "Facebook", "LinkedIn", "Other Emails", "Search", "Found on", "Place ID",
        ],
    },
    "Leads CRM.csv": {
        "columns": [
            "Received", "Tier", "Score", "Name", "Company", "Email", "Phone", "Website", "Budget", "Timeline", "Message",
            "Summary", "Next step", "Red flags", "Auto-reply sent", "Source",
        ],
    },
    "Content Calendar.csv": {
        "columns": ["Scheduled for", "Status", "Platform", "Content", "Source title", "Source URL", "Created"],
    },
    "Blog Topics.csv": {
        "columns": [
            "Topic", "Primary Keyword", "Audience", "Notes", "Word Count", "Status",
            "Title", "Doc URL", "Meta Description", "Slug", "Words", "Written On",
        ],
        "rows": [
            ["How small businesses can use AI chatbots to answer customers 24/7", "ai chatbot for small business",
             "Owners of local service businesses", "Include a simple cost vs. time-saved example and 3 common mistakes.", "1500", "Ready"],
            ["10 simple automations that save a small business 10 hours a week", "small business automation ideas",
             "Busy small-business owners who are not technical", "Practical, no jargon. One short example per automation.", "1800", "Ready"],
            ["Email marketing for beginners: a step-by-step guide", "email marketing for beginners",
             "Solo founders and freelancers", "Change the Status to Ready when you want this one written.", "1200", "Idea"],
        ],
    },
    "Invoices.csv": {
        "columns": [
            "Processed At", "File", "Source", "Doc Type", "Purchase / Sales", "Vendor", "Vendor GSTIN", "GSTIN Check",
            "Vendor State", "Buyer", "Buyer GSTIN", "Invoice No", "Invoice Date", "Due Date", "Place of Supply",
            "Supply Type", "Currency", "Taxable Value", "CGST", "SGST", "IGST", "Cess", "Other Tax / VAT", "Total Tax",
            "Total Amount", "Category", "Payment Method", "HSN / SAC", "Line Items", "Checks", "Confidence", "File Link",
            "Notes",
        ],
    },
    "Line Items.csv": {
        "columns": ["Invoice No", "Vendor", "Invoice Date", "Description", "HSN / SAC", "Quantity", "Unit Price", "Tax Rate %", "Amount"],
    },
    "Chatbot Leads.csv": {
        "columns": ["Date", "Name", "Email", "Phone", "Interested in", "Conversation summary", "Source"],
    },
}


def load(name):
    with open(os.path.join(WF_DIR, name), encoding="utf-8") as f:
        return {n["name"]: n for n in json.load(f)["nodes"]}


def set_fields(node):
    return [a["name"] for a in node["parameters"]["assignments"]["assignments"]]


def js_object_keys(code, start_marker, end_marker):
    block = code.split(start_marker, 1)[1].split(end_marker, 1)[0]
    return [m.group(2) for m in re.finditer(r"^\s*(['\"]?)([^'\":\n]+?)\1:\s", block, flags=re.M)]


def written_columns():
    """Columns each template must have, taken from the generated workflow files."""
    wf03, wf05, wf06 = load("03-ai-website-chatbot.json"), load("05-google-maps-lead-finder.json"), load("06-ai-lead-qualifier-instant-reply.json")
    wf07, wf08, wf09 = load("07-blog-to-social-repurposer.json"), load("08-ai-seo-blog-writer.json"), load("09-invoice-receipt-extractor-gst.json")
    calendar = wf07["Calendar Rows"]["parameters"]["jsCode"]
    enrich = wf09["Check & Enrich (GST)"]["parameters"]["jsCode"]
    blog_read = [v["lookupColumn"] for v in wf08["Get Ready Topics"]["parameters"]["filtersUI"]["values"]]
    return {
        "Leads.csv": set_fields(wf05["Format Row"]),
        "Leads CRM.csv": set_fields(wf06["CRM Row"]),
        "Content Calendar.csv": js_object_keys(calendar, "json: {", "},"),
        # read by the prompts + written back by Done Row / Error Row (row_number is n8n's own row pointer)
        "Blog Topics.csv": ["Topic", "Primary Keyword", "Audience", "Notes", "Word Count"] + blog_read
        + [c for c in set_fields(wf08["Done Row"]) + set_fields(wf08["Error Row"]) if c != "row_number"],
        "Invoices.csv": js_object_keys(enrich, "row: {", "},\n    line_items"),
        "Line Items.csv": js_object_keys(enrich, "line_items: lineItems.map((l) => ({", "}))"),
        "Chatbot Leads.csv": list(wf03["Save Lead (Google Sheets)"]["parameters"]["columns"]["value"].keys()),
    }


def main():
    expected = written_columns()
    problems = []
    os.makedirs(OUT, exist_ok=True)
    for name, spec in TEMPLATES.items():
        cols = spec["columns"]
        want = set(expected[name])
        if set(cols) != want or len(cols) != len(set(cols)):
            problems.append(f"{name}: missing {sorted(want - set(cols))}, extra {sorted(set(cols) - want)}")
        with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(cols)
            for row in spec.get("rows", []):
                writer.writerow(row + [""] * (len(cols) - len(row)))
        print(f"wrote {name} ({len(cols)} columns, {len(spec.get('rows', []))} example rows)")
    if problems:
        print("\n".join("❌ " + p for p in problems))
        sys.exit(1)
    print("✅ template columns match the workflows")


if __name__ == "__main__":
    main()
