"""
build_db.py -- Builds ipl.db (SQLite) for the "7-0 IPL" draft game.

Data source: the JSON files in ./data/ (one per season, ipl_YYYY.json), gathered
from the web (Wikipedia / ESPNcricinfo). Each file lists every team that played
that season, their final finishing position, and their players tagged with a role
and an impact tier.

Player RATINGS are computed here, and -- as requested -- depend heavily on where
the player's team FINISHED that season: a title-winning side's players rate far
higher than a wooden-spoon side's. Tier (star/key/role/squad) and role then shape
the batting/bowling split.

Run:  python build_db.py
"""

import glob
import hashlib
import json
import os
import sqlite3

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "ipl.db")
DATA_DIR = os.path.join(BASE, "data")

# Franchise metadata: code -> primary colour. Names are era-aware (see below).
FRANCHISE_COLOUR = {
    "CSK": "#f9cd05", "MI": "#004ba0", "RCB": "#d1171b", "KKR": "#3a225d",
    "RR": "#e21f9e", "SRH": "#f7a721", "DC": "#17449b", "PBKS": "#dd1f2d",
    "GT": "#1b2133", "LSG": "#0a4b8b", "DCH": "#5a3b8a", "GL": "#e04e2a",
    "RPS": "#d11450", "PWI": "#3aaee0", "KTK": "#f26522",
}

# Modern / canonical names.
FRANCHISE_NAME = {
    "CSK": "Chennai Super Kings", "MI": "Mumbai Indians",
    "RCB": "Royal Challengers Bengaluru", "KKR": "Kolkata Knight Riders",
    "RR": "Rajasthan Royals", "SRH": "Sunrisers Hyderabad",
    "DC": "Delhi Capitals", "PBKS": "Punjab Kings", "GT": "Gujarat Titans",
    "LSG": "Lucknow Super Giants", "DCH": "Deccan Chargers",
    "GL": "Gujarat Lions", "RPS": "Rising Pune Supergiants",
    "PWI": "Pune Warriors India", "KTK": "Kochi Tuskers Kerala",
}


def era_name(code, season):
    """Return the name the franchise actually used that season."""
    if code == "DC":
        return "Delhi Daredevils" if season <= 2018 else "Delhi Capitals"
    if code == "PBKS":
        return "Kings XI Punjab" if season <= 2020 else "Punjab Kings"
    if code == "RCB":
        return "Royal Challengers Bangalore" if season <= 2023 else "Royal Challengers Bengaluru"
    return FRANCHISE_NAME.get(code, code)


# ---------------------------------------------------------------- rating model
TIER_ADJ = {"star": 11, "key": 5, "role": -1, "squad": -8}


def _jitter(name, season, lo, hi):
    """Deterministic small variation so players don't all tie (no randomness)."""
    h = hashlib.md5(f"{name}|{season}".encode()).hexdigest()
    span = hi - lo + 1
    return lo + (int(h[:6], 16) % span)


def rate_player(p, finish, n_teams, season):
    """Compute (overall, bat, bowl) from team finish + tier + role."""
    # position factor: 1.0 for champions, 0.0 for last place
    pos = (n_teams - finish) / max(1, (n_teams - 1))
    team_base = 66 + 16 * pos                       # champ ~82, last ~66
    tier = TIER_ADJ.get(p.get("tier", "role"), -1)
    var = _jitter(p["name"], season, -3, 3)
    overall = int(round(team_base + tier + var))
    overall = max(56, min(99, overall))

    role = p["role"]
    if role == "WK":
        bat, bowl = overall, 5
    elif role == "BAT":
        bat = overall
        bowl = _jitter(p["name"], season + 1, 8, 30)
    elif role == "BOWL":
        bowl = overall
        bat = _jitter(p["name"], season + 2, 12, 40)
    else:  # ALL
        bat = max(50, overall - _jitter(p["name"], season, 2, 6))
        bowl = max(56, overall - _jitter(p["name"], season + 1, 1, 5))

    # Orange/Purple Cap winners get a special boost: they were THE standout
    # performer of that entire season, so they should rate above their peers
    # even within a champion squad.
    cap = p.get("cap")
    if cap == "orange":
        bat = min(99, bat + 10)
        overall = min(99, overall + 8)
    elif cap == "purple":
        bowl = min(99, bowl + 10)
        overall = min(99, overall + 8)

    return overall, int(bat), int(bowl)


