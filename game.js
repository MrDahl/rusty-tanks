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
const BARREL_PIVOT = 15;        // the barrel turns around a point this high above the ground
const BARREL_LENGTH = 24;       // and shells leave from this far along it
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

// ---- Seasons (the weather chosen on the menu) ----
// normal       nothing special
// monsoon      mud: a tank that does not drive during its turn sinks deeper
// iceage       tanks slide on after driving, bouncing shells fly off wildly
// thunderstorm 1-2 lightning bolts hit the ground at the start of every turn
// hurricane    very strong wind that turns around every turn
// apocalypse   3-4 meteors crash down at the start of every turn
const SEASONS = ["normal", "monsoon", "iceage", "thunderstorm", "hurricane", "apocalypse"];
const SINK_PER_TURN = 3;       // monsoon: pixels an idle tank sinks each turn
const SINK_MAX = 12;           // ...and the deepest it can go
const SLIDE_DECAY = 1.3;       // iceage: how quickly a sliding tank slows down (higher = stops sooner)
const HURRICANE_WIND = [35, 60]; // hurricane wind strength range (a normal wind is at most 20)
const STRIKE_DAMAGE = 30;      // points a tank loses when hit by lightning or a meteor
const STRIKE_REACH = 18;       // a bolt this close (sideways) to a tank hits it
const METEOR_REACH = 20;       // same for meteors
const METEOR_BLAST = 26;       // size of a meteor crater
const BOLT_AIM_BIAS = 0.2;     // chance that a bolt is aimed near a tank instead of anywhere (0 = pure luck)
const METEOR_AIM_BIAS = 0;     // same for meteors (they fall completely at random)
const FLAME_TICK = 0.4;        // seconds between burn damage ticks
const FLAME_STEP_SPEED = 70;   // how fast a flame runs downhill (pixels per second)
const BURY_BONUS = 16;         // points for burying an enemy tank in dirt
const FREEZE_BONUS = 12;        // points for freezing an enemy turret
const FALL_FREE = 16;          // a tank can drop this many pixels (when the ground under it is blasted away) without harm
const FALL_DAMAGE = 0.6;       // ...then loses this many points per extra pixel (credited to whoever shot)
const FALL_MAX = 20;           // ...but never more than this
const CONFUSE_JITTER = 18;     // radiation sickness: how far the shot wobbles (degrees; power gets a bit more)
const METEOR_FALL_TIME = 0.6;  // seconds a meteor is visible before it lands (main.js draws it)


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

// ---- Hole shapes: is the point (dx, dy) from the blast centre inside the hole? ----
// r is the blast size. Shapes are roughly the same area as a round hole but look very different.
function inShape(shape, dx, dy, r, ph) {
  switch (shape) {
    case "wide":    return (dx * dx) / (2.89 * r * r) + (dy * dy) / (0.36 * r * r) <= 1;
    case "tall":    return (dx * dx) / (0.3 * r * r) + (dy * dy) / (3.06 * r * r) <= 1;
    case "diamond": return Math.abs(dx) + Math.abs(dy) <= 1.25 * r;
    case "square":  return Math.abs(dx) <= 0.9 * r && Math.abs(dy) <= 0.9 * r;
    case "star": {
      let t = (Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2 / 5) + 0.5;
      t -= Math.floor(t);
      return Math.hypot(dx, dy) <= r * (0.5 + 0.85 * (1 - Math.abs(2 * t - 1)));
    }
    case "cone": {
      if (dy < -0.4 * r || dy > 1.6 * r) return false;
      return Math.abs(dx) <= 1.3 * r * (1 - (dy + 0.4 * r) / (2.0 * r));
    }
    case "blob": {
      const a = Math.atan2(dy, dx);
      const R = r * (1 + 0.28 * Math.sin(3 * a + ph[0]) + 0.18 * Math.sin(5 * a + ph[1]) + 0.1 * Math.sin(9 * a + ph[2]));
      return Math.hypot(dx, dy) <= R;
    }
    case "trench":  return Math.abs(dx) <= 1.9 * r && Math.abs(dy) <= 0.35 * r;
    case "bowl":    return dy >= -0.2 * r && Math.hypot(dx, dy) <= 1.2 * r;
    case "ring":    { const d = Math.hypot(dx, dy); return d >= 0.55 * r && d <= 1.15 * r; }
    default:        return dx * dx + dy * dy <= r * r;
  }
}

// ---- Terrain: a grid with one byte per pixel (1 = dirt, 0 = air) -----
let explosionCounter = 0; // every explosion gets a number, so the effects code can tell new ones
let versionCounter = 0; // every terrain change gets a new number, so main.js knows when to repaint
class Terrain {
  constructor() {
    this.mask = new Uint8Array(W * H);
    this.version = ++versionCounter;
    this.dirtyX0 = 0;          // columns that changed since the picture was last painted
    this.dirtyX1 = W - 1;      // (main.js repaints only these, then calls clearDirty)
    this.unstable = new Set(); // columns that might have loose dirt (checked and dropped when stable)
    this.ice = new Uint8Array(W * H); // 1 = frozen dirt: blasts can't dig it and it does not fall (monsoon + frost weapons)
    this.removed = 0;          // how many dirt pixels explosions have dug away (for the statistics)
  }

  // The terrain changed in columns x0..x1: bump the version and remember the area to repaint
  touch(x0, x1) {
    this.dirtyX0 = Math.max(0, Math.min(this.dirtyX0, Math.floor(x0) - 3));
    this.dirtyX1 = Math.min(W - 1, Math.max(this.dirtyX1, Math.ceil(x1) + 3));
    this.version = ++versionCounter;
  }

  clearDirty() {
    this.dirtyX0 = W;
    this.dirtyX1 = -1;
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
    let lo = W, hi = -1;
    for (const x of this.unstable) {
      let columnMoved = false;
      for (let pass = 0; pass < speed; pass++) {
        let m = false;
        // bottom to top, so a falling block moves as one piece
        for (let y = H - 2; y >= 0; y--) {
          const i = y * W + x;
          if (this.mask[i] === 1 && this.mask[i + W] === 0 && !this.ice[i]) {
            this.mask[i + W] = 1;
            this.mask[i] = 0;
            m = true;
          }
        }
        if (!m) break;
        columnMoved = true;
      }
      if (columnMoved) { moved = true; lo = Math.min(lo, x); hi = Math.max(hi, x); }
      else this.unstable.delete(x);
    }
    if (moved) this.touch(lo, hi);
    return moved;
  }

  isSolid(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return this.mask[y * W + x] === 1;
  }

