# seidan 星団

One-page natal chart instrument, four systems side by side: Western (tropical,
traditional toolkit), BaZi four pillars, Zi Wei Dou Shu, and Jyotish (Lahiri).
Everything is computed in the browser. There is no server and nothing is
transmitted; saved charts live in that device's localStorage only.

Live: https://yjonikim.github.io/seidan/ (GitHub Pages, served from `main`).

Engines, vendored as flat files (no CDN calls at runtime):
- **astronomy-engine** — planetary positions, sidereal time
- **lunar-javascript** — lunar calendar, four pillars, hidden stems, luck pillars
- **iztro** — ZWDS palace derivation

## What is in it

| | Site | CLI (`chart.js`) |
|---|---|---|
| Western: planets, Asc/MC, whole-sign + Placidus, wheel | yes | yes (no wheel) |
| Dignities, sect, lots, profection | yes | yes |
| Natal aspects, traditional orbs, applying/separating | yes | yes |
| Solar phase (cazimi / combust / under the beams, oriental / occidental) | yes | yes |
| Hermetic lots, planetary day and hour, prenatal syzygy, Behenian stars | yes | yes |
| Transits to natal | yes | `--transit DATE` |
| Firdaria, secondary progressions, solar arc | yes | yes |
| Zodiacal releasing (L1 + L2, loosing of the bond), profection table | yes | yes |
| Solar return | for the as-of year | `--return YEAR` |
| Arabic lunar mansion of the Moon, and a finder for when the Moon is next in mansion N | yes (local time) | `--mansion N [--days D] [--tz OFFSET]` |
| BaZi: pillars, ten gods, hidden stems, luck pillars, 神煞 | yes | yes |
| BaZi: na yin, life stages, 胎元 / 命宮 / 身宮, relations inside the chart and with the current luck pillar and year | yes | yes |
| ZWDS board | yes | yes (`--full`, `--fly DATE`) |
| Jyotish: rasi + navamsa charts, nakshatras, vargas, chara karakas, yogas, vimshottari, panchanga, Sadhe Sati | yes | yes (no drawn charts) |
| As-of date for every "today" layer | date field by the Calculate button | `--asof DATE` |
| EN glosses for hanzi | toggle | hanzi only |
| Synastry | Synastry tab | `synastry.js` |
| Blind chart-matching test | Blind test tab | `blind.js` |
| Partnership screen | — | `tree.js` |

## CLI

```
npm install lunar-javascript iztro astronomy-engine
node chart.js DATE TIME CLOCK_UTC_OFFSET STD_OFFSET LAT LON male|female
              [--only west,bazi,zwds,jyotish,timing] [--asof DATE] [--transit DATE]
              [--return YEAR] [--fly DATE] [--full] [--std-time]
```

`--only` gates what prints, never what is computed. Full flag notes are in
the `chart.js` header. `extras.js` and `synastry.js` are loaded by both the
CLI and the site, so those layers print the same text in both places.

## Time zone fields (the one tricky part)

- **Clock UTC offset**: the offset on the wall clock at birth, *including* DST
  if it was in effect (Korea observed DST in 1987–88, so +10).
- **Standard offset**: the zone's normal offset without DST (+9 for Korea).
  If no DST was in effect, the two fields are the same number.
- **True solar time** (on by default; `--std-time` turns it off): corrects the
  BaZi/ZWDS hour for longitude within the time zone plus the equation of time.
  Seoul runs ~32 min ahead of the sun on a KST clock; near hour boundaries
  this can change the hour pillar.

## Conventions worth knowing

- Aspects: each planet has its own orb (Sun 15°, Moon 12°, Mercury and Venus
  7°, Mars 8°, Jupiter and Saturn 9°, outers 5°). Two planets are in aspect
  when they are within the mean of their two orbs. Angles take half the
  planet's orb. Ptolemaic aspects only.
- Solar phase: cazimi within 17′, combust within 8°30′, under the beams
  within 15°. Hermetic lots follow Paulus and reverse by night. Planetary
  hours are unequal hours from true sunrise and sunset at the birthplace.
- Behenian stars: computed for the chart's date from catalogue right
  ascension, declination and proper motion, through the same pipeline as the
  planets. Conjunction by longitude only, 1° orb. Checked against published
  longitudes for 2000, 2020 and 2050.
- Lunar mansions, each in its own system: Arabic manazil are 28 equal parts of
  the tropical zodiac from 0° Aries (mansion 3 = 25°43′ Aries to 8°34′
  Taurus); nakshatras are sidereal; the Chinese 宿 shown with BaZi is the
  almanac's day mansion, not a Moon position.
- Jyotish: Lahiri ayanamsa, mean-node Rahu, whole-sign houses, 365.25-day
  dasha year. Vargas follow Parashara (D2, D3, D4, D7, D9, D10, D12, D30).
- Zodiacal releasing: Valens' minor years, 360-day years, loosing of the bond
  after a full Level 2 circuit. Details in the `extras.js` header.
- ZWDS: iztro's default school. BaZi 天乙貴人: 甲戊庚 → 丑未.

## Tests

```
npm install lunar-javascript iztro astronomy-engine
node run-tests.js            # 60 assertions: two fixture charts, CLI output, extras, stars, mansions
node synastry.js --selftest  # 21 checks
node tree.js --selftest      # 10 checks
node blind.js --selftest     # 7 checks
```

## Not built yet

- Shadbala and ashtakavarga (held until they can be checked against a
  reference implementation)
- The rest of the sixteen vargas (D16, D20, D24, D27, D40, D45, D60)
- Adjective-star toggle for the ZWDS board on the site

## dlr.py — Da Liu Ren board caster

`python3 dlr.py YYYY-MM-DD HH:MM CLOCK_UTC_OFFSET LAT LON [--birth YYYY --gender f|m] [--question "..."]`

Pure Python, no installs. Casts the full board from a moment: day pillar and
voids, hour branch from true solar time, yue jiang from the Sun's longitude,
both plates, four lessons, the course-type cascade (all nine patterns), three
transmissions with hidden stems and the twelve generals, and optional
benming / xingnian overlays. School choices are documented in the file
header. `python3 dlr.py --selftest` replays the Oct 18, 2026 inaugural board
(15 checks). Its day pillars agree with lunar-javascript.

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
