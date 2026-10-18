// =====================================================================
//  RUSTY TANKS - drawing and controls
//  Reads the game state from game.js and paints it on the canvas.
//  Also connects the keyboard, sliders and buttons to the game.
// =====================================================================

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;

const angleSlider = document.getElementById("angle");
const powerSlider = document.getElementById("power");
const angleLabel = document.getElementById("angleLabel");
const powerLabel = document.getElementById("powerLabel");
const fireButton = document.getElementById("fire");
const newButton = document.getElementById("newgame");
const guideBox = document.getElementById("guide");
const weaponSelect = document.getElementById("weapon");
const fxBox = document.getElementById("fx");

// Menu choices (what the player picked on the menu)
const settings = { mode: "cpu", difficulty: "normal", season: "normal" };
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menubtn");
const startButton = document.getElementById("start");
const diffBlock = document.getElementById("diffBlock");
let menuOpen = true;

// "ai" tells the game who is a computer: [player 1, player 2]
function aiSetting() {
  return settings.mode === "cpu" ? [null, settings.difficulty] : [null, null];
}

let game = new Game(undefined, aiSetting());

// ---- Colours ----------------------------------------------------------
// (the neon palette lives in fx.js)
const COLORS = {
  tanks: [NEON.cyan, NEON.magenta],
  text: "#cfe8ff",
  textDim: "#7f9cc4",
};
const FONT = "'Press Start 2P', 'Courier New', monospace";
try { if (document.fonts) document.fonts.load("12px 'Press Start 2P'"); } catch (e) { /* font is optional */ }

// ---- The ground: pixel-art rock -----------------------------------------
// Painted into a hidden picture and only re-painted where the ground changed.
const terrainCanvas = document.createElement("canvas");
terrainCanvas.width = W;
terrainCanvas.height = H;
const terrainCtx = terrainCanvas.getContext("2d");
const terrainImg = terrainCtx.createImageData(W, H);
let paintedVersion = -1;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
let ROCK = NEON.rock.map(hex);      // darkest .. lightest
let CRACK = hex(NEON.crack);
let RIM = hex(NEON.rim);
let RIM2 = [74, 112, 190];

// What the ground is made of in each season: 4 rock colours (dark to light), crack colour,
// bright edge colour and the softer glow just inside the edge.
const THEMES = {
  normal:       { rock: NEON.rock, crack: NEON.crack, rim: NEON.rim, rim2: "#4a70be" },
  monsoon:      { rock: ["#2a1d12", "#3a281a", "#4b3422", "#5e4429"], crack: "#76553a", rim: "#d2a56a", rim2: "#8b6a45" },
  iceage:       { rock: ["#2a4a6e", "#3a6590", "#5a8cb8", "#86b6d8"], crack: "#cfeaff", rim: "#ffffff", rim2: "#a8d8ff" },
  thunderstorm: { rock: ["#0d1224", "#151c36", "#1d2748", "#27345a"], crack: "#4a6aa8", rim: "#a0c4ff", rim2: "#4a62a0" },
  hurricane:    { rock: ["#17252c", "#1f3540", "#2a4654", "#37596a"], crack: "#5f8ea0", rim: "#8fd6e8", rim2: "#4e93a8" },
  apocalypse:   { rock: ["#1c0e0e", "#2a1414", "#3d1c18", "#552618"], crack: "#ff6a2a", rim: "#ffa04a", rim2: "#b0451e" },
};
let themeWeather = null;
function applyTheme() {
  if (themeWeather === game.weather) return;
  themeWeather = game.weather;
  const th = THEMES[game.weather] || THEMES.normal;
  ROCK = th.rock.map(hex);
  CRACK = hex(th.crack);
  RIM = hex(th.rim);
  RIM2 = hex(th.rim2);
  NEON.rock = th.rock;          // (flying rock debris uses these colours too)
  game.terrain.touch(0, W - 1); // paint the whole ground again in the new colours
}

// Jagged cracks in the rock, worked out once. They are fixed to the screen, like a texture.
const crackMask = new Uint8Array(W * H);
(function makeCracks() {
  const rand = makeRng(12345);
  const dot = (x, y) => { // 2x2 blocks give the chunky pixel-art look
    const bx = (x >> 1) << 1, by = (y >> 1) << 1;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      if (bx + dx >= 0 && bx + dx < W && by + dy >= 0 && by + dy < H) crackMask[(by + dy) * W + bx + dx] = 1;
    }
  };
  const walk = (x, y, ang, len, level) => {
    for (let i = 0; i < len; i++) {
      dot(x, y);
      ang += (rand() - 0.5) * 0.7;
      x += Math.cos(ang) * 2;
      y += Math.sin(ang) * 2;
      if (level < 2 && rand() < 0.035) walk(x, y, ang + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.6), Math.floor(len * 0.5), level + 1);
    }
  };
  for (let i = 0; i < 40; i++) walk(rand() * W, 120 + rand() * 420, rand() * Math.PI * 2, 30 + Math.floor(rand() * 60), 0);
})();

