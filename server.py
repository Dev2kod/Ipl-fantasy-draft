"""
server.py -- zero-dependency web server for the "7-0 World Cup" draft game.

Uses only the Python standard library (http.server + sqlite3) to serve the
built React front-end (web/dist) and the JSON data API, so running the game
requires no `pip install`. Building the front-end itself needs Node once
(see README) -- the built output is plain static files after that, and this
server has zero Python dependencies.

Endpoints:
  GET /                -> web/dist/index.html (the React app)
  GET /<asset>         -> any other file under web/dist (JS/CSS/icons)
  GET /api/data        -> the full dataset from worldcup.db as JSON
  GET /api/health      -> liveness + dataset size, for scripts and smoke tests

Run:  python server.py         (then open http://localhost:8000)
Env:  PORT=9000  HOST=0.0.0.0  python server.py
"""

import gzip
import json
import mimetypes
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "worldcup.db")
WEB_DIST = os.path.realpath(os.path.join(BASE, "web", "dist"))
PORT = int(os.environ.get("PORT", "8000"))
# Bind to loopback by default: this is a single-player local game, so there's
# no reason to expose it to the whole LAN unless the user explicitly opts in.
HOST = os.environ.get("HOST", "127.0.0.1")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

# Worth compressing: text-ish payloads only. Images/fonts are already packed.
COMPRESSIBLE = {".html", ".css", ".js", ".json", ".svg", ".map"}
GZIP_MIN_BYTES = 1024


def load_data():
    """Read the whole dataset from SQLite and shape it for the client."""
    if not os.path.exists(DB_PATH):
        raise SystemExit("worldcup.db not found. Run `python build_db.py` first.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    countries = {
        r["code"]: {"code": r["code"], "name": r["name"], "colour": r["colour"]}
        for r in c.execute("SELECT * FROM countries")
    }
    editions = {
        r["year"]: {
            "host": r["host"], "champion": r["champion"], "runner_up": r["runner_up"],
            "golden_bat": {"player": r["golden_bat_player"], "team": r["golden_bat_team"]} if r["golden_bat_player"] else None,
            "golden_ball": {"player": r["golden_ball_player"], "team": r["golden_ball_team"]} if r["golden_ball_player"] else None,
        }
        for r in c.execute("SELECT * FROM editions")
    }

    # One pass over every player, grouped by squad, instead of a query per
    # squad -- 143 fewer round-trips and it keeps the ORDER BY deterministic.
    players_by_squad = {}
    for p in c.execute("SELECT * FROM players ORDER BY squad_id, overall DESC, name"):
        players_by_squad.setdefault(p["squad_id"], []).append(
            {
                "name": p["name"],
                "role": p["role"],
                "bat": p["bat"],
                "bowl": p["bowl"],
                "overall": p["overall"],
                "captain": bool(p["captain"]),
                "award": p["award"],
                "positions": p["positions"].split(",") if p["positions"] else [],
            }
        )

    squads = []
    for s in c.execute("SELECT * FROM squads ORDER BY edition, country"):
        cty = countries.get(s["country"], {})
        ed = editions.get(s["edition"], {})
        squads.append(
            {
                "id": s["id"],
                "country": s["country"],
                "country_name": s["display_name"] or cty.get("name", s["country"]),
                "colour": cty.get("colour", "#555"),
                "edition": s["edition"],
                "host": ed.get("host", ""),
                "finish": s["finish"],
                "champion": ed.get("champion") == s["country"],
                "runner_up": ed.get("runner_up") == s["country"],
                "players": players_by_squad.get(s["id"], []),
            }
        )
    conn.close()
    return {"countries": countries, "editions": editions, "squads": squads}


