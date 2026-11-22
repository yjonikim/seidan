/* Known-answer tests. Run: npm test (needs: npm install in tests/) */
const assert = require("assert");
const { Solar } = require("lunar-javascript");
const { astro } = require("iztro");
const A = require("astronomy-engine");

let pass = 0;
function ok(label, cond) {
  assert(cond, "FAIL: " + label);
  console.log("ok —", label); pass++;
}

/* Fixture: Joni — 1988-08-18 20:44 Korea DST (UTC+10), Seoul 37.566N 126.978E */

// BaZi (uses local standard time: 19:44 KST)
const ec = Solar.fromYmdHms(1988, 8, 18, 19, 44, 0).getLunar().getEightChar();
ok("BaZi year pillar 戊辰", ec.getYear() === "戊辰");
ok("BaZi month pillar 庚申", ec.getMonth() === "庚申");
ok("BaZi day pillar 乙巳", ec.getDay() === "乙巳");
ok("BaZi hour pillar 丙戌", ec.getTime() === "丙戌");

// ZWDS (solar date + 戌 hour index 10, female)
const chart = astro.bySolar("1988-8-18", 10, "female", true, "zh-CN");
ok("ZWDS bureau 水二局", chart.fiveElementsClass === "水二局");
const ming = chart.palaces.find(p => p.name === "命宫");
ok("ZWDS 命宮 in 戌", ming.earthlyBranch === "戌");
ok("ZWDS 破軍 in 命宮", ming.majorStars.some(s => s.name === "破军"));
ok("ZWDS 紫微 in 辰",
  chart.palaces.find(p => p.majorStars.some(s => s.name === "紫微")).earthlyBranch === "辰");

// Western planets (UT = 10:44) — expected degrees within each sign
const date = new Date(Date.UTC(1988, 7, 18, 10, 44, 0));
function lon(b) {
  if (b === "Sun") return A.SunPosition(date).elon;
  if (b === "Moon") return A.EclipticGeoMoon(date).lon;
  return A.Ecliptic(A.GeoVector(A.Body[b], date, true)).elon;
}
const expected = { // [sign index, degree in sign] tolerance ±0.5°
  Sun: [4, 25.7], Moon: [7, 0.27], Mercury: [5, 10.3], Venus: [3, 10.0],
  Mars: [0, 11.0], Jupiter: [2, 3.95], Saturn: [8, 26.05],
  Uranus: [8, 27.2], Neptune: [9, 7.7], Pluto: [7, 10.0],
};
for (const [b, [sign, deg]] of Object.entries(expected)) {
  const L = lon(b);
  ok(`Western ${b} ~ ${deg}° of sign ${sign}`,
     Math.floor(L / 30) === sign && Math.abs((L - sign * 30) - deg) < 0.5);
}

// Angles: Asc 5°56' Pisces (335.93°), MC ~16° Sag (256°), tolerance ±0.25°
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const gast = A.SiderealTime(date);
const ramc = (((gast + 126.978 / 15) * 15) % 360 + 360) % 360;
const eps = 23.4393 * D2R;
let mc = (Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(eps)) * R2D + 360) % 360;
let asc = (Math.atan2(Math.cos(ramc * D2R),
  -(Math.sin(ramc * D2R) * Math.cos(eps) + Math.tan(37.566 * D2R) * Math.sin(eps))) * R2D + 360) % 360;
ok("Asc ~ 5°56' Pisces", Math.abs(asc - 335.93) < 0.25);
ok("MC ~ 16° Sagittarius", Math.abs(mc - 256.2) < 0.5);

// Hour-branch index math (app.js timeIndex)
const timeIndex = (hh) => hh === 23 ? 12 : Math.floor((hh + 1) / 2);
ok("timeIndex 0h → 早子", timeIndex(0) === 0);
ok("timeIndex 19h → 戌", timeIndex(19) === 10);
ok("timeIndex 23h → 晚子", timeIndex(23) === 12);

console.log(`\n${pass} tests passed.`);

// --- True solar time (appended v1.1) ---
function trueSolarLocal(ut, lat, lonE) {
  const obs = new A.Observer(lat, lonE, 0);
  const ra = A.Equator(A.Body.Sun, ut, obs, true, true).ra;
  const gast = A.SiderealTime(ut);
  const ha = ((gast * 15 + lonE - ra * 15) % 360 + 360) % 360;
  const tst = (ha / 15 + 12) % 24;
  return tst;
}
const tstJ = trueSolarLocal(date, 37.566, 126.978);
ok("True solar ~19:08 for Joni", Math.abs(tstJ - (19 + 8/60)) < 0.05);
ok("Solar-time pillars unchanged (戌 hour holds)",
  Solar.fromYmdHms(1988, 8, 18, 19, 8, 0).getLunar().getEightChar().getTime() === "丙戌");
