"""
Regression tests for the dataset and the rating model.

Standard-library only (unittest), so the project's zero-`pip install` promise
holds for tests too.

Run:  python -m unittest -v test_build_db
"""

import glob
import json
import os
import sqlite3
import unittest

import build_db

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "worldcup.db")
DATA_DIR = os.path.join(BASE, "data_wc")

VALID_ROLES = {"BAT", "WK", "ALL", "BOWL"}
VALID_TIERS = {"star", "key", "role", "squad"}
VALID_POSITIONS = {"Opener", "Middle-order", "Wicketkeeper", "Bowler"}
# The fixed XI shape every draft must be able to fill.
FORMATION_NEED = {"Opener": 2, "Middle-order": 4, "Wicketkeeper": 1, "Bowler": 4}


class SourceDataTests(unittest.TestCase):
    """The hand-gathered JSON in data_wc/ is the source of truth -- guard it."""

    @classmethod
    def setUpClass(cls):
        cls.editions = build_db.load_editions()

    def test_thirteen_editions_every_four_years(self):
        years = sorted(d["edition"] for d in self.editions)
        self.assertEqual(len(years), 13)
        self.assertEqual(years[0], 1975)
        self.assertEqual(years[-1], 2023)
        self.assertEqual(len(set(years)), len(years), "duplicate edition years")

    def test_each_edition_has_exactly_one_champion_and_runner_up(self):
        for d in self.editions:
            finishes = [t.get("finish") for t in d["teams"]]
            self.assertEqual(finishes.count(1), 1, f"{d['edition']}: not exactly one champion")
            self.assertEqual(finishes.count(2), 1, f"{d['edition']}: not exactly one runner-up")

    def test_every_team_has_a_known_country_code(self):
        for d in self.editions:
            for t in d["teams"]:
                self.assertIn(t["code"], build_db.COUNTRY, f"{d['edition']}: unknown code {t['code']}")

    def test_every_squad_has_exactly_one_captain(self):
        for d in self.editions:
            for t in d["teams"]:
                caps = [p for p in t["players"] if p.get("captain")]
                self.assertEqual(len(caps), 1, f"{d['edition']} {t['code']}: {len(caps)} captains")

    def test_roles_and_tiers_are_valid(self):
        for d in self.editions:
            for t in d["teams"]:
                for p in t["players"]:
                    self.assertIn(p["role"].upper(), VALID_ROLES, f"{p['name']}: bad role")
                    self.assertIn(p.get("tier", "role"), VALID_TIERS, f"{p['name']}: bad tier")

    def test_no_duplicate_player_within_a_squad(self):
        for d in self.editions:
            for t in d["teams"]:
                names = [p["name"].strip() for p in t["players"]]
                self.assertEqual(len(set(names)), len(names), f"{d['edition']} {t['code']}: duplicate player")

    def test_every_squad_has_a_keeper_and_enough_bowling(self):
        for d in self.editions:
            for t in d["teams"]:
                roles = [p["role"].upper() for p in t["players"]]
                self.assertGreaterEqual(roles.count("WK"), 1, f"{d['edition']} {t['code']}: no keeper")
                self.assertGreaterEqual(
                    roles.count("BOWL") + roles.count("ALL"), 4,
                    f"{d['edition']} {t['code']}: thin bowling",
                )

    def test_award_winners_exist_in_the_named_squad(self):
        for d in self.editions:
            for key in ("golden_bat", "golden_ball"):
                award = d.get(key) or {}
                if not award.get("player"):
                    continue
                team = next((t for t in d["teams"] if t["code"] == award["team"]), None)
                self.assertIsNotNone(team, f"{d['edition']} {key}: team {award['team']} not in edition")
                names = {p["name"].strip() for p in team["players"]}
                self.assertIn(award["player"], names, f"{d['edition']} {key}: {award['player']} not in squad")

    def test_data_files_are_valid_json_and_named_consistently(self):
        for path in sorted(glob.glob(os.path.join(DATA_DIR, "wc_*.json"))):
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            year_from_name = int(os.path.basename(path)[3:7])
            self.assertEqual(data["edition"], year_from_name, f"{path}: filename/edition mismatch")


