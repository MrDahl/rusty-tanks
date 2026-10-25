// ---------------------------------------------------------------
//  The tank pictures: drawn as SVG (vector art) in code, one blue and one red tank.
//  Each tank is two pictures: the body with its turret (flipped when the tank faces left) and
//  the barrel, which turns around the same point the shells fly out from.
//  Sizes are in game pixels. The pictures are made once, at 4x size, so they stay crisp.
//
//  To change how a tank looks, edit the colours in TANK_PALETTES or the shapes in bodySVG / barrelSVG.
//  Untick "New tanks" in the settings (or add ?tanks=classic to the address) to get the old pixel tanks back.
// ---------------------------------------------------------------
const TankArt = (function () {
  const SS = 4;   // how much bigger the pictures are made than they are drawn
  const TANK_PALETTES = [
    { hi: "#7fc4ff", mid: "#3a78c4", lo: "#1d3f78", glow: "#35f2ff", rust: "#c0661f" },   // blue tank
    { hi: "#ff9a8a", mid: "#c23a3a", lo: "#7a1d2e", glow: "#ff3df0", rust: "#d98a2b" },   // red tank
  ];
  const DARK = "#070c1e";

  // Body + turret. Drawing area 56 x 40, the ground is at y = 38, the middle of the tank at x = 28.
  function bodySVG(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40">' +
      '<defs>' +
      '<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p.hi + '"/><stop offset="0.45" stop-color="' + p.mid + '"/><stop offset="1" stop-color="' + p.lo + '"/></linearGradient>' +
      '</defs>' +
      // tracks, road wheels and track pads
      '<rect x="5" y="29" width="46" height="9" rx="4.5" fill="#0c1430" stroke="' + DARK + '" stroke-width="1"/>' +
      '<rect x="6" y="29.6" width="44" height="7.8" rx="3.9" fill="none" stroke="#2a3a66" stroke-width="0.8" stroke-dasharray="1.6 1.2"/>' +
      [10.5, 19, 27.5, 36, 44.5].map((x, i) => '<circle cx="' + x + '" cy="33.6" r="' + (i === 0 || i === 4 ? 3.1 : 2.7) + '" fill="#3b4f80" stroke="' + DARK + '" stroke-width="0.9"/><circle cx="' + x + '" cy="33.6" r="1" fill="' + DARK + '"/>').join("") +
      // hull with a sloped front
      '<polygon points="7,31 9,23 14,21 40,21 48,25 50,31" fill="url(#h)" stroke="' + DARK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<polyline points="10,24 14,22.2 40,22.2 47,25.6" fill="none" stroke="' + p.hi + '" stroke-width="0.9" opacity="0.7"/>' +
      '<path d="M12 27.5h30M44 27l4 0" stroke="' + p.lo + '" stroke-width="0.9" fill="none"/>' +
      '<rect x="46.4" y="26.2" width="2.4" height="1.6" fill="#ffe28a"/>' +
      [13, 22, 33, 42].map((x) => '<circle cx="' + x + '" cy="29.3" r="0.7" fill="' + p.lo + '"/>').join("") +
      // turret
      '<polygon points="19,24 20,15.5 24,11.5 35,11.5 39,16 40,24" fill="url(#h)" stroke="' + DARK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<polyline points="21.2,16 24.6,12.7 34.4,12.7 37.8,16.4" fill="none" stroke="' + p.hi + '" stroke-width="0.9" opacity="0.75"/>' +
      '<ellipse cx="29" cy="11.5" rx="3.2" ry="1.3" fill="' + p.lo + '" stroke="' + DARK + '" stroke-width="0.8"/>' +
      '<path d="M22 20.5h16" stroke="' + p.lo + '" stroke-width="0.9"/>' +
      // antenna with a glowing tip
      '<line x1="22.5" y1="13.5" x2="20.2" y2="3.4" stroke="' + DARK + '" stroke-width="1.1"/>' +
      '<circle cx="20.2" cy="3.4" r="3" fill="' + p.glow + '" opacity="0.3"/><circle cx="20.2" cy="3.4" r="1.5" fill="' + p.glow + '"/>' +
      // rust: little patches, like in the logo
      [[11.5, 25, 2.2, 1.6], [30, 23.5, 1.6, 2.2], [37.5, 22.6, 2.2, 1.5], [22.5, 17.5, 2, 1.5], [33, 14.5, 1.6, 1.6], [43, 27.4, 2.2, 1.5], [16, 28, 1.5, 1.5], [26, 21.6, 1.5, 1.2], [37, 18.6, 1.5, 1.8]]
        .map((r) => '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" fill="' + p.rust + '" opacity="0.85"/>').join("") +
      '</svg>';
  }

  // The barrel, lying along +x. The middle of the round mantlet is the turning point: it sits at (5, 5).
  function barrelSVG(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="10" viewBox="-5 -5 36 10">' +
      '<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p.hi + '"/><stop offset="0.5" stop-color="' + p.mid + '"/><stop offset="1" stop-color="' + p.lo + '"/></linearGradient></defs>' +
      '<rect x="0" y="-2.4" width="22" height="4.8" fill="url(#b)" stroke="' + DARK + '" stroke-width="1"/>' +
      '<rect x="19.5" y="-3.4" width="5.6" height="6.8" rx="1" fill="' + p.lo + '" stroke="' + DARK + '" stroke-width="1"/>' +
      '<path d="M21.2 -3v6M23.2 -3v6" stroke="' + DARK + '" stroke-width="0.7"/>' +
      '<line x1="1.5" y1="-1.3" x2="18.5" y2="-1.3" stroke="#fff" stroke-width="0.7" opacity="0.4"/>' +
      '<rect x="9" y="-1.6" width="2.4" height="1.4" fill="' + p.rust + '" opacity="0.85"/>' +
      '<circle cx="0" cy="0" r="4.2" fill="' + p.mid + '" stroke="' + DARK + '" stroke-width="1.1"/>' +
      '<circle cx="0" cy="0" r="1.6" fill="' + DARK + '"/>' +
      '</svg>';
  }

  const sprites = [];
  function make(svg, w, h) {
    const cv = document.createElement("canvas");
    cv.width = w * SS; cv.height = h * SS;
    const rec = { cv: cv, ready: false };
    const img = new Image();
    img.onload = () => { cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); rec.ready = true; };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return rec;
  }
  function get(index) {
    if (!sprites[index]) {
      const p = TANK_PALETTES[index % TANK_PALETTES.length];
      sprites[index] = { body: make(bodySVG(p), 56, 40), barrel: make(barrelSVG(p), 36, 10) };
    }
    return sprites[index];
  }

  return {
    TANK_PALETTES: TANK_PALETTES, bodySVG: bodySVG, barrelSVG: barrelSVG,
    ready(index) { const s = get(index); return s.body.ready && s.barrel.ready; },
    // Draws the tank with its middle on the ground at (0, 0): the caller has already moved the canvas there.
    draw(ctx, index, angleDeg, pivotHeight, glowColor, glow) {
      const s = get(index);
      if (!(s.body.ready && s.barrel.ready)) return false;
      const left = angleDeg > 90;
      ctx.save();
      ctx.shadowColor = glowColor; ctx.shadowBlur = glow;
      // body (mirrored when the tank looks to the left)
      ctx.save();
      if (left) ctx.scale(-1, 1);
      ctx.drawImage(s.body.cv, -28, -38, 56, 40);
      ctx.restore();
      // barrel, turning around the turret
      ctx.translate(0, -pivotHeight);
      ctx.rotate((-angleDeg * Math.PI) / 180);
      if (left) ctx.scale(1, -1);   // keep the light side of the barrel on top
      ctx.drawImage(s.barrel.cv, -5, -5, 36, 10);
      ctx.restore();
      return true;
    },
  };
})();
if (typeof module !== "undefined") module.exports = TankArt;
