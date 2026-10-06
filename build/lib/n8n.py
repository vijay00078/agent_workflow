"""Tiny builder for n8n workflow JSON.

Every workflow in the pack is generated from Python so node IDs stay stable,
connections are always valid and shared conventions (Config node, sticky notes,
OpenAI model settings) stay consistent across all workflows.
"""
import json
import math
import os
import uuid

NAMESPACE = uuid.UUID("6f1e7c3a-2b4d-4e8f-9a0b-1c2d3e4f5a6b")
CODE_DIR = os.path.join(os.path.dirname(__file__), "..", "code")

# Sticky note colours in the n8n editor
YELLOW, ORANGE, RED, GREEN, BLUE, PURPLE, GRAY = 1, 2, 3, 4, 5, 6, 7

DEFAULT_MODEL = "gpt-4.1-mini"

# Rendered node sizes in the n8n 2.x canvas (zoom 1), measured in the editor
WIDE_ROOTS = {
    "@n8n/n8n-nodes-langchain.agent", "@n8n/n8n-nodes-langchain.chainLlm",
    "@n8n/n8n-nodes-langchain.chatTrigger", "@n8n/n8n-nodes-langchain.vectorStoreInMemory",
}
WIDE_SUBS = {"@n8n/n8n-nodes-langchain.documentDefaultDataLoader"}
STICKY_HEIGHTS_FILE = os.path.join(os.path.dirname(__file__), "..", "sticky-heights.json")


def node_box(node):
    """(x1, y1, x2, y2) of a node incl. its label, in canvas units."""
    t = node["type"]
    x, y = node["position"]
    is_sub = t.startswith("@n8n/n8n-nodes-langchain.") and t.split(".")[-1].startswith(
        ("lmChat", "memory", "tool", "outputParser", "embeddings", "textSplitter", "documentDefault")) or t.endswith("Tool")
    if t == "@n8n/n8n-nodes-langchain.vectorStoreInMemory" and node["parameters"].get("mode") == "retrieve-as-tool":
        return (x, y, x + 240, y + 80 + 55)
    if t in WIDE_SUBS:
        return (x, y, x + 240, y + 80 + 55)
    if t in WIDE_ROOTS:
        return (x, y, x + 224, y + 100 + 45)
    if is_sub:
        return (x, y, x + 80, y + 80 + 55)
    return (x, y, x + 100, y + 100 + 55)


def code(path):
    """Load JavaScript for a Code node from build/code/<path>.

    Lines like `// @include shared/url.js` are replaced by that file's content
    (n8n Code nodes cannot import modules, so helpers are inlined)."""
    with open(os.path.join(CODE_DIR, path), encoding="utf-8") as fh:
        src = fh.read()
    out = []
    for line in src.splitlines():
        if line.strip().startswith("// @include "):
            inc = line.strip()[len("// @include "):].strip()
            with open(os.path.join(CODE_DIR, inc), encoding="utf-8") as inc_fh:
                out.append(inc_fh.read().rstrip())
        else:
            out.append(line)
    return "\n".join(out).strip() + "\n"


