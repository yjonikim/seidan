/* seidan shadbala.js — six-fold planetary strength (Parashara), shared by chart.js (Node) and the site.
   Pure functions; the astronomy engine is passed in, as in extras.js.

   REFERENCE
   Validated against the Shadbala table of onlinejyotish.com on four charts (fixtures-shadbala.json): every
   component within 0.2 virupa. The defaults below are that site's conventions, worked out by fitting and then
   confirmed on charts that were not used for the fit. PyJHora 5.0.5 was the first reference tried and was
   dropped for shadbala: it does not fold arcs over 180 degrees, so its Dig and Cheshta come out wrong.
   Two defaults rest on a single observation each and are marked (1 chart) below.

   CONVENTIONS (virupas; 60 virupas = 1 rupa). `--sb` switches in chart.js are given in brackets.
   Sthana     Uchcha (arc from debilitation / 3) + Saptavargaja + Ojayugma + Kendradi + Drekkana.
              Saptavargaja over D1 D2 D3 D7 D9 D12 D30, BPHS values: moolatrikona 45 (D1 only), own 30,
              great friend 20, friend 15, neutral 10, enemy 4, great enemy 2 [raman-values: 22.5/15/7.5/3.75/1.875].
              Friendship is compound: natural plus temporary, the temporary part read from the rasi chart.
              The whole moolatrikona sign counts (1 chart) [degree-moola: only the classical degree span].
              Drekkana: Sun, Mars, Jupiter in the first decan; Mercury, Saturn in the second; Moon, Venus in the third.
   Dig        Arc from the powerless point / 3: Sun and Mars from the IC, Jupiter and Mercury from the
              descendant, Moon and Venus from the MC, Saturn from the ascendant. Real MC, not the 10th sign.
   Kala       Nathonnatha from the Sun's hour angle (true solar time).
              Paksha: Moon-Sun distance / 3 to Moon, Mercury, Jupiter, Venus; the rest of 60 to the others.
              Tribhaga: thirds of the day to Mercury, Sun, Saturn, thirds of the night to Moon, Venus, Mars; Jupiter always.
              Abda 15 and Masa 30 to the weekday lords of the first day of the running 360-day year and 30-day
              month, counted in days from the Surya Siddhanta epoch. Vara 45 to the weekday lord, the day running
              from sunrise. Hora 60 to the lord of the planetary hour, unequal hours [equal-hora: 60-minute hours].
              Ayana by the BPHS khandas 45/33/12 [declination: the true declination curve].
              [double: the Sun's Ayana and the Moon's Paksha doubled, as B.V. Raman does; the reference does not.]
              Yuddha: see the note in compute().
   Cheshta    Sun = its Ayana, Moon = its Paksha. Others: (sighrocha - (mean + true)/2), folded to 0..180, / 3,
              mean longitudes from Raman's 1900 epoch table [modern-mean: modern mean elements; moves Mercury most].
   Naisargika Fixed: Sun 60, Moon 51.43, Venus 42.86, Jupiter 34.29, Mercury 25.71, Mars 17.14, Saturn 8.57.
   Drik       BPHS sputa drishti. A quarter of every benefic aspect received, less a quarter of every malefic
              one, plus the whole of Jupiter's and Mercury's aspects. Malefic: Sun, Mars, Saturn, a waning Moon,
              and Mercury when it shares a sign with any of those or with a node.
   Not built  Ishta and Kashta phala, Bhava bala.
*/
(function () {
"use strict";
const IS_NODE = typeof module !== "undefined" && !!module.exports;
const P = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const D2R = Math.PI / 180, R2D = 180 / Math.PI, DAY = 864e5;
const n360 = (x) => ((x % 360) + 360) % 360;
const arc = (a, b) => { const d = n360(a - b); return d > 180 ? 360 - d : d; };

const LORD = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const EXALT = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200 };   /* sidereal degrees */
const MOOLA = { Sun: [4, 0, 20], Moon: [1, 3, 30], Mars: [0, 0, 12], Mercury: [5, 15, 20], Jupiter: [8, 0, 10], Venus: [6, 0, 15], Saturn: [10, 0, 20] };
const FRIEND = { Sun: ["Moon", "Mars", "Jupiter"], Moon: ["Sun", "Mercury"], Mars: ["Sun", "Moon", "Jupiter"], Mercury: ["Sun", "Venus"],
                 Jupiter: ["Sun", "Moon", "Mars"], Venus: ["Mercury", "Saturn"], Saturn: ["Mercury", "Venus"] };
const ENEMY = { Sun: ["Venus", "Saturn"], Moon: [], Mars: ["Mercury"], Mercury: ["Moon"], Jupiter: ["Mercury", "Venus"],
                Venus: ["Sun", "Moon"], Saturn: ["Sun", "Moon", "Mars"] };
const NAISARGIKA = { Sun: 60, Moon: 360 / 7, Mars: 120 / 7, Mercury: 180 / 7, Jupiter: 240 / 7, Venus: 300 / 7, Saturn: 60 / 7 };
const REQUIRED = { Sun: 390, Moon: 360, Mars: 300, Mercury: 420, Jupiter: 390, Venus: 330, Saturn: 300 };
const SAPTA = { bphs: [2, 4, 10, 15, 20], raman: [1.875, 3.75, 7.5, 15, 22.5] };

/* the seven vargas used by Saptavargaja: sign index for a sidereal longitude */
function sevenVargas(L) {
  const s = Math.floor(L / 30), d = L - s * 30, odd = s % 2 === 0;
  const part = (n) => Math.min(n - 1, Math.floor(d / (30 / n) + 1e-9));
  return [
    s,
    (d < 15) === odd ? 4 : 3,
    (s + 4 * part(3)) % 12,
    (s + (odd ? 0 : 6) + part(7)) % 12,
    Math.floor(L / (10 / 3) + 1e-9) % 12,
    (s + part(12)) % 12,
    (odd ? [0, 10, 8, 2, 6] : [1, 5, 11, 9, 7])[[5, 10, 18, 25, 30].findIndex((e, i) => d < (odd ? e : [5, 12, 20, 25, 30][i]))],
  ];
}

/* mean longitudes, mean equinox of date (Meeus, Astronomical Algorithms, table 31.A), T in Julian centuries from J2000 */
function meanLongitudes(T) {
  return {
    Sun: n360(280.46646 + 36000.76983 * T),
    Mercury: n360(252.250906 + 149474.0722491 * T),
    Venus: n360(181.979801 + 58519.2130302 * T),
    Mars: n360(355.433 + 19141.6964471 * T),
    Jupiter: n360(34.351519 + 3036.3027748 * T),
    Saturn: n360(50.077444 + 1223.5110686 * T),
  };
}

/* BPHS sputa drishti: strength (0..60) cast by `from` on a point `angle` degrees ahead of it.
   Base curve through 0@30, 15@60, 45@90, 30@120, 0@150, 60@180, 0@300. The three planets with special
   aspects follow their own curves around those aspects:
   Saturn (3rd, 10th)  0@30 -> 60@60 -> 45@90;  30@240 -> 60@270 -> 0@300
   Mars (4th, 8th)     15@60 -> 60@90 -> 30@120;  60 from 180 to 210 -> 30@240
   Jupiter (5th, 9th)  45@90 -> 60@120 -> 0@150;  45@210 -> 60@240 -> 15@270 */
function drishti(from, angle) {
  const a = n360(angle);
  if (from === "Saturn") {
    if (a >= 30 && a < 60) return 2 * (a - 30);
    if (a >= 60 && a < 90) return 45 + (90 - a) / 2;
    if (a >= 240 && a < 270) return 30 + (a - 240);
    if (a >= 270 && a < 300) return 2 * (300 - a);
  } else if (from === "Mars") {
    if (a >= 60 && a < 90) return 15 + 1.5 * (a - 60);
    if (a >= 90 && a < 120) return 60 - (a - 90);
    if (a >= 180 && a < 210) return 60;
    if (a >= 210 && a < 240) return 270 - a;
  } else if (from === "Jupiter") {
    if (a >= 90 && a < 120) return 45 + (a - 90) / 2;
    if (a >= 120 && a < 150) return 2 * (150 - a);
    if (a >= 210 && a < 240) return 45 + (a - 210) / 2;
    if (a >= 240 && a < 270) return 15 + 1.5 * (270 - a);
  }
  if (a < 30) return 0;
  if (a < 60) return (a - 30) / 2;
  if (a < 90) return a - 45;
  if (a < 120) return 30 + (120 - a) / 2;
  if (a < 150) return 150 - a;
  if (a < 180) return 2 * (a - 150);
  if (a < 300) return (300 - a) / 2;
  return 0;
}

/* mean longitudes from B.V. Raman's epoch table (sidereal; 1 Jan 1900, midnight at Ujjain), with his
   secular corrections. This is what the reference software uses for Cheshta. */
function meanLongitudesRaman(jd, year) {
  const days = jd - 2415020.5 + 76 / 360, y = year - 1900;
  return {
    Sun: n360(257.4568 + 0.9856 * days),
    Mars: n360(270.22 + 0.524 * days),
    Mercury: n360(164 + 4.0923 * days + 6.67 - 0.00133 * y),
    Jupiter: n360(220.04 + 0.0831 * days - 3.3 - 0.0067 * y),
    Venus: n360(328.51 + 1.60215 * days - 5 - 0.0001 * y),
    Saturn: n360(236.74 + 0.033439 * days + 5 + 0.001 * y),
  };
}

/* o: { ut:Date, lat, lon (east +), clockoff (hours), ayan, trop:{Sun..Saturn tropical longitudes}, asc, mc (tropical) }
   opts: { sapta:"bphs"|"raman", double:bool, mercury:"benefic"|"malefic", hora:"unequal"|"equal" } */
function compute(A, o, opts) {
  opts = Object.assign({ sapta: "bphs", double: false, mercury: "benefic", hora: "unequal", drik: "std" }, opts || {});
  const sid = {}; for (const p of P) sid[p] = n360(o.trop[p] - o.ayan);
  const lagna = n360(o.asc - o.ayan), lagnaS = Math.floor(lagna / 30);
  const sign = {}; for (const p of P) sign[p] = Math.floor(sid[p] / 30);
  const R = {}; const row = (k, f) => { R[k] = {}; for (const p of P) R[k][p] = f(p); };

  /* ---------- Sthana ---------- */
  row("uchcha", (p) => arc(sid[p], EXALT[p] + 180) / 3);
  const tempFriend = (p, q) => [1, 2, 3, 9, 10, 11].includes((sign[q] - sign[p] + 12) % 12);
  const rel = (p, q) => (FRIEND[p].includes(q) ? 1 : ENEMY[p].includes(q) ? -1 : 0) + (tempFriend(p, q) ? 1 : -1);
  const SV = SAPTA[opts.sapta];
  row("saptavargaja", (p) => {
    const v = sevenVargas(sid[p]); let sum = 0;
    v.forEach((s, i) => {
      const l = LORD[s], d = sid[p] % 30, m = MOOLA[p];
      if (i === 0 && s === m[0] && (opts.moola !== "degrees" || (d >= m[1] && d < m[2]))) sum += 45;
      else if (l === p) sum += 30;
      else sum += SV[rel(p, l) + 2];
    });
    return sum;
  });
  row("ojayugma", (p) => {
    const nav = sevenVargas(sid[p])[4], wantEven = p === "Moon" || p === "Venus";
    return ((sign[p] % 2 === 1) === wantEven ? 15 : 0) + ((nav % 2 === 1) === wantEven ? 15 : 0);
  });
  row("kendradi", (p) => { const h = (sign[p] - lagnaS + 12) % 12; return h % 3 === 0 ? 60 : h % 3 === 1 ? 30 : 15; });
  row("drekkana", (p) => { const k = Math.min(2, Math.floor((sid[p] % 30) / 10));
    return (["Sun", "Mars", "Jupiter"].includes(p) ? 0 : ["Mercury", "Saturn"].includes(p) ? 1 : 2) === k ? 15 : 0; });
  row("sthana", (p) => R.uchcha[p] + R.saptavargaja[p] + R.ojayugma[p] + R.kendradi[p] + R.drekkana[p]);

  /* ---------- Dig ---------- */
  const WEAK = { Sun: o.mc + 180, Mars: o.mc + 180, Jupiter: o.asc + 180, Mercury: o.asc + 180, Moon: o.mc, Venus: o.mc, Saturn: o.asc };
  row("dig", (p) => arc(o.trop[p], WEAK[p]) / 3);

  /* ---------- Kala ---------- */
  const t = o.ut.getTime(), T = (t / DAY + 2440587.5 - 2451545) / 36525;
  const eps = (23.4392911 - 0.0130042 * T) * D2R;
  const ra = (L) => n360(Math.atan2(Math.sin(L * D2R) * Math.cos(eps), Math.cos(L * D2R)) * R2D);
  const decl = (L) => Math.asin(Math.sin(eps) * Math.sin(L * D2R)) * R2D;
  const lst = n360((A.SiderealTime(o.ut) + o.lon / 15) * 15);
  const H = arc(lst, ra(o.trop.Sun));                                   /* Sun's distance from the meridian, 0 at noon, 180 at midnight */
  row("nathonnatha", (p) => p === "Mercury" ? 60 : ["Sun", "Jupiter", "Venus"].includes(p) ? (180 - H) / 3 : H / 3);
  const elong = n360(o.trop.Moon - o.trop.Sun), pk = (elong > 180 ? 360 - elong : elong) / 3;
  const benefic = (p) => p === "Jupiter" || p === "Venus" || p === "Moon" || (p === "Mercury" && opts.mercury === "benefic");
  row("paksha", (p) => (benefic(p) ? pk : 60 - pk) * (p === "Moon" && opts.double ? 2 : 1));
  /* day and night from true sunrise/sunset */
  const DAYR = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"], CH = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
  let tri = null, horaLord = null, varaLord = null, sunNote = "";
  try {
    const obs = new A.Observer(o.lat, o.lon, 0);
    const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, new Date(t - DAY), 2).date;
    const set = A.SearchRiseSet(A.Body.Sun, obs, -1, rise, 2).date;
    const isDay = t < set.getTime();
    const next = isDay ? null : A.SearchRiseSet(A.Body.Sun, obs, +1, set, 2).date;
    const a = isDay ? rise.getTime() : set.getTime(), b = isDay ? set.getTime() : next.getTime(), f = (t - a) / (b - a);
    tri = (isDay ? ["Mercury", "Sun", "Saturn"] : ["Moon", "Venus", "Mars"])[Math.min(2, Math.floor(f * 3))];
    const wd = new Date(rise.getTime() + o.clockoff * 3600e3).getUTCDay();
    varaLord = DAYR[wd];
    const idx = opts.hora === "equal" ? Math.floor((t - rise.getTime()) / 3600e3) : (isDay ? 0 : 12) + Math.min(11, Math.floor(f * 12));
    horaLord = CH[(CH.indexOf(varaLord) + idx) % 7];
  } catch (e) { sunNote = "no sunrise or sunset at this latitude/date: Tribhaga, Vara and Hora left at zero"; }
  row("tribhaga", (p) => p === "Jupiter" ? 60 : p === tri ? 60 : 0);
  /* year and month lords: the weekday lords of the first day of the running 360-day year and 30-day month,
     counted in civil days from the Surya Siddhanta epoch (creation), as in Raman's Graha and Bhava Balas */
  const jdn = Math.floor(t / DAY + 2440587.5 + 0.5 + o.lon / 360);      /* local civil day number */
  const ahar = 714402296627 + (jdn - 588466);
  const wdLord = (n) => DAYR[((n % 7) + 7 + (opts.aharShift || 0)) % 7];
  const abdaLord = wdLord(Math.floor(ahar / 360) * 360 + (opts.aharBase || 0)), masaLord = wdLord(Math.floor(ahar / 30) * 30 + (opts.aharBase || 0));
  row("abda", (p) => p === abdaLord ? 15 : 0);
  row("masa", (p) => p === masaLord ? 30 : 0);
  row("vara", (p) => p === varaLord ? 45 : 0);
  row("hora", (p) => p === horaLord ? 60 : 0);
  /* Ayana by the BPHS khandas: the planet's distance from the nearer equinox (bhuja, tropical) is turned into
     a 0..90 measure, 45 for the first sign, 33 for the second, 12 for the third; a third of it is added to 30
     in the favoured hemisphere and taken away in the other. North favours Sun, Mars, Jupiter, Venus; south
     favours Moon and Saturn; Mercury gains either way. opts.ayana = "declination" uses the true curve instead. */
  const khanda = (L) => { const x = n360(L) % 180, bh = x > 90 ? 180 - x : x;
    return bh < 30 ? 1.5 * bh : bh < 60 ? 45 + 1.1 * (bh - 30) : 78 + 0.4 * (bh - 60); };
  row("ayana", (p) => {
    const north = n360(o.trop[p]) < 180;
    const v = opts.ayana === "declination" ? Math.abs(decl(o.trop[p])) / 23.45 * 90 : khanda(o.trop[p]);
    const plus = p === "Mercury" ? true : ["Moon", "Saturn"].includes(p) ? !north : north;
    return (30 + (plus ? v : -v) / 3) * (p === "Sun" && opts.double ? 2 : 1);
  });
  row("yuddha", () => 0);
  const kalaSum = (p) => R.nathonnatha[p] + R.paksha[p] + R.tribhaga[p] + R.abda[p] + R.masa[p] + R.vara[p] + R.hora[p] + R.ayana[p];
  row("kala", (p) => kalaSum(p));

  /* ---------- Cheshta ---------- */
  const raman = opts.mean !== "modern";
  const M = raman ? meanLongitudesRaman(t / DAY + 2440587.5, o.ut.getUTCFullYear()) : meanLongitudes(T);
  const TL = raman ? sid : o.trop;                                      /* Raman's table is sidereal, Meeus' elements tropical */
  row("cheshta", (p) => {
    if (p === "Sun") return R.ayana.Sun / (opts.double ? 2 : 1);
    if (p === "Moon") return R.paksha.Moon / (opts.double ? 2 : 1);
    const inferior = p === "Mercury" || p === "Venus";
    const mean = inferior ? M.Sun : M[p], sigh = inferior ? M[p] : M.Sun;
    const avg = n360(mean + (((TL[p] - mean + 540) % 360) - 180) / 2);
    return arc(sigh, avg) / 3;
  });

  /* ---------- Naisargika ---------- */
  row("naisargika", (p) => NAISARGIKA[p]);

  /* ---------- Drik ---------- */
  /* who counts as malefic when aspecting: Sun, Mars, Saturn; the Moon while waning; Mercury when it shares
     its sign with a malefic or a node (the reference treats Paksha differently: natural benefics only) */
  const jt = T, rahu = n360(125.04452 - 1934.136261 * jt + 0.0020708 * jt * jt - o.ayan), ketu = n360(rahu + 180);
  const waning = elong > 180;
  const withMercury = ["Sun", "Mars", "Saturn"].concat(waning ? ["Moon"] : []).map((q) => sign[q]).concat([Math.floor(rahu / 30), Math.floor(ketu / 30)]);
  const mercuryMalefic = opts.drikMercury ? opts.drikMercury === "malefic" : withMercury.includes(sign.Mercury);
  const moonMalefic = opts.drikMoon ? opts.drikMoon === "malefic" : waning;
  const dMal = (q) => q === "Sun" || q === "Mars" || q === "Saturn" || (q === "Mercury" && mercuryMalefic) || (q === "Moon" && moonMalefic);
  const DM = {}; for (const p of P) { DM[p] = {}; for (const q of P) DM[p][q] = q === p ? 0 : drishti(q, sid[p] - sid[q]); }
  row("drik", (p) => {
    let s = 0;
    for (const q of P) { if (q === p) continue; s += (dMal(q) ? -1 : 1) * DM[p][q] / 4; }
    return s + DM[p].Jupiter + DM[p].Mercury;
  });

  /* ---------- Yuddha (planetary war), booked under Kala ----------
     Two of the five star-planets within one degree. Default, as the reference does it (BPHS): the difference
     between the two planets' whole Shadbala goes to the victor and comes off the loser; the victor is the one
     earlier in the zodiac. opts.yuddha = "raman": the difference of Sthana + Dig + Kala, divided by the
     difference of the disc diameters, to the northern planet. */
  const DISC = { Mars: 9.4, Mercury: 6.6, Jupiter: 190.4, Venus: 16.6, Saturn: 158.0 }, W = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const wars = [], base = (p) => R.sthana[p] + R.dig[p] + R.kala[p] + R.cheshta[p] + R.naisargika[p] + R.drik[p];
  const B = {}; for (const p of W) B[p] = base(p);
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const a = W[i], b = W[j];
    if (arc(o.trop[a], o.trop[b]) >= 1) continue;
    let win, y;
    if (opts.yuddha === "raman") {
      const so = (p) => R.sthana[p] + R.dig[p] + R.kala[p], lat = (p) => A.Ecliptic(A.GeoVector(A.Body[p], o.ut, true)).elat;
      y = Math.abs(so(a) - so(b)) / Math.abs(DISC[a] - DISC[b]); win = lat(a) > lat(b) ? a : b;
    } else { y = Math.abs(B[a] - B[b]); win = n360(o.trop[b] - o.trop[a]) < 180 ? a : b; }
    const lose = win === a ? b : a;
    R.yuddha[win] += y; R.yuddha[lose] -= y; wars.push({ win, lose, virupas: y });
  }
  for (const p of P) R.kala[p] += R.yuddha[p];

  row("total", (p) => R.sthana[p] + R.dig[p] + R.kala[p] + R.cheshta[p] + R.naisargika[p] + R.drik[p]);
  row("rupas", (p) => R.total[p] / 60);
  row("ratio", (p) => R.total[p] / REQUIRED[p]);
  const rank = P.slice().sort((a, b) => R.ratio[b] - R.ratio[a]);
  return { parts: R, aspects: DM, lords: { abda: abdaLord, masa: masaLord, vara: varaLord, hora: horaLord, tribhaga: tri }, wars, rank, sunNote, opts, drikMalefics: P.filter(dMal) };
}

