/* seidan extras.js — second-tier techniques shared by chart.js (Node) and the site (browser).
   Every function is pure and returns an array of text lines; engines are passed in, so the
   same code runs in both places and the two cannot drift apart.

   CONVENTIONS
   Zodiacal releasing  Valens' minor years: Aries 15, Taurus 8, Gemini 20, Cancer 25, Leo 19,
                       Virgo 20, Libra 8, Scorpio 15, Sagittarius 12, Capricorn 27, Aquarius 30,
                       Pisces 12. Years of 360 days, months of 30. Level 2 starts in the Level 1
                       sign; after a full circuit (211 months) it jumps to the opposite sign
                       ("loosing of the bond", marked LB). Angular = 1st/4th/7th/10th sign from
                       the Lot of Fortune; the 10th is the usual "peak".
   Profections         Whole-sign from the Ascendant, one sign a year from each birthday.
   Solar return        Moment the Sun returns to its natal longitude, cast for the birthplace
                       unless another place is given. Whole-sign houses.
   BaZi extras         Na yin, the day master's twelve life stages, conception pillar and the
                       two palaces come straight from lunar-javascript. Relations use the same
                       tables as synastry.js. "Now" = the as-of date.
   Chara karakas       Seven-karaka scheme (Sun..Saturn), ranked by degree within the sign. */
