#!/usr/bin/env node
/* seidan chart.js — CLI twin of the deployed site. Same engines, same math.
   Usage:
     npm install lunar-javascript iztro astronomy-engine
     node chart.js DATE TIME CLOCK_UTC_OFFSET STD_OFFSET LAT LON GENDER [--std-time] [--full] [--fly YYYY-MM-DD] [--transit YYYY-MM-DD]
   Example (Joni):
     node chart.js 1988-08-18 20:44 +10 +9 37.566 126.978 female
   Notes: CLOCK offset includes DST if in effect; STD is the zone's normal
   offset. BaZi/ZWDS hour uses true solar time unless --std-time is passed. */
"use strict";
const A = require("astronomy-engine");
const { Solar } = require("lunar-javascript");
const { astro } = require("iztro");

const [date, time, clockoffS, stdoffS, latS, lonS, gender] = process.argv.slice(2);
if (!gender) {
  console.error("Usage: node chart.js DATE TIME CLOCK_OFF STD_OFF LAT LON male|female [--std-time] [--full] [--fly YYYY-MM-DD] [--transit YYYY-MM-DD]");
  process.exit(1);
}
const useSolar = !process.argv.includes("--std-time");
const full = process.argv.includes("--full");
const flyIdx = process.argv.indexOf("--fly");
const flyDate = flyIdx > -1 ? process.argv[flyIdx + 1] : null;
const trIdx = process.argv.indexOf("--transit");
const transitDate = trIdx > -1 ? process.argv[trIdx + 1] : null;
const clockoff = parseFloat(clockoffS), stdoff = parseFloat(stdoffS);
const lat = parseFloat(latS), lon = parseFloat(lonS);
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
               "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

const [y, m, d] = date.split("-").map(Number);
const [hh, mm] = time.split(":").map(Number);
const ut = new Date(Date.UTC(y, m - 1, d, hh, mm) - clockoff * 3600e3);

const fmt = (L) => {
  const s = Math.floor(L / 30), deg = L - s * 30;
  return `${String(Math.floor(deg)).padStart(2)}°${String(Math.round((deg % 1) * 60)).padStart(2, "0")}′ ${SIGNS[s]}`;
};

/* ---- Western ---- */
function bodyLon(name, t) {
  if (name === "Sun") return A.SunPosition(t).elon;
  if (name === "Moon") return A.EclipticGeoMoon(t).lon;
  return A.Ecliptic(A.GeoVector(A.Body[name], t, true)).elon;
}
const gast = A.SiderealTime(ut);
const ramc = (((gast + lon / 15) * 15) % 360 + 360) % 360;
const eps = 23.4393 * D2R;
const mc = ((Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(eps)) * R2D) + 360) % 360;
const asc = ((Math.atan2(Math.cos(ramc * D2R),
  -(Math.sin(ramc * D2R) * Math.cos(eps) + Math.tan(lat * D2R) * Math.sin(eps))) * R2D) + 360) % 360;
const ascSign = Math.floor(asc / 30);


/* ---- Placidus cusps (iterative semi-arc) ---- */
function placidusCusps() {
  const raToEcl = (ra) => ((Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(eps)) * R2D) + 360) % 360;
  function iter(offset, diurnal, frac) {
    let ra = ramc + offset;
    for (let i = 0; i < 40; i++) {
      const dec = Math.atan(Math.tan(eps) * Math.sin(ra * D2R));
      const x = Math.tan(lat * D2R) * Math.tan(dec);
      if (Math.abs(x) > 1) return null;
      const ad = Math.asin(x) * R2D;
      const sa = diurnal ? 90 + ad : 90 - ad;
      ra = diurnal ? ramc + sa * frac : ramc + 180 - sa * frac;
    }
    return raToEcl(ra);
  }
  const c11 = iter(30, true, 1 / 3), c12 = iter(60, true, 2 / 3);
  const c2 = iter(120, false, 2 / 3), c3 = iter(150, false, 1 / 3);
  if ([c11, c12, c2, c3].some(c => c === null)) return null;
  const cusps = new Array(13);
  cusps[1] = asc; cusps[2] = c2; cusps[3] = c3; cusps[4] = (mc + 180) % 360;
  cusps[5] = (c11 + 180) % 360; cusps[6] = (c12 + 180) % 360;
  cusps[7] = (asc + 180) % 360; cusps[8] = (c2 + 180) % 360;
  cusps[9] = (c3 + 180) % 360; cusps[10] = mc; cusps[11] = c11; cusps[12] = c12;
  return cusps;
}
function placidusHouse(cusps, L) {
  for (let h = 1; h <= 12; h++) {
    const a = cusps[h], b = cusps[h === 12 ? 1 : h + 1];
    const span = (b - a + 360) % 360, off = (L - a + 360) % 360;
    if (off < span) return h;
  }
  return 0;
}
const cusps = placidusCusps();

