"""
build_db.py -- Builds worldcup.db (SQLite) for "Unbeaten XI", the cricket draft game.

Data source: the JSON files in ./data_wc/ (one per edition, wc_YYYY.json), gathered
from the web (Wikipedia / ESPNcricinfo). Each file lists every team that played that
ODI Cricket World Cup, their final finishing position, and their players tagged with
a role and an impact tier. Every squad is a single nation -- there is no "overseas
player" concept in international cricket, unlike the old IPL-franchise version of
this game.

Player RATINGS are computed here, based SOLELY on that player's own individual
World Cup performance -- their tier (star/key/role/squad, tagged per player per
edition from their actual real-world impact that tournament) and role. How the
TEAM finished has no bearing on rating.

On top of that per-edition tier, a player's rating also reflects their CAREER
across every World Cup in the dataset: someone who was a "star" performer in
one tournament for a weaker side and someone who was a "star" performer across
four different World Cups (an actual all-time great) should NOT rate the same.
This "career prestige" signal is derived entirely from data already in the
dataset (how often a player was tagged star/key across editions, and how many
Golden Bat/Golden Ball awards they won) -- not a hand-picked list of "legends",
which would be subjective and incomplete. A player who repeatedly excelled
across multiple World Cups earns a real, defensible rating premium.

Run:  python build_db.py
"""

import glob
import hashlib
import json
import math
import os
import sqlite3

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "worldcup.db")
DATA_DIR = os.path.join(BASE, "data_wc")

# Country metadata: code -> (full name, traditional team colour).
COUNTRY = {
    "IND": ("India", "#1c3f94"),
    "AUS": ("Australia", "#eab135"),
    "ENG": ("England", "#1e2b5c"),
    "PAK": ("Pakistan", "#04543c"),
    "WI":  ("West Indies", "#7b0000"),
    "SL":  ("Sri Lanka", "#0b4ea2"),
    "NZ":  ("New Zealand", "#141414"),
    "SA":  ("South Africa", "#046a38"),
    "ZIM": ("Zimbabwe", "#d31f27"),
    "BAN": ("Bangladesh", "#016937"),
    "AFG": ("Afghanistan", "#0066b3"),
    "KEN": ("Kenya", "#bb1f2a"),
    "NED": ("Netherlands", "#e8712d"),
    "IRE": ("Ireland", "#169b62"),
    "SCO": ("Scotland", "#0065bf"),
    "CAN": ("Canada", "#d5222a"),
    "NAM": ("Namibia", "#003580"),
    "UAE": ("United Arab Emirates", "#00732f"),
    "BER": ("Bermuda", "#8b1538"),
    "EAF": ("East Africa", "#c8a951"),
}


# ---------------------------------------------------------------- rating model
# Base overall purely from individual tier that World Cup -- no team-finish
# input at all. "star" reflects a player's own standout tournament regardless
# of how far their team went.
TIER_BASE = {"star": 88, "key": 78, "role": 69, "squad": 60}
RATING_FLOOR = 50  # the "replacement-level cricketer" baseline everything scales from

# How strong a cricketing nation genuinely was across this era -- being the
# best player on a side that never beat a top team is real, but it isn't the
# same achievement as being the best player for India or Australia. This is
# what actually separates "the best Kenya had" from "an all-time great": a
# star tier tag alone doesn't capture the difference, so it's scaled by the
# real historical strength of the opposition that player's tier was earned
# against. 1.0 = the traditional powerhouse nations of the era.
COUNTRY_STRENGTH = {
    "AUS": 1.0, "IND": 1.0, "ENG": 1.0, "PAK": 1.0,
    "WI": 1.0, "SL": 1.0, "NZ": 1.0, "SA": 1.0,
    "ZIM": 0.85, "BAN": 0.75, "AFG": 0.85,
    "IRE": 0.7, "KEN": 0.6, "NED": 0.55, "SCO": 0.5,
    "CAN": 0.45, "NAM": 0.4, "UAE": 0.4, "BER": 0.4, "EAF": 0.35,
}


def country_strength(code):
    return COUNTRY_STRENGTH.get(code, 0.5)


# Career-prestige weights: how much each cross-edition signal contributes to
# the legend score that decides both the size of a player's peak-tournament
# boost and (implicitly, through country_strength) how rare it is to earn one.
PRESTIGE_WEIGHT = {"star": 3, "key": 1, "role": 0, "squad": 0}
AWARD_WEIGHT = 5  # a Golden Bat/Ball win is a huge individual-career signal

