/* Calculador — all client-side. Engines: Astronomy (window.Astronomy),
   lunar-javascript (window.Solar etc.), iztro (window.iztro). */
(function () {
  "use strict";
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
  function calcWestern(p) {
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
        `<td>${fmtLon(r.lon)}</td><td class="num">${r.lon.toFixed(2)}°</td><td>WS${r.house} · P${r.ph}</td>`;
      tb.appendChild(tr);
    }
    $("anglesOut").innerHTML =
      `<span>Asc ${fmtLon(w.asc)}</span><span>MC ${fmtLon(w.mc)}</span>`;
    renderWheel(w);
  }

  /* ---------- wheel ---------- */
  const SIGN_GLYPHS = ["\u2648","\u2649","\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653"];
  const PLANET_GLYPHS = { Sun:"\u2609", Moon:"\u263D", Mercury:"\u263F", Venus:"\u2640",
    Mars:"\u2642", Jupiter:"\u2643", Saturn:"\u2644", Uranus:"\u2645",
    Neptune:"\u2646", Pluto:"\u2647" };
  const VS = "\uFE0E"; // force text-style glyphs, not emoji
  function renderWheel(w) {
    const C = 200, pt = (L, r) => {
      const t = (180 - (L - w.asc)) * D2R;
      return [C + r * Math.cos(t), C + r * Math.sin(t)];
    };
    let s = `<svg viewBox="-14 -14 428 428" role="img" aria-label="Natal chart wheel">`;
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
    s += `</svg>`;
    $("wheel").innerHTML = s;
  }

  /* ---------- BaZi ---------- */
  function calcBazi(p) {
    const t = chineseTime(p);
    const solar = window.Solar.fromYmdHms(t.y, t.m, t.d, t.hh, t.mm, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    const yun = ec.getYun(p.gender === "male" ? 1 : 0);
    const luck = yun.getDaYun().filter(x => x.getGanZhi()).slice(0, 9)
      .map(x => `${x.getGanZhi()}@${x.getStartAge()}`).join("\u2002");
    return {
      luck, luckDir: yun.isForward() ? "forward" : "backward",
      timeUsed: `${t.hh}:${String(t.mm).padStart(2, "0")}` + (p.solartime ? " true solar" : " standard"),
      pillars: [
        { role: "Year 年", gz: ec.getYear(), hide: ec.getYearHideGan() },
        { role: "Month 月", gz: ec.getMonth(), hide: ec.getMonthHideGan() },
        { role: "Day 日", gz: ec.getDay(), hide: ec.getDayHideGan(), dm: true },
        { role: "Hour 時", gz: ec.getTime(), hide: ec.getTimeHideGan() },
      ],
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
        `<div class="gan">${pl.gz[0]}</div><div class="zhi">${pl.gz[1]}</div>` +
        `<div class="hide">藏 ${pl.hide.join(" ")}</div>`;
      out.appendChild(div);
    }
    $("baziMeta").textContent =
      `Lunar date: ${b.lunarStr}. Day master in red. Hour from ${b.timeUsed} time.\n` +
      `Luck pillars (${b.luckDir}): ${b.luck}`;
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
      const majors = pal.majorStars.map(s => s.name + (s.mutagen ? `·${s.mutagen}` : "")).join(" ");
      const minors = pal.minorStars.map(s => s.name).join(" ");
      cell.innerHTML = `<div class="pname">${pal.name}</div>` +
        `<div class="major">${majors || "—"}</div>` +
        `<div class="minor">${minors}</div>` +
        `<div class="pbranch">${pal.heavenlyStem}${pal.earthlyBranch}</div>`;
      out.appendChild(cell);
    }
    const center = document.createElement("div");
    center.className = "zwcenter";
    center.innerHTML = `<div class="who">${p.name || "—"}</div>` +
      `<div class="bureau">${chart.fiveElementsClass}</div>` +
      `<div class="meta">${chart.lunarDate}<br>${chart.chineseDate}</div>`;
    out.appendChild(center);
  }

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
      renderWestern(calcWestern(p));
      renderBazi(calcBazi(p));
      renderZwds(calcZwds(p), p);
    } catch (err) {
      showError("Calculation failed: " + err.message);
    }
  }
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
