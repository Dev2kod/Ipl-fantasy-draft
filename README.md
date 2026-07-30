# 7-0 IPL — Draft Your Champions (2008–2026)

A cricket adaptation of the viral football game **[7a0 / Sete a Zero](https://7a0.org/en)**
(a World Cup draft simulator). Instead of drawing national teams from World Cup
history, you draw **IPL franchise-seasons from 2008 to 2026**, build an XI one pick
at a time, then simulate a 7-match gauntlet chasing a perfect, unbeaten **7-0**.

Backend: Python standard library + SQLite, **zero `pip install`**, real IPL data
for **every team in every season** (166 team-seasons, 2,404 players, 2008–2026).
Front-end: a full **React + TypeScript** app (Tailwind, Framer Motion, Zustand).

---

## How the game maps to 7a0

| 7a0 (football)                         | 7-0 IPL (this game)                          |
|----------------------------------------|----------------------------------------------|
| Draw a nation + World Cup year         | Draw an IPL franchise + season (2008–2026)   |
| That squad is your market              | Same — pick **one** player from it           |
| Fill a football formation (4-3-3, …)   | Fill a cricket XI shape (batters/keeper/all-rounders/bowlers) |
| Only 3 skips, one pick per turn        | 3 free switches **per pick**, one player per turn |
| Classic (ratings) vs Almanac (memory)  | Same two modes                               |
| Simulate a run; chase a **7-0**        | Simulate a 7-match Cup Run; win all 7 unbeaten |
| —                                      | Real IPL rule: max **4 overseas players** in the XI |
| —                                      | Orange Cap / Purple Cap winners rate as the best player of that season |

---

## Quick start

```bash
python build_db.py           # 1. build ipl.db from the dataset (once)
cd web && npm install && npm run build && cd ..   # 2. build the React front-end (once)
python server.py             # 3. start the game server
# open http://localhost:8000
```

`server.py` auto-builds the database on first run if `ipl.db` is missing. It does
**not** build the front-end automatically — that needs Node once (`npm run build`
in `web/`) because it compiles React/TypeScript into plain static files. After
that one-time build, running the game only needs Python — no Node required at
runtime, and the Python side still needs **zero pip installs**.

Set a different port with `PORT=9000 python server.py`.

For front-end development with hot reload: `cd web && npm run dev` (proxies
`/api` to `python server.py` running on port 8000).

---

## How to play

1. **Choose your XI shape** (formation): Balanced, Batting Beast, All-Rounder Army,
   or Bowling Fortress. This dictates which roles you must fill.
2. **Choose a mode**: *Classic* shows FIFA-style ratings; *Almanac* hides them —
   a memory test.
3. **Choose difficulty**: Warm-up / Contender / Dynasty (rival strength).
4. **Draft.** Each turn draws a franchise-season **completely at random** —
   uniformly across all 166 squads, with no hidden preference toward any
   finishing position. Pick one player who fits an open role.
   * A **player can be signed only once**, even if he shows up in another season.
   * Your XI can carry **at most 4 overseas players** — the real IPL rule.
   * **Every pick gives you 3 switches**: *same season, other team* or *same
     team, other season*. Nothing is off-limits — switch to any matching squad
     you haven't just declined this turn.
   * If a market has nothing you can use, "Draw a squad" becomes a free redraw
     — you're never stuck.
5. **Lock the XI**, pick a **match style** (Aggressive / Balanced / Defensive),
   and **simulate**. Matches reveal **one at a time, on your click** — expand
   any match for the toss result, a randomised bat/bowl decision, and a
   highlight. Open the **full scorecard** (batting + bowling lines for both
   sides) for any match, live or after the run.
6. Win all seven and lift the trophy unbeaten — the perfect 7-0.

---

## Project layout

```
7-0/
├── build_db.py        # loads data/ipl_*.json → builds ipl.db (SQLite), computes ratings
├── server.py           # stdlib http.server + sqlite3; serves web/dist + /api/data
├── fetch_data.py        # OPTIONAL web scraper (urllib) to extend the dataset further
├── ipl.db              # generated SQLite database
├── data/
│   └── ipl_YYYY.json    # one file per season: every team, finish, full squad, cap winners
├── README.md
└── web/                 # React + TypeScript front-end (Vite)
    ├── src/
    │   ├── engine/       # pure game logic: draft, ratings, simulation, scorecards
    │   ├── store/        # zustand game state
    │   └── components/   # Setup / Draft / Style / Result screens, UI atoms
    └── dist/             # built static output — this is what server.py serves
```

## Database schema (SQLite)

- **franchises** `(code, name, colour)`
- **seasons** `(year, champion, runner_up, n_teams, orange_cap_player, orange_cap_team, purple_cap_player, purple_cap_team)`
- **squads** `(id, franchise, season, display_name, finish)` — a drawable team-season,
  `display_name` uses the era-correct franchise name (e.g. "Delhi Daredevils" pre-2019,
  "Delhi Capitals" after) and `finish` is that team's final league position
- **players** `(id, squad_id, name, role, sub_role, bat, bowl, overall, overseas, captain, cap)`
  — `cap` is `'orange'`, `'purple'`, or `NULL`

Roles: `BAT`, `WK`, `ALL`, `BOWL`. Every season 2008–2026 is covered with **every team
that played that year** — including defunct/one-off franchises (Deccan Chargers,
Kochi Tuskers Kerala, Pune Warriors India, Gujarat Lions, Rising Pune Supergiant) —
for **166 team-seasons and 2,404 players** total, gathered from Wikipedia/ESPNcricinfo.

### Ratings depend on how the team finished that season

`build_db.py` computes each player's rating from three things:
1. **Team finish** — a title-winning squad's players get a high base rating (~82+);
   a wooden-spoon squad's get a low one (~66). This is the dominant factor, so the
   same star player rates very differently in a champion year vs a bad year.
2. **Player tier** (`star`/`key`/`role`/`squad`, tagged per player per season) shifts
   that base up or down, and role (batter/keeper/all-rounder/bowler) shapes the
   bat/bowl split.
3. **Orange Cap / Purple Cap** — the season's most-runs and most-wickets winner get
   an explicit boost (+10 to the relevant discipline, +8 overall, capped at 99),
   reflecting that they were *the* standout individual performer that year, on top
   of whatever their team's finish/tier already gave them.

The UI shows each squad's finish ("🏆 Champions", "🥈 Runners-up", "Finished 6th"...)
and flags cap-winning players with an Orange/Purple Cap badge.

## Extending the data

Add a new `data/ipl_YYYY.json` following the existing files' schema (teams, finish,
players with role/tier/captain/overseas, plus top-level `orange_cap`/`purple_cap`
`{player, team}` objects), then re-run `python build_db.py` — it picks up every file
in `data/` automatically and validates that both cap winners are found in the squad
data. `fetch_data.py` is a small stdlib scraper scaffold (Wikipedia) that can help
gather candidate names for a new season.