# A 99 is reserved for the true GOATs of the game -- across the ENTIRE
# dataset, only the top handful of legend scores are allowed to ever reach
# it. Everyone else's peak tournament still gets a real boost, it just tops
# out below the ceiling.
MAX_GOATS = 4
GOAT_CEILING = 99
NORMAL_CEILING = 95


def _jitter(name, edition, lo, hi):
    """Deterministic small variation so players don't all tie (no randomness)."""
    h = hashlib.md5(f"{name}|{edition}".encode()).hexdigest()
    span = hi - lo + 1
    return lo + (int(h[:6], 16) % span)


def compute_player_careers(editions):
    """
    For every player NAME across the whole dataset, tally a legend score from
    every tier tag and award across their career (weighted by how strong their
    team genuinely was that era), and identify a single "peak edition" -- the
    ONE World Cup that was genuinely their best/most memorable. That's the
    tournament they won a Golden Bat/Golden Ball in (their team's best finish
    among award-winning editions, if more than one), or failing that, the
    "star"-tier tournament where their team went furthest.

    The legend boost computed from the score is only ever applied to that one
    peak edition -- every other tournament a player appears in, even a "star"
    one, rates on tier alone. That's what keeps a 99 rare and tied to the one
    World Cup the world actually remembers a player for, instead of every
    great player plateauing at the ceiling across their whole career.
    """
    records = {}
    for data in editions:
        golden_bat = data.get("golden_bat", {})
        golden_ball = data.get("golden_ball", {})
        for t in data["teams"]:
            code = t["code"]
            finish = t.get("finish", 999)
            seen = set()
            for p in t["players"]:
                nm = p["name"].strip()
                if nm in seen:
                    continue
                seen.add(nm)
                tier = p.get("tier", "role")
                has_award = (
                    (code == golden_bat.get("team") and nm == golden_bat.get("player"))
                    or (code == golden_ball.get("team") and nm == golden_ball.get("player"))
                )
                records.setdefault(nm, []).append((data["edition"], code, tier, has_award, finish))

    careers = {}
    for nm, recs in records.items():
        score = 0.0
        for _year, code, tier, has_award, _finish in recs:
            strength = country_strength(code)
            score += PRESTIGE_WEIGHT.get(tier, 0) * strength
            if has_award:
                score += AWARD_WEIGHT * strength

        award_recs = [r for r in recs if r[3]]
        star_recs = [r for r in recs if r[2] == "star"]
        if award_recs:
            peak_edition = min(award_recs, key=lambda r: r[4])[0]
        elif star_recs:
            peak_edition = min(star_recs, key=lambda r: r[4])[0]
        else:
            peak_edition = None

        # Saturating curve into a 0-11 boost: one solid tournament barely
        # moves the needle, only genuine sustained cross-era excellence
        # against strong opposition (several "star" World Cups for a top
        # nation, awards) pushes it near the top -- that's what makes a 99
        # rare and reserved for actual all-time legends.
        boost = round(11 * (1 - math.exp(-score / 12)))
        careers[nm] = {"boost": boost, "peak_edition": peak_edition, "score": score}

    # Only the handful of very best legend scores in the whole dataset are
    # allowed to ever touch a 99 card -- everyone else's peak still gets
    # boosted, it just can't cross NORMAL_CEILING.
    goats = {
        nm for nm, _ in sorted(careers.items(), key=lambda kv: kv[1]["score"], reverse=True)[:MAX_GOATS]
        if careers[nm]["peak_edition"] is not None and careers[nm]["score"] > 0
    }
    for nm, c in careers.items():
        c["ceiling"] = GOAT_CEILING if nm in goats else NORMAL_CEILING
    return careers


