// The Ladder: progress rules, wind scaling, names, and every rung playing through to the end
const G = require("../game.js");
const L = require("../ladder.js");
const { Game, WEAPONS, STEP, aiDraftPick, makeRng } = G;
const { LADDER_RUNGS, LADDER_CONTINUES, LadderRun } = L;
let fails = 0;
const ck = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } else console.log("ok:", m); };

// --- the rungs
ck(LADDER_RUNGS.length === 5, "five opponents");
ck(LADDER_RUNGS[0].ai === "easy" && LADDER_RUNGS[0].wind === 0 && LADDER_RUNGS[0].season === "normal", "match 1: easy, no wind, normal season");
const last = LADDER_RUNGS[4];
ck(last.ai === "hard" && last.season === "apocalypse", "match 5: hard computer in an apocalypse");
ck(new Set(LADDER_RUNGS.map((r) => r.name)).size === 5, "five different names");
ck(LADDER_RUNGS.every((r) => G.SEASONS.includes(r.season)), "every rung uses a real season");
const rank = { easy: 0, normal: 1, hard: 2 };
ck(LADDER_RUNGS.every((r, i) => i === 0 || rank[r.ai] >= rank[LADDER_RUNGS[i - 1].ai]), "the computer never gets weaker up the ladder");
ck(LADDER_RUNGS.every((r) => r.name.length <= 10), "names fit in the score box");

// --- progress rules
{
  const r = new LadderRun();
  ck(r.rung === 0 && r.continues === LADDER_CONTINUES && !r.done, "fresh ladder");
  ck(r.finish(10, 5) === "advance" && r.rung === 1, "a win moves up");
  ck(r.finish(5, 5) === "draw" && r.rung === 1 && r.continues === LADDER_CONTINUES, "a draw changes nothing");
  ck(r.finish(1, 9) === "retry" && r.continues === LADDER_CONTINUES - 1 && r.rung === 1, "a loss uses a continue and stays on the rung");
  ck(r.finish(1, 9) === "retry" && r.continues === 0, "second loss uses the last continue");
  ck(r.finish(1, 9) === "failed" && r.rung === 0 && r.continues === LADDER_CONTINUES, "a loss with no continues sends you back to the start");
  const w = new LadderRun();
  let out; for (let i = 0; i < 5; i++) out = w.finish(50 + i, 10);
  ck(out === "champion" && w.done && w.current === null && w.titles === 1, "five wins make you champion");
  ck(w.results.every((x) => x && x.you > x.cpu), "results are kept");
  w.restart();
  ck(w.rung === 0 && w.titles === 1 && !w.done, "a new ladder keeps the title count");
}

// --- saving and loading (including junk)
{
  const a = new LadderRun(); a.finish(7, 3); a.finish(1, 8);
  const b = new LadderRun(JSON.parse(JSON.stringify(a)));
  ck(b.rung === 1 && b.continues === LADDER_CONTINUES - 1 && b.results[0].you === 7, "progress survives save and load");
  const junk = new LadderRun({ rung: 99, continues: -4, results: "x", titles: "many" });
  ck(junk.rung === 0 && junk.continues === LADDER_CONTINUES, "junk save falls back to a fresh ladder");
  ck(new LadderRun(null).rung === 0 && new LadderRun("hello").rung === 0, "null / string saves are fine");
}

// --- wind scaling and names in the game
const loads = [Array(10).fill(0), Array(10).fill(0)];
function windRange(opts, season, matches = 6) {
  let maxAbs = 0, nonzero = 0, samples = 0;
  for (let m = 0; m < matches; m++) {
    const g = new Game(100 + m, ["normal", "normal"], loads, season, opts);
    let steps = 0, lastTurn = -1;
    while (g.phase !== "over" && steps < 60 * 900) {
      g.update(STEP); steps++;
      if (g.phase === "aim") { samples++; maxAbs = Math.max(maxAbs, Math.abs(g.wind)); if (g.wind !== 0) nonzero++; }
    }
  }
  return { maxAbs, nonzero, samples };
}
{
  const calm = windRange({ windScale: 0 }, "normal");
  ck(calm.samples > 20 && calm.nonzero === 0, "no wind: the wind is 0 on every turn (" + calm.samples + " turns)");
  const calmHurricane = windRange({ windScale: 0 }, "hurricane", 2);
  ck(calmHurricane.nonzero === 0, "no wind also calms a hurricane");
  const light = windRange({ windScale: 0.5 }, "normal");
  ck(light.maxAbs <= 10 && light.maxAbs > 0, "light wind stays within half the range: max " + light.maxAbs);
  const normal = windRange(undefined, "normal");
  ck(normal.maxAbs > 10 && normal.maxAbs <= 20, "normal wind: max " + normal.maxAbs);
  const strong = windRange({ windScale: 1.5 }, "normal");
  ck(strong.maxAbs > 20 && strong.maxAbs <= 30, "strong wind goes beyond the normal range: max " + strong.maxAbs);
}
{
  const g = new Game(5, [null, "easy"], loads, "normal", { windScale: 0, names: [null, "Mudlark"] });
  ck(g.playerName(1) === "Mudlark" && g.playerName(0) === "Player 1", "opponent has a name");
  ck(/Mudlark wins/.test((g.tanks[1].score = 9, g.winnerText())), "winner text uses the name");
  g.newMatch(6, [null, "easy"], loads, "normal");
  ck(g.windScale === 1 && g.names === null && g.playerName(1) === "Computer", "a normal match after a ladder match is back to normal");
}

// --- every rung can be played to the end (computer vs computer, with the rung's world)
for (let i = 0; i < LADDER_RUNGS.length; i++) {
  const r = LADDER_RUNGS[i];
  const rnd = makeRng(900 + i);
  const pool = []; while (pool.length < 20) { const w = Math.floor(rnd() * WEAPONS.length); if (!pool.includes(w)) pool.push(w); }
  const picks = [[], []], avail = pool.slice();
  while (picks[0].length < 10 || picks[1].length < 10) { const who = picks[0].length <= picks[1].length ? 0 : 1; const c = aiDraftPick(avail, rnd); picks[who].push(c); avail.splice(avail.indexOf(c), 1); }
  const g = new Game(300 + i, ["normal", r.ai], picks, r.season, { windScale: r.wind, names: [null, r.name] });
  let steps = 0;
  while (g.phase !== "over" && steps < 60 * 1200) { g.update(STEP); steps++; }
  ck(g.phase === "over", "rung " + (i + 1) + " (" + r.name + ", " + r.ai + ", " + r.season + ") finishes: " + g.tanks.map((t) => t.score).join(" - "));
}

console.log(fails ? fails + " FAILURES" : "ALL LADDER CHECKS PASSED");
process.exit(fails ? 1 : 0);
