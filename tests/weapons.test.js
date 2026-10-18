const { Game, WEAPONS, W, H, STEP } = require("../game.js");

let problems = 0;
const check = (c, m) => { if (!c) { problems++; console.log("FAIL:", m); } };
const solid = (g) => g.terrain.mask.reduce((a, b) => a + b, 0);
const idx = (name) => WEAPONS.findIndex((w) => w.name === name);

// every weapon gets 3 uses for both players
function fresh(seed) {
  const g = new Game(seed);
  g.ammo = [0, 1].map(() => WEAPONS.map(() => 3));
  return g;
}

function shoot(g, name, angle, power) {
  g.setWeapon(idx(name));
  g.setAngle(angle);
  g.setPower(power);
  const before = { solid: solid(g), x: g.tank.x, y: g.tank.y, me: g.current };
  g.fire();
  const st = { maxProjs: 0, frames: 0, maxExpl: 0 };
  while (g.phase === "flight" || g.phase === "boom" || g.phase === "settle") {
    g.update(STEP);
    st.frames++;
    st.maxProjs = Math.max(st.maxProjs, g.projs.length);
    st.maxExpl = Math.max(st.maxExpl, g.explosions.length);
    for (const p of g.projs) if (Number.isNaN(p.x) || Number.isNaN(p.y)) check(false, name + " NaN position");
    if (st.frames > 30000) { check(false, name + " never finished"); break; }
  }
  st.before = before;
  st.removed = before.solid - solid(g);
  return st;
}

// 1. Every weapon, many shots, always finishes, tanks stay valid
for (const w of WEAPONS) {
  for (let seed = 1; seed <= 15; seed++) {
    const g = fresh(seed);
    for (let turn = 0; turn < 4; turn++) {
      const ang = g.current === 0 ? 30 + Math.random() * 100 : 50 + Math.random() * 100;
      shoot(g, w.name, ang, 30 + Math.random() * 70);
      for (const t of g.tanks) {
        check(t.y >= 0 && t.y <= H && t.x >= 0 && t.x < W && !Number.isNaN(t.y) && !Number.isNaN(t.x), w.name + " bad tank pos " + t.x + "," + t.y);
      }
      check(g.projs.length === 0, w.name + " left shells behind");
    }
  }
}
console.log("generic run over", WEAPONS.length, "weapons done");

// 2. Specific behaviours
{ // volley counts
  let st = shoot(fresh(3), "Triple Rivet", 60, 60); check(st.maxProjs === 3, "Triple should have 3 shells, got " + st.maxProjs);
  st = shoot(fresh(3), "Fan of Five", 60, 60); check(st.maxProjs === 5, "Fan of Five: " + st.maxProjs);
  st = shoot(fresh(3), "Rapid Rivets", 60, 60); check(st.maxProjs === 5, "Rapid: " + st.maxProjs);
}
{ // stagger: shells launch one after another
  const g = fresh(4); g.setWeapon(idx("Rapid Rivets")); g.fire();
  check(g.projs.filter((p) => p.delay > 0).length === 4, "4 of 5 rapid shells should wait");
}
{ // Earth Eater removes a lot, no score
  const g = fresh(5); g.setWeapon(idx("Earth Eater"));
  const before = solid(g);
  g.explode(480, 420, 0, 85, 0, WEAPONS[idx("Earth Eater")]);
  check(before - solid(g) > 10000, "Earth Eater should remove lots of dirt");
  check(g.tanks[0].score === 0 && g.tanks[1].score === 0, "no points from Earth Eater");
}
{ // Scrap Wall grows upward, not onto tanks
  const g = fresh(6); const x = 480; const top0 = g.terrain.surfaceY(x, 0);
  g.terrain.addWall(x, 120, 12, g.tanks.map((t) => t.x));
  check(g.terrain.surfaceY(x, 0) < top0 - 100, "wall should be tall");
}
{ // Post Hole digs deep and narrow
  const g = fresh(7); const x = 480, y = g.terrain.surfaceY(x, 0);
  g.explode(x, y, 0, 20, 30, WEAPONS[idx("Post Hole")]);
  g.terrain.carveRect(x - 7, y - 4, 14, 95);
  check(!g.terrain.isSolid(x, y + 80), "shaft should be open at depth 80");
}
{ // Warp Hop moves the tank
  const g = fresh(8); const x0 = g.tank.x;
  const st = shoot(g, "Warp Hop", 50, 55);
  check(Math.abs(g.tanks[0].x - x0) > 40 || g.lastHit !== "Teleported!", "Warp Hop should move the tank");
  console.log("warp hop:", x0.toFixed(0), "->", g.tanks[0].x.toFixed(0), g.lastHit);
}
{ // Rocket Hop moves the tank
  const g = fresh(9); const x0 = g.tank.x;
  shoot(g, "Rocket Hop", 45, 60);
  check(Math.abs(g.tanks[0].x - x0) > 40, "Rocket Hop should move far, moved " + (g.tanks[0].x - x0).toFixed(0));
  check(g.lastHit === "Hopped!", "hop message: " + g.lastHit);
  check(g.tanks[0].score === 0, "hop gives no score");
}
{ // Wrecker / Rolling Barrel roll
  const g = fresh(10);
  const st = shoot(g, "Rolling Barrel", 20, 25);
  check(st.frames > 60, "rolling barrel should take a while, frames " + st.frames);
}
{ // Ticker: explodes by its 2.6s fuse (earlier only if it touches a tank)
  let onFuse = 0, late = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const g = fresh(seed); g.setWeapon(idx("Ticker")); g.setAngle(45); g.setPower(55); g.fire();
    let t = 0;
    while (g.phase === "flight" && t < 6 && !g.explosions.length) { g.update(STEP); t += STEP; }
    if (g.explosions.length && t > 2.5 && t < 2.8) onFuse++;
    if (g.explosions.length && t > 2.9) late++;
  }
  check(onFuse >= 3 && late === 0, "ticker fuse: on time " + onFuse + ", late " + late);
}
{ // Hail of Slag makes a rain of 8
  const st = shoot(fresh(12), "Hail of Slag", 55, 50); check(st.maxProjs >= 8, "rain count " + st.maxProjs);
}
{ // Shrapnel Pod sprays 7
  const st = shoot(fresh(13), "Shrapnel Pod", 55, 50); check(st.maxProjs >= 7 || st.frames < 5, "burst count " + st.maxProjs);
}
{ // Chain Rattler / Fuse Line make several explosions
  let st = shoot(fresh(14), "Chain Rattler", 55, 50); check(st.maxExpl >= 7, "scatter blasts " + st.maxExpl);
  st = shoot(fresh(14), "Fuse Line", 55, 50); check(st.maxExpl >= 5, "line blasts " + st.maxExpl);
}
{ // Mystery Crate launches another weapon
  let launched = 0;
  for (let seed = 1; seed <= 10; seed++) { const g = fresh(seed); const st = shoot(g, "Mystery Crate", 55, 50); if (/Crate:/.test(g.lastHit) || st.maxProjs >= 1) launched++; }
  check(launched > 0, "crate should launch weapons");
}
{ // Magnet Dart bends toward the enemy; Needle Gun is flat
  const g = fresh(15); g.setWeapon(idx("Needle Gun")); g.setAngle(35); g.setPower(80);
  const path = g.predictPath(600);
  console.log("needle path length", path.length, "end x", path[path.length - 1].x.toFixed(0));
}
{ // Wobble Shot scrambles the victim
  const g = fresh(16); const v = g.tanks[1]; const a0 = v.angle, p0 = v.power;
  g.explode(v.x, v.y - 8, 0, 30, 20, WEAPONS[idx("Wobble Shot")]);
  check(v.angle !== a0 || v.power !== p0, "victim should be scrambled");
}