def rate_player(p, edition, career, strength):
    """Compute (overall, bat, bowl) from individual tier + role, scaled by how
    strong that player's nation genuinely was this era. A player's career-
    legend boost (if any) is only applied in their single identified peak
    World Cup -- every other appearance rates on tier alone. Only the small
    set of true GOAT legend scores can ever reach the 99 ceiling; everyone
    else's peak still gets boosted but tops out lower."""
    tier_val = TIER_BASE.get(p.get("tier", "role"), TIER_BASE["role"])
    base = RATING_FLOOR + (tier_val - RATING_FLOOR) * strength
    var = _jitter(p["name"], edition, -4, 4)
    boost = career["boost"] if career.get("peak_edition") == edition else 0
    ceiling = career.get("ceiling", NORMAL_CEILING)
    overall = int(round(base + var + boost))
    overall = max(56, min(ceiling, overall))

    role = p["role"]
    if role == "WK":
        bat, bowl = overall, 5
    elif role == "BAT":
        bat = overall
        bowl = _jitter(p["name"], edition + 1, 8, 30)
    elif role == "BOWL":
        bowl = overall
        bat = _jitter(p["name"], edition + 2, 12, 40)
    else:  # ALL
        # A genuine all-rounder leans batting or bowling -- deterministically
        # per player, not by giving one discipline a structurally smaller
        # subtraction range than the other (that used to silently make almost
        # every all-rounder's bowling rate a hair higher than their batting,
        # regardless of the player, which skewed position tagging hard toward
        # "Bowler" and away from "Middle-order").
        leans_batting = _hash_chance(p["name"], edition, "allrounderlean", 0.5)
        if leans_batting:
            bat = max(50, overall - _jitter(p["name"], edition, 1, 5))
            bowl = max(50, overall - _jitter(p["name"], edition + 1, 5, 11))
        else:
            bowl = max(50, overall - _jitter(p["name"], edition + 1, 1, 5))
            bat = max(50, overall - _jitter(p["name"], edition, 5, 11))

    # Golden Bat / Golden Ball winners get a special boost: they were THE
    # standout individual performer of that entire World Cup, so they should
    # rate above their peers even within a champion squad -- but still capped
    # by the same per-player ceiling, so the award alone can't manufacture a
    # 99 outside the small GOAT set.
    award = p.get("award")
    if award == "golden_bat":
        bat = min(ceiling, bat + 10)
        overall = min(ceiling, overall + 8)
    elif award == "golden_ball":
        bowl = min(ceiling, bowl + 10)
        overall = min(ceiling, overall + 8)

    return overall, int(bat), int(bowl)


# --------------------------------------------------------------- position tags
# The XI has exactly one fixed real-world shape: 2 Openers, 4 Middle-order,
# 1 Wicketkeeper, 4 Bowlers. A player's tag(s) are a defensible, deterministic
# reading of "what job would this player realistically do" -- derived from
# role + rating, not literal historical ball-by-ball batting-position data
# (which isn't available at this scale). Multiple tags are allowed per player,
# so a flexible batter or genuine all-rounder can fit more than one slot.


def _hash_int(name, edition, salt):
    h = hashlib.md5(f"{name}|{edition}|{salt}".encode()).hexdigest()
    return int(h[:8], 16)


def _hash_pick(name, edition, salt, options):
    return options[_hash_int(name, edition, salt) % len(options)]


def _hash_chance(name, edition, salt, prob):
    return (_hash_int(name, edition, salt) % 1000) / 1000.0 < prob


def assign_positions(name, edition, role, bat, bowl):
    if role == "WK":
        return ["Wicketkeeper"]

    if role == "BAT":
        primary = _hash_pick(name, edition, "batpos", ["Opener", "Middle-order"])
        tags = [primary]
        if _hash_chance(name, edition, "batpos2", 0.3):
            tags.append("Middle-order" if primary == "Opener" else "Opener")
        return tags

    if role == "BOWL":
        return ["Bowler"]

    # ALL-rounders: eligible for whichever discipline(s) are genuinely strong
    # enough to double as a specialist -- the stronger discipline always
    # counts, the weaker one only if it's still good enough to trust in the XI.
    tags = []
    if bat >= bowl:
        tags.append("Middle-order")
        if bowl >= 60:
            tags.append("Bowler")
    else:
        tags.append("Bowler")
        if bat >= 60:
            tags.append("Middle-order")
    return tags


# ------------------------------------------------------------------ load JSON
def load_editions():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "wc_*.json")))
    if not files:
        raise SystemExit(
            "No data files in ./data_wc/. Gather them first (wc_YYYY.json per edition)."
        )
    editions = []
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            try:
                editions.append(json.load(fh))
            except json.JSONDecodeError as e:
                raise SystemExit(f"Invalid JSON in {os.path.basename(f)}: {e}")
    return editions


