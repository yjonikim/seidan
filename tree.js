#!/usr/bin/env node
/* seidan tree.js — partnership screen ("is this person a tree?").
   Same engines as chart.js (astronomy-engine, lunar-javascript, iztro).

   Usage:
     npm install lunar-javascript iztro astronomy-engine
     node tree.js DATE TIME CLOCK_UTC_OFFSET STD_OFFSET LAT LON male|female [--name NAME]
                  [--line] [--self "DATE TIME CLOCK STD LAT LON GENDER"] [--selftest]
   TIME may be "-" when the birth time is unknown: noon is used, and every
   hour-dependent check (rising sign, houses, hour pillar, their ZWDS board)
   is skipped rather than guessed. LAT/LON may then be rough.
   Example (the control case the spec was built from):
     node tree.js 1963-04-12 19:31 -5 -5 40.7282 -73.7949 male --name Control
   --line      one-line summary only (for screening a roster in a loop)
   --self      screen against someone other than Joni (default subject below)
   --selftest  replays the control case and asserts the known findings

   WHAT IT TESTS (hypothesis v1, Nov 17 2026 — built from ONE control case:
   a long working relationship with high regard and low pay). The question is
   whether a person both rates the subject AND is structurally good for her
   money. Marks: [+] fits the spec, [-] repeats the control pattern, [.] info.

   WEIGHTING (Joni's ruling, same day): BaZi and ZWDS are the STRUCTURAL
   layers and the only ones tallied. Western synastry mostly describes how the
   other person FEELS to the subject — a pairing can feel wonderful and go
   badly — so the Western section prints with its marks but is not tallied.

   BaZi   — the other person's day master as a ROLE relative to the subject's:
            tree (Jia for a Yi subject; the classical "vine climbs the tree"),
            backer (resource element), payer (wealth element), peer/vine (same
            stem — peers split the same wealth), boss (officer element — to
            them the subject is the wealth), output (subject feeds them).
            The "tree" label is specific to a Yi Wood subject.
   ZWDS   — "birth year enters the chart": each person's lunar-year stem sends
            its four transformations into the other's board. Prosperity (lu)
            and obstruction (ji) are the two that matter. Obstruction in a
            palace also strikes the palace opposite it.
   West   — who feeds or blocks the subject's Jupiter (ruler of her Asc + MC),
            where their Saturn falls in her houses, and whose planets fall in
            whose 10th / 7th / 2nd / 8th.

   INTERPRETIVE RULES (ratified with Joni):
   - This is a hypothesis to score against people, not a rule. The tally is a
     sorting aid; it has no validated threshold.
   - Roster check on the day it was written: the cleanest result belonged to
     the one person on the roster who had offered to pay unprompted. A chart
     that reads "backer" by element alone can still carry most of the control
     pattern, so read the whole screen, never the role label by itself.
   - The whose-planets-in-whose-houses flags travel as a pack with the rising
     sign. Treat that pack as ONE fact, not five, and distrust it when the
     birth time is shaky.
   - Fan yin (day pillars in heaven-clash-earth-clash: the stems fight AND the
     branches clash) is the strongest single BaZi warning the screen prints.
   - Every transformation lands somewhere and ~30 aspects fall in orb between
     any two charts. Only pre-declared checks below count; don't add post-hoc.
   - Marks the subject sends into THEIR board print as info only and are not
     tallied, except the mutual Life-star check.
   - Same-sky caveat: people born the same year share year-stem results. */
"use strict";
const A = require("astronomy-engine");
const { Solar, LunarUtil } = require("lunar-javascript");
const { astro } = require("iztro");

const DEFAULT_SELF = { name: "Joni", date: "1988-08-18", time: "20:44", clockoff: 10, stdoff: 9,
                       lat: 37.5665, lon: 126.978, gender: "female" };

