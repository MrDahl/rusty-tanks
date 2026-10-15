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

// Menu choices (what the player picked on the menu)
const settings = { mode: "cpu", difficulty: "normal" };
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

// ---- Colours (the "rusty" look lives here) ---------------------------
const COLORS = {
  tanks: ["#7fa6b3", "#d9a441"],
  tankDark: "#2b2b2b",
  text: "#f2e6d0",
  textDim: "#b9a88c",
};

// ---- Terrain is painted once into a hidden canvas, then reused -------
const terrainCanvas = document.createElement("canvas");
terrainCanvas.width = W;
terrainCanvas.height = H;
const terrainCtx = terrainCanvas.getContext("2d");
let paintedVersion = -1;

function paintTerrain() {
  const img = terrainCtx.createImageData(W, H);
  const data = img.data;
  const mask = game.terrain.mask;
  for (let x = 0; x < W; x++) {
    let depth = 0; // how far below the surface this pixel is
    for (let y = 0; y < H; y++) {
      if (mask[y * W + x] !== 1) {
        depth = 0;
        continue;
      }
      const i = (y * W + x) * 4;
      const grain = ((x * 7 + y * 13) % 11) - 5; // tiny speckle
      let r, g, b;
      if (depth < 4) {
        r = 190; g = 92; b = 44;                  // bright rusty top layer
      } else {
        const dark = Math.min(1, depth / 260);    // darker the deeper it goes
        r = 150 - 70 * dark;
        g = 74 - 40 * dark;
        b = 38 - 18 * dark;
      }
      data[i] = r + grain;
      data[i + 1] = g + grain * 0.6;
      data[i + 2] = b + grain * 0.4;
      data[i + 3] = 255;
      depth++;
    }
  }
  terrainCtx.putImageData(img, 0, 0);
  paintedVersion = game.terrain.version;
}

// ---- Drawing helpers --------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a1d1a");
  g.addColorStop(0.6, "#7a3d2a");
  g.addColorStop(1, "#d98a4a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a hazy sun
  ctx.fillStyle = "rgba(255, 214, 150, 0.35)";
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.62, 70, 0, Math.PI * 2);
  ctx.fill();
}

function drawTank(t, index, active) {
  const x = t.x;
  const y = t.y;
  const color = COLORS.tanks[index];

  // barrel
  const a = (t.angle * Math.PI) / 180;
  ctx.strokeStyle = COLORS.tankDark;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x + Math.cos(a) * 20, y - 9 - Math.sin(a) * 20);
  ctx.stroke();

  // tracks
  ctx.fillStyle = COLORS.tankDark;
  ctx.fillRect(x - 15, y - 6, 30, 7);
  // body
  ctx.fillStyle = color;
  ctx.fillRect(x - 12, y - 12, 24, 7);
  // turret
  ctx.beginPath();
  ctx.arc(x, y - 12, 7, Math.PI, 0);
  ctx.fill();

  // little arrow above the active tank
  if (active && game.phase === "aim") {
    ctx.fillStyle = COLORS.text;
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x - 6, y - 50);
    ctx.lineTo(x + 6, y - 50);
    ctx.closePath();
    ctx.fill();
  }
}

function drawAimGuide() {
  if (!guideBox.checked || game.phase !== "aim" || game.isAiTurn || menuOpen) return;
  const pts = game.predictPath(120); // about 2 seconds of flight
  ctx.fillStyle = "rgba(242, 230, 208, 0.75)";
  for (let i = 4; i < pts.length; i += 5) {
    ctx.fillRect(pts[i].x - 1.5, pts[i].y - 1.5, 3, 3);
  }
}

