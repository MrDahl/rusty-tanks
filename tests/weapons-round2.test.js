const G = require("../game.js");
const { Game, Terrain, WEAPONS, STEP, W, H, inShape, makeRng } = G;
let fails = 0;
const check = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } else console.log("ok:", m); };
const byName = (n) => WEAPONS.findIndex((w) => w.name === n);
const run = (g, cond, max = 60 * 40) => { for (let i = 0; i < max && !cond(); i++) g.update(STEP); return cond(); };
const L = (...idx) => [idx.concat(Array(10 - idx.length).fill(0)), idx.concat(Array(10 - idx.length).fill(0))];

// ---- the list
check(WEAPONS.length >= 50, "at least 50 weapons: " + WEAPONS.length);
check(new Set(WEAPONS.map((w) => w.name)).size === WEAPONS.length, "names are unique");
check(WEAPONS.every((w) => typeof w.fx === "string"), "every weapon has an explosion style");
const styles = new Set(WEAPONS.map((w) => w.fx));
console.log("styles:", [...styles].join(", "));
check(styles.size >= 14, "at least 14 different explosion styles: " + styles.size);

// ---- hole shapes
{
  const dims = {};
  for (const shape of ["circle", "wide", "tall", "diamond", "square", "star", "cone", "blob", "trench", "bowl", "ring"]) {
    const t = new Terrain(); t.mask.fill(1);
    t.carveShape(480, 270, 40, shape, makeRng(5));
    let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!t.mask[y * W + x]) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    dims[shape] = { w: x1 - x0 + 1, h: y1 - y0 + 1, n };
  }
  console.log(JSON.stringify(dims));
  check(dims.wide.w > dims.wide.h * 2.5, "wide hole is wide");
  check(dims.tall.h > dims.tall.w * 2.5, "tall hole is tall");
  check(dims.trench.w > dims.trench.h * 4, "trench is long and shallow");
  check(Math.abs(dims.diamond.w - dims.diamond.h) <= 2 && dims.diamond.n < dims.square.n, "diamond");
  check(dims.star.n < dims.circle.n, "star has points (less area than circle)");
  check(dims.ring.n > 0 && dims.ring.n < dims.circle.n * 1.2, "ring carved");
  const areas = Object.entries(dims).map(([k, v]) => k + ":" + v.n).join(" ");
  check(Object.values(dims).every((d) => d.n > 400), "all shapes dig something: " + areas);
  // island in the middle of the ring is untouched
  const t = new Terrain(); t.mask.fill(1); t.carveShape(480, 270, 40, "ring", null);
  check(t.mask[270 * W + 480] === 1 && t.mask[(270 + 35) * W + 480] === 0, "ring leaves an island");
}

// ---- burying
function projAt(g, w, x, y, owner = 0) { return g.makeProj(w, x, y, 0, 0, owner); }
{
  const g = new Game(4, [null, null], L(0), "normal");
  const foe = g.tanks[1];
  const heap = WEAPONS[byName("Slag Heap")];
  g.detonate(projAt(g, heap, foe.x, foe.y - 5));
  check(foe.buried === true, "Slag Heap on a tank buries it (coverage " + g.coverage(foe).toFixed(2) + ")");
  check(g.turnNote.startsWith("Buried"), "message: " + g.turnNote);
  const y0 = foe.y;
  g.settleTanks();
  check(foe.y === y0, "buried tank does not ride up on top of the heap");
  // cannot drive
  g.current = 1; g.moveLeft = 60; g.setMoveDir(1, true);
  const x0 = foe.x; for (let i = 0; i < 60; i++) g.update(STEP);
  check(foe.x === x0, "buried tank cannot drive");
  // a blast frees it
  g.explode(foe.x, foe.y - 14, 0, 40, 10, WEAPONS[0]);
  check(foe.buried === false, "a blast digs it free (coverage " + g.coverage(foe).toFixed(2) + ")");
}
{
  // Landfill over a crater buries; Avalanche rains dirt
  const g = new Game(4, [null, null], L(0), "normal");
  const foe = g.tanks[1];
  g.terrain.carveCircle(foe.x, foe.y, 30); g.settleTanks();
  g.detonate(projAt(g, WEAPONS[byName("Landfill")], foe.x, foe.y - 20));
  check(foe.buried === true, "Landfill buries a tank sitting in a hole");
  const g2 = new Game(4, [null, null], L(byName("Avalanche")), "normal");
  g2.tank.weapon = byName('Avalanche'); g2.tank.angle = 45; g2.tank.power = 55;
  const dirt0 = g2.terrain.mask.reduce((p, c) => p + c, 0);
  g2.fire(); run(g2, () => g2.phase === "aim" || g2.phase === "over");
  const dirt1 = g2.terrain.mask.reduce((p, c) => p + c, 0);
  check(dirt1 > dirt0 + 500, "Avalanche adds lots of dirt: +" + (dirt1 - dirt0));
  const g3 = new Game(4, [null, null], L(0), "normal");
  const a = g3.terrain.mask.reduce((p, c) => p + c, 0);
  g3.detonate(projAt(g3, WEAPONS[byName("Triple Mound")], 480, 250));
  check(g3.terrain.mask.reduce((p, c) => p + c, 0) > a + 400, "Triple Mound adds dirt");
}

