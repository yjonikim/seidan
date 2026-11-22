#!/usr/bin/env node
/* seidan blind.js — blind chart-matching tests (Vernon Clark style), CLI side.
   The site's "Blind test" tab does the same thing in the browser; the two
   share one key format, so a test built on the site can be scored or verified
   here and the reverse.

   Usage:
     node blind.js odds N
         Chance table for N charts: P(exactly k right), P(at least k right).
     node blind.js score "REVEAL LINE | key.json" "A=Name,B=Name,..." [--commit HASH]
         Count hits, give the chance of doing that well by luck, and (with
         --commit) check the key against the commitment printed in the packet.
     node blind.js verify "REVEAL LINE" HASH
         Check that a revealed key hashes to a packet's commitment.
     node blind.js pack roster.json [--out DIR]
         Shuffle the roster, write DIR/blind-packet.txt (charts A, B, C… with
         names and dated lines stripped) and DIR/blind-key.json. Prints the
         commitment only — never the key. Needs chart.js beside this file.
     node blind.js --selftest

   roster.json: an array of {name, date, time, clockoff, stdoff, lat, lon,
   gender} — or the object the site keeps in localStorage (same fields, keyed
   by name).

   WHAT THE NUMBERS MEAN
   If a reader matches N charts to N names at random, using each name once,
   the number right follows the "matching problem" distribution. The expected
   score by luck is exactly 1 for any N, and all-correct has probability 1/N!.
   One test is one data point: 3 of 3 happens by luck one time in six. The
   honest unit is a series of tests, decided on before the first one.

   WHAT BLINDING CANNOT DO
   Planet positions pin down a birth date to the day. Anyone (or any model)
   that already holds these people's birth data can un-blind a packet by
   lookup. The packet hides who is who only from a reader without that data.
   Names in a packet are the tester's choice; use initials or aliases freely.

   KEY FORMAT  seidan-blind|A=Name|B=Name|…|salt=HEX   (commitment = SHA-256) */
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const cleanName = (n) => String(n).replace(/[|=,]/g, " ").trim();

function odds(n) {
  const D = [1, 0]; for (let i = 2; i <= n; i++) D[i] = (i - 1) * (D[i - 1] + D[i - 2]);
  const fact = (x) => { let f = 1; for (let i = 2; i <= x; i++) f *= i; return f; };
  const exact = []; for (let k = 0; k <= n; k++) exact[k] = fact(n) / (fact(k) * fact(n - k)) * D[n - k] / fact(n);
  const atLeast = exact.map((_, k) => exact.slice(k).reduce((a, b) => a + b, 0));
  return { exact, atLeast };
}
function parseReveal(line) {
  const parts = line.trim().split("|");
  if (parts[0] !== "seidan-blind" || !/^salt=/.test(parts[parts.length - 1])) throw new Error("Not a seidan-blind reveal line");
  const key = {};
  for (const kv of parts.slice(1, -1)) { const i = kv.indexOf("="); key[kv.slice(0, i)] = kv.slice(i + 1); }
  return { key, reveal: line.trim() };
}
function loadKey(arg) {
  if (fs.existsSync(arg)) { const j = JSON.parse(fs.readFileSync(arg, "utf8")); return { key: j.key, reveal: j.reveal, commit: j.commit }; }
  return parseReveal(arg);
}
function parseGuesses(s) {
  const g = {};
  for (const kv of s.split(",")) { const i = kv.indexOf("="); if (i < 1) continue; g[kv.slice(0, i).trim().toUpperCase()] = kv.slice(i + 1).trim(); }
  return g;
}
function score(key, guess) {
  const labels = Object.keys(key), norm = (x) => cleanName(x || "").toLowerCase();
  const rows = labels.map(l => ({ label: l, truth: key[l], guess: guess[l] || "", hit: norm(guess[l]) === norm(key[l]) }));
  const k = rows.filter(r => r.hit).length, n = labels.length, od = odds(n);
  const used = rows.map(r => norm(r.guess)).filter(Boolean);
  return { rows, k, n, pAtLeast: od.atLeast[k], reused: new Set(used).size !== used.length, missing: rows.filter(r => !r.guess).length };
}