console.log("=== WESTERN (tropical) ===");
const rows = [];
for (const b of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]) {
  const L = bodyLon(b, ut);
  const L2 = bodyLon(b, new Date(ut.getTime() + 3600e3));
  const rx = b !== "Sun" && b !== "Moon" && (((L2 - L + 540) % 360) - 180) < 0;
  const house = ((Math.floor(L / 30) - ascSign + 12) % 12) + 1;
  const ph = cusps ? placidusHouse(cusps, L) : "?";
  rows.push({ body: b, lon: L, rx, house, ph });
  console.log(`${b.padEnd(8)} ${fmt(L)}  WS${house} P${ph}${rx ? "  Rx" : ""}`);
}
console.log(`Asc      ${fmt(asc)}`);
console.log(`MC       ${fmt(mc)}`);
if (cusps) {
  console.log("Placidus cusps:");
  for (let h = 1; h <= 12; h++) console.log(`  ${String(h).padStart(2)}: ${fmt(cusps[h])}`);
} else {
  console.log("Placidus undefined at this latitude (polar circle) — whole-sign only.");
}

/* ---- dignities / sect / lots / profection ---- */
const DOMICILE = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
const EXALT = { Sun:0, Moon:1, Mercury:5, Venus:11, Mars:9, Jupiter:3, Saturn:6 };
const TRIP = { fire:["Sun","Jupiter","Saturn"], earth:["Venus","Moon","Mars"],
               air:["Saturn","Mercury","Jupiter"], water:["Venus","Mars","Moon"] };
const ELEM = ["fire","earth","air","water"];
const BOUNDS = [
  [["Jupiter",6],["Venus",12],["Mercury",20],["Mars",25],["Saturn",30]],
  [["Venus",8],["Mercury",14],["Jupiter",22],["Saturn",27],["Mars",30]],
  [["Mercury",6],["Jupiter",12],["Venus",17],["Mars",24],["Saturn",30]],
  [["Mars",7],["Venus",13],["Mercury",19],["Jupiter",26],["Saturn",30]],
  [["Jupiter",6],["Venus",11],["Saturn",18],["Mercury",24],["Mars",30]],
  [["Mercury",7],["Venus",17],["Jupiter",21],["Mars",28],["Saturn",30]],
  [["Saturn",6],["Mercury",14],["Jupiter",21],["Venus",28],["Mars",30]],
  [["Mars",7],["Venus",11],["Mercury",19],["Jupiter",24],["Saturn",30]],
  [["Jupiter",12],["Venus",17],["Mercury",21],["Saturn",26],["Mars",30]],
  [["Mercury",7],["Jupiter",14],["Venus",22],["Saturn",26],["Mars",30]],
  [["Mercury",7],["Venus",13],["Jupiter",20],["Mars",25],["Saturn",30]],
  [["Venus",12],["Jupiter",16],["Mercury",19],["Mars",28],["Saturn",30]],
];
const CHALDEAN = ["Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter"];
const boundLord = (L) => { const s = Math.floor(L/30), dg = L - s*30;
  for (const [pl, end] of BOUNDS[s]) if (dg < end) return pl; return BOUNDS[s][4][0]; };
