#!/usr/bin/env node
/* seidan synastry.js — two charts read against each other, four systems.
   Same engines as chart.js (astronomy-engine, lunar-javascript, iztro).

   Usage:
     npm install lunar-javascript iztro astronomy-engine
     node synastry.js DATE TIME|- CLOCK_UTC_OFFSET STD_OFFSET LAT LON male|female [--name NAME]
                      [--self "DATE TIME CLOCK STD LAT LON GENDER"] [--selfname NAME]
                      [--only west,bazi,zwds,jyotish] [--selftest]
   The positional person is "B". "A" defaults to Joni; override with --self.
   TIME may be "-" when a birth time is unknown: noon is used and everything
   hour-dependent (rising sign, houses, Moon aspects, hour pillar, that
   person's ZWDS board) is skipped rather than guessed. The Jyotish Moon
   matching still runs if the Moon stays in one nakshatra AND sign all day.

   HOW THIS DIFFERS FROM tree.js: tree.js is a scored screen for one question
   (is this person good for the subject's money). synastry.js is the neutral
   instrument — it lists what is mechanically there and scores nothing except
   the Jyotish ashtakoota, which is a traditional points system in its own
   right. Reading is the astrologer's job.

   CONVENTIONS
   West    Ptolemaic aspects only. Orbs: conjunction/opposition 6°, trine/
           square 5°, sextile 4°, +2° when a luminary is involved. Pairs of
           two generational points (Uranus/Neptune/Pluto/Node) are skipped.
           Reception is tagged when one planet sits in the other's domicile or
           exaltation. Node is the mean node. Antiscia orb 1.5°.
   BaZi    True solar time for the hour (as chart.js). Relations are checked
           across all 16 pillar pairs; day×day prints first. Element counts
           are surface only (stem + branch main qi; hidden stems not counted).
           Three-harmony pairs are "half combos" — two of the three branches.
   ZWDS    "Birth year enters the chart" (太歲入卦): the other person's lunar
           year BRANCH picks the palace they sit in; their year STEM sends its
           four transformations into the board. iztro default school.
   Jyotish Lahiri, mean node, whole sign. Ashtakoota is the North Indian
           36-point Moon matching. Direction matters for Varna, Vashya and
           Gana: with a woman and a man, she takes the bride seat; otherwise A
           takes it and the swapped total is printed too. Gana and Vashya
           tables vary by source (here: Deva bride × Rakshasa groom = 0,
           Rakshasa bride × Deva groom = 1). Yoni uses the classical 14×14
           grid. VALIDATION: --selftest replays a published worked example
           (Shravana/Capricorn bride × Chitra/Virgo groom = 17.5) and matches
           it koota for koota. One example is not a full audit of every cell. */