/* text report. full = also print the sub-parts of Sthana and Kala */
function report(A, o, opts, full) {
  const r = compute(A, o, opts), R = r.parts, L = [];
  const AB = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa" };
  const line = (label, k, dp) => L.push("  " + label.padEnd(15) + P.map((p) => R[k][p].toFixed(dp === undefined ? 2 : dp).padStart(8)).join(""));
  L.push("Shadbala (virupas; 60 = 1 rupa):");
  L.push("  " + "".padEnd(15) + P.map((p) => AB[p].padStart(8)).join(""));
  if (full) { line("  uchcha", "uchcha"); line("  saptavargaja", "saptavargaja"); line("  ojayugma", "ojayugma"); line("  kendradi", "kendradi"); line("  drekkana", "drekkana"); }
  line("Sthana", "sthana"); line("Dig", "dig");
  if (full) { for (const k of ["nathonnatha", "paksha", "tribhaga", "abda", "masa", "vara", "hora", "ayana", "yuddha"]) line("  " + k, k); }
  line("Kala", "kala"); line("Cheshta", "cheshta"); line("Naisargika", "naisargika"); line("Drik", "drik"); line("Total", "total"); line("Rupas", "rupas");
  L.push("  " + "Required".padEnd(15) + P.map((p) => String(REQUIRED[p]).padStart(8)).join(""));
  L.push("  " + "% of required".padEnd(15) + P.map((p) => (R.ratio[p] * 100).toFixed(0).padStart(8)).join(""));
  L.push("  Rank by % of required: " + r.rank.map((p, i) => `${i + 1} ${p}`).join(" \u00B7 "));
  const lo = r.lords;
  L.push(`  Lords: year ${lo.abda} \u00B7 month ${lo.masa} \u00B7 weekday ${lo.vara || "?"} \u00B7 hora ${lo.hora || "?"} \u00B7 third of the ${["Mercury", "Sun", "Saturn"].includes(lo.tribhaga) ? "day" : "night"} ${lo.tribhaga || "?"}; malefic for Drik: ${r.drikMalefics.join(", ")}`);
  for (const w of r.wars) L.push(`  Planetary war: ${w.win} over ${w.lose}, ${w.virupas.toFixed(2)} virupas moved (inside Kala)`);
  if (r.sunNote) L.push("  " + r.sunNote);
  return L;
}

