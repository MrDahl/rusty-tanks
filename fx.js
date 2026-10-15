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

const FX = {
  enabled: true,        // the "Retro FX" checkbox: rain, lightning, scanlines
  seed: null,
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

  // ---- Start of a new match: draw a new city ----
  reset(seed) {
    this.seed = seed;
    this.backdrop = this.makeBackdrop(seed);
    this.particles = [];
    this.bolt = null;
    this.flash = 0;
    this.shake = 0;
    this.nextBolt = 3 + Math.random() * 5;
    this.lastExplosionId = typeof explosionCounter !== "undefined" ? explosionCounter : 0;
    if (this.rain.length === 0) {
      for (let i = 0; i < 150; i++) {
        this.rain.push({ x: Math.random() * W * 1.3 - W * 0.15, y: Math.random() * H, len: 6 + Math.random() * 10, v: 520 + Math.random() * 280 });
      }
    }
  },

  // ---- The sky and the neon skyline, drawn once per match into a picture ----
  makeBackdrop(seed) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    const rand = makeRng((seed ^ 0x9e3779b9) >>> 0);

    // night sky, glowing purple near the horizon
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#03040c");
    sky.addColorStop(0.5, "#090e2a");
    sky.addColorStop(0.82, "#1b0f44");
    sky.addColorStop(1, "#34115f");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // stars
    for (let i = 0; i < 110; i++) {
      g.fillStyle = "rgba(200,225,255," + (0.25 + rand() * 0.55).toFixed(2) + ")";
      const s = rand() < 0.2 ? 2 : 1;
      g.fillRect(Math.floor(rand() * W), Math.floor(rand() * H * 0.6), s, s);
    }

    // two rows of towers: a dark far row, and a glowing neon near row
    const neons = [NEON.cyan, NEON.green, NEON.magenta, NEON.amber, NEON.violet];
    const row = (o) => {
      let x = -8;
      while (x < W) {
        const w = Math.round((o.minW + rand() * (o.maxW - o.minW)) / 3) * 3;
        const h = Math.round(o.minH + rand() * (o.maxH - o.minH));
        const top = H - h;
        const color = neons[Math.floor(rand() * neons.length)];
        g.fillStyle = o.fill;
        g.fillRect(x, top, w, h);
        // outline (glowing for the near row)
        g.shadowColor = o.neon ? color : "transparent";
        g.shadowBlur = o.neon ? 8 : 0;
        g.strokeStyle = o.neon ? color : o.line;
        g.lineWidth = o.neon ? 2 : 1;
        g.strokeRect(x + 1, top + 1, w - 2, h);
        if (rand() < 0.3) { // antenna
          g.beginPath();
          g.moveTo(x + Math.round(w / 2), top);
          g.lineTo(x + Math.round(w / 2), top - 14 - Math.round(rand() * 14));
          g.stroke();
        }
        g.shadowBlur = 0;
        // windows
        for (let wy = top + 9; wy < Math.min(H - 60, 420); wy += 9) {
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
    row({ minW: 30, maxW: 72, minH: 150, maxH: 330, fill: "#0b1230", line: "#16275a", win: "#1c3170", lit: 0.18, neon: false });
    row({ minW: 27, maxW: 63, minH: 130, maxH: 290, fill: "#060a1c", line: "#fff", win: "#fff", lit: 0.3, neon: true });
    return c;
  },

  // ---- Every frame: move the rain, lightning, sparks ----
  update(dt, game) {
    if (game.seed !== this.seed) this.reset(game.seed);
    this.time += dt;

    // new explosions -> sparks, debris and shake
    for (const e of game.explosions) {
      if (e.id > this.lastExplosionId) {
        this.lastExplosionId = e.id;
        this.spawnBlast(e);
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

    if (!this.enabled) { this.bolt = null; return; }

    // rain (slants with the wind)
    const slant = 0.28 + game.wind * 0.025;
    for (const d of this.rain) {
      d.y += d.v * dt;
      d.x += d.v * dt * slant;
      if (d.y > H || d.x > W * 1.15 || d.x < -W * 0.15) {
        d.y = -20;
        d.x = Math.random() * W * 1.3 - W * 0.15;
      }
    }

    // lightning
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }
    this.nextBolt -= dt;
    if (this.nextBolt <= 0 && game.phase !== "over") {
      this.nextBolt = 7 + Math.random() * 10;
      const x = 80 + Math.random() * (W - 160);
      this.bolt = this.makeBolt(x, game.terrain.surfaceY(x, 0) - 2);
      this.flash = 1;
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
    this.shake = Math.max(this.shake, e.kind === "fire" ? Math.min(9, r / 8) : 2);
    const add = (p) => this.particles.push(p);
    const n = (min, max, k) => Math.max(min, Math.min(max, Math.round(r * k)));

    if (e.kind === "fire") {
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
    const debris = e.kind === "fire" ? n(6, 50, 0.7) : n(10, 40, 0.5);
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
    if (!this.enabled) return;
    if (this.flash > 0) {
      ctx.fillStyle = "rgba(170,200,255," + (this.flash * 0.22).toFixed(3) + ")";
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
        ctx.globalAlpha = flicker;
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
      } else {
        g.addColorStop(0, "rgba(255,250,220," + a.toFixed(3) + ")");
        g.addColorStop(0.35, "rgba(255,170,60," + (a * 0.85).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,40,80,0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === "fire") { // neon shockwave ring
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

  drawRain(ctx, wind) {
    if (!this.enabled) return;
    const slant = 0.28 + wind * 0.025;
    ctx.strokeStyle = "rgba(150,190,255,0.28)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const d of this.rain) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - slant * d.len, d.y - d.len);
    }
    ctx.stroke();
  },

  // Random jitter for the screen shake
  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: Math.round((Math.random() * 2 - 1) * this.shake), y: Math.round((Math.random() * 2 - 1) * this.shake) };
  },
};