(function () {
"use strict";
/* Runs in Node (CLI) and in the browser (the site's Synastry tab loads this same file). */
const IS_NODE = typeof module !== "undefined" && !!module.exports;
const A = IS_NODE ? require("astronomy-engine") : window.Astronomy;
const { Solar, LunarUtil } = IS_NODE ? require("lunar-javascript") : window;
const { astro } = IS_NODE ? require("iztro") : window.iztro;

const DEFAULT_SELF = { name: "Joni", date: "1988-08-18", time: "20:44", clockoff: 10, stdoff: 9,
                       lat: 37.5665, lon: 126.978, gender: "female" };

const D2R = Math.PI / 180, R2D = 180 / Math.PI, EPS = 23.4393 * D2R;
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const norm = (x) => ((x % 360) + 360) % 360;
const dm = (x) => { let d = Math.floor(x), m = Math.floor((x - d) * 60 + 1e-9); return `${d}°${String(m).padStart(2, "0")}′`; };
const fmt = (L) => `${dm(L % 30)} ${SIGNS[Math.floor(L / 30)]}`;
const sep = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const ord = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
const SEVEN = BODIES.slice(0, 7);
const GENERATIONAL = ["Uranus","Neptune","Pluto","Node"];

/* ---------- glosses (every hanzi label prints with English) ---------- */
const STEM = { "甲":"Jia Wood","乙":"Yi Wood","丙":"Bing Fire","丁":"Ding Fire","戊":"Wu Earth","己":"Ji Earth",
               "庚":"Geng Metal","辛":"Xin Metal","壬":"Ren Water","癸":"Gui Water" };
const BRANCH = { "子":"Rat","丑":"Ox","寅":"Tiger","卯":"Rabbit","辰":"Dragon","巳":"Snake","午":"Horse",
                 "未":"Goat","申":"Monkey","酉":"Rooster","戌":"Dog","亥":"Pig" };
const STEM_EL = { "甲":"wood","乙":"wood","丙":"fire","丁":"fire","戊":"earth","己":"earth","庚":"metal","辛":"metal","壬":"water","癸":"water" };
const BRANCH_EL = { "寅":"wood","卯":"wood","巳":"fire","午":"fire","辰":"earth","戌":"earth","丑":"earth","未":"earth",
                    "申":"metal","酉":"metal","亥":"water","子":"water" };
const TEN = { "比肩":"Friend (same element, same polarity — a peer)", "劫财":"Rob Wealth (same element, other polarity — rival or ally)",
              "食神":"Eating God (what I produce, gently)", "伤官":"Hurting Officer (what I produce, sharply)",
              "偏财":"Indirect Wealth (what I control — windfall)", "正财":"Direct Wealth (what I control — steady)",
              "七杀":"Seven Killings (what controls me — harsh)", "正官":"Direct Officer (what controls me — lawful)",
              "偏印":"Indirect Resource (what feeds me — unconventional)", "正印":"Direct Resource (what feeds me — nurturing)" };
const PALACE = { "命宫":"Life","兄弟":"Siblings","夫妻":"Partner","子女":"Children","财帛":"Wealth","疾厄":"Health",
                 "迁移":"Travel","仆役":"Staff/Friends","官禄":"Career","田宅":"Property","福德":"Fortune","父母":"Parents" };
const STAR = { "紫微":"Emperor (Zi Wei)","天机":"Strategist (Tian Ji)","太阳":"Sun (Tai Yang)","武曲":"Wealth General (Wu Qu)",
               "天同":"Easy One (Tian Tong)","廉贞":"Lian Zhen","天府":"Treasury (Tian Fu)","太阴":"Moon (Tai Yin)",
               "贪狼":"Greedy Wolf (Tan Lang)","巨门":"Great Gate (Ju Men)","天相":"Minister (Tian Xiang)",
               "天梁":"Elder (Tian Liang)","七杀":"Seven Killings (Qi Sha)","破军":"Breaker (Po Jun)",
               "文昌":"writing star Wen Chang","文曲":"writing star Wen Qu","左辅":"Left Assistant","右弼":"Right Assistant" };
const OPPOSITE = { "命宫":"迁移","迁移":"命宫","财帛":"福德","福德":"财帛","官禄":"夫妻","夫妻":"官禄",
                   "兄弟":"仆役","仆役":"兄弟","子女":"田宅","田宅":"子女","疾厄":"父母","父母":"疾厄" };
const SIHUA = { "甲":["廉贞","破军","武曲","太阳"], "乙":["天机","天梁","紫微","太阴"], "丙":["天同","天机","文昌","廉贞"],
                "丁":["太阴","天同","天机","巨门"], "戊":["贪狼","太阴","右弼","天机"], "己":["武曲","贪狼","天梁","文曲"],
                "庚":["太阳","武曲","太阴","天同"], "辛":["巨门","太阳","文曲","文昌"], "壬":["天梁","紫微","左辅","武曲"],
                "癸":["破军","巨门","太阴","贪狼"] };
const MARK = ["prosperity 禄", "authority 权", "recognition 科", "obstruction 忌"];
const gl = (map, k) => map[k] || k;
const gz = (x) => x ? `${STEM[x[0]].split(" ")[0]}-${BRANCH[x[1]]} ${x}` : "unknown";

/* ---------- chart builder ---------- */
function bodyLon(name, t) {
  if (name === "Sun") return A.SunPosition(t).elon;
  if (name === "Moon") return A.EclipticGeoMoon(t).lon;
  return A.Ecliptic(A.GeoVector(A.Body[name], t, true)).elon;
}
function placidus(ramc, lat, asc, mc) {
  const raToEcl = (ra) => norm(Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(EPS)) * R2D);
  function iter(offset, diurnal, frac) {
    let ra = ramc + offset;
    for (let i = 0; i < 40; i++) {
      const dec = Math.atan(Math.tan(EPS) * Math.sin(ra * D2R));
      const x = Math.tan(lat * D2R) * Math.tan(dec);
      if (Math.abs(x) > 1) return null;
      const ad = Math.asin(x) * R2D, sa = diurnal ? 90 + ad : 90 - ad;
      ra = diurnal ? ramc + sa * frac : ramc + 180 - sa * frac;
    }
    return raToEcl(ra);
  }
  const c11 = iter(30, true, 1 / 3), c12 = iter(60, true, 2 / 3), c2 = iter(120, false, 2 / 3), c3 = iter(150, false, 1 / 3);
  if ([c11, c12, c2, c3].some(c => c === null)) return null;
  const c = new Array(13);
  c[1] = asc; c[2] = c2; c[3] = c3; c[4] = (mc + 180) % 360; c[5] = (c11 + 180) % 360; c[6] = (c12 + 180) % 360;
  c[7] = (asc + 180) % 360; c[8] = (c2 + 180) % 360; c[9] = (c3 + 180) % 360; c[10] = mc; c[11] = c11; c[12] = c12;
  return c;
}
const ayanamsa = (t) => { const jt = (t.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
  return 23.85306 + (5028.796195 * jt + 1.1054348 * jt * jt) / 3600; };
const meanNode = (t) => { const jt = (t.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
  return norm(125.04452 - 1934.136261 * jt + 0.0020708 * jt * jt); };

function build(p) {
  const timed = !!p.time && p.time !== "-";
  const [y, m, d] = p.date.split("-").map(Number);
  const [hh, mm] = timed ? p.time.split(":").map(Number) : [12, 0];
  const ut = new Date(Date.UTC(y, m - 1, d, hh, mm) - p.clockoff * 3600e3);
  const c = { name: p.name, timed, gender: p.gender, pos: {}, ut };
  for (const b of BODIES) c.pos[b] = bodyLon(b, ut);
  c.pos.Node = meanNode(ut);
  const noonMoon = c.pos.Moon;
  if (!timed) delete c.pos.Moon;                       // ~13°/day: unusable for aspects without a time
  const gast = A.SiderealTime(ut);
  if (timed) {
    const ramc = norm((gast + p.lon / 15) * 15);
    c.mc = norm(Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(EPS)) * R2D);
    c.asc = norm(Math.atan2(Math.cos(ramc * D2R), -(Math.sin(ramc * D2R) * Math.cos(EPS) + Math.tan(p.lat * D2R) * Math.sin(EPS))) * R2D);
    c.cusps = placidus(ramc, p.lat, c.asc, c.mc);
    c.isDay = norm(c.pos.Sun - c.asc) >= 180;
  }
  /* true solar time for the Chinese systems (same routine as chart.js) */
  let ct;
  if (timed) {
    const ra = A.Equator(A.Body.Sun, ut, new A.Observer(p.lat, p.lon, 0), true, true).ra;
    const ha = norm(gast * 15 + p.lon - ra * 15), tst = (ha / 15 + 12) % 24;
    const lmt = new Date(ut.getTime() + (p.lon / 15) * 3600e3);
    let day = new Date(Date.UTC(lmt.getUTCFullYear(), lmt.getUTCMonth(), lmt.getUTCDate()));
    const lmtH = lmt.getUTCHours() + lmt.getUTCMinutes() / 60;
    if (tst - lmtH > 12) day = new Date(day.getTime() - 864e5);
    if (lmtH - tst > 12) day = new Date(day.getTime() + 864e5);
    ct = { y: day.getUTCFullYear(), m: day.getUTCMonth() + 1, d: day.getUTCDate(), hh: Math.floor(tst), mm: Math.floor((tst % 1) * 60) };
  } else ct = { y, m, d, hh: 12, mm: 0 };
  const lunar = Solar.fromYmdHms(ct.y, ct.m, ct.d, ct.hh, ct.mm, 0).getLunar(), ec = lunar.getEightChar();
  c.pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), timed ? ec.getTime() : null];
  c.dm = ec.getDay()[0]; c.dayBranch = ec.getDay()[1];
  c.void = lunar.getDayXunKong();
  c.yearStem = lunar.getYearGan(); c.yearBranch = lunar.getYearZhi();   // lunar-year (ZWDS convention, matches iztro)
  if (timed) {
    const ti = ct.hh === 23 ? 12 : Math.floor((ct.hh + 1) / 2);
    c.zwds = astro.bySolar(`${ct.y}-${ct.m}-${ct.d}`, ti, p.gender, true, "zh-CN");
  }
  /* sidereal layer */
  const ay = ayanamsa(ut), sid = (L) => norm(L - ay);
  c.sid = { ayan: ay, mars: sid(c.pos.Mars), venus: sid(c.pos.Venus) };
  if (timed) { c.sid.moon = sid(noonMoon); c.sid.lagna = sid(c.asc); }
  else {
    const t0 = new Date(Date.UTC(y, m - 1, d, 0, 0) - p.clockoff * 3600e3), t1 = new Date(t0.getTime() + 864e5);
    const a = norm(bodyLon("Moon", t0) - ayanamsa(t0)), b = norm(bodyLon("Moon", t1) - ayanamsa(t1));
    const nk = (L) => Math.floor(L / (360 / 27));
    c.sid.moonRange = [a, b];
    if (nk(a) === nk(b) && Math.floor(a / 30) === Math.floor(b / 30)) { c.sid.moon = sid(noonMoon); c.sid.moonStable = true; }
  }
  return c;
}
const placHouse = (c, L) => { if (!c.cusps) return null;
  for (let h = 1; h <= 12; h++) { const a = c.cusps[h], b = c.cusps[h === 12 ? 1 : h + 1];
    if ((L - a + 360) % 360 < (b - a + 360) % 360) return h; } return null; };