/* inputs straight from a birth moment (same formulas as chart.js): used by the tests and handy for scripts */
function inputsFor(A, ut, lat, lon, clockoff) {
  const bodyLon = (n) => n === "Sun" ? A.SunPosition(ut).elon : n === "Moon" ? A.EclipticGeoMoon(ut).lon : A.Ecliptic(A.GeoVector(A.Body[n], ut, true)).elon;
  const ramc = n360((A.SiderealTime(ut) + lon / 15) * 15), eps = 23.4393 * D2R;
  const mc = n360(Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(eps)) * R2D);
  const asc = n360(Math.atan2(Math.cos(ramc * D2R), -(Math.sin(ramc * D2R) * Math.cos(eps) + Math.tan(lat * D2R) * Math.sin(eps))) * R2D);
  const jt = (ut.getTime() / DAY + 2440587.5 - 2451545) / 36525, ayan = 23.85306 + (5028.796195 * jt + 1.1054348 * jt * jt) / 3600;
  const trop = {}; for (const p of P) trop[p] = bodyLon(p);
  return { ut, lat, lon, clockoff, ayan, trop, asc, mc };
}

const API = { compute, report, inputsFor, drishti, sevenVargas, meanLongitudes, meanLongitudesRaman, PLANETS: P, REQUIRED };
if (IS_NODE) module.exports = API; else window.SeidanShadbala = API;
})();