# --------------------------------------------------------------- position tags
# A defensible, deterministic reading of "what job would this player realistically
# do in the XI" -- derived from role + rating, not literal historical ball-by-ball
# batting-position data (which isn't available at this scale). Multiple tags are
# allowed per player, matching how real all-rounders and flexible batters work.
BAT_POSITIONS = ["Opener", "Top-order", "Middle-order", "Finisher"]
BOWL_POSITIONS = ["Powerplay Bowler", "Middle-overs Bowler", "Death Bowler"]


def _hash_int(name, season, salt):
    h = hashlib.md5(f"{name}|{season}|{salt}".encode()).hexdigest()
    return int(h[:8], 16)


def _hash_pick(name, season, salt, options):
    return options[_hash_int(name, season, salt) % len(options)]


def _hash_chance(name, season, salt, prob):
    return (_hash_int(name, season, salt) % 1000) / 1000.0 < prob


def assign_positions(name, season, role, bat, bowl):
    if role == "WK":
        primary = _hash_pick(name, season, "wkbat", ["Opener", "Top-order", "Middle-order"])
        return ["Wicketkeeper", primary]

    if role == "BAT":
        primary = _hash_pick(name, season, "batpos", BAT_POSITIONS)
        tags = [primary]
        if _hash_chance(name, season, "batpos2", 0.35):
            idx = BAT_POSITIONS.index(primary)
            step = -1 if _hash_chance(name, season, "batdir", 0.5) else 1
            adj = BAT_POSITIONS[max(0, min(len(BAT_POSITIONS) - 1, idx + step))]
            if adj not in tags:
                tags.append(adj)
        return tags

    if role == "BOWL":
        primary = _hash_pick(name, season, "bowlpos", BOWL_POSITIONS)
        tags = [primary]
        if _hash_chance(name, season, "bowlpos2", 0.35):
            idx = BOWL_POSITIONS.index(primary)
            step = -1 if _hash_chance(name, season, "bowldir", 0.5) else 1
            adj = BOWL_POSITIONS[max(0, min(len(BOWL_POSITIONS) - 1, idx + step))]
            if adj not in tags:
                tags.append(adj)
        return tags

    # ALL-rounders: eligible for both dedicated all-rounder slots, plus a
    # specific specialist tag if their batting or bowling is strong enough to
    # genuinely double as a specialist in that discipline.
    tags = ["Batting All-rounder", "Bowling All-rounder"]
    if bat >= 78:
        tags.append(_hash_pick(name, season, "allbat", ["Top-order", "Middle-order", "Finisher"]))
    if bowl >= 78:
        tags.append(_hash_pick(name, season, "allbowl", BOWL_POSITIONS))
    return tags


# ------------------------------------------------------------------- price tag
def price_for(overall):
    """Auction price in crores, scaled from overall rating (56-99 -> ~0.3-22cr)."""
    t = max(0.0, (overall - 56) / (99 - 56))
    price = 0.3 + (t ** 1.7) * 21.7
    return round(price, 1)


# ------------------------------------------------------------------ load JSON
def load_seasons():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "ipl_*.json")))
    if not files:
        raise SystemExit(
            "No data files in ./data/. Gather them first "
            "(ipl_YYYY.json per season) or run the season-data agents."
        )
    seasons = []
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            try:
                seasons.append(json.load(fh))
            except json.JSONDecodeError as e:
                raise SystemExit(f"Invalid JSON in {os.path.basename(f)}: {e}")
    return seasons