class RatingModelTests(unittest.TestCase):
    """The rating model has deliberate, load-bearing rules. Pin them down."""

    @classmethod
    def setUpClass(cls):
        cls.editions = build_db.load_editions()
        cls.careers = build_db.compute_player_careers(cls.editions)

    def test_a_99_ceiling_is_granted_to_at_most_four_players(self):
        goats = [n for n, c in self.careers.items() if c["ceiling"] == build_db.GOAT_CEILING]
        self.assertLessEqual(len(goats), build_db.MAX_GOATS)
        self.assertGreater(len(goats), 0, "nobody can reach 99 at all")

    def test_everyone_else_is_capped_below_the_goat_ceiling(self):
        for name, c in self.careers.items():
            self.assertIn(c["ceiling"], (build_db.GOAT_CEILING, build_db.NORMAL_CEILING))
        self.assertLess(build_db.NORMAL_CEILING, build_db.GOAT_CEILING)

    def test_each_player_has_at_most_one_peak_edition(self):
        # "peak_edition" is a single year by construction; assert the type so a
        # future refactor can't quietly turn it into a list of peaks.
        for name, c in self.careers.items():
            self.assertTrue(c["peak_edition"] is None or isinstance(c["peak_edition"], int))

    def test_award_winners_peak_in_an_edition_they_won_the_award(self):
        award_years = {}
        for d in self.editions:
            for key in ("golden_bat", "golden_ball"):
                a = d.get(key) or {}
                if a.get("player"):
                    award_years.setdefault(a["player"], set()).add(d["edition"])
        for player, years in award_years.items():
            peak = self.careers.get(player, {}).get("peak_edition")
            if peak is not None:
                self.assertIn(peak, years, f"{player}: peak {peak} is not an award-winning year {years}")

    def test_country_strength_scales_ratings(self):
        """An identical tier for a weak nation must rate below a strong one."""
        strong = build_db.rate_player(
            {"name": "Test Player", "role": "BAT", "tier": "star", "award": None},
            1999, {"boost": 0, "peak_edition": None, "ceiling": build_db.NORMAL_CEILING},
            build_db.country_strength("AUS"),
        )
        weak = build_db.rate_player(
            {"name": "Test Player", "role": "BAT", "tier": "star", "award": None},
            1999, {"boost": 0, "peak_edition": None, "ceiling": build_db.NORMAL_CEILING},
            build_db.country_strength("EAF"),
        )
        self.assertGreater(strong[0], weak[0])

    def test_ratings_never_leave_their_bounds(self):
        for tier in VALID_TIERS:
            for code in build_db.COUNTRY:
                overall, bat, bowl = build_db.rate_player(
                    {"name": f"P{tier}{code}", "role": "ALL", "tier": tier, "award": None},
                    2011, {"boost": 11, "peak_edition": 2011, "ceiling": build_db.GOAT_CEILING},
                    build_db.country_strength(code),
                )
                self.assertGreaterEqual(overall, 56)
                self.assertLessEqual(overall, build_db.GOAT_CEILING)
                for v in (bat, bowl):
                    self.assertGreaterEqual(v, 0)
                    self.assertLessEqual(v, build_db.GOAT_CEILING)

    def test_rating_is_deterministic(self):
        args = (
            {"name": "Repeatable", "role": "BOWL", "tier": "key", "award": None},
            2003, {"boost": 4, "peak_edition": 2003, "ceiling": build_db.NORMAL_CEILING}, 1.0,
        )
        self.assertEqual(build_db.rate_player(*args), build_db.rate_player(*args))

    def test_boost_only_applies_in_the_peak_edition(self):
        career = {"boost": 10, "peak_edition": 1996, "ceiling": build_db.NORMAL_CEILING}
        peak = build_db.rate_player(
            {"name": "Peaky", "role": "BAT", "tier": "star", "award": None}, 1996, career, 1.0)
        other = build_db.rate_player(
            {"name": "Peaky", "role": "BAT", "tier": "star", "award": None}, 1999,
            {**career, "peak_edition": 1996}, 1.0)
        self.assertGreater(peak[0], other[0], "the legend boost leaked outside the peak edition")


