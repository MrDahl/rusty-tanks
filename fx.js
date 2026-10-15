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
    stars: 110, moon: true,
    neons: [NEON.cyan, NEON.green, NEON.magenta, NEON.amber, NEON.violet],
    far: { fill: "#0b1230", line: "#16275a", win: "#1c3170" }, near: "#060a1c",
  },
  monsoon: {
    sky: ["#040806", "#0b1510", "#16261a", "#2c3a1c"], stars: 0,
    neons: [NEON.green, NEON.amber, NEON.cyan, "#ff9a3d"],
    far: { fill: "#0a140f", line: "#18301f", win: "#2a4a2a" }, near: "#050a07",
    clouds: { n: 9, color: "#0a1210", alpha: 0.75 }, fog: "rgba(24,44,24,0.30)",
  },
  iceage: {
    sky: ["#041226", "#0c3052", "#1f6288", "#74b8d4"], stars: 80, moon: true, aurora: true, snowcap: true,
    neons: [NEON.cyan, "#bfefff", NEON.violet, NEON.green],
    far: { fill: "#0d2540", line: "#2a5a86", win: "#5aa0d0" }, near: "#08182e",
    fog: "rgba(150,210,255,0.10)",
  },
  thunderstorm: {
    sky: ["#010208", "#060818", "#0d0f30", "#191247"], stars: 0,
    neons: [NEON.cyan, NEON.violet, NEON.magenta, NEON.amber],
    far: { fill: "#080b22", line: "#141c4a", win: "#1c2a66" }, near: "#050818",
    clouds: { n: 11, color: "#05060f", alpha: 0.85 }, fog: "rgba(10,10,44,0.25)",
  },
  hurricane: {
    sky: ["#061116", "#0e2830", "#1b4250", "#2e5f6e"], stars: 0,
    neons: [NEON.cyan, NEON.green, NEON.amber, NEON.magenta],
    far: { fill: "#0b1f26", line: "#1d4552", win: "#2d6676" }, near: "#06141a",
    clouds: { n: 12, color: "#0d1c22", alpha: 0.8 }, fog: "rgba(60,100,110,0.22)",
  },
  apocalypse: {
    sky: ["#090103", "#2a0508", "#5e1208", "#b03a0e"], stars: 0, sun: true, ruin: true,
    neons: ["#ff5a1f", NEON.amber, "#ff3d3d", "#ff8a3a"],
    far: { fill: "#1b0709", line: "#4a1510", win: "#7a2a10" }, near: "#0d0305",
    clouds: { n: 10, color: "#150506", alpha: 0.8 }, fog: "rgba(120,20,0,0.18)",
  },
};

