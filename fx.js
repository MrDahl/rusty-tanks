// =====================================================================
//  RUSTY TANKS - visual effects
//  Everything in this file is just decoration: the neon night city,
//  rain, lightning, sparks, debris, glowing shells and screen shake.
//  It never changes the game rules - it only looks at the game.
// =====================================================================

// ---- The neon colour palette (change these to re-colour the whole game) ----
const NEON = {
  cyan: "#35f2ff",
  magenta: "#ff3df0",
  green: "#3dff9a",
  amber: "#ffd23a",
  violet: "#9a6bff",
  white: "#f4fbff",
  rock: ["#121b35", "#19254a", "#213158", "#2b3f6c"], // rock colours, darkest to lightest
  crack: "#4a70b8",
  rim: "#7fb6ff",       // the bright edge along the top of the ground and around craters
};

// Mix a "#rrggbb" colour toward white (0 = unchanged, 1 = white). Dark weapon colours need
// this to be visible against the dark night sky.
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * amount);
  return "rgb(" + m(r) + "," + m(g) + "," + m(b) + ")";
}

// ---- How each season looks (sky, skyline colours, clouds ...) ----
const SEASON_LOOK = {
  normal: {
    moods: [ // each new game picks one of these night skies
      ["#03040c", "#090e2a", "#1b0f44", "#34115f"],   // purple night
      ["#02070c", "#06182a", "#0b3550", "#13607a"],   // teal night
      ["#050210", "#1a0a3a", "#4a1458", "#8a2a6a"],   // magenta dusk
    ],
    stars: 110, moon: 0.8,
    clouds: { n: [2, 5], color: "170,190,255", alpha: 0.10, y: [25, 230] },
    neons: [NEON.cyan, NEON.green, NEON.magenta, NEON.amber, NEON.violet],
    far: { fill: "#0b1230", line: "#16275a", win: "#1c3170" }, near: "#060a1c",
  },
  monsoon: {
    sky: ["#040806", "#0b1510", "#16261a", "#2c3a1c"], stars: 0,
    neons: [NEON.green, NEON.amber, NEON.cyan, "#ff9a3d"],
    far: { fill: "#0a140f", line: "#18301f", win: "#2a4a2a" }, near: "#050a07",
    moon: 0.4, clouds: { n: [11, 15], color: "10,18,14", alpha: 0.30, y: [10, 190] }, fog: "rgba(24,44,24,0.30)",
  },
  iceage: {
    sky: ["#041226", "#0c3052", "#1f6288", "#74b8d4"], stars: 80, moon: 0.8, aurora: true, snowcap: true,
    clouds: { n: [2, 4], color: "215,240,255", alpha: 0.10, y: [30, 220] },
    neons: [NEON.cyan, "#bfefff", NEON.violet, NEON.green],
    far: { fill: "#0d2540", line: "#2a5a86", win: "#5aa0d0" }, near: "#08182e",
    fog: "rgba(150,210,255,0.10)",
  },
  thunderstorm: {
    sky: ["#010208", "#060818", "#0d0f30", "#191247"], stars: 0,
    neons: [NEON.cyan, NEON.violet, NEON.magenta, NEON.amber],
    far: { fill: "#080b22", line: "#141c4a", win: "#1c2a66" }, near: "#050818",
    moon: 0.4, clouds: { n: [12, 16], color: "5,6,16", alpha: 0.32, y: [10, 190] }, fog: "rgba(10,10,44,0.25)",
  },
  hurricane: {
    sky: ["#061116", "#0e2830", "#1b4250", "#2e5f6e"], stars: 0,
    neons: [NEON.cyan, NEON.green, NEON.amber, NEON.magenta],
    far: { fill: "#0b1f26", line: "#1d4552", win: "#2d6676" }, near: "#06141a",
    moon: 0.4, clouds: { n: [12, 16], color: "13,28,34", alpha: 0.30, y: [10, 190] }, fog: "rgba(60,100,110,0.22)",
  },
  apocalypse: {
    sky: ["#090103", "#2a0508", "#5e1208", "#b03a0e"], stars: 0, sun: true, ruin: true,
    neons: ["#ff5a1f", NEON.amber, "#ff3d3d", "#ff8a3a"],
    far: { fill: "#1b0709", line: "#4a1510", win: "#7a2a10" }, near: "#0d0305",
    clouds: { n: [10, 13], color: "21,5,6", alpha: 0.30, y: [10, 190] }, fog: "rgba(120,20,0,0.18)",
  },
};

// ---- What falls from the sky in each season (counts, colours, how often ambient lightning flashes) ----
const SEASON_FX = {
  normal:       { rain: 150, rainColor: "rgba(150,190,255,0.28)", rainSpeed: 1,    rainLen: 1,   bolt: [7, 17], cloudSpeed: 3 },
  monsoon:      { rain: 420, rainColor: "rgba(140,205,170,0.34)", rainSpeed: 1.1,  rainLen: 1.3, bolt: null, cloudSpeed: 8 },
  iceage:       { snow: 200, bolt: null, cloudSpeed: 2 },
  thunderstorm: { rain: 300, rainColor: "rgba(160,190,255,0.32)", rainSpeed: 1.15, rainLen: 1.2, bolt: [2.5, 6], distantBolts: true, cloudSpeed: 10 },
  hurricane:    { rain: 380, rainColor: "rgba(170,215,230,0.34)", rainSpeed: 1.5,  rainLen: 1.5, bolt: null, debris: 26, cloudSpeed: 22 },
  apocalypse:   { embers: 110, ash: 70, bolt: null, cloudSpeed: 5 },
};

// ---- Colour helpers for the explosion styles ----
function rgbOf(hex, light) { // "#rrggbb" -> [r,g,b], mixed toward white by `light` (0..1)
  const n = parseInt((hex || "#ffb040").slice(1), 16);
  const m = (c) => Math.round(c + (255 - c) * (light || 0));
  return [m((n >> 16) & 255), m((n >> 8) & 255), m(n & 255)];
}
function rgba(c, a) {
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
}

