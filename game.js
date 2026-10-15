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
const MOVE_BUDGET = 60;        // how many pixels a tank may drive each turn
const MOVE_SPEED = 45;         // driving speed (pixels per second)
const CLIMB_LIMIT = 2;         // steepest step a tank can climb (pixels per pixel driven)
const MIN_TANK_GAP = 36;       // tanks can't drive closer to each other than this
const FALL_SPEED = 4;          // loose dirt falls this many pixels per physics step (240 px/s)
const SETTLE_MAX = 6;          // seconds, at most, to wait for dirt to finish falling


// ---- The weapons live in weapons.js (loaded before this file in the browser) ----
const WEAPON_LIST = typeof WEAPONS !== "undefined" ? WEAPONS : require("./weapons.js").WEAPONS;
const DRILL_SPEED = 240; // how fast the Burrower digs (pixels per second)

// ---- Computer opponent settings -----------------------------------------
// The computer first works out a PERFECT shot, then spoils it by a random
// amount of up to this fraction (applied to both angle and power).
// Random means it can still get lucky, even on Easy.
const AI_ERROR = { easy: 0.30, normal: 0.15, hard: 0.05 };
const AI_THINK_TIME = 1.6; // seconds the computer "thinks" before firing

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
    this.unstable = new Set(); // columns that might have loose dirt (checked and dropped when stable)
  }

  // Remember that columns x0..x1 changed, so any dirt left hanging there should fall
  markUnstable(x0, x1) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) this.unstable.add(x);
  }

  // One step of falling dirt: every piece of dirt with air under it drops, up to `speed` pixels.
  // Dirt keeps falling until it lands on other dirt (so overhangs and tunnel roofs collapse).
  // Returns true if anything moved.
  settleStep(speed) {
    let moved = false;
    for (const x of this.unstable) {
      let columnMoved = false;
      for (let pass = 0; pass < speed; pass++) {
        let m = false;
        // bottom to top, so a falling block moves as one piece
        for (let y = H - 2; y >= 0; y--) {
          const i = y * W + x;
          if (this.mask[i] === 1 && this.mask[i + W] === 0) {
            this.mask[i + W] = 1;
            this.mask[i] = 0;
            m = true;
          }
        }
        if (!m) break;
        columnMoved = true;
      }
      if (columnMoved) moved = true;
      else this.unstable.delete(x);
    }
    if (moved) this.version = ++versionCounter;
    return moved;
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
    this.markUnstable(minX, maxX);
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
    this.markUnstable(cx - r, cx + r);
    this.version = ++versionCounter;
  }

  // Dig a rectangular hole (used by Post Hole)
  carveRect(x0, y0, w, h) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y0 + h)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x0 + w)); x++) {
        this.mask[y * W + x] = 0;
      }
    }
    this.markUnstable(x0, x0 + w);
    this.version = ++versionCounter;
  }

  // Grow a wall of dirt upward from the ground (used by Scrap Wall).
  // keepClear = list of x positions (tanks) that must not be walled in.
  addWall(cx, height, width, keepClear) {
    for (let x = Math.max(0, Math.floor(cx - width / 2)); x <= Math.min(W - 1, Math.ceil(cx + width / 2)); x++) {
      if (keepClear.some((k) => Math.abs(k - x) < TANK_RADIUS + 4)) continue;
      const top = this.surfaceY(x, 0);
      for (let y = Math.max(0, top - height); y < top; y++) this.mask[y * W + x] = 1;
    }
    this.markUnstable(cx - width / 2, cx + width / 2);
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
  p.vx += wind * WIND_ACCEL * (p.ws === undefined ? 1 : p.ws) * dt;
  p.vy += GRAVITY * (p.g === undefined ? 1 : p.g) * dt;

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
  // ai = [player1, player2]: null for a human, or "easy" / "normal" / "hard"
  // loadouts = [[weapon numbers player 1 drafted], [player 2's]], or nothing for the quick-test setup
  constructor(seed, ai, loadouts) {
    this.newMatch(seed === undefined ? Date.now() : seed, ai, loadouts);
  }

  newMatch(seed, ai, loadouts) {
    // If no new setting is given, keep the previous one
    this.ai = ai !== undefined ? ai : (this.ai || [null, null]);
    this.aiPlan = null;
    this.aiTimer = 0;
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
      weapon: 0,                 // index into WEAPON_LIST
    }));
    // ammo[player][weapon] = shots left (one per time it was drafted)
    this.loadouts = loadouts || null;
    this.ammo = [0, 1].map((p) =>
      WEAPON_LIST.map((w, i) => (loadouts ? loadouts[p].filter((x) => x === i).length : w.ammo)));
    this.shotLimit = loadouts ? Math.max(loadouts[0].length, loadouts[1].length) : SHOTS_PER_PLAYER;
    this.tanks.forEach((t, p) => { t.weapon = this.firstWeapon(p); });
    this.moveLeft = MOVE_BUDGET; // driving allowance for this turn
    this.settleTime = 0;         // how long we have waited for loose dirt to fall
    this.moveDir = 0;            // -1 left, 0 stopped, 1 right (set by the controls)
    this.turnNote = "";          // extra message for this turn ("Hopped!" etc.)

    this.current = 0;
    this.shotsFired = [0, 0];
    this.wind = Math.round((this.rand() * 2 - 1) * 10);
    this.phase = "aim"; // "aim" -> "flight" -> "boom" -> "settle" -> "aim" ... -> "over"
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
    return WEAPON_LIST[this.tank.weapon];
  }

  get isAiTurn() {
    return !!this.ai[this.current];
  }

  playerName(i) {
    return this.ai[i] ? "Computer" : "Player " + (i + 1);
  }

  // Where the barrel ends (the shell starts here)
  barrelTip(t) {
    const a = (t.angle * Math.PI) / 180;
    return { x: t.x + Math.cos(a) * 20, y: t.y - 8 - Math.sin(a) * 20 };
  }

  setAngle(deg, force) {
    if (this.isAiTurn && !force) return;
    if (this.phase === "aim") this.tank.angle = Math.max(0, Math.min(180, deg));
  }

  setPower(p, force) {
    if (this.isAiTurn && !force) return;
    if (this.phase === "aim") this.tank.power = Math.max(5, Math.min(100, p));
  }

  hasAmmo(player, weaponIndex) {
    return this.ammo[player][weaponIndex] > 0;
  }

  setWeapon(index, force) {
    if (this.isAiTurn && !force) return;
    if (this.phase !== "aim" || index < 0 || index >= WEAPON_LIST.length) return;
    if (this.hasAmmo(this.current, index)) this.tank.weapon = index;
  }

  // ---- Driving ----
  // Hold left/right (set by the controls). Each turn a tank has MOVE_BUDGET pixels of driving.
  setMoveDir(dir, force) {
    if (this.isAiTurn && !force) return;
    this.moveDir = dir;
  }

  // Drive up to `dist` pixels (one pixel at a time, following the ground). Returns how far it got.
  driveTank(dir, dist) {
    const t = this.tank;
    const other = this.tanks[1 - this.current];
    let moved = 0;
    while (moved < dist - 1e-9 && this.moveLeft > 1e-9) {
      const step = Math.min(1, dist - moved, this.moveLeft);
      const nx = t.x + dir * step;
      if (nx < 15 || nx > W - 15) break;                       // edge of the map
      if (Math.abs(nx - other.x) < MIN_TANK_GAP) break;        // other tank in the way
      const top = this.terrain.surfaceY(nx, t.y - 14);
      if (t.y - top > CLIMB_LIMIT * step + 0.5) break;         // too steep to climb
      t.x = nx;
      t.y = top;
      this.moveLeft -= step;
      moved += step;
    }
    return moved;
  }

  // The first weapon in the list that still has ammo
  firstWeapon(player) {
    const i = this.ammo[player].findIndex((n) => n > 0);
    return i < 0 ? 0 : i;
  }

  // Build a shell. Every shell in the game is made here.
  makeProj(w, x, y, vx, vy, owner, extra) {
    return Object.assign({
      x: x, y: y, lastX: x, lastY: y, vx: vx, vy: vy, owner: owner, w: w,
      g: w.gravity, ws: w.windScale,
      bouncesLeft: w.bounces || 0,
      drilling: false, dug: 0, airCount: 0,
      splitDone: false, rolling: false, rollTime: 0,
      age: 0, delay: 0, dead: false,
    }, extra || {});
  }

  fire(force) {
    if (this.isAiTurn && !force) return;
    if (this.phase !== "aim") return;
    const t = this.tank;
    if (!this.hasAmmo(this.current, t.weapon)) return;
    const w = WEAPON_LIST[t.weapon];
    this.ammo[this.current][t.weapon]--;
    this.shotsFired[this.current]++;
    this.turnGain = 0;
    this.turnSelf = 0;
    this.lastHit = "";
    this.turnNote = "";
    this.moveDir = 0;
    this.usedWeapon = w;
    this.projs = [];

    const speed = t.power * SPEED_PER_POWER * (w.speed || 1);
    if (w.hop) {
      this.hopTank(t, speed);
    } else {
      // Most weapons fire one shell; volleys fire several (fanned out or one after another)
      const v = w.volley || { count: 1, fan: 0, stagger: 0 };
      for (let i = 0; i < v.count; i++) {
        const off = v.count > 1 && v.fan ? (i - (v.count - 1) / 2) * (v.fan / (v.count - 1)) : 0;
        const ang = Math.max(0, Math.min(180, t.angle + off));
        const tip = this.barrelTip({ x: t.x, y: t.y, angle: ang });
        const a = (ang * Math.PI) / 180;
        this.projs.push(this.makeProj(w, tip.x, tip.y, Math.cos(a) * speed, -Math.sin(a) * speed,
          this.current, { delay: i * (v.stagger || 0) }));
      }
    }
    // Used the last one of this weapon? Switch to the next weapon that has ammo.
    if (!this.hasAmmo(this.current, t.weapon)) t.weapon = this.firstWeapon(this.current);
    this.phase = "flight";
  }

  // Rocket Hop: the tank itself flies along the shot path and lands where the shell would
  hopTank(t, speed) {
    const a = (t.angle * Math.PI) / 180;
    const p = { x: t.x, y: t.y - 14, lastX: t.x, lastY: t.y - 14, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
    this.explosions.push({ x: t.x, y: t.y - 6, r: 24, t: 0, kind: "dirt" });
    let result = "flying";
    for (let i = 0; i < 1500 && result === "flying"; i++) {
      result = stepProjectile(p, STEP, this.wind, this.terrain, []);
    }
    if (result === "hit") {
      this.placeTank(t, p.lastX, p.lastY);
      this.turnNote = "Hopped!";
    } else {
      this.turnNote = "Flew off the map - stayed put";
    }
  }

  // Put a tank on the ground at (about) x, keeping clear of the other tank
  placeTank(t, x, fromY) {
    const other = this.tanks[this.tanks.indexOf(t) === 0 ? 1 : 0];
    x = Math.max(20, Math.min(W - 20, x));
    if (Math.abs(x - other.x) < MIN_TANK_GAP) {
      x = other.x + (x >= other.x ? 1 : -1) * MIN_TANK_GAP;
      x = Math.max(20, Math.min(W - 20, x));
    }
    t.x = x;
    t.y = this.terrain.surfaceY(x, Math.max(0, fromY - 30));
    this.explosions.push({ x: t.x, y: t.y - 6, r: 24, t: 0, kind: "dirt" });
    this.settleTanks();
  }

  // Call this 60 times per second
  update(dt) {
    for (const e of this.explosions) e.t += dt;
    if (this.phase === "aim" && this.isAiTurn) this.updateAi(dt);
    if (this.phase === "aim" && !this.isAiTurn && this.moveDir !== 0 && this.moveLeft > 0) {
      this.driveTank(this.moveDir, MOVE_SPEED * dt);
    }

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
          this.lastHit = this.turnNote || "Missed!";
        }
        this.phase = "boom";
        this.boomTimer = this.explosions.length ? BOOM_TIME : 0.5;
      }
    } else if (this.phase === "boom") {
      this.fall();
      this.boomTimer -= dt;
      if (this.boomTimer <= 0) {          // explosion over: let loose dirt finish falling
        this.phase = "settle";
        this.settleTime = 0;
      }
    } else if (this.phase === "settle") {
      this.fall();
      this.settleTime += dt;
      if (this.terrain.unstable.size === 0 || this.settleTime >= SETTLE_MAX) this.endTurn();
    }
  }

  // Loose dirt falls a little, and tanks ride along with the ground under them
  fall() {
    if (this.terrain.settleStep(FALL_SPEED)) this.settleTanks();
  }

  // Move one shell and react to what happens to it
  updateProjectile(p, dt) {
    // Volley shells wait for their turn to launch
    if (p.delay > 0) { p.delay -= dt; return; }
    p.age += dt;

    if (p.drilling) { this.updateDrill(p, dt); return; }
    if (p.rolling) { this.updateRoll(p, dt); return; }

    // Fuse: explodes after a set time, wherever it is
    if (p.w.fuse && p.age >= p.w.fuse) { this.detonate(p); return; }

    const foe = this.tanks[1 - p.owner];
    // Homing: steer toward the enemy tank once it is close
    if (p.w.homing) {
      const dx = foe.x - p.x, dy = foe.y - 8 - p.y, d = Math.hypot(dx, dy);
      if (d < p.w.homing.range && d > 1) {
        p.vx += (dx / d) * p.w.homing.accel * dt;
        p.vy += (dy / d) * p.w.homing.accel * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 800) { p.vx *= 800 / sp; p.vy *= 800 / sp; }
      }
    }
    // Proximity: explode when passing close to the enemy tank
    if (p.w.proximity && Math.hypot(foe.x - p.x, foe.y - 8 - p.y) <= p.w.proximity) {
      this.detonate(p);
      return;
    }

    const vyBefore = p.vy;
    const result = stepProjectile(p, dt, this.wind, this.terrain, this.tanks);

    if (result === "out") { p.dead = true; return; }

    // Scatter Nuts: burst apart when the shell stops rising
    if (result === "flying" && p.w.split && !p.splitDone && vyBefore < 0 && p.vy >= 0) {
      p.splitDone = true;
      p.dead = true;
      const s = p.w.split;
      const fragment = this.fragment(s, p.w.color);
      for (let i = 0; i < s.count; i++) {
        const k = s.count === 1 ? 0 : i / (s.count - 1) - 0.5; // -0.5 .. 0.5
        this.projs.push(this.makeProj(fragment, p.x, p.y, p.vx + k * 2 * s.spread, p.vy, p.owner, { splitDone: true }));
      }
      return;
    }

    if (result === "hit") {
      const hitTank = this.tanks.some((t) => Math.hypot(p.x - t.x, p.y - (t.y - 8)) <= TANK_RADIUS);

      if (!hitTank && p.bouncesLeft > 0) { this.bounce(p); return; }
      if (!hitTank && p.w.drill) {
        const speed = Math.hypot(p.vx, p.vy) || 1;
        p.drilling = true;
        p.dx = p.vx / speed;
        p.dy = p.vy / speed;
        return;
      }
      if (!hitTank && p.w.rolls) {
        p.rolling = true;
        p.dir = p.vx >= 0 ? 1 : -1;
        p.x = p.lastX;
        p.y = p.lastY;
        return;
      }
      this.detonate(p);
    }
  }

  // A small shell made from a weapon's "split / burst / rain" settings
  fragment(spec, color) {
    return { name: "fragment", blast: spec.blast, damage: spec.damage, color: color };
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

    const e = p.w.elasticity === undefined ? 0.7 : p.w.elasticity;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) {
      p.vx -= (1 + e) * vn * nx;
      p.vy -= (1 + e) * vn * ny;
    }
    p.x = p.lastX;
    p.y = p.lastY;
    p.bouncesLeft--;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 100) this.terrain.carveCircle(p.x - nx * 3, p.y - ny * 3, 5); // little dent
    if (!p.w.fuse && speed < 40) this.detonate(p);
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

  // Rolling along the ground (Rolling Barrel, Wrecker)
  updateRoll(p, dt) {
    p.rollTime += dt;
    const pieces = Math.max(1, Math.ceil(p.w.rolls.speed * dt));
    for (let i = 0; i < pieces; i++) {
      const nx = p.x + p.dir;
      if (nx < 1 || nx >= W - 1) { p.dead = true; return; }
      const top = this.terrain.surfaceY(nx, p.y - 12); // ground height at the next column
      const ny = top - 3;
      if (p.y - ny > CLIMB_LIMIT + 1) { this.detonate(p); return; } // too steep: stop and explode
      p.x = nx;
      p.y = ny;
      if (this.tanks.some((t) => Math.hypot(p.x - t.x, p.y - (t.y - 8)) <= TANK_RADIUS)) {
        this.detonate(p);
        return;
      }
    }
    if (p.rollTime >= p.w.rolls.time) this.detonate(p);
  }

  // A shell reaches its end: this is where each weapon's special effect happens
  detonate(p) {
    p.dead = true;
    const w = p.w;
    const x = p.x, y = p.y, owner = p.owner;

    if (w.dirt) {
      this.terrain.addHeap(x, w.dirt);
      this.explosions.push({ x: x, y: y, r: w.dirt, t: 0, kind: "dirt" });
      this.turnNote = "Dirt piled up!";
      this.settleTanks();
      return;
    }
    if (w.wall) {
      this.terrain.addWall(x, w.wall.height, w.wall.width, this.tanks.map((t) => t.x));
      this.explosions.push({ x: x, y: y, r: 30, t: 0, kind: "dirt" });
      this.turnNote = "Wall built!";
      this.settleTanks();
      return;
    }
    if (w.teleport) {
      this.placeTank(this.tanks[owner], x, y);
      this.turnNote = "Teleported!";
      return;
    }

    // Everything else explodes first...
    this.explode(x, y, owner, w.blast, w.damage, w);

    // ...and then does its extra trick
    if (w.chaos) {
      const pool = WEAPON_LIST.filter((c) => c.ai && !c.chaos);
      const pick = pool[Math.floor(this.rand() * pool.length)];
      const vx = (this.rand() * 2 - 1) * 180;
      const vy = -(260 + this.rand() * 160);
      this.projs.push(this.makeProj(pick, x, y - 10, vx, vy, owner));
      this.turnNote = "Crate: " + pick.name + "!";
    }
    if (w.shaft) {
      this.terrain.carveRect(x - w.shaft.width / 2, y - 4, w.shaft.width, w.shaft.depth);
      this.settleTanks();
    }
    if (w.burst) {
      const b = w.burst;
      const fragment = this.fragment(b, w.color);
      for (let i = 0; i < b.count; i++) {
        const ang = ((b.count > 1 ? 25 + (i * 130) / (b.count - 1) : 90) * Math.PI) / 180;
        this.projs.push(this.makeProj(fragment, x, y - 6, Math.cos(ang) * b.speed, -Math.sin(ang) * b.speed, owner));
      }
    }
    if (w.line) {
      const L = w.line;
      for (let k = 1; k <= L.count; k++) {
        for (const side of [-1, 1]) {
          const lx = x + side * k * L.spacing;
          if (lx < 1 || lx >= W - 1) continue;
          const ly = this.terrain.surfaceY(lx, Math.max(0, y - 50));
          if (ly < H) this.explode(lx, ly - 2, owner, L.blast, L.damage, w);
        }
      }
    }
    if (w.scatter) {
      const S = w.scatter;
      for (let i = 0; i < S.count; i++) {
        const ang = this.rand() * Math.PI * 2;
        const r = Math.sqrt(this.rand()) * S.radius;
        const sx = Math.max(0, Math.min(W - 1, x + Math.cos(ang) * r));
        const sy = Math.max(0, Math.min(H - 1, y + Math.sin(ang) * r));
        this.explode(sx, sy, owner, S.blast, S.damage, w);
      }
    }
    if (w.rain) {
      const R = w.rain;
      const fragment = this.fragment(R, w.color);
      for (let i = 0; i < R.count; i++) {
        const off = R.count > 1 ? (i / (R.count - 1) * 2 - 1) * R.spread + (this.rand() - 0.5) * 10 : 0;
        const rx = Math.max(1, Math.min(W - 2, x + off));
        this.projs.push(this.makeProj(fragment, rx, -20, 0, R.speed, owner, { delay: i * R.stagger }));
      }
    }
  }

  explode(x, y, owner, blast, damage, w) {
    if (blast > 0) this.terrain.carveCircle(x, y, blast);

    // Score: closer to the middle of the blast = more points
    const reach = blast + TANK_RADIUS * 0.5;
    if (damage > 0) {
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
            if (w && w.scramble) { // Wobble Shot: mess up the victim's aim
              t.angle = t.angle <= 90 ? 20 + this.rand() * 60 : 100 + this.rand() * 60;
              t.power = 30 + this.rand() * 60;
            }
          }
        }
      });
    }

    if (blast > 0) this.explosions.push({ x: x, y: y, r: blast, t: 0, kind: "fire" });
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
    if (this.shotsFired[0] >= this.shotLimit && this.shotsFired[1] >= this.shotLimit) {
      this.phase = "over";
      return;
    }
    this.current = 1 - this.current;
    this.moveLeft = MOVE_BUDGET;
    this.moveDir = 0;
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

  // ---------------------------------------------------------------
  //  Computer opponent
  // ---------------------------------------------------------------

  // Called every frame while it is the computer's turn
  updateAi(dt) {
    const t = this.tank;

    // Step 1: pick a weapon and decide whether to drive somewhere first
    if (!this.aiPlan) {
      const weapon = this.aiChooseWeapon();
      t.weapon = weapon;
      const move = this.aiDecideMove(weapon);
      this.aiPlan = { weapon: weapon, dir: move ? move.dir : 0, targetX: move ? t.x + move.dir * move.dist : 0, shot: null, timer: 0 };
    }
    const plan = this.aiPlan;

    // Step 2: drive (if needed)
    if (plan.dir !== 0) {
      const moved = this.driveTank(plan.dir, MOVE_SPEED * dt);
      if (moved < 1e-6 || (t.x - plan.targetX) * plan.dir >= -0.5) plan.dir = 0;
      return;
    }

    // Step 3: work out the shot from where the tank ended up
    if (!plan.shot) {
      plan.shot = this.planAiShot(plan.weapon);
      plan.timer = AI_THINK_TIME;
    }

    // Step 4: slide the angle and power to the chosen numbers, like a player adjusting them
    const k = Math.min(1, dt * 3);
    t.angle += (plan.shot.angle - t.angle) * k;
    t.power += (plan.shot.power - t.power) * k;
    plan.timer -= dt;
    if (plan.timer <= 0) {
      t.angle = plan.shot.angle;
      t.power = plan.shot.power;
      this.aiPlan = null;
      this.fire(true);
    }
  }

  // Which weapon the computer uses this turn: a random pick from the ones it owns and can aim.
  aiChooseWeapon() {
    const owned = [];
    WEAPON_LIST.forEach((w, i) => { if (this.hasAmmo(this.current, i)) owned.push(i); });
    const usable = owned.filter((i) => WEAPON_LIST[i].ai);
    const pool = usable.length ? usable : owned;
    if (!pool.length) return 0;
    return pool[Math.floor(this.rand() * pool.length)];
  }

  // Decide weapon-independent: if no good shot exists from here, look for a better spot within driving range
  aiDecideMove(weaponIndex) {
    const difficulty = this.ai[this.current];
    const chance = difficulty === "easy" ? 0.4 : difficulty === "normal" ? 0.75 : 1;
    if (this.moveLeft < 10 || this.rand() > chance) return null;
    const w = WEAPON_LIST[weaponIndex];
    const here = this.findBestShot(w, 4);
    if (here.miss < 25) return null;                 // already has a good shot

    const t = this.tank;
    let best = null;
    for (const dir of [-1, 1]) {
      for (const dist of [20, 40, 60]) {
        const probe = this.probeDrive(dir, dist);
        if (probe.moved < 8) continue;
        const saved = { x: t.x, y: t.y };
        t.x = probe.x;
        t.y = probe.y;
        const r = this.findBestShot(w, 4);
        t.x = saved.x;
        t.y = saved.y;
        if (r.miss < (best ? best.miss : here.miss - 15)) best = { dir: dir, dist: probe.moved, miss: r.miss };
      }
    }
    return best;
  }

  // Where would the tank end up if it drove? (Doesn't actually move it.)
  probeDrive(dir, dist) {
    const t = this.tank;
    const saved = { x: t.x, y: t.y, left: this.moveLeft };
    const moved = this.driveTank(dir, dist);
    const result = { x: t.x, y: t.y, moved: moved };
    t.x = saved.x;
    t.y = saved.y;
    this.moveLeft = saved.left;
    return result;
  }

  // Work out the perfect shot for a weapon, then spoil it a little
  planAiShot(weaponIndex) {
    if (weaponIndex === undefined) weaponIndex = this.aiChooseWeapon();
    const difficulty = this.ai[this.current];
    const errorSize = AI_ERROR[difficulty] !== undefined ? AI_ERROR[difficulty] : AI_ERROR.normal;

    const perfect = this.findBestShot(WEAPON_LIST[weaponIndex]);

    // Miscalculation: angle is measured as "how high the barrel points" (0-90),
    // so the same percentage works whether the enemy is to the left or right.
    const facingRight = perfect.angle <= 90;
    const elevation = facingRight ? perfect.angle : 180 - perfect.angle;
    const wobble = () => 1 + (this.rand() * 2 - 1) * errorSize; // e.g. 0.70 .. 1.30
    const newElevation = Math.max(2, Math.min(88, elevation * wobble()));
    const angle = facingRight ? newElevation : 180 - newElevation;
    const power = Math.max(5, Math.min(100, perfect.power * wobble()));

    return { weapon: weaponIndex, angle, power, perfect };
  }

  // How far from the tank a weapon's blasts can reach (so the computer doesn't hurt itself)
  riskRadius(w) {
    return w.blast + TANK_RADIUS +
      (w.scatter ? w.scatter.radius : 0) +
      (w.line ? w.line.count * w.line.spacing : 0) +
      (w.rain ? w.rain.spread : 0) +
      (w.burst ? 40 : 0);
  }

  // Try lots of angle/power combinations using the real physics and keep
  // the one that lands closest to the enemy (without blowing up itself).
  // `coarse` = step size of the first sweep (smaller = more careful but slower).
  findBestShot(w, coarse) {
    if (typeof w === "number") w = { blast: w };        // old calling style: just a blast size
    coarse = coarse || 2;
    const me = this.tank;
    const foe = this.tanks[1 - this.current];
    const targetX = foe.x;
    const targetY = foe.y - 8;
    const mult = w.speed || 1;
    const risk = this.riskRadius(w);

    const score = (angle, power) => {
      const tip = this.barrelTip({ x: me.x, y: me.y, angle: angle });
      const a = (angle * Math.PI) / 180;
      const speed = power * SPEED_PER_POWER * mult;
      const p = { x: tip.x, y: tip.y, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed, g: w.gravity, ws: w.windScale };
      let result = "flying";
      for (let i = 0; i < 900 && result === "flying"; i++) {
        result = stepProjectile(p, STEP, this.wind, this.terrain, this.tanks);
      }
      let miss = Math.hypot(p.x - targetX, p.y - targetY);
      if (result === "out") miss += 1000;                       // flew off the map
      const own = Math.hypot(p.x - me.x, p.y - (me.y - 8));
      if (own < risk) miss += 500;                              // would hurt itself
      return miss;
    };

    let best = { angle: 45, power: 50, miss: Infinity };
    const tryShot = (angle, power) => {
      const miss = score(angle, power);
      if (miss < best.miss) best = { angle, power, miss };
    };

    // Coarse sweep, then a fine search around the best result
    const powerStep = coarse;
    for (let angle = 5; angle <= 175; angle += coarse) {
      for (let power = 15; power <= 100; power += powerStep) tryShot(angle, power);
    }
    const a0 = best.angle, p0 = best.power;
    for (let angle = a0 - coarse; angle <= a0 + coarse; angle += 0.5) {
      for (let power = p0 - coarse; power <= p0 + coarse; power += 0.5) {
        if (angle >= 0 && angle <= 180 && power >= 5 && power <= 100) tryShot(angle, power);
      }
    }
    return best;
  }

  // The dotted aim guide: simulate the shot with the exact same physics
  // (it shows the path of the first shell, up to the first impact)
  predictPath(maxSteps) {
    const t = this.tank;
    const w = this.weapon;
    const tip = this.barrelTip(t);
    const a = (t.angle * Math.PI) / 180;
    const speed = t.power * SPEED_PER_POWER * (w.speed || 1);
    const p = { x: tip.x, y: tip.y, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed, g: w.gravity, ws: w.windScale };
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
    return this.playerName(a > b ? 0 : 1) + " wins!";
  }
}

// The computer picks weapons for its loadout: only ones it can aim, with a taste for variety.
// myPicks = list of weapon numbers it already has. Returns the next weapon number.
function aiDraftPick(myPicks, rand) {
  const options = [];
  WEAPON_LIST.forEach((w, i) => {
    if (!w.ai) return;
    const have = myPicks.filter((p) => p === i).length;
    options.push({ i: i, weight: 1 / Math.pow(1 + have * 2, 2) }); // each copy makes it less likely
  });
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = rand() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.i;
  }
  return options[options.length - 1].i;
}

// Lets the test script load this file in Node (ignored in the browser)
if (typeof module !== "undefined") {
  module.exports = { Game, Terrain, aiDraftPick, WEAPONS: WEAPON_LIST, AI_ERROR, stepProjectile, makeRng, W, H, STEP, TANK_RADIUS, SHOTS_PER_PLAYER };
}