def build():
    seasons = load_seasons()
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript(
        """
        CREATE TABLE franchises (code TEXT PRIMARY KEY, name TEXT, colour TEXT);
        CREATE TABLE seasons (
            year INTEGER PRIMARY KEY, champion TEXT, runner_up TEXT, n_teams INTEGER,
            orange_cap_player TEXT, orange_cap_team TEXT,
            purple_cap_player TEXT, purple_cap_team TEXT
        );
        CREATE TABLE squads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            franchise TEXT NOT NULL, season INTEGER NOT NULL,
            display_name TEXT, finish INTEGER,
            UNIQUE(franchise, season)
        );
        CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL,
            name TEXT, role TEXT, sub_role TEXT,
            bat INTEGER, bowl INTEGER, overall INTEGER,
            overseas INTEGER DEFAULT 0, captain INTEGER DEFAULT 0,
            cap TEXT, positions TEXT, price REAL,
            FOREIGN KEY(squad_id) REFERENCES squads(id)
        );
        """
    )

    for code, colour in FRANCHISE_COLOUR.items():
        c.execute("INSERT INTO franchises VALUES (?,?,?)",
                  (code, FRANCHISE_NAME.get(code, code), colour))

    used_codes = set()
    warnings = []
    n_sq = n_pl = 0

    for data in sorted(seasons, key=lambda d: d["season"]):
        year = data["season"]
        teams = data["teams"]
        n_teams = len(teams)
        champ = next((t["code"] for t in teams if t.get("finish") == 1), None)
        runner = next((t["code"] for t in teams if t.get("finish") == 2), None)
        orange = data.get("orange_cap", {})
        purple = data.get("purple_cap", {})
        c.execute("INSERT OR REPLACE INTO seasons VALUES (?,?,?,?,?,?,?,?)",
                  (year, champ, runner, n_teams,
                   orange.get("player"), orange.get("team"),
                   purple.get("player"), purple.get("team")))

        orange_matched = purple_matched = False

        for t in teams:
            code = t["code"]
            used_codes.add(code)
            if code not in FRANCHISE_COLOUR:
                warnings.append(f"{year}: unknown franchise code {code!r}")
            finish = int(t.get("finish", n_teams))
            c.execute(
                "INSERT OR IGNORE INTO squads (franchise, season, display_name, finish) VALUES (?,?,?,?)",
                (code, year, era_name(code, year), finish),
            )
            squad_id = c.execute(
                "SELECT id FROM squads WHERE franchise=? AND season=?", (code, year)
            ).fetchone()[0]

            seen = set()
            roles = {"BAT": 0, "WK": 0, "ALL": 0, "BOWL": 0}
            for p in t["players"]:
                nm = p["name"].strip()
                if nm in seen:
                    continue
                seen.add(nm)
                role = p["role"].upper()
                if role not in roles:
                    role = "BAT"
                roles[role] += 1
                cap = None
                if code == orange.get("team") and nm == orange.get("player"):
                    cap = "orange"
                    orange_matched = True
                elif code == purple.get("team") and nm == purple.get("player"):
                    cap = "purple"
                    purple_matched = True
                overall, bat, bowl = rate_player(
                    {"name": nm, "role": role, "tier": p.get("tier", "role"), "cap": cap},
                    finish, n_teams, year,
                )
                positions = assign_positions(nm, year, role, bat, bowl)
                price = price_for(overall)
                c.execute(
                    "INSERT INTO players (squad_id,name,role,sub_role,bat,bowl,overall,overseas,captain,cap,positions,price) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (squad_id, nm, role, p.get("tier", "role").title(), bat, bowl, overall,
                     1 if p.get("overseas") else 0, 1 if p.get("captain") else 0, cap,
                     ",".join(positions), price),
                )
                n_pl += 1
            n_sq += 1
            if roles["WK"] == 0:
                warnings.append(f"{year} {code}: no WK in squad")
            if roles["BOWL"] + roles["ALL"] < 4:
                warnings.append(f"{year} {code}: thin bowling ({roles})")

        if orange.get("player") and not orange_matched:
            warnings.append(f"{year}: Orange Cap {orange.get('player')} ({orange.get('team')}) not found in squad data")
        if purple.get("player") and not purple_matched:
            warnings.append(f"{year}: Purple Cap {purple.get('player')} ({purple.get('team')}) not found in squad data")

    conn.commit()
    conn.close()

    print(f"Built {DB_PATH}")
    print(f"  seasons: {len(seasons)}   squads: {n_sq}   players: {n_pl}")
    unused = set(FRANCHISE_COLOUR) - used_codes
    if unused:
        print(f"  (franchise codes defined but unused: {sorted(unused)})")
    if warnings:
        print(f"  {len(warnings)} data warnings:")
        for w in warnings[:40]:
            print("    -", w)


if __name__ == "__main__":
    build()