---

## Design notes / correctness

- **Deadlock-proof draft:** the draw picks uniformly at random across every squad
  (no eligibility pre-filter — that was found to skew draws toward lower-table
  teams over the course of a draft, since podium finishes are a small minority
  of the 166 squads). An occasional dead market gets a free, uncosted redraw
  instead. Verified: draw distribution across 20,000 uniform picks lands within
  0.3 percentage points of each finish-position bucket's actual share of the
  dataset — proven unbiased.
- **Squads aren't consumed after one pick** — the same team-season can reappear
  on a later turn (with whichever of its players remain unclaimed), keeping the
  full 166-squad pool in play for the whole draft instead of shrinking it.
- **Overseas cap enforced everywhere**: eligibility, market rendering, and dead-
  market detection all respect the 4-overseas-player limit — even a fully greedy
  best-XI draft is correctly capped at exactly 4.
- Stress-tested over 6,000 aggressive-switching runs per formation across the
  full dataset — 100% completion, zero duplicate-player-name XIs, overseas cap
  never exceeded.
- **Balanced simulation:** win probability is a logistic function of the strength
  gap between your XI and an escalating rival. Tuned against the full dataset
  (post overseas-cap and cap-winner-boost) so a well-built XI is genuinely
  rewarded (Contender: ~40% chance of 7-0 for an elite XI) while a careless
  draft rarely succeeds, and Dynasty difficulty makes a perfect run a true
  achievement (~5% even for the best possible XI).
- **Scorecards** are generated consistently with each match's final score: batter
  run totals always sum exactly to the innings total, wickets never exceed 10,
  and bowling figures are attributed to whichever side actually bowled that
  innings (your real XI's bowlers when you bowled, fictional names for the
  abstract rival) — verified crash-free across 300 simulated Cup Runs.

Inspired by [7a0 (Sete a Zero)](https://7a0.org/en). Fan-made; not affiliated with
the IPL, BCCI, or any franchise. Player ratings are subjective and for entertainment.