(function () {
"use strict";
const IS_NODE = typeof module !== "undefined" && !!module.exports;
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const DOMICILE = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
const D2R = Math.PI / 180, R2D = 180 / Math.PI, EPS = 23.4393 * D2R, DAY = 864e5;
const n360 = (x) => ((x % 360) + 360) % 360;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const ym = (ms) => new Date(ms).toISOString().slice(0, 7);
const fmt = (L) => { const s = Math.floor(L / 30), d = L - s * 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60 + 1e-9)).padStart(2, "0")}′ ${SIGNS[s]}`; };
const ord = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

/* ---------------- zodiacal releasing ---------------- */
const ZR_YEARS = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12];
function zrLevel1(lotSign, birthMs, untilMs) {
  const out = []; let t = birthMs, s = lotSign;
  while (t < untilMs) { const end = t + ZR_YEARS[s] * 360 * DAY; out.push({ sign: s, start: t, end }); t = end; s = (s + 1) % 12; }
  return out;
}
function zrLevel2(l1) {
  const out = []; let t = l1.start, s = l1.sign, n = 0;
  while (t < l1.end) {
    const lb = n === 12;
    if (lb) s = (l1.sign + 6) % 12;                    /* loosing of the bond: jump to the opposite sign */
    const end = Math.min(t + ZR_YEARS[s] * 30 * DAY, l1.end);
    out.push({ sign: s, start: t, end, lb });
    t = end; s = (s + 1) % 12; n++;
  }
  return out;
}
function zodiacalReleasing(o) {     /* o: { fortune, spirit, ut:Date, asof:Date } */
  const L = [], now = o.asof.getTime(), fSign = Math.floor(o.fortune / 30);
  const ang = (s) => { const h = ((s - fSign + 12) % 12) + 1; return [1, 4, 7, 10].includes(h) ? ` [${ord(h)} from Fortune${h === 10 ? ", peak" : ""}]` : ""; };
  L.push(`Zodiacal releasing (as of ${ymd(now)}; 360-day years; LB = loosing of the bond):`);
  for (const [name, lot] of [["Spirit", o.spirit], ["Fortune", o.fortune]]) {
    const l1s = zrLevel1(Math.floor(lot / 30), o.ut.getTime(), Math.max(now, o.ut.getTime()) + 40 * 360 * DAY);
    const cur = l1s.find(p => now >= p.start && now < p.end) || l1s[0];
    L.push(`  From ${name} (${fmt(lot)}):`);
    L.push("    L1: " + l1s.map(p => `${SIGNS[p.sign]} ${ym(p.start)}${p === cur ? " ◀" : ""}`).join("  "));
    const l2s = zrLevel2(cur), i = Math.max(0, l2s.findIndex(p => now >= p.start && now < p.end));
    for (const p of l2s.slice(i, i + 5))
      L.push(`    L2: ${SIGNS[cur.sign]} / ${SIGNS[p.sign].padEnd(11)} ${ymd(p.start)} → ${ymd(p.end)}${p === l2s[i] ? "  ◀ now" : ""}${p.lb ? "  LB" : ""}${ang(p.sign)}`);
  }
  return L;
}

/* ---------------- profections ---------------- */
function profections(o) {           /* o: { asc, birth:"YYYY-MM-DD", asof:Date, years } */
  const [y, m, d] = o.birth.split("-").map(Number), a = o.asof;
  let age = a.getUTCFullYear() - y;
  if (a.getUTCMonth() + 1 < m || (a.getUTCMonth() + 1 === m && a.getUTCDate() < d)) age--;
  const L = ["Annual profections (whole-sign from the Ascendant, changing at each birthday):"], ascS = Math.floor(o.asc / 30);
  for (let k = 0; k < (o.years || 6); k++) { const ag = age + k, s = (ascS + (ag % 12)) % 12;
    L.push(`  age ${String(ag).padStart(2)} (from ${y + ag}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}): ${ord((ag % 12) + 1)} house, ${SIGNS[s]} — lord of the year ${DOMICILE[s]}${k === 0 ? "  ◀" : ""}`); }
  return L;
}

/* ---------------- solar return ---------------- */
function solarReturn(A, o) {        /* o: { rows (natal), asc (natal), ut, year, lat, lon } */
  const bodyLon = (name, t) => name === "Sun" ? A.SunPosition(t).elon : name === "Moon" ? A.EclipticGeoMoon(t).lon : A.Ecliptic(A.GeoVector(A.Body[name], t, true)).elon;
  const natalSun = o.rows.find(r => r.body === "Sun").lon;
  const start = new Date(Date.UTC(o.year, o.ut.getUTCMonth(), o.ut.getUTCDate()) - 3 * DAY);
  const hit = A.SearchSunLongitude(natalSun, start, 8);
  if (!hit) return [`Solar return ${o.year}: not found`];
  const t = hit.date, gast = A.SiderealTime(t), ramc = n360((gast + o.lon / 15) * 15);
  const mc = n360(Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(EPS)) * R2D);
  const asc = n360(Math.atan2(Math.cos(ramc * D2R), -(Math.sin(ramc * D2R) * Math.cos(EPS) + Math.tan(o.lat * D2R) * Math.sin(EPS))) * R2D);
  const hs = (ref, L) => ((Math.floor(L / 30) - Math.floor(ref / 30) + 12) % 12) + 1;
  const L = [`Solar return ${o.year}: ${t.toISOString().slice(0, 16).replace("T", " ")} UT, cast for ${o.lat.toFixed(2)}, ${o.lon.toFixed(2)}`];
  L.push(`  Return Asc ${fmt(asc)} (natal ${ord(hs(o.asc, asc))} house) · MC ${fmt(mc)} · ruler of the return Asc: ${DOMICILE[Math.floor(asc / 30)]}`);
  L.push("  planet     position              return house / natal house");
  for (const b of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]) { const x = bodyLon(b, t);
    L.push(`  ${b.padEnd(10)} ${fmt(x).padEnd(21)} ${String(hs(asc, x)).padStart(2)} / ${hs(o.asc, x)}`); }
  return L;
}

/* ---------------- BaZi extras ---------------- */
const STAGE = { "长生":"Birth","長生":"Birth","沐浴":"Bath","冠带":"Capping","冠帶":"Capping","临官":"Office","臨官":"Office","帝旺":"Peak",
                "衰":"Decline","病":"Sickness","死":"Death","墓":"Tomb","绝":"Extinction","絕":"Extinction","胎":"Embryo","养":"Nurture","養":"Nurture" };
function baziExtras(lib, o) {       /* lib: { Solar, Lunar, LunarUtil }; o: { ct:{y,m,d,hh,mm}, gender, asof:Date, rel:{stemRel,branchRel} } */
  const lunar = lib.Solar.fromYmdHms(o.ct.y, o.ct.m, o.ct.d, o.ct.hh, o.ct.mm, 0).getLunar(), ec = lunar.getEightChar();
  const P = [["year", ec.getYear()], ["month", ec.getMonth()], ["day", ec.getDay()], ["hour", ec.getTime()]], L = [];
  L.push(`Na yin 納音: year ${ec.getYearNaYin()} · month ${ec.getMonthNaYin()} · day ${ec.getDayNaYin()} · hour ${ec.getTimeNaYin()}`);
  const st = [ec.getYearDiShi(), ec.getMonthDiShi(), ec.getDayDiShi(), ec.getTimeDiShi()];
  L.push("Day master's life stage in each branch: " + st.map((s, i) => `${P[i][0]} ${s} ${STAGE[s] || ""}`.trim()).join(" · "));
  L.push(`Conception pillar 胎元 ${ec.getTaiYuan()} · Life palace 命宮 ${ec.getMingGong()} · Body palace 身宮 ${ec.getShenGong()}`);
  if (o.rel) {
    const pairRel = (x, y) => [o.rel.stemRel(x[0], y[0]), ...o.rel.branchRel(x[1], y[1])].filter(Boolean);
    const inner = [];
    for (let i = 0; i < 4; i++) for (let k = i + 1; k < 4; k++) { const r = pairRel(P[i][1], P[k][1]); if (r.length) inner.push(`  ${P[i][0]} × ${P[k][0]}: ${r.join("; ")}`); }
    L.push("Relations inside the chart:" + (inner.length ? "" : " none"));
    L.push(...inner);
    /* current luck pillar and current year, against the natal pillars */
    const yun = ec.getYun(o.gender === "male" ? 1 : 0), asY = o.asof.getUTCFullYear(), dm = ec.getDay()[0];
    const luck = yun.getDaYun().filter(p => p.getGanZhi()).find(p => asY >= p.getStartYear() && asY < p.getStartYear() + 10);
    const yearGz = lib.Lunar.fromDate(o.asof).getYearInGanZhiByLiChun();
    for (const [label, gz] of [[luck ? `Luck pillar ${luck.getGanZhi()} (from ${luck.getStartYear()}, age ${luck.getStartAge()})` : null, luck && luck.getGanZhi()], [`Year ${yearGz} (as of ${ymd(o.asof.getTime())})`, yearGz]]) {
      if (!label) continue;
      const god = lib.LunarUtil.SHI_SHEN[dm + gz[0]] || "";
      const hits = P.map(([n, p]) => [n, pairRel(gz, p)]).filter(([, r]) => r.length).map(([n, r]) => `natal ${n}: ${r.join("; ")}`);
      L.push(`${label} — stem is ${god} to the day master — ${hits.length ? hits.join(" | ") : "no combination, clash, harm or punishment with the natal pillars"}`);
    }
  }
  return L;
}

/* ---------------- Jaimini chara karakas ---------------- */
function charaKarakas(grahas) {     /* grahas: [{ body, lon (sidereal) }] */
  const K = ["Atmakaraka (self)", "Amatyakaraka (career)", "Bhratrikaraka (siblings)", "Matrikaraka (mother)", "Putrakaraka (children)", "Gnatikaraka (rivals)", "Darakaraka (partner)"];
  const seven = grahas.filter(g => ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"].includes(g.body))
    .map(g => ({ body: g.body, deg: g.lon % 30 })).sort((a, b) => b.deg - a.deg);
  return ["Chara karakas (7-karaka scheme, by degree within the sign): " + seven.map((g, i) => `${K[i]} ${g.body} ${g.deg.toFixed(2)}°`).join(" · ")];
}

const API = { zodiacalReleasing, zrLevel1, zrLevel2, profections, solarReturn, baziExtras, charaKarakas, ZR_YEARS };
if (IS_NODE) module.exports = API; else window.SeidanExtras = API;
})();