// ---- push / pull / arc / quake
{
  const mk = () => { const g = new Game(4, [null, null], L(0), "normal"); g.tanks[1].x = 520; g.tanks[1].y = g.terrain.surfaceY(520, 0); g.tanks[0].x = 300; g.tanks[0].y = g.terrain.surfaceY(300, 0); return g; };
  let g = mk(); let x0 = g.tanks[1].x;
  g.detonate(projAt(g, WEAPONS[byName("Gale Cannon")], 480, g.terrain.surfaceY(480, 0) - 3));
  for (let i = 0; i < 90; i++) g.update(STEP);
  check(g.tanks[1].x > x0 + 15, "Gale Cannon pushes the tank away: " + (g.tanks[1].x - x0).toFixed(0) + " px");
  g = mk(); x0 = g.tanks[1].x;
  g.detonate(projAt(g, WEAPONS[byName("Gravity Well")], 480, g.terrain.surfaceY(480, 0) - 3));
  for (let i = 0; i < 90; i++) g.update(STEP);
  check(g.tanks[1].x < x0 - 10 && g.tanks[1].x > 470, "Gravity Well pulls the tank in without overshooting: " + g.tanks[1].x.toFixed(0));
  g = mk();
  g.detonate(projAt(g, WEAPONS[byName("Arc Lamp")], 440, g.terrain.surfaceY(440, 0) - 3));
  check(g.tanks[0].score > 0 && g.explosions.some((e) => e.kind === "arc"), "Arc Lamp zaps the tank nearby, score " + g.tanks[0].score);
  g = mk();
  g.detonate(projAt(g, WEAPONS[byName("Seismic Slam")], 400, g.terrain.surfaceY(400, 0) - 3));
  check(g.tanks[0].score > 0 && g.tanks[1].score === 0 === false || g.tanks[0].score !== 0, "Seismic Slam hurts tanks in range (" + g.tanks.map((t) => t.score).join("/") + ")");
}

// ---- every weapon plays through (no crashes, turn always ends)
{
  let bad = 0;
  for (let i = 0; i < WEAPONS.length; i++) {
    for (const seed of [2, 9]) {
      const g = new Game(seed, [null, null], L(i), "normal");
      g.tank.weapon = i; g.tank.angle = 50 + seed; g.tank.power = 55; g.fire();
      if (!run(g, () => g.phase === "aim" || g.phase === "over", 60 * 60)) { bad++; console.log("stuck:", WEAPONS[i].name, g.phase); }
    }
  }
  check(bad === 0, "all " + WEAPONS.length + " weapons finish their turn");
}

// ---- final storm
for (const season of ["thunderstorm", "apocalypse"]) {
  const g = new Game(8, [null, null], [Array(2).fill(0), Array(2).fill(0)], season);
  let sawWeather = false, overWithPending = false;
  for (let i = 0; i < 60 * 200 && g.phase !== "over"; i++) {
    if (g.shotsFired[0] >= 2 && g.shotsFired[1] >= 2 && g.phase === "weather") sawWeather = true;
    if (g.phase === "aim") g.fire(true);
    g.update(STEP);
  }
  check(g.phase === "over" && sawWeather, season + ": final storm happens after the last shot, then the game ends");
  check(g.weatherEvents.length === 0 && g.finalRound, season + ": storm is finished before the result");
}
{
  const g = new Game(8, [null, null], [Array(2).fill(0), Array(2).fill(0)], "normal");
  let sawWeather = false;
  for (let i = 0; i < 60 * 200 && g.phase !== "over"; i++) { if (g.phase === "weather") sawWeather = true; if (g.phase === "aim") g.fire(true); g.update(STEP); }
  check(g.phase === "over" && !sawWeather, "normal season: no storm phase");
}
// storm can change the winner: scores shift in the final round
{
  let changed = 0;
  for (let s = 1; s <= 60; s++) {
    const g = new Game(s, [null, null], [Array(1).fill(0), Array(1).fill(0)], "apocalypse");
    let atEnd = null;
    for (let i = 0; i < 60 * 100 && g.phase !== "over"; i++) {
      if (g.phase === "aim") g.fire(true);
      if (g.phase === "weather" && g.finalRound && atEnd === null) atEnd = g.tanks.map((t) => t.score);
      g.update(STEP);
    }
    if (atEnd && g.tanks.some((t, i) => t.score !== atEnd[i])) changed++;
  }
  check(changed > 0, "final meteors can change the score (" + changed + "/60 games)");
}

// ---- AI that is buried digs itself out
{
  let freed = 0, total = 0;
  for (let s = 1; s <= 20; s++) {
    const g = new Game(s, [null, "hard"], L(0, 1, 2, 3, 4, 5), "normal");
    g.current = 1;
    const t = g.tanks[1];
    g.terrain.addHeap(t.x, 45); g.coverTanks(); g.settleTanks();
    if (!t.buried) continue;
    total++;
    run(g, () => g.phase !== "aim" || g.current !== 1, 60 * 20); // its shot
    run(g, () => g.phase === "aim" || g.phase === "over", 60 * 20);
    if (!t.buried) freed++;
  }
  check(total > 10 && freed >= total * 0.8, "the computer blasts itself free (" + freed + "/" + total + ")");
}

// ---- the AI draft helper
{
  const avail = WEAPONS.map((w, i) => i).slice(0, 20);
  const rand = makeRng(3);
  let aiCount = 0, n = 0;
  for (let i = 0; i < 400; i++) { const p = G.aiDraftPick(avail, rand); check_ok = avail.includes(p); if (!avail.includes(p)) fails++; n++; if (WEAPONS[p].ai) aiCount++; }
  check(aiCount / n > 0.55, "computer prefers weapons it can aim from the pool (" + (aiCount / n).toFixed(2) + ")");
}
console.log(fails ? fails + " FAILURE(S)" : "ALL ROUND-2 CHECKS PASSED");
process.exit(fails ? 1 : 0);
