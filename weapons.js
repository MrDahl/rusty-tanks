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
// =====================================================================
const WEAPONS = [
  // ---- the classics ----
  { name: "Rivet Shot",   blast: 34, damage: 50, ammo: Infinity, color: "#1a1a1a", ai: true,
    info: "Reliable all-rounder." },
  { name: "Big Bolt",     blast: 60, damage: 75, ammo: 2, color: "#8a2b1a", ai: true,
    info: "Huge blast." },
  { name: "Scatter Nuts", blast: 24, damage: 30, ammo: 2, color: "#d9a441",
    split: { count: 5, spread: 80, blast: 20, damage: 18 },
    info: "Bursts into 5 shells at the top of its arc." },
  { name: "Pogo Bomb",    blast: 30, damage: 45, ammo: 2, color: "#7fa6b3",
    bounces: 3, elasticity: 0.7,
    info: "Bounces 3 times before it explodes." },
  { name: "Burrower",     blast: 36, damage: 55, ammo: 2, color: "#5a3a2a", ai: true,
    drill: 70,
    info: "Drills into the ground, then explodes." },
  { name: "Slag Heap",    blast: 0,  damage: 0,  ammo: 2, color: "#a8683a",
    dirt: 45,
    info: "Piles up a heap of dirt where it lands." },

  // ---- volleys ----
  { name: "Triple Rivet", blast: 26, damage: 32, ammo: 2, color: "#3b3b3b", ai: true,
    volley: { count: 3, fan: 14 },
    info: "Three shells in a narrow fan." },
  { name: "Fan of Five",  blast: 20, damage: 22, ammo: 2, color: "#4a4a4a", ai: true,
    volley: { count: 5, fan: 34 },
    info: "Five small shells in a wide fan." },
  { name: "Rapid Rivets", blast: 22, damage: 24, ammo: 2, color: "#2c4a5a", ai: true,
    volley: { count: 5, fan: 0, stagger: 0.16 },
    info: "Five quick shots, one after another." },

  // ---- special flight ----
  { name: "Magnet Dart",  blast: 28, damage: 42, ammo: 2, color: "#b05a9a", ai: true,
    homing: { range: 160, accel: 700 },
    info: "Curves toward an enemy tank that gets close." },
  { name: "Needle Gun",   blast: 7,  damage: 95, ammo: 2, color: "#e8e8e8", ai: true,
    speed: 1.45, gravity: 0.2, windScale: 0.25,
    info: "Fast and flat. Tiny blast, huge damage - only a direct hit counts." },
  { name: "Proximity Pod", blast: 42, damage: 60, ammo: 2, color: "#5aa05a", ai: true,
    proximity: 36,
    info: "Explodes as soon as it passes close to an enemy tank." },

  // ---- bouncing and rolling ----
  { name: "Ricochet Rivet", blast: 28, damage: 40, ammo: 2, color: "#7fa6b3",
    bounces: 6, elasticity: 0.85,
    info: "Skips along the ground 6 times." },
  { name: "Ticker",       blast: 52, damage: 70, ammo: 2, color: "#c04a2a",
    bounces: Infinity, elasticity: 0.55, fuse: 2.6,
    info: "Bounces around and explodes 2.6 seconds after launch." },
  { name: "Rolling Barrel", blast: 40, damage: 60, ammo: 2, color: "#8a6a3a",
    rolls: { speed: 150, time: 5 },
    info: "Lands, then rolls along the ground until it hits something." },
  { name: "Wrecker",      blast: 14, damage: 90, ammo: 2, color: "#555555",
    rolls: { speed: 95, time: 6 },
    info: "Slow rolling ball with a tiny blast and a huge punch." },

  // ---- ground shapers ----
  { name: "Post Hole",    blast: 20, damage: 30, ammo: 2, color: "#6a4a2a",
    shaft: { width: 14, depth: 95 },
    info: "Digs a deep narrow shaft straight down." },
  { name: "Earth Eater",  blast: 85, damage: 0,  ammo: 2, color: "#9a7a4a",
    info: "Removes a huge chunk of ground. No damage to tanks." },
  { name: "Scrap Wall",   blast: 0,  damage: 0,  ammo: 2, color: "#8a8a8a",
    wall: { height: 120, width: 12 },
    info: "Grows a tall wall of dirt where it lands." },
  { name: "Sludge Bomb",  blast: 0,  damage: 0,  ammo: 2, color: "#4a3a2a",
    dirt: 80,
    info: "Dumps a big mountain of dirt." },

  // ---- multi-blast ----
  { name: "Shrapnel Pod", blast: 26, damage: 30, ammo: 2, color: "#c0a040", ai: true,
    burst: { count: 7, speed: 190, blast: 16, damage: 14 },
    info: "Explodes, then sprays 7 shells upward." },
  { name: "Fuse Line",    blast: 18, damage: 26, ammo: 2, color: "#d98a3a", ai: true,
    line: { count: 5, spacing: 22, blast: 18, damage: 26 },
    info: "A row of blasts running along the ground both ways." },
  { name: "Chain Rattler", blast: 22, damage: 26, ammo: 2, color: "#a04a4a", ai: true,
    scatter: { count: 7, radius: 85, blast: 22, damage: 26 },
    info: "Random blasts all around the landing spot." },
  { name: "Hail of Slag", blast: 18, damage: 20, ammo: 2, color: "#6a6a7a", ai: true,
    rain: { count: 8, spread: 110, stagger: 0.12, speed: 340, blast: 24, damage: 30 },
    info: "Slag rains from the sky around the landing spot." },
  { name: "Crusher Drop", blast: 14, damage: 10, ammo: 2, color: "#3a3a4a", ai: true,
    rain: { count: 1, spread: 0, stagger: 0.25, speed: 520, blast: 46, damage: 85 },
    info: "A heavy weight falls on the landing spot from above." },

  // ---- tricks ----
  { name: "Wobble Shot",  blast: 30, damage: 20, ammo: 2, color: "#d070d0", ai: true,
    scramble: true,
    info: "A tank it hits gets a random angle and power." },
  { name: "Warp Hop",     blast: 0,  damage: 0,  ammo: 2, color: "#5a8ad9",
    teleport: true,
    info: "Your tank teleports to where the shell lands." },
  { name: "Rocket Hop",   blast: 0,  damage: 0,  ammo: 2, color: "#d9d95a",
    hop: true, speed: 0.9,
    info: "Launches YOUR tank along the shot path. Aim, power and wind apply." },
  { name: "Mystery Crate", blast: 20, damage: 20, ammo: 2, color: "#d9a441",
    chaos: true,
    info: "Pops open and launches a random weapon." },
];

if (typeof module !== "undefined") module.exports = { WEAPONS };