// ---- What falls from the sky in each season (counts, colours, how often ambient lightning flashes) ----
const SEASON_FX = {
  normal:       { rain: 150, rainColor: "rgba(150,190,255,0.28)", rainSpeed: 1,    rainLen: 1,   bolt: [7, 17] },
  monsoon:      { rain: 420, rainColor: "rgba(140,205,170,0.34)", rainSpeed: 1.1,  rainLen: 1.3, bolt: null },
  iceage:       { snow: 200, bolt: null },
  thunderstorm: { rain: 300, rainColor: "rgba(160,190,255,0.32)", rainSpeed: 1.15, rainLen: 1.2, bolt: [2.5, 6], distantBolts: true },
  hurricane:    { rain: 380, rainColor: "rgba(170,215,230,0.34)", rainSpeed: 1.5,  rainLen: 1.5, bolt: null, debris: 26 },
  apocalypse:   { embers: 110, ash: 70, bolt: null },
};

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
  backdrop: null,       // the pre-drawn sky and city (a picture)
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
    this.backdrop = this.makeBackdrop(seed, this.weather);
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

  // ---- The sky and the neon skyline, drawn once per match into a picture ----
  // Everything random here comes from the match seed, so every game gets a different city.
  makeBackdrop(seed, weather) {
    const look = SEASON_LOOK[weather] || SEASON_LOOK.normal;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
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

    // a moon (most games) or a huge red sun (apocalypse)
    if (look.moon && rand() < 0.75) {
      // (kept out of the middle, where the scoreboard text is)
      const mx = rand() < 0.5 ? 90 + rand() * 210 : 660 + rand() * 210, my = 45 + rand() * 105, mr = 13 + rand() * 17;
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

    // storm clouds
    if (look.clouds) {
      for (let i = 0; i < look.clouds.n; i++) {
        const cx = rand() * W, cy = 15 + rand() * 150, bw = 90 + rand() * 170;
        for (let j = 0; j < 7; j++) {
          g.globalAlpha = look.clouds.alpha * (0.35 + rand() * 0.4);
          g.fillStyle = look.clouds.color;
          g.beginPath();
          g.ellipse(cx + (rand() - 0.5) * bw, cy + (rand() - 0.5) * 26, 40 + rand() * 70, 12 + rand() * 20, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }

    // two rows of towers: a dark far row, and a glowing neon near row (heights vary from game to game)
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
        g.shadowColor = o.neon ? color : "transparent";
        g.shadowBlur = o.neon ? 8 : 0;
        g.fillStyle = o.fill;
        g.strokeStyle = o.neon ? color : o.line;
        g.lineWidth = o.neon ? 2 : 1;
        let clear = 9; // windows start this far below the top
        if (look.ruin) {
          const j = () => Math.round(rand() * 26);
          const pts = [[x, top + j()], [x + w * 0.35, top + j()], [x + w * 0.7, top + j()], [x + w, top + j()]];
          g.beginPath();
          g.moveTo(pts[0][0], H);
          pts.forEach((p) => g.lineTo(p[0], p[1]));
          g.lineTo(x + w, H);
          g.closePath();
          g.fill();
          g.stroke();
          clear = 34;
        } else {
          g.fillRect(x, top, w, h);
          g.strokeRect(x + 1, top + 1, w - 2, h);
          if (rand() < 0.3) { // antenna
            g.beginPath();
            g.moveTo(x + Math.round(w / 2), top);
            g.lineTo(x + Math.round(w / 2), top - 14 - Math.round(rand() * 14));
            g.stroke();
          }
        }
        if (o.neon && rand() < 0.16) { // a glowing neon sign on the side of the tower
          g.fillStyle = color;
          if (rand() < 0.5) g.fillRect(x + w - 5, top + clear + 6, 3, Math.min(90, h - 60));
          else g.fillRect(x + 6, top + clear + 10 + Math.round(rand() * 40), w - 12, 4);
        }
        g.shadowBlur = 0;
        if (look.snowcap) { // snow on the roofs
          g.fillStyle = "#eaf8ff";
          g.fillRect(x, top - 1, w, 3);
          if (rand() < 0.5) g.fillRect(x + 3, top - 3, Math.max(6, w - 12), 2);
        }
        // windows
        for (let wy = top + clear; wy < Math.min(H - 60, 420); wy += 9) {
          for (let wx = x + 6; wx < x + w - 6; wx += 9) {
            if (rand() < o.lit) {
              g.fillStyle = o.neon ? color : o.win;
              g.globalAlpha = o.neon ? 0.55 + rand() * 0.45 : 1;
              g.fillRect(wx, wy, 3, 3);
              g.globalAlpha = 1;
            }
          }
        }
        x += w + Math.round(rand() * 6);
      }
    };
    row({ minW: 30, maxW: 72, minH: 150, maxH: 330, fill: look.far.fill, line: look.far.line, win: look.far.win, lit: 0.18, neon: false });
    row({ minW: 27, maxW: 63, minH: 130, maxH: 290, fill: look.near, line: "#fff", win: "#fff", lit: 0.3, neon: true });

    // weather haze over everything
    if (look.fog) {
      g.fillStyle = look.fog;
      g.fillRect(0, 0, W, H);
    }
    return c;
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

  // ---- Sparks, debris and dust for an explosion ----
  spawnBlast(e) {
    const r = e.r;
    const fiery = e.kind === "fire" || e.kind === "meteor";
    this.shake = Math.max(this.shake, e.kind === "meteor" ? 9 : e.kind === "bolt" ? 5 : fiery ? Math.min(9, r / 8) : 2);
    const add = (p) => this.particles.push(p);
    const n = (min, max, k) => Math.max(min, Math.min(max, Math.round(r * k)));

    if (e.kind === "bolt") { // electric sparks
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
        add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, grav: 300, drag: 1.4,
              life: 0.25 + Math.random() * 0.4, max: 0.65, size: Math.random() < 0.3 ? 3 : 2,
              color: Math.random() < 0.5 ? "#ffffff" : "#8fe8ff", glow: true });
      }
    }
    if (fiery) {
      const fireColors = ["#ffffff", "#fff2a0", "#ffd23a", "#ff9a2a", "#ff5a1f"];
      for (let i = 0; i < n(8, 70, 0.9); i++) { // bright sparks
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * (140 + r * 3);
        add({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, grav: 260, drag: 1.2,
              life: 0.35 + Math.random() * 0.55, max: 0.9, size: Math.random() < 0.3 ? 3 : 2,
              color: fireColors[Math.floor(Math.random() * fireColors.length)], glow: true });
      }
      for (let i = 0; i < Math.max(1, Math.round(r / 12)); i++) { // smoke puffs
        add({ x: e.x + (Math.random() - 0.5) * r, y: e.y + (Math.random() - 0.5) * r * 0.6,
              vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, grav: -10, drag: 0.5,
              life: 0.7 + Math.random() * 0.6, max: 1.3, size: 6 + Math.random() * 8, color: "#6a7aa8", smoke: true });
      }
    }
    // rock debris (dust for dirt piles)
    const debris = fiery ? n(6, 50, 0.7) : n(10, 40, 0.5);
    for (let i = 0; i < debris; i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8), sp = 60 + Math.random() * (110 + r * 2);
      add({ x: e.x + (Math.random() - 0.5) * r * 0.5, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 520, drag: 0.3,
            life: 0.7 + Math.random() * 0.8, max: 1.5, size: Math.random() < 0.4 ? 3 : 2,
            color: NEON.rock[1 + Math.floor(Math.random() * 3)] });
    }
  },

  // ---- Drawing ----
  // Sky, city, lightning (drawn behind the ground)
  drawBackdrop(ctx) {
    ctx.drawImage(this.backdrop, 0, 0);
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
      const grow = Math.min(1, k * 4);                 // quick pop, then fade
      const r = e.r * (0.3 + 0.9 * grow);
      const a = 1 - k;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      if (e.kind === "dirt") {
        g.addColorStop(0, "rgba(150,170,230," + (a * 0.5).toFixed(3) + ")");
        g.addColorStop(1, "rgba(40,60,120,0)");
      } else if (e.kind === "bolt") {
        g.addColorStop(0, "rgba(255,255,255," + a.toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(140,210,255," + (a * 0.7).toFixed(3) + ")");
        g.addColorStop(1, "rgba(40,100,255,0)");
      } else {
        g.addColorStop(0, "rgba(255,250,220," + a.toFixed(3) + ")");
        g.addColorStop(0.35, "rgba(255,170,60," + (a * 0.85).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,40,80,0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === "fire" || e.kind === "meteor" || e.kind === "bolt") { // neon shockwave ring
        ctx.strokeStyle = "rgba(120,235,255," + (a * 0.8).toFixed(3) + ")";
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (0.4 + 1.3 * Math.min(1, k * 2.2)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
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