  // Remove one pixel of dirt (frozen dirt resists)
  dig(i) {
    if (this.mask[i] === 1 && !this.ice[i]) { this.mask[i] = 0; this.removed++; }
  }

  // Freeze the dirt in a round patch into ice
  freezeArea(cx, cy, r) {
    const minX = Math.max(0, Math.floor(cx - r)), maxX = Math.min(W - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r)), maxY = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * W + x;
        if (this.mask[i] === 1 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.ice[i] = 1;
      }
    }
    this.touch(minX, maxX);
  }

  // Fire melts frozen dirt back into ordinary dirt
  melt(cx, cy, r) {
    const minX = Math.max(0, Math.floor(cx - r)), maxX = Math.min(W - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r)), maxY = Math.min(H - 1, Math.ceil(cy + r));
    let changed = false;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * W + x;
        if (this.ice[i] && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) { this.ice[i] = 0; changed = true; }
      }
    }
    if (changed) { this.markUnstable(minX, maxX); this.touch(minX, maxX); }
  }

  // Is there frozen ground under this x position?
  iceAt(x, y) {
    for (let dx = -6; dx <= 6; dx += 3) {
      for (let dy = 0; dy <= 4; dy++) {
        const xx = Math.floor(x + dx), yy = Math.floor(y + dy);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && this.ice[yy * W + xx]) return true;
      }
    }
    return false;
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
        if (dx * dx + dy * dy <= r * r) this.dig(y * W + x);
      }
    }
    this.markUnstable(minX, maxX);
    this.touch(minX, maxX);
  }

  // Remove dirt in one of the hole shapes above (round when no shape is given)
  carveShape(cx, cy, r, shape, rand) {
    if (!shape || shape === "circle") { this.carveCircle(cx, cy, r); return; }
    const ph = shape === "blob" ? [rand() * 6.28, rand() * 6.28, rand() * 6.28] : null;
    const ext = Math.ceil(r * 2.0);
    const minX = Math.max(0, Math.floor(cx - ext)), maxX = Math.min(W - 1, Math.ceil(cx + ext));
    const minY = Math.max(0, Math.floor(cy - ext)), maxY = Math.min(H - 1, Math.ceil(cy + ext));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (inShape(shape, x - cx, y - cy, r, ph)) this.dig(y * W + x);
      }
    }
    this.markUnstable(minX, maxX);
    this.touch(minX, maxX);
  }

  // Fill holes and valleys: every column in range is raised up to the highest ground there
  // (but by at most maxAdd pixels). Used by Landfill.
  fillLevel(cx, r, maxAdd) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    let level = H;
    for (let x = x0; x <= x1; x++) level = Math.min(level, this.surfaceY(x, 0));
    for (let x = x0; x <= x1; x++) {
      const top = this.surfaceY(x, 0);
      for (let y = Math.max(level, top - maxAdd); y < top; y++) this.mask[y * W + x] = 1;
    }
    this.markUnstable(x0, x1);
    this.touch(x0, x1);
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
    this.touch(cx - r, cx + r);
  }

  // Dig a rectangular hole (used by Post Hole)
  carveRect(x0, y0, w, h) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y0 + h)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x0 + w)); x++) {
        this.dig(y * W + x);
      }
    }
    this.markUnstable(x0, x0 + w);
    this.touch(x0, x0 + w);
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
    this.touch(cx - width / 2, cx + width / 2);
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
    this.ice.fill(0);

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
    this.touch(0, W - 1);
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
// Numbers for the post-game statistics screen
function newStats() {
  return {
    shots: 0, hits: 0,            // shots fired, and shots that scored points
    damage: 0, self: 0,           // points won from the enemy, points lost to own shots
    dot: 0,                       // ... of the damage: burning and radiation
    storm: 0,                     // points lost to lightning and meteors
    best: { gain: 0, weapon: "" },     // best single shot
    crater: { px: 0, weapon: "" },     // biggest hole dug by one shot
    weapons: {},                  // name -> { uses, hits, points }
    buries: 0, freezes: 0, irradiated: 0, stunned: 0,   // how often this player buried / froze / irradiated / EMPed the enemy
  };
}

class Game {
  // ai = [player1, player2]: null for a human, or "easy" / "normal" / "hard"
  // loadouts = [[weapon numbers player 1 drafted], [player 2's]], or nothing for the quick-test setup
  // opts (optional, for the ladder): { windScale: 0 = no wind, 0.5 = light, 1 = normal, 1.5 = strong,
  //                                    names: [null, "Mudlark"] = names for the players }
  constructor(seed, ai, loadouts, season, opts) {
    this.newMatch(seed === undefined ? Date.now() : seed, ai, loadouts, season, opts);
  }