const faceLord = (L) => CHALDEAN[(Math.floor(L/30)*3 + Math.floor((L%30)/10)) % 7];
const sunLon = rows[0].lon, moonLon = rows[1].lon;
const isDay = ((sunLon - asc + 360) % 360) >= 180;
console.log(`\n${isDay ? "Diurnal" : "Nocturnal"} chart.`);
const fortune = ((isDay ? asc + moonLon - sunLon : asc + sunLon - moonLon) % 360 + 360) % 360;
const spirit = ((isDay ? asc + sunLon - moonLon : asc + moonLon - sunLon) % 360 + 360) % 360;
console.log(`Fortune ${fmt(fortune)}   Spirit ${fmt(spirit)}`);
const nowD = new Date();
let age = nowD.getFullYear() - y;
if (nowD < new Date(nowD.getFullYear(), m - 1, d)) age--;
const profSign = (Math.floor(asc/30) + (age % 12)) % 12;
console.log(`Profection age ${age}: ${SIGNS[profSign]} (${DOMICILE[profSign]} lord of the year)`);
console.log("Dignities:");
for (const r of rows) {
  if (!(r.body in EXALT) && DOMICILE.indexOf(r.body) < 0) continue;
  const sign = Math.floor(r.lon / 30), dl = [];
  if (DOMICILE[sign] === r.body) dl.push("domicile");
  if (EXALT[r.body] === sign) dl.push("exaltation");
  if (DOMICILE[(sign+6)%12] === r.body) dl.push("detriment");
  if (EXALT[r.body] === (sign+6)%12) dl.push("fall");
  const t = TRIP[ELEM[sign % 4]];
  if ((isDay ? t[0] : t[1]) === r.body) dl.push("triplicity");
  else if (t[2] === r.body) dl.push("triplicity(part)");
  const bl = boundLord(r.lon), fl = faceLord(r.lon);
  if (bl === r.body) dl.push("own bound");
  if (fl === r.body) dl.push("own face");
  let sect = "";
  if (["Sun","Jupiter","Saturn"].includes(r.body)) sect = isDay ? "of sect" : "out of sect";
  if (["Moon","Venus","Mars"].includes(r.body)) sect = isDay ? "out of sect" : "of sect";
  console.log(`  ${r.body.padEnd(8)} ${(dl.join(", ") || "peregrine").padEnd(38)} bound:${bl.padEnd(8)} face:${fl.padEnd(8)} ${sect}`);
}


/* ---- time for Chinese systems ---- */
function trueSolarLocal() {
  const obs = new A.Observer(lat, lon, 0);
  const ra = A.Equator(A.Body.Sun, ut, obs, true, true).ra;
  const ha = ((gast * 15 + lon - ra * 15) % 360 + 360) % 360;
  const tst = (ha / 15 + 12) % 24;
  const lmt = new Date(ut.getTime() + (lon / 15) * 3600e3);
  let day = new Date(Date.UTC(lmt.getUTCFullYear(), lmt.getUTCMonth(), lmt.getUTCDate()));
  const lmtH = lmt.getUTCHours() + lmt.getUTCMinutes() / 60;
  if (tst - lmtH > 12) day = new Date(day.getTime() - 864e5);
  if (lmtH - tst > 12) day = new Date(day.getTime() + 864e5);
  return { y: day.getUTCFullYear(), m: day.getUTCMonth() + 1, d: day.getUTCDate(),
           hh: Math.floor(tst), mm: Math.floor((tst % 1) * 60) };
}
function standardLocal() {
  const t = new Date(ut.getTime() + stdoff * 3600e3);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
           hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}
const ct = useSolar ? trueSolarLocal() : standardLocal();
const tstr = `${ct.hh}:${String(ct.mm).padStart(2, "0")} ${useSolar ? "true solar" : "standard"}`;

