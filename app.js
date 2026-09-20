/* Calculador — all client-side. Engines: Astronomy (window.Astronomy),
   lunar-javascript (window.Solar etc.), iztro (window.iztro). */
(function () {
  "use strict";
  /* ---------- gloss layer ---------- */
  const GLOSS = {
    "命宫":"Life","兄弟":"Siblings","夫妻":"Spouse","子女":"Children","财帛":"Wealth","疾厄":"Health",
    "迁移":"Travel","仆役":"Friends","官禄":"Career","田宅":"Property","福德":"Wellbeing","父母":"Parents",
    "紫微":"Zi Wei","天机":"Tian Ji","太阳":"Sun","武曲":"Wu Qu","天同":"Tian Tong","廉贞":"Lian Zhen",
    "天府":"Tian Fu","太阴":"Moon","贪狼":"Tan Lang","巨门":"Ju Men","天相":"Tian Xiang","天梁":"Tian Liang",
    "七杀":"Qi Sha / 7 Killings","破军":"Po Jun",
    "左辅":"Zuo Fu","右弼":"You Bi","文昌":"Wen Chang","文曲":"Wen Qu","天魁":"Tian Kui","天钺":"Tian Yue",
    "禄存":"Lu Cun","天马":"Tian Ma","擎羊":"Qing Yang","陀罗":"Tuo Luo","火星":"Fire Star","铃星":"Bell Star",
    "地空":"Di Kong","地劫":"Di Jie",
    "庙":"exalted","旺":"strong","得":"good","利":"fair","平":"neutral","不":"weak","陷":"fallen",
    "禄":"Lu","权":"Quan","科":"Ke","忌":"Ji",
    "水二局":"Water-2","木三局":"Wood-3","金四局":"Metal-4","土五局":"Earth-5","火六局":"Fire-6",
    "甲":"yang wood","乙":"yin wood","丙":"yang fire","丁":"yin fire","戊":"yang earth","己":"yin earth",
    "庚":"yang metal","辛":"yin metal","壬":"yang water","癸":"yin water",
    "子":"Rat","丑":"Ox","寅":"Tiger","卯":"Rabbit","辰":"Dragon","巳":"Snake","午":"Horse","未":"Goat",
    "申":"Monkey","酉":"Rooster","戌":"Dog","亥":"Pig",
    "比肩":"Friend","劫财":"Rob Wealth","食神":"Eating God","伤官":"Hurting Officer","正财":"Direct Wealth",
    "偏财":"Indirect Wealth","正官":"Direct Officer","正印":"Direct Resource","偏印":"Indirect Resource","日主":"Day Master",
    "華蓋":"Canopy","天乙貴人":"Heavenly Noble","天喜":"Sky Happiness","桃花":"Peach Blossom","驛馬":"Travel Horse",
    "將星":"General Star","羊刃":"Yang Blade","紅鸞":"Red Phoenix","空亡":"Void",
  };
  let glossOn = localStorage.getItem("calculador.gloss") !== "off";
  function g(zh) {
    if (!zh) return zh;
    const en = GLOSS[zh];
    return en ? `${zh}<span class="gl">${en}</span>` : zh;
  }

  const $ = (id) => document.getElementById(id);
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
                 "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ---------- profiles ---------- */
  const STORE = "calculador.profiles.v1";
  function getProfiles() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; }
    catch { return {}; }
  }
  function setProfiles(p) { localStorage.setItem(STORE, JSON.stringify(p)); }
  function readForm() {
    return {
      name: $("pname").value.trim(),
      date: $("bdate").value,
      time: $("btime").value,
      clockoff: parseFloat($("clockoff").value),
      stdoff: parseFloat($("stdoff").value),
      lat: parseFloat($("lat").value),
      lon: parseFloat($("lon").value),
      gender: $("gender").value,
      solartime: $("solartime").checked,
    };
  }
  function fillForm(p) {
    $("pname").value = p.name; $("bdate").value = p.date; $("btime").value = p.time;
    $("clockoff").value = p.clockoff; $("stdoff").value = p.stdoff;
    $("lat").value = p.lat; $("lon").value = p.lon; $("gender").value = p.gender;
    $("solartime").checked = p.solartime !== false;
  }
  function refreshProfileList() {
    const sel = $("profileSel"), names = Object.keys(getProfiles()).sort();
    sel.innerHTML = "";
    for (const n of names) {
      const o = document.createElement("option");
      o.value = n; o.textContent = n; sel.appendChild(o);
    }
  }

  /* ---------- shared time math ---------- */
  function utDate(p) {
    const [y, m, d] = p.date.split("-").map(Number);
    const [hh, mm] = p.time.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mm) - p.clockoff * 3600e3);
  }
  function standardLocal(p) {
    // components of local *standard* time (BaZi/ZWDS convention)
    const t = new Date(utDate(p).getTime() + p.stdoff * 3600e3);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
             hh: t.getUTCHours(), mm: t.getUTCMinutes() };
  }

  function trueSolarLocal(p) {
    const A = window.Astronomy, ut = utDate(p);
    const obs = new A.Observer(p.lat, p.lon, 0);
    const ra = A.Equator(A.Body.Sun, ut, obs, true, true).ra;
    const gast = A.SiderealTime(ut);
    const ha = ((gast * 15 + p.lon - ra * 15) % 360 + 360) % 360;
    const tst = (ha / 15 + 12) % 24;
    const lmt = new Date(ut.getTime() + (p.lon / 15) * 3600e3);
    let d = new Date(Date.UTC(lmt.getUTCFullYear(), lmt.getUTCMonth(), lmt.getUTCDate()));
    const lmtH = lmt.getUTCHours() + lmt.getUTCMinutes() / 60;
    if (tst - lmtH > 12) d = new Date(d.getTime() - 864e5);
    if (lmtH - tst > 12) d = new Date(d.getTime() + 864e5);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
             hh: Math.floor(tst), mm: Math.floor((tst % 1) * 60) };
  }
  function chineseTime(p) { return p.solartime ? trueSolarLocal(p) : standardLocal(p); }
  function fmtLon(L) {
    const s = Math.floor(L / 30), deg = L - s * 30;
    const min = Math.round((deg % 1) * 60);
    return `${Math.floor(deg)}°${String(min).padStart(2, "0")}′ ${SIGNS[s]}`;
  }

  /* ---------- Western ---------- */
  function placidusCusps(ramc, lat, eps, asc, mc) {
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
    const cu = new Array(13);
    cu[1] = asc; cu[2] = c2; cu[3] = c3; cu[4] = (mc + 180) % 360;
    cu[5] = (c11 + 180) % 360; cu[6] = (c12 + 180) % 360;
    cu[7] = (asc + 180) % 360; cu[8] = (c2 + 180) % 360;
    cu[9] = (c3 + 180) % 360; cu[10] = mc; cu[11] = c11; cu[12] = c12;
    return cu;
  }
  function placidusHouse(cu, L) {
    for (let h = 1; h <= 12; h++) {
      const a = cu[h], b = cu[h === 12 ? 1 : h + 1];
      if (((L - a + 360) % 360) < ((b - a + 360) % 360)) return h;
    }
    return 0;
  }

  function bodyLon(name, date) {
    const A = window.Astronomy;
    if (name === "Sun") return A.SunPosition(date).elon;
    if (name === "Moon") return A.EclipticGeoMoon(date).lon;
    return A.Ecliptic(A.GeoVector(A.Body[name], date, true)).elon;
  }
  let bodyLonCache = {};
  function calcWestern(p) {
    bodyLonCache = {};
    const A = window.Astronomy;
    const date = utDate(p);
    const gast = A.SiderealTime(date);
    const ramc = (((gast + p.lon / 15) * 15) % 360 + 360) % 360;
    const eps = 23.4393 * D2R; // mean obliquity, good to ~arcmin over ±1 century
    let mc = Math.atan2(Math.sin(ramc * D2R), Math.cos(ramc * D2R) * Math.cos(eps)) * R2D;
    mc = (mc + 360) % 360;
    let asc = Math.atan2(Math.cos(ramc * D2R),
      -(Math.sin(ramc * D2R) * Math.cos(eps) + Math.tan(p.lat * D2R) * Math.sin(eps))) * R2D;
    asc = (asc + 360) % 360;
    const ascSign = Math.floor(asc / 30);
    const bodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
    const cusps = placidusCusps(ramc, p.lat, eps, asc, mc);
    const rows = bodies.map((b) => {
      const L = bodyLon(b, date);
      bodyLonCache[b] = L;
      const L2 = bodyLon(b, new Date(date.getTime() + 3600e3));
      const rx = b !== "Sun" && b !== "Moon" &&
                 (((L2 - L + 540) % 360) - 180) < 0;
      const house = ((Math.floor(L / 30) - ascSign + 12) % 12) + 1;
      const ph = cusps ? placidusHouse(cusps, L) : "—";
      return { body: b, lon: L, rx, house, ph };
    });
    return { rows, asc, mc, cusps };
  }
  function renderWestern(w) {
    const tb = $("planetTable").querySelector("tbody");
    tb.innerHTML = "";
    for (const r of w.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.body}${r.rx ? ' <span class="rx">Rx</span>' : ""}</td>` +
        `<td>${fmtLon(r.lon)}</td><td class="num">${r.lon.toFixed(2)}°</td><td>P${r.ph} · WS${r.house}</td>`;
      tb.appendChild(tr);
    }
    $("anglesOut").innerHTML =
      `<span>Asc ${fmtLon(w.asc)}</span><span>MC ${fmtLon(w.mc)}</span>`;
    const dg = dignities(w);
    const lp = lotsAndProfection(w, $("bdate").value);
    let html = `<p class="bazimeta">${dg.isDay ? "Diurnal" : "Nocturnal"} chart. ` +
      `Fortune ${fmtLon(lp.fortune)} · Spirit ${fmtLon(lp.spirit)}.\n` +
      `Profection age ${lp.age}: ${SIGNS[lp.profSign]} (${lp.lord} lord of the year).</p>` +
      `<table><thead><tr><th>Planet</th><th>Essential dignity</th><th>Bound</th><th>Face</th><th>Sect</th></tr></thead><tbody>`;
    for (const d of dg.out) html += `<tr><td>${d.body}</td><td>${d.dig}</td><td>${d.bound}</td><td>${d.face}</td><td>${d.sect}</td></tr>`;
    $("dignityOut").innerHTML = html + "</tbody></table>";
    lastW = w;
    renderWheel(w, lastTransits);
  }


  const DOMICILE = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
  const EXALT = { Sun:0, Moon:1, Mercury:5, Venus:11, Mars:9, Jupiter:3, Saturn:6 };
  const TRIP = { // element: [day, night, participating] (Dorothean)
    fire:["Sun","Jupiter","Saturn"], earth:["Venus","Moon","Mars"],
    air:["Saturn","Mercury","Jupiter"], water:["Venus","Mars","Moon"] };
  const ELEM = ["fire","earth","air","water"];

  const BOUNDS = [ // Egyptian: [planet, endDeg] per sign — verified against flatlib
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
  function boundLord(L) {
    const sign = Math.floor(L / 30), deg = L - sign * 30;
    for (const [pl, end] of BOUNDS[sign]) if (deg < end) return pl;
    return BOUNDS[sign][4][0];
  }
  function faceLord(L) {
    const sign = Math.floor(L / 30), dec = Math.floor((L - sign * 30) / 10);
    return CHALDEAN[(sign * 3 + dec) % 7];
  }
  function dignities(w) {
    const sunOff = ((bodyLonCache.Sun - w.asc) + 360) % 360;
    const isDay = sunOff >= 180; // above horizon
    const out = [];
    for (const r of w.rows) {
      if (!(r.body in EXALT) && DOMICILE.indexOf(r.body) < 0) continue;
      const sign = Math.floor(r.lon / 30);
      const d = [];
      if (DOMICILE[sign] === r.body) d.push("domicile");
      if (EXALT[r.body] === sign) d.push("exaltation");
      if (DOMICILE[(sign + 6) % 12] === r.body) d.push("detriment");
      if (EXALT[r.body] === (sign + 6) % 12) d.push("fall");
      const t = TRIP[ELEM[sign % 4]];
      if ((isDay ? t[0] : t[1]) === r.body) d.push("triplicity");
      else if (t[2] === r.body) d.push("triplicity (part.)");
      const bl = boundLord(r.lon), fl = faceLord(r.lon);
      if (bl === r.body) d.push("own bound");
      if (fl === r.body) d.push("own face");
      const diurnalP = ["Sun","Jupiter","Saturn"].includes(r.body);
      const nocturnalP = ["Moon","Venus","Mars"].includes(r.body);
      let sect = "";
      if (diurnalP) sect = isDay ? "of sect" : "out of sect";
      if (nocturnalP) sect = isDay ? "out of sect" : "of sect";
      out.push({ body: r.body, dig: d.join(", ") || "peregrine", sect, bound: bl, face: fl });
    }
    return { isDay, out };
  }
  function lotsAndProfection(w, birthDateStr) {
    const sun = bodyLonCache.Sun, moon = bodyLonCache.Moon;
    const sunOff = ((sun - w.asc) + 360) % 360, isDay = sunOff >= 180;
    const fortune = ((isDay ? w.asc + moon - sun : w.asc + sun - moon) % 360 + 360) % 360;
    const spirit = ((isDay ? w.asc + sun - moon : w.asc + moon - sun) % 360 + 360) % 360;
    const bd = new Date(birthDateStr), now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    const anniv = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (now < anniv) age--;
    const profSign = (Math.floor(w.asc / 30) + (age % 12)) % 12;
    return { fortune, spirit, age, profSign, lord: DOMICILE[profSign] };
  }

  let lastW = null, lastTransits = null;
  function calcTransits(dateStr, w) {
    const td = new Date(dateStr + "T12:00:00Z");
    const rows = [];
    for (const b of ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]) {
      rows.push({ body: b, lon: bodyLon(b, td) });
    }
    const hits = [];
    const ASP = [[0, "conj"], [60, "sext"], [90, "square"], [120, "trine"], [180, "opp"]];
    for (const t of rows) for (const n of w.rows) {
      const d = Math.abs(((t.lon - n.lon + 540) % 360) - 180);
      for (const [ang, name] of ASP) {
        const orb = Math.abs(d - ang);
        if (orb <= 3) hits.push({ t: t.body, n: n.body, name, orb });
      }
    }
    hits.sort((a, b) => a.orb - b.orb);
    return { rows, hits, dateStr };
  }
  function renderTransits(tr) {
    let html = `<p class="bazimeta">Transits ${tr.dateStr} (12:00 UT — Moon can be ±6° across the day):</p>`;
    if (!tr.hits.length) html += `<p class="bazimeta">No aspects within 3° orb.</p>`;
    else {
      html += `<table><thead><tr><th>Transit</th><th>Aspect</th><th>Natal</th><th class="num">Orb</th></tr></thead><tbody>`;
      for (const h of tr.hits) {
        const om = Math.floor(h.orb), os = Math.round((h.orb % 1) * 60);
        html += `<tr><td>${h.t} ${fmtLon(tr.rows.find(r=>r.body===h.t).lon)}</td><td>${h.name}</td><td>${h.n}</td><td class="num">${om}°${String(os).padStart(2,"0")}′</td></tr>`;
      }
      html += "</tbody></table>";
    }
    $("transitOut").innerHTML = html;
  }

  /* ---------- timing: firdaria, progressions, solar arc ---------- */
  const FIRD_D = [["Sun",10],["Venus",8],["Mercury",13],["Moon",9],["Saturn",11],["Jupiter",12],["Mars",7],["North Node",3],["South Node",2]];
  const FIRD_N = [["Moon",9],["Saturn",11],["Jupiter",12],["Mars",7],["North Node",3],["South Node",2],["Sun",10],["Venus",8],["Mercury",13]];
  function firdaria(isDay, ageY) {
    const seq = isDay ? FIRD_D : FIRD_N;
    const seven = seq.filter(x => !x[0].includes("Node"));
    const a = ageY % 75;
    let acc = 0, major = null, mStart = 0;
    for (const [pl, yrs] of seq) {
      if (a < acc + yrs) { major = [pl, yrs]; mStart = acc; break; }
      acc += yrs;
    }
    let sub = null, subEnd = 0;
    if (!major[0].includes("Node")) {
      const si = seven.findIndex(x => x[0] === major[0]);
      let sacc = mStart;
      for (let k = 0; k < 7; k++) {
        const [pl, yrs] = seven[(si + k) % 7];
        const len = major[1] * yrs / 70;
        if (a < sacc + len) { sub = pl; subEnd = sacc + len; break; }
        sacc += len;
      }
    }
    return { major: major[0], mStart, mEnd: mStart + major[1], sub, subEnd,
             cycles: Math.floor(ageY / 75) };
  }
  function timingCalc(p, w) {
    const bd = utDate(p), now = new Date();
    const ageY = (now - bd) / (365.2422 * 864e5);
    const sunLon = bodyLonCache.Sun;
    const isDay = ((sunLon - w.asc) + 360) % 360 >= 180;
    const f = firdaria(isDay, ageY);
    const progDate = new Date(bd.getTime() + ageY * 864e5);
    const bodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"];
    const prog = bodies.map(b => ({ body: b, lon: bodyLon(b, progDate) }));
    const arc = ((prog[0].lon - sunLon) % 360 + 360) % 360;
    const sa = w.rows.map(r => ({ body: r.body, lon: (r.lon + arc) % 360 }));
    const ASP = [[0,"conj"],[60,"sext"],[90,"square"],[120,"trine"],[180,"opp"]];
    const hits = [];
    const scanHits = (movers, tag) => {
      for (const t of movers) for (const n of w.rows.concat([{body:"Asc",lon:w.asc},{body:"MC",lon:w.mc}])) {
        const dd = Math.abs(((t.lon - n.lon + 540) % 360) - 180);
        for (const [ang, nm] of ASP) if (Math.abs(dd - ang) <= 1)
          hits.push({ tag, t: t.body, nm, n: n.body, orb: Math.abs(dd - ang) });
      }
    };
    scanHits(prog, "prog"); scanHits(sa, "SA");
    hits.sort((x, y) => x.orb - y.orb);
    return { ageY, f, prog, arc, hits };
  }
  function fmtAge(y0, birth) {
    const d = new Date(birth.getTime() + y0 * 365.2422 * 864e5);
    return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  function renderTiming(p, w) {
    const t = timingCalc(p, w);
    const bd = utDate(p);
    let h = `<p class="bazimeta">Firdaria: ${t.f.major}` +
      (t.f.sub ? ` / ${t.f.sub} (sub until ${fmtAge(t.f.subEnd, bd)})` : " (node period, no subs)") +
      ` — major ${fmtAge(t.f.mStart, bd)} to ${fmtAge(t.f.mEnd, bd)}. ` +
      `Convention: nodes follow Mars; subs \u00D7years/70.\n` +
      `Secondary progressions (today, day-for-year) — solar arc ${t.arc.toFixed(2)}\u00B0:</p>`;
    h += `<table><thead><tr><th>Progressed</th><th>Position</th></tr></thead><tbody>`;
    for (const pr of t.prog) h += `<tr><td>p${pr.body}</td><td>${fmtLon(pr.lon)}</td></tr>`;
    h += `</tbody></table>`;
    if (t.hits.length) {
      h += `<table><thead><tr><th>Directed</th><th>Aspect</th><th>Natal</th><th class="num">Orb</th></tr></thead><tbody>`;
      for (const x of t.hits) h += `<tr><td>${x.tag} ${x.t}</td><td>${x.nm}</td><td>${x.n}</td><td class="num">${x.orb.toFixed(2)}\u00B0</td></tr>`;
      h += `</tbody></table>`;
    } else h += `<p class="bazimeta">No progressed/SA hits within 1\u00B0.</p>`;
    $("timingOut").innerHTML = h;
  }
  /* ---------- wheel ---------- */
  const SIGN_GLYPHS = ["\u2648","\u2649","\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653"];
  const PLANET_GLYPHS = { Sun:"\u2609", Moon:"\u263D", Mercury:"\u263F", Venus:"\u2640",
    Mars:"\u2642", Jupiter:"\u2643", Saturn:"\u2644", Uranus:"\u2645",
    Neptune:"\u2646", Pluto:"\u2647" };
  const VS = "\uFE0E"; // force text-style glyphs, not emoji
  function renderWheel(w, transits) {
    const C = 200, pt = (L, r) => {
      const t = (180 - (L - w.asc)) * D2R;
      return [C + r * Math.cos(t), C + r * Math.sin(t)];
    };
    let s = `<svg viewBox="-26 -26 452 452" role="img" aria-label="Natal chart wheel">`;
    s += `<circle cx="200" cy="200" r="190" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
    s += `<circle cx="200" cy="200" r="164" fill="none" stroke="var(--ink)" stroke-width="1"/>`;
    s += `<circle cx="200" cy="200" r="70" fill="none" stroke="var(--rule)" stroke-width="1"/>`;
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = pt(i * 30, 164), [x2, y2] = pt(i * 30, 190);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--ink-faded)" stroke-width="1"/>`;
      const [gx, gy] = pt(i * 30 + 15, 177);
      s += `<text x="${gx}" y="${gy}" font-size="15" text-anchor="middle" dominant-baseline="central" fill="var(--ink)">${SIGN_GLYPHS[i]}${VS}</text>`;
    }
    if (w.cusps) {
      for (let h = 1; h <= 12; h++) {
        const angle = h === 1 || h === 4 || h === 7 || h === 10;
        const [x1, y1] = pt(w.cusps[h], 70), [x2, y2] = pt(w.cusps[h], 164);
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${angle ? "var(--ink)" : "var(--rule)"}" stroke-width="${angle ? 2 : 1}"/>`;
        const mid = w.cusps[h] + (((w.cusps[h === 12 ? 1 : h + 1] - w.cusps[h] + 360) % 360) / 2);
        const [nx, ny] = pt(mid, 82);
        s += `<text x="${nx}" y="${ny}" font-size="9" text-anchor="middle" dominant-baseline="central" fill="var(--ink-faded)">${h}</text>`;
      }
      const [ax, ay] = pt(w.asc, 197);
      s += `<text x="${ax}" y="${ay}" font-size="9" text-anchor="middle" dominant-baseline="central" fill="var(--ink)">Asc</text>`;
    }
    // aspect lines (to exact positions on inner circle)
    const ASPECTS = [[60, 4, "var(--thread)"], [90, 7, "var(--seal)"], [120, 7, "var(--thread)"], [180, 7, "var(--seal)"]];
    for (let i = 0; i < w.rows.length; i++) for (let j = i + 1; j < w.rows.length; j++) {
      const d = Math.abs(((w.rows[i].lon - w.rows[j].lon + 540) % 360) - 180);
      for (const [ang, orb, col] of ASPECTS) {
        if (Math.abs(d - ang) <= orb) {
          const [x1, y1] = pt(w.rows[i].lon, 70), [x2, y2] = pt(w.rows[j].lon, 70);
          s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1" opacity="0.55"/>`;
        }
      }
    }
    // planets: exact tick + glyph, radial nudge for clusters
    const sorted = [...w.rows].sort((a, b) => a.lon - b.lon);
    let lastLon = -99, level = 0;
    for (const r of sorted) {
      if (((r.lon - lastLon + 360) % 360) < 9) level = (level + 1) % 3; else level = 0;
      lastLon = r.lon;
      const [tx1, ty1] = pt(r.lon, 158), [tx2, ty2] = pt(r.lon, 164);
      s += `<line x1="${tx1}" y1="${ty1}" x2="${tx2}" y2="${ty2}" stroke="var(--seal)" stroke-width="1.5"/>`;
      const [gx, gy] = pt(r.lon, 140 - level * 18);
      s += `<text x="${gx}" y="${gy}" font-size="16" text-anchor="middle" dominant-baseline="central" fill="var(--ink)">${PLANET_GLYPHS[r.body]}${VS}</text>`;
      if (r.rx) s += `<text x="${gx + 9}" y="${gy + 7}" font-size="7" fill="var(--seal)">R</text>`;
    }
    if (transits) {
      for (const t of transits.rows) {
        const [x1, y1] = pt(t.lon, 190), [x2, y2] = pt(t.lon, 196);
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--thread)" stroke-width="1.5"/>`;
        const [gx, gy] = pt(t.lon, 208);
        s += `<text x="${gx}" y="${gy}" font-size="13" text-anchor="middle" dominant-baseline="central" fill="var(--thread)">${PLANET_GLYPHS[t.body]}${VS}</text>`;
      }
    }
    s += `</svg>`;
    $("wheel").innerHTML = s;
  }

  /* ---------- BaZi ---------- */
  const GROUP = { "申":"szc","子":"szc","辰":"szc","寅":"ywx","午":"ywx","戌":"ywx",
                  "巳":"syc","酉":"syc","丑":"syc","亥":"hmw","卯":"hmw","未":"hmw" };
  const TAOHUA = { szc:"酉", ywx:"卯", syc:"午", hmw:"子" };
  const YIMA   = { szc:"寅", ywx:"申", syc:"亥", hmw:"巳" };
  const HUAGAI = { szc:"辰", ywx:"戌", syc:"丑", hmw:"未" };
  const JIANGX = { szc:"子", ywx:"午", syc:"酉", hmw:"卯" };
  const TIANYI = { "甲":"丑未","戊":"丑未","庚":"丑未","乙":"子申","己":"子申",
                   "丙":"亥酉","丁":"亥酉","壬":"卯巳","癸":"卯巳","辛":"午寅" };
  const WENCHANG = { "甲":"巳","乙":"午","丙":"申","丁":"酉","戊":"申","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯" };
  const YANGREN = { "甲":"卯","丙":"午","戊":"午","庚":"酉","壬":"子" };
  const HONGLUAN = { "子":"卯","丑":"寅","寅":"丑","卯":"子","辰":"亥","巳":"戌","午":"酉","未":"申","申":"未","酉":"午","戌":"巳","亥":"辰" };
  const BR = "子丑寅卯辰巳午未申酉戌亥";
  function shenSha(pillars, dayStem, yearStem, xunKong) {
    const slots = [["年", pillars[0].gz[1]], ["月", pillars[1].gz[1]], ["日", pillars[2].gz[1]], ["時", pillars[3].gz[1]]];
    const yearBr = slots[0][1], dayBr = slots[2][1];
    const found = [];
    const scan = (star, targets, srcLabel) => {
      for (const [pos, br] of slots)
        if (targets.includes(br)) found.push(`${g(star)}@${pos}(${g(br)})${srcLabel}`);
    };
    for (const [src, br, tag] of [["年", yearBr, "从年"], ["日", dayBr, "从日"]]) {
      const g = GROUP[br];
      scan("桃花", TAOHUA[g], tag); scan("驛馬", YIMA[g], tag);
      scan("華蓋", HUAGAI[g], tag); scan("將星", JIANGX[g], tag);
    }
    scan("天乙貴人", TIANYI[dayStem] || "", "(日干)");
    if (yearStem !== dayStem) scan("天乙貴人", TIANYI[yearStem] || "", "(年干)");
    scan("文昌", WENCHANG[dayStem] || "", "");
    if (YANGREN[dayStem]) scan("羊刃", YANGREN[dayStem], "");
    scan("紅鸞", HONGLUAN[yearBr], "");
    scan("天喜", BR[(BR.indexOf(HONGLUAN[yearBr]) + 6) % 12], "");
    scan("空亡", xunKong, "");
    return [...new Set(found)];
  }

  function calcBazi(p) {
    const t = chineseTime(p);
    const solar = window.Solar.fromYmdHms(t.y, t.m, t.d, t.hh, t.mm, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    const yun = ec.getYun(p.gender === "male" ? 1 : 0);
    const dm = ec.getDay()[0];
    const nowY = new Date().getFullYear();
    const luckArr = yun.getDaYun().filter(x => x.getGanZhi()).slice(0, 9).map(x => ({
      gz: x.getGanZhi(), age: x.getStartAge(), year: x.getStartYear(),
      god: window.LunarUtil.SHI_SHEN[dm + x.getGanZhi()[0]] || "",
      current: nowY >= x.getStartYear() && nowY < x.getStartYear() + 10,
    }));
    const pillarsTmp = [
      { gz: ec.getYear() }, { gz: ec.getMonth() }, { gz: ec.getDay() }, { gz: ec.getTime() }];
    const stars = shenSha(pillarsTmp, dm, ec.getYear()[0], lunar.getDayXunKong());
    const xk = lunar.getDayXunKong();
    const voidLuck = luckArr.filter(l => xk.includes(l.gz[1])).map(l => `${l.gz}@${l.age}`);
    return {
      luckArr, stars, xk, voidLuck,
      luckDir: yun.isForward() ? "forward" : "backward",
      timeUsed: `${t.hh}:${String(t.mm).padStart(2, "0")}` + (p.solartime ? " true solar" : " standard"),
      pillars: [
        { role: "Year 年", gz: ec.getYear(), hide: ec.getYearHideGan(), god: ec.getYearShiShenGan(), zgods: ec.getYearShiShenZhi() },
        { role: "Month 月", gz: ec.getMonth(), hide: ec.getMonthHideGan(), god: ec.getMonthShiShenGan(), zgods: ec.getMonthShiShenZhi() },
        { role: "Day 日", gz: ec.getDay(), hide: ec.getDayHideGan(), dm: true, god: "日主", zgods: ec.getDayShiShenZhi() },
        { role: "Hour 時", gz: ec.getTime(), hide: ec.getTimeHideGan(), god: ec.getTimeShiShenGan(), zgods: ec.getTimeShiShenZhi() },
      ],
      today: (function(){ const n = window.Lunar.fromDate(new Date());
        return `${n.getYearInGanZhi()} ${n.getMonthInGanZhi()} ${n.getDayInGanZhi()}`; })(),
      lunarStr: lunar.toString(),
    };
  }
  function renderBazi(b) {
    const out = $("pillarsOut");
    out.innerHTML = "";
    for (const pl of b.pillars) {
      const div = document.createElement("div");
      div.className = "pillar" + (pl.dm ? " daymaster" : "");
      div.innerHTML = `<div class="role">${pl.role}</div>` +
        `<div class="god">${g(pl.god)}</div>` +
        `<div class="gan">${g(pl.gz[0])}</div><div class="zhi">${g(pl.gz[1])}</div>` +
        `<div class="hide">藏 ${pl.hide.map((hg, i) => hg + "·" + g(pl.zgods[i])).join(" ")}</div>`;
      out.appendChild(div);
    }
    const lk = $("luckOut");
    lk.innerHTML = `<p class="bazimeta">Luck pillars 大運 (${b.luckDir}):</p>`;
    const row = document.createElement("div");
    row.className = "luckrow";
    for (const l of b.luckArr) {
      const div = document.createElement("div");
      div.className = "pillar small" + (l.current ? " nowpillar" : "");
      div.innerHTML = `<div class="role">${l.age}歲<br>${l.year}</div>` +
        `<div class="god">${g(l.god)}</div>` +
        `<div class="gan">${g(l.gz[0])}</div><div class="zhi">${g(l.gz[1])}</div>`;
      row.appendChild(div);
    }
    lk.appendChild(row);
    let ss = `<p class="bazimeta">神煞: ${b.stars.length ? b.stars.join("\u2002") : "—"}\n` +
      `${g("空亡")} (day ${b.xk})` + (b.voidLuck.length ? ` — void luck pillars: ${b.voidLuck.join(", ")}` : "") + `</p>`;
    lk.insertAdjacentHTML("beforeend", ss);
    $("baziMeta").innerHTML =
      `Lunar date: ${b.lunarStr}. Day master in red. Hour from ${b.timeUsed} time.\n` +
      `Today's pillars: ${b.today}\n` +
      `神煞 conventions: 天乙 uses 甲戊庚→丑未; group stars checked from year and day branch.`;
  }

  /* ---------- ZWDS ---------- */
  const GRID = { "巳": [1, 1], "午": [2, 1], "未": [3, 1], "申": [4, 1],
                 "辰": [1, 2], "酉": [4, 2], "卯": [1, 3], "戌": [4, 3],
                 "寅": [1, 4], "丑": [2, 4], "子": [3, 4], "亥": [4, 4] };
  function timeIndex(hh) { return hh === 23 ? 12 : Math.floor((hh + 1) / 2); }
  function calcZwds(p) {
    const t = chineseTime(p);
    const dateStr = `${t.y}-${t.m}-${t.d}`;
    return window.iztro.astro.bySolar(dateStr, timeIndex(t.hh), p.gender, true, "zh-CN");
  }
  function renderZwds(chart, p) {
    const out = $("zwOut");
    out.innerHTML = "";
    for (const pal of chart.palaces) {
      const cell = document.createElement("div");
      const pos = GRID[pal.earthlyBranch];
      cell.className = "palace" + (pal.name === "命宫" ? " ming" : "");
      cell.style.gridColumn = pos[0];
      cell.style.gridRow = pos[1];
      const majors = pal.majorStars.map(s =>
        g(s.name) + (s.brightness ? `(${g(s.brightness)})` : "") + (s.mutagen ? `·${g(s.mutagen)}` : "")).join(" ");
      const minors = pal.minorStars.map(s => g(s.name)).join(" ");
      cell.innerHTML = `<div class="pname">${g(pal.name)}</div>` +
        `<div class="major">${majors || "—"}</div>` +
        `<div class="minor">${minors}</div>` +
        `<div class="pbranch">${pal.heavenlyStem}${pal.earthlyBranch}</div>`;
      out.appendChild(cell);
    }
    const center = document.createElement("div");
    center.className = "zwcenter";
    center.innerHTML = `<div class="who">${p.name || "—"}</div>` +
      `<div class="bureau">${g(chart.fiveElementsClass)}</div>` +
      `<div class="meta">${chart.lunarDate}<br>${chart.chineseDate}</div>`;
    out.appendChild(center);
  }

  /* ---------- Jyotish (sidereal, Lahiri) ---------- */
  const RASI = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
                "Tula","Vrischika","Dhanu","Makara","Kumbha","Meena"];
  const NAKS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
                "Magha","P.Phalguni","U.Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
                "Mula","P.Ashadha","U.Ashadha","Shravana","Dhanishta","Shatabhisha","P.Bhadrapada","U.Bhadrapada","Revati"];
  const DASHA = [["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
  const GRAHA_AB = { Lagna:"As", Sun:"Su", Moon:"Mo", Mars:"Ma", Mercury:"Me",
                     Jupiter:"Ju", Venus:"Ve", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke" };
  function lahiri(date) {
    const t = (date.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
    return 23.85306 + (5028.796195 * t + 1.1054348 * t * t) / 3600;
  }
  function meanNode(date) {
    const t = (date.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
    return ((125.04452 - 1934.136261 * t + 0.0020708 * t * t) % 360 + 360) % 360;
  }
  function fmtSid(L) {
    const s = Math.floor(L / 30), deg = L - s * 30, min = Math.round((deg % 1) * 60);
    return `${Math.floor(deg)}°${String(min).padStart(2, "0")}′ ${RASI[s]}`;
  }
  function nakOf(L) {
    const w = 360 / 27, i = Math.floor(L / w);
    return { i, name: NAKS[i], pada: Math.floor((L % w) / (w / 4)) + 1,
             lord: DASHA[i % 9][0], frac: (L % w) / w };
  }
  const navamsaSign = (L) => Math.floor(L / (10 / 3)) % 12;
  function calcJyotish(p, w) {
    const date = utDate(p), ayan = lahiri(date);
    const sid = (L) => ((L - ayan) % 360 + 360) % 360;
    const lagna = sid(w.asc);
    const rahu = sid(meanNode(date)), ketu = (rahu + 180) % 360;
    const grahas = [{ body: "Lagna", lon: lagna }];
    for (const b of ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]) {
      const r = w.rows.find(x => x.body === b);
      grahas.push({ body: b, lon: sid(r.lon), rx: r.rx });
    }
    grahas.push({ body: "Rahu", lon: rahu, rx: true }, { body: "Ketu", lon: ketu, rx: true });
    const lagnaSign = Math.floor(lagna / 30);
    for (const g2 of grahas) {
      g2.sign = Math.floor(g2.lon / 30);
      g2.house = ((g2.sign - lagnaSign + 12) % 12) + 1;
      g2.nak = nakOf(g2.lon);
      g2.nav = navamsaSign(g2.lon);
    }
    /* vimshottari from Moon's nakshatra */
    const moon = grahas.find(x => x.body === "Moon");
    const YR = 365.25 * 864e5, now = Date.now();
    const li = moon.nak.i % 9;
    let t0 = date.getTime() - moon.nak.frac * DASHA[li][1] * YR;
    const mds = [];
    for (let k = 0; k < 9; k++) {
      const [lord, yrs] = DASHA[(li + k) % 9], end = t0 + yrs * YR;
      mds.push({ lord, yrs, start: t0, end, idx: (li + k) % 9, current: now >= t0 && now < end });
      t0 = end;
    }
    const curMd = mds.find(x => x.current) || mds[0];
    const ads = []; let a0 = curMd.start;
    for (let k = 0; k < 9; k++) {
      const [lord, yrs] = DASHA[(curMd.idx + k) % 9], len = curMd.yrs * yrs / 120 * YR;
      ads.push({ lord, start: a0, end: a0 + len, current: now >= a0 && now < a0 + len });
      a0 += len;
    }
    /* graha drishti (sign-based) */
    const DRISHTI = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10] };
    const asp = [];
    for (const g2 of grahas) {
      if (["Lagna","Rahu","Ketu"].includes(g2.body)) continue;
      const hs = [7, ...(DRISHTI[g2.body] || [])]
        .map(n => ((g2.house - 1 + n - 1) % 12) + 1).sort((a, b) => a - b);
      asp.push({ body: g2.body, house: g2.house, hits: hs });
    }
    const j = { ayan, lagna, lagnaSign, grahas, mds, curMd, ads, asp };
    annotateJy(j);
    j.yogas = calcYogas(j);
    /* birth panchanga (sidereal Sun/Moon) */
    const TITHI = ["Pratipad\u0101","Dvit\u012By\u0101","Trit\u012By\u0101","Chaturth\u012B","Pa\u00F1cham\u012B","\u1E62a\u1E63\u1E6Dh\u012B","Saptam\u012B","A\u1E63\u1E6Dam\u012B","Navam\u012B","Da\u015Bam\u012B","Ek\u0101da\u015B\u012B","Dv\u0101da\u015B\u012B","Trayoda\u015B\u012B","Chaturda\u015B\u012B"];
    const NITYA = ["Vi\u1E63kambha","Pr\u012Bti","\u0100yu\u1E63m\u0101n","Saubh\u0101gya","\u015Aobhana","Atiga\u1E47\u1E0Da","Sukarm\u0101","Dh\u1E5Bti","\u015A\u016Bla","Ga\u1E47\u1E0Da","V\u1E5Bddhi","Dhruva","Vy\u0101gh\u0101ta","Har\u1E63a\u1E47a","Vajra","Siddhi","Vyat\u012Bp\u0101ta","Var\u012By\u0101n","Parigha","\u015Aiva","Siddha","S\u0101dhya","\u015Aubha","\u015Aukla","Brahma","Indra","Vaidh\u1E5Bti"];
    const KARM = ["Bava","B\u0101lava","Kaulava","Taitila","Gara","Va\u1E47ija","Vi\u1E63\u1E6Di"];
    const VARA = ["Raviv\u0101ra","Somav\u0101ra","Ma\u1E45galav\u0101ra","Budhav\u0101ra","Guruv\u0101ra","\u015Aukrav\u0101ra","\u015Aaniv\u0101ra"];
    const sunL = j.G.Sun.lon, moonL = j.G.Moon.lon;
    const el = (moonL - sunL + 360) % 360, ti = Math.floor(el / 12);
    const tname = ti === 14 ? "P\u016Br\u1E47im\u0101" : ti === 29 ? "Am\u0101vasy\u0101" : TITHI[ti % 15];
    const k = Math.floor(el / 6);
    j.panch = {
      vara: VARA[new Date(p.date + "T12:00:00Z").getUTCDay()],
      tithi: `${ti < 15 ? "\u015Aukla" : "K\u1E5B\u1E63\u1E47a"} ${tname}`,
      ny: NITYA[Math.floor(((sunL + moonL) % 360) / (360 / 27))],
      kar: k === 0 ? "Ki\u1E43stughna" : k >= 57 ? ["\u015Aakuni","Chatu\u1E63pada","N\u0101ga"][k - 57] : KARM[(k - 1) % 7],
    };
    /* sadhe sati (today's transit Saturn vs natal Moon sign) */
    const nowD = new Date();
    const satNow = ((bodyLon("Saturn", nowD) - lahiri(nowD)) % 360 + 360) % 360;
    const sh = ((Math.floor(satNow / 30) - j.G.Moon.sign + 12) % 12) + 1;
    j.sadhe = { satSign: Math.floor(satNow / 30), h: sh,
      phase: sh === 12 ? "ACTIVE \u2014 first (rising) phase" : sh === 1 ? "ACTIVE \u2014 second (peak) phase"
           : sh === 2 ? "ACTIVE \u2014 third (setting) phase" : sh === 4 || sh === 8 ? `dhaiyy\u0101/pano\u1E6Di (Saturn ${sh}th from Moon)` : "not active" };
    return j;
  }

  /* ---- yogas: dignity/combustion annotations + ~27 mechanical detectors ---- */
  const J_EXALT = { Sun:0, Moon:1, Mars:9, Mercury:5, Jupiter:3, Venus:11, Saturn:6 };
  const J_LORD = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
  const COMBUST_ORB = { Moon:12, Mars:17, Mercury:[14,12], Jupiter:11, Venus:[10,8], Saturn:15 };
  const KENDRA = [1,4,7,10], TRIKONA = [1,5,9], DUSTHANA = [6,8,12], UPACHAYA = [3,6,10,11];
  function annotateJy(j) {
    const G = {}; for (const g2 of j.grahas) G[g2.body] = g2;
    for (const g2 of j.grahas) {
      if (g2.body === "Lagna") continue;
      if (g2.body in J_EXALT) {
        if (g2.sign === J_EXALT[g2.body]) g2.dig = "exalted";
        else if (g2.sign === (J_EXALT[g2.body] + 6) % 12) g2.dig = "debilitated";
        else if (J_LORD[g2.sign] === g2.body) g2.dig = "own";
      }
      const co = COMBUST_ORB[g2.body];
      if (co !== undefined) {
        const orb = Array.isArray(co) ? co[g2.rx ? 1 : 0] : co;
        if (Math.abs(((g2.lon - G.Sun.lon + 540) % 360) - 180) <= orb) g2.combust = true;
      }
    }
    j.waxing = ((G.Moon.lon - G.Sun.lon + 360) % 360) < 180;
    j.mercAfflicted = ["Mars","Saturn","Rahu","Ketu"].some(b => G[b].sign === G.Mercury.sign);
    j.benefics = ["Jupiter","Venus"].concat(j.mercAfflicted ? [] : ["Mercury"]).concat(j.waxing ? ["Moon"] : []);
    j.G = G;
  }
  function calcYogas(j) {
    const G = j.G, lagS = j.lagnaSign, moonS = G.Moon.sign, sunS = G.Sun.sign;
    const P7 = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
    const P9 = P7.concat(["Rahu","Ketu"]);
    const hf = (ref, s) => ((s - ref + 12) % 12) + 1;
    const Y = [];
    const flag = (g2) => { const f = [];
      if (g2.combust) f.push("combust");
      if (g2.dig === "debilitated") f.push("debilitated");
      return f.length ? ` [${f.join(", ")}]` : ""; };
    const MAHA = { Mars:"Ruchaka", Mercury:"Bhadra", Jupiter:"Ha\u1E43sa", Venus:"M\u0101lavya", Saturn:"\u015Aa\u015Ba" };
    for (const b in MAHA) { const g2 = G[b];
      if ((g2.dig === "own" || g2.dig === "exalted") && KENDRA.includes(g2.house))
        Y.push({ name: MAHA[b], rule: `${b} ${g2.dig} in kendra H${g2.house}${flag(g2)}` }); }
    const jh = hf(moonS, G.Jupiter.sign);
    if (KENDRA.includes(jh))
      Y.push({ name: "Gajakesar\u012B", rule: `Jupiter in kendra (${jh}) from Moon${flag(G.Jupiter)}` });
    const at = (ref, off, pool) => pool.filter(b => G[b].sign === (ref + off) % 12);
    const m2 = at(moonS, 1, P7.filter(b => b !== "Moon" && b !== "Sun"));
    const m12 = at(moonS, 11, P7.filter(b => b !== "Moon" && b !== "Sun"));
    if (m2.length && m12.length) Y.push({ name: "Durudhar\u0101", rule: `${m2.join("+")} 2nd & ${m12.join("+")} 12th from Moon` });
    else if (m2.length) Y.push({ name: "Sunaph\u0101", rule: `${m2.join("+")} in 2nd from Moon` });
    else if (m12.length) Y.push({ name: "Anaph\u0101", rule: `${m12.join("+")} in 12th from Moon` });
    const s2 = at(sunS, 1, P7.filter(b => b !== "Sun" && b !== "Moon"));
    const s12 = at(sunS, 11, P7.filter(b => b !== "Sun" && b !== "Moon"));
    if (s2.length && s12.length) Y.push({ name: "Ubhayachar\u012B", rule: `${s2.join("+")} 2nd & ${s12.join("+")} 12th from Sun` });
    else if (s2.length) Y.push({ name: "Ve\u015Bi", rule: `${s2.join("+")} in 2nd from Sun` });
    else if (s12.length) Y.push({ name: "V\u0101\u015Bi", rule: `${s12.join("+")} in 12th from Sun` });
    if (sunS === G.Mercury.sign)
      Y.push({ name: "Budha-\u0100ditya", rule: `Sun+Mercury in ${RASI[sunS]}${G.Mercury.combust ? " [Mercury combust \u2014 closeness matters]" : ""}` });
    if (moonS === G.Mars.sign) Y.push({ name: "Chandra-Ma\u1E45gala", rule: `Moon+Mars in ${RASI[moonS]}` });
    if (G.Jupiter.sign === G.Rahu.sign)
      Y.push({ name: "Guru-Ch\u0101\u1E47\u1E0D\u0101la", rule: `Jupiter+Rahu in ${RASI[G.Jupiter.sign]} (Ketu variant not checked)`, bad: true });
    for (const [ref, label] of [[lagS, "lagna"], [moonS, "Moon"]]) {
      const occ = P7.filter(b => G[b].sign === (ref + 9) % 12);
      if (occ.length && occ.every(b => j.benefics.includes(b)))
        Y.push({ name: "Amala", rule: `only benefic(s) ${occ.join("+")} in 10th from ${label}` }); }
    const h2 = P9.filter(b => G[b].sign === (lagS + 1) % 12);
    const h12 = P9.filter(b => G[b].sign === (lagS + 11) % 12);
    if (h2.length && h12.length) {
      const all = h2.concat(h12);
      if (all.every(b => j.benefics.includes(b)))
        Y.push({ name: "\u015Aubha Kartari", rule: `lagna hemmed by benefics ${h12.join("+")}(12th) & ${h2.join("+")}(2nd)` });
      else if (all.every(b => !j.benefics.includes(b)))
        Y.push({ name: "P\u0101pa Kartari", rule: `lagna hemmed by malefics ${h12.join("+")}(12th) & ${h2.join("+")}(2nd)`, bad: true,
                 note: "softened if hemming planets are dignified or the hemmed lagna lord is strong" });
    }
    if (["Mercury","Jupiter","Venus"].every(b => [6,7,8].includes(hf(moonS, G[b].sign))))
      Y.push({ name: "Adhi", rule: `Me/Ju/Ve all in 6th\u20138th from Moon` });
    if (j.benefics.length >= 2 && j.benefics.every(b => UPACHAYA.includes(G[b].house)))
      Y.push({ name: "Vasumat\u012B", rule: `all benefics (${j.benefics.join("+")}) in upachayas from lagna (simplified)` });
    /* lordship machinery */
    const lordsOf = {}; for (const b of P7) lordsOf[b] = [];
    for (let h = 1; h <= 12; h++) lordsOf[J_LORD[(lagS + h - 1) % 12]].push(h);
    for (const b of P7) { const l = lordsOf[b];
      if (l.some(h => [4,7,10].includes(h)) && l.some(h => [5,9].includes(h)))
        Y.push({ name: "Yogak\u0101raka", rule: `${b} lords kendra & trikona (H${l.join(", H")})${flag(G[b])}` }); }
    const DR2 = { Mars: [4,8], Jupiter: [5,9], Saturn: [3,10] };
    const aspS = (b, from, to) => { const n = ((to - from + 12) % 12) + 1;
      return n === 7 || (DR2[b] || []).includes(n); };
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
        Y.push({ name: nm, rule: `${lordName(a)} + ${lordName(b)} ${s}${flag(G[a])}${flag(G[b])}`, bad }); } };
    const L = (h) => J_LORD[(lagS + h - 1) % 12];
    pairYoga(L(9), L(10), "Dharma-Karm\u0101dhipati R\u0101ja");
    for (const a of new Set(KENDRA.map(L))) for (const b of new Set(TRIKONA.map(L))) pairYoga(a, b, "R\u0101ja");
    for (const b of [L(5), L(9), L(1), L(11)]) pairYoga(L(2), b, "Dhana");
    for (const b of [L(5), L(9), L(1)]) pairYoga(L(11), b, "Dhana");
    const VIP = { 6: "Har\u1E63a", 8: "Sarala", 12: "Vimala" };
    for (const h of DUSTHANA) { const lord = L(h), g2 = G[lord], lh = hf(lagS, g2.sign);
      if (DUSTHANA.includes(lh))
        Y.push({ name: `Vipar\u012Bta (${VIP[h]})`, rule: `L${h} ${lord} in dusthana H${lh}` +
          (lordsOf[lord].length > 1 ? ` \u2014 also L${lordsOf[lord].filter(x => x !== h).join(",L")}, which dilutes it per some texts` : "") }); }
    const ex = new Set();
    for (const a of P7) { const D = J_LORD[G[a].sign];
      if (D === a) continue;
      if (J_LORD[G[D].sign] === a) { const key = [a, D].sort().join();
        if (ex.has(key)) continue; ex.add(key);
        const ha = hf(lagS, G[a].sign), hd = hf(lagS, G[D].sign);
        const cls = (DUSTHANA.includes(ha) || DUSTHANA.includes(hd)) ? "Dainya" : (ha === 3 || hd === 3) ? "Khala" : "Mah\u0101";
        Y.push({ name: `${cls} Parivartana`, rule: `${a}(H${ha}) \u21C4 ${D}(H${hd})`, bad: cls !== "Mah\u0101" }); } }
    { const l9 = L(9), g2 = G[l9];
      if ((g2.dig === "own" || g2.dig === "exalted") && (KENDRA.includes(g2.house) || TRIKONA.includes(g2.house)))
        Y.push({ name: "Lak\u1E63m\u012B", rule: `L9 ${l9} ${g2.dig} in H${g2.house} (simplified: lagna-lord strength not scored)` }); }
    for (const b of P7) { const g2 = G[b];
      if (g2.dig !== "debilitated") continue;
      const conds = [], disp = J_LORD[g2.sign];
      const inKen = (x) => KENDRA.includes(hf(lagS, G[x].sign)) || KENDRA.includes(hf(moonS, G[x].sign));
      if (inKen(disp)) conds.push(`dispositor ${disp} in kendra from lagna/Moon`);
      const exalter = Object.keys(J_EXALT).find(e => J_EXALT[e] === g2.sign);
      if (exalter && exalter !== b && inKen(exalter)) conds.push(`${exalter} (exalted in ${RASI[g2.sign]}) in kendra`);
      if (J_LORD[G[disp].sign] === b) conds.push(`exchange with dispositor ${disp}`);
      if (conds.length) Y.push({ name: "N\u012Bcha Bha\u1E45ga", rule: `${b} debilitated in ${RASI[g2.sign]}; ${conds.join("; ")}` });
      else Y.push({ name: "(debilitation)", rule: `${b} debilitated in ${RASI[g2.sign]}, no bha\u1E45ga condition met`, bad: true }); }
    { const r = G.Rahu.lon, k = G.Ketu.lon;
      const inArc = (x, a, b) => ((x - a + 360) % 360) < ((b - a + 360) % 360);
      const s1 = P7.every(b => inArc(G[b].lon, r, k)), s2b = P7.every(b => inArc(G[b].lon, k, r));
      if (s1 || s2b) Y.push({ name: "K\u0101la Sarpa", rule: `all seven grahas within the ${s1 ? "Rahu\u2192Ketu" : "Ketu\u2192Rahu"} arc`, bad: true,
        note: "softens/breaks if any planet is degree-conjunct a node; many lineages don't use this yoga at all" }); }
    { const pool = ["Mars","Mercury","Jupiter","Venus","Saturn"];
      const near = pool.some(b => [0,1,11].includes((G[b].sign - moonS + 12) % 12));
      if (!near) {
        const canc = [];
        if (pool.concat(["Sun"]).some(b => KENDRA.includes(hf(moonS, G[b].sign)))) canc.push("planet in kendra from Moon");
        if (KENDRA.includes(hf(lagS, moonS))) canc.push("Moon in kendra from lagna");
        if (aspS("Jupiter", G.Jupiter.sign, moonS)) canc.push("Jupiter aspects Moon");
        Y.push({ name: "Kemadruma", rule: "no planet conjunct or 2nd/12th from Moon (Sun & nodes excluded)", bad: true,
          note: canc.length ? `cancelled/softened: ${canc.join("; ")}` : "no standard cancellation found (classical lists have more; check by eye)" }); } }
    { const refs = [["lagna", lagS], ["Moon", moonS], ["Venus", G.Venus.sign]];
      const hits = refs.map(([l, s]) => [l, hf(s, G.Mars.sign)]).filter(([, h]) => [1,2,4,7,8,12].includes(h));
      if (hits.length) { const soft = G.Mars.dig === "own" || G.Mars.dig === "exalted";
        Y.push({ name: "Ma\u1E45gal (Kuja) do\u1E63a", rule: `Mars in H${hits.map(([l, h]) => `${h} from ${l}`).join(", H")}`, bad: true,
          note: (soft ? `softened: Mars ${G.Mars.dig}; ` : "") + "2nd-house count is the South convention; matching folklore, weigh accordingly" }); } }
    return Y;
  }

  let jyStyle = localStorage.getItem("calculador.jystyle") || "north";
  function bySignLabels(j, useNav) {
    const out = Array.from({ length: 12 }, () => []);
    for (const g2 of j.grahas) {
      let lab = GRAHA_AB[g2.body];
      if (!useNav) lab += ` ${Math.floor(g2.lon % 30)}\u00B0`;
      if (g2.rx && g2.body !== "Lagna") lab += "\u1D3F";
      out[useNav ? g2.nav : g2.sign].push(lab);
    }
    return out;
  }
  function svgLines(x, y, lines, signNum) {
    const all = [`#${signNum}`, ...lines];
    const y0 = y - (all.length - 1) * 5.5;
    return all.map((t, i) =>
      `<text x="${x}" y="${y0 + i * 11}" font-size="${i ? 10 : 8}" text-anchor="middle" dominant-baseline="central" fill="${i ? "var(--ink)" : "var(--ink-faded)"}" ${i ? 'font-weight="700"' : ""}>${t}</text>`
    ).join("");
  }
  /* North Indian diamond: fixed house positions, signs rotate */
  const DIAMOND_POS = [[160,60],[85,32],[32,85],[85,160],[32,235],[85,288],
                       [160,260],[235,288],[288,235],[235,160],[288,85],[235,32]];
  function northChart(j, useNav, title) {
    const labels = bySignLabels(j, useNav);
    const lagnaS = useNav ? j.grahas[0].nav : j.lagnaSign;
    let s = `<svg viewBox="0 0 320 320" role="img" aria-label="${title} chart, North Indian style">`;
    s += `<rect x="10" y="10" width="300" height="300" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
    s += `<line x1="10" y1="10" x2="310" y2="310" stroke="var(--ink)" stroke-width="1"/>`;
    s += `<line x1="310" y1="10" x2="10" y2="310" stroke="var(--ink)" stroke-width="1"/>`;
    for (const [a, b] of [[[160,10],[10,160]],[[10,160],[160,310]],[[160,310],[310,160]],[[310,160],[160,10]]])
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--ink)" stroke-width="1"/>`;
    for (let h = 0; h < 12; h++) {
      const signIdx = (lagnaS + h) % 12;
      const [x, y] = DIAMOND_POS[h];
      s += svgLines(x, y, labels[signIdx], signIdx + 1);
    }
    s += `<text x="160" y="160" font-size="9" text-anchor="middle" fill="var(--seal)">${title}</text></svg>`;
    return s;
  }
  /* South Indian grid: fixed signs, lagna slashed */
  const SOUTH_POS = { 11:[0,0], 0:[1,0], 1:[2,0], 2:[3,0], 3:[3,1], 4:[3,2],
                      5:[3,3], 6:[2,3], 7:[1,3], 8:[0,3], 9:[0,2], 10:[0,1] };
  function southChart(j, useNav, title) {
    const labels = bySignLabels(j, useNav);
    const lagnaS = useNav ? j.grahas[0].nav : j.lagnaSign;
    let s = `<svg viewBox="0 0 320 320" role="img" aria-label="${title} chart, South Indian style">`;
    for (let sn = 0; sn < 12; sn++) {
      const [cx, cy] = SOUTH_POS[sn];
      const x = 10 + cx * 75, y = 10 + cy * 75;
      s += `<rect x="${x}" y="${y}" width="75" height="75" fill="none" stroke="var(--ink)" stroke-width="1"/>`;
      if (sn === lagnaS)
        s += `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y + 16}" stroke="var(--seal)" stroke-width="1.5"/>`;
      s += `<text x="${x + 6}" y="${y + 10}" font-size="7" fill="var(--ink-faded)">${RASI[sn].slice(0,2)}</text>`;
      const ls = labels[sn], y0 = y + 38 - (ls.length - 1) * 5.5;
      for (let i = 0; i < ls.length; i++)
        s += `<text x="${x + 38}" y="${y0 + i * 11}" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="var(--ink)">${ls[i]}</text>`;
    }
    s += `<rect x="85" y="85" width="150" height="150" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>`;
    s += `<text x="160" y="160" font-size="11" text-anchor="middle" dominant-baseline="central" fill="var(--seal)">${title}</text></svg>`;
    return s;
  }
  const fmtYM = (ms) => { const d = new Date(ms);
    return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  function renderJyotish(j) {
    $("jyStyleBtn").textContent = `Chart style: ${jyStyle === "north" ? "North \u25C7" : "South \u25A6"}`;
    const draw = jyStyle === "north" ? northChart : southChart;
    $("rasiOut").innerHTML = draw(j, false, "R\u0101\u015Bi");
    $("navamsaOut").innerHTML = draw(j, true, "Navam\u015Ba D9");
    const tb = $("nakTable").querySelector("tbody");
    $("panchOut").textContent =
      `Birth pa\u00F1ch\u0101\u1E45ga: ${j.panch.vara} \u00B7 ${j.panch.tithi} \u00B7 ${j.panch.ny} yoga \u00B7 ${j.panch.kar} kara\u1E47a ` +
      `(v\u0101ra from civil date \u2014 Vedic day runs sunrise\u2192sunrise, so pre-dawn births take the previous v\u0101ra)\n` +
      `S\u0101\u1E0Dhe S\u0101t\u012B today: transit Saturn in ${RASI[j.sadhe.satSign]}, ${j.sadhe.h}th from natal Moon \u2192 ${j.sadhe.phase}`;
    tb.innerHTML = "";
    for (const g2 of j.grahas) {
      const tr = document.createElement("tr");
      const digBits = [];
      if (g2.dig) digBits.push(g2.dig);
      if (g2.combust) digBits.push('<span class="rx">combust</span>');
      tr.innerHTML = `<td>${g2.body}${g2.rx && g2.body !== "Lagna" ? ' <span class="rx">Rx</span>' : ""}</td>` +
        `<td>${fmtSid(g2.lon)}</td><td>H${g2.house}</td>` +
        `<td>${g2.nak.name} (${g2.nak.pada})</td><td>${g2.nak.lord}</td><td>${RASI[g2.nav]}</td>` +
        `<td>${digBits.join(" ") || "\u2014"}</td>`;
      tb.appendChild(tr);
    }
    let yh = `<p class="bazimeta">Yogas \u2014 mechanical detection (presence, not strength); Moon ${j.waxing ? "waxing" : "waning"}, benefics: ${j.benefics.join(", ")}${j.mercAfflicted ? " (Mercury counted malefic: shares sign with a malefic)" : ""}:</p>`;
    if (!j.yogas.length) yh += `<p class="bazimeta">\u2014 none of the tracked set forms.</p>`;
    else {
      yh += `<table><thead><tr><th>Yoga</th><th>Forming rule / notes</th></tr></thead><tbody>`;
      for (const y of j.yogas)
        yh += `<tr><td${y.bad ? ' style="color:var(--seal)"' : ""}>${y.name}</td>` +
          `<td>${y.rule}${y.note ? ` <span style="color:var(--ink-faded)">\u2014 ${y.note}</span>` : ""}</td></tr>`;
      yh += `</tbody></table>`;
    }
    $("yogaOut").innerHTML = yh;
    const dOut = $("dashaOut");
    dOut.innerHTML = `<p class="bazimeta">Vim\u015Bottar\u012B mah\u0101da\u015B\u0101s:</p>`;
    const row1 = document.createElement("div"); row1.className = "luckrow";
    for (const md of j.mds) {
      const div = document.createElement("div");
      div.className = "pillar" + (md.current ? " nowpillar" : "");
      div.innerHTML = `<div class="role">${fmtYM(md.start)}</div>` +
        `<div class="gan">${GRAHA_AB[md.lord]}</div><div class="god">${md.yrs}y</div>`;
      row1.appendChild(div);
    }
    dOut.appendChild(row1);
    dOut.insertAdjacentHTML("beforeend",
      `<p class="bazimeta">Antarda\u015B\u0101s of ${j.curMd.lord} mah\u0101da\u015B\u0101:</p>`);
    const row2 = document.createElement("div"); row2.className = "luckrow";
    for (const ad of j.ads) {
      const div = document.createElement("div");
      div.className = "pillar" + (ad.current ? " nowpillar" : "");
      div.innerHTML = `<div class="role">${fmtYM(ad.start)}</div>` +
        `<div class="gan">${GRAHA_AB[ad.lord]}</div>`;
      row2.appendChild(div);
    }
    dOut.appendChild(row2);
    $("drishtiOut").innerHTML = `<p class="bazimeta">Graha d\u1E5B\u1E63\u1E6Di (sign-based): ` +
      j.asp.map(a => `${GRAHA_AB[a.body]} H${a.house}\u2192${a.hits.join(",")}`).join(" \u2002") + `</p>`;
    const am = Math.floor(j.ayan), amin = Math.round((j.ayan % 1) * 60);
    $("jyMeta").textContent =
      `Lahiri ayan\u0101\u1E43\u015Ba ${am}\u00B0${String(amin).padStart(2,"0")}\u2032 at birth. ` +
      `Sidereal = tropical \u2212 ayan\u0101\u1E43\u015Ba (\u00B11\u2032); whole-sign bh\u0101vas from Lagna; mean-node R\u0101hu; ` +
      `da\u015B\u0101 year = 365.25d; nodal d\u1E5B\u1E63\u1E6Di omitted (conventions vary). Charts use tropical Asc \u2212 ayan\u0101\u1E43\u015Ba, same birth moment as Western (no solar-time shift).`;
  }
  $("jyStyleBtn").addEventListener("click", () => {
    jyStyle = jyStyle === "north" ? "south" : "north";
    localStorage.setItem("calculador.jystyle", jyStyle);
    calculate();
  });

  /* ---------- wiring ---------- */
  function showError(msg) {
    const e = $("errbox");
    e.textContent = msg; e.style.display = msg ? "block" : "none";
  }
  function calculate() {
    showError("");
    const p = readForm();
    if (!p.date || !p.time || Number.isNaN(p.lat) || Number.isNaN(p.lon)) {
      showError("Need date, time, latitude, and longitude to calculate.");
      return;
    }
    try {
      const wRes = calcWestern(p);
      renderWestern(wRes);
      renderTiming(p, wRes);
      renderJyotish(calcJyotish(p, wRes));
      renderBazi(calcBazi(p));
      renderZwds(calcZwds(p), p);
    } catch (err) {
      showError("Calculation failed: " + err.message);
    }
  }
  function applyGloss() {
    document.body.classList.toggle("gloss", glossOn);
    $("glossBtn").textContent = glossOn ? "EN glosses: on" : "EN glosses: off";
  }
  $("glossBtn").addEventListener("click", () => {
    glossOn = !glossOn;
    localStorage.setItem("calculador.gloss", glossOn ? "on" : "off");
    applyGloss(); calculate();
  });
  applyGloss();
  $("calcBtn").addEventListener("click", calculate);
  $("saveBtn").addEventListener("click", () => {
    const p = readForm();
    if (!p.name) { showError("Give the chart a name to save it."); return; }
    const all = getProfiles(); all[p.name] = p; setProfiles(all);
    refreshProfileList(); $("profileSel").value = p.name; showError("");
  });
  $("loadBtn").addEventListener("click", () => {
    const p = getProfiles()[$("profileSel").value];
    if (p) { fillForm(p); calculate(); }
  });
  $("delBtn").addEventListener("click", () => {
    const all = getProfiles(), n = $("profileSel").value;
    if (n && confirm(`Delete saved chart “${n}”?`)) {
      delete all[n]; setProfiles(all); refreshProfileList();
    }
  });
  for (const btn of document.querySelectorAll('nav [role="tab"]')) {
    btn.addEventListener("click", () => {
      for (const b of document.querySelectorAll('nav [role="tab"]')) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      }
      for (const sec of document.querySelectorAll('[role="tabpanel"]')) {
        sec.hidden = sec.id !== "panel-" + btn.dataset.tab;
      }
    });
  }

  $("transitBtn").addEventListener("click", () => {
    if (!lastW) { showError("Calculate a natal chart first."); return; }
    const ds = $("transitDate").value;
    if (!ds) { showError("Pick a transit date."); return; }
    lastTransits = calcTransits(ds, lastW);
    renderTransits(lastTransits);
    renderWheel(lastW, lastTransits);
  });
  $("transitClear").addEventListener("click", () => {
    lastTransits = null; $("transitOut").innerHTML = "";
    if (lastW) renderWheel(lastW, null);
  });
  $("savePng").addEventListener("click", () => {
    const svgEl = $("wheel").querySelector("svg");
    if (!svgEl) return;
    const cs = getComputedStyle(document.documentElement);
    let raw = svgEl.outerHTML;
    for (const v of ["ink","ink-faded","seal","thread","rule","paper"]) {
      raw = raw.split(`var(--${v})`).join(cs.getPropertyValue("--" + v).trim());
    }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1200;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = cs.getPropertyValue("--paper").trim();
      ctx.fillRect(0, 0, 1200, 1200);
      ctx.drawImage(img, 0, 0, 1200, 1200);
      const a = document.createElement("a");
      a.download = ($("pname").value || "chart") + "-wheel.png";
      a.href = cv.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw);
  });

  /* first run: seed Joni's chart so it's zero-entry */
  if (!Object.keys(getProfiles()).length) {
    const joni = { name: "Joni", date: "1988-08-18", time: "20:44",
      clockoff: 10, stdoff: 9, lat: 37.566, lon: 126.978, gender: "female" };
    setProfiles({ Joni: joni });
  }
  refreshProfileList();
  const first = getProfiles()[$("profileSel").value];
  if (first) { fillForm(first); calculate(); }
})();
