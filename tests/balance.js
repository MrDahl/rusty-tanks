// Balance report: lets the computer play, and measures how much each weapon is worth.
//
//   node tests/balance.js shots 40            every weapon fires 40 aimed shots on random maps
//   node tests/balance.js matches 200         200 full computer-vs-computer matches with random weapon pools
//   node tests/balance.js shots 40 0 30       (optional) only weapons number 0-29, handy for splitting the work
//
// "shots": average points per shot (points won minus points lost to own shots), how often the shot hits,
//          and how often it lands an effect (freeze, burn, fallout, bury...).
// "matches": how often the owner of each weapon wins the match (50% = fair).
// Results are printed as a table; "--json file" also saves them.
const fs = require("fs");
const G = require("../game.js");
const { Game, WEAPONS, STEP, aiDraftPick } = G;

const mode = process.argv[2] || "shots";
const amount = Number(process.argv[3]) || 30;
const lo = Number(process.argv[4]) || 0, hi = Number(process.argv[5]) || WEAPONS.length;
const jsonIdx = process.argv.indexOf("--json");
const jsonFile = jsonIdx > 0 ? process.argv[jsonIdx + 1] : null;
const season = (process.argv.find((a) => a.startsWith("--season=")) || "--season=normal").split("=")[1];

function playUntilTurnEnds(g, maxSteps) {
  const who = g.current;
  for (let i = 0; i < maxSteps; i++) {
    g.update(STEP);
    if (g.current !== who || g.phase === "over") return true;
  }
  return false;
}

function shotsReport() {
  const rows = [];
  for (let wi = lo; wi < hi; wi++) {
    const w = WEAPONS[wi];
    const loadout = Array(10).fill(wi);
    let net = 0, gain = 0, self = 0, hits = 0, effects = 0, n = 0;
    for (let k = 0; k < amount; k++) {
      const g = new Game(1000 + k * 7919 + wi, [null, "normal"], [loadout.slice(), loadout.slice()], season);
      g.current = k % 2;
      g.tank.weapon = wi;
      const plan = g.planAiShot(wi);
      g.tank.angle = plan.angle;
      g.tank.power = plan.power;
      const before = JSON.stringify(g.stats[g.current]);
      g.fire(true);
      if (!playUntilTurnEnds(g, 60 * 20)) continue;
      const st = g.stats[1 - g.current];       // the player who just fired (current already flipped)
      const o = JSON.parse(before);
      const dmg = st.damage - o.damage, own = st.self - o.self;
      gain += dmg; self += own; net += dmg - own; n++;
      if (dmg > 0) hits++;
      if (st.buries + st.freezes + st.irradiated + st.stunned > o.buries + o.freezes + o.irradiated + o.stunned) effects++;
    }
    rows.push({ weapon: w.name, ai: !!w.ai, shots: n, net: net / n, gain: gain / n, self: self / n, hit: hits / n, effect: effects / n });
    process.stderr.write(".");
  }
  process.stderr.write("\n");
  return rows;
}

function matchesReport() {
  const stats = WEAPONS.map(() => ({ games: 0, wins: 0 }));
  let played = 0;
  for (let m = lo; m < lo + amount; m++) {
    // random pool of 20, alternate picks, like a quick-play deal
    let pool, rnd;
    for (let attempt = 0; ; attempt++) {     // draw pools until one has enough weapons the computer can aim
      rnd = (() => { let s = 77 + m * 131 + attempt * 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
      pool = [];
      while (pool.length < 20) { const i = Math.floor(rnd() * WEAPONS.length); if (!pool.includes(i)) pool.push(i); }
      if (pool.filter((i) => WEAPONS[i].ai).length >= 9) break;
    }
    const picks = [[], []];
    const avail = pool.slice();
    while (picks[0].length < 10 || picks[1].length < 10) {
      const who = picks[0].length <= picks[1].length ? 0 : 1;
      const choice = aiDraftPick(avail, rnd);
      picks[who].push(choice);
      avail.splice(avail.indexOf(choice), 1);
    }
    const g = new Game(5000 + m, ["normal", "normal"], [picks[0].slice(), picks[1].slice()], season);
    let steps = 0;
    while (g.phase !== "over" && steps < 60 * 1200) { g.update(STEP); steps++; }
    if (g.phase !== "over") continue;
    const a = g.tanks[0].score, b = g.tanks[1].score;
    if (a === b) continue;
    const winner = a > b ? 0 : 1;
    played++;
    for (let p = 0; p < 2; p++) for (const wi of new Set(picks[p])) { stats[wi].games++; if (p === winner) stats[wi].wins++; }
    if (m % 10 === 0) process.stderr.write(".");
  }
  process.stderr.write("\n");
  return { played, rows: WEAPONS.map((w, i) => ({ weapon: w.name, ai: !!w.ai, games: stats[i].games, winRate: stats[i].games ? stats[i].wins / stats[i].games : null })) };
}

let out;
if (mode === "shots") {
  out = shotsReport();
  out.sort((a, b) => b.net - a.net);
  console.log("weapon".padEnd(18), "ai", "net/shot", " gain", " self", " hit%", " effect%");
  for (const r of out) console.log(r.weapon.padEnd(18), r.ai ? "y " : "- ", r.net.toFixed(1).padStart(8), r.gain.toFixed(1).padStart(5), r.self.toFixed(1).padStart(5), String(Math.round(r.hit * 100)).padStart(5), String(Math.round(r.effect * 100)).padStart(7));
} else {
  out = matchesReport();
  console.log("matches played:", out.played);
  const rows = out.rows.filter((r) => r.games > 0).sort((a, b) => b.winRate - a.winRate);
  console.log("weapon".padEnd(18), "ai", "games", "win%");
  for (const r of rows) console.log(r.weapon.padEnd(18), r.ai ? "y " : "- ", String(r.games).padStart(5), String(Math.round(r.winRate * 100)).padStart(4));
}
if (jsonFile) fs.writeFileSync(jsonFile, JSON.stringify(out, null, 1));
