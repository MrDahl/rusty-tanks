// =====================================================================
//  RUSTY TANKS - game logic
//  This file only contains the RULES of the game (terrain, physics,
//  scoring, turns). It never draws anything, which makes it easy to
//  test and to change. Drawing and keyboard/mouse input live in main.js.
// =====================================================================

// ---- Tunable numbers: change these to change how the game feels ------
const W = 960;                 // game width in pixels
const H = 540;                 // game height in pixels
const GRAVITY = 400;           // how fast shells fall (pixels per second squared)
const WIND_ACCEL = 2.5;        // how strongly wind pushes a shell
const SPEED_PER_POWER = 6.2;   // power 100 = 620 pixels per second
const TANK_RADIUS = 14;        // size of a tank for hit detection
const SHOTS_PER_PLAYER = 10;   // match length
const WIND_MAX = 20;           // strongest possible wind (either direction)
const BOOM_TIME = 0.8;         // seconds the explosion animation lasts
const STEP = 1 / 60;           // physics runs in fixed 1/60 second steps


// ---- The weapons -------------------------------------------------------
// Every weapon is just a list of settings. To invent a new weapon, copy a
// line, change the numbers and give it a new name.
//   blast    = size of the crater and damage zone (pixels)
//   damage   = points for a perfect direct hit (less further from the centre)
//   ammo     = how many times each player can use it (Infinity = unlimited)
//   split    = bursts into several small shells at the top of its arc
//   bounces  = how many times it bounces off the ground before exploding
//   drill    = how many pixels it burrows through dirt before exploding
//   dirt     = instead of exploding, piles up a heap of dirt this wide
const WEAPONS = [
  { name: "Rivet Shot",   blast: 34, damage: 50, ammo: Infinity, color: "#1a1a1a",
    info: "Reliable all-rounder." },
  { name: "Big Bolt",     blast: 60, damage: 75, ammo: 2, color: "#8a2b1a",
    info: "Huge blast." },
  { name: "Scatter Nuts", blast: 24, damage: 30, ammo: 2, color: "#d9a441",
    split: { count: 5, spread: 80, blast: 20, damage: 18 },
    info: "Bursts into 5 shells at the top of its arc." },
  { name: "Pogo Bomb",    blast: 30, damage: 45, ammo: 2, color: "#7fa6b3",
    bounces: 3, elasticity: 0.7,
    info: "Bounces 3 times before it explodes." },
  { name: "Burrower",     blast: 36, damage: 55, ammo: 2, color: "#5a3a2a",
    drill: 70,
    info: "Drills into the ground, then explodes." },
  { name: "Slag Heap",    blast: 0,  damage: 0,  ammo: 2, color: "#a8683a",
    dirt: 45,
    info: "Piles up a heap of dirt where it lands." },
];
const DRILL_SPEED = 240; // how fast the Burrower digs (pixels per second)

// ---- Seeded random numbers (same seed = same map) --------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Terrain: a grid with one byte per pixel (1 = dirt, 0 = air) -----
let versionCounter = 0; // every terrain change gets a new number, so main.js knows when to repaint
class Terrain {
  constructor() {
    this.mask = new Uint8Array(W * H);
    this.version = ++versionCounter;
  }

  isSolid(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return this.mask[y * W + x] === 1;
  }

  // Remove a round bite of dirt (this is what explosions do)
  carveCircle(cx, cy, r) {
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(W - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.mask[y * W + x] = 0;
      }
    }
    this.version = ++versionCounter;
  }

  // Pile a heap of dirt on top of the ground (used by the Slag Heap)
  addHeap(cx, r) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx;
      const height = Math.round(r * 0.9 * Math.sqrt(Math.max(0, 1 - (dx * dx) / (r * r))));
      const top = this.surfaceY(x, 0);
      for (let y = Math.max(0, top - height); y < top; y++) this.mask[y * W + x] = 1;
    }
    this.version = ++versionCounter;
  }

  // Find the first dirt pixel going downward from fromY
  surfaceY(x, fromY) {
    x = Math.max(0, Math.min(W - 1, Math.floor(x)));
    for (let y = Math.max(0, Math.floor(fromY)); y < H; y++) {
      if (this.mask[y * W + x] === 1) return y;
    }
    return H;
  }

  // Build a fresh random landscape. Rules that keep it fun:
  //  1. Smooth rolling hills (a few sine waves added together)
  //  2. A flat spot where each tank starts
  //  3. The hill between the tanks is never allowed to get huge
  generate(rand, tankXs) {
    this.mask.fill(0);

    const base = 190 + rand() * 60;
    const amp = 0.7 + rand() * 0.6;
    const p1 = rand() * 6.28;
    const p2 = rand() * 6.28;
    const p3 = rand() * 6.28;
    const h = new Array(W);
    for (let x = 0; x < W; x++) {
      h[x] =
        base +
        amp * (70 * Math.sin(x * 0.006 + p1) +
               38 * Math.sin(x * 0.015 + p2) +
               16 * Math.sin(x * 0.04 + p3));
    }

    // Flat starting spots, blended smoothly into the hills
    const flatHalf = 30;
    const blend = 45;
    for (const tx of tankXs) {
      const level = h[tx];
      for (let x = tx - flatHalf - blend; x <= tx + flatHalf + blend; x++) {
        if (x < 0 || x >= W) continue;
        const d = Math.abs(x - tx);
        if (d <= flatHalf) {
          h[x] = level;
        } else {
          const t = (d - flatHalf) / blend;          // 0..1
          const k = (1 - Math.cos(t * Math.PI)) / 2; // smooth ease
          h[x] = level * (1 - k) + h[x] * k;
        }
      }
    }

    // Squash any giant mountain between the tanks
    const limit = Math.max(h[tankXs[0]], h[tankXs[1]]) + 120;
    for (let x = tankXs[0]; x <= tankXs[1]; x++) {
      if (h[x] > limit) h[x] = limit + (h[x] - limit) * 0.25;
    }

    for (let x = 0; x < W; x++) {
      const height = Math.max(60, Math.min(H - 80, Math.round(h[x])));
      for (let y = H - height; y < H; y++) this.mask[y * W + x] = 1;
    }
    this.version = ++versionCounter;
  }
}

