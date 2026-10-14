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
const BLAST_RADIUS = 34;       // size of the crater and damage zone
const MAX_DAMAGE = 50;         // points for a perfect direct hit
const WIND_MAX = 20;           // strongest possible wind (either direction)
const BOOM_TIME = 0.8;         // seconds the explosion animation lasts
const STEP = 1 / 60;           // physics runs in fixed 1/60 second steps

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
    }));

    this.current = 0;
    this.shotsFired = [0, 0];
    this.wind = Math.round((this.rand() * 2 - 1) * 10);
    this.phase = "aim"; // "aim" -> "flight" -> "boom" -> "aim" ... -> "over"
    this.proj = null;
    this.explosion = null;
    this.boomTimer = 0;
    this.lastHit = ""; // short message about the last shot
  }

  get tank() {
    return this.tanks[this.current];
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

  fire() {
    if (this.phase !== "aim") return;
    const t = this.tank;
    const tip = this.barrelTip(t);
    const a = (t.angle * Math.PI) / 180;
    const speed = t.power * SPEED_PER_POWER;
    this.proj = {
      x: tip.x,
      y: tip.y,
      vx: Math.cos(a) * speed,
      vy: -Math.sin(a) * speed,
      owner: this.current,
    };
    this.shotsFired[this.current]++;
    this.lastHit = "";
    this.phase = "flight";
  }

  // Call this 60 times per second
  update(dt) {
    if (this.phase === "flight") {
      const result = stepProjectile(this.proj, dt, this.wind, this.terrain, this.tanks);
      if (result === "hit") {
        this.explode(this.proj.x, this.proj.y, this.proj.owner);
      } else if (result === "out") {
        this.lastHit = "Missed!";
        this.proj = null;
        this.explosion = null;
        this.phase = "boom";
        this.boomTimer = 0.5;
      }
    } else if (this.phase === "boom") {
      if (this.explosion) this.explosion.t += dt;
      this.boomTimer -= dt;
      if (this.boomTimer <= 0) this.endTurn();
    }
  }

  explode(x, y, owner) {
    this.terrain.carveCircle(x, y, BLAST_RADIUS);

    // Score: closer to the middle of the blast = more points
    let message = "";
    this.tanks.forEach((t, i) => {
      const d = Math.hypot(x - t.x, y - (t.y - 8));
      if (d <= BLAST_RADIUS + TANK_RADIUS * 0.5) {
        const f = Math.max(0, 1 - d / (BLAST_RADIUS + TANK_RADIUS * 0.5));
        const points = Math.max(1, Math.round(MAX_DAMAGE * f));
        if (i === owner) {
          this.tanks[owner].score -= points;
          message = "Ouch! Hit yourself: -" + points;
        } else {
          this.tanks[owner].score += points;
          message = "Hit! +" + points;
        }
      }
    });
    this.lastHit = message || "Missed!";

    // Tanks drop down if the ground under them was blown away
    for (const t of this.tanks) {
      t.y = Math.min(this.terrain.surfaceY(t.x, t.y - 30), H);
    }

    this.explosion = { x: x, y: y, r: BLAST_RADIUS, t: 0 };
    this.proj = null;
    this.phase = "boom";
    this.boomTimer = BOOM_TIME;
  }

  endTurn() {
    this.explosion = null;
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
  module.exports = { Game, Terrain, stepProjectile, makeRng, W, H, STEP, TANK_RADIUS, SHOTS_PER_PLAYER };
}