/* ---- BaZi ---- */
const lunar = Solar.fromYmdHms(ct.y, ct.m, ct.d, ct.hh, ct.mm, 0).getLunar();
const ec = lunar.getEightChar();
console.log(`\n=== BAZI (hour from ${tstr} time) ===`);
console.log(`Year ${ec.getYear()}  Month ${ec.getMonth()}  Day ${ec.getDay()}  Hour ${ec.getTime()}`);
console.log(`十神: ${ec.getYearShiShenGan()}(年) ${ec.getMonthShiShenGan()}(月) 日主 ${ec.getTimeShiShenGan()}(時)`);
const zg = (h, g) => h.map((x, i) => x + "\u00B7" + g[i]).join(" ");
console.log(`Hidden stems: Y[${zg(ec.getYearHideGan(), ec.getYearShiShenZhi())}] M[${zg(ec.getMonthHideGan(), ec.getMonthShiShenZhi())}] D[${zg(ec.getDayHideGan(), ec.getDayShiShenZhi())}] H[${zg(ec.getTimeHideGan(), ec.getTimeShiShenZhi())}]`);
console.log(`Lunar date: ${lunar.toString()}`);
const yun = ec.getYun(gender === "male" ? 1 : 0);
console.log(`Luck pillars (${yun.isForward() ? "forward" : "backward"}, start ${yun.getStartYear()}y ${yun.getStartMonth()}m ${yun.getStartDay()}d after birth):`);
const dy = yun.getDaYun().filter(p => p.getGanZhi());
const { LunarUtil } = require("lunar-javascript");
const dmStem = ec.getDay()[0];
console.log(dy.slice(0, 9).map(p =>
  `${p.getGanZhi()}\u00B7${LunarUtil.SHI_SHEN[dmStem + p.getGanZhi()[0]] || "?"}@${p.getStartAge()}(${p.getStartYear()})`).join("  "));
const { Lunar } = require("lunar-javascript");
const nowL = Lunar.fromDate(new Date());
console.log(`Today's pillars: ${nowL.getYearInGanZhi()} ${nowL.getMonthInGanZhi()} ${nowL.getDayInGanZhi()}`);
{
  const GROUP = { "申":"a","子":"a","辰":"a","寅":"b","午":"b","戌":"b","巳":"c","酉":"c","丑":"c","亥":"d","卯":"d","未":"d" };
  const T = { taohua:{a:"酉",b:"卯",c:"午",d:"子"}, yima:{a:"寅",b:"申",c:"亥",d:"巳"},
              huagai:{a:"辰",b:"戌",c:"丑",d:"未"}, jiang:{a:"子",b:"午",c:"酉",d:"卯"} };
  const NAMES = { taohua:"桃花", yima:"驛馬", huagai:"華蓋", jiang:"將星" };
  const TIANYI = { "甲":"丑未","戊":"丑未","庚":"丑未","乙":"子申","己":"子申","丙":"亥酉","丁":"亥酉","壬":"卯巳","癸":"卯巳","辛":"午寅" };
  const WEN = { "甲":"巳","乙":"午","丙":"申","丁":"酉","戊":"申","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯" };
  const REN = { "甲":"卯","丙":"午","戊":"午","庚":"酉","壬":"子" };
  const HL = { "子":"卯","丑":"寅","寅":"丑","卯":"子","辰":"亥","巳":"戌","午":"酉","未":"申","申":"未","酉":"午","戌":"巳","亥":"辰" };
  const B12 = "子丑寅卯辰巳午未申酉戌亥";
  const slots = [["年", ec.getYear()[1]], ["月", ec.getMonth()[1]], ["日", ec.getDay()[1]], ["時", ec.getTime()[1]]];
  const yB = slots[0][1], dB = slots[2][1], dS = ec.getDay()[0], yS = ec.getYear()[0];
  const found = [];
  const scan = (star, targets, tag) => { for (const [pos, br] of slots)
    if (targets && targets.includes(br)) found.push(`${star}@${pos}(${br})${tag}`); };
  for (const [br, tag] of [[yB, "从年"], [dB, "从日"]])
    for (const k of Object.keys(T)) scan(NAMES[k], T[k][GROUP[br]], tag);
  scan("天乙貴人", TIANYI[dS], "(日干)");
  if (yS !== dS) scan("天乙貴人", TIANYI[yS], "(年干)");
  scan("文昌", WEN[dS], ""); if (REN[dS]) scan("羊刃", REN[dS], "");
  scan("紅鸞", HL[yB], ""); scan("天喜", B12[(B12.indexOf(HL[yB]) + 6) % 12], "");
  const xk = lunar.getDayXunKong();
  scan("空亡", xk, "");
  console.log("神煞: " + ([...new Set(found)].join("  ") || "—") +
    `\n空亡 (day ${xk})` + " — 天乙 convention: 甲戊庚→丑未; group stars from year & day branch");
}

