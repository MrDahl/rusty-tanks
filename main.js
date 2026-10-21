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

// ---- The Ladder (rules and progress live in ladder.js) ----
let ladderMode = false;          // true while a ladder match is on
let ladderOutcome = null;        // what the finished match led to: advance / champion / retry / failed / draw
let ladderResolvedSeed = null;   // so a finished match is counted only once
let ladderMatchRung = -1;        // which rung the match on screen belongs to
const LADDER_KEY = "rustyTanksLadder";
function loadLadder() {
  try { return new LadderRun(JSON.parse(localStorage.getItem(LADDER_KEY))); } catch (e) { return new LadderRun(); }
}
function saveLadder() {
  try { localStorage.setItem(LADDER_KEY, JSON.stringify(ladder)); } catch (e) { /* not saved */ }
}
let ladder = loadLadder();

// "ai" tells the game who is a computer: [player 1, player 2]
function aiSetting() {
  if (ladderMode && ladder.current) return [null, ladder.current.ai];
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
  size = Math.round(size * hudK);
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
  if (!ai && game.names && game.names[i]) return game.names[i].toUpperCase();
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

  if (ladderMode && ladderMatchRung >= 0) {
    neonText("LADDER " + (ladderMatchRung + 1) + "/" + LADDER_RUNGS.length, W - 18, 78, NEON.amber, 9, "right");
  }

  if (game.phase === "over") {
    ctx.fillStyle = "rgba(4, 6, 20, 0.78)";
    ctx.fillRect(0, H / 2 - 80, W, 160);
    const a = game.tanks[0].score, b = game.tanks[1].score;
    const col = a === b ? NEON.amber : COLORS.tanks[a > b ? 0 : 1];
    neonText(game.winnerText().toUpperCase(), W / 2, H / 2 - 44, col, 30, "center");
    neonText(a + "  -  " + b, W / 2, H / 2 + 2, COLORS.text, 16, "center");
    neonText(ladderMode ? "N = CONTINUE    ESC = MENU" : "N = REMATCH    ESC = MENU", W / 2, H / 2 + 38, COLORS.textDim, 10, "center");
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
  document.getElementById("ladder").classList.add("hidden");
  updateLadderButton();
  menu.classList.remove("hidden");
}
function updateLadderButton() {
  document.getElementById("ladderBtn").textContent = ladder.rung > 0 && !ladder.done ? "RESUME LADDER" : "LADDER";
}

// Start button: go to the weapon draft
function startGame() {
  ladderMode = false;
  menu.classList.add("hidden");
  openDraft();
}

// New map, same weapons
let currentLoadouts = null;
function rematch() {
  if (ladderMode) {           // on the ladder, a finished match decides what comes next
    if (game.phase === "over" && ladderOutcome) ladderPrimary();
    return;
  }
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
const wiconEl = document.getElementById("wicon");
let lastWicon = -1;
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

// Weapon icons come from one picture (assets/weapon-icons.webp): 8 per row, in weapon order
const WICON_COLS = 8;
function setIcon(el, weaponIndex) {
  el.style.setProperty("--col", weaponIndex % WICON_COLS);
  el.style.setProperty("--row", Math.floor(weaponIndex / WICON_COLS));
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
    b.innerHTML = "<i class='wicon'></i><b></b><span></span><em></em>";
    setIcon(b.children[0], i);
    b.children[1].textContent = w.name;
    b.children[2].textContent = w.info;
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

function goFullscreenOnPhone() { if (document.body.classList.contains("mobile") && !document.fullscreenElement) enterFullscreen(); }
startButton.addEventListener("click", () => { goFullscreenOnPhone(); startGame(); });

// Quick Play: no draft. Both sides get 10 random weapons from a fresh pool (the computer-friendly ones are more likely)
// Both sides get 10 random weapons from a fresh pool (the computer-friendly ones are more likely)
function randomLoadouts() {
  draft.pool = makePool();
  draft.picks = [[], []];
  while (!draftDone()) {
    const who = drafter();
    const avail = availableWeapons();
    draft.picks[who].push(aiDraftPick(avail, Math.random));
  }
  return [draft.picks[0].slice(), draft.picks[1].slice()];
}
document.getElementById("quick").addEventListener("click", () => {
  goFullscreenOnPhone();
  ladderMode = false;
  menu.classList.add("hidden");
  currentLoadouts = randomLoadouts();
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
  if (t.weapon !== lastWicon) { lastWicon = t.weapon; setIcon(wiconEl, t.weapon); }
  // touch controls
  tAngle.textContent = Math.round(t.angle) + "\u00B0";
  tPower.textContent = Math.round(t.power);
  controlsEl.classList.toggle("locked-angle", !!lk.angle);
  controlsEl.classList.toggle("locked-power", !!lk.power);
  for (const b of stepButtons) b.disabled = !canAim || (b.dataset.k === "angle" ? !!lk.angle : !!lk.power);
  driveL.disabled = driveR.disabled = !canAim || !!lk.drive;
  document.body.classList.toggle("inmenu", menuOpen || draftOpen || !document.getElementById("stats").classList.contains("hidden"));
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

// ---- Touch controls ----------------------------------------------------
const tAngle = document.getElementById("tAngle"), tPower = document.getElementById("tPower");
const stepButtons = Array.from(document.querySelectorAll("#touch .step"));
const driveL = document.getElementById("driveL"), driveR = document.getElementById("driveR");

// - / + buttons: tap for one step, hold to keep going (faster the longer you hold)
for (const b of stepButtons) {
  const dir = Number(b.dataset.d), kind = b.dataset.k;
  let delay = null, iv = null, n = 0;
  const doStep = () => {
    const k = 1 + Math.min(4, Math.floor(n / 8));
    n++;
    if (kind === "angle") game.setAngle(game.tank.angle + dir * k);
    else game.setPower(game.tank.power + dir * k);
    syncControls();
  };
  const stop = () => { clearTimeout(delay); clearInterval(iv); delay = iv = null; };
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    stop(); n = 0; doStep();
    delay = setTimeout(() => { iv = setInterval(doStep, 70); }, 350);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
}

// Drag on the battlefield to aim: the barrel points at your finger (or the held-down mouse),
// and the farther the finger is from the tank, the more power. Firing stays on the FIRE button.
{
  const POWER_REACH = 300;   // game pixels from the barrel pivot that mean 100 % power
  let drag = null;
  canvas.style.touchAction = "none";
  const aimAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const gx = ((e.clientX - r.left) / r.width) * canvas.width;
    const gy = ((e.clientY - r.top) / r.height) * canvas.height;
    const t = game.tank;
    const dx = gx - t.x, dy = (t.y - BARREL_PIVOT) - gy;   // dy > 0 = finger above the barrel
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;        // -180..180, 90 = straight up
    if (ang < 0) ang = dx >= 0 ? 0 : 180;                   // below the horizon: lay the barrel flat
    game.setAngle(Math.round(ang));
    game.setPower(Math.round((Math.hypot(dx, dy) / POWER_REACH) * 100));
    syncControls();
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (titleOpen || menuOpen || draftOpen || game.phase !== "aim" || game.isAiTurn) return;
    drag = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    e.preventDefault();
    aimAt(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag !== e.pointerId) return;       // a mouse that is not held down does nothing
    if (game.phase !== "aim" || game.isAiTurn) { drag = null; return; }
    aimAt(e);
  });
  const end = (e) => { if (drag === e.pointerId) drag = null; };   // values simply stay where they were
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

// Settings pop-up (the three-bar button)
document.getElementById("gear").addEventListener("click", (e) => { e.stopPropagation(); controlsEl.classList.toggle("open"); });
document.addEventListener("pointerdown", (e) => {
  if (!controlsEl.classList.contains("open")) return;
  if (e.target.closest(".opts") || e.target.closest("#gear")) return;
  controlsEl.classList.remove("open");
});
for (const id of ["newgame", "menubtn", "fullscreen"]) document.getElementById(id).addEventListener("click", () => controlsEl.classList.remove("open"));
document.addEventListener("contextmenu", (e) => { if (document.body.classList.contains("mobile")) e.preventDefault(); });

// Retro FX: rain, lightning and scanlines can be switched off (remembered between visits)
function applyFx() {
  FX.enabled = fxBox.checked;
  document.getElementById("stage").classList.toggle("crt", fxBox.checked);
  try { localStorage.setItem("rustyTanksFx", fxBox.checked ? "1" : "0"); } catch (e) { /* not saved */ }
}
try { if (localStorage.getItem("rustyTanksFx") === "0") fxBox.checked = false; } catch (e) { /* default: on */ }
fxBox.addEventListener("change", applyFx);
applyFx();

// ---- Layout: scale the game to fit the window ----
// Desktop: one 960 x 650 frame (battlefield + control panel). Touch devices: the battlefield fills the
// screen and the controls float on top of it (see "Phones and tablets" in index.html).
const gameFrame = document.getElementById("game");
const touchQuery = window.matchMedia ? window.matchMedia("(pointer: coarse)") : { matches: false };
function wantMobile() {
  const q = new URLSearchParams(location.search).get("mobile");
  if (q === "1") return true;
  if (q === "0") return false;
  return touchQuery.matches;
}
let hudK = 1;     // arcade text is drawn a bit bigger on small screens
function fitGame() {
  const mobile = wantMobile();
  const portrait = window.innerHeight > window.innerWidth;
  document.body.classList.toggle("mobile", mobile);
  document.body.classList.toggle("portrait", mobile && portrait);
  if (mobile) {
    const s = portrait ? window.innerWidth / 960 : Math.min(window.innerWidth / 960, window.innerHeight / 540);
    gameFrame.style.setProperty("--ms", s.toFixed(4));
    hudK = Math.max(1, Math.min(1.7, 0.78 / s));
  } else {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 650);
    gameFrame.style.setProperty("--scale", s.toFixed(4));
    hudK = 1;
  }
  const rh = document.getElementById("fsHint");
  if (rh) {
    rh.textContent = !mobile ? "" : portrait ? "Tip: turn your phone sideways for a bigger battlefield."
      : rh.dataset.ios ? "Tip: Share > Add to Home Screen to play fullscreen." : "";
  }
}
window.addEventListener("resize", fitGame);
window.addEventListener("orientationchange", fitGame);
if (touchQuery.addEventListener) touchQuery.addEventListener("change", fitGame);
fitGame();
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else enterFullscreen();
  } catch (e) { /* not supported */ }
}
// Fullscreen, and on phones also lock the screen to landscape (both only work from a tap)
function enterFullscreen() {
  const el = document.documentElement;
  if (!el.requestFullscreen) return;
  const p = el.requestFullscreen({ navigationUI: "hide" });
  const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); } catch (e) { /* not allowed */ } };
  if (p && p.then) p.then(lock).catch(() => {});
}
const fsSupported = !!document.documentElement.requestFullscreen;
{
  const hint = document.getElementById("fsHint");
  const btn = document.getElementById("menuFs");
  if (!fsSupported) { btn.style.display = "none"; }
  btn.addEventListener("click", () => { toggleFullscreen(); });
  document.addEventListener("fullscreenchange", () => { btn.textContent = document.fullscreenElement ? "\u26F6 Leave fullscreen" : "\u26F6 Go fullscreen"; fitGame(); });
  if (!fsSupported && hint) hint.dataset.ios = "1";
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
      if (!document.getElementById("ladder").classList.contains("hidden")) document.getElementById("ladderFight").click();
      else startGame();
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
  const lm = ladderMode && ladderOutcome ? ladderMessage() : null;
  document.getElementById("statsLadder").textContent = lm ? lm.text : "";
  document.getElementById("statsRematch").textContent = lm ? lm.button : "Rematch";
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
// (the ladder code below decides what Rematch means while a ladder match is on)
document.getElementById("statsMenu").addEventListener("click", () => { statsEl.classList.add("hidden"); showMenu(); });
document.getElementById("statsClose").addEventListener("click", () => { statsDismissed = true; statsEl.classList.add("hidden"); });

// ---- The Ladder screen and match flow ---------------------------------------
const ladderEl = document.getElementById("ladder");
const ladderFight = document.getElementById("ladderFight");
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function renderLadder(note) {
  const dots = (n) => "\u25CF".repeat(n) + "\u25CB".repeat(LADDER_CONTINUES - n);
  let html = "";
  LADDER_RUNGS.forEach((r, i) => {
    const cls = i < ladder.rung ? "done" : i === ladder.rung ? "next" : "locked";
    const res = ladder.results[i];
    const state = cls === "done" ? "CLEARED" + (res ? "<br>" + res.you + " - " + res.cpu : "") : cls === "next" ? "NEXT" : "LOCKED";
    html += "<div class='rung " + cls + "'><div class='num'>" + (i + 1) + "</div><div class='who'><b>" + r.name.toUpperCase() + "</b><span>" +
      capital(r.ai) + " computer &middot; " + SEASON_NAMES[r.season] + " &middot; " + WIND_WORDS[r.wind] + "</span></div><div class='state'>" + state + "</div></div>";
  });
  document.getElementById("rungs").innerHTML = html;
  const sub = document.getElementById("ladderSub"), quip = document.getElementById("ladderQuip");
  if (ladder.done) {
    sub.textContent = "CHAMPION! You beat all " + LADDER_RUNGS.length + " opponents" + (ladder.titles > 1 ? " (" + ladder.titles + " titles)" : "") + ".";
    quip.textContent = "Start a new ladder to do it all again.";
    ladderFight.textContent = "NEW LADDER";
  } else {
    sub.textContent = note || "Match " + (ladder.rung + 1) + " of " + LADDER_RUNGS.length + "   Continues " + dots(ladder.continues);
    quip.textContent = ladder.current.name + ": " + ladder.current.quip;
    ladderFight.textContent = ladder.rung === 0 && !ladder.results.some(Boolean) ? "START LADDER" : "FIGHT!";
  }
}

function showLadder(note) {
  menuOpen = true;
  menu.classList.add("hidden");
  statsEl.classList.add("hidden");
  renderLadder(note);
  ladderEl.classList.remove("hidden");
}

// A new ladder match: random weapons for both sides, the world of the current rung
function ladderNewMatch() {
  const r = ladder.current;
  if (!r) return;
  goFullscreenOnPhone();
  ladderMode = true;
  ladderOutcome = null;
  ladderMatchRung = ladder.rung;
  ladderEl.classList.add("hidden");
  menu.classList.add("hidden");
  statsEl.classList.add("hidden");
  currentLoadouts = randomLoadouts();
  game.newMatch(Date.now(), aiSetting(), [currentLoadouts[0].slice(), currentLoadouts[1].slice()], r.season, { windScale: r.wind, names: [null, r.name] });
  menuOpen = false;
}

// The match on screen has ended: count it once
function resolveLadder() {
  if (!ladderMode || game.phase !== "over" || ladderResolvedSeed === game.seed) return;
  ladderResolvedSeed = game.seed;
  ladderOutcome = ladder.finish(game.tanks[0].score, game.tanks[1].score);
  saveLadder();
}

function ladderMessage() {
  const n = LADDER_RUNGS.length;
  switch (ladderOutcome) {
    case "advance": return { text: "MATCH " + (ladderMatchRung + 1) + "/" + n + " CLEARED - NEXT: " + ladder.current.name.toUpperCase(), button: "Next match" };
    case "champion": return { text: "LADDER CLEARED - YOU ARE THE CHAMPION!", button: "Ladder" };
    case "retry": return { text: "YOU LOST - " + ladder.continues + " CONTINUE" + (ladder.continues === 1 ? "" : "S") + " LEFT", button: "Retry match" };
    case "failed": return { text: "OUT OF CONTINUES - THE LADDER STARTS OVER", button: "Start over" };
    default: return { text: "A DRAW - PLAY IT AGAIN", button: "Rematch" };
  }
}

// What the main button on the battle report (or the N key) does on the ladder
function ladderPrimary() {
  switch (ladderOutcome) {
    case "retry": case "draw": ladderNewMatch(); break;
    case "failed": showLadder("The ladder starts over. Beat all " + LADDER_RUNGS.length + " opponents to win."); break;
    default: showLadder();
  }
}

document.getElementById("ladderBtn").addEventListener("click", () => showLadder());
updateLadderButton();
ladderFight.addEventListener("click", () => {
  if (ladder.done) { ladder.restart(); saveLadder(); renderLadder(); return; }
  ladderNewMatch();
});
document.getElementById("ladderBack").addEventListener("click", showMenu);

// ---- Title screen: the logo drops in, any key / click / tap goes on to the menu (?title=0 skips it) ----
const titleEl = document.getElementById("title");
let titleOpen = new URLSearchParams(location.search).get("title") !== "0";
if (!titleOpen) titleEl.style.display = "none";
else {
  gameFrame.classList.add("titleOn");
  for (let i = 0; i < 26; i++) {     // glowing embers drifting up behind the logo
    const e = document.createElement("span");
    e.className = "ember";
    e.style.left = Math.round(Math.random() * 100) + "%";
    e.style.setProperty("--dx", Math.round(Math.random() * 120 - 60) + "px");
    e.style.animationDuration = (4 + Math.random() * 5).toFixed(1) + "s";
    e.style.animationDelay = (Math.random() * 6).toFixed(1) + "s";
    if (Math.random() < 0.4) e.style.background = "#ffe066";
    titleEl.appendChild(e);
  }
  setTimeout(() => { if (titleOpen) FX.shake = 12; }, 550);      // the logo lands with a thump
}
function closeTitle() {
  if (!titleOpen) return;
  titleOpen = false;
  try { Sound.unlock(); } catch (e) { /* sound is optional */ }
  titleEl.classList.add("gone");
  gameFrame.classList.remove("titleOn");
  setTimeout(() => { titleEl.style.display = "none"; }, 600);
}
titleEl.addEventListener("pointerdown", closeTitle);
window.addEventListener("keydown", (e) => {     // runs first, so the key that closes the title does nothing else
  if (!titleOpen) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closeTitle();
}, true);

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
  resolveLadder();
  updateStatsOverlay(now);
  syncControls();
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