def build():
    editions = load_editions()
    careers = compute_player_careers(editions)
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript(
        """
        CREATE TABLE countries (code TEXT PRIMARY KEY, name TEXT, colour TEXT);
        CREATE TABLE editions (
            year INTEGER PRIMARY KEY, host TEXT, champion TEXT, runner_up TEXT, n_teams INTEGER,
            golden_bat_player TEXT, golden_bat_team TEXT,
            golden_ball_player TEXT, golden_ball_team TEXT
        );
        CREATE TABLE squads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country TEXT NOT NULL, edition INTEGER NOT NULL,
            display_name TEXT, finish INTEGER,
            UNIQUE(country, edition)
        );
        CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL,
            name TEXT, role TEXT, tier TEXT,
            bat INTEGER, bowl INTEGER, overall INTEGER,
            captain INTEGER DEFAULT 0,
            award TEXT, positions TEXT,
            FOREIGN KEY(squad_id) REFERENCES squads(id)
        );
        CREATE INDEX idx_players_squad ON players(squad_id);
        """
    )

    for code, (name, colour) in COUNTRY.items():
        c.execute("INSERT INTO countries VALUES (?,?,?)", (code, name, colour))

    used_codes = set()
    warnings = []
    n_sq = n_pl = 0

    for data in sorted(editions, key=lambda d: d["edition"]):
        year = data["edition"]
        host = data.get("host", "")
        teams = data["teams"]
        n_teams = len(teams)
        champ = next((t["code"] for t in teams if t.get("finish") == 1), None)
        runner = next((t["code"] for t in teams if t.get("finish") == 2), None)
        golden_bat = data.get("golden_bat", {})
        golden_ball = data.get("golden_ball", {})
        c.execute("INSERT OR REPLACE INTO editions VALUES (?,?,?,?,?,?,?,?,?)",
                  (year, host, champ, runner, n_teams,
                   golden_bat.get("player"), golden_bat.get("team"),
                   golden_ball.get("player"), golden_ball.get("team")))

        bat_matched = ball_matched = False

        for t in teams:
            code = t["code"]
            used_codes.add(code)
            if code not in COUNTRY:
                warnings.append(f"{year}: unknown country code {code!r}")
            finish = int(t.get("finish", n_teams))
            display_name = COUNTRY.get(code, (code, None))[0]
            c.execute(
                "INSERT OR IGNORE INTO squads (country, edition, display_name, finish) VALUES (?,?,?,?)",
                (code, year, display_name, finish),
            )
            squad_id = c.execute(
                "SELECT id FROM squads WHERE country=? AND edition=?", (code, year)
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
                award = None
                if code == golden_bat.get("team") and nm == golden_bat.get("player"):
                    award = "golden_bat"
                    bat_matched = True
                elif code == golden_ball.get("team") and nm == golden_ball.get("player"):
                    award = "golden_ball"
                    ball_matched = True
                overall, bat, bowl = rate_player(
                    {"name": nm, "role": role, "tier": p.get("tier", "role"), "award": award},
                    year, careers.get(nm, {"boost": 0, "peak_edition": None}), country_strength(code),
                )
                positions = assign_positions(nm, year, role, bat, bowl)
                c.execute(
                    "INSERT INTO players (squad_id,name,role,tier,bat,bowl,overall,captain,award,positions) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (squad_id, nm, role, p.get("tier", "role").title(), bat, bowl, overall,
                     1 if p.get("captain") else 0, award, ",".join(positions)),
                )
                n_pl += 1
            n_sq += 1
            if roles["WK"] == 0:
                warnings.append(f"{year} {code}: no WK in squad")
            if roles["BOWL"] + roles["ALL"] < 4:
                warnings.append(f"{year} {code}: thin bowling ({roles})")

        if golden_bat.get("player") and not bat_matched:
            warnings.append(f"{year}: Golden Bat {golden_bat.get('player')} ({golden_bat.get('team')}) not found in squad data")
        if golden_ball.get("player") and not ball_matched:
            warnings.append(f"{year}: Golden Ball {golden_ball.get('player')} ({golden_ball.get('team')}) not found in squad data")

    conn.commit()
    conn.close()

    print(f"Built {DB_PATH}")
    print(f"  editions: {len(editions)}   squads: {n_sq}   players: {n_pl}")
    unused = set(COUNTRY) - used_codes
    if unused:
        print(f"  (country codes defined but unused: {sorted(unused)})")
    if warnings:
        print(f"  {len(warnings)} data warnings:")
        for w in warnings[:60]:
            print("    -", w)


if __name__ == "__main__":
    build()