class Workflow:
    def __init__(self, name, slug, tags=None):
        self.name = name
        self.slug = slug
        self.nodes = []
        self.connections = {}
        self.pin_data = {}
        self._names = set()
        self._sticky_count = 0

    # ------------------------------------------------------------------ ids
    def uid(self, key):
        return str(uuid.uuid5(NAMESPACE, f"{self.slug}:{key}"))

    # ---------------------------------------------------------------- nodes
    def add(self, name, node_type, version, params=None, pos=(0, 0), **extra):
        if name in self._names:
            raise ValueError(f"duplicate node name {name!r} in {self.slug}")
        self._names.add(name)
        node = {
            "parameters": params or {},
            "id": self.uid(name),
            "name": name,
            "type": node_type,
            "typeVersion": version,
            "position": [int(pos[0]), int(pos[1])],
        }
        if extra.pop("webhook", False):
            node["webhookId"] = self.uid(name + ":webhook")
        node.update(extra)
        self.nodes.append(node)
        return name

    def sticky(self, content, pos, width, height=None, color=YELLOW, name=None):
        """A sticky note. height=None -> sized to its text (measured in the editor)."""
        self._sticky_count += 1
        name = name or f"Sticky Note {self._sticky_count}"
        self._pending_heights = getattr(self, "_pending_heights", {})
        if height is None:
            self._pending_heights[name] = width
            height = 200
        return self.add(
            name,
            "n8n-nodes-base.stickyNote",
            1,
            {"content": content.strip(), "height": height, "width": width, "color": color},
            pos,
        )

    def section(self, content, nodes, color, pad=40, header=None):
        """A coloured sticky drawn behind `nodes` (resolved at export time)."""
        self._sections = getattr(self, "_sections", [])
        name = self.sticky(content, (0, 0), 400, 200, color)
        self._sections.append((name, list(nodes), pad, header))
        return name

    @staticmethod
    def _text_height(content, width):
        """Approximate rendered height of sticky markdown (measured: ### = 29px, text line = 19px)."""
        h = 0
        for line in content.split("\n"):
            if line.startswith("### "):
                h += 29
            elif line.startswith("## "):
                h += 34
            else:
                cpl = max(20, (width - 32) / 7.0)
                h += 19 * max(1, math.ceil(len(line) / cpl))
        return h + 16

    def _resolve_layout(self):
        by_name = {n["name"]: n for n in self.nodes}
        for name, members, pad, header in getattr(self, "_sections", []):
            boxes = [node_box(by_name[m]) for m in members]
            x1 = min(b[0] for b in boxes) - pad
            y1 = min(b[1] for b in boxes)
            x2 = max(b[2] for b in boxes) + pad
            y2 = max(b[3] for b in boxes) + 20
            content = by_name[name]["parameters"]["content"]
            head = header if header is not None else self._text_height(content, x2 - x1)
            sticky = by_name[name]
            sticky["position"] = [int(x1), int(y1 - head - 20)]
            sticky["parameters"]["width"] = int(x2 - x1)
            sticky["parameters"]["height"] = int(y2 - y1 + head + 20)
        measured = {}
        if os.path.exists(STICKY_HEIGHTS_FILE):
            with open(STICKY_HEIGHTS_FILE, encoding="utf-8") as fh:
                measured = json.load(fh).get(self.name, {})
        for name, width in getattr(self, "_pending_heights", {}).items():
            node = by_name[name]
            content_h = measured.get(name)
            if content_h is None:  # rough estimate until measured
                text = node["parameters"]["content"]
                chars_per_line = max(30, width / 7.2)
                content_h = sum(max(1, -(-len(line) // chars_per_line)) * 17 for line in text.split("\n")) + 30
            node["parameters"]["height"] = int(content_h + 46)

    def place(self, positions):
        """Set final canvas positions by node name: {"Node": (x, y)}."""
        by_name = {n["name"]: n for n in self.nodes}
        for name, (x, y) in positions.items():
            if name not in by_name:
                raise ValueError(f"place(): unknown node {name!r} in {self.slug}")
            by_name[name]["position"] = [int(x), int(y)]

    # ---------------------------------------------------------- connections
    def connect(self, src, dst, out=0, inp=0, kind="main"):
        for n in (src, dst):
            if n not in self._names:
                raise ValueError(f"unknown node {n!r} in {self.slug}")
        outputs = self.connections.setdefault(src, {}).setdefault(kind, [])
        while len(outputs) <= out:
            outputs.append([])
        outputs[out].append({"node": dst, "type": kind, "index": inp})

    def chain(self, *names):
        for a, b in zip(names, names[1:]):
            self.connect(a, b)

    def ai(self, sub, root, kind):
        """Connect an AI sub-node (model, memory, tool, parser...) to a root node."""
        self.connect(sub, root, kind=kind)

    # --------------------------------------------------------------- export
    def to_dict(self):
        self._resolve_layout()
        return {
            "name": self.name,
            "nodes": self.nodes,
            "connections": self.connections,
            "pinData": self.pin_data,
            "settings": {"executionOrder": "v1"},
            "meta": {"templateCredsSetupCompleted": False},
            "active": False,
        }

    def save(self, path):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=2, ensure_ascii=False)
            fh.write("\n")


# ============================================================ node helpers

def rl(value, mode="list", cached=None):
    """Resource locator value."""
    out = {"__rl": True, "value": value, "mode": mode}
    if cached:
        out["cachedResultName"] = cached
    return out


def assignment(wf, name, value, typ="string"):
    return {"id": wf.uid("assign:" + name + ":" + str(value)[:40]), "name": name, "value": value, "type": typ}


def set_fields(wf, fields, include_other=True):
    """Params for an Edit Fields (Set) v3.4 node. fields = [(name, value, type)]"""
    params = {
        "assignments": {
            "assignments": [assignment(wf, n, v, t) for n, v, t in fields]
        },
        "options": {},
    }
    if include_other:
        params["includeOtherFields"] = True
    return params


def condition(wf, key, left, op_type, operation, right=None):
    c = {
        "id": wf.uid("cond:" + key),
        "leftValue": left,
        "rightValue": "" if right is None else right,
        "operator": {"type": op_type, "operation": operation},
    }
    if operation in ("empty", "notEmpty", "true", "false", "exists", "notExists"):
        c["operator"]["singleValue"] = True
    return c


def conditions(conds, combinator="and"):
    return {
        "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "loose", "version": 2},
        "conditions": conds,
        "combinator": combinator,
    }


def if_params(conds, combinator="and"):
    return {"conditions": conditions(conds, combinator), "looseTypeValidation": True, "options": {"ignoreCase": True}}


def switch_rule(wf, key, label, conds, combinator="and"):
    return {"conditions": conditions(conds, combinator), "renameOutput": True, "outputKey": label}


def openai_model(wf, name, pos, model=DEFAULT_MODEL, temperature=None, json_mode=False, max_tokens=None, timeout=None):
    options = {}
    if temperature is not None:
        options["temperature"] = temperature
    if json_mode:
        options["responseFormat"] = "json_object"
    if max_tokens:
        options["maxTokens"] = max_tokens
    if timeout:
        options["timeout"] = timeout
    return wf.add(
        name,
        "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        1.2,
        {"model": rl(model, "list", model), "options": options},
        pos,
    )


def structured_parser(wf, name, pos, schema):
    return wf.add(
        name,
        "@n8n/n8n-nodes-langchain.outputParserStructured",
        1.3,
        {"schemaType": "manual", "inputSchema": json.dumps(schema, indent=2, ensure_ascii=False)},
        pos,
    )


def llm_chain(wf, name, pos, prompt, system, has_parser=False, batch_size=None, per_item_errors=False, **extra):
    """Basic LLM Chain v1.7. per_item_errors=True keeps a batch going when one item fails
    (the failed item gets an `error` field instead of stopping the whole run)."""
    params = {
        "promptType": "define",
        "text": prompt,
        "messages": {"messageValues": [{"message": system}]},
    }
    if has_parser:
        params["hasOutputParser"] = True
    if batch_size:
        params["batching"] = {"batchSize": batch_size}
    if per_item_errors:
        extra.setdefault("onError", "continueRegularOutput")
    else:
        extra.setdefault("retryOnFail", True)
        extra.setdefault("maxTries", 3)
        extra.setdefault("waitBetweenTries", 3000)
    return wf.add(name, "@n8n/n8n-nodes-langchain.chainLlm", 1.7, params, pos, **extra)


def agent(wf, name, pos, prompt, system, max_iterations=10, **extra):
    params = {
        "promptType": "define",
        "text": prompt,
        "options": {"systemMessage": system, "maxIterations": max_iterations},
    }
    extra.setdefault("retryOnFail", True)
    extra.setdefault("maxTries", 2)
    extra.setdefault("waitBetweenTries", 3000)
    return wf.add(name, "@n8n/n8n-nodes-langchain.agent", 2, params, pos, **extra)


def code_node(wf, name, pos, js, each_item=False, **extra):
    params = {"jsCode": js}
    if each_item:
        params["mode"] = "runOnceForEachItem"
    return wf.add(name, "n8n-nodes-base.code", 2, params, pos, **extra)


def http_node(wf, name, pos, params, **extra):
    """HTTP Request v4.2 node."""
    params.setdefault("options", {})
    return wf.add(name, "n8n-nodes-base.httpRequest", 4.2, params, pos, **extra)


def sheet_doc(expr):
    return rl(expr, "url")


def sheet_tab(expr):
    return rl(expr, "name")
