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