// ---- Moving a shell one physics step ---------------------------------
// Used by the real game AND by the aim guide, so they always agree.
// Returns "flying", "hit" (touched dirt or a tank) or "out" (left the map).
function stepProjectile(p, dt, wind, terrain, tanks) {
  p.vx += wind * WIND_ACCEL * dt;
  p.vy += GRAVITY * dt;

  // Move in tiny pieces (max 1 pixel each) so fast shells can't skip through dirt
  const dist = Math.hypot(p.vx, p.vy) * dt;
  const pieces = Math.max(1, Math.ceil(dist));
  for (let i = 0; i < pieces; i++) {
    p.lastX = p.x;
    p.lastY = p.y;
    p.x += (p.vx * dt) / pieces;
    p.y += (p.vy * dt) / pieces;

    if (p.x < 0 || p.x >= W || p.y >= H) return "out";
    if (terrain.isSolid(p.x, p.y)) return "hit";
    for (const t of tanks) {
      if (Math.hypot(p.x - t.x, p.y - (t.y - 8)) <= TANK_RADIUS) return "hit";
    }
  }
  return "flying";
}

// ---- The game itself -------------------------------------------------
class Game {
  constructor(seed) {
    this.newMatch(seed === undefined ? Date.now() : seed);
  }

  newMatch(seed) {
    this.seed = seed;
    this.rand = makeRng(seed);
    this.terrain = new Terrain();

    const tankXs = [
      Math.round(110 + this.rand() * 60),
      Math.round(W - 170 + this.rand() * 60),
    ];
    this.terrain.generate(this.rand, tankXs);

    this.tanks = tankXs.map((x, i) => ({
      x: x,
      y: this.terrain.surfaceY(x, 0),
      angle: i === 0 ? 55 : 125, // 0 = right, 90 = up, 180 = left
      power: 60,
      score: 0,
      weapon: 0,                 // index into WEAPONS
    }));
    // ammo[player][weapon] = shots left
    this.ammo = [0, 1].map(() => WEAPONS.map((w) => w.ammo));

    this.current = 0;
    this.shotsFired = [0, 0];
    this.wind = Math.round((this.rand() * 2 - 1) * 10);
    this.phase = "aim"; // "aim" -> "flight" -> "boom" -> "aim" ... -> "over"
    this.projs = [];        // all shells currently in the air
    this.explosions = [];   // explosion animations
    this.boomTimer = 0;
    this.turnGain = 0;      // points scored this turn
    this.turnSelf = 0;      // points lost to self-hits this turn
    this.lastHit = "";      // short message about the last shot
  }

  get tank() {
    return this.tanks[this.current];
  }

  get weapon() {
    return WEAPONS[this.tank.weapon];
  }

  // Where the barrel ends (the shell starts here)
  barrelTip(t) {
    const a = (t.angle * Math.PI) / 180;
    return { x: t.x + Math.cos(a) * 20, y: t.y - 8 - Math.sin(a) * 20 };
  }

  setAngle(deg) {
    if (this.phase === "aim") this.tank.angle = Math.max(0, Math.min(180, deg));
  }

  setPower(p) {
    if (this.phase === "aim") this.tank.power = Math.max(5, Math.min(100, p));
  }

  hasAmmo(player, weaponIndex) {
    return this.ammo[player][weaponIndex] > 0;
  }

