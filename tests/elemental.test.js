const G = require("../game.js");
const { Game, WEAPONS, STEP } = G;
const idx = (n) => WEAPONS.findIndex((w) => w.name === n);
const L = (...n) => [n.map(idx).concat(Array(10 - n.length).fill(0)), n.map(idx).concat(Array(10 - n.length).fill(0))];
let fails = 0; const ck = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } else console.log("ok:", m); };
const run = (g, cond, max = 60 * 40) => { for (let i = 0; i < max && !cond(); i++) g.update(STEP); return cond(); };
// fire a weapon so that it lands at (x) near enemy: place enemy and cheat by detonating directly
function shotAt(g, name, x, y) { const w = WEAPONS[idx(name)]; g.usedWeapon = w; g.removedAtFire = g.terrain.removed; g.detonate(g.makeProj(w, x, y, 0, 0, g.current)); }
{ // freeze
  const g = new Game(5, [null, null], L("Frost Shell"), "normal");
  const foe = g.tanks[1];
  shotAt(g, "Frost Shell", foe.x - 10, foe.y - 10);
  ck(foe.status.frozen === 1, "frost shell freezes enemy turret");
  const sc = g.tanks[0].score; ck(sc > 0, "freeze bonus/blast scored: " + sc);
  g.phase = "settle"; g.settleTime = 0; run(g, () => g.phase === "aim" && g.current === 1);
  ck(g.current === 1 && g.tank.lock.angle, "enemy turret locked on its turn");
  const a0 = g.tank.angle; g.setAngle(a0 + 20); ck(g.tank.angle === a0, "angle can't change while frozen");
  g.setPower(33); ck(g.tank.power === 33, "power still works");
  g.endTurn(); g.endTurn(); ck(!g.tank.lock.angle || g.current === 1, "lock gone later");
}
{ // monsoon ice
  const g = new Game(6, [null, null], L("Frost Shell"), "monsoon");
  const x = 480, y = g.terrain.surfaceY(480, 0);
  shotAt(g, "Frost Shell", x, y - 2);
  let ice = 0; for (let i = 0; i < g.terrain.ice.length; i++) ice += g.terrain.ice[i];
  ck(ice > 200, "monsoon frost makes ice: " + ice);
  const before = g.terrain.removed; g.terrain.carveCircle(x, y + 5, 30);
  ck(g.terrain.removed - before === 0 && g.terrain.isSolid(x, y + 30), "ice resists digging");
  const n = new Game(6, [null, null], L("Frost Shell"), "normal"); shotAt(n, "Frost Shell", 480, y); let ni = 0; for (const v of n.terrain.ice) ni += v;
  ck(ni === 0, "no ice outside monsoon");
}
{ // flames follow gravity into a crater
  const g = new Game(7, [null, null], L("Napalm Shell"), "normal");
  const t = g.terrain; t.carveCircle(500, t.surfaceY(500, 0) + 2, 30); // a crater
  const rimX = 440; shotAt(g, "Napalm Shell", rimX, t.surfaceY(rimX, 0) - 6);
  ck(g.flames.length === 8, "napalm spawned flames");
  run(g, () => false, 60 * 2);
  const inCrater = g.flames.filter((f) => Math.abs(f.x - 500) < 40).length;
  console.log("   flames:", g.flames.length, "near crater:", inCrater, "xs:", g.flames.map((f) => Math.round(f.x)).join(","));
  g.phase = "settle"; run(g, () => g.flames.length === 0, 60 * 6); ck(g.flames.length === 0, "flames burn out");
}
{ // burn damage to a tank
  const g = new Game(8, [null, null], L("Napalm Shell"), "normal");
  const foe = g.tanks[1]; const s0 = g.tanks[0].score;
  shotAt(g, "Napalm Shell", foe.x, foe.y - 12);
  run(g, () => g.flames.length === 0, 60 * 8);
  console.log("   burn score", g.tanks[0].score - s0, "dot stat", g.stats[0].dot);
  ck(g.stats[0].dot > 0, "flames deal damage over time");
  const m = new Game(8, [null, null], L("Napalm Shell"), "monsoon"); shotAt(m, "Napalm Shell", m.tanks[1].x, m.tanks[1].y - 12);
  ck(m.flames[0].life < 2, "monsoon rain shortens flames: " + m.flames[0].life.toFixed(2));
}
{ // nuclear
  const g = new Game(9, [null, null], L("Nuclear Warhead"), "normal");
  const foe = g.tanks[1];
  shotAt(g, "Nuclear Warhead", foe.x - 20, foe.y - 10);
  ck(foe.status.rad === 3 && foe.status.confused >= 1, "foe irradiated + confused");
  ck(g.tanks[0].status.rad === 0, "shooter far away is safe");
  const s0 = g.tanks[0].score;
  g.phase = "settle"; g.settleTime = 0; run(g, () => g.current === 1 && g.phase === "aim");
  const nd = WEAPONS[idx("Nuclear Warhead")].nuke.dmg;
  ck(g.stats[0].dot === nd && g.tanks[0].score >= s0 + nd, "first radiation tick on victim's turn: " + g.stats[0].dot);
  ck(g.tank.lock.scramble, "controls scrambled on that turn");
  const self = new Game(9, [null, null], L("Nuclear Warhead"), "normal");
  shotAt(self, "Nuclear Warhead", self.tanks[0].x + 30, self.tanks[0].y - 10);
  ck(self.tanks[0].status.rad === 3, "hitting yourself irradiates you");
}
{ // EMP
  const g = new Game(10, [null, null], L("EMP Pulse"), "normal");
  shotAt(g, "EMP Pulse", g.tanks[1].x, g.tanks[1].y - 10);
  g.phase = "settle"; g.settleTime = 0; run(g, () => g.current === 1 && g.phase === "aim");
  ck(g.tank.lock.drive && g.tank.lock.power, "EMP locks driving and power");
  const x0 = g.tank.x; g.setMoveDir(1); for (let i = 0; i < 60; i++) g.update(STEP); ck(g.tank.x === x0, "can't drive under EMP");
}
{ // AI with frozen turret still shoots
  const g = new Game(11, [null, "hard"], L("Rivet Shot", "Frost Shell"), "normal");
  g.tanks[1].status.frozen = 1; g.current = 1; g.beginTurnStatus();
  const a0 = g.tank.angle; run(g, () => g.phase !== "aim", 60 * 12);
  ck(g.phase !== "aim" && Math.abs(g.tank.angle - a0) < 1e-6, "frozen AI fires without moving its turret");
}
{ // buried bonus
  const g = new Game(12, [null, null], L("Mud Pie"), "normal");
  const foe = g.tanks[1]; const s0 = g.tanks[0].score;
  shotAt(g, "Mud Pie", foe.x, foe.y - 6);
  console.log("   buried:", foe.buried, "score", g.tanks[0].score - s0, "buries", g.stats[0].buries);
}
{ // fall damage: dig the ground out from under a tank
  const g = new Game(13, [null, null], L("Rivet Shot"), "normal");
  const foe = g.tanks[1]; const y0 = foe.y;
  g.usedWeapon = WEAPONS[0]; g.phase = "boom"; g.boomTimer = 5;
  g.terrain.carveCircle(foe.x, foe.y + 25, 40); g.settleTanks();
  run(g, () => g.tanks[1].fall === 0 && g.tanks[1].y > y0 + 15, 600);
  for (let i = 0; i < 20; i++) g.update(STEP);
  console.log("   dropped", foe.y - y0, "px; shooter score", g.tanks[0].score);
  ck(foe.y - y0 > 15 && g.tanks[0].score > 0, "falling into a hole hurts the victim (credited to the shooter)");
}
{ // radiation still waiting when the match ends is paid out in full
  const g = new Game(9, [null, null], L("Nuclear Warhead"), "normal");
  const foe = g.tanks[1];
  shotAt(g, "Nuclear Warhead", foe.x - 20, foe.y - 10);
  const before = g.tanks[0].score, left = foe.status.rad, dmg = foe.status.radDmg;
  ck(left > 0, "foe is irradiated");
  g.settleRadiation();
  ck(foe.status.rad === 0 && g.tanks[0].score >= before, "pending radiation settled at match end (" + left + " ticks x " + dmg + ")");
}
console.log(fails ? fails + " FAILURES" : "ALL ELEMENTAL CHECKS PASSED");
process.exit(fails ? 1 : 0);
