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

let game = new Game();

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
  if (!guideBox.checked || game.phase !== "aim") return;
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

function drawHud() {
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.textBaseline = "top";

  // scores
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.tanks[0];
  ctx.fillText("P1  " + game.tanks[0].score, 16, 12);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.tanks[1];
  ctx.fillText(game.tanks[1].score + "  P2", W - 16, 12);

  // shots left
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = "left";
  ctx.fillText("shots left: " + (SHOTS_PER_PLAYER - game.shotsFired[0]), 16, 38);
  ctx.textAlign = "right";
  ctx.fillText("shots left: " + (SHOTS_PER_PLAYER - game.shotsFired[1]), W - 16, 38);

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
    ctx.fillText("Player " + (game.current + 1) + ", take aim!", W / 2, 66);
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(game.weapon.name + " - " + game.weapon.info, W / 2, 90);
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
    ctx.fillText("Press New Game (or N) to play again", W / 2, H / 2 + 30);
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

// ---- Controls ---------------------------------------------------------
function syncControls() {
  const t = game.tank;
  angleSlider.value = t.angle;
  powerSlider.value = t.power;
  angleLabel.textContent = Math.round(t.angle) + "°";
  powerLabel.textContent = Math.round(t.power);
  const canAim = game.phase === "aim";
  angleSlider.disabled = !canAim;
  powerSlider.disabled = !canAim;
  fireButton.disabled = !canAim;
  syncWeaponList();
}

// Rebuild the weapon list only when something changed (so an open dropdown isn't disturbed)
let weaponSignature = "";
function syncWeaponList() {
  const t = game.tank;
  const sig = game.current + ":" + t.weapon + ":" + game.ammo[game.current].join(",") + ":" + game.phase;
  if (sig === weaponSignature) return;
  weaponSignature = sig;
  weaponSelect.innerHTML = "";
  WEAPONS.forEach((w, i) => {
    const left = game.ammo[game.current][i];
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = (i + 1) + ". " + w.name + (left === Infinity ? "" : " (" + left + ")");
    opt.disabled = left <= 0;
    weaponSelect.appendChild(opt);
  });
  weaponSelect.value = t.weapon;
  weaponSelect.disabled = game.phase !== "aim";
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
newButton.addEventListener("click", () => {
  game.newMatch(Date.now());
});

window.addEventListener("keydown", (e) => {
  const big = e.shiftKey ? 5 : 1; // hold Shift for bigger steps
  if (e.key === "ArrowLeft") game.setAngle(game.tank.angle + big);
  else if (e.key === "ArrowRight") game.setAngle(game.tank.angle - big);
  else if (e.key === "ArrowUp") game.setPower(game.tank.power + big);
  else if (e.key === "ArrowDown") game.setPower(game.tank.power - big);
  else if (e.key >= "1" && e.key <= "9") game.setWeapon(Number(e.key) - 1);
  else if (e.key === " " || e.key === "Enter") {
    game.fire();
  } else if (e.key === "n" || e.key === "N") {
    game.newMatch(Date.now());
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
    game.update(STEP);
    leftover -= STEP;
  }
  syncControls();
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