class PositionTagTests(unittest.TestCase):
    def test_keepers_and_bowlers_get_their_only_sensible_tag(self):
        self.assertEqual(build_db.assign_positions("K", 1999, "WK", 70, 5), ["Wicketkeeper"])
        self.assertEqual(build_db.assign_positions("B", 1999, "BOWL", 20, 80), ["Bowler"])

    def test_batters_only_ever_get_batting_tags(self):
        for i in range(300):
            tags = build_db.assign_positions(f"Bat{i}", 1999, "BAT", 70, 20)
            self.assertTrue(set(tags) <= {"Opener", "Middle-order"}, tags)
            self.assertEqual(len(set(tags)), len(tags), f"duplicate tag: {tags}")

    def test_allrounder_tags_follow_their_stronger_discipline(self):
        # Clearly a batting all-rounder: leads with Middle-order, and only
        # doubles as a Bowler because the bowling is still trustworthy.
        self.assertEqual(build_db.assign_positions("A", 2007, "ALL", 85, 70), ["Middle-order", "Bowler"])
        # Clearly a bowling all-rounder.
        self.assertEqual(build_db.assign_positions("B", 2007, "ALL", 70, 85), ["Bowler", "Middle-order"])
        # A weak second discipline shouldn't earn a specialist slot at all.
        self.assertEqual(build_db.assign_positions("C", 2007, "ALL", 85, 40), ["Middle-order"])
        self.assertEqual(build_db.assign_positions("D", 2007, "ALL", 40, 85), ["Bowler"])

    def test_every_tag_is_one_the_formation_recognises(self):
        for role in VALID_ROLES:
            for i in range(50):
                for tag in build_db.assign_positions(f"X{i}", 1992, role, 70, 70):
                    self.assertIn(tag, VALID_POSITIONS)


