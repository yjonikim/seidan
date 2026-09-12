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
    const rows = bodies.map((b) => {
      const L = bodyLon(b, date);
      const L2 = bodyLon(b, new Date(date.getTime() + 3600e3));
      const rx = b !== "Sun" && b !== "Moon" &&
                 (((L2 - L + 540) % 360) - 180) < 0;
      const house = ((Math.floor(L / 30) - ascSign + 12) % 12) + 1;
      return { body: b, lon: L, rx, house };
    });
    return { rows, asc, mc };
  }
  function renderWestern(w) {
    const tb = $("planetTable").querySelector("tbody");
    tb.innerHTML = "";
    for (const r of w.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.body}${r.rx ? ' <span class="rx">Rx</span>' : ""}</td>` +
        `<td>${fmtLon(r.lon)}</td><td class="num">${r.lon.toFixed(2)}°</td><td>${r.house}</td>`;
      tb.appendChild(tr);
    }
    $("anglesOut").innerHTML =
      `<span>Asc ${fmtLon(w.asc)}</span><span>MC ${fmtLon(w.mc)}</span>`;
  }

  /* ---------- BaZi ---------- */
  function calcBazi(p) {
    const t = chineseTime(p);
    const solar = window.Solar.fromYmdHms(t.y, t.m, t.d, t.hh, t.mm, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    return {
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
      `Lunar date: ${b.lunarStr}. Day master in red. Hour from ${b.timeUsed} time.`;
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