const wsHouse = (c, L) => ((Math.floor(L / 30) - Math.floor(c.asc / 30) + 12) % 12) + 1;

/* ================= WESTERN ================= */
const DOMICILE = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
const EXALT = { Sun:0, Moon:1, Mercury:5, Venus:11, Mars:9, Jupiter:3, Saturn:6 };
const ASP = [[0, "conjunct", 6], [180, "opposite", 6], [120, "trine", 5], [90, "square", 5], [60, "sextile", 4]];
const SIGNREL = { 1: "same sign", 2: "averse (2/12)", 3: "sextile", 4: "square", 5: "trine", 6: "averse (6/8)", 7: "opposition",
                  8: "averse (6/8)", 9: "trine", 10: "square", 11: "sextile", 12: "averse (2/12)" };
const HARM = { "same sign": "harmonious", sextile: "harmonious", trine: "harmonious", square: "discordant", opposition: "discordant" };
function points(c) {
  const p = Object.assign({}, c.pos);
  if (c.timed) { p.Asc = c.asc; p.MC = c.mc; }
  return p;
}
function receptions(aName, aBody, aLon, bName, bBody, bLon) {
  const out = [];
  const one = (hostN, host, guestN, guest, guestLon) => {
    if (!SEVEN.includes(host) || !SEVEN.includes(guest) || host === guest) return;
    const s = Math.floor(guestLon / 30);
    if (DOMICILE[s] === host) out.push(`${hostN}'s ${host} receives ${guestN}'s ${guest} (domicile)`);
    else if (EXALT[host] === s) out.push(`${hostN}'s ${host} receives ${guestN}'s ${guest} (exaltation)`);
  };
  one(bName, bBody, aName, aBody, aLon); one(aName, aBody, bName, bBody, bLon);
  return out;
}
function westAspects(a, b) {
  const pa = points(a), pb = points(b), hits = [];
  for (const [x, lx] of Object.entries(pa)) for (const [y, ly] of Object.entries(pb)) {
    if (GENERATIONAL.includes(x) && GENERATIONAL.includes(y)) continue;
    const s = sep(lx, ly), lum = ["Sun", "Moon"].includes(x) || ["Sun", "Moon"].includes(y);
    for (const [ang, name, orb] of ASP) {
      const o = Math.abs(s - ang);
      if (o <= orb + (lum ? 2 : 0)) { hits.push({ x, y, name, o, rec: receptions(a.name, x, lx, b.name, y, ly) }); break; }
    }
  }
  return hits.sort((p, q) => p.o - q.o);
}
function west(a, b) {
  const L = [];
  L.push("\n=== WESTERN (tropical) ===");
  const sect = (c) => c.timed ? (c.isDay ? "diurnal" : "nocturnal") : "sect unknown (no time)";
  L.push(`Sect: ${a.name} ${sect(a)}, ${b.name} ${sect(b)}`);
  L.push("Lights and angles by sign (Ptolemy's test of concord):");
  const pa = points(a), pb = points(b);
  for (const [x, y] of [["Sun","Sun"],["Moon","Moon"],["Sun","Moon"],["Moon","Sun"],["Asc","Asc"],["Venus","Mars"],["Mars","Venus"],["Venus","Venus"]]) {
    if (pa[x] === undefined || pb[y] === undefined) { L.push(`  ${a.name} ${x} – ${b.name} ${y}: skipped (needs a birth time)`); continue; }
    const sa = Math.floor(pa[x] / 30), sb = Math.floor(pb[y] / 30), rel = SIGNREL[((sb - sa + 12) % 12) + 1];
    L.push(`  ${a.name} ${x} (${SIGNS[sa]}) – ${b.name} ${y} (${SIGNS[sb]}): ${rel}${HARM[rel] ? ` [${HARM[rel]}]` : " [no sight of each other]"}`);
  }
  const hits = westAspects(a, b);
  L.push(`Aspects by degree, tightest first (${hits.length}):`);
  for (const h of hits)
    L.push(`  ${(a.name + " " + h.x).padEnd(16)} ${h.name.padEnd(9)} ${(b.name + " " + h.y).padEnd(16)} ${dm(h.o).padStart(6)}${h.rec.length ? "   [" + h.rec.join("; ") + "]" : ""}`);
  const overlay = (guest, host) => {
    if (!host.timed) return `  ${guest.name}'s planets in ${host.name}'s houses: skipped (${host.name} has no birth time)`;
    const parts = Object.entries(points(guest)).filter(([k]) => k !== "Node")
      .map(([k, lon]) => `${k} ${wsHouse(host, lon)}/${placHouse(host, lon) ?? "?"}`);
    return `  ${guest.name}'s planets in ${host.name}'s houses: ${parts.join(", ")}`;
  };
  L.push("House overlays (whole-sign / Placidus):");
  L.push(overlay(a, b)); L.push(overlay(b, a));
  const anti = [];
  for (const [x, lx] of Object.entries(pa)) for (const [y, ly] of Object.entries(pb)) {
    if (GENERATIONAL.includes(x) || GENERATIONAL.includes(y)) continue;
    const o1 = sep(norm(180 - lx), ly), o2 = sep(norm(360 - lx), ly);
    if (o1 <= 1.5) anti.push(`${a.name} ${x} antiscion = ${b.name} ${y} (${dm(o1)})`);
    if (o2 <= 1.5) anti.push(`${a.name} ${x} contra-antiscion = ${b.name} ${y} (${dm(o2)})`);
  }
  L.push(`Antiscia contacts (1.5°): ${anti.length ? anti.join("; ") : "none"}`);
  return { lines: L, hits };
}

