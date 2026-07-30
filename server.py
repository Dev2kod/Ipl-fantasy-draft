"""
server.py -- zero-dependency web server for the "7-0 IPL" draft game.

Uses only the Python standard library (http.server + sqlite3) to serve the
built React front-end (web/dist) and the JSON data API, so running the game
requires no `pip install`. Building the front-end itself needs Node once
(see web/README or the project README) -- the built output is plain static
files after that, and this server has zero Python dependencies.

Endpoints:
  GET /                -> web/dist/index.html (the React app)
  GET /<asset>         -> any other file under web/dist (JS/CSS/icons)
  GET /api/data        -> the full dataset from ipl.db as JSON

Run:  python server.py         (then open http://localhost:8000)
"""

import json
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "ipl.db")
WEB_DIST = os.path.join(BASE, "web", "dist")
PORT = int(os.environ.get("PORT", "8000"))

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


def load_data():
    """Read the whole dataset from SQLite and shape it for the client."""
    if not os.path.exists(DB_PATH):
        raise SystemExit("ipl.db not found. Run `python build_db.py` first.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    franchises = {
        r["code"]: {"code": r["code"], "name": r["name"], "colour": r["colour"]}
        for r in c.execute("SELECT * FROM franchises")
    }
    seasons = {
        r["year"]: {
            "champion": r["champion"], "runner_up": r["runner_up"],
            "orange_cap": {"player": r["orange_cap_player"], "team": r["orange_cap_team"]} if r["orange_cap_player"] else None,
            "purple_cap": {"player": r["purple_cap_player"], "team": r["purple_cap_team"]} if r["purple_cap_player"] else None,
        }
        for r in c.execute("SELECT * FROM seasons")
    }

    squads = []
    # materialize squad rows first: reusing one cursor for the inner players
    # query would otherwise clobber this outer iteration.
    squad_rows = c.execute("SELECT * FROM squads ORDER BY season, franchise").fetchall()
    pcur = conn.cursor()
    pcur.row_factory = sqlite3.Row
    for s in squad_rows:
        players = [
            {
                "name": p["name"],
                "role": p["role"],
                "sub_role": p["sub_role"],
                "bat": p["bat"],
                "bowl": p["bowl"],
                "overall": p["overall"],
                "overseas": bool(p["overseas"]),
                "captain": bool(p["captain"]),
                "cap": p["cap"],
                "positions": p["positions"].split(",") if p["positions"] else [],
                "price": p["price"],
            }
            for p in pcur.execute(
                "SELECT * FROM players WHERE squad_id=? ORDER BY overall DESC", (s["id"],)
            ).fetchall()
        ]
        fr = franchises.get(s["franchise"], {})
        skeys = s.keys()
        squads.append(
            {
                "id": s["id"],
                "franchise": s["franchise"],
                "franchise_name": (s["display_name"] if "display_name" in skeys and s["display_name"] else fr.get("name", s["franchise"])),
                "colour": fr.get("colour", "#555"),
                "season": s["season"],
                "finish": s["finish"] if "finish" in skeys else None,
                "champion": seasons.get(s["season"], {}).get("champion") == s["franchise"],
                "runner_up": seasons.get(s["season"], {}).get("runner_up") == s["franchise"],
                "players": players,
            }
        )
    conn.close()
    return {"franchises": franchises, "seasons": seasons, "squads": squads}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="text/plain; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _serve_dist(self, relpath):
        # prevent path traversal
        relpath = relpath.lstrip("/")
        full = os.path.normpath(os.path.join(WEB_DIST, relpath))
        if not full.startswith(WEB_DIST) or not os.path.isfile(full):
            self._send(404, "Not found")
            return
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            self._send(200, f.read(), CONTENT_TYPES.get(ext, "application/octet-stream"))

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/data":
            try:
                self._send(200, json.dumps(load_data()), "application/json; charset=utf-8")
            except Exception as e:  # pragma: no cover
                self._send(500, json.dumps({"error": str(e)}), "application/json")
            return
        if path == "/" or path == "":
            self._serve_dist("index.html")
            return
        self._serve_dist(path)

    do_HEAD = do_GET

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main():
    # fail fast with a helpful message if DB missing
    if not os.path.exists(DB_PATH):
        print("ipl.db not found -- building it now...")
        import build_db
        build_db.build()
    if not os.path.isdir(WEB_DIST) or not os.path.isfile(os.path.join(WEB_DIST, "index.html")):
        raise SystemExit(
            "web/dist not found. Build the React front-end first:\n"
            "    cd web && npm install && npm run build"
        )
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print("=" * 52)
    print("  7-0 IPL  --  World Cup-style draft, IPL edition")
    print(f"  Serving at  {url}")
    print("  Press Ctrl+C to stop.")
    print("=" * 52)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