// Outline of a hole shape (the same shapes game.js digs), scaled by s. Used for the flash of shape weapons.
function shapePath(ctx, shape, x, y, r, s) {
  const R = r * s;
  ctx.beginPath();
  switch (shape) {
    case "wide":    ctx.ellipse(x, y, 1.7 * R, 0.6 * R, 0, 0, Math.PI * 2); break;
    case "tall":    ctx.ellipse(x, y, 0.55 * R, 1.75 * R, 0, 0, Math.PI * 2); break;
    case "diamond": ctx.moveTo(x, y - 1.25 * R); ctx.lineTo(x + 1.25 * R, y); ctx.lineTo(x, y + 1.25 * R); ctx.lineTo(x - 1.25 * R, y); ctx.closePath(); break;
    case "square":  ctx.rect(x - 0.9 * R, y - 0.9 * R, 1.8 * R, 1.8 * R); break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? 1.35 * R : 0.5 * R;
        if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
        else ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      }
      ctx.closePath();
      break;
    case "cone":    ctx.moveTo(x - 1.3 * R, y - 0.4 * R); ctx.lineTo(x + 1.3 * R, y - 0.4 * R); ctx.lineTo(x, y + 1.6 * R); ctx.closePath(); break;
    case "blob":
      for (let i = 0; i <= 24; i++) {
        const ang = (i / 24) * Math.PI * 2, rad = R * (1 + 0.25 * Math.sin(3 * ang) + 0.15 * Math.sin(5 * ang + 1));
        if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
        else ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      }
      ctx.closePath();
      break;
    case "trench":  ctx.rect(x - 1.9 * R, y - 0.35 * R, 3.8 * R, 0.7 * R); break;
    case "bowl":    ctx.arc(x, y, 1.2 * R, 0, Math.PI); ctx.closePath(); break;
    case "ring":    ctx.arc(x, y, 1.15 * R, 0, Math.PI * 2); ctx.moveTo(x + 0.55 * R, y); ctx.arc(x, y, 0.55 * R, 0, Math.PI * 2, true); break;
    default:        ctx.arc(x, y, R, 0, Math.PI * 2);
  }
}

