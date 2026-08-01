# 7-0 World Cup — Draft Your All-Time XI (1975–2023)

A cricket adaptation of the viral football game **[7a0 / Sete a Zero](https://7a0.org/en)**
(a World Cup draft simulator). You draw **national squads from every ODI Cricket
World Cup, 1975 to 2023** (13 editions), build an XI one pick at a time, then
enter a real World Cup format: a 6-team group (you play all 5 group matches
regardless of any single result), then semi-final and final if you finish
top 2 — chasing a perfect, unbeaten **7-0**.

Backend: Python standard library + SQLite, **zero `pip install`**, real World Cup
data for **every team in every edition** (143 team-editions, 2,050 players, 1975–2023).
Front-end: a full **React + TypeScript** app (Tailwind, Framer Motion, Zustand).

---

## How the game maps to 7a0

| 7a0 (football)                         | 7-0 World Cup (this game)                    |
|----------------------------------------|----------------------------------------------|
| Draw a nation + World Cup year         | Draw a cricket nation + World Cup year (unchanged idea — the original game's own theme!) |
| That squad is your market              | Same — pick **one** player from it           |
| Fill a football formation (4-3-3, …)   | Fill the fixed cricket XI shape (2 Openers, 4 Middle-order, Keeper, 4 Bowlers) |
| Only 3 skips, one pick per turn        | 3 free switches **per pick**, one player per turn |
| Classic (ratings) vs Almanac (memory)  | Same two modes                               |
| Simulate a run; chase a **7-0**        | Real group + knockout format; win every match you play, up to 7, unbeaten |
| —                                      | Golden Bat / Golden Ball winners rate as the standout of that World Cup |

---

## Quick start

```bash
python build_db.py           # 1. build worldcup.db from the dataset (once)
cd web && npm install && npm run build && cd ..   # 2. build the React front-end (once)
python server.py             # 3. start the game server
# open http://localhost:8000
```

`server.py` auto-builds the database on first run if `worldcup.db` is missing. It
does **not** build the front-end automatically — that needs Node once (`npm run
build` in `web/`) because it compiles React/TypeScript into plain static files.
After that one-time build, running the game only needs Python — no Node required
at runtime, and the Python side still needs **zero pip installs**.

Set a different port with `PORT=9000 python server.py`.

For front-end development with hot reload: `cd web && npm run dev` (proxies
`/api` to `python server.py` running on port 8000).

---

## How to play

There is one XI shape, always: **2 Openers, 4 Middle-order, 1 Wicketkeeper,
4 Bowlers**. A player only fits a slot matching one of their tagged real-life
jobs (`Opener`, `Middle-order`, `Wicketkeeper`, `Bowler`) — this is the only
draft system in the game.

1. **Choose ratings mode**: *Classic* shows ratings; *Almanac* hides them — a
   memory test.
2. **Choose difficulty**: Warm-up / Contender / Dynasty (rival strength).
3. **Draft.** Each turn draws a country's World Cup squad **completely at
   random** — uniformly across all 143 squads, no hidden preference toward any
   finishing position. Pick one player who fits an open position slot.
   * A **player can be signed only once**, even if he played in multiple
     World Cups.
   * **Every pick gives you 3 switches**: *same World Cup, other team* or
     *same team, other World Cup*. Switch to any matching squad you haven't
     just declined this turn.
   * If a market has nothing you can use, "Draw a squad" becomes a free redraw
     — you're never stuck.
   * **You choose the slot** when a player fits more than one open position
     (a flexible batter tagged both Opener and Middle-order, or a genuine
     all-rounder who could bat or bowl) — the draft never silently picks
     for you.
   * **Your XI stays editable** after the pick: click the move icon on any
     signed player in the "Your XI" panel to shift them to any other slot
     they're tagged for — an empty one, or a swap with whoever's there, as
     long as that player is tagged back for the vacated slot too.
4. **Lock the XI**, pick a **match style** (Aggressive / Balanced / Defensive),
   and **simulate the tournament**:
   * You're drawn into a **6-team group** (you + 5 real historical squads).
     Every team plays every other team once — **you play all 5 group
     matches regardless of any single result**, exactly like a real World
     Cup group; only the final table decides who advances. A second,
     AI-only 6-team group plays out in parallel to produce your potential
     knockout opponents.
   * **Top 2 in your group** (ranked by points, then run difference)
     advance to the **Semi-Final** against a crossed-over qualifier from
     the other group. Win it, and you reach the **Final** against whoever
     won the other semi-final.
   * Difficulty (Warm-up / Contender / Dynasty) controls how strong the
     real historical squads filling the World Cup are — Warm-up leans
     weaker sides, Dynasty is champion-calibre squads throughout.
   * All matches render immediately — click any to expand the toss result,
     a randomised bat/bowl decision, and a highlight. Open the **full ODI
     scorecard** (50-over batting + bowling lines for both sides, real
     bowler-over limits) for any match. The Result screen also shows your
     full group table.
5. Win every match you play — up to seven — and lift the trophy unbeaten:
   the perfect 7-0.

---

## Project layout

```
7-0/
├── build_db.py         # loads data_wc/wc_*.json → builds worldcup.db (SQLite), computes ratings
├── server.py            # stdlib http.server + sqlite3; serves web/dist + /api/data
├── worldcup.db           # generated SQLite database
├── data_wc/
│   └── wc_YYYY.json      # one file per World Cup: every team, finish, full squad, Golden Bat/Ball
├── README.md
└── web/                  # React + TypeScript front-end (Vite)
    ├── src/
    │   ├── engine/        # pure game logic: draft, ratings, ODI simulation, scorecards
    │   ├── store/         # zustand game state
    │   └── components/    # Setup / Draft / Style / Result screens, UI atoms
    └── dist/              # built static output — this is what server.py serves
```

## Database schema (SQLite)

- **countries** `(code, name, colour)`
- **editions** `(year, host, champion, runner_up, n_teams, golden_bat_player, golden_bat_team, golden_ball_player, golden_ball_team)`
- **squads** `(id, country, edition, display_name, finish)` — a drawable team-edition,
  `finish` is that team's final tournament position
- **players** `(id, squad_id, name, role, sub_role, bat, bowl, overall, captain, award, positions)`
  — `award` is `'golden_bat'`, `'golden_ball'`, or `NULL`; `positions` is a
  comma-separated list of real-life job tags (see below)

Roles: `BAT`, `WK`, `ALL`, `BOWL`. Every World Cup 1975–2023 is covered with
**every team that played it** — including one-off and associate nations (East
Africa, Kenya, Netherlands, Canada, Namibia, Bermuda, UAE, Scotland, Ireland,
Afghanistan) — for **143 team-editions and 2,050 players** total, gathered from
Wikipedia/ESPNcricinfo.

There is deliberately **no "overseas player" concept** — unlike the domestic-
league version of this game, every World Cup squad is a single nation, so that
restriction doesn't apply here.

### How ratings actually work

A player's rating has **no dependency on how their team finished** the
tournament — a star performer knocked out in the group stage rates the same
as a star performer on the eventual champions. `build_db.py` builds each
rating from these data-grounded signals:

1. **Player tier that World Cup** (`star`/`key`/`role`/`squad`, tagged from
   their real individual impact that specific tournament) sets a base rating,
   and role (batter/keeper/all-rounder/bowler) shapes the bat/bowl split.
2. **The genuine historical strength of their nation that era.** Being the
   best player on a side that never competed with the top teams isn't the
   same achievement as being the best player for a traditional powerhouse —
   a `star` tag alone doesn't capture that gap, so it's scaled by each
   country's real relative standard across the World Cup era (traditional
   top-eight nations at 1.0, down to the weakest associate/affiliate sides
   around 0.35–0.45). This is what stops, say, an associate nation's
   long-serving captain from rating like an all-time great just because he
   was tagged his team's best player several times over.
3. **A single career-peak tournament, not a career-long plateau.** Every
   player's whole career (tier tags + Golden Bat/Ball wins, weighted by
   country strength) is turned into one legend score. That score only ever
   boosts rating in **one identified World Cup** — the tournament they won a
   Golden Bat/Ball in (or, lacking that, the `star`-tier World Cup their team
   went furthest in) — never anywhere else. So a genuine all-time great gets
   one unmistakable peak card for the one World Cup the world actually
   remembers them for, while every other tournament they played — even
   another `star` tag — rates on tier alone, clearly below their peak.
