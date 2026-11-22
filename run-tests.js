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

// --- Traditional extras (appended v16): checked against the calendar and almanac by hand ---
{
  const { execFileSync } = require("child_process");
  const cli = (args) => execFileSync("node", [require("path").join(__dirname, "chart.js"), ...args, "--only", "west"], { encoding: "utf8" });
  const j = cli(["1988-08-18", "20:44", "+10", "+9", "37.5665", "126.978", "female"]);
  ok("Extras: 1988-08-18 is a Thursday → Jupiter day; first night hour → Moon", /Planetary day: Jupiter · planetary hour: Moon \(night hour 1 of 12/.test(j));
  ok("Extras: prenatal syzygy is the 12 Aug 1988 New Moon at 20° Leo", /Prenatal syzygy: New Moon.*20°\d\d′ Leo/.test(j));
  ok("Extras: nocturnal Eros = Asc + Spirit − Venus ≈ 6° Capricorn", /Eros 6°\d\d′ Capricorn/.test(j));
  ok("Extras: Mercury under the beams and occidental, Venus oriental", /Mercury under the beams, occidental/.test(j) && /Venus free of the beams, oriental/.test(j));
  const c = cli(["1963-04-12", "19:31", "-5", "-5", "40.7282", "-73.7949", "male"]);
  ok("Extras: 1963-04-12 is a Friday → Venus day; second night hour → Sun", /Planetary day: Venus · planetary hour: Sun \(night hour 2 of 12/.test(c));
  ok("Extras: prenatal syzygy is the 9 Apr 1963 Full Moon in Libra", /Prenatal syzygy: Full Moon.*Libra/.test(c));
  const r = cli(["2000-08-22", "12:00", "+0", "+0", "51.5", "0", "female"]);
  ok("Extras: Sun at 29° Leo in 2000 is found with Regulus", /Sun with Regulus/.test(r));
  console.log(`traditional-extras tests passed (${pass} assertions in all).`);
}

// --- extras.js (appended v17) ---
{
  const X = require("./extras.js"), DAY = 864e5, t0 = Date.UTC(2000, 0, 1);
  ok("ZR: minor years sum to 211 (17y 7m in months for a full L2 circuit)", X.ZR_YEARS.reduce((a, b) => a + b, 0) === 211);
  const l1 = X.zrLevel1(3, t0, t0 + 30 * 360 * DAY);
  ok("ZR: L1 from Cancer runs 25 years of 360 days, then Leo", l1[0].sign === 3 && l1[0].end - l1[0].start === 25 * 360 * DAY && l1[1].sign === 4);
  const l2 = X.zrLevel2(l1[0]);
  ok("ZR: L2 starts in the L1 sign; 13th sub-period looses the bond to the opposite sign (Capricorn)", l2[0].sign === 3 && l2[12].lb && l2[12].sign === 9 && l2[11].sign === 2);
  ok("ZR: L2 sub-periods fill the L1 period exactly", l2[l2.length - 1].end === l1[0].end && l2.every((p, i) => i === 0 || p.start === l2[i - 1].end));
  const pf = X.profections({ asc: 335.93, birth: "1988-08-18", asof: new Date("2026-11-22T12:00:00Z"), years: 1 });
  ok("Profection: age 38 from Pisces rising = 3rd house Taurus, Venus", /age 38 .*3rd house, Taurus .* Venus/.test(pf[1]));
  const { execFileSync } = require("child_process");
  const o = execFileSync("node", [require("path").join(__dirname, "chart.js"), "1988-08-18", "20:44", "+10", "+9", "37.5665", "126.978", "female", "--return", "2027", "--asof", "2026-11-22"], { encoding: "utf8" });
  ok("Solar return 2027: Sun back at 25°42′ Leo", /Solar return 2027/.test(o) && /Sun\s+25°4[12]′ Leo/.test(o.split("Solar return 2027")[1]));
  ok("BaZi extras: na yin 大林木 / 石榴木 / 覆灯火 / 屋上土", /大林木 · month 石榴木 · day 覆灯火 · hour 屋上土/.test(o));
  ok("BaZi extras: 乙 day master is 冠带 in 辰 and 墓 in 戌", /year 冠带 Capping .* hour 墓 Tomb/.test(o));
  ok("Vargas: D30 Lagna 12° Aquarius → Dha; Jupiter 10° Taurus → Kan", /Lagna\s+Kum.*\sDha\s/.test(o) && /Jupiter\s+Vrs.*\sKan\s/.test(o));
  ok("Chara karakas: Atmakaraka Mars, Darakaraka Sun", /Atmakaraka \(self\) Mars .*Darakaraka \(partner\) Sun/.test(o));
  console.log(`extras tests passed (${pass} assertions in all).`);
}

// --- stars from catalogue + lunar mansions (appended v18) ---
{
  const X = require("./extras.js");
  const at = (y) => Object.fromEntries(X.starLongitudes(A, new Date(Date.UTC(y, 0, 1, 12))));
  const dm = (L) => [Math.floor(L / 30), (L % 30)];
  const near = (L, sign, deg, min) => dm(L)[0] === sign && Math.abs(dm(L)[1] - (deg + min / 60)) < 2.5 / 60;
  const s2000 = at(2000), s2020 = at(2020), s2050 = at(2050);
  ok("Stars 2000 match the standard epoch-2000 table (Algol 26♉10, Regulus 29♌50, Spica 23♎50, Antares 9♐46)",
     near(s2000.Algol, 1, 26, 10) && near(s2000.Regulus, 4, 29, 50) && near(s2000.Spica, 6, 23, 50) && near(s2000.Antares, 8, 9, 46));
  ok("Stars 2020 match published 2020 longitudes (Algol 26♉26, Spica 24♎06, Arcturus 24♎30)",
     near(s2020.Algol, 1, 26, 26) && near(s2020.Spica, 6, 24, 6) && near(s2020.Arcturus, 6, 24, 30));
  ok("Stars 2050 match published 2050 longitudes (Spica 24♎33, Arcturus 24♎56)", near(s2050.Spica, 6, 24, 33) && near(s2050.Arcturus, 6, 24, 56));
  ok("Regulus crossed into Virgo in late 2011", at(2011).Regulus < 150 && at(2012.5).Regulus > 150);
  ok("Mansion 3 runs 25°43′ Aries to 8°34′ Taurus", X.manzilOf(25.72) === 3 && X.manzilOf(25.70) === 2 && X.manzilOf(38.57) === 3 && X.manzilOf(38.58) === 4);
  const w = X.mansionWindows(A, { n: 3, from: new Date(Date.UTC(2026, 10, 22)), days: 60 });
  const moon = (d) => A.EclipticGeoMoon(d).lon;
  ok("Mansion finder: windows recur every ~27.3 days and last about a day", w.length >= 2 && w.every(x => !x.enter || !x.exit || (x.exit - x.enter) / 36e5 > 18 && (x.exit - x.enter) / 36e5 < 30) &&
     Math.abs((w[1].enter - w[0].enter) / 864e5 - 27.3) < 1);
  ok("Mansion finder: Moon sits on the boundaries at entry and exit", Math.abs(moon(w[0].enter) - 360 / 28 * 2) < 0.01 && Math.abs(moon(w[0].exit) - 360 / 28 * 3) < 0.01);
  console.log(`star and mansion tests passed (${pass} assertions in all).`);
}

// --- ashtakavarga vs PyJHora 5.0.5 (appended v19). fixtures-pyjhora.json holds the reference output. ---
{
  const X = require("./extras.js"), F = require("./fixtures-pyjhora.json"), P = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  for (const who of ["joni", "control"]) {
    const sg = F[who].signs, signs = { Lagna: sg[0], Sun: sg[1], Moon: sg[2], Mars: sg[3], Mercury: sg[4], Jupiter: sg[5], Venus: sg[6], Saturn: sg[7] };
    const a = X.ashtakavargaTable(signs, "jhora"), b = X.ashtakavargaTable(signs, "alt");
    ok(`Ashtakavarga ${who}: all 84 cells and the SAV row match the reference (Jagannatha Hora tables)`,
       P.every((p, i) => a.bav[p].join() === F[who].bav[i].join()) && a.sav.join() === F[who].sav.join());
    ok(`Ashtakavarga ${who}: all 84 cells match the reference with its variant switches off (alternate tables)`, P.every((p, i) => b.bav[p].join() === F[who].alt[i].join()));
    ok(`Ashtakavarga ${who}: row totals 48/49/39/54/56/52/39 in both variants`, [a, b].every(t => P.map(p => t.bav[p].reduce((x, y) => x + y, 0)).join() === "48,49,39,54,56,52,39"));
  }
  console.log(`ashtakavarga tests passed (${pass} assertions in all).`);
}
