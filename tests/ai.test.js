const G = require("../game.js");
const { Game, aiDraftPick, STEP, W } = G;
const WL = G.WEAPONS;

let problems = 0;
const check = (c, m) => { if (!c) { problems++; console.log("FAIL:", m); } };

function aiLoadout(seed) {
  let a = seed;
  const rand = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const picks = [];
  while (picks.length < 10) picks.push(aiDraftPick(WL.map((w, i) => i).filter((i) => !picks.includes(i)), rand));
  return picks;
}

// 1. Draft variety
{
  const kinds = new Set();
  for (let s = 1; s <= 20; s++) { const l = aiLoadout(s); check(l.length === 10 && new Set(l).size === 10 && l.filter((i) => WL[i].ai).length >= 6, "ai loadout valid"); l.forEach((i) => kinds.add(i)); }
  const usable = WL.filter((w) => w.ai).length;
  console.log("computer can use", usable, "weapons; drafted", kinds.size, "different ones over 20 drafts");
  check(kinds.size >= usable - 6, "draft should reach most usable weapons");
  const one = aiLoadout(5);
  console.log("sample AI loadout:", one.map((i) => WL[i].name).join(", "));
  check(new Set(one).size >= 6, "a single loadout should have variety: " + new Set(one).size);
}

// 2. Full CPU-vs-CPU matches with drafted loadouts: finishes, uses many weapons
{
  const used = {};
  for (const [d1, d2, seed] of [["hard", "easy", 1], ["normal", "normal", 2], ["easy", "hard", 3]]) {
    const g = new Game(seed, [d1, d2], [aiLoadout(seed), aiLoadout(seed + 100)]);
    let guard = 0, last = "";
    while (g.phase !== "over" && guard++ < 400000) {
      if (g.phase === "flight" && g.usedWeapon) used[g.usedWeapon.name] = (used[g.usedWeapon.name] || 0) + 0;
      if (g.phase === "aim" && g.isAiTurn && g.aiPlan) { /* planning */ }
      const before = g.shotsFired[0] + g.shotsFired[1];
      g.update(STEP);
      if (g.shotsFired[0] + g.shotsFired[1] !== before) used[g.usedWeapon.name] = (used[g.usedWeapon.name] || 0) + 1;
    }
    check(g.phase === "over", d1 + " vs " + d2 + " finished");
    check(g.shotsFired[0] === 10 && g.shotsFired[1] === 10, "10 shots each");
    console.log(d1, "vs", d2, "scores", g.tanks.map((t) => t.score), g.winnerText());
  }
  const names = Object.keys(used);
  console.log("weapons the computer fired:", names.length, "->", names.join(", "));
  check(names.length >= 8, "computer should use many different weapons");
  check(Object.keys(used).some((n) => n !== "Rivet Shot"), "not just Rivet Shot");
}

// 3. Accuracy by difficulty (varied weapons, first shot of each map)
{
  const N = 80;
  const out = {};
  for (const diff of ["easy", "normal", "hard"]) {
    let pts = 0, hits = 0;
    for (let seed = 1; seed <= N; seed++) {
      const g = new Game(seed, [diff, diff], [aiLoadout(seed), aiLoadout(seed + 7)]);
      const plan = g.planAiShot(g.aiChooseWeapon());
      g.tank.weapon = plan.weapon; g.tank.angle = plan.angle; g.tank.power = plan.power;
      g.fire(true);
      let guard = 0;
      while ((g.phase === "flight" || g.phase === "boom") && guard++ < 30000) g.update(STEP);
      if (g.tanks[0].score > 0) hits++;
      pts += g.tanks[0].score;
    }
    out[diff] = { avgPoints: +(pts / N).toFixed(1), hitRate: Math.round(hits / N * 100) };
  }
  console.table(out);
  check(out.hard.avgPoints > out.easy.avgPoints, "hard beats easy");
  check(out.hard.hitRate >= out.normal.hitRate - 5 && out.normal.hitRate >= out.easy.hitRate - 5, "hit rates ordered");
}

// 4. Driving: when blocked, the computer drives to a better spot and stays on the ground
{
  let moves = 0, tried = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = new Game(seed, ["hard", "hard"]);
    g.current = 1; g.moveLeft = 60;
    const t = g.tank; const x0 = t.x;
    const wi = 0;
    const m = g.aiDecideMove(wi);
    tried++;
    if (m) {
      moves++;
      let frames = 0;
      g.aiPlan = { weapon: wi, dir: m.dir, targetX: t.x + m.dir * m.dist, shot: null, timer: 0 };
      while (g.aiPlan && g.aiPlan.dir !== 0 && frames++ < 600) g.updateAi(STEP);
      check(Math.abs(t.x - x0) > 5, "AI should have driven, moved " + (t.x - x0).toFixed(1));
      check(g.terrain.isSolid(t.x, t.y + 1) && !g.terrain.isSolid(t.x, t.y - 12), "AI tank on ground after driving");
      check(g.moveLeft >= -1e-6 && g.moveLeft <= 60, "budget respected");
    }
  }
  console.log("computer wanted to drive on", moves, "of", tried, "maps");
}

console.log(problems === 0 ? "ALL AI CHECKS PASSED" : problems + " PROBLEM(S)");