4. **99 is capped at the 4 single best legend scores in the whole 13-edition
   dataset.** Everyone else's peak tournament still gets boosted, it just
   tops out at 95 — a genuinely great career, one clear notch below the tiny
   handful of true GOAT cards (currently Sachin Tendulkar '03, Wasim Akram
   '92, Graham Gooch '87, and Mitchell Starc, whose back-to-back Golden Balls
   in '15/'19 both cross the line). Nobody is hand-picked; the cap is applied
   purely by ranking the computed legend scores.

None of this comes from a hand-picked list of "who counts as a legend" — every
signal is derived from data already in the dataset (tier tags, country, and
award wins across all 13 editions), so it stays consistent and defensible.

### Real-life position tags

Every player carries 1-2 tags from: `Opener`, `Middle-order`, `Wicketkeeper`,
`Bowler` — a deterministic, defensible reading of "what job would this player
realistically do," derived from role and rating (not literal historical
ball-by-ball batting-position data, which doesn't exist at this scale). A
slot in the fixed XI requires an exact tag match; all-rounders carry
whichever tag(s) their batting/bowling is genuinely strong enough to earn,
so a real all-rounder can fit either a Middle-order or a Bowler slot.

The UI shows each squad's finish ("🏆 Champions", "🥈 Runners-up", "Finished
6th"...) and flags award-winning players with a Golden Bat/Golden Ball badge.