// A repeatable pseudo-random number for a pixel block (so the speckles don't flicker)
function blockNoise(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ICE_RIM = [225, 250, 255], ICE_LIGHT = [150, 215, 245], ICE_BODY = [95, 170, 225], ICE_SPARKLE = [235, 252, 255];

function paintTerrain() {
  const t = game.terrain;
  const x0 = Math.max(0, t.dirtyX0), x1 = Math.min(W - 1, t.dirtyX1);
  const mask = t.mask, ice = t.ice, data = terrainImg.data;
  const air = (x, y) => x >= 0 && x < W && y >= 0 && mask[y * W + x] !== 1;
  for (let x = x0; x <= x1; x++) {
    let depth = 0; // how far below the nearest air above this pixel is
    for (let y = 0; y < H; y++) {
      const p = y * W + x, i = p * 4;
      if (mask[p] !== 1) { depth = 0; data[i + 3] = 0; continue; }
      let c;
      const edge = air(x - 1, y) || air(x + 1, y) || air(x - 2, y) || air(x + 2, y);
      if (depth < 2 || edge) c = RIM;                                  // bright outline
      else if (depth < 5 || air(x - 4, y) || air(x + 4, y)) c = RIM2;   // soft inner glow
      else {
        const band = depth < 16 ? 3 : depth < 48 ? 2 : depth < 120 ? 1 : 0;   // lighter near the top
        const n = blockNoise(x >> 1, y >> 1);
        const b = Math.max(0, Math.min(3, band + (n < 0.07 ? 1 : n > 0.95 ? -1 : 0)));
        c = crackMask[p] && depth > 8 ? CRACK : ROCK[b];
      }
      if (ice[p]) {   // frozen dirt: pale, glassy blue
        const n = blockNoise(x >> 1, (y >> 1) + 77);
        c = depth < 2 || edge ? ICE_RIM : n < 0.12 ? ICE_SPARKLE : depth < 8 ? ICE_LIGHT : ICE_BODY;
      }
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      depth++;
    }
  }
  terrainCtx.putImageData(terrainImg, 0, 0, x0, 0, x1 - x0 + 1, H);
  t.clearDirty();
  paintedVersion = t.version;
}

// ---- Tanks: glowing neon pixel tanks --------------------------------------
// Visible effects on a tank: ice on a frozen turret, flames, a radiation glow, EMP sparks
function drawTankStatus(t, index, x, y) {
  const frozen = t.status.frozen > 0 || (game.current === index && t.lock.angle);
  const emp = t.status.emp > 0 || (game.current === index && t.lock.drive);
  const rad = t.status.rad > 0;
  const time = FX.time;
  ctx.save();
  ctx.shadowBlur = 0;
  if (frozen) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#bfeeff";
    ctx.fillRect(x - 12, y - 28, 24, 18);                       // block of ice around the turret
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 12.5, y - 28.5, 25, 19);
    ctx.fillStyle = "#e8fbff";
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 10 + i * 6, y - 28); ctx.lineTo(x - 8 + i * 6, y - 36 - (i % 2) * 4); ctx.lineTo(x - 5 + i * 6, y - 28); ctx.fill(); }
  }
  if (rad) {
    const p = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 34);
    g.addColorStop(0, "rgba(140,255,90," + (0.28 + 0.15 * p) + ")");
    g.addColorStop(1, "rgba(80,255,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 10, 34, 0, Math.PI * 2); ctx.fill();
  }
  if (emp) {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(150,200,255," + (0.5 + 0.4 * Math.sin(time * 40)) + ")";
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const sx = x - 14 + ((Math.floor(time * 12) * 7 + i * 13) % 28), sy = y - 26 + ((Math.floor(time * 12) * 5 + i * 9) % 20);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 5, sy + 4); ctx.lineTo(sx - 1, sy + 7); ctx.lineTo(sx + 4, sy + 12); ctx.stroke();
    }
  }
  if (t.burning > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const fx = x - 12 + i * 8, h = 10 + 6 * Math.sin(time * 25 + i * 2);
      const g = ctx.createRadialGradient(fx, y - 12, 1, fx, y - 12 - h * 0.5, h);
      g.addColorStop(0, "rgba(255,240,150,0.9)"); g.addColorStop(0.5, "rgba(255,120,30,0.6)"); g.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx, y - 12 - h * 0.4, h, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawTank(t, index, active) {
  const color = COLORS.tanks[index];
  const x = Math.round(t.x), y = Math.round(t.y);
  const a = (t.angle * Math.PI) / 180;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 18 : 10;

  // barrel (turns around the same point the shells fly out from)
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(0, -BARREL_PIVOT);
  ctx.lineTo(Math.cos(a) * BARREL_LENGTH, -BARREL_PIVOT - Math.sin(a) * BARREL_LENGTH);
  ctx.stroke();

  // body, drawn 1.3x bigger than the basic pixel design
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = "#08102a";
  ctx.fillRect(-15, -6, 30, 6);              // tracks
  ctx.lineWidth = 2;
  ctx.strokeRect(-14, -5, 28, 4);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) ctx.fillRect(-12 + i * 6, -4, 2, 2); // wheels
  ctx.fillRect(-12, -12, 24, 6);             // hull
  ctx.fillStyle = "#08102a";
  ctx.fillRect(-10, -10, 20, 2);
  ctx.fillStyle = color;
  ctx.beginPath();                           // turret
  ctx.arc(0, -12, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#08102a";
  ctx.fillRect(-3, -15, 6, 2);
  ctx.restore();

  drawTankStatus(t, index, x, y);

  // bobbing arrow above the tank whose turn it is
  if (active && game.phase === "aim") {
    const bob = Math.round(Math.sin(FX.time * 6) * 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 56 + bob, 3, 6);
    ctx.fillRect(x - 3, y - 50 + bob, 7, 2);
    ctx.fillRect(x - 1, y - 48 + bob, 3, 2);
  }
}

function drawAimGuide() {
  if (!guideBox.checked || game.phase !== "aim" || game.isAiTurn || menuOpen) return;
  const pts = game.predictPath(140);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 4; i < pts.length; i += 5) {
    const k = 1 - (i / pts.length) * 0.6;
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = "#7dffd8";
    ctx.fillRect(Math.round(pts[i].x) - 4, Math.round(pts[i].y) - 4, 9, 9);
    ctx.globalAlpha = 0.9 * k;
    ctx.fillRect(Math.round(pts[i].x) - 1, Math.round(pts[i].y) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// ---- The scoreboard and messages (arcade text) -----------------------------
function neonText(str, x, y, color, size, align) {
  ctx.font = size + "px " + FONT;
  ctx.textAlign = align || "left";
  ctx.textBaseline = "top";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(str, x, y);
}

// Shrink the text until it fits in maxWidth
function fitSize(str, size, maxWidth) {
  ctx.font = size + "px " + FONT;
  while (size > 6 && ctx.measureText(str).width > maxWidth) {
    size--;
    ctx.font = size + "px " + FONT;
  }
  return size;
}

const SEASON_NAMES = { normal: "Normal", monsoon: "Monsoon", iceage: "Ice Age", thunderstorm: "Thunderstorm", hurricane: "Hurricane", apocalypse: "Apocalypse", random: "Random" };
const SEASON_COLORS = { normal: "#cfe8ff", monsoon: "#8ff0b8", iceage: "#bfefff", thunderstorm: NEON.violet, hurricane: NEON.cyan, apocalypse: "#ff7a3a" };
const SEASON_INFO = {
  normal: "Clear skies. No surprises.",
  monsoon: "Mud! A tank that sits still sinks. Drive to get free.",
  iceage: "Slippery! Tanks slide, and shells bounce wildly.",
  thunderstorm: "1-2 lightning strikes every turn. A hit costs 30 points.",
  hurricane: "Wild wind that turns around every turn.",
  apocalypse: "3-4 meteors crash down every turn. A hit costs 30 points.",
  random: "A surprise season, picked fresh for every match.",
};

function shortName(i, ai) {
  ai = ai || game.ai;
  if (!ai[i]) return "P" + (i + 1);
  return "CPU-" + ai[i].toUpperCase();
}

// The dotted aim guide is a plain flight path. Weapons that do something clever on the way are only approximate.
function guideIsApproximate(w) {
  return !!(w.homing || w.proximity || w.split || w.bounces || w.rain || w.burst || w.scatter || w.chaos || w.rolls ||
    w.drill || w.teleport || (w.volley && w.volley.count > 1));
}

function drawHud() {
  ctx.save();
  // scores, shots left
  for (let i = 0; i < 2; i++) {
    const right = i === 1;
    const x = right ? W - 18 : 18;
    const al = right ? "right" : "left";
    const live = game.current === i && game.phase !== "over";
    ctx.globalAlpha = live ? 1 : 0.6;
    neonText(shortName(i), x, 12, COLORS.tanks[i], 11, al);
    neonText(String(game.tanks[i].score), x, 30, COLORS.tanks[i], 22, al);
    neonText("SHOTS " + (game.shotLimit - game.shotsFired[i]), x, 60, COLORS.textDim, 9, al);
    // effects on this tank
    const st = game.tanks[i].status, tags = [];
    if (st.frozen > 0 || (game.current === i && game.tanks[i].lock.angle)) tags.push(["FROZEN", "#9fe8ff"]);
    if (st.emp > 0 || (game.current === i && game.tanks[i].lock.drive)) tags.push(["EMP", "#7fb0ff"]);
    if (st.rad > 0) tags.push(["FALLOUT X" + st.rad, "#9aff6a"]);
    if (st.confused > 0 || (game.current === i && game.tanks[i].lock.scramble)) tags.push(["DIZZY", "#ffe066"]);
    tags.forEach((tg, k) => neonText(tg[0], x, 74 + k * 12, tg[1], 8, al));
  }
  ctx.globalAlpha = 1;

  // wind
  neonText("WIND", W / 2, 12, COLORS.textDim, 10, "center");
  const w = game.wind;
  if (w === 0) {
    neonText("CALM", W / 2, 30, COLORS.text, 14, "center");
  } else {
    const len = Math.abs(w) * 3, dir = Math.sign(w), cx = W / 2, cy = 38;
    ctx.strokeStyle = NEON.green;
    ctx.shadowColor = NEON.green;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2, cy);
    ctx.moveTo(cx + (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 9, cy - 6);
    ctx.moveTo(cx + (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 9, cy + 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    neonText(String(Math.abs(w)), W / 2, 50, COLORS.text, 9, "center");
  }

  // turn message, weapon
  if (game.phase === "aim") {
    const msg = game.isAiTurn ? "COMPUTER IS THINKING..." : game.playerName(game.current).toUpperCase() + " - TAKE AIM";
    neonText(msg, W / 2, 74, COLORS.tanks[game.current], 12, "center");
    const wp = game.weapon;
    const line = wp.name.toUpperCase() + " - " + wp.info;
    neonText(line, W / 2, 96, COLORS.text, fitSize(line, 9, W - 330), "center");
    if (!game.isAiTurn) neonText("DRIVE LEFT " + Math.round(game.moveLeft) + "  (A / D)", W / 2, 114, COLORS.textDim, 8, "center");
    if (game.tank.buried) neonText("BURIED IN DIRT - BLAST YOURSELF FREE", W / 2, 130, "#ffb060", 8, "center");
    else if (game.tank.sink > 0) neonText("STUCK IN THE MUD - DRIVE TO GET FREE", W / 2, 130, SEASON_COLORS.monsoon, 8, "center");
    else if (game.statusNote) neonText(game.statusNote, W / 2, 130, "#ffe066", 8, "center");
    else if (!game.isAiTurn && guideBox.checked && guideIsApproximate(wp)) neonText("AIM GUIDE: FIRST SHELL, ROUGH PATH ONLY", W / 2, 130, COLORS.textDim, 8, "center");
  } else if (game.lastHit && game.phase !== "over") {
    neonText(game.lastHit.toUpperCase(), W / 2, 76, NEON.amber, 13, "center");
  }

  if (game.weather !== "normal") {
    neonText(SEASON_NAMES[game.weather].toUpperCase(), 18, 78, SEASON_COLORS[game.weather], 9, "left");
  }

  if (game.phase === "over") {
    ctx.fillStyle = "rgba(4, 6, 20, 0.78)";
    ctx.fillRect(0, H / 2 - 80, W, 160);
    const a = game.tanks[0].score, b = game.tanks[1].score;
    const col = a === b ? NEON.amber : COLORS.tanks[a > b ? 0 : 1];
    neonText(game.winnerText().toUpperCase(), W / 2, H / 2 - 44, col, 30, "center");
    neonText(a + "  -  " + b, W / 2, H / 2 + 2, COLORS.text, 16, "center");
    neonText("N = REMATCH    ESC = MENU", W / 2, H / 2 + 38, COLORS.textDim, 10, "center");
  }
  ctx.restore();
}

function draw() {
  applyTheme();
  if (paintedVersion !== game.terrain.version) paintTerrain();
  ctx.save();
  const s = FX.shakeOffset();
  ctx.translate(s.x, s.y);
  FX.drawBackdrop(ctx);
  ctx.drawImage(terrainCanvas, 0, 0);
  game.tanks.forEach((t, i) => {
    drawTank(t, i, i === game.current);
    if (t.sink > 0) { // stuck in the mud: put the ground back in front of the sunken part
      const sx = Math.round(t.x) - 34, sy = Math.round(t.y) - 22 - t.sink;
      ctx.drawImage(terrainCanvas, sx, sy, 68, 62, sx, sy, 68, 62);
    }
    if (t.buried) { // covered in dirt: the ground hides the tank, which shows through as a faint ghost
      const sx = Math.round(t.x) - 40, sy = Math.round(t.y) - 62;
      ctx.drawImage(terrainCanvas, sx, sy, 80, 74, sx, sy, 80, 74);
      ctx.globalAlpha = 0.35;
      drawTank(t, i, false);
      ctx.globalAlpha = 1;
    }
  });
  drawAimGuide();
  FX.drawFlames(ctx, game.flames);
  FX.drawShells(ctx, game.projs);
  FX.drawExplosions(ctx, game);
  FX.drawParticles(ctx);
  FX.drawWeather(ctx, game);
  ctx.restore();
  if (!menuOpen) drawHud();
}

// ---- Menu ----------------------------------------------------------------
function selectIn(rowId, attr, value) {
  for (const b of document.querySelectorAll("#" + rowId + " button")) {
    b.classList.toggle("selected", b.dataset[attr] === value);
  }
}

for (const b of document.querySelectorAll("#modeRow button")) {
  b.addEventListener("click", () => {
    settings.mode = b.dataset.mode;
    selectIn("modeRow", "mode", settings.mode);
    diffBlock.style.display = settings.mode === "cpu" ? "" : "none";
  });
}
for (const b of document.querySelectorAll("#diffRow button")) {
  b.addEventListener("click", () => {
    settings.difficulty = b.dataset.diff;
    selectIn("diffRow", "diff", settings.difficulty);
  });
}

const seasonInfo = document.getElementById("seasonInfo");
for (const b of document.querySelectorAll("#seasonRow button")) {
  b.addEventListener("click", () => {
    settings.season = b.dataset.season;
    selectIn("seasonRow", "season", settings.season);
    seasonInfo.textContent = SEASON_INFO[settings.season];
  });
}

function showMenu() {
  menuOpen = true;
  menu.classList.remove("hidden");
}

// Start button: go to the weapon draft
function startGame() {
  menu.classList.add("hidden");
  openDraft();
}

// New map, same weapons
let currentLoadouts = null;
function rematch() {
  game.newMatch(Date.now(), aiSetting(), currentLoadouts ? [currentLoadouts[0].slice(), currentLoadouts[1].slice()] : undefined, settings.season);
}

// ---- Weapon draft ---------------------------------------------------------
// Every game starts with a fresh random pool of 20 weapons. Players take turns picking (P1, P2,
// P1, ...) until each has 10. A weapon that was picked is gone for both players. Each pick is
// one use in the battle.
const PICKS_EACH = 10;
const POOL_SIZE = PICKS_EACH * 2;
const draftSection = document.getElementById("draft");
const stageEl = document.getElementById("stage");
const controlsEl = document.getElementById("controls");
const draftGo = document.getElementById("draftGo");
const draft = { picks: [[], []], pool: [], token: 0 };
let draftOpen = false;

function drafter() {
  if (draft.picks[0].length >= PICKS_EACH) return 1;
  if (draft.picks[1].length >= PICKS_EACH) return 0;
  return draft.picks[0].length <= draft.picks[1].length ? 0 : 1;
}
function draftDone() {
  return draft.picks[0].length >= PICKS_EACH && draft.picks[1].length >= PICKS_EACH;
}
function playerLabel(p) {
  return aiSetting()[p] ? "Computer (" + aiSetting()[p] + ")" : "Player " + (p + 1);
}
// Who took weapon i? 0 or 1, or -1 if it is still in the pool
function takenBy(i) {
  return draft.picks[0].includes(i) ? 0 : draft.picks[1].includes(i) ? 1 : -1;
}
function availableWeapons() {
  return draft.pool.filter((i) => takenBy(i) < 0);
}

// A random set of 20 weapons (the computer needs enough weapons it knows how to aim)
function makePool() {
  let pool = [];
  for (let tries = 0; tries < 60; tries++) {
    const all = WEAPONS.map((w, i) => i);
    for (let i = all.length - 1; i > 0; i--) { // shuffle
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    pool = all.slice(0, POOL_SIZE);
    if (pool.filter((i) => WEAPONS[i].ai).length >= 9) break;
  }
  return pool.sort((x, y) => x - y);
}

function buildWeaponGrid() {
  const grid = document.getElementById("weaponGrid");
  grid.innerHTML = "";
  for (const i of draft.pool) {
    const w = WEAPONS[i];
    const b = document.createElement("button");
    b.className = "wcard";
    b.dataset.weapon = i;
    b.style.borderLeftColor = lighten(w.color, 0.55);
    b.innerHTML = "<b></b><span></span><em></em>";
    b.children[0].textContent = w.name;
    b.children[1].textContent = w.info;
    b.addEventListener("click", () => draftPick(i));
    grid.appendChild(b);
  }
}

function renderDraft() {
  const who = drafter();
  for (let p = 0; p < 2; p++) {
    document.getElementById("pickname" + p).textContent = playerLabel(p) + " - " + draft.picks[p].length + "/" + PICKS_EACH;
    document.getElementById("pickbox" + p).classList.toggle("active", !draftDone() && who === p);
    const ol = document.getElementById("picklist" + p);
    ol.innerHTML = "";
    for (let n = 0; n < PICKS_EACH; n++) {
      const li = document.createElement("li");
      if (n < draft.picks[p].length) li.textContent = WEAPONS[draft.picks[p][n]].name;
      else { li.textContent = "-"; li.className = "empty"; }
      ol.appendChild(li);
    }
  }
  const turn = document.getElementById("draftTurn");
  const humanTurn = !draftDone() && !aiSetting()[who];
  if (draftDone()) turn.textContent = "All set! Press START BATTLE.";
  else if (humanTurn) turn.textContent = playerLabel(who) + ": pick weapon " + (draft.picks[who].length + 1) + " of " + PICKS_EACH;
  else turn.textContent = playerLabel(who) + " is choosing...";
  document.getElementById("weaponGrid").classList.toggle("wait", !humanTurn);
  for (const b of document.querySelectorAll("#weaponGrid button")) {
    const owner = takenBy(Number(b.dataset.weapon));
    b.disabled = owner >= 0;
    b.classList.toggle("taken", owner >= 0);
    b.classList.toggle("t0", owner === 0);
    b.classList.toggle("t1", owner === 1);
    b.lastChild.textContent = owner >= 0 ? "TAKEN BY " + shortName(owner, aiSetting()) : "";
  }
  document.getElementById("draftRandom").disabled = !humanTurn;
  draftGo.disabled = !draftDone();
}

function draftPick(i) {
  if (draftDone() || aiSetting()[drafter()] || takenBy(i) >= 0 || !draft.pool.includes(i)) return;
  draft.picks[drafter()].push(i);
  renderDraft();
  draftAiTurn();
}

// When it is the computer's turn to pick, it picks by itself after a short pause
function draftAiTurn() {
  if (!draftOpen || draftDone() || !aiSetting()[drafter()]) return;
  const token = draft.token;
  const p = drafter();
  setTimeout(() => {
    if (!draftOpen || token !== draft.token || drafter() !== p) return;
    draft.picks[p].push(aiDraftPick(availableWeapons(), Math.random));
    renderDraft();
    draftAiTurn();
  }, 450);
}

function openDraft() {
  draft.picks = [[], []];
  draft.pool = makePool();
  draft.token++;
  draftOpen = true;
  draftSection.classList.remove("hidden");
  buildWeaponGrid();
  renderDraft();
  draftAiTurn();
}

function closeDraft() {
  draftOpen = false;
  draft.token++;
  draftSection.classList.add("hidden");
}

document.getElementById("draftBack").addEventListener("click", () => {
  closeDraft();
  showMenu();
});

// "Random pick": the player whose turn it is gets a random weapon from the pool
document.getElementById("draftRandom").addEventListener("click", () => {
  const p = drafter();
  if (aiSetting()[p] || draftDone()) return;
  const left = availableWeapons();
  draftPick(left[Math.floor(Math.random() * left.length)]);
});

draftGo.addEventListener("click", () => {
  if (!draftDone()) return;
  currentLoadouts = [draft.picks[0].slice(), draft.picks[1].slice()];
  closeDraft();
  game.newMatch(Date.now(), aiSetting(), [currentLoadouts[0].slice(), currentLoadouts[1].slice()], settings.season);
  menuOpen = false;
});

startButton.addEventListener("click", startGame);

// Quick Play: no draft. Both sides get 10 random weapons from a fresh pool (the computer-friendly ones are more likely)
document.getElementById("quick").addEventListener("click", () => {
  menu.classList.add("hidden");
  draft.pool = makePool();
  draft.picks = [[], []];
  while (!draftDone()) {
    const who = drafter();
    const avail = availableWeapons();
    draft.picks[who].push(aiDraftPick(avail, Math.random));
  }
  currentLoadouts = [draft.picks[0].slice(), draft.picks[1].slice()];
  game.newMatch(Date.now(), aiSetting(), [currentLoadouts[0].slice(), currentLoadouts[1].slice()], settings.season);
  menuOpen = false;
});
menuButton.addEventListener("click", showMenu);

// ---- Controls ---------------------------------------------------------
function syncControls() {
  const t = game.tank;
  angleSlider.value = t.angle;
  powerSlider.value = t.power;
  angleLabel.textContent = Math.round(t.angle) + "°";
  powerLabel.textContent = Math.round(t.power);
  const canAim = game.phase === "aim" && !game.isAiTurn && !menuOpen;
  const lk = t.lock || {};
  angleSlider.disabled = !canAim || !!lk.angle;
  powerSlider.disabled = !canAim || !!lk.power;
  angleSlider.title = lk.angle ? "Turret frozen - angle is locked this turn" : "";
  powerSlider.title = lk.power ? "EMP - power is locked this turn" : "";
  angleSlider.classList.toggle("locked", !!lk.angle);
  powerSlider.classList.toggle("locked", !!lk.power);
  fireButton.disabled = !canAim;
  syncWeaponList();
}

// The weapons the current player still has (in list order)
function ownedWeapons() {
  const list = [];
  WEAPONS.forEach((w, i) => { if (game.ammo[game.current][i] > 0) list.push(i); });
  return list;
}

// Rebuild the weapon list only when something changed (so an open dropdown isn't disturbed)
let weaponSignature = "";
function syncWeaponList() {
  const t = game.tank;
  const sig = game.current + ":" + t.weapon + ":" + game.ammo[game.current].join(",") + ":" + game.phase + ":" + game.isAiTurn;
  if (sig === weaponSignature) return;
  weaponSignature = sig;
  weaponSelect.innerHTML = "";
  ownedWeapons().forEach((i, n) => {
    const left = game.ammo[game.current][i];
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = (n + 1) + ". " + WEAPONS[i].name + (left === Infinity ? "" : " x" + left);
    weaponSelect.appendChild(opt);
  });
  weaponSelect.value = t.weapon;
  weaponSelect.disabled = game.phase !== "aim" || game.isAiTurn;
}

angleSlider.addEventListener("input", () => {
  game.setAngle(Number(angleSlider.value));
  syncControls();
});
powerSlider.addEventListener("input", () => {
  game.setPower(Number(powerSlider.value));
  syncControls();
});
weaponSelect.addEventListener("change", () => {
  game.setWeapon(Number(weaponSelect.value));
  syncControls();
});
fireButton.addEventListener("click", () => game.fire());

// Retro FX: rain, lightning and scanlines can be switched off (remembered between visits)
function applyFx() {
  FX.enabled = fxBox.checked;
  document.getElementById("stage").classList.toggle("crt", fxBox.checked);
  try { localStorage.setItem("rustyTanksFx", fxBox.checked ? "1" : "0"); } catch (e) { /* not saved */ }
}
try { if (localStorage.getItem("rustyTanksFx") === "0") fxBox.checked = false; } catch (e) { /* default: on */ }
fxBox.addEventListener("change", applyFx);
applyFx();

// ---- Fullscreen layout: scale the 960 x 650 game frame to fit the window ----
const gameFrame = document.getElementById("game");
function fitGame() {
  const s = Math.min(window.innerWidth / 960, window.innerHeight / 650);
  gameFrame.style.setProperty("--scale", s.toFixed(4));
}
window.addEventListener("resize", fitGame);
fitGame();
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) { /* not supported */ }
}
document.getElementById("fullscreen").addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", (e) => {
  if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey) toggleFullscreen();
});

// Sound and music switches (remembered between visits)
const sfxBox = document.getElementById("sfx");
const musicBox = document.getElementById("music");
sfxBox.checked = Sound.sfx;
musicBox.checked = Sound.music;
sfxBox.addEventListener("change", () => Sound.setSfx(sfxBox.checked));
musicBox.addEventListener("change", () => Sound.setMusic(musicBox.checked));

// Driving: hold a button (or the A / D key) to drive
function holdToDrive(button, dir) {
  const start = (e) => { e.preventDefault(); game.setMoveDir(dir); };
  const stop = () => { if (game.moveDir === dir) game.setMoveDir(0); };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("pointercancel", stop);
}
holdToDrive(document.getElementById("driveL"), -1);
holdToDrive(document.getElementById("driveR"), 1);
window.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "A") { if (game.moveDir === -1) game.setMoveDir(0); }
  if (e.key === "d" || e.key === "D") { if (game.moveDir === 1) game.setMoveDir(0); }
});
window.addEventListener("blur", () => game.setMoveDir(0));
newButton.addEventListener("click", rematch);