function drawExplosions() {
  for (const e of game.explosions) {
    const k = Math.min(1, e.t / BOOM_TIME);
    const r = e.r * (0.4 + 0.9 * Math.min(1, k * 3));
    const alpha = 1 - k;
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    if (e.kind === "dirt") {
      g.addColorStop(0, "rgba(200, 140, 90, " + alpha * 0.8 + ")");
      g.addColorStop(1, "rgba(120, 70, 40, 0)");
    } else {
      g.addColorStop(0, "rgba(255, 245, 200, " + alpha + ")");
      g.addColorStop(0.5, "rgba(255, 140, 40, " + alpha * 0.9 + ")");
      g.addColorStop(1, "rgba(120, 30, 10, 0)");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShells() {
  for (const p of game.projs) {
    if (p.delay > 0) continue; // volley/rain shells that haven't launched yet
    const small = p.w.name === "fragment";
    ctx.fillStyle = p.w.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, small ? 2.5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function shortName(i) {
  if (!game.ai[i]) return "P" + (i + 1);
  return "CPU (" + game.ai[i] + ")";
}

function drawHud() {
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.textBaseline = "top";

  // scores
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.tanks[0];
  ctx.fillText(shortName(0) + "  " + game.tanks[0].score, 16, 12);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.tanks[1];
  ctx.fillText(game.tanks[1].score + "  " + shortName(1), W - 16, 12);

  // shots left
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = "left";
  ctx.fillText("shots left: " + (game.shotLimit - game.shotsFired[0]), 16, 38);
  ctx.textAlign = "right";
  ctx.fillText("shots left: " + (game.shotLimit - game.shotsFired[1]), W - 16, 38);

  // wind
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 16px 'Courier New', monospace";
  const w = game.wind;
  ctx.fillText("WIND " + (w === 0 ? "calm" : Math.abs(w)), W / 2, 12);
  if (w !== 0) {
    const len = Math.abs(w) * 3;
    const dir = Math.sign(w);
    const cx = W / 2;
    const cy = 42;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 8, cy - 5);
    ctx.moveTo(cx + (dir * len) / 2, cy);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 8, cy + 5);
    ctx.stroke();
  }

  // message and turn
  ctx.font = "bold 18px 'Courier New', monospace";
  if (game.phase === "aim") {
    ctx.fillStyle = COLORS.tanks[game.current];
    ctx.fillText(game.isAiTurn ? "Computer is thinking..." : game.playerName(game.current) + ", take aim!", W / 2, 66);
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(game.weapon.name + " - " + game.weapon.info, W / 2, 90);
    if (!game.isAiTurn) ctx.fillText("Drive left: " + Math.round(game.moveLeft) + " px  (A / D)", W / 2, 110);
  } else if (game.lastHit) {
    ctx.fillStyle = COLORS.text;
    ctx.fillText(game.lastHit, W / 2, 66);
  }

  if (game.phase === "over") {
    ctx.fillStyle = "rgba(20, 12, 10, 0.75)";
    ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 44px 'Courier New', monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(game.winnerText(), W / 2, H / 2 - 14);
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText("New Game (N) to play again, Menu (Esc) to change settings", W / 2, H / 2 + 30);
  }
}

function draw() {
  if (paintedVersion !== game.terrain.version) paintTerrain();
  drawSky();
  ctx.drawImage(terrainCanvas, 0, 0);
  game.tanks.forEach((t, i) => drawTank(t, i, i === game.current));
  drawAimGuide();
  drawShells();
  drawExplosions();
  drawHud();
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
  game.newMatch(Date.now(), aiSetting(), currentLoadouts ? [currentLoadouts[0].slice(), currentLoadouts[1].slice()] : undefined);
}

// ---- Weapon draft --------------------------------------------------------
// Players take turns picking weapons (P1, P2, P1, ...). Both may pick the same weapon, and
// the same player may pick one more than once. Each pick is one use in the battle.
const PICKS_EACH = 10;
const draftSection = document.getElementById("draft");
const stageEl = document.getElementById("stage");
const controlsEl = document.getElementById("controls");
const helpEl = document.getElementById("help");
const draftGo = document.getElementById("draftGo");
const draft = { picks: [[], []], token: 0 };
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

function buildWeaponGrid() {
  const grid = document.getElementById("weaponGrid");
  grid.innerHTML = "";
  WEAPONS.forEach((w, i) => {
    const b = document.createElement("button");
    b.className = "wcard";
    b.style.borderLeftColor = w.color;
    b.innerHTML = "<b></b><span></span>";
    b.firstChild.textContent = w.name;
    b.lastChild.textContent = w.info;
    b.addEventListener("click", () => draftPick(i));
    grid.appendChild(b);
  });
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
  for (const b of document.querySelectorAll("#weaponGrid button")) b.disabled = !humanTurn;
  document.getElementById("draftRandom").disabled = !humanTurn;
  draftGo.disabled = !draftDone();
}

function draftPick(i) {
  if (draftDone() || aiSetting()[drafter()]) return;
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
    draft.picks[p].push(aiDraftPick(draft.picks[p], Math.random));
    renderDraft();
    draftAiTurn();
  }, 450);
}

function openDraft() {
  draft.picks = [[], []];
  draft.token++;
  draftOpen = true;
  stageEl.style.display = "none";
  controlsEl.style.display = "none";
  helpEl.style.display = "none";
  draftSection.classList.remove("hidden");
  buildWeaponGrid();
  renderDraft();
  draftAiTurn();
}

function closeDraft() {
  draftOpen = false;
  draft.token++;
  draftSection.classList.add("hidden");
  stageEl.style.display = "";
  controlsEl.style.display = "";
  helpEl.style.display = "";
}

document.getElementById("draftBack").addEventListener("click", () => {
  closeDraft();
  showMenu();
});

// "Random picks for me": fill in all remaining picks of the player whose turn it is
document.getElementById("draftRandom").addEventListener("click", () => {
  const p = drafter();
  if (aiSetting()[p]) return;
  while (draft.picks[p].length < PICKS_EACH) draft.picks[p].push(Math.floor(Math.random() * WEAPONS.length));
  renderDraft();
  draftAiTurn();
});

draftGo.addEventListener("click", () => {
  if (!draftDone()) return;
  currentLoadouts = [draft.picks[0].slice(), draft.picks[1].slice()];
  closeDraft();
  game.newMatch(Date.now(), aiSetting(), [currentLoadouts[0].slice(), currentLoadouts[1].slice()]);
  menuOpen = false;
});

startButton.addEventListener("click", startGame);
menuButton.addEventListener("click", showMenu);

// ---- Controls ---------------------------------------------------------
function syncControls() {
  const t = game.tank;
  angleSlider.value = t.angle;
  powerSlider.value = t.power;
  angleLabel.textContent = Math.round(t.angle) + "°";
  powerLabel.textContent = Math.round(t.power);
  const canAim = game.phase === "aim" && !game.isAiTurn && !menuOpen;
  angleSlider.disabled = !canAim;
  powerSlider.disabled = !canAim;
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
  else if (e.key >= "1" && e.key <= "9") {
    const owned = ownedWeapons();
    const n = Number(e.key) - 1;
    if (n < owned.length) game.setWeapon(owned[n]);
  }
  else if (e.key === " " || e.key === "Enter") {
    game.fire();
  } else if (e.key === "n" || e.key === "N") {
    rematch();
  } else return;
  e.preventDefault();
});

// ---- The game loop: physics in fixed steps, drawing every frame -------
let last = performance.now();
let leftover = 0;
function frame(now) {
  leftover += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (leftover >= STEP) {
    if (!menuOpen) game.update(STEP);
    leftover -= STEP;
  }
  syncControls();
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