class _Dataset:
    """
    The dataset is built once by build_db.py and never changes while the
    server runs, so serialize it a single time at startup and hand out the
    same bytes on every request instead of re-querying SQLite and
    re-encoding ~370 KB of JSON per page load.
    """

    def __init__(self):
        self.raw = b""
        self.gz = b""
        self.n_squads = 0
        self.n_players = 0

    def build(self):
        data = load_data()
        self.raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
        self.gz = gzip.compress(self.raw, 6)
        self.n_squads = len(data["squads"])
        self.n_players = sum(len(s["players"]) for s in data["squads"])
        return self


DATASET = _Dataset()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive; Content-Length is always set
    server_version = "SevenNil"
    sys_version = ""

    def _accepts_gzip(self):
        return "gzip" in self.headers.get("Accept-Encoding", "").lower()

    def _send(self, code, body, ctype="text/plain; charset=utf-8", cache="no-cache", gz=None):
        """Send a response, optionally using a pre-compressed `gz` variant."""
        if isinstance(body, str):
            body = body.encode("utf-8")
        headers = [("Content-Type", ctype), ("Cache-Control", cache)]
        if gz is not None and self._accepts_gzip():
            body = gz
            headers.append(("Content-Encoding", "gzip"))
            headers.append(("Vary", "Accept-Encoding"))
        self.send_response(code)
        for k, v in headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _serve_dist(self, relpath):
        relpath = relpath.lstrip("/")
        full = os.path.realpath(os.path.join(WEB_DIST, relpath))
        # Contain the path inside WEB_DIST. Comparing with a trailing separator
        # matters: a bare startswith would also accept a sibling directory
        # whose name merely begins with "dist".
        if not (full == WEB_DIST or full.startswith(WEB_DIST + os.sep)) or not os.path.isfile(full):
            self._send(404, "Not found")
            return
        ext = os.path.splitext(full)[1].lower()
        ctype = CONTENT_TYPES.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
        # Vite fingerprints everything under /assets/ with a content hash, so
        # those are safe to cache forever; index.html must never be cached or
        # a rebuild would keep serving the old asset references.
        cache = "public, max-age=31536000, immutable" if relpath.startswith("assets/") else "no-cache"
        with open(full, "rb") as f:
            body = f.read()
        gz = None
        if ext in COMPRESSIBLE and len(body) >= GZIP_MIN_BYTES and self._accepts_gzip():
            gz = gzip.compress(body, 6)
        self._send(200, body, ctype, cache=cache, gz=gz)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/data":
            try:
                if not DATASET.raw:
                    DATASET.build()
                self._send(
                    200, DATASET.raw, "application/json; charset=utf-8",
                    cache="no-cache", gz=DATASET.gz,
                )
            except Exception as e:  # pragma: no cover
                self._send(500, json.dumps({"error": str(e)}), "application/json")
            return
        if path == "/api/health":
            body = json.dumps({
                "ok": True, "squads": DATASET.n_squads, "players": DATASET.n_players,
            })
            self._send(200, body, "application/json; charset=utf-8")
            return
        if path in ("/", ""):
            self._serve_dist("index.html")
            return
        self._serve_dist(path)

    do_HEAD = do_GET

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main():
    if not os.path.exists(DB_PATH):
        print("worldcup.db not found -- building it now...")
        import build_db
        build_db.build()
    if not os.path.isdir(WEB_DIST) or not os.path.isfile(os.path.join(WEB_DIST, "index.html")):
        raise SystemExit(
            "web/dist not found. Build the React front-end first:\n"
            "    cd web && npm install && npm run build"
        )

    DATASET.build()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    shown_host = "localhost" if HOST in ("127.0.0.1", "0.0.0.0") else HOST
    print("=" * 52)
    print("  7-0 World Cup  --  Draft your all-time XI")
    print(f"  Serving at  http://{shown_host}:{PORT}")
    print(f"  Dataset     {DATASET.n_squads} squads / {DATASET.n_players} players"
          f"  ({len(DATASET.raw) // 1024} KB, {len(DATASET.gz) // 1024} KB gzipped)")
    print("  Press Ctrl+C to stop.")
    print("=" * 52)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