/* ---- ZWDS ---- */
const timeIndex = ct.hh === 23 ? 12 : Math.floor((ct.hh + 1) / 2);
const chart = astro.bySolar(`${ct.y}-${ct.m}-${ct.d}`, timeIndex, gender, true, "zh-CN");
console.log(`\n=== ZWDS (${chart.fiveElementsClass}, lunar ${chart.lunarDate}) ===`);
for (const p of chart.palaces) {
  const majors = p.majorStars.map(s =>
    s.name + (s.brightness ? "(" + s.brightness + ")" : "") + (s.mutagen ? "·" + s.mutagen : "")).join(" ") || "—";
  const minors = p.minorStars.map(s => s.name).join(" ");
  const tag = p.name === "命宫" ? " ◀◀" : "";
  console.log(`${p.heavenlyStem}${p.earthlyBranch} ${p.name.padEnd(4)} ${majors}${minors ? "  (" + minors + ")" : ""}${tag}`);
  if (full) {
    const adj = p.adjectiveStars.map(s => s.name).join(" ");
    console.log(`   杂曜: ${adj || "—"}  |  長生:${p.changsheng12} 博士:${p.boshi12}  |  大限 ${p.decadal.range[0]}–${p.decadal.range[1]}`);
  }
}
if (flyDate) {
  const h = chart.horoscope(flyDate);
  console.log(`\n=== FLYING 四化 for ${flyDate} (order: 祿 權 科 忌) ===`);
  for (const [label, sc] of [["Decadal 大限", h.decadal], ["Yearly 流年", h.yearly],
                             ["Monthly 流月", h.monthly], ["Daily 流日", h.daily]]) {
    console.log(`${label} ${sc.heavenlyStem}${sc.earthlyBranch}: ${sc.mutagen.join(" ")}  (命宮→natal ${chart.palaces[sc.index].name})`);
  }
}

/* ---- transits ---- */
if (transitDate) {
  const td = new Date(transitDate + "T12:00:00Z");
  console.log(`\n=== TRANSITS ${transitDate} (12:00 UT; Moon moves \u00B16\u00B0/half-day) ===`);
  const trows = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]
    .map(b => ({ body: b, lon: bodyLon(b, td) }));
  for (const t of trows) console.log(`  t${t.body.padEnd(8)} ${fmt(t.lon)}`);
  const ASP = [[0,"conj"],[60,"sextile"],[90,"square"],[120,"trine"],[180,"opposition"]];
  const hits = [];
  for (const t of trows) for (const n of rows) {
    const dd = Math.abs(((t.lon - n.lon + 540) % 360) - 180);
    for (const [ang, nm] of ASP) if (Math.abs(dd - ang) <= 3)
      hits.push({ t: t.body, n: n.body, nm, orb: Math.abs(dd - ang) });
  }
  hits.sort((a, b) => a.orb - b.orb);
  console.log("Hits (3\u00B0 orb, tightest first):");
  for (const h of hits) console.log(`  t${h.t} ${h.nm} n${h.n}  orb ${Math.floor(h.orb)}\u00B0${String(Math.round((h.orb%1)*60)).padStart(2,"0")}\u2032`);
}