/* ---- pack: charts via chart.js, with identifying / dated lines removed ---- */
function stripChart(text) {
  const out = []; let skipDasha = false;
  for (let line of text.split("\n")) {
    if (skipDasha) { if (/^\s+\S+\/\S+@/.test(line) || /^\S\S@\d{4}\.\d\d/.test(line)) continue; skipDasha = false; }
    if (/^Lunar date:|^Today's pillars|^Pillars for |^Panchanga:|^Sadhe Sati|^Profection age/.test(line)) continue;
    if (/^Vimshottari/.test(line)) { skipDasha = true; continue; }
    if (/^\S\S@\d{4}\.\d\d/.test(line)) continue;                       // mahadasha date row
    line = line.replace(/\(\d{4}\)/g, "").replace(/, lunar [^)]*\)/, ")").replace(/\(hour from [\d:]+ /, "(hour from ");
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function pack(rosterPath, outDir) {
  const { execFileSync } = require("child_process");
  let roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  if (!Array.isArray(roster)) roster = Object.entries(roster).map(([name, p]) => Object.assign({ name }, p));
  if (roster.length < 3) throw new Error("Need at least three charts (with two, a coin flip is right half the time)");
  if (roster.length > 26) throw new Error("26 charts at most");
  const order = roster.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const labels = order.map((_, i) => String.fromCharCode(65 + i)), key = {}, blocks = [];
  const off = (x) => (x >= 0 ? "+" : "") + x;
  order.forEach((p, i) => {
    key[labels[i]] = cleanName(p.name);
    const args = [path.join(__dirname, "chart.js"), p.date, p.time, off(p.clockoff), off(p.stdoff), String(p.lat), String(p.lon), p.gender,
                  "--only", "west,bazi,zwds,jyotish"];
    if (p.solartime === false) args.push("--std-time");
    blocks.push(`--- CHART ${labels[i]} ---\nSex: ${p.gender}\n${stripChart(execFileSync("node", args, { encoding: "utf8" }))}`);
  });
  const salt = crypto.randomBytes(8).toString("hex");
  const reveal = "seidan-blind|" + labels.map(l => `${l}=${key[l]}`).join("|") + `|salt=${salt}`, commit = sha(reveal), od = odds(labels.length);
  const packet = [`SEIDAN BLIND PACKET — ${labels.length} charts, labels ${labels[0]}–${labels[labels.length - 1]}, order shuffled`,
    `Commitment (SHA-256 of the sealed key): ${commit}`,
    `Chance baseline: 1 correct expected by luck; all ${labels.length} by luck ${(od.exact[labels.length] * 100).toFixed(2)}%.`,
    `Names to match, alphabetical: ${labels.map(l => key[l]).sort().join(", ")}`,
    "Answer as A=Name, B=Name, ... using each name once.", "", blocks.join("\n\n")].join("\n");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "blind-packet.txt"), packet + "\n");
  fs.writeFileSync(path.join(outDir, "blind-key.json"), JSON.stringify({ created: new Date().toISOString().slice(0, 10), labels, key, salt, reveal, commit }, null, 2) + "\n");
  return { commit, n: labels.length };
}

module.exports = { odds, score, parseReveal, parseGuesses, stripChart, sha };