  newMatch(seed, ai, loadouts, season, opts) {
    // opts always starts from the defaults, so a ladder match never leaks into a normal one
    this.windScale = opts && opts.windScale !== undefined ? opts.windScale : 1;
    this.names = opts && opts.names ? opts.names : null;
    // If no new setting is given, keep the previous one
    this.ai = ai !== undefined ? ai : (this.ai || [null, null]);
    this.aiPlan = null;
    this.aiTimer = 0;
    this.seed = seed;
    this.rand = makeRng(seed);
    // The season: what was picked on the menu ("random" = one of the six, picked fresh every match)
    if (season !== undefined) this.seasonSetting = season;
    if (this.seasonSetting !== "random" && !SEASONS.includes(this.seasonSetting)) this.seasonSetting = "normal";
    this.weather = this.seasonSetting === "random"
      ? SEASONS[Math.floor(makeRng((seed ^ 0x51ed270b) >>> 0)() * SEASONS.length)]
      : this.seasonSetting;
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
      sink: 0,                   // monsoon: pixels sunk into the mud
      buried: false,             // covered in dirt: cannot drive until a blast frees it
      pushLeft: 0, pushDir: 1,   // being shoved by a Gale Cannon / Gravity Well
      slide: 0,                  // iceage: sliding speed (pixels per second, + = right)
      // Elemental effects. The numbers count the turns (of this tank) the effect still has to run.
      status: { frozen: 0, emp: 0, confused: 0, rad: 0, radDmg: 0, radOwner: 0, radWeapon: null },
      lock: { angle: false, power: false, drive: false, scramble: false },  // what is blocked during the current turn
      burning: 0,                // > 0 while flames touch the tank (for the picture)
      fall: 0, fallMoved: false, // pixels dropped since the tank last stood still (fall damage)
    }));
    this.flames = [];            // burning blobs that run downhill (Napalm and friends)
    this.flameClock = 0;
    this.statusNote = "";        // message about effects at the start of a turn
    this.stats = [newStats(), newStats()];
    this.removedAtFire = 0;
    // ammo[player][weapon] = shots left (one per time it was drafted)
    this.loadouts = loadouts || null;
    this.ammo = [0, 1].map((p) =>
      WEAPON_LIST.map((w, i) => (loadouts ? loadouts[p].filter((x) => x === i).length : w.ammo)));
    this.shotLimit = loadouts ? Math.max(loadouts[0].length, loadouts[1].length) : SHOTS_PER_PLAYER;
    this.tanks.forEach((t, p) => { t.weapon = this.firstWeapon(p); });
    this.moveLeft = MOVE_BUDGET; // driving allowance for this turn
    this.settleTime = 0;         // how long we have waited for loose dirt to fall
    this.moveDir = 0;            // -1 left, 0 stopped, 1 right (set by the controls)
    this.turnMoved = 0;          // how far the current tank has driven this turn
    this.drivingNow = false;
    this.finalRound = false;     // the last storm after the final shot
    this.weatherEvents = [];     // lightning / meteors waiting to happen at the start of a turn
    this.weatherClock = 0;
    this.turnNote = "";          // extra message for this turn ("Hopped!" etc.)

    this.current = 0;
    this.shotsFired = [0, 0];
    this.wind = Math.round((this.rand() * 2 - 1) * 10 * this.windScale) || 0;
    if (this.weather === "hurricane") this.wind = Math.round(this.hurricaneWind(this.rand() < 0.5 ? -1 : 1) * this.windScale) || 0;
    this.phase = "aim"; // "aim" -> "flight" -> "boom" -> "settle" -> ("weather" ->) "aim" ... -> "over"
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
    if (this.names && this.names[i]) return this.names[i];
    return this.ai[i] ? "Computer" : "Player " + (i + 1);
  }

  // Where the barrel ends (the shell starts here)
  barrelTip(t) {
    const a = (t.angle * Math.PI) / 180;
    return { x: t.x + Math.cos(a) * BARREL_LENGTH, y: t.y - BARREL_PIVOT - Math.sin(a) * BARREL_LENGTH };
  }

  setAngle(deg, force) {
    if (this.isAiTurn && !force) return;
    if (this.tank.lock.angle) return;                                  // frozen turret
    if (this.tank.lock.scramble) deg += (this.rand() * 2 - 1) * 6;   // radiation sickness: the controls jitter
    if (this.phase === "aim") this.tank.angle = Math.max(0, Math.min(180, deg));
  }

  setPower(p, force) {
    if (this.isAiTurn && !force) return;
    if (this.tank.lock.power) return;                                  // EMP: power dead
    if (this.tank.lock.scramble) p += (this.rand() * 2 - 1) * 6;
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
  // sliding = true: the tank is skidding on ice, which costs no driving allowance.
  driveTank(dir, dist, sliding) {
    const t = this.tank;
    const other = this.tanks[1 - this.current];
    let moved = 0;
    if (t.buried || t.lock.drive) return 0;                      // stuck in dirt, or EMP-ed
    if (t.sink > 0 && !sliding) { t.y -= t.sink; t.sink = 0; }   // monsoon: drive out of the mud
    while (moved < dist - 1e-9 && (sliding || this.moveLeft > 1e-9)) {
      const step = sliding ? Math.min(1, dist - moved) : Math.min(1, dist - moved, this.moveLeft);
      const nx = t.x + dir * step;
      if (nx < 15 || nx > W - 15) break;                       // edge of the map
      if (Math.abs(nx - other.x) < MIN_TANK_GAP) break;        // other tank in the way
      const top = this.terrain.surfaceY(nx, t.y - 14);
      if (t.y - top > CLIMB_LIMIT * step + 0.5) break;         // too steep to climb
      t.x = nx;
      t.y = top;
      if (!sliding) this.moveLeft -= step;
      moved += step;
    }
    if (!sliding && moved > 0) {
      this.turnMoved += moved;
      this.drivingNow = true;
      if (this.weather === "iceage") t.slide = dir * MOVE_SPEED;  // ice: keeps rolling after you let go
    }
    return moved;
  }

  // Iceage: a tank that stopped driving skids on for a moment
  slideStep(dt) {
    const t = this.tank;
    if (Math.abs(t.slide) < 3) { t.slide = 0; return; }
    const want = Math.abs(t.slide) * dt;
    const moved = this.driveTank(Math.sign(t.slide), want, true);
    if (moved < want - 1e-6) t.slide = 0;                     // hit a wall, a cliff or the other tank
    else t.slide *= Math.exp(-SLIDE_DECAY * dt);
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
    if (t.lock.scramble) {      // radiation sickness: the shot wobbles
      t.angle = Math.max(0, Math.min(180, t.angle + (this.rand() * 2 - 1) * CONFUSE_JITTER));
      t.power = Math.max(5, Math.min(100, t.power + (this.rand() * 2 - 1) * CONFUSE_JITTER * 1.2));
    }
    this.removedAtFire = this.terrain.removed;
    const st = this.stats[this.current];
    st.shots++;
    const ws = st.weapons[w.name] || (st.weapons[w.name] = { uses: 0, hits: 0, points: 0 });
    ws.uses++;
    this.turnGain = 0;
    this.turnSelf = 0;
    this.lastHit = "";
    this.turnNote = "";
    this.moveDir = 0;
    t.slide = 0;
    this.usedWeapon = w;
    this.projs = [];

    const speed = t.power * SPEED_PER_POWER * (w.speed || 1);
    if (w.hop) {
      this.hopTank(t, speed, w);
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
  hopTank(t, speed, w) {
    const a = (t.angle * Math.PI) / 180;
    const p = { x: t.x, y: t.y - 14, lastX: t.x, lastY: t.y - 14, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
    this.addExplosion(t.x, t.y - 6, 24, "dirt", { style: w && w.fx, color: w && w.color });
    let result = "flying";
    for (let i = 0; i < 1500 && result === "flying"; i++) {
      result = stepProjectile(p, STEP, this.wind, this.terrain, []);
    }
    if (result === "hit") {
      this.placeTank(t, p.lastX, p.lastY, { style: w && w.fx, color: w && w.color });
      this.turnNote = "Hopped!";
    } else {
      this.turnNote = "Flew off the map - stayed put";
    }
  }

  // Put a tank on the ground at (about) x, keeping clear of the other tank
  placeTank(t, x, fromY, look) {
    const other = this.tanks[this.tanks.indexOf(t) === 0 ? 1 : 0];
    x = Math.max(20, Math.min(W - 20, x));
    if (Math.abs(x - other.x) < MIN_TANK_GAP) {
      x = other.x + (x >= other.x ? 1 : -1) * MIN_TANK_GAP;
      x = Math.max(20, Math.min(W - 20, x));
    }
    t.x = x;
    t.sink = 0;
    t.slide = 0;
    t.buried = false;
    t.y = this.terrain.surfaceY(x, Math.max(0, fromY - 30));
    this.addExplosion(t.x, t.y - 6, 24, "dirt", look);
    this.settleTanks();
  }

  // Call this 60 times per second
  update(dt) {
    for (const e of this.explosions) e.t += dt;
    this.drivingNow = false;
    if (this.phase === "aim" && this.isAiTurn) this.updateAi(dt);
    if (this.phase === "aim" && !this.isAiTurn && this.moveDir !== 0 && this.moveLeft > 0) {
      this.driveTank(this.moveDir, MOVE_SPEED * dt);
    }
    if (this.phase === "aim" && this.weather === "iceage" && !this.drivingNow) this.slideStep(dt);
    this.pushStep(dt);
    this.updateFlames(dt);
    this.checkFalls();

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
      const settled = this.terrain.unstable.size === 0 && this.flames.length === 0;
      if (settled || this.settleTime >= SETTLE_MAX + 2) this.endTurn();
    } else if (this.phase === "weather") {
      this.updateWeather(dt);
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
      const fragment = this.fragment(s, p.w);
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

  // Record an explosion animation (main.js draws it and spawns sparks; the id lets it spot new ones)
  // extra = { style, shape, color, x2, y2 }: tells fx.js how this explosion should look
  addExplosion(x, y, r, kind, extra) {
    this.explosions.push(Object.assign({ id: ++explosionCounter, x: x, y: y, r: r, t: 0, kind: kind }, extra || {}));
  }

  // A small shell made from a weapon's "split / burst / rain" settings
  fragment(spec, parent) {
    return { name: parent.name, blast: spec.blast, damage: spec.damage, color: parent.color, dirt: spec.dirt, fx: parent.fxFrag || "pop", flames: spec.flames };
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
    if (this.weather === "iceage") {
      // Ice: shells shoot off in random directions at random speeds
      const old = Math.hypot(p.vx, p.vy);
      const ang = Math.atan2(p.vy, p.vx) + (this.rand() * 2 - 1) * 1.0;
      const fast = Math.min(700, Math.max(140, old * (0.9 + this.rand() * 0.7)));
      p.vx = Math.cos(ang) * fast;
      p.vy = Math.sin(ang) * fast;
      if (p.vy > 0 && this.rand() < 0.6) p.vy = -p.vy * 0.8;   // mostly bounce upward, not into the ground again
    }
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
      this.terrain.carveCircle(p.x, p.y, p.w.drillWidth || 5);
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

    const dustLook = { style: w.fx || "dust", color: w.color };
    if (w.dirt) {
      this.terrain.addHeap(x, w.dirt);
      this.addExplosion(x, y, w.dirt, "dirt", dustLook);
      this.turnNote = "Dirt piled up!";
      this.coverTanks();
      this.settleTanks();
      return;
    }
    if (w.mounds) {
      const M = w.mounds;
      for (let k = 0; k < M.count; k++) this.terrain.addHeap(x + (k - (M.count - 1) / 2) * M.spacing, M.size);
      this.addExplosion(x, y, M.spacing * M.count * 0.45, "dirt", dustLook);
      this.turnNote = "Mounds built!";
      this.coverTanks();
      this.settleTanks();
      return;
    }
    if (w.fill) {
      this.terrain.fillLevel(x, w.fill.radius, w.fill.max);
      this.addExplosion(x, y, w.fill.radius, "dirt", dustLook);
      this.turnNote = "Filled in!";
      this.coverTanks();
      this.settleTanks();
      return;
    }
    if (w.wall) {
      this.terrain.addWall(x, w.wall.height, w.wall.width, this.tanks.map((t) => t.x));
      this.addExplosion(x, y, 30, "dirt", dustLook);
      this.turnNote = "Wall built!";
      this.settleTanks();
      return;
    }
    if (w.teleport) {
      this.placeTank(this.tanks[owner], x, y, { style: w.fx, color: w.color });
      this.turnNote = "Teleported!";
      return;
    }

    // Everything else explodes first...
    this.explode(x, y, owner, w.blast, w.damage, w);

    // ...and then does its extra trick
    if (w.push) this.pushTanks(x, y, w.push);
    if (w.freeze) this.freezeBlast(x, y, owner, w);
    if (w.emp) this.empBlast(x, y, owner, w);
    if (w.nuke) this.nukeBlast(x, y, owner, w);
    if (w.flames) this.spawnFlames(x, y, owner, w);
    if (w.arc) {
      const foe = this.tanks[1 - owner];
      const d = Math.hypot(x - foe.x, y - (foe.y - 8));
      if (d <= w.arc.range) {
        this.hurt(1 - owner, owner, Math.max(5, Math.round(w.arc.damage * (1 - d / w.arc.range))), w);
        this.addExplosion(foe.x, foe.y - 10, 20, "arc", { style: "electric", x2: x, y2: y, color: w.color });
      }
    }
    if (w.quake) {
      const Q = w.quake;
      this.tanks.forEach((t, i) => {
        const dx = Math.abs(t.x - x);
        if (dx <= Q.range) this.hurt(i, owner, Math.max(1, Math.round(Q.damage * (1 - dx / Q.range))), w);
      });
      this.addExplosion(x, y, Q.range, "quake", { style: "quake", color: w.color });
    }
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
      const fragment = this.fragment(b, w);
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
      const fragment = this.fragment(R, w);
      for (let i = 0; i < R.count; i++) {
        const off = R.count > 1 ? (i / (R.count - 1) * 2 - 1) * R.spread + (this.rand() - 0.5) * 10 : 0;
        const rx = Math.max(1, Math.min(W - 2, x + off));
        this.projs.push(this.makeProj(fragment, rx, -20, 0, R.speed, owner, { delay: i * R.stagger }));
      }
    }
  }

  explode(x, y, owner, blast, damage, w) {
    if (blast > 0) this.terrain.carveShape(x, y, blast, w && w.shape, this.rand);

    // Score: closer to the middle of the blast = more points
    const reach = blast + TANK_RADIUS * 0.5;
    if (damage > 0) {
      this.tanks.forEach((t, i) => {
        const d = Math.hypot(x - t.x, y - (t.y - 8));
        if (d <= reach) this.hurt(i, owner, Math.max(1, Math.round(damage * (1 - d / reach))), w);
      });
    }

    if (blast > 0) this.addExplosion(x, y, blast, "fire", { style: (w && w.fx) || "blast", shape: w && w.shape, color: w && w.color });
    this.settleTanks();
  }

  // Points: the shooter gains when an enemy is hit, and loses them when hitting himself
  hurt(i, owner, points, w) {
    if (points <= 0) return;
    this.applyDamage(i, owner, points, w);
    if (i === owner) {
      this.turnSelf += points;
    } else {
      this.turnGain += points;
      if (w && w.scramble) { // Wobble Shot: mess up the victim's aim
        const t = this.tanks[i];
        t.angle = t.angle <= 90 ? 20 + this.rand() * 60 : 100 + this.rand() * 60;
        t.power = 30 + this.rand() * 60;
      }
    }
  }

  // Move the points around and keep the statistics (no messages)
  applyDamage(i, owner, points, w) {
    const st = this.stats[owner];
    if (i === owner) {
      this.tanks[owner].score -= points;
      st.self += points;
    } else {
      this.tanks[owner].score += points;
      st.damage += points;
      if (w && w.name && st.weapons[w.name]) st.weapons[w.name].points += points;
    }
  }

  // ---- Elemental effects ----
  // Frost: freezes the turret of every tank near the blast (it cannot be aimed during that tank's next turn)
  freezeBlast(x, y, owner, w) {
    const F = w.freeze;
    let hit = false;
    this.tanks.forEach((t, i) => {
      if (Math.hypot(x - t.x, y - (t.y - 8)) > F.range) return;
      if (t.status.frozen < F.turns) {
        if (i !== owner && t.status.frozen === 0) { this.tanks[owner].score += FREEZE_BONUS; this.stats[owner].damage += FREEZE_BONUS; this.turnGain += FREEZE_BONUS; this.stats[owner].freezes++; }
        t.status.frozen = F.turns;
        hit = true;
      }
    });
    if (hit) this.turnNote = "Turret frozen!";
    // In the monsoon the mud freezes solid where it lands: ice that blasts cannot dig and tanks cannot sink into
    if (this.weather === "monsoon" && F.ice) {
      this.terrain.freezeArea(x, y + 4, F.ice);
      this.turnNote = (hit ? "Turret frozen! " : "") + "Mud frozen into ice!";
    }
  }

  // EMP: no driving and no power adjusting for the victim's next turn
  empBlast(x, y, owner, w) {
    const E = w.emp;
    let hit = false;
    this.tanks.forEach((t, i) => {
      if (Math.hypot(x - t.x, y - (t.y - 8)) > E.range) return;
      if (i !== owner && t.status.emp === 0) { this.tanks[owner].score += FREEZE_BONUS; this.stats[owner].damage += FREEZE_BONUS; this.turnGain += FREEZE_BONUS; this.stats[owner].stunned++; }
      t.status.emp = Math.max(t.status.emp, E.turns);
      hit = true;
    });
    if (hit) this.turnNote = "EMP! No driving, power dead";
  }

  // Nuclear: everything inside the fallout zone (including the shooter!) takes damage for 3 turns
  // and gets scrambled controls on its next turn
  nukeBlast(x, y, owner, w) {
    const N = w.nuke;
    this.addExplosion(x, y, N.range, "fire", { style: "fallout", color: w.color });
    const names = [];
    this.tanks.forEach((t, i) => {
      if (Math.hypot(x - t.x, y - (t.y - 8)) > N.range) return;
      t.status.rad = N.turns;
      t.status.radDmg = N.dmg;
      t.status.radOwner = owner;
      t.status.radWeapon = w;
      t.status.confused = Math.max(t.status.confused, N.confuse || 1);
      if (i !== owner) this.stats[owner].irradiated++;
      names.push(this.playerName(i));
    });
    if (names.length) this.turnNote = "Fallout! " + names.join(" and ") + " irradiated";
  }

  // Flames: blobs of fire that drop, run downhill into craters, and burn for a few seconds
  spawnFlames(x, y, owner, w) {
    const F = w.flames;
    const life = F.life * (this.weather === "monsoon" ? 0.5 : 1);   // rain puts fires out quickly
    for (let i = 0; i < F.count; i++) {
      this.flames.push({
        x: x + (this.rand() - 0.5) * 8, y: y - 4, vx: (this.rand() * 2 - 1) * F.speed, vy: -(20 + this.rand() * F.speed * 0.9),
        air: true, life: life * (0.8 + this.rand() * 0.4), max: life, owner: owner, w: w, r: F.r || 9, dps: F.dps, seed: this.rand() * 6.28,
      });
    }
    this.terrain.melt(x, y, (w.blast || 10) + 12);
    this.turnNote = "Fire!";
  }

  updateFlames(dt) {
    if (!this.flames.length) { for (const t of this.tanks) t.burning = 0; return; }
    for (const t of this.tanks) t.burning = Math.max(0, t.burning - dt);
    for (const f of this.flames) {
      f.life -= dt;
      if (f.air) {
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < 2 || f.x > W - 2 || f.y >= H) { f.life = 0; continue; }
        if (this.terrain.isSolid(f.x, f.y + 1)) {            // landed
          f.air = false;
          f.y = this.terrain.surfaceY(f.x, Math.max(0, f.y - 14));
        }
      } else {
        // on the ground: roll toward the lower side, so fire pours into craters and valleys
        const here = this.terrain.surfaceY(f.x, Math.max(0, f.y - 20));
        if (here >= H) { f.air = true; f.vx = 0; f.vy = 0; continue; }
        f.y = here;
        const hl = this.terrain.surfaceY(f.x - 3, Math.max(0, here - 20));
        const hr = this.terrain.surfaceY(f.x + 3, Math.max(0, here - 20));
        const low = Math.max(hl, hr);                          // bigger y = lower ground
        if (low > here + 0.5) {
          const dir = hr > hl ? 1 : -1;
          f.x = Math.max(2, Math.min(W - 2, f.x + dir * FLAME_STEP_SPEED * dt));
          f.y = this.terrain.surfaceY(f.x, Math.max(0, here - 20));
        }
        if (f.life > 0 && this.rand() < dt * 4) this.terrain.melt(f.x, f.y, 6);
      }
    }
    this.flames = this.flames.filter((f) => f.life > 0);
    // burn damage on a fixed beat: every tank touching flames takes damage (several flames hurt more, up to 3x)
    this.flameClock += dt;
    if (this.flameClock >= FLAME_TICK) {
      this.flameClock -= FLAME_TICK;
      this.tanks.forEach((t, i) => {
        let sum = 0, top = null;
        for (const f of this.flames) {
          if (Math.abs(f.x - t.x) <= f.r + 8 && Math.abs(f.y - (t.y - 8)) <= f.r + 14) {
            sum += f.dps;
            if (!top || f.dps > top.dps) top = f;
          }
        }
        if (!top) return;
        t.burning = 0.5;
        const pts = Math.max(1, Math.round(Math.min(sum, top.dps * 3) * FLAME_TICK));
        this.hurt(i, top.owner, pts, top.w);
        if (i !== top.owner) this.stats[top.owner].dot += pts;
      });
    }
  }

  // The start of a player's turn: apply the effects that were waiting for them
  beginTurnStatus() {
    const t = this.tank, s = t.status, i = this.current;
    t.lock = { angle: s.frozen > 0, power: s.emp > 0, drive: s.emp > 0, scramble: s.confused > 0 };
    const notes = [];
    if (s.frozen > 0) { s.frozen--; notes.push("TURRET FROZEN - CAN'T AIM"); }
    if (s.emp > 0) { s.emp--; notes.push("EMP - CAN'T DRIVE OR SET POWER"); }
    if (s.rad > 0) {
      s.rad--;
      this.applyDamage(i, s.radOwner, s.radDmg, s.radWeapon);
      if (i !== s.radOwner) this.stats[s.radOwner].dot += s.radDmg;
      notes.push("RADIATION -" + s.radDmg + " (" + s.rad + " TURNS LEFT)");
    }
    if (s.confused > 0) {
      s.confused--;
      t.angle = t.angle <= 90 ? 15 + this.rand() * 70 : 105 + this.rand() * 60;
      t.power = 25 + this.rand() * 70;
      notes.push("CONTROLS SCRAMBLED");
    }
    this.statusNote = notes.join("   ");
  }

  // The match is ending: radiation that is still waiting is paid out in full now,
  // so a Nuclear Warhead fired late is worth the same as one fired early.
  settleRadiation() {
    for (let i = 0; i < 2; i++) {
      const s = this.tanks[i].status;
      if (s.rad <= 0) continue;
      const total = s.rad * s.radDmg;
      this.applyDamage(i, s.radOwner, total, s.radWeapon);
      if (i !== s.radOwner) this.stats[s.radOwner].dot += total;
      s.rad = 0;
    }
  }

  // ---- Buried tanks ----
  // How much of the space around a tank is dirt (0 = free, 1 = completely filled in)
  coverage(t) {
    let solid = 0, n = 0;
    for (let y = Math.floor(t.y - 26); y < t.y - 3; y++) {
      for (let x = Math.floor(t.x - 12); x <= t.x + 12; x++) {
        n++;
        if (this.terrain.isSolid(x, y)) solid++;
      }
    }
    return n ? solid / n : 0;
  }

  // After dirt was added: tanks that are covered get stuck (they do not ride up on top any more)
  coverTanks() {
    const names = [];
    this.tanks.forEach((t, i) => {
      if (!t.buried && this.coverage(t) > 0.5) {
        t.buried = true;
        t.slide = 0;
        t.sink = 0;
        names.push(this.playerName(i));
        if (i !== this.current) {                 // burying the enemy earns points
          this.tanks[this.current].score += BURY_BONUS;
          this.stats[this.current].damage += BURY_BONUS;
          this.stats[this.current].buries++;
          this.turnGain += BURY_BONUS;
        }
      }
    });
    if (names.length) this.turnNote = "Buried " + names.join(" and ") + "!";
  }

  // ---- Shoving tanks (Gale Cannon pushes, Gravity Well pulls) ----
  pushTanks(x, y, spec) {
    for (const t of this.tanks) {
      if (t.buried) continue;
      const d = Math.hypot(x - t.x, y - (t.y - 8));
      if (d > spec.range) continue;
      const amount = Math.abs(spec.force) * (1 - d / spec.range);
      let dir = Math.sign(t.x - x) || 1;
      if (spec.force < 0) dir = -dir;
      t.pushDir = dir;
      t.pushLeft = spec.force < 0 ? Math.min(amount, Math.abs(t.x - x)) : amount; // a pull never overshoots
    }
  }

  // Slide any tank sideways along the ground. Returns how far it got.
  moveTankBy(t, dir, dist) {
    const other = this.tanks[this.tanks.indexOf(t) === 0 ? 1 : 0];
    let moved = 0;
    while (moved < dist - 1e-9) {
      const step = Math.min(1, dist - moved);
      const nx = t.x + dir * step;
      if (nx < 15 || nx > W - 15) break;
      if (Math.abs(nx - other.x) < MIN_TANK_GAP) break;
      const top = this.terrain.surfaceY(nx, t.y - 14);
      if (t.y - top > CLIMB_LIMIT * step + 0.5) break;
      t.x = nx;
      t.y = top;
      t.sink = 0;
      moved += step;
    }
    return moved;
  }

  // Tanks that were hit by a push or pull glide along (called every step)
  pushStep(dt) {
    for (const t of this.tanks) {
      if (t.pushLeft <= 0) continue;
      const want = Math.min(t.pushLeft, 240 * dt);
      const moved = this.moveTankBy(t, t.pushDir, want);
      t.pushLeft = moved < want - 1e-6 ? 0 : t.pushLeft - moved;
    }
  }

  // Tanks drop down if the ground vanishes, and ride up if dirt piles under them
  settleTanks() {
    for (const t of this.tanks) {
      const y0 = t.y - t.sink;
      t.y -= t.sink;                                  // find the surface, then sink back into the mud
      if (t.buried && this.coverage(t) < 0.25) t.buried = false;   // a blast dug it free
      if (!t.buried) while (t.y > 0 && this.terrain.isSolid(t.x, t.y - 6)) t.y--;
      while (t.y < H && !this.terrain.isSolid(t.x, t.y + 1)) t.y++;
      if (t.y - y0 > 0 && !t.buried) { t.fall += t.y - y0; t.fallMoved = true; }   // dropped: remember how far
      t.y += t.sink;
    }
  }

  // A tank that dropped into a hole and has landed takes fall damage (credited to the player whose shot dug the hole)
  checkFalls() {
    this.tanks.forEach((t, i) => {
      if (t.fall <= 0) return;
      if (t.fallMoved) { t.fallMoved = false; return; }          // still falling
      const drop = t.fall;
      t.fall = 0;
      if (this.phase === "weather" || this.phase === "aim" || this.phase === "over") return;
      const pts = Math.min(FALL_MAX, Math.round((drop - FALL_FREE) * FALL_DAMAGE));
      if (pts > 0) {
        this.hurt(i, this.current, pts, this.usedWeapon);
        this.turnNote = "Fell " + Math.round(drop) + " px! -" + pts;
      }
    });
  }

  endTurn() {
    this.explosions = [];
    this.projs = [];
    this.flames = [];
    this.checkFalls(); this.checkFalls();
    // statistics for the shot that just finished
    {
      const st = this.stats[this.current], w = this.usedWeapon;
      if (this.turnGain > 0) {
        st.hits++;
        if (w && st.weapons[w.name]) st.weapons[w.name].hits++;
      }
      if (this.turnGain > st.best.gain) st.best = { gain: this.turnGain, weapon: w ? w.name : "" };
      const dug = this.terrain.removed - this.removedAtFire;
      if (dug > st.crater.px) st.crater = { px: dug, weapon: w ? w.name : "" };
    }
    if (this.shotsFired[0] >= this.shotLimit && this.shotsFired[1] >= this.shotLimit) {
      // Thunderstorm and Apocalypse: one last round of lightning / meteors, then the result
      // (so the player who shoots last still has a fair chance of being helped by the weather)
      this.settleRadiation();
      this.finalRound = true;
      this.beginWeather();
      if (this.phase !== "weather") this.phase = "over";
      return;
    }
    // Monsoon: a tank that sat still this turn sinks deeper into the mud
    if (this.weather === "monsoon" && this.turnMoved < 1 && !this.tank.buried && !this.terrain.iceAt(this.tank.x, this.tank.y)) {
      const t = this.tank;
      const d = Math.min(SINK_PER_TURN, SINK_MAX - t.sink);
      if (d > 0) { t.sink += d; t.y += d; }
    }
    this.current = 1 - this.current;
    this.moveLeft = MOVE_BUDGET;
    this.turnMoved = 0;
    this.moveDir = 0;
    this.beginTurnStatus();
    this.changeWind();
    this.beginWeather();
  }

  // ---- Weather that happens between turns (thunderstorm, apocalypse) ----
  hurricaneWind(sign) {
    return sign * Math.round(HURRICANE_WIND[0] + this.rand() * (HURRICANE_WIND[1] - HURRICANE_WIND[0]));
  }

  // Where does a bolt or meteor land? Mostly anywhere, sometimes right around a tank.
  pickStrikeX(tankBias) {
    if (this.rand() < tankBias) {
      const t = this.tanks[this.rand() < 0.5 ? 0 : 1];
      return Math.max(20, Math.min(W - 20, t.x + (this.rand() * 2 - 1) * 20));
    }
    return 30 + this.rand() * (W - 60);
  }

  // Line up this turn's lightning / meteors. With none, go straight to the aiming phase.
  beginWeather() {
    this.weatherEvents = [];
    this.weatherClock = 0;
    if (this.weather === "thunderstorm") {
      const n = 1 + (this.rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.weatherEvents.push({ kind: "strike", at: 0.5 + i * 0.9 + this.rand() * 0.3, x: this.pickStrikeX(BOLT_AIM_BIAS), done: false });
      }
      this.lastHit = this.finalRound ? "Final thunderstorm!" : "Thunderstorm!";
    } else if (this.weather === "apocalypse") {
      const n = 3 + (this.rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.weatherEvents.push({ kind: "meteor", at: METEOR_FALL_TIME + 0.15 + i * 0.5 + this.rand() * 0.2, x: this.pickStrikeX(METEOR_AIM_BIAS), done: false });
      }
      this.lastHit = this.finalRound ? "Final meteor shower!" : "Meteor shower!";
    }
    this.settleTime = 0;
    this.phase = this.weatherEvents.length ? "weather" : "aim";
  }

  updateWeather(dt) {
    this.weatherClock += dt;
    this.fall();
    let lastAt = 0;
    for (const e of this.weatherEvents) {
      lastAt = Math.max(lastAt, e.at);
      if (!e.done && this.weatherClock >= e.at) { e.done = true; this.resolveWeatherEvent(e); }
    }
    // everything has landed: wait a moment, let loose dirt fall, then it is time to aim
    if (this.weatherClock >= lastAt + 0.8) {
      this.settleTime += dt;
      if (this.terrain.unstable.size === 0 || this.settleTime >= SETTLE_MAX) {
        this.weatherEvents = [];
        this.phase = this.finalRound ? "over" : "aim";
      }
    }
  }

  resolveWeatherEvent(e) {
    const meteor = e.kind === "meteor";
    const reach = meteor ? METEOR_REACH : STRIKE_REACH;
    const victimIndex = this.tanks.findIndex((t) => Math.abs(e.x - t.x) <= reach);
    const victim = victimIndex >= 0 ? this.tanks[victimIndex] : null;
    const ground = this.terrain.surfaceY(e.x, 0);
    if (meteor) {
      this.terrain.carveCircle(e.x, ground + 2, METEOR_BLAST);
      this.addExplosion(e.x, victim ? victim.y - 8 : ground, METEOR_BLAST + 6, "meteor");
    } else {
      if (!victim) this.terrain.carveCircle(e.x, ground + 2, 9);
      this.addExplosion(e.x, victim ? victim.y - 14 : ground, 22, "bolt");
    }
    if (victim) {
      victim.score -= STRIKE_DAMAGE;
      this.stats[victimIndex].storm += STRIKE_DAMAGE;
      this.lastHit = (meteor ? "Meteor" : "Lightning") + " hit " + this.playerName(victimIndex) + "! -" + STRIKE_DAMAGE;
    }
    this.settleTanks();
  }

  // Wind changes every turn: usually a small nudge, sometimes a big gust
  changeWind() {
    const k = this.windScale;
    if (this.weather === "hurricane") {           // a hurricane always turns around
      this.wind = Math.round(this.hurricaneWind(this.wind > 0 ? -1 : 1) * k) || 0;
      return;
    }
    if (this.rand() < 0.3) {
      this.wind = Math.round((this.rand() * 2 - 1) * WIND_MAX * k) || 0;
    } else {
      const w = this.wind + (this.rand() * 10 - 5) * k;
      this.wind = Math.round(Math.max(-WIND_MAX * k, Math.min(WIND_MAX * k, w))) || 0;
    }
  }

  // ---------------------------------------------------------------
  //  Computer opponent
  // ---------------------------------------------------------------

  // Called every frame while it is the computer's turn
  updateAi(dt) {
    const t = this.tank;

    // Step 1: pick a weapon and decide whether to drive somewhere first
    if (!this.aiPlan && t.buried) {
      // Buried in dirt: shoot straight up, and let the blast dig a way out
      const weapon = this.aiBuriedWeapon();
      t.weapon = weapon;
      this.aiPlan = { weapon: weapon, dir: 0, targetX: 0, shot: { angle: 90, power: 25, perfect: null }, timer: AI_THINK_TIME * 0.6 };
    }
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
    if (Math.abs(t.slide) > 3) return;     // still sliding on the ice: wait until it stops

    // Step 3: work out the shot from where the tank ended up
    if (!plan.shot) {
      plan.shot = this.planAiShot(plan.weapon);
      plan.timer = AI_THINK_TIME;
    }

    // Step 4: slide the angle and power to the chosen numbers, like a player adjusting them
    const k = Math.min(1, dt * 3);
    if (!t.lock.angle) t.angle += (plan.shot.angle - t.angle) * k;
    if (!t.lock.power) t.power += (plan.shot.power - t.power) * k;
    plan.timer -= dt;
    if (plan.timer <= 0) {
      if (!t.lock.angle) t.angle = plan.shot.angle;
      if (!t.lock.power) t.power = plan.shot.power;
      this.aiPlan = null;
      this.fire(true);
    }
  }

  // The weapon that digs the biggest hole for the least self-damage
  aiBuriedWeapon() {
    let best = -1, bestScore = -Infinity;
    WEAPON_LIST.forEach((w, i) => {
      if (!this.hasAmmo(this.current, i) || !(w.blast > 0) || w.teleport || w.hop) return;
      const s = w.blast - w.damage * 0.4;
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best >= 0 ? best : this.firstWeapon(this.current);
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
    if (this.weather === "monsoon" && this.tank.sink > 0) {   // stuck in the mud: wiggle free
      const toward = this.tanks[1 - this.current].x > this.tank.x ? 1 : -1;
      for (const d of [toward, -toward]) {
        const probe = this.probeDrive(d, 8);
        if (probe.moved >= 4) return { dir: d, dist: probe.moved };
      }
    }
    const chance = difficulty === "easy" ? 0.4 : difficulty === "normal" ? 0.75 : 1;
    if (this.tank.lock.drive || this.moveLeft < 10 || this.rand() > chance) return null;
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
    const saved = { x: t.x, y: t.y, left: this.moveLeft, sink: t.sink, slide: t.slide, turnMoved: this.turnMoved, driving: this.drivingNow };
    const moved = this.driveTank(dir, dist);
    const result = { x: t.x, y: t.y, moved: moved };
    t.x = saved.x;
    t.y = saved.y;
    t.sink = saved.sink;
    t.slide = saved.slide;
    this.moveLeft = saved.left;
    this.turnMoved = saved.turnMoved;
    this.drivingNow = saved.driving;
    return result;
  }

  // Work out the perfect shot for a weapon, then spoil it a little
  planAiShot(weaponIndex) {
    if (weaponIndex === undefined) weaponIndex = this.aiChooseWeapon();
    const difficulty = this.ai[this.current];
    const errorSize = AI_ERROR[difficulty] !== undefined ? AI_ERROR[difficulty] : AI_ERROR.normal;

    const perfect = this.findBestShot(WEAPON_LIST[weaponIndex], undefined, this.tank.lock);

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
      (w.shape ? w.blast * 0.9 : 0) +
      (w.burst ? 40 : 0) +
      (w.nuke ? w.nuke.range * 0.85 : 0) +                       // fallout zone
      (w.flames ? 35 : 0) +
      (w.freeze ? w.freeze.range * 0.5 : 0) +
      (w.emp ? w.emp.range * 0.5 : 0);
  }

  // Try lots of angle/power combinations using the real physics and keep
  // the one that lands closest to the enemy (without blowing up itself).
  // `coarse` = step size of the first sweep (smaller = more careful but slower).
  findBestShot(w, coarse, locks) {
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

    // A frozen turret can't change its angle and an EMP-ed tank can't change its power: search only what is free
    const fa = locks && locks.angle ? me.angle : null;
    const fp = locks && locks.power ? me.power : null;
    const rng = (lo, hi, st, fixed) => {
      if (fixed !== null) return [fixed];
      const out = [];
      for (let v = lo; v <= hi + 1e-9; v += st) out.push(v);
      return out;
    };

    let best = { angle: 45, power: 50, miss: Infinity };
    const tryShot = (angle, power) => {
      const miss = score(angle, power);
      if (miss < best.miss) best = { angle, power, miss };
    };

    // Three passes, each narrower than the last (about 3x cheaper than one fine sweep):
    //  1. a coarse sweep of every angle and power, remembering the few best spots
    //  2. a finer search around each of those spots
    //  3. the finest search around the winner
    const found = [];
    const step1 = coarse * 2;
    for (const angle of rng(5, 175, step1, fa)) {
      for (const power of rng(15, 100, step1, fp)) {
        const miss = score(angle, power);
        found.push({ angle, power, miss });
        if (miss < best.miss) best = { angle, power, miss };
      }
    }
    found.sort((a, b) => a.miss - b.miss);
    const seeds = [];
    for (const f of found) {              // the best few spots that are not right next to each other
      if (seeds.length >= 4) break;
      if (seeds.every((s) => Math.abs(s.angle - f.angle) > step1 || Math.abs(s.power - f.power) > step1)) seeds.push(f);
    }
    for (const sd of seeds) {
      for (const angle of rng(sd.angle - step1, sd.angle + step1, 1, fa)) {
        for (const power of rng(sd.power - step1, sd.power + step1, 1, fp)) {
          if (angle >= 0 && angle <= 180 && power >= 5 && power <= 100) tryShot(angle, power);
        }
      }
    }
    const a0 = best.angle, p0 = best.power;
    for (const angle of rng(a0 - 1, a0 + 1, 0.5, fa)) {
      for (const power of rng(p0 - 1, p0 + 1, 0.5, fp)) {
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

// The computer picks a weapon for its loadout from the ones still in the pool.
// available = list of weapon numbers nobody has taken yet. Weapons it can aim are much more likely.
function aiDraftPick(available, rand) {
  const weights = available.map((i) => (WEAPON_LIST[i].ai ? 5 : 1));
  let r = rand() * weights.reduce((sum, x) => sum + x, 0);
  for (let k = 0; k < available.length; k++) {
    r -= weights[k];
    if (r <= 0) return available[k];
  }
  return available[available.length - 1];
}

// Lets the test script load this file in Node (ignored in the browser)
if (typeof module !== "undefined") {
  module.exports = { Game, Terrain, aiDraftPick, SEASONS, inShape, WEAPONS: WEAPON_LIST, AI_ERROR, stepProjectile, makeRng, W, H, STEP, TANK_RADIUS, SHOTS_PER_PLAYER };
}