const tstB = trueSolarLocal(new Date(Date.UTC(1988, 7, 18, 12, 20)), 37.566, 126.978);
ok("Boundary: 21:20 clock rolls back into 戌 by sun", Math.floor(tstB) === 20);
console.log("solar-time tests passed.");

// --- Second fixture (appended v15): the public control chart used by tree.js / synastry.js ---
// 1963-04-12 19:31 EST, Queens NY. Rising sign and day master were confirmed when tree.js was
// written; the remaining values are regression pins (they guard against drift, they are not
// independently sourced).
{
  const d2 = new Date(Date.UTC(1963, 3, 13, 0, 31, 0));
  const g2 = A.SiderealTime(d2), r2 = (((g2 + -73.7949 / 15) * 15) % 360 + 360) % 360;
  const asc2 = (Math.atan2(Math.cos(r2 * D2R), -(Math.sin(r2 * D2R) * Math.cos(eps) + Math.tan(40.7282 * D2R) * Math.sin(eps))) * R2D + 360) % 360;
  ok("Fixture 2: Asc ~ 5° Scorpio", Math.abs(asc2 - 215.05) < 0.5);
  const tst2 = trueSolarLocal(d2, 40.7282, -73.7949), hh2 = Math.floor(tst2), mm2 = Math.floor((tst2 % 1) * 60);
  const ec2 = Solar.fromYmdHms(1963, 4, 12, hh2, mm2, 0).getLunar().getEightChar();
  ok("Fixture 2: pillars 癸卯 丙辰 乙酉 丙戌", [ec2.getYear(), ec2.getMonth(), ec2.getDay(), ec2.getTime()].join(" ") === "癸卯 丙辰 乙酉 丙戌");
  const z2 = astro.bySolar("1963-4-12", timeIndex(hh2), "male", true, "zh-CN");
  const m2 = z2.palaces.find(p => p.name === "命宫");
  ok("Fixture 2: ZWDS 火六局, 命宮 in 午 with 貪狼", z2.fiveElementsClass === "火六局" && m2.earthlyBranch === "午" && m2.majorStars.some(s => s.name === "贪狼"));
}

// --- CLI smoke tests (appended v15): chart.js output lines that were verified by hand ---
{
  const { execFileSync } = require("child_process");
  const run = (...extra) => execFileSync("node", [require("path").join(__dirname, "chart.js"),
    "1988-08-18", "20:44", "+10", "+9", "37.5665", "126.978", "female", ...extra], { encoding: "utf8" });
  const full = run();
  ok("CLI: Sun applying trine Saturn inside 1°", /Sun\s+trine\s+Saturn\s+0°\d\d′\s+applying/.test(full));
  ok("CLI: Sun–Moon sextile is separating and out of sign", /Sun\s+sextile\s+Moon\s+4°\d\d′\s+separating\s+out of sign/.test(full));
  ok("CLI: Lagna vargas Kum Sim Mit Vrs Mes Mak Mit Mit", /Lagna\s+Kum\s+Sim\s+Mit\s+Vrs\s+Mes\s+Mak\s+Mit\s+Mit/.test(full));
  ok("CLI: Jupiter vargas Vrs Kar Kan Sim Mak Mes Mes Kan", /Jupiter\s+Vrs\s+Kar\s+Kan\s+Sim\s+Mak\s+Mes\s+Mes\s+Kan/.test(full));
  ok("CLI: Mercury flagged vargottama", /Mercury\s+Sim.*vargottama/.test(full));
  ok("CLI: --only bazi prints BaZi and nothing else", (() => { const o = run("--only", "bazi"); return /=== BAZI/.test(o) && !/=== WESTERN|=== ZWDS|=== JYOTISH|=== TIMING/.test(o); })());
  ok("CLI: --asof 2020-12-21 gives Mars/Mars firdaria and 庚子 戊子 戊戌", (() => { const o = run("--only", "timing,bazi", "--asof", "2020-12-21");
    return /Firdaria: Mars \/ Mars/.test(o) && /Pillars for 2020-12-21: 庚子 戊子 戊戌/.test(o); })());
  console.log(`fixture-2 and CLI tests passed (${pass} assertions in all).`);
}