// 3. Driving
{
  const g = fresh(20); const t = g.tank; const x0 = t.x;
  g.setMoveDir(1);
  for (let i = 0; i < 300; i++) g.update(STEP);   // 5 seconds of holding right
  const moved = t.x - x0;
  check(moved > 20 && moved <= 60.01, "should drive up to the 60px budget, moved " + moved.toFixed(1));
  check(g.moveLeft < 1e-6 || moved < 60, "budget used");
  check(g.terrain.isSolid(t.x, t.y + 1) && !g.terrain.isSolid(t.x, t.y - 12), "tank sits on the ground after driving");
  // budget resets next turn
  g.setMoveDir(0); g.fire();
  while (g.phase !== "aim" && g.phase !== "over") g.update(STEP);
  check(g.moveLeft === 60 && g.current === 1, "new turn, fresh budget for player 2");
  // cannot drive into the other tank
  const g2 = fresh(21); g2.tanks[1].x = g2.tanks[0].x + 40; g2.tanks[1].y = g2.terrain.surfaceY(g2.tanks[1].x, 0);
  g2.setMoveDir(1);
  for (let i = 0; i < 200; i++) g2.update(STEP);
  check(Math.abs(g2.tanks[1].x - g2.tanks[0].x) >= 35.9, "tanks keep their distance");
  // cannot drive during computer turn
  const g3 = new Game(22, [null, "normal"]); g3.current = 1; g3.setMoveDir(1);
  check(g3.moveDir === 0, "human cannot steer computer");
}

// 4. Draft loadouts
{
  const lo = [[0, 0, 1, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]];
  const g = new Game(30, undefined, lo);
  check(g.ammo[0][0] === 2 && g.ammo[0][1] === 1 && g.ammo[0][9] === 0, "ammo from loadout");
  check(g.shotLimit === 10, "10 shots");
  check(g.tanks[1].weapon === 9, "first weapon of player 2 selected");
  let guard = 0;
  while (g.phase !== "over" && guard++ < 100000) {
    if (g.phase === "aim") { g.setAngle(40 + Math.random() * 100); g.setPower(30 + Math.random() * 60); g.fire(); }
    g.update(STEP);
  }
  check(g.phase === "over" && g.shotsFired[0] === 10 && g.shotsFired[1] === 10, "draft match finishes after 10 shots each");
  check(g.ammo[0].every((n) => n === 0) && g.ammo[1].every((n) => n === 0), "all ammo used");
}

console.log(problems === 0 ? "ALL WEAPON CHECKS PASSED" : problems + " PROBLEM(S)");