/* ================= BAZI ================= */
const S_COMBO = { "甲己":"earth","乙庚":"metal","丙辛":"water","丁壬":"wood","戊癸":"fire" };
const S_CLASH = ["甲庚","乙辛","丙壬","丁癸"];
const B_COMBO = { "子":"丑","丑":"子","寅":"亥","亥":"寅","卯":"戌","戌":"卯","辰":"酉","酉":"辰","巳":"申","申":"巳","午":"未","未":"午" };
const B_CLASH = { "子":"午","午":"子","丑":"未","未":"丑","寅":"申","申":"寅","卯":"酉","酉":"卯","辰":"戌","戌":"辰","巳":"亥","亥":"巳" };
const B_HARM = { "子":"未","未":"子","丑":"午","午":"丑","寅":"巳","巳":"寅","卯":"辰","辰":"卯","申":"亥","亥":"申","酉":"戌","戌":"酉" };
const TRINES = [["申子辰","water"],["寅午戌","fire"],["巳酉丑","metal"],["亥卯未","wood"]];
const PUNISH = ["寅巳","巳申","寅申","丑戌","戌未","丑未","子卯","辰辰","午午","酉酉","亥亥"];
const pair = (table, x, y) => table.includes(x + y) || table.includes(y + x);
const GROUP = { "申":"a","子":"a","辰":"a","寅":"b","午":"b","戌":"b","巳":"c","酉":"c","丑":"c","亥":"d","卯":"d","未":"d" };
const TAOHUA = { a:"酉", b:"卯", c:"午", d:"子" }, YIMA = { a:"寅", b:"申", c:"亥", d:"巳" };
const TIANYI = { "甲":"丑未","戊":"丑未","庚":"丑未","乙":"子申","己":"子申","丙":"亥酉","丁":"亥酉","壬":"卯巳","癸":"卯巳","辛":"午寅" };
const HONGLUAN = { "子":"卯","丑":"寅","寅":"丑","卯":"子","辰":"亥","巳":"戌","午":"酉","未":"申","申":"未","酉":"午","戌":"巳","亥":"辰" };
const B12 = "子丑寅卯辰巳午未申酉戌亥";
const POS = ["year", "month", "day", "hour"];
function stemRel(x, y) {
  const k = S_COMBO[x + y] || S_COMBO[y + x];
  if (k) return `stems combine (${STEM[x].split(" ")[0]}+${STEM[y].split(" ")[0]} → ${k})`;
  if (pair(S_CLASH, x, y)) return `stems clash (${STEM[x]} vs ${STEM[y]})`;
  return null;
}
function branchRel(x, y) {
  const out = [], nm = `${BRANCH[x]}–${BRANCH[y]}`;
  if (B_COMBO[x] === y) out.push(`branches combine 六合 (${nm})`);
  if (B_CLASH[x] === y) out.push(`branches clash 冲 (${nm})`);
  if (B_HARM[x] === y) out.push(`branches harm 害 (${nm})`);
  if (pair(PUNISH, x, y)) out.push(`branches punish 刑 (${nm}${x === y ? ", self-punishment" : ""})`);
  if (x !== y) for (const [grp, el] of TRINES) if (grp.includes(x) && grp.includes(y)) out.push(`half three-harmony 三合 (${nm} → ${el})`);
  return out;
}
function elements(c) {
  const n = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of c.pillars) if (p) { n[STEM_EL[p[0]]]++; n[BRANCH_EL[p[1]]]++; }
  return n;
}
function bazi(a, b) {
  const L = [], found = [];
  L.push("\n=== BAZI (hour from true solar time) ===");
  for (const c of [a, b]) L.push(`${c.name.padEnd(8)} ${c.pillars.map((p, i) => `${POS[i]} ${gz(p)}`).join(" | ")}`);
  const tgAB = LunarUtil.SHI_SHEN[a.dm + b.dm], tgBA = LunarUtil.SHI_SHEN[b.dm + a.dm];
  L.push(`Day masters: ${a.name} ${STEM[a.dm]}, ${b.name} ${STEM[b.dm]}`);
  L.push(`  To ${a.name}, ${b.name} is ${tgAB} — ${gl(TEN, tgAB)}`);
  L.push(`  To ${b.name}, ${a.name} is ${tgBA} — ${gl(TEN, tgBA)}`);
  if (a.pillars[2] === b.pillars[2]) { found.push("fuyin"); L.push(`  Identical day pillars (${gz(a.pillars[2])}): fu yin 伏吟, the mirror`); }
  if (B_CLASH[a.dayBranch] === b.dayBranch && pair(S_CLASH, a.dm, b.dm)) { found.push("fanyin");
    L.push("  FAN YIN 反吟: day pillars clash in both stem and branch (heaven-clash-earth-clash)"); }
  L.push("Pillar-to-pillar relations (day×day first):");
  const order = [[2, 2]];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (!(i === 2 && j === 2)) order.push([i, j]);
  let any = false;
  for (const [i, j] of order) {
    const x = a.pillars[i], y = b.pillars[j]; if (!x || !y) continue;
    const rels = [stemRel(x[0], y[0]), ...branchRel(x[1], y[1])].filter(Boolean);
    if (i === 2 && j === 2 && !rels.length) { L.push(`  ${a.name} day × ${b.name} day: no combination, clash, harm or punishment`); continue; }
    if (rels.length) { any = true; found.push(...rels.map(r => `${i}${j}:${r}`));
      L.push(`  ${a.name} ${POS[i]} × ${b.name} ${POS[j]}: ${rels.join("; ")}`); }
  }
  if (!any) L.push("  (nothing else)");
  const ea = elements(a), eb = elements(b);
  L.push(`Elements on the surface (wood/fire/earth/metal/water): ${a.name} ${Object.values(ea).join("/")}   ${b.name} ${Object.values(eb).join("/")}`);
  for (const [x, ex, y, ey] of [[a, ea, b, eb], [b, eb, a, ea]])
    for (const el of Object.keys(ex)) if (ex[el] === 0)
      L.push(`  ${x.name} has no ${el}; ${y.name} carries ${ey[el]}${ey[el] >= 2 ? " (supplies it)" : ey[el] === 0 ? " (shared gap)" : ""}`);
  L.push("Stars each chart assigns to the other's year and day branch:");
  const stars = (x, y) => {
    const got = [];
    const targets = [[`${y.name}'s year branch ${BRANCH[y.pillars[0][1]]}`, y.pillars[0][1]], [`${y.name}'s day branch ${BRANCH[y.dayBranch]}`, y.dayBranch]];
    const xy = x.pillars[0][1];
    for (const [label, br] of targets) {
      if (TIANYI[x.dm].includes(br)) got.push(`${label} = nobleman 天乙貴人`);
      if (TAOHUA[GROUP[xy]] === br || TAOHUA[GROUP[x.dayBranch]] === br) got.push(`${label} = peach blossom 桃花`);
      if (YIMA[GROUP[xy]] === br || YIMA[GROUP[x.dayBranch]] === br) got.push(`${label} = travelling horse 驛馬`);
      if (HONGLUAN[xy] === br) got.push(`${label} = red phoenix 紅鸞`);
      if (B12[(B12.indexOf(HONGLUAN[xy]) + 6) % 12] === br) got.push(`${label} = heavenly joy 天喜`);
      if (x.void.includes(br)) got.push(`${label} falls in the void 空亡`);
    }
    L.push(`  In ${x.name}'s chart: ${got.length ? got.join("; ") : "none of the tracked set"}`);
    return got;
  };
  const sa = stars(a, b), sb = stars(b, a);
  if (!a.timed || !b.timed) L.push("  (hour pillar skipped where the birth time is unknown)");
  return { lines: L, tgAB, tgBA, found, sa, sb };
}

