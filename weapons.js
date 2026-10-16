// =====================================================================
//  RUSTY TANKS - the weapon list
//  Every weapon is a list of settings. To invent a new weapon, copy a
//  line, change the numbers and give it a new name. No other code needs
//  to change (unless you want a brand new kind of behaviour).
//
//  Basic settings (every weapon has these):
//    name, info, color
//    blast    = size of the crater and damage zone (pixels)
//    damage   = points for a perfect direct hit (less further from the centre, 0 = no points)
//    ammo     = uses per player when NOT drafting (only used for quick tests)
//    ai       = true if the computer opponent may use it
//
//  Flight settings (optional):
//    speed    = launch speed multiplier        gravity = gravity multiplier
//    windScale = how much wind affects it      volley  = { count, fan (degrees), stagger (seconds) }
//    homing   = { range, accel } steers toward an enemy tank that comes close
//    proximity = explodes when this close (pixels) to an enemy tank
//
//  What happens at the end (optional):
//    split    = bursts into small shells at the top of its arc   { count, spread, blast, damage }
//    bounces  = number of ground bounces (Infinity = bounce until the fuse runs out)
//    elasticity = bounciness (0..1)              fuse = explodes this many seconds after launch
//    drill    = burrows this many pixels through dirt before exploding
//    rolls    = after landing, rolls along the ground { speed, time }
//    burst    = sprays shells upward from the blast { count, speed, blast, damage }
//    line     = blasts in a row along the ground, both sides { count, spacing, blast, damage }
//    scatter  = random blasts around the landing spot { count, radius, blast, damage }
//    rain     = shells fall from the sky around the spot { count, spread, stagger, speed, blast, damage }
//    dirt     = piles a heap of dirt this wide (instead of exploding)
//    wall     = grows a wall of dirt { height, width }
//    shaft    = digs a straight hole down { width, depth }
//    teleport = your tank jumps to where the shell lands
//    hop      = your tank jumps along the shot path (no shell)
//    scramble = hit tanks get a random angle and power
//    chaos    = launches a random weapon from where it lands
//
//  Shape of the hole (for blasts):
//    shape    = "wide", "tall", "diamond", "square", "star", "cone", "blob", "trench", "bowl" or "ring"
//               (leave it out for a round crater). The damage zone is always round.
//    drillWidth = how wide the tunnel is (for drill weapons)
//
//  Dirt makers (they bury tanks in mud: a buried tank cannot drive until a blast frees it):
//    dirt     = piles up a heap this wide             mounds = { count, spacing, size } a row of heaps
//    fill     = { radius, max } fills holes and valleys with dirt
//    wall     = { height, width } a tall wall         rain with "dirt" = dirt falls from the sky
//
//  Other tricks:
//    push     = { range, force } shoves tanks away (negative force = pulls them in)
//    arc      = { range, damage } an electric arc jumps to the enemy tank
//    quake    = { range, damage } a shockwave along the ground hurts every tank in range
//
//  Looks:
//    fx       = the explosion style: blast, mega, pop, spark, flare, pulse, ring, dust, splat,
//               dig, shape, electric, firework, slag, gale, quake  (see fx.js)
//    fxFrag   = style used by the small shells this weapon makes
// =====================================================================
const WEAPONS = [
  // ---- the classics ----
  { name: "Rivet Shot",   blast: 34, damage: 50, ammo: Infinity, color: "#1a1a1a", fx: "blast", ai: true,
    info: "Reliable all-rounder." },
  { name: "Big Bolt",     blast: 60, damage: 75, ammo: 2, color: "#8a2b1a", fx: "mega", ai: true,
    info: "Huge blast." },
  { name: "Scatter Nuts", blast: 24, damage: 30, ammo: 2, color: "#d9a441", fx: "spark",
    split: { count: 5, spread: 80, blast: 20, damage: 18 }, fxFrag: "spark",
    info: "Bursts into 5 shells at the top of its arc." },
  { name: "Pogo Bomb",    blast: 30, damage: 45, ammo: 2, color: "#7fa6b3", fx: "pop",
    bounces: 3, elasticity: 0.7,
    info: "Bounces 3 times before it explodes." },
  { name: "Burrower",     blast: 36, damage: 55, ammo: 2, color: "#5a3a2a", fx: "dig", ai: true,
    drill: 70,
    info: "Drills into the ground, then explodes." },
  { name: "Slag Heap",    blast: 0,  damage: 0,  ammo: 2, color: "#a8683a", fx: "dust",
    dirt: 45,
    info: "Piles up a heap of dirt where it lands." },

  // ---- volleys ----
  { name: "Triple Rivet", blast: 26, damage: 32, ammo: 2, color: "#3b3b3b", fx: "pop", ai: true,
    volley: { count: 3, fan: 14 },
    info: "Three shells in a narrow fan." },
  { name: "Fan of Five",  blast: 20, damage: 22, ammo: 2, color: "#4a4a4a", fx: "spark", ai: true,
    volley: { count: 5, fan: 34 },
    info: "Five small shells in a wide fan." },
  { name: "Rapid Rivets", blast: 22, damage: 24, ammo: 2, color: "#2c4a5a", fx: "pop", ai: true,
    volley: { count: 5, fan: 0, stagger: 0.16 },
    info: "Five quick shots, one after another." },

  // ---- special flight ----
  { name: "Magnet Dart",  blast: 28, damage: 42, ammo: 2, color: "#b05a9a", fx: "pulse", ai: true,
    homing: { range: 160, accel: 700 },
    info: "Curves toward an enemy tank that gets close." },
  { name: "Needle Gun",   blast: 7,  damage: 95, ammo: 2, color: "#e8e8e8", fx: "flare", ai: true,
    speed: 1.45, gravity: 0.2, windScale: 0.25,
    info: "Fast and flat. Tiny blast, huge damage - only a direct hit counts." },
  { name: "Proximity Pod", blast: 42, damage: 60, ammo: 2, color: "#5aa05a", fx: "ring", ai: true,
    proximity: 36,
    info: "Explodes as soon as it passes close to an enemy tank." },

  // ---- bouncing and rolling ----
  { name: "Ricochet Rivet", blast: 28, damage: 40, ammo: 2, color: "#7fa6b3", fx: "pop",
    bounces: 6, elasticity: 0.85,
    info: "Skips along the ground 6 times." },
  { name: "Ticker",       blast: 52, damage: 70, ammo: 2, color: "#c04a2a", fx: "ring",
    bounces: Infinity, elasticity: 0.55, fuse: 2.6,
    info: "Bounces around and explodes 2.6 seconds after launch." },
  { name: "Rolling Barrel", blast: 40, damage: 60, ammo: 2, color: "#8a6a3a", fx: "dust",
    rolls: { speed: 150, time: 5 },
    info: "Lands, then rolls along the ground until it hits something." },
  { name: "Wrecker",      blast: 14, damage: 90, ammo: 2, color: "#555555", fx: "mega",
    rolls: { speed: 95, time: 6 },
    info: "Slow rolling ball with a tiny blast and a huge punch." },

  // ---- ground shapers ----
  { name: "Post Hole",    blast: 20, damage: 30, ammo: 2, color: "#6a4a2a", fx: "dig",
    shaft: { width: 14, depth: 95 },
    info: "Digs a deep narrow shaft straight down." },
  { name: "Earth Eater",  blast: 85, damage: 0,  ammo: 2, color: "#9a7a4a", fx: "pulse",
    info: "Removes a huge chunk of ground. No damage to tanks." },
  { name: "Scrap Wall",   blast: 0,  damage: 0,  ammo: 2, color: "#8a8a8a", fx: "dust",
    wall: { height: 120, width: 12 },
    info: "Grows a tall wall of dirt where it lands." },
  { name: "Sludge Bomb",  blast: 0,  damage: 0,  ammo: 2, color: "#4a3a2a", fx: "splat",
    dirt: 80,
    info: "Dumps a big mountain of dirt." },

  // ---- multi-blast ----
  { name: "Shrapnel Pod", blast: 26, damage: 30, ammo: 2, color: "#c0a040", fx: "spark", ai: true,
    burst: { count: 7, speed: 190, blast: 16, damage: 14 }, fxFrag: "spark",
    info: "Explodes, then sprays 7 shells upward." },
  { name: "Fuse Line",    blast: 18, damage: 26, ammo: 2, color: "#d98a3a", fx: "ring", ai: true,
    line: { count: 5, spacing: 22, blast: 18, damage: 26 },
    info: "A row of blasts running along the ground both ways." },
  { name: "Chain Rattler", blast: 22, damage: 26, ammo: 2, color: "#a04a4a", fx: "pop", ai: true,
    scatter: { count: 7, radius: 85, blast: 22, damage: 26 },
    info: "Random blasts all around the landing spot." },
  { name: "Hail of Slag", blast: 18, damage: 20, ammo: 2, color: "#6a6a7a", fx: "slag", ai: true,
    rain: { count: 8, spread: 110, stagger: 0.12, speed: 340, blast: 24, damage: 30 }, fxFrag: "slag",
    info: "Slag rains from the sky around the landing spot." },
  { name: "Crusher Drop", blast: 14, damage: 10, ammo: 2, color: "#3a3a4a", fx: "mega", ai: true,
    rain: { count: 1, spread: 0, stagger: 0.25, speed: 520, blast: 46, damage: 85 },
    info: "A heavy weight falls on the landing spot from above." },

  // ---- tricks ----
  { name: "Wobble Shot",  blast: 30, damage: 20, ammo: 2, color: "#d070d0", fx: "pulse", ai: true,
    scramble: true,
    info: "A tank it hits gets a random angle and power." },
  { name: "Warp Hop",     blast: 0,  damage: 0,  ammo: 2, color: "#5a8ad9", fx: "pulse",
    teleport: true,
    info: "Your tank teleports to where the shell lands." },
  { name: "Rocket Hop",   blast: 0,  damage: 0,  ammo: 2, color: "#d9d95a", fx: "flare",
    hop: true, speed: 0.9,
    info: "Launches YOUR tank along the shot path. Aim, power and wind apply." },
  { name: "Mystery Crate", blast: 20, damage: 20, ammo: 2, color: "#d9a441", fx: "firework",
    chaos: true,
    info: "Pops open and launches a random weapon." },

  // ---- dirt makers: they can bury a tank in mud ----
  { name: "Mud Pie",      blast: 0,  damage: 0,  ammo: 2, color: "#9a7440", fx: "splat",
    dirt: 30,
    info: "A small heap of mud. Bury a tank that is close." },
  { name: "Avalanche",    blast: 0,  damage: 0,  ammo: 2, color: "#b08a50", fx: "splat",
    rain: { count: 9, spread: 130, stagger: 0.13, speed: 300, blast: 0, damage: 0, dirt: 20 },
    info: "Dirt pours down over a wide area." },
  { name: "Spire",        blast: 0,  damage: 0,  ammo: 2, color: "#c9a878", fx: "dust",
    wall: { height: 170, width: 8 },
    info: "Raises a tall, thin spire of dirt." },
  { name: "Triple Mound", blast: 0,  damage: 0,  ammo: 2, color: "#8a6a4a", fx: "dust",
    mounds: { count: 3, spacing: 55, size: 26 },
    info: "Three mud mounds in a row." },
  { name: "Landfill",     blast: 0,  damage: 0,  ammo: 2, color: "#7a8a50", fx: "splat",
    fill: { radius: 60, max: 70 },
    info: "Fills holes and valleys with dirt. Buries tanks in craters." },

  // ---- dirt removers: every one digs a different shape ----
  { name: "Trench Digger", blast: 38, damage: 40, ammo: 2, color: "#d9a05a", fx: "shape", ai: true,
    shape: "trench",
    info: "Cuts a long, shallow trench." },
  { name: "Silo Drill",   blast: 24, damage: 45, ammo: 2, color: "#9ad9d0", fx: "shape", ai: true,
    shape: "tall",
    info: "Bores a deep, narrow hole." },
  { name: "Diamond Cutter", blast: 34, damage: 45, ammo: 2, color: "#7fd0ff", fx: "shape", ai: true,
    shape: "diamond",
    info: "Cuts a diamond-shaped hole." },
  { name: "Star Quarry",  blast: 36, damage: 40, ammo: 2, color: "#ffe066", fx: "shape", ai: true,
    shape: "star",
    info: "Blasts a five-pointed star into the ground." },
  { name: "Cube Cutter",  blast: 34, damage: 45, ammo: 2, color: "#ff9ad0", fx: "shape", ai: true,
    shape: "square",
    info: "Cuts a square hole with sharp corners." },
  { name: "Funnel Shell", blast: 36, damage: 40, ammo: 2, color: "#b0ff9a", fx: "shape", ai: true,
    shape: "cone",
    info: "Digs a V-shaped funnel that points down." },
  { name: "Ragged Quarry", blast: 52, damage: 55, ammo: 2, color: "#e07a5a", fx: "shape", ai: true,
    shape: "blob",
    info: "A big, ragged, uneven hole." },
  { name: "Bowl Maker",   blast: 44, damage: 20, ammo: 2, color: "#a0a0ff", fx: "shape",
    shape: "bowl",
    info: "Scoops a smooth bowl out of the ground." },
  { name: "Moat Maker",   blast: 40, damage: 25, ammo: 2, color: "#5ad9c8", fx: "shape",
    shape: "ring",
    info: "Digs a ring-shaped moat and leaves an island in the middle." },
  { name: "Tunneler",     blast: 30, damage: 40, ammo: 2, color: "#c08040", fx: "dig", ai: true,
    drill: 140, drillWidth: 9,
    info: "Bores a wide tunnel through the hill, then explodes." },

  // ---- new tricks ----
  { name: "Gale Cannon",  blast: 18, damage: 12, ammo: 2, color: "#c0f0ff", fx: "gale",
    push: { range: 120, force: 90 },
    info: "Blows nearby tanks away from the blast." },
  { name: "Gravity Well", blast: 16, damage: 10, ammo: 2, color: "#b06aff", fx: "pulse",
    push: { range: 140, force: -90 },
    info: "Pulls nearby tanks in toward the blast." },
  { name: "Hornet Swarm", blast: 16, damage: 20, ammo: 2, color: "#ffcc33", fx: "pop", ai: true,
    volley: { count: 4, fan: 22, stagger: 0.1 }, homing: { range: 130, accel: 550 },
    info: "Four small shells that curve toward an enemy tank." },
  { name: "Anvil",        blast: 56, damage: 90, ammo: 2, color: "#6a6a7a", fx: "mega", ai: true,
    speed: 0.85, gravity: 1.7, windScale: 0.4,
    info: "Heavy: a short, steep arc and a big hit." },
  { name: "Firework Rocket", blast: 22, damage: 24, ammo: 2, color: "#ff5ad0", fx: "firework", fxFrag: "firework", ai: true,
    burst: { count: 14, speed: 210, blast: 14, damage: 14 },
    info: "Explodes in a colourful shower of shells." },
  { name: "Arc Lamp",     blast: 22, damage: 30, ammo: 2, color: "#8fe8ff", fx: "electric", ai: true,
    arc: { range: 150, damage: 40 },
    info: "An electric arc jumps to an enemy tank nearby." },
  { name: "Twin Splitter", blast: 30, damage: 36, ammo: 2, color: "#ff8a5a", fx: "blast",
    split: { count: 2, spread: 100, blast: 34, damage: 40 },
    info: "Splits in two at the top of its arc." },
  { name: "Seismic Slam", blast: 18, damage: 10, ammo: 2, color: "#d0b080", fx: "quake",
    shape: "trench", quake: { range: 300, damage: 50 },
    info: "A shockwave runs along the ground and hurts every tank in range." },
];


if (typeof module !== "undefined") module.exports = { WEAPONS };