if (require.main === module) {
  const argv = process.argv.slice(2), cmd = argv[0];
  const flag = (f) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null; };
  const pct = (x) => (x * 100).toFixed(x < 0.001 ? 4 : 2).padStart(8) + "%";
  try {
    if (cmd === "odds") {
      const n = parseInt(argv[1], 10); if (!(n >= 1 && n <= 26)) throw new Error("odds needs N between 1 and 26");
      const od = odds(n);
      console.log(`Matching ${n} charts to ${n} names at random (each name once). Expected hits: 1.`);
      console.log("  right   exactly    at least");
      for (let k = 0; k <= n; k++) if (k !== n - 1) console.log(`  ${String(k).padStart(5)} ${pct(od.exact[k])}   ${pct(od.atLeast[k])}`);
      console.log(`  (exactly ${n - 1} right is impossible: the last one is then forced)`);
    } else if (cmd === "score") {
      const k = loadKey(argv[1]), res = score(k.key, parseGuesses(argv[2] || "")), commit = flag("--commit") || k.commit;
      for (const r of res.rows) console.log(`  ${r.label} = ${r.truth}${r.hit ? "  ✓" : `  (answered ${r.guess || "nothing"})`}`);
      console.log(`${res.k} of ${res.n} correct. Chance of ${res.k} or more by luck: ${pct(res.pAtLeast).trim()}`);
      if (res.missing) console.log(`Note: ${res.missing} chart(s) had no answer and count as misses.`);
      if (res.reused) console.log("Note: a name was used twice, so the chance figure (one name per chart) is approximate.");
      if (commit && k.reveal) console.log(sha(k.reveal) === commit ? "Commitment verified: the key is the one sealed in the packet." : "COMMITMENT MISMATCH: this key is not the one sealed in the packet.");
    } else if (cmd === "verify") {
      const ok = sha(argv[1].trim()) === (argv[2] || "").trim();
      console.log(ok ? "Verified: the key is the one sealed in the packet." : "MISMATCH: this key does not hash to that commitment.");
      process.exit(ok ? 0 : 1);
    } else if (cmd === "pack") {
      const out = flag("--out") || ".", r = pack(argv[1], out);
      console.log(`Packed ${r.n} charts → ${path.join(out, "blind-packet.txt")} (key in blind-key.json — do not show it to the reader)`);
      console.log(`Commitment: ${r.commit}`);
    } else if (cmd === "--selftest") {
      const assert = require("assert"), checks = [];
      const ok = (l, c) => checks.push([l, c]), near = (a, b) => Math.abs(a - b) < 1e-12;
      const o3 = odds(3), o5 = odds(5);
      ok("N=3: exactly 0/1/2/3 right = 2/6, 3/6, 0, 1/6", near(o3.exact[0], 2 / 6) && near(o3.exact[1], 3 / 6) && o3.exact[2] === 0 && near(o3.exact[3], 1 / 6));
      ok("N=5: 44 derangements of 120", near(o5.exact[0], 44 / 120) && near(o5.exact[5], 1 / 120));
      ok("probabilities sum to 1 and expected hits = 1 (N=3..10)", [3, 4, 5, 6, 7, 8, 9, 10].every(n => { const o = odds(n);
        return Math.abs(o.exact.reduce((a, b) => a + b, 0) - 1) < 1e-9 && Math.abs(o.exact.reduce((a, b, k) => a + b * k, 0) - 1) < 1e-9; }));
      const line = "seidan-blind|A=Ana|B=Bo|C=Cy|salt=00ff";
      const pr = parseReveal(line), sc = score(pr.key, parseGuesses("a=ana, B=Cy, C=Bo"));
      ok("reveal line parses", pr.key.A === "Ana" && pr.key.C === "Cy");
      ok("scoring is case-insensitive and counts 1 of 3", sc.k === 1 && near(sc.pAtLeast, 4 / 6));
      ok("commitment is plain SHA-256 of the reveal line", sha(line) === crypto.createHash("sha256").update(line).digest("hex") && sha(line) !== sha(line + " "));
      const stripped = stripChart("Lunar date: x\nYear 戊辰\n甲子·比肩@6(1994)  乙丑@16(2004)\n=== ZWDS (水二局, lunar 一九八八年七月初七) ===\nVimshottari (dasha...):\nRa@1988.01  Ju@2001.03\n  Ra/Ra@1988.01  Ra/Ju@1990.09\nDrishti: x");
      ok("pack strips dated lines (lunar date, luck-pillar years, dashas)", !/Lunar date|19\d\d|20\d\d|一九八八|Vimshottari/.test(stripped) && /Drishti/.test(stripped) && /@6 /.test(stripped));
      for (const [l, c] of checks) { assert(c, "FAIL: " + l); console.log("ok —", l); }
      console.log(`\n${checks.length} checks passed`);
    } else {
      console.error('Usage: node blind.js odds N | score "REVEAL|key.json" "A=Name,B=Name" [--commit HASH] | verify "REVEAL" HASH | pack roster.json [--out DIR] | --selftest');
      process.exit(1);
    }
  } catch (err) { console.error("blind.js: " + err.message); process.exit(1); }
}
