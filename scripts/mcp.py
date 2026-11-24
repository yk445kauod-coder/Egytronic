"""Minimal MCP client — the same handshake any agent does, from the shell.

    export EGYTRONIC_AGENT_KEY=egx_agent_...
    python3 scripts/mcp.py tools
    python3 scripts/mcp.py call overview
    python3 scripts/mcp.py call create_task --json '{"title": "رد على العميل", "priority": 1}'
"""
import json, os, sys, urllib.request

URL = os.environ.get("EGYTRONIC_MCP", "https://egytronic.pages.dev/mcp")
KEY = os.environ.get("EGYTRONIC_AGENT_KEY", "")


def _post(payload):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), method="POST")
    req.add_header("content-type", "application/json")
    req.add_header("accept", "application/json, text/event-stream")
    req.add_header("user-agent", "egytronic-mcp/1.0")
    if KEY:
        req.add_header("Authorization", f"Bearer {KEY}")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def call(method, params=None, ident=1):
    body = _post({"jsonrpc": "2.0", "id": ident, "method": method, "params": params or {}})
    if "error" in body:
        raise SystemExit(f"error {body['error'].get('code')}: {body['error'].get('message')}")
    return body["result"]


def tool(name, arguments=None):
    result = call("tools/call", {"name": name, "arguments": arguments or {}})
    text = (result.get("content") or [{}])[0].get("text", "")
    if result.get("isError"):
        raise SystemExit(f"{name} failed: {text}")
    return json.loads(text) if text else {}


def main(argv):
    if not KEY:
        raise SystemExit("set EGYTRONIC_AGENT_KEY first (console → الوكلاء → إنشاء مفتاح)")
    if not argv or argv[0] == "tools":
        out = call("tools/list")
        print("\n".join(f"{t['name']:<18} {t['description']}" for t in out["tools"]))
        return
    if argv[0] == "call":
        args = json.loads(argv[2]) if len(argv) > 2 and argv[1] == "--json" else {}
        if len(argv) > 2 and argv[1] != "--json":
            args = json.loads(argv[2])
        print(json.dumps(tool(argv[1], args), ensure_ascii=False, indent=2))
        return
    raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