  setWeapon(index) {
    if (this.phase !== "aim" || index < 0 || index >= WEAPONS.length) return;
    if (this.hasAmmo(this.current, index)) this.tank.weapon = index;
  }

  fire() {
    if (this.phase !== "aim") return;
    const t = this.tank;
    if (!this.hasAmmo(this.current, t.weapon)) return;
    const w = WEAPONS[t.weapon];
    this.ammo[this.current][t.weapon]--;

    const tip = this.barrelTip(t);
    const a = (t.angle * Math.PI) / 180;
    const speed = t.power * SPEED_PER_POWER;
    this.projs = [{
      x: tip.x,
      y: tip.y,
      lastX: tip.x,
      lastY: tip.y,
      vx: Math.cos(a) * speed,
      vy: -Math.sin(a) * speed,
      owner: this.current,
      w: w,
      bouncesLeft: w.bounces || 0,
      drilling: false,
      dug: 0,
      airCount: 0,
      splitDone: false,
      dead: false,
    }];
    this.shotsFired[this.current]++;
    this.turnGain = 0;
    this.turnSelf = 0;
    this.lastHit = "";
    // Out of this weapon? Go back to the Rivet Shot for next time.
    if (!this.hasAmmo(this.current, t.weapon)) t.weapon = 0;
    this.usedWeapon = w;
    this.phase = "flight";
  }

  // Call this 60 times per second
  update(dt) {
    for (const e of this.explosions) e.t += dt;

    if (this.phase === "flight") {
      for (const p of this.projs.slice()) this.updateProjectile(p, dt);
      this.projs = this.projs.filter((p) => !p.dead);
      if (this.projs.length === 0) {
        if (this.turnGain > 0 && this.turnSelf > 0) {
          this.lastHit = "Hit! +" + this.turnGain + "   Ouch! -" + this.turnSelf;
        } else if (this.turnGain > 0) {
          this.lastHit = "Hit! +" + this.turnGain;
        } else if (this.turnSelf > 0) {
          this.lastHit = "Ouch! Hit yourself: -" + this.turnSelf;
        } else {
          this.lastHit = this.usedWeapon && this.usedWeapon.dirt ? "Dirt piled up!" : "Missed!";
        }
        this.phase = "boom";
        this.boomTimer = this.explosions.length ? BOOM_TIME : 0.5;
      }
    } else if (this.phase === "boom") {
      this.boomTimer -= dt;
      if (this.boomTimer <= 0) this.endTurn();
    }
  }

  // Move one shell and react to what happens to it
  updateProjectile(p, dt) {
    if (p.drilling) {
      this.updateDrill(p, dt);
      return;
    }

    const vyBefore = p.vy;
    const result = stepProjectile(p, dt, this.wind, this.terrain, this.tanks);

    if (result === "out") {
      p.dead = true;
      return;
    }

    // Scatter Nuts: burst apart when the shell stops rising
    if (result === "flying" && p.w.split && !p.splitDone && vyBefore < 0 && p.vy >= 0) {
      p.splitDone = true;
      p.dead = true;
      const s = p.w.split;
      const fragment = { name: "fragment", blast: s.blast, damage: s.damage, color: p.w.color };
      for (let i = 0; i < s.count; i++) {
        const k = s.count === 1 ? 0 : i / (s.count - 1) - 0.5; // -0.5 .. 0.5
        this.projs.push({
          x: p.x, y: p.y, lastX: p.x, lastY: p.y,
          vx: p.vx + k * 2 * s.spread,
          vy: p.vy,
          owner: p.owner, w: fragment,
          bouncesLeft: 0, drilling: false, dug: 0, airCount: 0, splitDone: true, dead: false,
        });
      }
      return;
    }

    if (result === "hit") {
      const hitTank = this.tanks.some((t) => Math.hypot(p.x - t.x, p.y - (t.y - 8)) <= TANK_RADIUS);

      // Pogo Bomb: bounce off the ground
      if (!hitTank && p.bouncesLeft > 0) {
        this.bounce(p);
        return;
      }
      // Burrower: start digging
      if (!hitTank && p.w.drill) {
        const speed = Math.hypot(p.vx, p.vy) || 1;
        p.drilling = true;
        p.dx = p.vx / speed;
        p.dy = p.vy / speed;
        return;
      }
      this.detonate(p);
    }
  }

