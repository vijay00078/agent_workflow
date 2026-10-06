"""Checks the canvas layout of every generated workflow:
- nodes overlapping other nodes
- sticky notes overlapping each other
- nodes that stick into a sticky note they are not part of
Usage: python3 build/check_layout.py
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib.n8n import node_box  # noqa: E402


def overlap(a, b, margin=0):
    return not (a[2] + margin <= b[0] or b[2] + margin <= a[0] or a[3] + margin <= b[1] or b[3] + margin <= a[1])


def main():
    problems = 0
    for path in sorted(glob.glob(os.path.join(HERE, "..", "product", "workflows", "*.json"))):
        wf = json.load(open(path, encoding="utf-8"))
        nodes = [n for n in wf["nodes"] if n["type"] != "n8n-nodes-base.stickyNote"]
        stickies = [n for n in wf["nodes"] if n["type"] == "n8n-nodes-base.stickyNote"]
        sbox = {s["name"]: (s["position"][0], s["position"][1], s["position"][0] + s["parameters"]["width"], s["position"][1] + s["parameters"]["height"]) for s in stickies}
        issues = []
        for i, a in enumerate(nodes):
            for b in nodes[i + 1:]:
                if overlap(node_box(a), node_box(b), margin=10):
                    issues.append(f"nodes overlap: {a['name']} <> {b['name']}")
        names = list(sbox)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                if overlap(sbox[a], sbox[b], margin=10):
                    issues.append(f"stickies overlap: {a} <> {b} {sbox[a]} {sbox[b]}")
        # node partially inside a sticky (fully-inside means it belongs there)
        for n in nodes:
            nb = node_box(n)
            for sname, sb in sbox.items():
                inside = sb[0] <= nb[0] and sb[1] <= nb[1] and nb[2] <= sb[2] and nb[3] <= sb[3]
                if overlap(nb, sb) and not inside:
                    issues.append(f"node '{n['name']}' crosses the edge of {sname}")
        print(f"{os.path.basename(path)}: {'OK' if not issues else str(len(issues)) + ' layout issues'}")
        for line in issues:
            print("   - " + line)
        problems += len(issues)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