// A soft round glow
function glowAt(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  for (const s of stops) g.addColorStop(s[0], s[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
}

// A jagged line between two points (for electricity)
function zigzag(ctx, x1, y1, x2, y2, rnd, jitter) {
  const n = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    ctx.lineTo(x1 + (x2 - x1) * t + (rnd() - 0.5) * jitter, y1 + (y2 - y1) * t + (rnd() - 0.5) * jitter);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ---- The explosion looks. Every weapon names one of these in weapons.js ("fx").
// Each one draws a single frame: e = the explosion, k = how far along it is (0..1), a = 1 - k.
const EXPL = {
  // the classic orange fireball with a cyan shockwave
  blast(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    const r = e.r * (0.3 + 0.9 * Math.min(1, k * 4));
    glowAt(ctx, e.x, e.y, r, [[0, rgba([255, 250, 220], a)], [0.35, rgba([255, 170, 60], a * 0.85)], [1, "rgba(255,40,80,0)"]]);
    ctx.strokeStyle = rgba([120, 235, 255], a * 0.8);
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (0.4 + 1.3 * Math.min(1, k * 2.2)), 0, Math.PI * 2);
    ctx.stroke();
  },
  // huge: big fireball, two shockwaves and a rising smoke cap
  mega(ctx, e, k, a) {
    ctx.globalCompositeOperation = "source-over";
    const capY = e.y - e.r * (0.4 + 1.7 * k), capR = e.r * (0.5 + 0.5 * k);
    ctx.fillStyle = rgba([60, 42, 52], a * 0.4);
    ctx.beginPath();
    ctx.moveTo(e.x - e.r * 0.28, e.y);
    ctx.lineTo(e.x - e.r * 0.2, capY);
    ctx.lineTo(e.x + e.r * 0.2, capY);
    ctx.lineTo(e.x + e.r * 0.28, e.y);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(e.x, capY, capR, capR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.4 + 1.1 * Math.min(1, k * 3)), [[0, rgba([255, 255, 235], a)], [0.3, rgba([255, 190, 70], a * 0.9)], [0.7, rgba([255, 80, 30], a * 0.5)], [1, "rgba(255,30,30,0)"]]);
    for (let i = 0; i < 2; i++) {
      const p = Math.max(0, Math.min(1, (k - i * 0.18) * 2));
      ctx.strokeStyle = rgba(i ? [255, 190, 90] : [255, 255, 255], (1 - p) * 0.8);
      ctx.lineWidth = 4 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.5 + 2.0 * p), 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  // a small, sharp pop with a few rays
  pop(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.6);
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.5 + 0.8 * Math.min(1, k * 5)), [[0, rgba([255, 255, 255], a)], [0.5, rgba(c, a * 0.8)], [1, rgba(c, 0)]]);
    if (k < 0.6) {
      ctx.strokeStyle = rgba(c, (1 - k / 0.6) * 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4 + 0.4, r0 = e.r * 0.4, r1 = e.r * (0.9 + 1.1 * k / 0.6);
        ctx.moveTo(e.x + Math.cos(ang) * r0, e.y + Math.sin(ang) * r0);
        ctx.lineTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1);
      }
      ctx.stroke();
    }
  },
  // a starburst of long thin spikes
  spark(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.55);
    ctx.globalCompositeOperation = "lighter";
    const grow = Math.min(1, k * 3);
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const ang = (i * Math.PI * 2) / 14 + 0.2, len = e.r * (i % 2 ? 1.0 : 1.9) * (0.3 + 0.9 * grow);
      ctx.strokeStyle = rgba(i % 2 ? c : [255, 255, 255], a * 0.9);
      ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(ang) * e.r * 0.2, e.y + Math.sin(ang) * e.r * 0.2);
      ctx.lineTo(e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len);
      ctx.stroke();
    }
    glowAt(ctx, e.x, e.y, e.r * 0.7, [[0, rgba([255, 255, 255], a)], [1, rgba(c, 0)]]);
  },
  // a cross-shaped lens flare: tiny blast, very long thin streaks
  flare(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    const len = e.r * (2.5 + 4 * Math.min(1, k * 4));
    for (const horizontal of [true, false]) {
      const x1 = horizontal ? e.x - len : e.x, y1 = horizontal ? e.y : e.y - len, x2 = horizontal ? e.x + len : e.x, y2 = horizontal ? e.y : e.y + len;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, "rgba(160,235,255,0)");
      g.addColorStop(0.5, rgba([255, 255, 255], a));
      g.addColorStop(1, "rgba(160,235,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    glowAt(ctx, e.x, e.y, e.r * 0.9, [[0, rgba([255, 255, 255], a)], [1, "rgba(120,200,255,0)"]]);
  },
  // rings that shrink inward, then a flash (it sucks things in)
  pulse(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.4);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const p = k * 1.7 - i * 0.22;
      if (p < 0 || p > 1) continue;
      ctx.strokeStyle = rgba(c, (1 - p) * 0.95);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (2.3 * (1 - p) + 0.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    glowAt(ctx, e.x, e.y, e.r * (0.4 + 0.5 * Math.sin(Math.min(1, k * 1.5) * Math.PI)), [[0, rgba([255, 255, 255], a)], [0.5, rgba(c, a * 0.7)], [1, rgba(c, 0)]]);
  },
  // flat ground shockwave rings (no fireball)
  ring(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.5);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const p = k * 1.6 - i * 0.2;
      if (p < 0 || p > 1) continue;
      ctx.strokeStyle = rgba(c, (1 - p) * 0.9);
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r * (0.3 + 2.1 * p), e.r * (0.3 + 2.1 * p) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    glowAt(ctx, e.x, e.y, e.r * 0.6, [[0, rgba(c, a * 0.8)], [1, rgba(c, 0)]]);
  },
  // a brown cloud of dust (dirt piles, rolling things)
  dust(ctx, e, k, a) {
    ctx.globalCompositeOperation = "source-over";
    const grow = Math.min(1, k * 2.5);
    for (let i = 0; i < 8; i++) {
      const ang = i * 2.4, spread = 0.35 + ((i * 37) % 10) / 14;
      const px = e.x + Math.cos(ang) * e.r * 0.7 * grow * spread, py = e.y - Math.abs(Math.sin(ang)) * e.r * 0.5 * grow - e.r * 0.25 * k;
      ctx.fillStyle = rgba([150, 122, 92], a * 0.38);
      ctx.beginPath();
      ctx.arc(px, py, e.r * (0.25 + 0.3 * grow) * (0.7 + spread * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.kind === "fire") {
      ctx.globalCompositeOperation = "lighter";
      glowAt(ctx, e.x, e.y, e.r * 0.8 * Math.min(1, k * 4 + 0.3), [[0, rgba([255, 230, 170], a * 0.9)], [1, "rgba(255,120,40,0)"]]);
    }
  },
  // wet mud thrown out in blobs
  splat(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.1), d = rgbOf(e.color, -0.0);
    ctx.globalCompositeOperation = "source-over";
    const grow = Math.min(1, k * 3);
    ctx.fillStyle = rgba(c, a * 0.5);
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.r * (0.4 + 0.7 * grow), e.r * 0.25 * (0.4 + grow), 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12 + 0.3, dist = e.r * (0.25 + 0.95 * grow) * (0.7 + (i % 3) * 0.2);
      const px = e.x + Math.cos(ang) * dist, py = e.y + Math.sin(ang) * dist * 0.8 - (1 - Math.abs(Math.cos(ang))) * e.r * 0.4 * grow + e.r * 0.5 * k * k;
      ctx.fillStyle = rgba(d, a * 0.9);
      ctx.beginPath();
      ctx.arc(px, py, e.r * 0.13 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // a geyser of dirt shooting up
  dig(ctx, e, k, a) {
    const h = e.r * (1.3 + 2.6 * Math.min(1, k * 3)), w = e.r * 0.5 * (1 - k * 0.5);
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, e.y, 0, e.y - h);
    g.addColorStop(0, rgba([150, 110, 70], a * 0.75));
    g.addColorStop(1, rgba([150, 110, 70], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(e.x - w, e.y);
    ctx.lineTo(e.x - w * 0.4, e.y - h);
    ctx.lineTo(e.x + w * 0.4, e.y - h);
    ctx.lineTo(e.x + w, e.y);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.4 + 0.5 * Math.min(1, k * 4)), [[0, rgba([255, 220, 150], a)], [1, "rgba(255,110,30,0)"]]);
  },
  // the hole's own shape flashes (diamond, star, square, funnel ...)
  shape(ctx, e, k, a) {
    const c = rgbOf(e.color, 0.35);
    ctx.globalCompositeOperation = "lighter";
    const grow = 0.55 + 0.45 * Math.min(1, k * 5);
    shapePath(ctx, e.shape, e.x, e.y, e.r, grow);
    ctx.fillStyle = rgba(c, a * 0.4);
    ctx.fill("evenodd");
    ctx.strokeStyle = rgba([255, 255, 255], a);
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.lineJoin = "round";
    ctx.stroke();
    shapePath(ctx, e.shape, e.x, e.y, e.r, 1 + 0.6 * k);
    ctx.strokeStyle = rgba(c, a * 0.7);
    ctx.lineWidth = 2;
    ctx.stroke();
  },
  // blue-white electricity
  electric(ctx, e, k, a) {
    const rnd = makeRng((e.id * 7919 + Math.floor(e.t * 24)) >>> 0);
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.5 + 0.7 * Math.min(1, k * 4)), [[0, rgba([255, 255, 255], a)], [0.4, rgba([120, 210, 255], a * 0.7)], [1, "rgba(40,100,255,0)"]]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < 7; i++) {
      const ang = (i * Math.PI * 2) / 7 + rnd(), len = e.r * (1.2 + rnd() * 1.4) * Math.min(1, 0.4 + k * 3);
      for (const [col, w] of [[rgba([80, 170, 255], a * 0.35), 7], [rgba([190, 240, 255], a * 0.8), 3], [rgba([255, 255, 255], a), 1.2]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        zigzag(ctx, e.x, e.y, e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len, rnd, 16);
      }
    }
  },
  // the arc that jumps from the blast to a tank
  arc(ctx, e, k, a) {
    const rnd = makeRng((e.id * 104729 + Math.floor(e.t * 30)) >>> 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [col, w] of [[rgba([80, 170, 255], a * 0.4), 9], [rgba([190, 240, 255], a * 0.9), 4], [rgba([255, 255, 255], a), 1.6]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      zigzag(ctx, e.x2, e.y2, e.x, e.y, rnd, 22);
    }
    glowAt(ctx, e.x, e.y, e.r * 1.4, [[0, rgba([255, 255, 255], a)], [1, "rgba(80,170,255,0)"]]);
  },
  // a colourful shower: a ring of coloured dots flying outward
  firework(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    const out = e.r * (0.4 + 2.6 * (1 - Math.pow(1 - Math.min(1, k * 1.3), 2)));
    for (let i = 0; i < 28; i++) {
      const ang = (i * Math.PI * 2) / 28, hue = (i * 13 + e.id * 37) % 360;
      ctx.fillStyle = "hsla(" + hue + ",100%,65%," + (a * 0.95).toFixed(3) + ")";
      const s = 3 * (1 - k * 0.6);
      ctx.fillRect(Math.round(e.x + Math.cos(ang) * out - s / 2), Math.round(e.y + Math.sin(ang) * out - s / 2 + k * k * e.r), s, s);
    }
    glowAt(ctx, e.x, e.y, e.r * (0.3 + 0.7 * Math.min(1, k * 5)), [[0, rgba([255, 255, 255], a)], [1, "rgba(255,120,220,0)"]]);
  },
  // molten slag: a dull red glow with hot spots
  slag(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.7 + 0.6 * Math.min(1, k * 3)), [[0, rgba([255, 200, 90], a * 0.9)], [0.4, rgba([230, 70, 20], a * 0.65)], [1, "rgba(120,10,0,0)"]]);
    for (let i = 0; i < 6; i++) {
      const ang = i * 1.05 + e.id, d = e.r * (0.5 + 0.8 * k);
      glowAt(ctx, e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d * 0.7 + k * k * e.r * 0.6, 5, [[0, rgba([255, 230, 140], a)], [1, "rgba(255,80,20,0)"]]);
    }
  },
  // wind streaks blowing outward
  gale(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba([210, 245, 255], a * 0.85);
    ctx.lineWidth = 2.5 * (1 - k) + 0.8;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const ang = (i * Math.PI * 2) / 18 + 0.15, r0 = e.r * (0.5 + 2.2 * k), r1 = r0 + e.r * (0.7 + (i % 3) * 0.3);
      ctx.moveTo(e.x + Math.cos(ang) * r0, e.y + Math.sin(ang) * r0 * 0.7);
      ctx.lineTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1 * 0.7);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba([160, 220, 255], a * 0.5);
    ctx.lineWidth = 6 * (1 - k);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (0.4 + 2.2 * k), 0, Math.PI * 2);
    ctx.stroke();
  },
  // a shockwave running along the ground to both sides
  quake(ctx, e, k, a, game) {
    const c = rgbOf(e.color, 0.45);
    const reach = e.r * Math.min(1, k * 1.7);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const side of [-1, 1]) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(c, a);
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      for (let s = Math.max(0, reach - 110), first = true; s <= reach; s += 5, first = false) {
        const px = e.x + side * s;
        const py = game.terrain.surfaceY(px, 0) - 3 - Math.abs(Math.sin(s * 0.35 + k * 25)) * 5 * (1 - k);
        if (first) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      const fx = e.x + side * reach;
      ctx.fillStyle = rgba([175, 148, 108], a * 0.5);
      ctx.beginPath();
      ctx.arc(fx, game.terrain.surfaceY(fx, 0) - 7, 9 + 9 * (1 - k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, 40, [[0, rgba([255, 240, 200], a * 0.8)], [1, rgba(c, 0)]]);
  },
  // a lightning strike
  bolt(ctx, e, k, a) {
    ctx.globalCompositeOperation = "lighter";
    glowAt(ctx, e.x, e.y, e.r * (0.3 + 0.9 * Math.min(1, k * 4)), [[0, rgba([255, 255, 255], a)], [0.4, rgba([140, 210, 255], a * 0.7)], [1, "rgba(40,100,255,0)"]]);
    ctx.strokeStyle = rgba([120, 235, 255], a * 0.8);
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (0.4 + 1.3 * Math.min(1, k * 2.2)), 0, Math.PI * 2);
    ctx.stroke();
  },
};
EXPL.meteor = EXPL.blast;