window.addEventListener("keydown", (e) => {
  if (draftOpen) return;
  if (menuOpen) {
    if (e.key === "Enter" && document.activeElement === document.body) {
      startGame();
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Escape") {
    showMenu();
    return;
  }
  const big = e.shiftKey ? 5 : 1; // hold Shift for bigger steps
  if (e.key === "ArrowLeft") game.setAngle(game.tank.angle + big);
  else if (e.key === "ArrowRight") game.setAngle(game.tank.angle - big);
  else if (e.key === "ArrowUp") game.setPower(game.tank.power + big);
  else if (e.key === "ArrowDown") game.setPower(game.tank.power - big);
  else if (e.key === "a" || e.key === "A") game.setMoveDir(-1);
  else if (e.key === "d" || e.key === "D") game.setMoveDir(1);
  else if (e.key >= "0" && e.key <= "9") {
    const owned = ownedWeapons();
    const n = e.key === "0" ? 9 : Number(e.key) - 1;       // 1-9 = weapons 1-9, 0 = weapon 10
    if (n < owned.length) game.setWeapon(owned[n]);
  }
  else if (e.key === " " || e.key === "Enter") {
    game.fire();
  } else if (e.key === "n" || e.key === "N") {
    rematch();
  } else return;
  e.preventDefault();
});

// ---- Post-game statistics ------------------------------------------------
const statsEl = document.getElementById("stats");
let statsDismissed = false, overSince = 0;

function weaponStars(st) {      // the weapon that won this player the most points
  let best = null;
  for (const name in st.weapons) {
    const w = st.weapons[name];
    if (w.points > 0 && (!best || w.points > best.points)) best = { name: name, points: w.points, uses: w.uses };
  }
  return best;
}

function renderStats() {
  const S = game.stats, T = game.tanks;
  const a = T[0].score, b = T[1].score;
  document.getElementById("statsWinner").textContent = a === b ? "IT'S A DRAW!" : game.winnerText().toUpperCase();
  const lead = (x, y, higherIsBetter) => (x === y ? [false, false] : higherIsBetter ? [x > y, y > x] : [x < y, y < x]);
  const rows = [];
  const add = (label, v0, v1, cmp, big, sub) => rows.push({ label, v: [v0, v1], win: cmp || [false, false], big: !!big, sub: sub || ["", ""] });
  add("Final score", a, b, lead(a, b, true), true);
  add("Shots fired", S[0].shots, S[1].shots);
  const acc = (i) => (S[i].shots ? Math.round((100 * S[i].hits) / S[i].shots) + "%" : "-");
  add("Hits", S[0].hits + " / " + S[0].shots, S[1].hits + " / " + S[1].shots, lead(S[0].hits, S[1].hits, true), false, [acc(0) + " accuracy", acc(1) + " accuracy"]);
  add("Damage dealt", S[0].damage, S[1].damage, lead(S[0].damage, S[1].damage, true), false,
      [S[0].dot ? S[0].dot + " from fire / fallout" : "", S[1].dot ? S[1].dot + " from fire / fallout" : ""]);
  add("Lost to own shots", S[0].self, S[1].self, lead(S[0].self, S[1].self, false));
  if (game.weather === "thunderstorm" || game.weather === "apocalypse") add("Lost to the storm", S[0].storm, S[1].storm, lead(S[0].storm, S[1].storm, false));
  const best = (i) => (S[i].best.gain > 0 ? "+" + S[i].best.gain : "-");
  add("Best shot", best(0), best(1), lead(S[0].best.gain, S[1].best.gain, true), false, [S[0].best.weapon, S[1].best.weapon]);
  const crater = (i) => (S[i].crater.px > 0 ? S[i].crater.px.toLocaleString("en-US") + " px" : "-");
  add("Most terrain destroyed", crater(0), crater(1), lead(S[0].crater.px, S[1].crater.px, true), false, [S[0].crater.weapon, S[1].crater.weapon]);
  const star = [weaponStars(S[0]), weaponStars(S[1])];
  add("Top weapon", star[0] ? star[0].name : "-", star[1] ? star[1].name : "-", [false, false], false,
      [star[0] ? "+" + star[0].points + " points" : "", star[1] ? "+" + star[1].points + " points" : ""]);
  const tricks = (i) => [S[i].buries ? S[i].buries + " buried" : "", S[i].freezes ? S[i].freezes + " frozen" : "", S[i].irradiated ? S[i].irradiated + " irradiated" : "", S[i].stunned ? S[i].stunned + " EMP" : ""].filter(Boolean).join(", ") || "-";
  add("Enemy tank hit by", tricks(0), tricks(1));
  const nm = (i) => shortName(i);
  let html = "<tr><th></th><th class='p0'>" + nm(0) + "</th><th class='p1'>" + nm(1) + "</th></tr>";
  for (const r of rows) {
    html += "<tr" + (r.big ? " class='big'" : "") + "><td class='lab'>" + r.label + "</td>";
    for (let i = 0; i < 2; i++) html += "<td class='p" + i + (r.win[i] ? " win" : "") + "'>" + r.v[i] + (r.sub[i] ? "<small>" + r.sub[i] + "</small>" : "") + "</td>";
    html += "</tr>";
  }
  document.getElementById("statsTable").innerHTML = html;
}

function updateStatsOverlay(now) {
  if (game.phase !== "over" || menuOpen || draftOpen) {
    overSince = 0;
    statsDismissed = false;
    statsEl.classList.add("hidden");
    return;
  }
  if (!overSince) overSince = now;
  if (!statsDismissed && now - overSince > 1800 && statsEl.classList.contains("hidden")) {
    renderStats();
    statsEl.classList.remove("hidden");
  }
}
document.getElementById("statsRematch").addEventListener("click", () => { statsEl.classList.add("hidden"); rematch(); });
document.getElementById("statsMenu").addEventListener("click", () => { statsEl.classList.add("hidden"); showMenu(); });
document.getElementById("statsClose").addEventListener("click", () => { statsDismissed = true; statsEl.classList.add("hidden"); });

// ---- The game loop: physics in fixed steps, drawing every frame -------
let last = performance.now();
let leftover = 0;
function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  leftover += elapsed;
  last = now;
  FX.update(elapsed, game);
  while (leftover >= STEP) {
    if (!menuOpen) game.update(STEP);
    leftover -= STEP;
  }
  Sound.observe(game, menuOpen || draftOpen);
  updateStatsOverlay(now);
  syncControls();
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