const D2R = Math.PI / 180, R2D = 180 / Math.PI, EPS = 23.4393 * D2R;
const SIGNS = ["Ari","Tau","Gem","Cnc","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
const fmt = (L) => `${Math.floor(L % 30)}°${String(Math.floor(((L % 30) % 1) * 60)).padStart(2, "0")}′ ${SIGNS[Math.floor(L / 30)]}`;
const sep = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"];

/* ---------- glosses (Joni can't read hanzi: every label prints in English) ---------- */
const STEM = { "甲":"Jia Wood","乙":"Yi Wood","丙":"Bing Fire","丁":"Ding Fire","戊":"Wu Earth","己":"Ji Earth",
               "庚":"Geng Metal","辛":"Xin Metal","壬":"Ren Water","癸":"Gui Water" };
const BRANCH = { "子":"Rat","丑":"Ox","寅":"Tiger","卯":"Rabbit","辰":"Dragon","巳":"Snake","午":"Horse",
                 "未":"Goat","申":"Monkey","酉":"Rooster","戌":"Dog","亥":"Pig" };
const PALACE = { "命宫":"Life","兄弟":"Siblings","夫妻":"Partner","子女":"Children","财帛":"Wealth","疾厄":"Health",
                 "迁移":"Travel","仆役":"Staff/Friends","官禄":"Career","田宅":"Property","福德":"Fortune","父母":"Parents" };
const STAR = { "紫微":"Emperor (Zi Wei)","天机":"Strategist (Tian Ji)","太阳":"Sun (Tai Yang)","武曲":"Wealth General (Wu Qu)",
               "天同":"Easy One (Tian Tong)","廉贞":"Lian Zhen","天府":"Treasury (Tian Fu)","太阴":"Moon (Tai Yin)",
               "贪狼":"Greedy Wolf (Tan Lang)","巨门":"Great Gate (Ju Men)","天相":"Minister (Tian Xiang)",
               "天梁":"Elder (Tian Liang)","七杀":"Seven Killings (Qi Sha)","破军":"Breaker (Po Jun)",
               "文昌":"writing star Wen Chang","文曲":"writing star Wen Qu","左辅":"Left Assistant","右弼":"Right Assistant" };
const OPPOSITE = { "命宫":"迁移","迁移":"命宫","财帛":"福德","福德":"财帛","官禄":"夫妻","夫妻":"官禄",
                   "兄弟":"仆役","仆役":"兄弟","子女":"田宅","田宅":"子女","疾厄":"父母","父母":"疾厄" };
/* four transformations by stem: [prosperity 禄, authority 权, recognition 科, obstruction 忌] (iztro default school) */
const SIHUA = { "甲":["廉贞","破军","武曲","太阳"], "乙":["天机","天梁","紫微","太阴"], "丙":["天同","天机","文昌","廉贞"],
                "丁":["太阴","天同","天机","巨门"], "戊":["贪狼","太阴","右弼","天机"], "己":["武曲","贪狼","天梁","文曲"],
                "庚":["太阳","武曲","太阴","天同"], "辛":["巨门","太阳","文曲","文昌"], "壬":["天梁","紫微","左辅","武曲"],
                "癸":["破军","巨门","太阴","贪狼"] };
const MARK = ["prosperity", "authority", "recognition", "obstruction"];
const ROLE = { "比肩":["peer / another vine", "-", "same stem: admiration by recognition, but peers split the same wealth"],
               "劫财":["the other-polarity peer", "+", "for a Yi subject this is Jia, the TREE the vine climbs"],
               "正印":["backer", "+", "resource element: feeds the subject"],
               "偏印":["backer", "+", "resource element: feeds the subject"],
               "正财":["payer", "+", "wealth element: this person IS money to the subject"],
               "偏财":["payer", "+", "wealth element: this person IS money to the subject"],
               "正官":["boss", "-", "officer element: to them the subject is the wealth"],
               "七杀":["boss", "-", "officer element (harsh form): to them the subject is the wealth"],
               "食神":["output", ".", "the subject feeds them"],
               "伤官":["output", ".", "the subject feeds them"] };
const CLASH = { "子":"午","午":"子","丑":"未","未":"丑","寅":"申","申":"寅","卯":"酉","酉":"卯","辰":"戌","戌":"辰","巳":"亥","亥":"巳" };
const COMBO = { "子":"丑","丑":"子","寅":"亥","亥":"寅","卯":"戌","戌":"卯","辰":"酉","酉":"辰","巳":"申","申":"巳","午":"未","未":"午" };

/* ---------- chart builder ---------- */
function bodyLon(name, t) {
  if (name === "Sun") return A.SunPosition(t).elon;
  if (name === "Moon") return A.EclipticGeoMoon(t).lon;
  return A.Ecliptic(A.GeoVector(A.Body[name], t, true)).elon;
}
function placidus(ramc, lat, asc, mc) {
  const raToEcl = (ra) => ((Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(EPS)) * R2D) + 360) % 360;
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
function build(p) {
  const timed = p.time && p.time !== "-";
  const [y, m, d] = p.date.split("-").map(Number);
  const [hh, mm] = timed ? p.time.split(":").map(Number) : [12, 0];
  const ut = new Date(Date.UTC(y, m - 1, d, hh, mm) - p.clockoff * 3600e3);
  const c = { name: p.name, timed, pos: {} };
  for (const b of BODIES) c.pos[b] = bodyLon(b, ut);
  if (!timed) delete c.pos.Moon;                       // Moon moves ~13°/day: unusable without a time
  const gast = A.SiderealTime(ut);
  if (timed) {
    const ramc = (((gast + p.lon / 15) * 15) % 360 + 360) % 360;
    c.mc = ((Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(EPS)) * R2D) + 360) % 360;
    c.asc = ((Math.atan2(Math.cos(ramc * D2R), -(Math.sin(ramc * D2R) * Math.cos(EPS) + Math.tan(p.lat * D2R) * Math.sin(EPS))) * R2D) + 360) % 360;
    c.cusps = placidus(ramc, p.lat, c.asc, c.mc);
  }
  /* true solar time for the Chinese systems (same routine as chart.js) */
  let ct;
  if (timed) {
    const ra = A.Equator(A.Body.Sun, ut, new A.Observer(p.lat, p.lon, 0), true, true).ra;
    const ha = ((gast * 15 + p.lon - ra * 15) % 360 + 360) % 360, tst = (ha / 15 + 12) % 24;
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
  c.yearStem = lunar.getYearGan();                    // lunar-year stem (ZWDS convention, matches iztro)
  if (timed) {
    const ti = ct.hh === 23 ? 12 : Math.floor((ct.hh + 1) / 2);
    c.zwds = astro.bySolar(`${ct.y}-${ct.m}-${ct.d}`, ti, p.gender, true, "zh-CN");
  }
  return c;
}
const placHouse = (c, L) => { if (!c.cusps) return null;
  for (let h = 1; h <= 12; h++) { const a = c.cusps[h], b = c.cusps[h === 12 ? 1 : h + 1];
    if ((L - a + 360) % 360 < (b - a + 360) % 360) return h; } return null; };
const wsHouse = (c, L) => ((Math.floor(L / 30) - Math.floor(c.asc / 30) + 12) % 12) + 1;
const starPalace = (z, star) => z.palaces.find(p => [...p.majorStars, ...p.minorStars].some(s => s.name === star));
const palaceStars = (p) => [...p.majorStars, ...p.minorStars].map(s => s.name);
const g = (map, k) => map[k] || k;
const ord = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

/* ---------- the screen ---------- */
function screen(self, them) {
  const out = { bazi: [], zwds: [], west: [], role: null };
  const add = (sec, tone, text) => out[sec].push([tone, text]);

  /* BaZi */
  const tg = LunarUtil.SHI_SHEN[self.dm + them.dm];
  const [role, tone, why] = ROLE[tg] || ["?", ".", ""];
  out.role = (tg === "劫财" && self.dm === "乙") ? "TREE" : role;
  add("bazi", tone, `Day master ${STEM[them.dm]} → ${out.role.toUpperCase()} (${why})`);
  if (them.pillars[2] === self.pillars[2]) add("bazi", "-", `Identical day pillar to ${self.name} (${STEM[them.dm]} ${BRANCH[them.dayBranch]}): maximum mirror`);
  if (CLASH[self.dayBranch] === them.dayBranch) {
    const rev = LunarUtil.SHI_SHEN[them.dm + self.dm];
    if (tg === "七杀" || rev === "七杀")
      add("bazi", "-", `FAN YIN: day pillars in heaven-clash-earth-clash (${STEM[tg === "七杀" ? them.dm : self.dm]} cuts ${STEM[tg === "七杀" ? self.dm : them.dm]}, ${BRANCH[self.dayBranch]} clashes ${BRANCH[them.dayBranch]}) — strongest BaZi warning here`);
    else add("bazi", "-", `Day branches clash (${BRANCH[self.dayBranch]} vs ${BRANCH[them.dayBranch]})`);
  }
  if (COMBO[self.dayBranch] === them.dayBranch) add("bazi", "+", `Day branches combine (${BRANCH[self.dayBranch]} + ${BRANCH[them.dayBranch]})`);
  add("bazi", ".", `Pillars (year month day hour): ${them.pillars.map(x => x ? `${STEM[x[0]].split(" ")[0]}-${BRANCH[x[1]]}` : "unknown").join(" | ")}`);

  /* ZWDS: them → self */
  const WORK = ["命宫", "财帛", "官禄"];
  const land = (stem, board, owner, sender, sec, scored) => {
    SIHUA[stem].forEach((star, i) => {
      const p = starPalace(board, star); if (!p) return;
      const here = palaceStars(p), opp = OPPOSITE[p.name];
      let t = ".", note = "";
      if (i === 0 && (WORK.includes(p.name) || WORK.includes(opp))) t = "+";
      if ((i === 1 || i === 2) && WORK.includes(p.name)) t = "+";
      if (i === 3) {
        if (WORK.includes(p.name)) t = "-";
        else if (WORK.includes(opp)) { t = "-"; note += ` — strikes ${owner}'s ${PALACE[opp]} palace opposite`; }
        const natalLu = [...p.majorStars, ...p.minorStars].find(s => s.name === star && s.mutagen === "禄");
        if (natalLu) note += ` — lands on the star carrying ${owner}'s own prosperity mark (flow gets tied up)`;
        if (star === "文曲" || star === "文昌") { t = "-"; note += " — the knot is ON a writing star"; }
        else if (here.includes("文曲") || here.includes("文昌")) note += " — a writing star lives in this palace";
      }
      add(sec, scored ? t : ".", `${sender}'s ${MARK[i]} → ${g(STAR, star)} in ${owner}'s ${PALACE[p.name]} palace${note}`);
    });
  };
  if (self.zwds) land(them.yearStem, self.zwds, self.name, them.name, "zwds", true);
  if (them.zwds && self.zwds) {
    land(self.yearStem, them.zwds, them.name, self.name, "zwds", false);   // info only: what the subject does for THEM
    const life = (z) => z.palaces.find(p => p.name === "命宫");
    const sL = life(self.zwds), tL = life(them.zwds);
    const a = sL.majorStars.some(s => s.name === SIHUA[them.yearStem][0]);
    const b = tL.majorStars.some(s => s.name === SIHUA[self.yearStem][0]);
    if (a && b) add("zwds", "+", "MUTUAL Life-star blessing: each one's prosperity mark lands on the other's Life star (the 'they think I'm amazing' signature — says nothing about pay)");
    else if (a) add("zwds", "+", `${them.name}'s prosperity lands on ${self.name}'s Life star (one-way admiration)`);
    else if (b) add("zwds", ".", `${self.name}'s prosperity lands on ${them.name}'s Life star (one-way: ${self.name} is good for them)`);
    const at = (z, br) => z.palaces.find(p => p.earthlyBranch === br).name;
    const pal = (n) => self.zwds.palaces.find(p => p.name === n).earthlyBranch;
    const sCareerIn = at(them.zwds, pal("官禄")), sLifeIn = at(them.zwds, pal("命宫")), tLifeIn = at(self.zwds, tL.earthlyBranch);
    add("zwds", sCareerIn === "财帛" ? "-" : ".", `${self.name}'s Career palace sits on ${them.name}'s ${PALACE[sCareerIn]} palace${sCareerIn === "财帛" ? " (her career lives in their wealth — control pattern)" : ""}`);
    add("zwds", ["官禄", "仆役"].includes(sLifeIn) ? "-" : ".", `${self.name}'s Life palace sits on ${them.name}'s ${PALACE[sLifeIn]} palace${sLifeIn === "官禄" ? " (she IS their career — control pattern)" : ""}`);
    add("zwds", ".", `${them.name}'s Life palace sits on ${self.name}'s ${PALACE[tLifeIn]} palace`);
  } else if (!them.zwds) add("zwds", ".", "No birth time: their own ZWDS board skipped (only their year-stem marks into the subject's board are shown)");

  /* Western */
  const J = self.pos.Jupiter;
  const ASP = [[0, "conjunct"], [60, "sextile"], [90, "square"], [120, "trine"], [180, "opposite"]];
  const aspect = (a, b, orb) => { const s = sep(a, b); for (const [ang, n] of ASP) if (Math.abs(s - ang) <= orb) return [n, Math.abs(s - ang)]; return null; };
  for (const b of ["Jupiter", "Venus", "Sun"]) { const x = aspect(them.pos[b], J, 5);
    if (x && ["conjunct", "trine", "sextile"].includes(x[0])) add("west", "+", `Their ${b} ${x[0]} ${self.name}'s Jupiter (${x[1].toFixed(1)}°): feeds the planet ruling her Asc + MC`); }
  for (const b of ["Moon", "Mars", "Saturn"]) { if (them.pos[b] === undefined) continue; const x = aspect(them.pos[b], J, 5);
    if (x && (["square", "opposite"].includes(x[0]) || (x[0] === "conjunct" && b !== "Moon")))
      add("west", "-", `Their ${b} ${x[0]} ${self.name}'s Jupiter (${x[1].toFixed(1)}°)${b === "Moon" ? ": their security needs pull against her growth (the control's signature)" : ""}`); }
  const hs = (L) => `${ord(placHouse(self, L))} Placidus / ${ord(wsHouse(self, L))} whole-sign`;
  const sh = placHouse(self, them.pos.Saturn);
  add("west", sh === 12 ? "-" : [10, 11].includes(sh) ? "+" : sh === 2 ? "-" : ".",
      `Their Saturn falls in ${self.name}'s ${hs(them.pos.Saturn)} house${sh === 12 ? " (hidden labor / invisibility — control pattern)" : [10, 11].includes(sh) ? " (structure for her career / patron house)" : sh === 2 ? " (constraint on her money)" : ""}`);
  for (const b of ["Sun", "Jupiter", "Venus"]) if ([10, 11].includes(placHouse(self, them.pos[b])))
    add("west", "+", `Their ${b} falls in ${self.name}'s ${ord(placHouse(self, them.pos[b]))} (makes her visible / acts as patron)`);
  if (placHouse(self, them.pos.Mars) === 6) add("west", "-", `Their Mars falls in ${self.name}'s 6th (they work her — control pattern)`);
  if (them.timed) {
    if (placHouse(self, them.mc) === 6) add("west", "-", `Their MC falls in ${self.name}'s 6th (their reputation = her daily labor — control pattern)`);
    const rs = SIGNS[Math.floor(them.asc / 30)];
    add("west", ".", `Their rising sign: ${fmt(them.asc)}`);
    const where = (pt, L) => [wsHouse(them, L), placHouse(them, L)];
    for (const [pt, L] of [["Sun", self.pos.Sun], ["Mercury", self.pos.Mercury]]) {
      const [w, pl] = where(pt, L);
      const t = (w === 10 || pl === 10) ? "-" : (w === 7 || pl === 7) ? "+" : ".";
      add("west", t, `${self.name}'s ${pt} falls in their ${ord(w)} whole-sign / ${ord(pl)} Placidus${t === "-" ? " (she is their public reputation — control pattern)" : t === "+" ? " (she lands as partner)" : ""}`);
    }
    for (const [pt, L] of [["MC", self.mc], ["Saturn", self.pos.Saturn]]) { const [w, pl] = where(pt, L);
      if (w === 2 || pl === 2) add("west", "-", `${self.name}'s ${pt} falls in their 2nd (her career lives in their wallet — control pattern)`); }
    const [jw, jp] = where("Jupiter", J);
    if (jw === 8 || jp === 8) add("west", "-", `${self.name}'s Jupiter falls in their 8th (what they owe others — control pattern)`);
  } else add("west", ".", "No birth time: rising sign, Moon and their houses skipped");
  /* tight contacts, information only */
  const selfPts = Object.assign({}, self.pos, { ASC: self.asc, MC: self.mc });
  const themPts = Object.assign({}, them.pos, them.timed ? { ASC: them.asc, MC: them.mc } : {});
  const tight = [];
  for (const [a, la] of Object.entries(themPts)) for (const [b, lb] of Object.entries(selfPts)) {
    const x = aspect(la, lb, 2); if (x) tight.push([x[1], `their ${a} ${x[0]} her ${b} ${x[1].toFixed(1)}°`]); }
  tight.sort((p, q) => p[0] - q[0]);
  if (tight.length) add("west", ".", `Contacts within 2° (info only, not scored): ${tight.map(t => t[1]).join("; ")}`);
  return out;
}

function tally(res, secs) {
  let plus = 0, minus = 0;
  for (const sec of secs) for (const [t] of res[sec]) { if (t === "+") plus++; if (t === "-") minus++; }
  return [plus, minus];
}
function report(self, them, line) {
  const res = screen(self, them), [plus, minus] = tally(res, ["bazi", "zwds"]), [wp, wm] = tally(res, ["west"]);
  const head = `${them.name}: ${res.role.toUpperCase()} (${STEM[them.dm]}), year stem ${STEM[them.yearStem].split(" ")[0]} | structural: fits ${plus}, flags ${minus} | felt (Western, not tallied): +${wp} / -${wm}${them.timed ? "" : " | NO BIRTH TIME"}`;
  if (line) { console.log(head); return res; }
  console.log(`=== TREE SCREEN: ${them.name} against ${self.name} ===`);
  console.log(head);
  for (const [sec, title] of [["bazi", "BaZi (structural)"], ["zwds", "ZWDS — birth year enters the chart (structural)"], ["west", "Western — how it feels (not tallied)"]]) {
    console.log(`\n-- ${title}`);
    for (const [t, text] of res[sec]) console.log(`  [${t}] ${text}`);
  }
  console.log("\nHypothesis v1 (n=1 control). Sorting aid, no validated threshold. See file header for rules.");
  return res;
}

/* ---------- CLI ---------- */
const argv = process.argv.slice(2);
const flag = (f) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null; };
const parse = (a, name) => ({ name, date: a[0], time: a[1], clockoff: parseFloat(a[2]), stdoff: parseFloat(a[3]),
                              lat: parseFloat(a[4]), lon: parseFloat(a[5]), gender: a[6] });
