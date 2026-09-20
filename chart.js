#!/usr/bin/env node
/* seidan chart.js — CLI twin of the deployed site. Same engines, same math.
   Usage:
     npm install lunar-javascript iztro astronomy-engine
     node chart.js DATE TIME CLOCK_UTC_OFFSET STD_OFFSET LAT LON GENDER [--std-time] [--full] [--fly YYYY-MM-DD] [--transit YYYY-MM-DD]
   Example (Joni):
     node chart.js 1988-08-18 20:44 +10 +9 37.566 126.978 female
   Notes: CLOCK offset includes DST if in effect; STD is the zone's normal
   offset. BaZi/ZWDS hour uses true solar time unless --std-time is passed.
   Jyotish (Lahiri sidereal) prints by default; --full also expands all
   vimshottari antardashas (not just the current mahadasha's). */
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

/* ---- Jyotish (sidereal, Lahiri) ---- */
{
  const RASI = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
                "Tula","Vrischika","Dhanu","Makara","Kumbha","Meena"];
  const NAKS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
                "Magha","P.Phalguni","U.Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
                "Mula","P.Ashadha","U.Ashadha","Shravana","Dhanishta","Shatabhisha","P.Bhadrapada","U.Bhadrapada","Revati"];
  const DASHA = [["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
  const AB = { Lagna:"As", Sun:"Su", Moon:"Mo", Mars:"Ma", Mercury:"Me",
               Jupiter:"Ju", Venus:"Ve", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke" };
  const jt = (ut.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
  const ayan = 23.85306 + (5028.796195 * jt + 1.1054348 * jt * jt) / 3600;
  const mnode = ((125.04452 - 1934.136261 * jt + 0.0020708 * jt * jt) % 360 + 360) % 360;
  const sid = (L) => ((L - ayan) % 360 + 360) % 360;
  const fmtS = (L) => { const s = Math.floor(L / 30), deg = L - s * 30;
    return `${String(Math.floor(deg)).padStart(2)}\u00B0${String(Math.round((deg % 1) * 60)).padStart(2, "0")}\u2032 ${RASI[s]}`; };
  const nakOf = (L) => { const w = 360 / 27, i = Math.floor(L / w);
    return { i, name: NAKS[i], pada: Math.floor((L % w) / (w / 4)) + 1,
             lord: DASHA[i % 9][0], frac: (L % w) / w }; };
  const nav9 = (L) => Math.floor(L / (10 / 3)) % 12;
  const lagna = sid(asc), lagnaS = Math.floor(lagna / 30);
  const gs = [{ body: "Lagna", lon: lagna }];
  for (const b of ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]) {
    const r = rows.find(x => x.body === b);
    gs.push({ body: b, lon: sid(r.lon), rx: r.rx });
  }
  gs.push({ body: "Rahu", lon: sid(mnode), rx: true },
          { body: "Ketu", lon: (sid(mnode) + 180) % 360, rx: true });
  const am = Math.floor(ayan), amin = Math.round((ayan % 1) * 60);
  console.log(`\n=== JYOTISH (Lahiri ayanamsa ${am}\u00B0${String(amin).padStart(2,"0")}\u2032, mean-node Rahu, whole-sign) ===`);
  for (const g of gs) {
    const s = Math.floor(g.lon / 30), h = ((s - lagnaS + 12) % 12) + 1;
    const n = nakOf(g.lon);
    console.log(`${g.body.padEnd(8)} ${fmtS(g.lon)}  H${String(h).padEnd(3)} ${n.name} (${n.pada}) [${n.lord}]  D9 ${RASI[nav9(g.lon)]}${g.rx && g.body !== "Lagna" ? "  Rx" : ""}`);
  }
  /* panchanga + sadhe sati */
  {
    const TITHI = ["Pratipada","Dvitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami","Navami","Dashami","Ekadashi","Dvadashi","Trayodashi","Chaturdashi"];
    const NITYA = ["Vishkambha","Priti","Ayushman","Saubhagya","Shobhana","Atiganda","Sukarma","Dhriti","Shula","Ganda","Vriddhi","Dhruva","Vyaghata","Harshana","Vajra","Siddhi","Vyatipata","Variyan","Parigha","Shiva","Siddha","Sadhya","Shubha","Shukla","Brahma","Indra","Vaidhriti"];
    const KARM = ["Bava","Balava","Kaulava","Taitila","Gara","Vanija","Vishti"];
    const VARA = ["Ravivara","Somavara","Mangalavara","Budhavara","Guruvara","Shukravara","Shanivara"];
    const sunL = gs.find(g => g.body === "Sun").lon, moonL = gs.find(g => g.body === "Moon").lon;
    const el = (moonL - sunL + 360) % 360, ti = Math.floor(el / 12);
    const tname = ti === 14 ? "Purnima" : ti === 29 ? "Amavasya" : TITHI[ti % 15];
    const kk = Math.floor(el / 6);
    const kar = kk === 0 ? "Kimstughna" : kk >= 57 ? ["Shakuni","Chatushpada","Naga"][kk - 57] : KARM[(kk - 1) % 7];
    console.log(`Panchanga: ${VARA[new Date(date + "T12:00:00Z").getUTCDay()]} \u00B7 ${ti < 15 ? "Shukla" : "Krishna"} ${tname} \u00B7 ${NITYA[Math.floor(((sunL + moonL) % 360) / (360 / 27))]} yoga \u00B7 ${kar} karana  [vara from civil date; Vedic day is sunrise\u2192sunrise]`);
    const nowD2 = new Date();
    const jt2 = (nowD2.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
    const ayanNow = 23.85306 + (5028.796195 * jt2 + 1.1054348 * jt2 * jt2) / 3600;
    const satNow = ((bodyLon("Saturn", nowD2) - ayanNow) % 360 + 360) % 360;
    const moonSg = Math.floor(moonL / 30);
    const sh = ((Math.floor(satNow / 30) - moonSg + 12) % 12) + 1;
    const ph = sh === 12 ? "ACTIVE \u2014 first (rising) phase" : sh === 1 ? "ACTIVE \u2014 second (peak) phase"
      : sh === 2 ? "ACTIVE \u2014 third (setting) phase" : sh === 4 || sh === 8 ? `dhaiyya/panoti (Saturn ${sh}th from Moon)` : "not active";
    console.log(`Sadhe Sati today: transit Saturn ${RASI[Math.floor(satNow / 30)]}, ${sh}th from natal Moon \u2192 ${ph}`);
  }
  /* vimshottari */
  const moonS = gs.find(x => x.body === "Moon");
  const mn = nakOf(moonS.lon);
  const YRms = 365.25 * 864e5, nowMs = Date.now();
  const li = mn.i % 9;
  let t0 = ut.getTime() - mn.frac * DASHA[li][1] * YRms;
  const fY = (ms) => { const d = new Date(ms);
    return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const mds = [];
  for (let k = 0; k < 9; k++) {
    const [lord, yrs] = DASHA[(li + k) % 9];
    mds.push({ lord, yrs, start: t0, end: t0 + yrs * YRms, idx: (li + k) % 9,
               current: nowMs >= t0 && nowMs < t0 + yrs * YRms });
    t0 += yrs * YRms;
  }
  console.log(`Vimshottari (dasha year 365.25d; balance at birth: ${DASHA[li][0]} ${((1 - mn.frac) * DASHA[li][1]).toFixed(2)}y):`);
  console.log(mds.map(m => `${AB[m.lord]}@${fY(m.start)}${m.current ? "\u25C0" : ""}`).join("  "));
  const printAds = (md) => {
    const ads = []; let a0 = md.start;
    for (let k = 0; k < 9; k++) {
      const [lord, yrs] = DASHA[(md.idx + k) % 9], len = md.yrs * yrs / 120 * YRms;
      ads.push(`${AB[md.lord]}/${AB[lord]}@${fY(a0)}${nowMs >= a0 && nowMs < a0 + len ? "\u25C0" : ""}`);
      a0 += len;
    }
    console.log("  " + ads.join("  "));
  };
  if (full) { for (const md of mds) printAds(md); }
  else printAds(mds.find(m => m.current) || mds[0]);
  /* drishti */
  const DR = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10] };
  const dr = [];
  for (const g of gs) {
    if (["Lagna","Rahu","Ketu"].includes(g.body)) continue;
    const h = ((Math.floor(g.lon / 30) - lagnaS + 12) % 12) + 1;
    const hs = [7, ...(DR[g.body] || [])].map(n => ((h - 1 + n - 1) % 12) + 1).sort((a, b) => a - b);
    dr.push(`${AB[g.body]} H${h}\u2192${hs.join(",")}`);
  }
  console.log(`Drishti (sign-based, nodal omitted): ${dr.join("  ")}`);
  /* yogas */
  {
    const J_EXALT = { Sun:0, Moon:1, Mars:9, Mercury:5, Jupiter:3, Venus:11, Saturn:6 };
    const J_LORD = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
    const CORB = { Moon:12, Mars:17, Mercury:[14,12], Jupiter:11, Venus:[10,8], Saturn:15 };
    const KEN = [1,4,7,10], TRI = [1,5,9], DUS = [6,8,12], UPA = [3,6,10,11];
    const G = {}; for (const g of gs) { G[g.body] = g; g.sign = Math.floor(g.lon / 30);
      g.house = ((g.sign - lagnaS + 12) % 12) + 1; }
    for (const g of gs) {
      if (g.body === "Lagna") continue;
      if (g.body in J_EXALT) {
        if (g.sign === J_EXALT[g.body]) g.dig = "exalted";
        else if (g.sign === (J_EXALT[g.body] + 6) % 12) g.dig = "debilitated";
        else if (J_LORD[g.sign] === g.body) g.dig = "own";
      }
      const co = CORB[g.body];
      if (co !== undefined) {
        const orb = Array.isArray(co) ? co[g.rx ? 1 : 0] : co;
        if (Math.abs(((g.lon - G.Sun.lon + 540) % 360) - 180) <= orb) g.combust = true;
      }
    }
    const waxing = ((G.Moon.lon - G.Sun.lon + 360) % 360) < 180;
    const mercAff = ["Mars","Saturn","Rahu","Ketu"].some(b => G[b].sign === G.Mercury.sign);
    const BEN = ["Jupiter","Venus"].concat(mercAff ? [] : ["Mercury"]).concat(waxing ? ["Moon"] : []);
    const P7 = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
    const P9 = P7.concat(["Rahu","Ketu"]);
    const hf = (ref, s) => ((s - ref + 12) % 12) + 1;
    const moonS = G.Moon.sign, sunS = G.Sun.sign;
    const Y = [];
    const flag = (g) => { const f = [];
      if (g.combust) f.push("combust");
      if (g.dig === "debilitated") f.push("debilitated");
      return f.length ? ` [${f.join(", ")}]` : ""; };
    const MAHA = { Mars:"Ruchaka", Mercury:"Bhadra", Jupiter:"Hamsa", Venus:"Malavya", Saturn:"Sasa" };
    for (const b in MAHA) { const g = G[b];
      if ((g.dig === "own" || g.dig === "exalted") && KEN.includes(g.house))
        Y.push({ n: MAHA[b], r: `${b} ${g.dig} in kendra H${g.house}${flag(g)}` }); }
    const jh = hf(moonS, G.Jupiter.sign);
    if (KEN.includes(jh)) Y.push({ n: "Gajakesari", r: `Jupiter in kendra (${jh}) from Moon${flag(G.Jupiter)}` });
    const at = (ref, off, pool) => pool.filter(b => G[b].sign === (ref + off) % 12);
    const oth = P7.filter(b => b !== "Moon" && b !== "Sun");
    const m2 = at(moonS, 1, oth), m12 = at(moonS, 11, oth);
    if (m2.length && m12.length) Y.push({ n: "Durudhara", r: `${m2.join("+")} 2nd & ${m12.join("+")} 12th from Moon` });
    else if (m2.length) Y.push({ n: "Sunapha", r: `${m2.join("+")} in 2nd from Moon` });
    else if (m12.length) Y.push({ n: "Anapha", r: `${m12.join("+")} in 12th from Moon` });
    const s2 = at(sunS, 1, oth), s12 = at(sunS, 11, oth);
    if (s2.length && s12.length) Y.push({ n: "Ubhayachari", r: `${s2.join("+")} 2nd & ${s12.join("+")} 12th from Sun` });
    else if (s2.length) Y.push({ n: "Vesi", r: `${s2.join("+")} in 2nd from Sun` });
    else if (s12.length) Y.push({ n: "Vasi", r: `${s12.join("+")} in 12th from Sun` });
    if (sunS === G.Mercury.sign)
      Y.push({ n: "Budha-Aditya", r: `Sun+Mercury in ${RASI[sunS]}${G.Mercury.combust ? " [Mercury combust \u2014 closeness matters]" : ""}` });
    if (moonS === G.Mars.sign) Y.push({ n: "Chandra-Mangala", r: `Moon+Mars in ${RASI[moonS]}` });
    if (G.Jupiter.sign === G.Rahu.sign)
      Y.push({ n: "Guru-Chandala", r: `Jupiter+Rahu in ${RASI[G.Jupiter.sign]} (Ketu variant not checked)`, bad: 1 });
    for (const [ref, label] of [[lagnaS, "lagna"], [moonS, "Moon"]]) {
      const occ = P7.filter(b => G[b].sign === (ref + 9) % 12);
      if (occ.length && occ.every(b => BEN.includes(b)))
        Y.push({ n: "Amala", r: `only benefic(s) ${occ.join("+")} in 10th from ${label}` }); }
    const h2 = P9.filter(b => G[b].sign === (lagnaS + 1) % 12);
    const h12 = P9.filter(b => G[b].sign === (lagnaS + 11) % 12);
    if (h2.length && h12.length) {
      const all = h2.concat(h12);
      if (all.every(b => BEN.includes(b)))
        Y.push({ n: "Subha Kartari", r: `lagna hemmed by benefics ${h12.join("+")}(12th) & ${h2.join("+")}(2nd)` });
      else if (all.every(b => !BEN.includes(b)))
        Y.push({ n: "Papa Kartari", r: `lagna hemmed by malefics ${h12.join("+")}(12th) & ${h2.join("+")}(2nd)`, bad: 1,
                 note: "softened if hemming planets dignified or lagna lord strong" });
    }
    if (["Mercury","Jupiter","Venus"].every(b => [6,7,8].includes(hf(moonS, G[b].sign))))
      Y.push({ n: "Adhi", r: "Me/Ju/Ve all in 6th\u20138th from Moon" });
    if (BEN.length >= 2 && BEN.every(b => UPA.includes(G[b].house)))
      Y.push({ n: "Vasumati", r: `all benefics (${BEN.join("+")}) in upachayas from lagna (simplified)` });
    const lordsOf = {}; for (const b of P7) lordsOf[b] = [];
    for (let h = 1; h <= 12; h++) lordsOf[J_LORD[(lagnaS + h - 1) % 12]].push(h);
    for (const b of P7) { const l = lordsOf[b];
      if (l.some(h => [4,7,10].includes(h)) && l.some(h => [5,9].includes(h)))
        Y.push({ n: "Yogakaraka", r: `${b} lords kendra & trikona (H${l.join(", H")})${flag(G[b])}` }); }
    const aspS = (b, from, to) => { const n = ((to - from + 12) % 12) + 1;
      return n === 7 || (DR[b] || []).includes(n); };
    const samb = (a, b) => {
      if (G[a].sign === G[b].sign) return "conjunction";
      if (J_LORD[G[a].sign] === b && J_LORD[G[b].sign] === a) return "parivartana";
      if (aspS(a, G[a].sign, G[b].sign) && aspS(b, G[b].sign, G[a].sign)) return "mutual aspect";
      return null; };
    const lordName = (b) => `${b} (L${lordsOf[b].join(",L")})`;
    const seen = new Set();
    const pairYoga = (a, b, nm, bad) => {
      if (a === b) return; const key = [a, b].sort().join();
      if (seen.has(key)) return;
      const s = samb(a, b);
      if (s) { seen.add(key);
        Y.push({ n: nm, r: `${lordName(a)} + ${lordName(b)} ${s}${flag(G[a])}${flag(G[b])}`, bad }); } };
    const L = (h) => J_LORD[(lagnaS + h - 1) % 12];
    pairYoga(L(9), L(10), "Dharma-Karmadhipati Raja");
    for (const a of new Set(KEN.map(L))) for (const b of new Set(TRI.map(L))) pairYoga(a, b, "Raja");
    for (const b of [L(5), L(9), L(1), L(11)]) pairYoga(L(2), b, "Dhana");
    for (const b of [L(5), L(9), L(1)]) pairYoga(L(11), b, "Dhana");
    const VIP = { 6: "Harsha", 8: "Sarala", 12: "Vimala" };
    for (const h of DUS) { const lord = L(h), g = G[lord], lh = hf(lagnaS, g.sign);
      if (DUS.includes(lh))
        Y.push({ n: `Viparita (${VIP[h]})`, r: `L${h} ${lord} in dusthana H${lh}` +
          (lordsOf[lord].length > 1 ? ` \u2014 also L${lordsOf[lord].filter(x => x !== h).join(",L")}, dilutes per some texts` : "") }); }
    const ex = new Set();
    for (const a of P7) { const D = J_LORD[G[a].sign];
      if (D === a) continue;
      if (J_LORD[G[D].sign] === a) { const key = [a, D].sort().join();
        if (ex.has(key)) continue; ex.add(key);
        const ha = hf(lagnaS, G[a].sign), hd = hf(lagnaS, G[D].sign);
        const cls = (DUS.includes(ha) || DUS.includes(hd)) ? "Dainya" : (ha === 3 || hd === 3) ? "Khala" : "Maha";
        Y.push({ n: `${cls} Parivartana`, r: `${a}(H${ha}) \u21C4 ${D}(H${hd})`, bad: cls !== "Maha" ? 1 : 0 }); } }
    { const l9 = L(9), g = G[l9];
      if ((g.dig === "own" || g.dig === "exalted") && (KEN.includes(g.house) || TRI.includes(g.house)))
        Y.push({ n: "Lakshmi", r: `L9 ${l9} ${g.dig} in H${g.house} (simplified: lagna-lord strength not scored)` }); }
    for (const b of P7) { const g = G[b];
      if (g.dig !== "debilitated") continue;
      const conds = [], disp = J_LORD[g.sign];
      const inKen = (x) => KEN.includes(hf(lagnaS, G[x].sign)) || KEN.includes(hf(moonS, G[x].sign));
      if (inKen(disp)) conds.push(`dispositor ${disp} in kendra from lagna/Moon`);
      const exalter = Object.keys(J_EXALT).find(e => J_EXALT[e] === g.sign);
      if (exalter && exalter !== b && inKen(exalter)) conds.push(`${exalter} (exalted in ${RASI[g.sign]}) in kendra`);
      if (J_LORD[G[disp].sign] === b) conds.push(`exchange with dispositor ${disp}`);
      if (conds.length) Y.push({ n: "Nicha Bhanga", r: `${b} debilitated in ${RASI[g.sign]}; ${conds.join("; ")}` });
      else Y.push({ n: "(debilitation)", r: `${b} debilitated in ${RASI[g.sign]}, no bhanga condition met`, bad: 1 }); }
    { const r0 = G.Rahu.lon, k0 = G.Ketu.lon;
      const inArc = (x, a, b) => ((x - a + 360) % 360) < ((b - a + 360) % 360);
      const s1 = P7.every(b => inArc(G[b].lon, r0, k0)), s2b = P7.every(b => inArc(G[b].lon, k0, r0));
      if (s1 || s2b) Y.push({ n: "Kala Sarpa", r: `all seven grahas within the ${s1 ? "Rahu\u2192Ketu" : "Ketu\u2192Rahu"} arc`, bad: 1,
        note: "softens/breaks if any planet degree-conjunct a node; many lineages skip this yoga" }); }
    { const pool = ["Mars","Mercury","Jupiter","Venus","Saturn"];
      const near = pool.some(b => [0,1,11].includes((G[b].sign - moonS + 12) % 12));
      if (!near) {
        const canc = [];
        if (pool.concat(["Sun"]).some(b => KEN.includes(hf(moonS, G[b].sign)))) canc.push("planet in kendra from Moon");
        if (KEN.includes(hf(lagnaS, moonS))) canc.push("Moon in kendra from lagna");
        if (aspS("Jupiter", G.Jupiter.sign, moonS)) canc.push("Jupiter aspects Moon");
        Y.push({ n: "Kemadruma", r: "no planet conjunct or 2nd/12th from Moon (Sun & nodes excluded)", bad: 1,
          note: canc.length ? `cancelled/softened: ${canc.join("; ")}` : "no standard cancellation found (classical lists have more)" }); } }
    { const refs = [["lagna", lagnaS], ["Moon", moonS], ["Venus", G.Venus.sign]];
      const hits = refs.map(([l, s]) => [l, hf(s, G.Mars.sign)]).filter(([, h]) => [1,2,4,7,8,12].includes(h));
      if (hits.length) { const soft = G.Mars.dig === "own" || G.Mars.dig === "exalted";
        Y.push({ n: "Mangal (Kuja) dosha", r: `Mars in H${hits.map(([l, h]) => `${h} from ${l}`).join(", H")}`, bad: 1,
          note: (soft ? `softened: Mars ${G.Mars.dig}; ` : "") + "2nd-house count is South convention; matching folklore" }); } }
    console.log(`Yogas (mechanical; Moon ${waxing ? "waxing" : "waning"}; benefics ${BEN.join(",")}${mercAff ? "; Mercury counted malefic" : ""}):`);
    if (!Y.length) console.log("  \u2014 none of the tracked set forms");
    for (const yg of Y)
      console.log(`  ${yg.bad ? "\u26A0 " : ""}${yg.n} \u2014 ${yg.r}${yg.note ? ` (${yg.note})` : ""}`);
    /* combustion/dignity tags on the position table are in the site build; CLI shows them here */
    const tags = gs.filter(g => g.dig || g.combust)
      .map(g => `${AB[g.body]}:${[g.dig, g.combust ? "combust" : ""].filter(Boolean).join("+")}`);
    if (tags.length) console.log(`Dignity/combustion: ${tags.join("  ")}`);
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

/* ---- timing: firdaria / progressions / solar arc (today) ---- */
{
  const FD = [["Sun",10],["Venus",8],["Mercury",13],["Moon",9],["Saturn",11],["Jupiter",12],["Mars",7],["NNode",3],["SNode",2]];
  const FN = [["Moon",9],["Saturn",11],["Jupiter",12],["Mars",7],["NNode",3],["SNode",2],["Sun",10],["Venus",8],["Mercury",13]];
  const nowD = new Date();
  const ageY = (nowD - ut) / (365.2422 * 864e5);
  const seq = isDay ? FD : FN, seven = seq.filter(x => !x[0].includes("Node"));
  const a2 = ageY % 75;
  let acc = 0, major = null, mStart = 0;
  for (const [pl, yrs] of seq) { if (a2 < acc + yrs) { major = [pl, yrs]; mStart = acc; break; } acc += yrs; }
  let sub = "", subEnd = 0;
  if (!major[0].includes("Node")) {
    const si = seven.findIndex(x => x[0] === major[0]); let sacc = mStart;
    for (let k = 0; k < 7; k++) { const [pl, yrs] = seven[(si + k) % 7]; const len = major[1] * yrs / 70;
      if (a2 < sacc + len) { sub = pl; subEnd = sacc + len; break; } sacc += len; }
  }
  const fA = (yy) => { const dd = new Date(ut.getTime() + yy * 365.2422 * 864e5);
    return `${dd.getUTCFullYear()}.${String(dd.getUTCMonth() + 1).padStart(2, "0")}`; };
  console.log(`\n=== TIMING (today, age ${ageY.toFixed(2)}) ===`);
  console.log(`Firdaria: ${major[0]}${sub ? " / " + sub : ""} — major ${fA(mStart)}\u2013${fA(mStart + major[1])}` +
    (sub ? `, sub until ${fA(subEnd)}` : "") + `  [nodes follow Mars; subs \u00D7yrs/70]`);
  const pd = new Date(ut.getTime() + ageY * 864e5);
  const pl7 = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"];
  const prog = pl7.map(b => ({ body: b, lon: bodyLon(b, pd) }));
  const arc = ((prog[0].lon - rows[0].lon) % 360 + 360) % 360;
  console.log(`Solar arc: ${arc.toFixed(2)}\u00B0`);
  for (const pr of prog) console.log(`  p${pr.body.padEnd(8)} ${fmt(pr.lon)}`);
  const targets = rows.concat([{ body: "Asc", lon: asc }, { body: "MC", lon: mc }]);
  const sa = rows.map(r => ({ body: r.body, lon: (r.lon + arc) % 360 }));
  const ASP2 = [[0,"conj"],[60,"sextile"],[90,"square"],[120,"trine"],[180,"opposition"]];
  const th = [];
  const scan2 = (movers, tag) => { for (const t of movers) for (const n of targets) {
    const dd = Math.abs(((t.lon - n.lon + 540) % 360) - 180);
    for (const [ang, nm] of ASP2) if (Math.abs(dd - ang) <= 1) th.push({ tag, t: t.body, nm, n: n.body, o: Math.abs(dd - ang) }); } };
  scan2(prog, "prog"); scan2(sa, "SA");
  th.sort((x, y) => x.o - y.o);
  console.log("Directed hits (1\u00B0 orb):");
  for (const x of th) console.log(`  ${x.tag} ${x.t} ${x.nm} n${x.n}  ${x.o.toFixed(2)}\u00B0`);
}
