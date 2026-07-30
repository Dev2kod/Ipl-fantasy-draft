"""
fetch_data.py -- OPTIONAL web enrichment for the 7-0 IPL dataset.

The game ships with a curated, hand-verified dataset in build_db.py. This script
lets you EXTEND it with more team-seasons pulled from the web, so the draft pool
keeps growing. It uses only the Python standard library (urllib), so no installs.

It fetches an IPL season squad page and prints a Python squad stub you can paste
into build_db.py's SQUADS list (ratings are seeded from a simple heuristic and are
meant to be tuned by hand). Wikipedia is used as a stable, license-friendly source.

Usage:
    python fetch_data.py "Chennai Super Kings in 2021" CSK 2021

Notes:
  * This is a scaffold: web pages change, so it extracts candidate player names
    and leaves ratings for you to refine. It NEVER overwrites ipl.db directly —
    you stay in control of what enters the dataset.
  * If you have no internet, just keep using the built-in dataset.
"""

import re
import sys
import urllib.request
import urllib.parse

UA = {"User-Agent": "Mozilla/5.0 (7-0-IPL data tool)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def wiki_search(title):
    """Resolve a page title via the MediaWiki search API."""
    api = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": title,
        "format": "json", "srlimit": 1,
    })
    import json
    data = json.loads(fetch(api))
    hits = data.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def extract_players(page_title):
    """Pull plausible player names from the plain-text extract of a page."""
    import json
    api = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "prop": "extracts", "explaintext": 1,
        "titles": page_title, "format": "json",
    })
    data = json.loads(fetch(api))
    pages = data.get("query", {}).get("pages", {})
    text = ""
    for _, p in pages.items():
        text = p.get("extract", "")
    # crude name heuristic: "Firstname Lastname" title-case pairs
    names = re.findall(r"\b([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?)\b", text)
    stop = {"Indian Premier", "Super Kings", "Knight Riders", "Super Giants",
            "Premier League", "Man Match", "Player Match"}
    seen, out = set(), []
    for n in names:
        if n in stop or n in seen or len(n) < 6:
            continue
        seen.add(n); out.append(n)
    return out[:25]


def guess_role(name):
    return ("BAT", "Top order", 78, 20, 78)  # neutral default; tune by hand


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        print('Example: python fetch_data.py "Gujarat Titans cricket team 2022 season" GT 2022')
        return
    query, code, year = sys.argv[1], sys.argv[2], sys.argv[3]
    print(f"# Searching Wikipedia for: {query!r}")
    title = wiki_search(query)
    if not title:
        print("# No page found. Try a more specific query.")
        return
    print(f"# Resolved page: {title!r}")
    names = extract_players(title)
    if not names:
        print("# No player names extracted — refine the query or add players by hand.")
        return
    print(f'\n# Paste into SQUADS in build_db.py, then TUNE ratings/roles by hand:\n')
    print(f'    ("{code}", {year}, [')
    for n in names:
        role, sub, bat, bowl, ovr = guess_role(n)
        print(f'        P("{n}", "{role}", "{sub}", {bat}, {bowl}, {ovr}),')
    print("    ]),")
    print("\n# Reminder: ratings above are placeholders. Edit them, then run `python build_db.py`.")


if __name__ == "__main__":
    main()
