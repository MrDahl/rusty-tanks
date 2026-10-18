const G = require("../game.js");
const { Game, SEASONS, W, STEP } = G;
let fails = 0;
const check = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } else console.log("ok:", m); };
const loadouts = [Array(10).fill(0), Array(10).fill(0)]; // all Rivet Shot
const run = (g, cond, maxSteps = 60 * 40) => { for (let i = 0; i < maxSteps && !cond(); i++) g.update(STEP); return cond(); };
const toAim = (g) => run(g, () => g.phase === "aim" || g.phase === "over");

// --- random picks each of the six eventually, valid names
const seen = new Set();
for (let s = 1; s < 200; s++) { const g = new Game(s, [null, null], loadouts, "random"); seen.add(g.weather); }
check(seen.size === 6 && [...seen].every((w) => SEASONS.includes(w)), "random picks all six seasons: " + [...seen].join(","));
check(new Game(5, [null, null], loadouts).weather === "normal", "default season is normal");
check(new Game(5, [null, null], loadouts, "bogus").weather === "normal", "bad name -> normal");
const g0 = new Game(5, [null, null], loadouts, "ice"); g0.newMatch(6, undefined, loadouts);
check(g0.weather === "normal", "remembers/validates setting");

// --- normal is untouched: same terrain & wind with and without season arg
const a = new Game(77, [null, null], loadouts), b = new Game(77, [null, null], loadouts, "normal");
check(a.wind === b.wind && a.tanks[0].x === b.tanks[0].x, "normal season = same as before");

// --- monsoon: idle tank sinks, driving frees it
{
  const g = new Game(3, [null, null], loadouts, "monsoon");
  const y0 = g.tanks[0].y;
  g.fire(); check(toAim(g), "shot finished");
  check(g.current === 1, "turn passed");
  check(g.tanks[0].sink === 3 && g.tanks[0].y === y0 + 3, "idle tank sank 3px (" + (g.tanks[0].y - y0) + ")");
  g.fire(); toAim(g); g.fire(); toAim(g); g.fire(); toAim(g); g.fire(); toAim(g); g.fire(); toAim(g);
  check(g.tanks[0].sink <= 12, "sink capped at 12: " + g.tanks[0].sink);
  // P1's turn now: drive
  if (g.current === 0 && g.phase === "aim") {
    g.setMoveDir(1);
    for (let i = 0; i < 30; i++) g.update(STEP);
    check(g.tanks[0].sink === 0, "driving frees the tank");
    g.setMoveDir(0);
    g.fire(); toAim(g);
    check(g.tanks[0].sink === 0, "a tank that drove does not sink");
  } else console.log("skip drive part, current", g.current);
}

// --- ice: slide after driving, no cost
{
  const g = new Game(3, [null, null], loadouts, "iceage");
  g.setMoveDir(1);
  for (let i = 0; i < 20; i++) g.update(STEP); // 1/3 s -> ~15px driven
  const xRelease = g.tank.x; g.setMoveDir(0);
  const left = g.moveLeft;
  for (let i = 0; i < 300; i++) g.update(STEP);
  check(g.tank.x > xRelease + 12, "slid on after release: " + (g.tank.x - xRelease).toFixed(1) + " px");
  check(Math.abs(g.moveLeft - left) < 1e-6, "sliding costs no driving allowance");
  check(g.tank.slide === 0, "slide stopped");
}
// ice: bounce randomness (Pogo Bomb index)
{
  const pogo = G.WEAPONS.findIndex((w) => w.name === "Pogo Bomb");
  const ends = [];
  for (const season of ["normal", "iceage"]) {
    const xs = [];
    for (let s = 1; s <= 25; s++) {
      const g = new Game(s, [null, null], [Array(10).fill(pogo), Array(10).fill(pogo)], season);
      g.tank.angle = 50; g.tank.power = 60; g.fire();
      run(g, () => g.phase !== "flight");
      const e = g.explosions[0]; xs.push(e ? e.x : -1);
    }
    const mean = xs.reduce((p, c) => p + c, 0) / xs.length;
    ends.push(Math.sqrt(xs.reduce((p, c) => p + (c - mean) ** 2, 0) / xs.length));
  }
  console.log("landing spread (std) normal vs ice:", ends.map((n) => n.toFixed(0)).join(" / "));
  check(ends[1] > ends[0], "ice makes bounces less predictable");
}