/* ================= ZWDS ================= */
const starPalace = (z, star) => z.palaces.find(p => [...p.majorStars, ...p.minorStars].some(s => s.name === star));
const lifeOf = (z) => z.palaces.find(p => p.name === "命宫");
function zwds(a, b) {
  const L = [], facts = {};
  L.push("\n=== ZWDS — birth year enters the chart 太歲入卦 ===");
  for (const c of [a, b]) {
    if (!c.zwds) { L.push(`${c.name}: no birth time, no board (their year stem and branch still enter the other's board)`); continue; }
    const lf = lifeOf(c.zwds);
    L.push(`${c.name}: ${c.zwds.fiveElementsClass}, Life palace in ${BRANCH[lf.earthlyBranch]} ${lf.earthlyBranch} — ${lf.majorStars.map(s => gl(STAR, s.name)).join(" + ") || "empty (borrow the opposite palace)"}`);
  }
  const enter = (guest, host) => {
    if (!host.zwds) return;
    const seat = host.zwds.palaces.find(p => p.earthlyBranch === guest.yearBranch);
    facts[`${guest.name}>${host.name}:seat`] = seat.name;
    L.push(`${guest.name} (year ${gz(guest.yearStem + guest.yearBranch)}) inside ${host.name}'s board:`);
    L.push(`  sits in ${host.name}'s ${PALACE[seat.name]} palace (${seat.majorStars.map(s => gl(STAR, s.name)).join(" + ") || "no major stars"})`);
    SIHUA[guest.yearStem].forEach((star, i) => {
      const p = starPalace(host.zwds, star); if (!p) return;
      const own = [...p.majorStars, ...p.minorStars].find(s => s.name === star && s.mutagen);
      facts[`${guest.name}>${host.name}:${i}`] = p.name;
      L.push(`  ${MARK[i]} → ${gl(STAR, star)} in ${host.name}'s ${PALACE[p.name]} palace` +
        (i === 3 ? ` (also strikes ${PALACE[OPPOSITE[p.name]]} opposite)` : "") +
        (own ? ` — that star already carries ${host.name}'s natal ${own.mutagen}` : ""));
    });
  };
  enter(b, a); enter(a, b);
  if (a.zwds && b.zwds) {
    const at = (z, br) => z.palaces.find(p => p.earthlyBranch === br).name;
    const la = lifeOf(a.zwds), lb = lifeOf(b.zwds);
    const pa = (z, n) => z.palaces.find(p => p.name === n).earthlyBranch;
    L.push("Palace overlays (same branch, two boards):");
    L.push(`  ${a.name}'s Life palace lies on ${b.name}'s ${PALACE[at(b.zwds, la.earthlyBranch)]} palace`);
    L.push(`  ${b.name}'s Life palace lies on ${a.name}'s ${PALACE[at(a.zwds, lb.earthlyBranch)]} palace`);
    L.push(`  ${a.name}'s Partner palace lies on ${b.name}'s ${PALACE[at(b.zwds, pa(a.zwds, "夫妻"))]} palace`);
    L.push(`  ${b.name}'s Partner palace lies on ${a.name}'s ${PALACE[at(a.zwds, pa(b.zwds, "夫妻"))]} palace`);
    const m1 = la.majorStars.some(s => s.name === SIHUA[b.yearStem][0]), m2 = lb.majorStars.some(s => s.name === SIHUA[a.yearStem][0]);
    facts.mutualLife = m1 && m2;
    if (m1 && m2) L.push("  Mutual Life-star blessing: each one's prosperity mark lands on a major star in the other's Life palace");
    else if (m1) L.push(`  ${b.name}'s prosperity mark lands in ${a.name}'s Life palace (one way)`);
    else if (m2) L.push(`  ${a.name}'s prosperity mark lands in ${b.name}'s Life palace (one way)`);
  }
  if (a.yearStem === b.yearStem) L.push("  Same year stem: both send identical marks — a cohort fact, not a personal one");
  return { lines: L, facts };
}