  // Reflect a shell off the ground
  bounce(p) {
    // Find which way the ground faces by checking nearby air pixels
    let nx = 0, ny = 0;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (!this.terrain.isSolid(p.x + dx, p.y + dy)) { nx += dx; ny += dy; }
      }
    }
    const len = Math.hypot(nx, ny);
    if (len === 0) { nx = 0; ny = -1; } else { nx /= len; ny /= len; }

    const e = p.w.elasticity;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) {
      p.vx -= (1 + e) * vn * nx;
      p.vy -= (1 + e) * vn * ny;
    }
    p.x = p.lastX;
    p.y = p.lastY;
    p.bouncesLeft--;
    this.terrain.carveCircle(p.x + nx * -3, p.y + ny * -3, 5); // little dent
    if (Math.hypot(p.vx, p.vy) < 40) this.detonate(p);
  }

  // The Burrower tunnelling through dirt
  updateDrill(p, dt) {
    const pieces = Math.max(1, Math.ceil(DRILL_SPEED * dt));
    for (let i = 0; i < pieces; i++) {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x >= W || p.y >= H) { p.dead = true; return; }
      if (this.tanks.some((t) => Math.hypot(p.x - t.x, p.y - (t.y - 8)) <= TANK_RADIUS)) {
        this.detonate(p);
        return;
      }
      p.airCount = this.terrain.isSolid(p.x, p.y) ? 0 : p.airCount + 1;
      this.terrain.carveCircle(p.x, p.y, 5);
      p.dug++;
      // Came out the other side, or dug deep enough: boom
      if (p.dug >= p.w.drill || (p.dug > 6 && p.airCount > 3)) {
        this.detonate(p);
        return;
      }
    }
  }

  // A shell reaches its end: explode (or pile up dirt)
  detonate(p) {
    p.dead = true;
    if (p.w.dirt) {
      this.terrain.addHeap(p.x, p.w.dirt);
      this.explosions.push({ x: p.x, y: p.y, r: p.w.dirt, t: 0, kind: "dirt" });
      this.settleTanks();
    } else {
      this.explode(p.x, p.y, p.owner, p.w.blast, p.w.damage);
    }
  }

  explode(x, y, owner, blast, damage) {
    this.terrain.carveCircle(x, y, blast);

    // Score: closer to the middle of the blast = more points
    const reach = blast + TANK_RADIUS * 0.5;
    this.tanks.forEach((t, i) => {
      const d = Math.hypot(x - t.x, y - (t.y - 8));
      if (d <= reach) {
        const points = Math.max(1, Math.round(damage * (1 - d / reach)));
        if (i === owner) {
          this.tanks[owner].score -= points;
          this.turnSelf += points;
        } else {
          this.tanks[owner].score += points;
          this.turnGain += points;
        }
      }
    });

    this.explosions.push({ x: x, y: y, r: blast, t: 0, kind: "fire" });
    this.settleTanks();
  }

  // Tanks drop down if the ground vanishes, and ride up if dirt piles under them
  settleTanks() {
    for (const t of this.tanks) {
      while (t.y > 0 && this.terrain.isSolid(t.x, t.y - 6)) t.y--;
      while (t.y < H && !this.terrain.isSolid(t.x, t.y + 1)) t.y++;
    }
  }

  endTurn() {
    this.explosions = [];
    this.projs = [];
    if (this.shotsFired[0] >= SHOTS_PER_PLAYER && this.shotsFired[1] >= SHOTS_PER_PLAYER) {
      this.phase = "over";
      return;
    }
    this.current = 1 - this.current;
    this.changeWind();
    this.phase = "aim";
  }

  // Wind changes every turn: usually a small nudge, sometimes a big gust
  changeWind() {
    if (this.rand() < 0.3) {
      this.wind = Math.round((this.rand() * 2 - 1) * WIND_MAX);
    } else {
      const w = this.wind + (this.rand() * 10 - 5);
      this.wind = Math.round(Math.max(-WIND_MAX, Math.min(WIND_MAX, w)));
    }
  }

  // The dotted aim guide: simulate the shot with the exact same physics
  // (it shows the path of the first shell, up to the first impact)
  predictPath(maxSteps) {
    const t = this.tank;
    const tip = this.barrelTip(t);
    const a = (t.angle * Math.PI) / 180;
    const speed = t.power * SPEED_PER_POWER;
    const p = { x: tip.x, y: tip.y, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
    const points = [{ x: p.x, y: p.y }];
    for (let i = 0; i < maxSteps; i++) {
      const r = stepProjectile(p, STEP, this.wind, this.terrain, this.tanks);
      points.push({ x: p.x, y: p.y });
      if (r !== "flying") break;
    }
    return points;
  }

  winnerText() {
    const [a, b] = [this.tanks[0].score, this.tanks[1].score];
    if (a === b) return "It's a draw!";
    return a > b ? "Player 1 wins!" : "Player 2 wins!";
  }
}

// Lets the test script load this file in Node (ignored in the browser)
if (typeof module !== "undefined") {
  module.exports = { Game, Terrain, WEAPONS, stepProjectile, makeRng, W, H, STEP, TANK_RADIUS, SHOTS_PER_PLAYER };
}