// --- thunderstorm: strikes happen, hits cost 30
{
  let totalHits = 0, strikes = 0, phasesOk = true;
  for (let s = 1; s <= 40; s++) {
    const g = new Game(s, [null, null], loadouts, "thunderstorm");
    g.fire(); run(g, () => g.phase === "weather" || g.phase === "over");
    if (g.phase !== "weather") continue;
    const n = g.weatherEvents.length; strikes += n;
    check_n = n; if (n < 1 || n > 2) phasesOk = false;
    const before = g.tanks.map((t) => t.score);
    run(g, () => g.phase === "aim");
    if (g.phase !== "aim") phasesOk = false;
    g.tanks.forEach((t, i) => { const d = before[i] - t.score; if (d !== 0 && d !== 30 && d !== 60) phasesOk = false; if (d > 0) totalHits += d / 30; });
  }
  check(phasesOk, "thunderstorm: 1-2 strikes per turn, phase returns to aim, hits cost 30");
  console.log("strikes", strikes, "tank hits", totalHits);
  check(strikes >= 40 && totalHits > 0, "strikes happen and sometimes hit a tank");
}
// direct hit check
{
  const g = new Game(9, [null, null], loadouts, "thunderstorm");
  g.weatherEvents = [{ kind: "strike", at: 0, x: g.tanks[1].x + 5, done: false }]; g.weatherClock = 0; g.phase = "weather";
  run(g, () => g.phase === "aim");
  check(g.tanks[1].score === -30, "direct bolt gives -30: " + g.tanks[1].score);
  check(g.lastHit.includes("Lightning"), "message: " + g.lastHit);
}

// --- hurricane: strong and flips every turn
{
  const g = new Game(4, [null, null], loadouts, "hurricane");
  let ok = Math.abs(g.wind) >= 35 && Math.abs(g.wind) <= 60, flips = true;
  for (let i = 0; i < 8; i++) {
    const w = g.wind; g.fire(); toAim(g);
    if (g.phase === "over") break;
    if (Math.sign(g.wind) === Math.sign(w) || Math.abs(g.wind) < 35 || Math.abs(g.wind) > 60) flips = false;
  }
  check(ok && flips, "hurricane wind 35-60 and flips direction every turn");
}

// --- apocalypse: 3-4 meteors, craters, hits
{
  let counts = new Set(), craters = 0, hits = 0;
  for (let s = 1; s <= 30; s++) {
    const g = new Game(s, [null, null], loadouts, "apocalypse");
    g.fire(); run(g, () => g.phase === "weather" || g.phase === "over");
    if (g.phase !== "weather") continue;
    counts.add(g.weatherEvents.length);
    const dirt = g.terrain.mask.reduce((p, c) => p + c, 0);
    const before = g.tanks.map((t) => t.score);
    run(g, () => g.phase === "aim");
    if (g.phase !== "aim") { console.log("stuck in", g.phase); fails++; }
    if (g.terrain.mask.reduce((p, c) => p + c, 0) < dirt) craters++;
    g.tanks.forEach((t, i) => { if (t.score < before[i]) hits++; });
  }
  check([...counts].every((n) => n === 3 || n === 4) && counts.size === 2, "3 or 4 meteors per turn: " + [...counts].join(","));
  check(craters >= 28, "meteors dig craters (" + craters + "/30)");
  console.log("tank hits", hits);
}

// --- the match still ends, all seasons, with the AI playing
for (const season of SEASONS) {
  const g = new Game(21, [ "normal", "hard" ], [Array(10).fill(0), Array(10).fill(0)], season);
  let steps = 0;
  while (g.phase !== "over" && steps < 60 * 60 * 6) { g.update(STEP); steps++; }
  check(g.phase === "over", season + ": AI vs AI match finished in " + (steps / 60).toFixed(0) + "s, scores " + g.tanks.map((t) => t.score).join("/"));
}
console.log(fails ? fails + " FAILURE(S)" : "ALL SEASON CHECKS PASSED");
process.exit(fails ? 1 : 0);