/* ================= JYOTISH ================= */
const RASI = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya","Tula","Vrischika","Dhanu","Makara","Kumbha","Meena"];
const NAKS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
              "Magha","P.Phalguni","U.Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
              "Mula","P.Ashadha","U.Ashadha","Shravana","Dhanishta","Shatabhisha","P.Bhadrapada","U.Bhadrapada","Revati"];
const NAK_LORD = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const GANA_OF = { 0:[0,4,6,7,12,14,16,21,26], 1:[1,3,5,10,11,19,20,24,25], 2:[2,8,9,13,15,17,18,22,23] };
const GANA_N = ["Deva", "Manushya", "Rakshasa"], NADI_N = ["Adi (vata)", "Madhya (pitta)", "Antya (kapha)"];
const NADI = [0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2];
const YONI = ["horse","elephant","sheep","serpent","serpent","dog","cat","sheep","cat","rat","rat","cow","buffalo","tiger",
              "buffalo","tiger","deer","deer","dog","monkey","mongoose","monkey","lion","horse","lion","cow","elephant"];
const YONI_ORDER = ["horse","elephant","sheep","serpent","dog","cat","rat","cow","buffalo","tiger","deer","monkey","mongoose","lion"];
const YONI_PTS = [   // classical grid: 4 same, 3 friendly, 2 neutral, 1 unfriendly, 0 sworn enemies
  [4,2,2,3,2,2,2,1,0,1,3,3,2,1], [2,4,3,3,2,2,2,2,3,1,2,3,2,0], [2,3,4,2,1,2,1,3,3,1,2,0,3,1], [3,3,2,4,2,1,1,1,1,2,2,2,0,2],
  [2,2,1,2,4,2,1,2,2,1,0,2,1,1], [2,2,2,1,2,4,0,2,2,1,3,3,2,1], [2,2,1,1,1,0,4,2,2,2,2,2,1,2], [1,2,3,1,2,2,2,4,3,0,3,2,2,1],
  [0,3,3,1,2,2,2,3,4,1,2,2,2,1], [1,1,1,2,1,1,2,0,1,4,1,1,2,1], [3,2,2,2,0,3,2,3,2,1,4,2,2,1], [3,3,0,2,2,3,2,2,2,1,2,4,3,2],
  [2,2,3,0,1,2,1,2,2,2,2,3,4,2], [1,0,1,2,1,1,2,1,1,1,1,2,2,4] ];
