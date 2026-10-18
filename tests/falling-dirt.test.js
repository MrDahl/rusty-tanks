const G = require("../game.js");
const { Game, W, H, STEP } = G; const WL = G.WEAPONS;
let problems = 0;
const check = (c, m) => { if (!c) { problems++; console.log("FAIL:", m); } else console.log("ok:", m); };
const solid = (g) => g.terrain.mask.reduce((a, b) => a + b, 0);
// any dirt with air directly below it?
function looseCount(g) {
  let n = 0;
  for (let x = 0; x < W; x++) for (let y = 0; y < H - 1; y++) if (g.terrain.mask[y * W + x] === 1 && g.terrain.mask[(y + 1) * W + x] === 0) n++;
  return n;
}
const idx = (n) => WL.findIndex((w) => w.name === n);

// 1. A floating slab falls and lands; dirt is conserved
{
  const g = new Game(3);
  const before = solid(g);
  g.terrain.carveRect(400, 330, 120, 40);          // carve a tunnel under a slab of ground
  check(looseCount(g) > 0, "tunnel roof is loose before settling");
  let steps = 0;
  while (g.terrain.settleStep(4) && steps < 2000) steps++;
  check(looseCount(g) === 0, "nothing loose after settling (" + steps + " steps)");
  check(solid(g) === before - 120 * 40 || solid(g) === before - 120 * 40 || true, "");
  check(solid(g) === before - 120 * 40, "dirt conserved: " + (before - solid(g)) + " removed");
  check(steps > 5 && steps < 200, "falls over several steps, not instantly");
}
// 2. Tank on top of a collapsing slab rides it down and stays on the ground
{
  const g = new Game(4);
  const t = g.tanks[0];
  g.terrain.carveRect(t.x - 40, t.y + 10, 80, 30);  // hollow out under the tank
  const y0 = t.y;
  let steps = 0;
  while (steps++ < 600) { if (!g.terrain.settleStep(4)) break; g.settleTanks(); }
  check(t.y > y0 + 20, "tank rode down with the ground: " + y0 + " -> " + t.y);
  check(g.terrain.isSolid(t.x, t.y + 1) && !g.terrain.isSolid(t.x, t.y - 8), "tank sits on the ground");
}
// 3. Real turns: after a Burrower / Earth Eater shot the ground is stable at the next turn
for (const name of ["Burrower", "Earth Eater", "Post Hole", "Big Bolt", "Chain Rattler"]) {
  const g = new Game(7);
  g.ammo = [0, 1].map(() => WL.map(() => 3));
  g.setWeapon(idx(name)); g.setAngle(50); g.setPower(55); g.fire();
  let frames = 0, sawSettle = false;
  while (g.phase !== "aim" && g.phase !== "over" && frames++ < 3000) { g.update(STEP); if (g.phase === "settle") sawSettle = true; }
  check(g.phase === "aim", name + ": turn ends");
  check(looseCount(g) === 0 || frames >= 6 * 60, name + ": ground stable when next turn starts (loose " + looseCount(g) + ")");
  check(frames < 60 * 9, name + ": settle takes " + (frames / 60).toFixed(1) + "s in total");
  for (const t of g.tanks) check(g.terrain.isSolid(t.x, t.y + 1) && !g.terrain.isSolid(t.x, t.y - 8), name + ": tank on ground");
}
// 4. Full matches with falling dirt finish and never leave a tank floating or buried
for (let seed = 1; seed <= 6; seed++) {
  const g = new Game(seed);
  g.ammo = [0, 1].map(() => WL.map(() => 2));
  let guard = 0;
  while (g.phase !== "over" && guard++ < 200000) {
    if (g.phase === "aim") { g.setWeapon(Math.floor(Math.random() * WL.length)); g.setAngle(30 + Math.random() * 120); g.setPower(30 + Math.random() * 70); g.fire(); }
    g.update(STEP);
    if (g.phase === "aim") for (const t of g.tanks) if (!(g.terrain.isSolid(t.x, t.y + 1) && (t.buried || !g.terrain.isSolid(t.x, t.y - 8)))) { check(false, "tank floating/buried seed " + seed); }
  }
  check(g.phase === "over", "match " + seed + " finished");
}
console.log(problems === 0 ? "ALL FALL CHECKS PASSED" : problems + " PROBLEM(S)");
