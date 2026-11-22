# Calculador

One-page natal chart instrument: Western (planets, Asc/MC, whole-sign houses),
BaZi four pillars, and Zi Wei Dou Shu — all computed in the browser, no server.

Engines (vendored as flat files, no CDN calls at runtime):
- **astronomy-engine** — planetary positions, sidereal time
- **lunar-javascript** — lunar calendar, four pillars, hidden stems
- **iztro** — ZWDS palace derivation

Saved charts live in the browser's localStorage on that device only.
Nothing is transmitted anywhere.

## Deploy (GitHub Pages, no terminal needed)

1. On github.com: **+** (top right) → **New repository** → name it
   `calculador`, Public, create.
2. On the new repo page, click the **“uploading an existing file”** link.
3. Drag in every file from this folder (or Choose your files → select all).
4. Press the green **Commit changes** button.
5. **Settings → Pages → Source: Deploy from a branch → main → Save.**
6. Wait ~1 minute: `https://YOURNAME.github.io/calculador/`

## Time zone fields (the one tricky part)

- **Clock UTC offset**: the offset on the wall clock at birth, *including* DST
  if it was in effect (Korea observed DST in 1987–88, so +10).
- **Standard offset**: the zone's normal offset without DST (+9 for Korea).
  BaZi and ZWDS use standard time by convention; Western uses the clock time.
  If no DST was in effect, the two fields are the same number.
- **True solar time** (on by default): corrects the BaZi/ZWDS hour for
  longitude within the time zone plus the equation of time. Seoul runs
  ~32 min ahead of the sun on a KST clock; near hour boundaries this can
  change the hour pillar. Uncheck to use plain standard time.

## Tests

Known-answer tests against a verified natal chart (all three systems):

```
npm install lunar-javascript iztro astronomy-engine && node run-tests.js
```

26 assertions covering pillars, palace placement, bureau, ten planetary
positions, Ascendant/MC, hour-branch indexing, and true-solar-time correction.

## Roadmap

- Placidus cusps (whole-sign only for now; Asc/MC already exact)
- Aspect grid + merge with the Transit Scanner (NOTICINGPUP ENGINE)
- Second fixture chart in the test suite
- Per-planet orb tables
- Minor/adjective stars toggle for ZWDS

## tree.js — partnership screen

`node tree.js DATE TIME|- CLOCK_OFF STD_OFF LAT LON male|female --name NAME [--line]`

Screens one person against Joni's chart (override with `--self`) across BaZi,
ZWDS and Western: do they rate her, and are they structurally good for her
money? `[+]` fits the spec, `[-]` repeats the pattern of the control case.
Use `-` for an unknown birth time. `--line` prints a one-line summary for
looping over a roster; `--selftest` replays the control. Hypothesis v1, built
from a single case: a sorting aid, not a validated score. Rules are in the
file header.

## synastry.js — two charts against each other

`node synastry.js DATE TIME|- CLOCK_OFF STD_OFF LAT LON male|female --name NAME [--only west,bazi,zwds,jyotish]`

Reads one person against Joni's chart (override with `--self "..."` and
`--selfname`). Where tree.js is a scored screen for one question, this is the
neutral listing: Western aspects with reception, house overlays and antiscia;
BaZi pillar-to-pillar relations, element gaps and the stars each chart assigns
to the other; ZWDS birth-year-enters-the-chart both ways; Jyotish ashtakoota
(36-point Moon matching) and Mangal dosha. Nothing is weighted except the
ashtakoota, which is a traditional points system. Use `-` for an unknown
birth time. `--selftest` runs 21 checks, including a published ashtakoota
example reproduced koota for koota. Conventions are in the file header.

## Blind test — chart-matching without knowing who is who

On the site: the **Blind test** tab. Tick three or more saved charts and press
*Build blind packet*. The page shuffles them, strips names and birth data,
and produces a text packet to paste to a reader. The answer key stays in that
browser. When the reader answers, pick their answers from the dropdowns and
press *Score and reveal key* for the hit count and the chance of doing that
well by luck.

The packet carries a commitment (a SHA-256 hash of the sealed key), so the
key shown at the end can be proven to be the one fixed at the start:

```
node blind.js verify "seidan-blind|A=...|salt=..." COMMITMENT
node blind.js score  "seidan-blind|A=...|salt=..." "A=Name,B=Name,C=Name"
node blind.js odds 5
node blind.js pack roster.json --out DIR     # same thing from the terminal
```

Two limits, both in the blind.js header: one test is one data point (3 of 3
happens by luck one time in six), and a chart's positions encode its birth
date, so the packet only blinds a reader who holds no birth data for the
people in it.