const VARNA_N = { 4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra" };
const J_LORD = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
const FRIEND = { Sun: { f: ["Moon","Mars","Jupiter"], e: ["Venus","Saturn"] }, Moon: { f: ["Sun","Mercury"], e: [] },
                 Mars: { f: ["Sun","Moon","Jupiter"], e: ["Mercury"] }, Mercury: { f: ["Sun","Venus"], e: ["Moon"] },
                 Jupiter: { f: ["Sun","Moon","Mars"], e: ["Mercury","Venus"] }, Venus: { f: ["Mercury","Saturn"], e: ["Sun","Moon"] },
                 Saturn: { f: ["Mercury","Venus"], e: ["Sun","Moon","Mars"] } };
const VASHYA_N = ["Chatushpada (quadruped)", "Manava (human)", "Jalachara (water)", "Vanachara (wild)", "Keeta (insect)"];
const VASHYA_PTS = [[2, 1, 1, 0.5, 1], [1, 2, 0.5, 0, 1], [1, 0.5, 2, 1, 1], [0, 0, 0, 2, 0], [1, 1, 1, 0, 2]];   // [bride][groom]
const GANA_PTS = [[6, 5, 0], [6, 6, 0], [1, 0, 6]];                                                                // [bride][groom]
function moonFacts(L) {
  const w = 360 / 27, i = Math.floor(L / w), sign = Math.floor(L / 30), deg = L % 30;
  const vashya = [0, 0, 1, 2, 3, 1, 1, 4, deg < 15 ? 1 : 0, deg < 15 ? 0 : 2, 1, 2][sign];
  return { L, i, sign, nak: NAKS[i], pada: Math.floor((L % w) / (w / 4)) + 1, lord: NAK_LORD[i % 9],
           gana: [0, 1, 2].find(g => GANA_OF[g].includes(i)), nadi: NADI[i], yoni: YONI[i],
           varna: [3, 2, 1, 4][sign % 4], vashya, rasiLord: J_LORD[sign] };
}
function ashtakoota(bride, groom) {
  const k = [];
  k.push(["Varna", groom.varna >= bride.varna ? 1 : 0, 1, `${VARNA_N[bride.varna]} / ${VARNA_N[groom.varna]}`]);
  k.push(["Vashya", VASHYA_PTS[bride.vashya][groom.vashya], 2, `${VASHYA_N[bride.vashya].split(" ")[0]} / ${VASHYA_N[groom.vashya].split(" ")[0]}`]);
  const tara = (from, to) => { const r = (((to - from + 27) % 27) + 1) % 9; return [3, 5, 7].includes(r) ? 0 : 1.5; };
  const t1 = tara(bride.i, groom.i), t2 = tara(groom.i, bride.i);
  k.push(["Tara", t1 + t2, 3, `counted each way: ${t1 ? "good" : "bad"} / ${t2 ? "good" : "bad"}`]);
  const yp = YONI_PTS[YONI_ORDER.indexOf(bride.yoni)][YONI_ORDER.indexOf(groom.yoni)];
  k.push(["Yoni", yp, 4, `${bride.yoni} / ${groom.yoni}${yp === 0 ? " — sworn enemies" : ""}`]);
  const rel = (x, y) => x === y ? 2 : FRIEND[x].f.includes(y) ? 2 : FRIEND[x].e.includes(y) ? 0 : 1;
  const r = [rel(bride.rasiLord, groom.rasiLord), rel(groom.rasiLord, bride.rasiLord)].sort((p, q) => q - p).join("");
  k.push(["Graha Maitri", { "22": 5, "21": 4, "11": 3, "20": 1, "10": 0.5, "00": 0 }[r], 5, `sign lords ${bride.rasiLord} / ${groom.rasiLord}`]);
  k.push(["Gana", GANA_PTS[bride.gana][groom.gana], 6, `${GANA_N[bride.gana]} / ${GANA_N[groom.gana]}`]);
  const dist = ((groom.sign - bride.sign + 12) % 12) + 1;
  const bad = [2, 12, 5, 9, 6, 8].includes(dist);
  k.push(["Bhakoot", bad ? 0 : 7, 7, `Moon signs ${dist}/${((12 - dist + 1) % 12) + 1} apart${bad ? " — BHAKOOT DOSHA" : ""}`]);
  k.push(["Nadi", bride.nadi === groom.nadi ? 0 : 8, 8, `${NADI_N[bride.nadi]} / ${NADI_N[groom.nadi]}${bride.nadi === groom.nadi ? " — NADI DOSHA" : ""}`]);
  return { k, total: k.reduce((s, x) => s + x[1], 0) };
}
function jyotish(a, b) {
  const L = [];
  L.push("\n=== JYOTISH (Lahiri; Moon-nakshatra matching) ===");
  const F = {};
  for (const c of [a, b]) {
    if (c.sid.moon === undefined) {
      const [x, y] = c.sid.moonRange;
      L.push(`${c.name}: no birth time and the Moon changes nakshatra or sign that day (${NAKS[Math.floor(x / (360 / 27))]} ${RASI[Math.floor(x / 30)]} → ${NAKS[Math.floor(y / (360 / 27))]} ${RASI[Math.floor(y / 30)]}) — matching skipped`);
      continue;
    }
    const f = F[c.name] = moonFacts(c.sid.moon);
    L.push(`${c.name}: Moon ${dm(f.L % 30)} ${RASI[f.sign]}, ${f.nak} pada ${f.pada} [${f.lord}]${c.sid.moonStable ? " (no birth time; nakshatra and sign hold all day, pada approximate)" : ""}` +
      `${c.timed ? ` · lagna ${RASI[Math.floor(c.sid.lagna / 30)]}` : ""}`);
    L.push(`   gana ${GANA_N[f.gana]} · nadi ${NADI_N[f.nadi]} · yoni ${f.yoni} · varna ${VARNA_N[f.varna]} · vashya ${VASHYA_N[f.vashya]}`);
  }
  let res = null;
  if (F[a.name] && F[b.name]) {
    const hetero = a.gender !== b.gender;
    const [bride, groom] = hetero ? (a.gender === "female" ? [a, b] : [b, a]) : [a, b];
    res = ashtakoota(F[bride.name], F[groom.name]);
    L.push(`Ashtakoota — ${bride.name} in the bride seat, ${groom.name} in the groom seat:`);
    for (const [n, pts, max, why] of res.k) L.push(`  ${n.padEnd(13)} ${String(pts).padStart(3)} / ${max}   ${why}`);
    L.push(`  TOTAL         ${res.total} / 36   (traditional floor for a match is 18)`);
    if (!hetero) { const sw = ashtakoota(F[groom.name], F[bride.name]);
      L.push(`  Seats swapped: ${sw.total} / 36 (Varna, Vashya and Gana are the directional ones)`); res.swapped = sw.total; }
  }
  const manglik = (c) => {
    const ms = Math.floor(c.sid.mars / 30), refs = [];
    if (c.timed) refs.push(["lagna", Math.floor(c.sid.lagna / 30)]);
    if (c.sid.moon !== undefined) refs.push(["Moon", Math.floor(c.sid.moon / 30)]);
    const hit = refs.map(([n, s]) => [n, ((ms - s + 12) % 12) + 1]).filter(([, h]) => [1, 2, 4, 7, 8, 12].includes(h));
    return { hit: hit.length > 0, unknown: !refs.length, text: `${c.name}: ${hit.length ? "Mars in H" + hit.map(([n, h]) => `${h} from ${n}`).join(", H") : refs.length ? "clear" : "unknown"}` };
  };
  const ma = manglik(a), mb = manglik(b);
  L.push(`Mangal dosha (Mars in 1/2/4/7/8/12 from lagna or Moon): ${ma.text}; ${mb.text}` +
    (ma.hit && mb.hit ? " — both carry it, traditionally read as cancelling" : (ma.hit !== mb.hit && !ma.unknown && !mb.unknown) ? " — one-sided" : ""));
  return { lines: L, res, F };
}

/* ================= report / CLI ================= */
function report(a, b, want) {
  const L = [];
  L.push(`=== SYNASTRY: ${a.name} × ${b.name} ===`);
  for (const c of [a, b]) L.push(`${c.name}: ${c.timed ? `Asc ${fmt(c.asc)}, ` : "NO BIRTH TIME, "}Sun ${fmt(c.pos.Sun)}${c.pos.Moon !== undefined ? `, Moon ${fmt(c.pos.Moon)}` : ""}`);
  for (const [key, fn] of [["west", west], ["bazi", bazi], ["zwds", zwds], ["jyotish", jyotish]])
    if (!want || want(key)) L.push(...fn(a, b).lines);
  L.push("\nMechanical listing: nothing above is weighted or scored except the ashtakoota. Conventions in the synastry.js header.");
  return L;
}
function run(a, b, want) { console.log(report(a, b, want).join("\n")); }
const API = { stemRel, branchRel, build, report, west, westAspects, bazi, zwds, jyotish, ashtakoota, moonFacts, DEFAULT_SELF };
if (IS_NODE) module.exports = API; else window.SeidanSynastry = API;

if (IS_NODE && require.main === module) {
  const argv = process.argv.slice(2);
  const VAL = ["--name", "--self", "--selfname", "--only"];
  const flag = (f) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null; };
  const parse = (x, name) => ({ name, date: x[0], time: x[1], clockoff: parseFloat(x[2]), stdoff: parseFloat(x[3]),
                                lat: parseFloat(x[4]), lon: parseFloat(x[5]), gender: x[6] });
  if (argv.includes("--selftest")) { selftest(parse); process.exit(0); }
  const ALIAS = { western: "west", vedic: "jyotish" }, KNOWN = ["west", "bazi", "zwds", "jyotish"];
  let only = null;
  if (argv.includes("--only")) {
    only = new Set((flag("--only") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).map(s => ALIAS[s] || s));
    for (const k of only) if (!KNOWN.includes(k)) { console.error(`Unknown --only section "${k}". Known: ${KNOWN.join(", ")}`); process.exit(1); }
    if (!only.size) { console.error("--only needs a list, e.g. --only bazi,zwds"); process.exit(1); }
  }
  const pos = argv.filter((x, i) => !VAL.includes(x) && !VAL.includes(argv[i - 1]) && x !== "--selftest");
  if (pos.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(pos[0])) {
    console.error('Usage: node synastry.js DATE TIME|- CLOCK_OFF STD_OFF LAT LON male|female [--name NAME] [--self "DATE TIME CLOCK STD LAT LON GENDER"] [--selfname NAME] [--only west,bazi,zwds,jyotish] [--selftest]');
    process.exit(1);
  }
  const selfArg = flag("--self");
  const a = build(selfArg ? parse(selfArg.trim().split(/\s+/), flag("--selfname") || "A") : DEFAULT_SELF);
  run(a, build(parse(pos, flag("--name") || "B")), (k) => !only || only.has(k));
}