class BuiltDatabaseTests(unittest.TestCase):
    """Assertions against the actual generated worldcup.db."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(DB_PATH):
            build_db.build()
        cls.conn = sqlite3.connect(DB_PATH)
        cls.conn.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_expected_row_counts(self):
        c = self.conn.cursor()
        self.assertEqual(c.execute("SELECT COUNT(*) FROM editions").fetchone()[0], 13)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM squads").fetchone()[0], 143)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM players").fetchone()[0], 2050)

    def test_no_orphan_players(self):
        c = self.conn.cursor()
        orphans = c.execute(
            "SELECT COUNT(*) FROM players p LEFT JOIN squads s ON p.squad_id = s.id WHERE s.id IS NULL"
        ).fetchone()[0]
        self.assertEqual(orphans, 0)

    def test_at_most_four_players_ever_reach_99(self):
        c = self.conn.cursor()
        n = c.execute("SELECT COUNT(DISTINCT name) FROM players WHERE overall = 99").fetchone()[0]
        self.assertLessEqual(n, build_db.MAX_GOATS)

    def test_a_player_peaks_at_99_in_only_one_edition_unless_multi_award(self):
        """Repeat 99s are legitimate only for repeat award winners (e.g. Starc '15 & '19)."""
        c = self.conn.cursor()
        rows = c.execute("""
            SELECT p.name, COUNT(*) n, SUM(CASE WHEN p.award IS NOT NULL THEN 1 ELSE 0 END) awards
            FROM players p WHERE p.overall = 99 GROUP BY p.name HAVING n > 1
        """).fetchall()
        for r in rows:
            self.assertEqual(
                r["n"], r["awards"],
                f"{r['name']} hits 99 in {r['n']} editions but only won {r['awards']} awards",
            )

    def test_every_player_has_at_least_one_valid_position_tag(self):
        c = self.conn.cursor()
        for r in c.execute("SELECT name, positions FROM players"):
            tags = (r["positions"] or "").split(",")
            self.assertTrue(tags and tags[0], f"{r['name']}: no position tag")
            for t in tags:
                self.assertIn(t, VALID_POSITIONS, f"{r['name']}: bad tag {t}")

    def test_roles_map_to_the_right_tags(self):
        c = self.conn.cursor()
        for r in c.execute("SELECT name, role, positions FROM players"):
            tags = set((r["positions"] or "").split(","))
            if r["role"] == "WK":
                self.assertEqual(tags, {"Wicketkeeper"}, r["name"])
            elif r["role"] == "BOWL":
                self.assertEqual(tags, {"Bowler"}, r["name"])
            elif r["role"] == "BAT":
                self.assertTrue(tags <= {"Opener", "Middle-order"}, f"{r['name']}: {tags}")
            else:  # ALL
                self.assertTrue(tags <= {"Middle-order", "Bowler"}, f"{r['name']}: {tags}")

    def test_only_the_keeper_role_is_tagged_wicketkeeper(self):
        """Exactly one slot needs a keeper, so a non-WK must never claim the tag."""
        c = self.conn.cursor()
        bad = c.execute(
            "SELECT COUNT(*) FROM players WHERE positions LIKE '%Wicketkeeper%' AND role != 'WK'"
        ).fetchone()[0]
        self.assertEqual(bad, 0)

    def test_allrounders_are_not_structurally_skewed_to_one_discipline(self):
        """
        Regression: the rating jitter used to subtract a smaller range from
        `bowl` than from `bat`, so nearly every all-rounder came out fractionally
        better at bowling and got tagged Bowler-only. Batting all-rounders all
        but vanished from the pool. Guard the population balance.
        """
        c = self.conn.cursor()
        bowl_only = c.execute(
            "SELECT COUNT(*) FROM players WHERE role='ALL' AND positions='Bowler'").fetchone()[0]
        bat_only = c.execute(
            "SELECT COUNT(*) FROM players WHERE role='ALL' AND positions='Middle-order'").fetchone()[0]
        self.assertGreater(bat_only, 0, "no batting-only all-rounders at all")
        self.assertGreater(bowl_only, 0, "no bowling-only all-rounders at all")
        ratio = max(bowl_only, bat_only) / min(bowl_only, bat_only)
        self.assertLess(ratio, 3.0, f"all-rounder tags skewed {bowl_only} bowl vs {bat_only} bat")

    def test_average_allrounder_bat_and_bowl_are_balanced(self):
        c = self.conn.cursor()
        row = c.execute("SELECT AVG(bat) b, AVG(bowl) w FROM players WHERE role='ALL'").fetchone()
        self.assertLess(abs(row["b"] - row["w"]), 2.0,
                        f"all-rounder averages drifted apart: bat {row['b']:.1f} vs bowl {row['w']:.1f}")

    def test_every_squad_can_field_the_fixed_formation_or_is_a_known_shortfall(self):
        """
        Squads that can't cover all 11 slots are fine (a dead market triggers a
        free redraw), but the count must stay small or drafting gets tedious.
        """
        c = self.conn.cursor()
        short = 0
        for s in c.execute("SELECT id FROM squads"):
            counts = dict.fromkeys(FORMATION_NEED, 0)
            for r in c.execute("SELECT positions FROM players WHERE squad_id=?", (s["id"],)):
                for t in (r["positions"] or "").split(","):
                    if t in counts:
                        counts[t] += 1
            if any(counts[k] < need for k, need in FORMATION_NEED.items()):
                short += 1
        self.assertLess(short, 30, f"{short}/143 squads can't fill the XI shape")

    def test_ratings_are_in_range(self):
        c = self.conn.cursor()
        row = c.execute("SELECT MIN(overall) lo, MAX(overall) hi FROM players").fetchone()
        self.assertGreaterEqual(row["lo"], 50)
        self.assertLessEqual(row["hi"], 99)

    def test_each_edition_has_a_champion_and_runner_up_recorded(self):
        c = self.conn.cursor()
        for r in c.execute("SELECT year, champion, runner_up FROM editions"):
            self.assertTrue(r["champion"], f"{r['year']}: no champion")
            self.assertTrue(r["runner_up"], f"{r['year']}: no runner-up")
            self.assertNotEqual(r["champion"], r["runner_up"], f"{r['year']}")

    def test_awards_are_unique_per_edition(self):
        c = self.conn.cursor()
        for s in c.execute("SELECT DISTINCT edition FROM squads"):
            for award in ("golden_bat", "golden_ball"):
                n = c.execute(
                    "SELECT COUNT(*) FROM players p JOIN squads s ON p.squad_id = s.id "
                    "WHERE s.edition = ? AND p.award = ?", (s["edition"], award)
                ).fetchone()[0]
                self.assertLessEqual(n, 1, f"{s['edition']}: {n} {award} winners")


if __name__ == "__main__":
    unittest.main(verbosity=2)