## Extending the data

Add a new `data_wc/wc_YYYY.json` following the existing files' schema (teams,
finish, players with role/tier/captain, plus top-level `golden_bat`/`golden_ball`
`{player, team}` objects), then re-run `python build_db.py` — it picks up every
file in `data_wc/` automatically and validates that both award winners are found
in the squad data.

---

## Design notes / correctness

- **Deadlock-proof draft:** the draw picks uniformly at random across every
  squad (no eligibility pre-filter — that skews draws toward lower-table teams
  over the course of a draft, since podium finishes are a small minority of all
  squads). An occasional dead market gets a free, uncosted redraw instead.
- **Squads aren't consumed after one pick** — the same team-edition can
  reappear on a later turn (with whichever of its players remain unclaimed),
  keeping the full 143-squad pool in play for the whole draft.
- Stress-tested across the full 1975-2023 dataset — 100% completion, zero
  duplicate-player-name XIs, position tags always honored.
- **Real group + knockout format, not a single-elimination gauntlet:** you're
  drawn into a genuine 6-team round-robin group and play out all 5 matches no
  matter what happens in any one of them — only the final standings (points,
  then run difference) decide qualification, exactly like a real World Cup.
  A parallel AI-only group produces the crossed-over knockout opponents. Every
  match's win probability is a logistic function of the strength gap between
  the two sides, so a well-built XI is genuinely rewarded while a careless
  draft rarely wins its group.
- **Difficulty picks the field, not an escalating rival:** Warm-up, Contender,
  and Dynasty weight which real historical squads (rated from their own
  players' ratings) are drawn to fill the rest of the World Cup, from weaker
  sides to champion-calibre ones — Dynasty makes a perfect run a true
  achievement.
- **Real ODI scorecards:** 50-over innings, no bowler exceeds the real
  10-over limit, batter/bowler figures always sum exactly to the innings
  total, and realistic ODI strike rates and totals (~110-430 runs).
- **Opponents are real squads**, not fictional flavor text — every team in
  your group and the parallel group is a genuine team-edition from the
  dataset (excluding any you drafted from), using its actual players for
  every scorecard.
- Stress-tested across hundreds of simulated tournaments and difficulty/style
  combinations: group standings always resolve to a unique ranking, the top-2
  crossover into the semi-final is always structurally correct, batter/bowler
  scorecards always sum consistently, and a loss in any single group match
  never prematurely ends the tournament.

Inspired by [7a0 (Sete a Zero)](https://7a0.org/en). Fan-made; not affiliated
with the ICC, any cricket board, or any player. Ratings are subjective and for
entertainment.