function selftest(parse) {
  const assert = require("assert");
  const checks = [];
  const ok = (label, cond) => checks.push([label, cond]);
  const quiet = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
  const J = build(DEFAULT_SELF);
  /* control case: the same public fixture tree.js --selftest replays */
  const ctl = build(parse(["1963-04-12", "19:31", "-5", "-5", "40.7282", "-73.7949", "male"], "Control"));
  ok("subject Asc ≈ 5°56′ Pisces", Math.abs(J.asc - 335.93) < 0.25);
  ok("subject day pillar 乙巳, year stem 戊", J.pillars[2] === "乙巳" && J.yearStem === "戊");
  const w = west(J, ctl), bz = bazi(J, ctl), zw = zwds(J, ctl), jy = jyotish(J, ctl);
  ok("control Moon opposite subject Jupiter is in the aspect list", w.hits.some(h => h.x === "Jupiter" && h.y === "Moon" && h.name === "opposite"));
  ok("control is 比肩 (same day master) to subject", bz.tgAB === "比肩" && bz.tgBA === "比肩");
  ok("mutual Life-star blessing found (matches tree.js)", zw.facts.mutualLife === true);
  ok("control's obstruction lands in subject's Career palace (matches tree.js)", zw.facts["Control>Joni:3"] === "官禄");
  ok("subject Moon is sidereal Libra, Chitra pada 4 (matches chart.js)", jy.F.Joni.sign === 6 && jy.F.Joni.nak === "Chitra" && jy.F.Joni.pada === 4);
  /* a chart against itself */
  const self2 = build(Object.assign({}, DEFAULT_SELF, { name: "Twin" }));
  const ws = west(J, self2), js = jyotish(J, self2), bs = bazi(J, self2);
  ok("self × self: each of the seven conjunct itself at 0°", SEVEN.every(b => ws.hits.some(h => h.x === b && h.y === b && h.name === "conjunct" && h.o < 1e-9)));
  ok("self × self: fu yin flagged", bs.found.includes("fuyin"));
  ok("self × self: ashtakoota = 28 (all full except Nadi 0)", js.res.total === 28 && js.res.k.find(x => x[0] === "Nadi")[1] === 0);
  /* table integrity */
  ok("gana table covers all 27 nakshatras once", [0, 1, 2].flatMap(g => GANA_OF[g]).sort((p, q) => p - q).join() === [...Array(27).keys()].join());
  ok("nadi: 9 nakshatras each", [0, 1, 2].every(n => NADI.filter(x => x === n).length === 9));
  ok("yoni: 14 animals, each on 1–2 nakshatras", new Set(YONI).size === 14);
  const mf = (i) => moonFacts(i * (360 / 27) + 1);
  ok("kuta maxima reachable: Ashwini bride × Bharani groom scores 0 < x ≤ 36", (() => { const t = ashtakoota(mf(0), mf(1)).total; return t > 0 && t <= 36; })());
  ok("bhakoot 6/8 scores 0 (Aries Moon × Virgo Moon)", ashtakoota(moonFacts(5), moonFacts(155)).k.find(x => x[0] === "Bhakoot")[1] === 0);
  ok("sworn-enemy yoni scores 0 (Ashwini horse × Hasta buffalo)", ashtakoota(mf(0), mf(12)).k.find(x => x[0] === "Yoni")[1] === 0);
  ok("yoni grid is symmetric with 4s on the diagonal", YONI_PTS.every((r, i) => r.length === 14 && r[i] === 4 && r.every((v, j) => v === YONI_PTS[j][i])));
  { const ref = ashtakoota(moonFacts(290), moonFacts(175));   // published example: bride Shravana in Capricorn, groom Chitra in Virgo
    ok("reference example koota for koota: 1, 0.5, 3, 1, 4, 0, 0, 8", ref.k.map(x => x[1]).join() === "1,0.5,3,1,4,0,0,8");
    ok("reference example total 17.5 / 36", ref.total === 17.5); }
  /* unknown birth time */
  const nt = build(parse(["1990-03-03", "-", "-5", "-5", "40.7", "-74", "male"], "NoTime"));
  ok("no-time chart: no Asc, no Moon, no hour pillar, no board", nt.asc === undefined && nt.pos.Moon === undefined && nt.pillars[3] === null && !nt.zwds);
  ok("no-time chart runs end to end", (() => { quiet(() => run(J, nt, () => true)); return true; })());
  for (const [label, cond] of checks) { assert(cond, "FAIL: " + label); console.log("ok —", label); }
  console.log(`\n${checks.length} checks passed`);
}
})();
