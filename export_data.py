"""
export_data.py -- dumps the dataset as a static JSON file for platforms that
can't run the Python server (e.g. Vercel static hosting).

The live `server.py` deployment (local, Render, a VPS) always serves the
freshest data straight from SQLite via /api/data. This script exists purely
so a pure-static deploy has something to fetch instead: it reuses the same
`load_data()` the live server uses, so the two paths can never drift apart,
and writes the result to web/public/data.json, which Vite then copies
into the build output as a plain static asset.

Run:  python export_data.py   (after `python build_db.py`, or it builds it
for you)
"""

import json
import os

import build_db
import server

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(BASE, "web", "public", "data.json")


def export():
    if not os.path.exists(server.DB_PATH):
        build_db.build()
    data = server.load_data()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    size_kb = os.path.getsize(OUT_PATH) // 1024
    print(f"Wrote {OUT_PATH} ({size_kb} KB)")


if __name__ == "__main__":
    export()
