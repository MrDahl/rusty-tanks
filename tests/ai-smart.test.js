// The smarter computer: it values shots in points, picks weapons by prospects, and has personalities.
const G = require("../game.js");
const { Game, AI_STYLES, STEP } = G;
const WL = G.WEAPONS;
const idx = (name) => WL.findIndex((w) => w.name === name);
let problems = 0;
const check = (c, m) => { if (!c) { problems++; console.log("FAIL:", m); } else console.log("ok:", m); };

// A quiet test map: player 0 is the computer, the enemy stands at a known spot
function setup(seed, style) {
  const g = new Game(seed, ["hard", null], undefined, "normal", { aiStyle: style });
  g.current = 0;
  return g;
}

// 1. The value of a shot
{
  const g = setup(5);
  const foe = g.tanks[1], me = g.tanks[0];
  const rivet = WL[idx("Rivet Shot")];
  const direct = g.aiValue(rivet, foe.x, foe.y - 8);
  const far = g.aiValue(rivet, foe.x + 300, foe.y - 8);
  const own = g.aiValue(rivet, me.x, me.y - 8);
  check(direct > 30, "a direct hit is worth a lot (" + direct + ")");
  check(far === 0, "a miss by a mile is worth nothing");
  check(own < 0, "landing on yourself is a loss (" + own + ")");
  const frost = WL[idx("Frost Shell")];
  check(g.aiValue(frost, foe.x, foe.y - 8) > g.aiValue({ ...frost, freeze: undefined }, foe.x, foe.y - 8) + 10, "freezing the enemy turret counts for extra");
  const line = WL[idx("Fuse Line")];
  check(g.aiValue(line, foe.x - 44, foe.y - 8) > g.aiValue({ ...line, line: undefined }, foe.x - 44, foe.y - 8), "a line of blasts reaches the enemy from the side");
  const nuke = WL[idx("Nuclear Warhead")];
  check(g.aiValue(nuke, foe.x + 60, foe.y) > 20, "fallout near the enemy is valued");
}

// 2. The search aims for points, and the weapon pick follows the evaluation
{
  let ok = 0, n = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const g = setup(seed);
    const own = [idx("Rivet Shot"), idx("Big Bolt"), idx("Fan of Five"), idx("Needle Gun"), idx("Fuse Line"), idx("Frost Shell")];
    g.ammo[0] = WL.map(() => 0); own.forEach((i) => (g.ammo[0][i] = 1));
    const evals = g.aiPool().map((i) => g.aiEvalWeapon(i));
    const pick = g.aiPickWeapon(evals.slice());
    const best = evals.slice().sort((a, b) => b.score - a.score)[0];
    n++; if (pick === best.i) ok++;
    check(own.includes(pick), "seed " + seed + ": picked a weapon it owns (" + WL[pick].name + ")");
  }
  check(ok === n, "hard always takes the best-rated weapon");
}

// 3. Personalities pull toward the weapons they like
{
  const share = (style) => {
    let liked = 0, total = 0;
    const L = AI_STYLES[style].likes;
    for (let seed = 1; seed <= 14; seed++) {
      const g = setup(seed, style);
      const own = [idx("Rivet Shot"), idx("Big Bolt"), idx("Triple Rivet"), idx("Hail of Slag"), idx("Frost Shell"), idx("EMP Pulse"), idx("Needle Gun"), idx("Chain Rattler")];
      g.ammo[0] = WL.map(() => 0); own.forEach((i) => (g.ammo[0][i] = 1));
      const p = g.aiChooseWeapon();
      total++; if (L(WL[p])) liked++;
    }
    return liked / total;
  };
  for (const s of Object.keys(AI_STYLES)) {
    const mine = share(s);
    console.log(s, "picks its favourite kind", Math.round(mine * 100) + "% of the time");
  }
  // a trickster should take the status weapons more often than a sniper does
  const tr = share("trickster"), sn = (() => { let c = 0; for (let seed = 1; seed <= 14; seed++) { const g = setup(seed, "sniper"); const own = [idx("Rivet Shot"), idx("Big Bolt"), idx("Triple Rivet"), idx("Hail of Slag"), idx("Frost Shell"), idx("EMP Pulse"), idx("Needle Gun"), idx("Chain Rattler")]; g.ammo[0] = WL.map(() => 0); own.forEach((i) => (g.ammo[0][i] = 1)); const w = WL[g.aiChooseWeapon()]; if (AI_STYLES.trickster.likes(w)) c++; } return c / 14; })();
  check(tr >= sn, "the trickster takes status weapons at least as often as the sniper (" + Math.round(tr * 100) + "% vs " + Math.round(sn * 100) + "%)");
}

// 4. The reworked computer still plays whole matches, hard beats easy
{
  const lo = (s) => { let a = s; const rand = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; const p = []; while (p.length < 10) p.push(G.aiDraftPick(WL.map((w, i) => i).filter((i) => !p.includes(i)), rand)); return p; };
  let hardPts = 0, easyPts = 0;
  for (const seed of [1, 2, 3]) for (const hardFirst of [true, false]) {
    const g = new Game(seed, hardFirst ? ["hard", "easy"] : ["easy", "hard"], [lo(seed), lo(seed + 9)]);
    let guard = 0;
    while (g.phase !== "over" && guard++ < 600000) g.update(STEP);
    check(g.phase === "over", "match " + seed + " finished");
    const h = hardFirst ? 0 : 1;
    hardPts += g.tanks[h].score; easyPts += g.tanks[1 - h].score;
  }
  console.log("hard", hardPts, "easy", easyPts);
  check(hardPts > easyPts, "hard out-scores easy over six matches");
}
console.log(problems === 0 ? "ALL SMART-AI CHECKS PASSED" : problems + " PROBLEM(S)");
process.exit(problems ? 1 : 0);