const FX = {
  enabled: true,        // the "Retro FX" checkbox: rain, lightning, scanlines
  seed: null,
  weather: null,
  cfg: SEASON_FX.normal,
  flashColor: "170,200,255",
  snow: [],
  embers: [],
  ash: [],
  debris: [],
  backdrop: null,       // the pre-drawn sky, moon and stars (a picture)
  cloudLayer: null,     // semi-transparent clouds (a picture that slowly scrolls sideways)
  frontLayer: null,     // the skyline in front of the clouds
  cloudX: 0,
  particles: [],
  rain: [],
  bolt: null,           // the lightning bolt being shown right now
  flash: 0,             // sky flash from lightning (1 = full)
  nextBolt: 5,          // seconds until the next lightning strike
  shake: 0,             // screen shake strength in pixels
  lastExplosionId: 0,
  trails: new WeakMap(), // shell -> list of recent positions (for the glowing tail)
  time: 0,

  // ---- Start of a new match (or a new season): draw a new city, refill the sky ----
  reset(seed, weather) {
    this.seed = seed;
    this.weather = weather || "normal";
    this.cfg = SEASON_FX[this.weather] || SEASON_FX.normal;
    const layers = this.makeBackdrop(seed, this.weather);
    this.backdrop = layers.back;
    this.cloudLayer = layers.clouds;
    this.frontLayer = layers.front;
    this.cloudX = 0;
    this.particles = [];
    this.bolt = null;
    this.flash = 0;
    this.shake = 0;
    const c = this.cfg;
    this.nextBolt = c.bolt ? 2 + Math.random() * 4 : 1e9;
    this.lastExplosionId = typeof explosionCounter !== "undefined" ? explosionCounter : 0;
    const rnd = Math.random;
    this.rain = [];
    for (let i = 0; i < (c.rain || 0); i++) {
      this.rain.push({ x: rnd() * W * 1.3 - W * 0.15, y: rnd() * H, len: (6 + rnd() * 10) * c.rainLen, v: (520 + rnd() * 280) * c.rainSpeed });
    }
    this.snow = [];
    for (let i = 0; i < (c.snow || 0); i++) {
      this.snow.push({ x: rnd() * W, y: rnd() * H, v: 28 + rnd() * 45, ph: rnd() * 6.28, big: rnd() < 0.25 });
    }
    this.embers = [];
    for (let i = 0; i < (c.embers || 0); i++) {
      this.embers.push({ x: rnd() * W, y: rnd() * H, v: 14 + rnd() * 36, ph: rnd() * 6.28, hot: rnd() < 0.4 });
    }
    this.ash = [];
    for (let i = 0; i < (c.ash || 0); i++) {
      this.ash.push({ x: rnd() * W, y: rnd() * H, v: 18 + rnd() * 28, ph: rnd() * 6.28 });
    }
    this.debris = [];
    for (let i = 0; i < (c.debris || 0); i++) {
      this.debris.push({ x: rnd() * W, y: rnd() * H, v: 700 + rnd() * 500, len: 12 + rnd() * 18, leaf: rnd() < 0.5 });
    }
  },

  // ---- The sky, moon, clouds and neon skyline, drawn once per match into three pictures ----
  // (back = sky and moon, clouds = see-through clouds that drift, front = the skyline)
  // Everything random here comes from the match seed, so every game gets a different sky and city.
  makeBackdrop(seed, weather) {
    const look = SEASON_LOOK[weather] || SEASON_LOOK.normal;
    const layer = (h) => { const c = document.createElement("canvas"); c.width = W; c.height = h || H; return c; };
    const backC = layer(), cloudC = layer(280), frontC = layer();
    const g = backC.getContext("2d");
    const rand = makeRng((seed ^ 0x9e3779b9) >>> 0);

    // sky gradient
    const colors = look.moods ? look.moods[Math.floor(rand() * look.moods.length)] : look.sky;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, colors[0]);
    sky.addColorStop(0.5, colors[1]);
    sky.addColorStop(0.82, colors[2]);
    sky.addColorStop(1, colors[3]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // stars
    for (let i = 0; i < look.stars; i++) {
      g.fillStyle = "rgba(200,225,255," + (0.25 + rand() * 0.55).toFixed(2) + ")";
      const s = rand() < 0.2 ? 2 : 1;
      g.fillRect(Math.floor(rand() * W), Math.floor(rand() * H * 0.6), s, s);
    }

    // northern lights (ice age)
    if (look.aurora) {
      for (let k = 0; k < 3; k++) {
        const base = 60 + k * 38 + rand() * 20;
        const col = k === 1 ? "154,107,255" : "61,255,154";
        const grad = g.createLinearGradient(0, base - 30, 0, base + 50);
        grad.addColorStop(0, "rgba(" + col + ",0)");
        grad.addColorStop(0.5, "rgba(" + col + ",0.24)");
        grad.addColorStop(1, "rgba(" + col + ",0)");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, base + 50);
        const ph = rand() * 6;
        for (let x = 0; x <= W; x += 16) g.lineTo(x, base + Math.sin(x * 0.012 + ph) * 26 + Math.sin(x * 0.031 + ph * 2) * 8);
        g.lineTo(W, base + 50);
        g.closePath();
        g.fill();
      }
    }

    // a moon (in different places, sometimes a crescent) or a huge red sun (apocalypse)
    if (look.moon && rand() < look.moon) {
      // (kept out of the middle, where the scoreboard text is)
      const mx = rand() < 0.5 ? 90 + rand() * 210 : 660 + rand() * 210, my = 40 + rand() * 120, mr = 13 + rand() * 18;
      const halo = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
      halo.addColorStop(0, "rgba(190,215,255,0.35)");
      halo.addColorStop(1, "rgba(190,215,255,0)");
      g.fillStyle = halo;
      g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.fillStyle = "#e8f1ff";
      g.beginPath();
      g.arc(mx, my, mr, 0, Math.PI * 2);
      g.fill();
      if (rand() < 0.5) { // crescent: bite a piece out with the sky colour
        g.fillStyle = colors[1];
        g.beginPath();
        g.arc(mx + mr * 0.5, my - mr * 0.2, mr * 0.95, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (look.sun) {
      const sx = 200 + rand() * (W - 400), sy = H - 150 - rand() * 40, sr = 80 + rand() * 40;
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
      glow.addColorStop(0, "rgba(255,170,70,0.95)");
      glow.addColorStop(0.35, "rgba(255,80,30,0.6)");
      glow.addColorStop(1, "rgba(255,40,10,0)");
      g.fillStyle = glow;
      g.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
    }

    // clouds: many soft, see-through puffs, so the moon shines through where they overlap it.
    // The picture wraps around sideways, so it can scroll forever.
    if (look.clouds) {
      const c = look.clouds, cg = cloudC.getContext("2d");
      const n = c.n[0] + Math.floor(rand() * (c.n[1] - c.n[0] + 1));
      for (let i = 0; i < n; i++) {
        const cx = rand() * W, cy = c.y[0] + rand() * (c.y[1] - c.y[0]), bw = 110 + rand() * 190;
        const puffs = [];
        for (let j = 0; j < 9; j++) {
          const rx = bw * (0.16 + rand() * 0.2);
          puffs.push({ x: cx + (rand() - 0.5) * bw, y: cy + (rand() - 0.5) * bw * 0.16, rx: rx, ry: rx * (0.25 + rand() * 0.2), a: c.alpha * (0.6 + rand() * 0.8) });
        }
        for (const off of [-W, 0, W]) {
          for (const p of puffs) {
            cg.fillStyle = "rgba(" + c.color + "," + p.a.toFixed(3) + ")";
            cg.beginPath();
            cg.ellipse(p.x + off, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
            cg.fill();
          }
        }
      }
    }

    // two rows of towers: a dark far row, and a glowing neon near row (heights vary from game to game)
    const gf = frontC.getContext("2d");
    const hs = 0.75 + rand() * 0.5;
    const neons = look.neons;
    const row = (o) => {
      let x = -8;
      while (x < W) {
        const w = Math.round((o.minW + rand() * (o.maxW - o.minW)) / 3) * 3;
        const h = Math.round((o.minH + rand() * (o.maxH - o.minH)) * hs);
        const top = H - h;
        const color = neons[Math.floor(rand() * neons.length)];
        // outline (glowing for the near row); ruined towers get a broken top
        gf.shadowColor = o.neon ? color : "transparent";
        gf.shadowBlur = o.neon ? 8 : 0;
        gf.fillStyle = o.fill;
        gf.strokeStyle = o.neon ? color : o.line;
        gf.lineWidth = o.neon ? 2 : 1;
        let clear = 9; // windows start this far below the top
        if (look.ruin) {
          const j = () => Math.round(rand() * 26);
          const pts = [[x, top + j()], [x + w * 0.35, top + j()], [x + w * 0.7, top + j()], [x + w, top + j()]];
          gf.beginPath();
          gf.moveTo(pts[0][0], H);
          pts.forEach((p) => gf.lineTo(p[0], p[1]));
          gf.lineTo(x + w, H);
          gf.closePath();
          gf.fill();
          gf.stroke();
          clear = 34;
        } else {
          gf.fillRect(x, top, w, h);
          gf.strokeRect(x + 1, top + 1, w - 2, h);
          if (rand() < 0.3) { // antenna
            gf.beginPath();
            gf.moveTo(x + Math.round(w / 2), top);
            gf.lineTo(x + Math.round(w / 2), top - 14 - Math.round(rand() * 14));
            gf.stroke();
          }
        }
        if (o.neon && rand() < 0.16) { // a glowing neon sign on the side of the tower
          gf.fillStyle = color;
          if (rand() < 0.5) gf.fillRect(x + w - 5, top + clear + 6, 3, Math.min(90, h - 60));
          else gf.fillRect(x + 6, top + clear + 10 + Math.round(rand() * 40), w - 12, 4);
        }
        gf.shadowBlur = 0;
        if (look.snowcap) { // snow on the roofs
          gf.fillStyle = "#eaf8ff";
          gf.fillRect(x, top - 1, w, 3);
          if (rand() < 0.5) gf.fillRect(x + 3, top - 3, Math.max(6, w - 12), 2);
        }
        // windows
        for (let wy = top + clear; wy < Math.min(H - 60, 420); wy += 9) {
          for (let wx = x + 6; wx < x + w - 6; wx += 9) {
            if (rand() < o.lit) {
              gf.fillStyle = o.neon ? color : o.win;
              gf.globalAlpha = o.neon ? 0.55 + rand() * 0.45 : 1;
              gf.fillRect(wx, wy, 3, 3);
              gf.globalAlpha = 1;
            }
          }
        }
        x += w + Math.round(rand() * 6);
      }
    };
    row({ minW: 30, maxW: 72, minH: 150, maxH: 330, fill: look.far.fill, line: look.far.line, win: look.far.win, lit: 0.18, neon: false });
    row({ minW: 27, maxW: 63, minH: 130, maxH: 290, fill: look.near, line: "#fff", win: "#fff", lit: 0.3, neon: true });

    // weather haze over everything (it lies on the front picture, which covers the whole screen)
    if (look.fog) {
      gf.fillStyle = look.fog;
      gf.fillRect(0, 0, W, H);
    }
    return { back: backC, clouds: cloudC, front: frontC };
  },

  // ---- Every frame: move the rain, snow, lightning, sparks ----
  update(dt, game) {
    if (game.seed !== this.seed || game.weather !== this.weather) this.reset(game.seed, game.weather);
    this.time += dt;

    // new explosions -> sparks, debris and shake (and lightning for real bolts)
    for (const e of game.explosions) {
      if (e.id > this.lastExplosionId) {
        this.lastExplosionId = e.id;
        this.spawnBlast(e);
        if (e.kind === "bolt") {
          this.bolt = this.makeBolt(e.x, e.y);
          this.bolt.life = 0.45;
          this.flash = 1;
          this.flashColor = "170,200,255";
        } else if (e.kind === "meteor") {
          this.flash = 0.7;
          this.flashColor = "255,150,60";
        }
      }
    }

    // particles
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);

    this.shake = this.shake > 0.3 ? this.shake * Math.pow(0.02, dt) : 0;
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }

    // everything below is decoration that the Retro FX box switches off
    if (!this.enabled) return;
    const wind = game.wind;
    const dir = wind === 0 ? 1 : Math.sign(wind);
    this.cloudX = (((this.cloudX + (this.cfg.cloudSpeed + Math.abs(wind) * 0.8) * dir * dt) % W) + W) % W;

    // rain (slants with the wind)
    const slant = Math.max(-1.6, Math.min(1.8, 0.28 + wind * 0.025));
    for (const d of this.rain) {
      d.y += d.v * dt;
      d.x += d.v * dt * slant;
      if (d.y > H || d.x > W * 1.15 || d.x < -W * 0.15) {
        d.y = -20;
        d.x = Math.random() * W * 1.3 - W * 0.15;
      }
    }
    // snow drifts down and sideways
    for (const s of this.snow) {
      s.y += s.v * dt;
      s.x += (wind * 3 + Math.sin(this.time * 1.4 + s.ph) * 16) * dt;
      if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      if (s.x < -5) s.x += W + 10;
      if (s.x > W + 5) s.x -= W + 10;
    }
    // embers rise, ash falls
    for (const e of this.embers) {
      e.y -= e.v * dt;
      e.x += Math.sin(this.time * 2 + e.ph) * 14 * dt + wind * 2 * dt;
      if (e.y < -6) { e.y = H + 4; e.x = Math.random() * W; }
    }
    for (const a of this.ash) {
      a.y += a.v * dt;
      a.x += (Math.sin(this.time + a.ph) * 12 + wind * 2) * dt;
      if (a.y > H) { a.y = -4; a.x = Math.random() * W; }
    }
    // hurricane debris flies sideways with the wind
    for (const d of this.debris) {
      d.x += dir * d.v * dt;
      d.y += Math.sin(d.x * 0.02) * 40 * dt;
      if (d.x > W + 40 || d.x < -40) { d.x = dir > 0 ? -30 : W + 30; d.y = Math.random() * H; }
    }
    if (this.weather === "hurricane") this.shake = Math.max(this.shake, 1.0); // the whole picture trembles

    // ambient lightning (only for show, far away in a thunderstorm; real strikes come from the game)
    this.nextBolt -= dt;
    if (this.cfg.bolt && this.nextBolt <= 0 && game.phase !== "over") {
      this.nextBolt = this.cfg.bolt[0] + Math.random() * (this.cfg.bolt[1] - this.cfg.bolt[0]);
      const x = 80 + Math.random() * (W - 160);
      const far = this.cfg.distantBolts;
      if (!this.bolt) {
        this.bolt = this.makeBolt(x, far ? 230 + Math.random() * 90 : game.terrain.surfaceY(x, 0) - 2);
        this.bolt.dim = !!far;
      }
      this.flash = far ? 0.55 : 1;
      this.flashColor = "170,200,255";
    }
  },

  makeBolt(x0, yEnd) {
    const path = (x, y, yStop, spread) => {
      const pts = [{ x: x, y: y }];
      while (y < yStop) {
        y += 12 + Math.random() * 16;
        x += (Math.random() - 0.5) * spread;
        pts.push({ x: x, y: Math.min(y, yStop) });
      }
      return pts;
    };
    const main = path(x0, -10, yEnd, 44);
    const forks = [];
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const from = main[2 + Math.floor(Math.random() * Math.max(1, main.length - 4))];
      if (from) forks.push(path(from.x, from.y, from.y + 50 + Math.random() * 60, 50));
    }
    return { main: main, forks: forks, life: 0.3 };
  },

  // ---- Sparks, debris and dust for an explosion (different for every style) ----
  spawnBlast(e) {
    const r = e.r;
    const style = e.kind === "bolt" ? "bolt" : e.kind === "meteor" ? "meteor" : e.kind === "arc" ? "arc" : e.kind === "quake" ? "quake"
      : (e.style || (e.kind === "dirt" ? "dust" : "blast"));
    const SHAKE = { blast: Math.min(9, r / 8), mega: 12, pop: 2, spark: 3, flare: 1.5, pulse: 2, ring: 4, dust: 2, splat: 2, dig: 3,
                    shape: 4, electric: 3, firework: 3, slag: 3, gale: 3, quake: 10, bolt: 5, meteor: 9, arc: 3 };
    this.shake = Math.max(this.shake, SHAKE[style] !== undefined ? SHAKE[style] : 2);
    const add = (p) => this.particles.push(p);
    const rnd = Math.random;
    const n = (min, max, k) => Math.max(min, Math.min(max, Math.round(r * k)));
    const c1 = lighten(e.color || "#ffb040", 0.55);
    const burst = (count, spMin, spMax, o) => { // sparks flying out in all directions
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2, sp = spMin + rnd() * (spMax - spMin);
        add(Object.assign({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), grav: 260, drag: 1.2,
                            life: 0.35 + rnd() * 0.55, max: 0.9, size: rnd() < 0.3 ? 3 : 2, color: c1, glow: true }, o));
      }
    };
    const smoke = (count, color) => {
      for (let i = 0; i < count; i++) {
        add({ x: e.x + (rnd() - 0.5) * r, y: e.y + (rnd() - 0.5) * r * 0.6, vx: (rnd() - 0.5) * 30, vy: -20 - rnd() * 30, grav: -10, drag: 0.5,
              life: 0.7 + rnd() * 0.6, max: 1.3, size: 6 + rnd() * 8, color: color || "#6a7aa8", smoke: true });
      }
    };
    const rocks = (count, spd) => { // chunks of ground flying up
      for (let i = 0; i < count; i++) {
        const a = -Math.PI * (0.1 + rnd() * 0.8), sp = 60 + rnd() * (spd + r * 2);
        add({ x: e.x + (rnd() - 0.5) * r * 0.5, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 520, drag: 0.3,
              life: 0.7 + rnd() * 0.8, max: 1.5, size: rnd() < 0.4 ? 3 : 2, color: NEON.rock[1 + Math.floor(rnd() * 3)] });
      }
    };

    switch (style) {
      case "bolt":
        burst(26, 60, 260, { up: 60, grav: 300, drag: 1.4, life: 0.25 + rnd() * 0.4, color: rnd() < 0.5 ? "#ffffff" : "#8fe8ff" });
        rocks(n(6, 20, 0.5), 80);
        break;
      case "arc":
        burst(12, 50, 180, { color: "#bff0ff" });
        break;
      case "mega":
        burst(n(30, 90, 1.1), 80, 200 + r * 3, { up: 40, color: ["#ffffff", "#fff2a0", "#ffb040", "#ff5a1f"][Math.floor(rnd() * 4)] });
        smoke(Math.max(4, Math.round(r / 7)), "#59506a");
        rocks(n(14, 60, 0.9), 140);
        break;
      case "pop":
        burst(10, 50, 150, {});
        break;
      case "spark":
        burst(26, 140, 380, { grav: 120, drag: 1.6, life: 0.5 + rnd() * 0.5, color: rnd() < 0.5 ? c1 : "#ffffff" });
        break;
      case "flare":
        burst(8, 30, 120, { color: "#ffffff", life: 0.2 + rnd() * 0.25 });
        break;
      case "pulse": // sparks are drawn inward toward the centre
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2, d = r * (1.4 + rnd() * 0.8);
          add({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * 2.6, grav: 0, drag: 0,
                life: 0.38, max: 0.4, size: 2, color: c1, glow: true });
        }
        break;
      case "ring":
        for (let i = 0; i < 16; i++) { // dust rolling out along the ground
          const side = i % 2 ? 1 : -1;
          add({ x: e.x, y: e.y - 3, vx: side * (60 + rnd() * 180), vy: -rnd() * 14, grav: 0, drag: 1.5, life: 0.6 + rnd() * 0.5, max: 1.1,
                size: 5 + rnd() * 6, color: "#8a8aa8", smoke: true });
        }
        break;
      case "dust":
        smoke(Math.max(5, Math.round(r / 5)), "#8a7258");
        rocks(n(8, 30, 0.45), 60);
        if (e.kind === "fire") burst(8, 60, 160, { up: 40, color: "#ffd08a" });
        break;
      case "splat": { // mud droplets that fall back down
        const mud = e.color || "#8a6a3a";
        for (let i = 0; i < n(14, 34, 0.7); i++) {
          const a = -Math.PI * (0.05 + rnd() * 0.9), sp = 90 + rnd() * (150 + r);
          add({ x: e.x + (rnd() - 0.5) * r * 0.4, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 640, drag: 0.2,
                life: 0.9 + rnd() * 0.7, max: 1.5, size: 3 + (rnd() < 0.4 ? 1 : 0), color: mud });
        }
        smoke(3, "#6a5440");
        break;
      }
      case "dig": // chunks shot straight up
        for (let i = 0; i < n(18, 44, 0.9); i++) {
          add({ x: e.x + (rnd() - 0.5) * r * 0.4, y: e.y, vx: (rnd() - 0.5) * 90, vy: -(220 + rnd() * 320), grav: 620, drag: 0.1,
                life: 0.9 + rnd() * 0.9, max: 1.7, size: rnd() < 0.4 ? 3 : 2, color: rnd() < 0.25 ? "#c9985a" : NEON.rock[1 + Math.floor(rnd() * 3)] });
        }
        smoke(4, "#8a7258");
        break;
      case "shape": // angular shards in the weapon's colour
        for (let i = 0; i < 24; i++) {
          const a = rnd() * Math.PI * 2, sp = 90 + rnd() * (150 + r * 2);
          add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, grav: 340, drag: 0.6, life: 0.6 + rnd() * 0.7, max: 1.3,
                size: 3, color: rnd() < 0.5 ? c1 : "#ffffff", glow: true });
        }
        rocks(n(6, 24, 0.5), 70);
        break;
      case "electric":
        burst(18, 80, 260, { up: 30, life: 0.2 + rnd() * 0.35, color: rnd() < 0.5 ? "#ffffff" : "#8fe8ff" });
        break;
      case "firework":
        for (let i = 0; i < 40; i++) {
          const a = rnd() * Math.PI * 2, sp = 90 + rnd() * 230;
          add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 130, drag: 1.5, life: 0.7 + rnd() * 0.6, max: 1.3,
                size: 2 + (rnd() < 0.3 ? 1 : 0), color: "hsl(" + Math.floor(rnd() * 360) + ",100%,65%)", glow: true });
        }
        break;
      case "slag":
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI * (0.1 + rnd() * 0.8), sp = 70 + rnd() * 190;
          add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 720, drag: 0.15, life: 0.8 + rnd() * 0.7, max: 1.5,
                size: 3, color: rnd() < 0.5 ? "#ff8a2a" : "#ffd23a", glow: true });
        }
        smoke(4, "#4a2a2a");
        break;
      case "gale":
        for (let i = 0; i < 22; i++) {
          const a = rnd() * Math.PI * 2, sp = 140 + rnd() * 280;
          add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, grav: 0, drag: 1.6, life: 0.5 + rnd() * 0.4, max: 0.9,
                size: 4 + rnd() * 4, color: "#cfeeff", smoke: true });
        }
        break;
      case "quake":
        for (let i = 0; i < 26; i++) { // dust waves racing out along the ground
          const side = i % 2 ? 1 : -1;
          add({ x: e.x, y: e.y - 4, vx: side * (120 + rnd() * 360), vy: -rnd() * 30, grav: 0, drag: 0.8, life: 0.7 + rnd() * 0.6, max: 1.3,
                size: 6 + rnd() * 8, color: "#a28a68", smoke: true });
        }
        rocks(n(10, 40, 0.1), 100);
        break;
      case "meteor": // fireball, like the classic blast but bigger
      default: {   // "blast"
        const fireColors = ["#ffffff", "#fff2a0", "#ffd23a", "#ff9a2a", "#ff5a1f"];
        burst(n(8, 70, 0.9), 60, 140 + r * 3, { up: 40, color: fireColors[Math.floor(rnd() * fireColors.length)] });
        smoke(Math.max(1, Math.round(r / 12)));
        rocks(n(6, 50, 0.7), 110);
      }
    }
  },

  // ---- Drawing ----
  // Sky, city, lightning (drawn behind the ground)
  drawBackdrop(ctx) {
    ctx.drawImage(this.backdrop, 0, 0);
    const off = Math.round(this.cloudX) % W;           // the clouds drift sideways and wrap around
    ctx.drawImage(this.cloudLayer, off, 0);
    ctx.drawImage(this.cloudLayer, off - W, 0);
    ctx.drawImage(this.frontLayer, 0, 0);
    if (this.flash > 0) {
      ctx.fillStyle = "rgba(" + this.flashColor + "," + (this.flash * 0.22).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (this.bolt) {
      const flicker = this.bolt.life > 0.2 || Math.floor(this.bolt.life * 60) % 2 === 0 ? 1 : 0.35;
      const trace = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const paths = [this.bolt.main].concat(this.bolt.forks);
      const passes = [["rgba(60,160,255,0.22)", 12], ["rgba(120,220,255,0.55)", 5], ["#ffffff", 2]];
      for (const [color, width] of passes) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = flicker * (this.bolt.dim ? 0.55 : 1);
        ctx.lineWidth = width;
        for (const p of paths) trace(p);
      }
      ctx.globalAlpha = 1;
    }
  },

  drawParticles(ctx) {
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      if (p.smoke) {
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = p.color;
        const s = p.size * (1.6 - k * 0.6);
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
        continue;
      }
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      if (p.glow) { // soft halo around bright sparks
        ctx.globalAlpha = k * 0.25;
        ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, p.size + 4, p.size + 4);
      }
    }
    ctx.globalAlpha = 1;
  },

  drawExplosions(ctx, game) {
    for (const e of game.explosions) {
      const k = Math.min(1, e.t / BOOM_TIME);
      if (k >= 1) continue;
      const style = e.kind === "bolt" ? "bolt" : e.kind === "meteor" ? "meteor" : e.kind === "arc" ? "arc" : e.kind === "quake" ? "quake"
        : (e.style || (e.kind === "dirt" ? "dust" : "blast"));
      ctx.save();
      (EXPL[style] || EXPL.blast)(ctx, e, k, 1 - k, game);
      ctx.restore();
    }
  },

  // Shells are glowing comets with a fading tail
  drawShells(ctx, projs) {
    for (const p of projs) {
      if (p.delay > 0) continue;
      let trail = this.trails.get(p);
      if (!trail) { trail = []; this.trails.set(p, trail); }
      trail.push({ x: p.x, y: p.y });
      if (trail.length > 16) trail.shift();

      const small = p.w.name === "fragment";
      const halo = lighten(p.w.color, 0.55);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < trail.length; i++) {
        const k = (i + 1) / trail.length;
        ctx.globalAlpha = k * 0.5;
        ctx.fillStyle = halo;
        const s = (small ? 2 : 4) * k + 1;
        ctx.fillRect(Math.round(trail[i].x - s / 2), Math.round(trail[i].y - s / 2), Math.round(s), Math.round(s));
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, small ? 5 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = NEON.white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, small ? 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Rain, snow, embers, flying debris and falling meteors (drawn in front of everything)
  drawWeather(ctx, game) {
    this.drawMeteors(ctx, game);
    if (!this.enabled) return;
    const wind = game.wind;
    const c = this.cfg;

    if (this.rain.length) {
      const slant = Math.max(-1.6, Math.min(1.8, 0.28 + wind * 0.025));
      ctx.strokeStyle = c.rainColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const d of this.rain) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - slant * d.len, d.y - d.len);
      }
      ctx.stroke();
    }
    if (this.snow.length) {
      ctx.fillStyle = "#eaf8ff";
      for (const s of this.snow) {
        ctx.globalAlpha = s.big ? 0.95 : 0.7;
        const z = s.big ? 3 : 2;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), z, z);
      }
      ctx.globalAlpha = 1;
    }
    if (this.ash.length) {
      ctx.fillStyle = "#8a7f86";
      ctx.globalAlpha = 0.5;
      for (const a of this.ash) ctx.fillRect(Math.round(a.x), Math.round(a.y), 2, 2);
      ctx.globalAlpha = 1;
    }
    if (this.embers.length) {
      ctx.globalCompositeOperation = "lighter";
      for (const e of this.embers) {
        const flick = 0.55 + 0.45 * Math.sin(this.time * 9 + e.ph * 3);
        ctx.globalAlpha = flick * 0.9;
        ctx.fillStyle = e.hot ? "#ffd23a" : "#ff6a2a";
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.hot ? 3 : 2, e.hot ? 3 : 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.debris.length) {
      const dir = wind === 0 ? 1 : Math.sign(wind);
      ctx.lineWidth = 2;
      for (const d of this.debris) {
        ctx.strokeStyle = d.leaf ? "rgba(90,160,110,0.65)" : "rgba(140,110,80,0.6)";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - dir * d.len, d.y - 2);
        ctx.stroke();
      }
    }
  },

  // Meteors that are about to land (during the "weather" phase), as glowing fireballs with a long tail
  drawMeteors(ctx, game) {
    if (game.phase !== "weather") return;
    for (const e of game.weatherEvents) {
      if (e.kind !== "meteor" || e.done) continue;
      const left = e.at - game.weatherClock;
      if (left > METEOR_FALL_TIME) continue;
      const p = 1 - left / METEOR_FALL_TIME;           // 0 = top of the screen, 1 = impact
      const ground = game.terrain.surfaceY(e.x, 0);
      const sx = e.x - 230, sy = -50;
      const at = (k) => ({ x: sx + (e.x - sx) * k, y: sy + (ground - sy) * k });
      const head = at(p), tail = at(Math.max(0, p - 0.3));
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, "rgba(255,80,20,0)");
      grad.addColorStop(1, "rgba(255,170,60,0.9)");
      ctx.strokeStyle = grad;
      ctx.lineCap = "round";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      const halo = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22);
      halo.addColorStop(0, "rgba(255,240,190,0.95)");
      halo.addColorStop(0.4, "rgba(255,140,50,0.6)");
      halo.addColorStop(1, "rgba(255,60,20,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = "butt";
    }
  },

  // Random jitter for the screen shake
  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: Math.round((Math.random() * 2 - 1) * this.shake), y: Math.round((Math.random() * 2 - 1) * this.shake) };
  },
};
