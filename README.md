# Unbeaten XI — Draft Your All-Time World Cup XI (1975–2023)

A cricket adaptation of the viral football game **[7a0 / Sete a Zero](https://7a0.org/en)**
(a World Cup draft simulator). You draw **national squads from every ODI Cricket
World Cup, 1975 to 2023** (13 editions), build an XI one pick at a time, then
enter a real 32-team World Cup format: **8 groups of 4** (you play all 3 group
matches regardless of any single result), then a **Round of 16, Quarter-Final,
Semi-Final, and Final** if you finish top 2 — each knockout match played out
one at a time on its own FIFA-style match-day screen — chasing a perfect,
unbeaten **7-0**.

Backend: Python standard library + SQLite, **zero `pip install`**, real World Cup
data for **every team in every edition** (143 team-editions, 2,050 players, 1975–2023).
Front-end: a full **React + TypeScript** app (Tailwind, Framer Motion, Zustand).

---

## How the game maps to 7a0

| 7a0 (football)                         | Unbeaten XI (this game)                      |
|----------------------------------------|----------------------------------------------|
| Draw a nation + World Cup year         | Draw a cricket nation + World Cup year (unchanged idea — the original game's own theme!) |
| That squad is your market              | Same — pick **one** player from it           |
| Fill a football formation (4-3-3, …)   | Fill the fixed cricket XI shape (2 Openers, 4 Middle-order, Keeper, 4 Bowlers) |
| Only 3 skips, one pick per turn        | 3 free switches **per pick**, one player per turn |
| Classic (ratings) vs Almanac (memory)  | Same two modes                               |
| Simulate a run; chase a **7-0**        | Real 32-team group + knockout format; win every match you play, up to 7, unbeaten |
| —                                      | Golden Bat / Golden Ball winners rate as the standout of that World Cup |
| —                                      | Knockout matches play out one at a time on a dedicated pre-match/live/result screen |
| —                                      | Tournament-wide Most Runs / Most Wickets leaderboard, across all 32 teams |

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

Set a different port with `PORT=9000 python server.py`. The server binds to
`127.0.0.1` by default — it's a single-player local game, so it isn't exposed
to the rest of your network unless you opt in with `HOST=0.0.0.0`.

For front-end development with hot reload: `cd web && npm run dev` (proxies
`/api` to `python server.py` running on port 8000).

## Hosting it publicly

The game is a single process (stdlib Python + a pre-built static front-end),
so it packages into one small Docker image — no database service, no
build step at runtime.

```bash
docker build -t unbeaten-xi .
docker run -p 8000:8000 unbeaten-xi
# open http://localhost:8000
```

**Free option: [Render](https://render.com)**, verified current as of this
writing — genuinely free to start (no credit card), and natively runs a
Dockerfile. This repo includes `render.yaml`, so Render → New → Blueprint →
select this repo deploys it with no dashboard configuration. The tradeoff:
the free tier sleeps after 15 minutes idle and takes about a minute to wake
on the next request — fine for sharing a link with friends, not for
something that needs to always be instantly up. (Fly.io and Railway were
also checked: Fly.io now requires a card and bills per usage since 2024;
Railway gives a one-time trial credit before it does too. Render was the
only one of the three still genuinely free for a small always-idle app.)

**Always-on option: any VPS** (a $4–6/month box from any provider works —
it only needs to run Docker, or just Python directly). Either run the image
above, or clone the repo and run `python server.py` behind a process
supervisor (`systemd`, `pm2`, etc.) so it restarts if it crashes or the box
reboots. Put a reverse proxy (Caddy or nginx) in front for HTTPS — the
stdlib server here speaks plain HTTP only.

**Before exposing it beyond your own machine**, know what you're opening up:
there's no login and no rate limiting, so anyone with the URL can play, and
on a shared host `/api/data` is plain unauthenticated JSON. Fine for a
personal/friends game; don't put anything sensitive behind it as-is.

**Static option: [Vercel](https://vercel.com)** — the front-end is a plain
Vite build with no server-side logic, so it also deploys as a pure static
site, no Python runtime involved at all. `web/public/data.json` is a
pre-exported, checked-in snapshot of the same dataset `/api/data` serves
(`python export_data.py` regenerates it after any `build_db.py` change), and
the front-end (`web/src/engine/data.ts`) already tries `/api/data` first and
falls back to `/data.json` when there's no live server to ask. This repo's
`vercel.json` points Vercel at the `web/` subfolder for the install/build
commands and output directory. To deploy: push to GitHub, then in Vercel
**Add New → Project → import this repo** — it picks up `vercel.json`
automatically, so no dashboard configuration is needed beyond connecting the
repo. Every deploy serves whatever `data.json` is currently committed, so
re-run `python export_data.py` and commit the result whenever `data_wc/`
changes.

### Tests

```bash
python -m unittest test_build_db     # dataset + rating-model invariants (stdlib only)
cd web && npm test                   # draft + simulation engine (vitest)
```

The engine has a lot of load-bearing invariants that are easy to break by
accident — cricket's chase rules, scorecard arithmetic, bracket propagation,
draft deadlock-freedom, the rarity of a 99 rating — so they're pinned down by
tests rather than re-checked by hand. The front-end suite runs against a real
snapshot of the dataset (`web/src/engine/__tests__/fixtures/dataset.json`),
since several invariants depend on the genuine distribution of position tags
across historical squads; regenerate it with `npm run fixture` (with the
server running) after changing `build_db.py`.

Both suites use seeded RNG, so a failure is always reproducible rather than
a one-in-a-thousand flake.

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
   * You're drawn into one of **8 groups of 4** (you + 3 real historical
     squads; the other 7 groups are 4 real squads each, filling out a genuine
     32-team World Cup). Every team plays every other team in its group once
     — **you play all 3 group matches regardless of any single result**,
     exactly like a real World Cup group; only the final table (points, then
     run difference) decides who advances.
   * **Top 2 in your group** advance to a **Round of 16**, crossed over
     against a qualifier from another group, real-tournament-style (group
     winners face a different group's runner-up). Win it, and you move
     through the **Quarter-Final**, **Semi-Final**, and **Final** — the rest
     of the 32-team bracket plays out in the background regardless of how far
     you get, so the field is always internally consistent.
   * Difficulty (Warm-up / Contender / Dynasty) controls how strong the real
     historical squads filling the whole 32-team World Cup are — Warm-up
     leans weaker sides, Dynasty is champion-calibre squads throughout.
   * **Group matches** render together on one screen, with a toss result,
     bat/bowl decision, and highlight for each.
   * **The knockouts get their own bracket screen** — a full Round of 16 →
     Quarter-Final → Semi-Final → Final tree, every match in it already
     resolved (the whole 32-team field, not just your path), with your route
     highlighted. Your own next match stays hidden until you click it, which
     pops up a FIFA-inspired match-day dialog **on top of** the bracket: a
     pre-match face-off (team badges, round banner, rival strength), a brief
     "Simulating…" moment, then a big scoreline reveal. Close it and the
     bracket updates with the real result, unlocking your next match if you
     won.
   * Open the **full ODI scorecard** (50-over batting + bowling lines for
     both sides, real bowler-over limits) for any match, group or knockout —
     the highlight text under every score is read directly off that same
     scorecard, so it can never disagree with the batting/bowling figures.
5. Win every match you play — up to seven — and lift the trophy unbeaten:
   the perfect 7-0. The Result screen shows your full group table (with the
   other 7 groups a click away), plus a **tournament-wide Most Runs / Most
   Wickets leaderboard** across all 32 teams and every match played, not just
   yours — a real "Golden Bat/Golden Ball race" for the whole World Cup.

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
    │   └── components/    # Setup / Draft / Style / Bracket (+ match-day popup) / Result screens, UI atoms
    └── dist/              # built static output — this is what server.py serves
```

## Database schema (SQLite)

- **countries** `(code, name, colour)`
- **editions** `(year, host, champion, runner_up, n_teams, golden_bat_player, golden_bat_team, golden_ball_player, golden_ball_team)`
- **squads** `(id, country, edition, display_name, finish)` — a drawable team-edition,
  `finish` is that team's final tournament position
- **players** `(id, squad_id, name, role, tier, bat, bowl, overall, captain, award, positions)`
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

### Flags

Nation flags are real artwork, not emoji: **emoji flags cannot work on
Windows**, which ships no glyphs for regional-indicator pairs and renders
`🇮🇳` as the bare letters "IN". Native 1:1 (square) SVGs from
[flag-icons](https://github.com/lipis/flag-icons) (MIT) are vendored into
`web/src/assets/flags/` — only the 18 the dataset needs, kept local so the
game still works offline. West Indies and East Africa are composite cricket
sides with no flag to source, so they get a drawn mark in their colours.
A test fails the build if a nation has no flag, if a flag exists for an
unknown code, if any vendored SVG isn't square, or if an emoji flag creeps
back into the UI.

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
- **Real 32-team group + knockout format, not a single-elimination gauntlet:**
  you're drawn into a genuine 4-team round-robin group and play out all 3
  matches no matter what happens in any one of them — only the final
  standings (points, then run difference) decide qualification, exactly like
  a real World Cup. The other 7 groups of 4 play out fully in the background,
  and the Round of 16 draw crosses group winners against a different group's
  runner-up. Every match's win probability is a logistic function of the
  strength gap between the two sides, so a well-built XI is genuinely
  rewarded while a careless draft rarely wins its group.
- **The entire bracket resolves consistently, whether or not you're in it:**
  a single generic knockout-bracket simulator plays every Round of 16,
  Quarter-Final, Semi-Final, and Final match — yours in full scorecard detail,
  everyone else's lightly — so the rest of the 32-team field is always
  internally consistent regardless of how far your own run goes, and the full
  bracket (every match, every round) is available to visualize, not just the
  handful of matches you personally played.
- **A real bracket screen, not just a match list:** the knockout stage renders
  as an actual Round of 16 → Final tree with every match already resolved
  except your own next one, which pops up as a FIFA-inspired match-day dialog
  over the bracket — closing it reveals the real result in place and unlocks
  your next match if you advanced.
- **Difficulty picks the field, not an escalating rival:** Warm-up, Contender,
  and Dynasty weight which real historical squads (rated from their own
  players' ratings) are drawn to fill the whole 32-team World Cup, from
  weaker sides to champion-calibre ones — Dynasty makes a perfect run a true
  achievement.
- **Tournament-wide stats leaderboard, grounded in the real scorecards:** for
  every match you play, the Most Runs/Most Wickets tally is read directly off
  the actual generated batting/bowling cards (never a separate fabrication),
  so the leaderboard and the highlight line under each score can never
  disagree with the full scorecard. Background AI-vs-AI matches (which never
  show a scorecard to anyone) still feed the leaderboard with a lighter
  standout-performance model.
- **Cricket-accurate chases:** the team batting second is generated *relative
  to* the target, not independently — a successful chase always lands just a
  realistic handful of runs past the target (the innings ends the instant the
  target is passed, so it can never look like a side "kept batting" long
  after winning), and a failed chase always finishes genuinely short. Every
  batter's and bowler's individual figures are reconciled to sum exactly to
  the innings' real ball count and run total — no independently-fabricated
  numbers that don't add up.
- **Real ODI scorecards:** 50-over innings, no bowler exceeds the real
  10-over limit, batter/bowler figures always sum exactly to the innings
  total and to the real overs faced, and realistic ODI strike rates and
  totals (~110-430 runs).
- **Opponents are real squads**, not fictional flavor text — every one of
  the 32 teams is a genuine team-edition from the dataset (excluding any you
  drafted from), using its actual players for every scorecard.
- **Your draft survives a refresh.** Progress (your XI, the current market,
  switches left, tournament results) is checkpointed to `localStorage`, so
  an accidental reload mid-draft doesn't throw away ten minutes of picking.
  The 280 KB dataset is never stored — it's always refetched from `/api/data`.
  Transient view state (a spinning "Simulating…", an open modal) is
  deliberately reset on load rather than restored mid-animation.
- **The server caches and compresses.** The dataset is immutable once
  `build_db.py` has run, so it's serialized once at startup and served from
  memory — 289 KB of JSON goes out as **33 KB gzipped**, and Vite's
  content-hashed assets get `immutable` caching while `index.html` stays
  uncached so a rebuild is picked up immediately.
- **Everything above is enforced by tests, not vibes** (`npm test` +
  `python -m unittest test_build_db`): group standings resolve to a unique
  ranking, the Round of 16 crossover is structurally correct, the bracket
  propagates real winners round to round, ball totals reconcile to the
  innings total, chase margins stay realistic, the leaderboard stays sorted,
  scorecards always sum, a 99 rating stays rare, all-rounder tags stay
  balanced, and a loss in any single group match never prematurely ends the
  tournament. The suites are mutation-checked — deliberately reintroducing
  each historical bug makes the corresponding test fail.

Inspired by [7a0 (Sete a Zero)](https://7a0.org/en). Fan-made; not affiliated
with the ICC, any cricket board, or any player. Ratings are subjective and for
entertainment.