const selfArg = flag("--self");
const self = build(selfArg ? parse(selfArg.trim().split(/\s+/), "Subject") : DEFAULT_SELF);

if (argv.includes("--selftest")) {
  const assert = require("assert");
  const ctl = build(parse(["1963-04-12", "19:31", "-5", "-5", "40.7282", "-73.7949", "male"], "Control"));
  const res = screen(build(DEFAULT_SELF), ctl), all = [...res.bazi, ...res.zwds, ...res.west].map(x => x.join(" "));
  const has = (re) => all.some(s => re.test(s));
  const checks = [
    ["subject Asc ≈ 5°56′ Pisces", Math.abs(build(DEFAULT_SELF).asc - 335.93) < 0.25],
    ["subject day master Yi Wood", build(DEFAULT_SELF).dm === "乙"],
    ["control day master Yi Wood → peer/vine flagged", ctl.dm === "乙" && has(/^- Day master Yi Wood/)],
    ["control rising ≈ 5° Scorpio", Math.abs(ctl.asc - 215.05) < 0.5],
    ["control Moon opposite subject Jupiter flagged", has(/^- Their Moon opposite/)],
    ["control Saturn in subject's 12th flagged", has(/^- Their Saturn falls in Joni's 12th/)],
    ["control obstruction → Greedy Wolf in subject's Career flagged", has(/^- Control's obstruction → Greedy Wolf.*Career palace/)],
    ["mutual Life-star blessing found", has(/MUTUAL Life-star/)],
    ["subject Career palace on control's Wealth palace flagged", has(/^- Joni's Career palace sits on Control's Wealth/)],
    ["subject MC in control's 2nd flagged", has(/^- Joni's MC falls in their 2nd/)],
  ];
  for (const [label, ok] of checks) { assert(ok, "FAIL: " + label); console.log("ok —", label); }
  console.log(`\n${checks.length} checks passed`);
  process.exit(0);
}
const pos = argv.filter((a, i) => !a.startsWith("--") && !["--name", "--self"].includes(argv[i - 1]));
if (pos.length < 7) {
  console.error('Usage: node tree.js DATE TIME|- CLOCK_OFF STD_OFF LAT LON male|female [--name NAME] [--line] [--self "..."] [--selftest]');
  process.exit(1);
}
report(self, build(parse(pos, flag("--name") || "They")), argv.includes("--line"));
