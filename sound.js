// =====================================================================
//  RUSTY TANKS - sound
//  Everything you hear is made on the fly with the browser's Web Audio
//  (oscillators and noise). There are no sound files at all.
//
//  1. Sound effects: every weapon has its own launch sound and every
//     explosion style (see "fx" in weapons.js) has its own boom.
//  2. Music: a tracker-style chiptune, a bit like the old keygen tunes:
//     fast arpeggios, a bouncy bass, pulse-wave lead and noise drums.
//     One track for the menus, one faster track for the battle.
//
//  main.js only calls Sound.observe(game, inMenu) once per frame. This
//  file watches the game and plays whatever happened.
//  Keys: M = music on/off.
// =====================================================================
const Sound = (function () {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  let ctx = null, master = null, sfxBus = null, musBus = null, duckBus = null, echoIn = null;
  let noiseBuf = null, brownBuf = null;
  const waves = {};
  let sfxOn = true, musicOn = true;
  const MASTER_VOL = 0.8, SFX_VOL = 0.85, MUSIC_VOL = 0.38;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------------------------------------------------------------
  //  Audio graph
  // ---------------------------------------------------------------
  // Builds the mixer on any audio context (a real one in the browser, an offline one in tests)
  function attach(context) {
    ctx = context;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = MASTER_VOL;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? SFX_VOL : 0; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? MUSIC_VOL : 0; musBus.connect(master);
    duckBus = ctx.createGain(); duckBus.connect(musBus);   // dips the music under big booms

    // a tape-style echo for the music
    echoIn = ctx.createGain(); echoIn.gain.value = 1;
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.2;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(duckBus);

    const sr = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, sr * 2, sr);
    const w = noiseBuf.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    brownBuf = ctx.createBuffer(1, sr * 3, sr);
    const b = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    for (const k in waves) delete waves[k];
  }

  // Pulse wave with a given duty cycle (0.5 = square, 0.25 and 0.125 sound thinner and "nasal")
  function pulse(duty) {
    const key = duty.toFixed(3);
    if (!waves[key]) {
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      waves[key] = ctx.createPeriodicWave(re, im);
    }
    return waves[key];
  }

  // ---------------------------------------------------------------
  //  Building blocks
  // ---------------------------------------------------------------
  // A "channel": a gain (optionally panned) that feeds a bus
  function channel(bus, vol, pan) {
    const g = ctx.createGain(); g.gain.value = vol;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      g.connect(p); p.connect(bus);
    } else g.connect(bus);
    return g;
  }

  // One tone. o = { t, dur, f0, f1, vol, type|wave, atk, lp, am:{rate,depth}, vib:{rate,cents}, slide }
  function tone(dest, o) {
    const t = o.t, dur = o.dur, atk = o.atk === undefined ? 0.004 : o.atk;
    const osc = ctx.createOscillator();
    let osc2 = null, node;
    if (o.pwm) {
      // Pulse-width modulation, like a real tracker/SID: one saw minus a slightly delayed copy of itself.
      // A slow LFO moves the delay, so the pulse width sweeps and the sound "shimmers".
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(o.f0, t);
      osc2 = ctx.createOscillator(); osc2.type = "sawtooth"; osc2.frequency.setValueAtTime(o.f0, t);
      const inv = ctx.createGain(); inv.gain.value = -1;
      const dl = ctx.createDelay(0.1); dl.delayTime.value = (o.pwm.duty || 0.5) / o.f0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = o.pwm.rate || 1.3;
      const lg = ctx.createGain(); lg.gain.value = (o.pwm.depth || 0.3) / o.f0;
      lfo.connect(lg); lg.connect(dl.delayTime); lfo.start(t); lfo.stop(t + dur + 0.05);
      const sum = ctx.createGain(); sum.gain.value = 0.5;
      osc.connect(sum); osc2.connect(inv); inv.connect(dl); dl.connect(sum);
      node = sum;
    } else {
      if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type || "sine";
      const f1 = o.f1 === undefined ? o.f0 : o.f1;
      osc.frequency.setValueAtTime(o.f0, t);
      if (f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * (o.slide || 1));
      node = osc;
    }
    if (o.lp) {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; f.Q.value = 0.5;
      node.connect(f); node = f;
    }
    if (o.am) {    // tremolo
      const tg = ctx.createGain(); tg.gain.value = 1 - o.am.depth;
      const lfo = ctx.createOscillator(); lfo.frequency.value = o.am.rate;
      const lg = ctx.createGain(); lg.gain.value = o.am.depth;
      lfo.connect(lg); lg.connect(tg.gain); lfo.start(t); lfo.stop(t + dur + 0.05);
      node.connect(tg); node = tg;
    }
    if (o.vib) {   // vibrato after a short delay
      const lfo = ctx.createOscillator(); lfo.frequency.value = o.vib.rate;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib.cents, t + Math.min(0.18, dur * 0.5));
      lfo.connect(lg); lg.connect(osc.detune); if (osc2) lg.connect(osc2.detune); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(o.vol, t + atk);
    if (o.hold) env.gain.setValueAtTime(o.vol, t + o.hold);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(env); env.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
    if (osc2) { osc2.start(t); osc2.stop(t + dur + 0.05); }
    return env;
  }

  // One burst of filtered noise. o = { t, dur, f0, f1, q, type, vol, atk, brown }
  function noise(dest, o) {
    const t = o.t, dur = o.dur, atk = o.atk === undefined ? 0.003 : o.atk;
    const src = ctx.createBufferSource();
    src.buffer = o.brown ? brownBuf : noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || "lowpass";
    f.Q.value = o.q === undefined ? 0.7 : o.q;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined && o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(o.vol, t + atk);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(env); env.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    return env;
  }

  // Never let the effects pile up into a wall of noise
  let voices = [];
  function room(t, cost) {
    voices = voices.filter((v) => v.end > t);
    let used = 0;
    for (const v of voices) used += v.cost;
    return used + cost <= 40;
  }
  function take(t, dur, cost) { voices.push({ end: t + dur, cost: cost }); }

  // ---------------------------------------------------------------
  //  Explosion sounds, one per explosion style ("fx" in weapons.js)
  //  d = destination, t = start time, k = pitch (small blast = high), s = size 0..1.2
  // ---------------------------------------------------------------
  const BOOM = {
    // a plain round boom
    blast(d, t, k, s) {
      tone(d, { t, dur: 0.4 + 0.35 * s, f0: 150 * k, f1: 36 * k, vol: 1.0 });
      noise(d, { t, dur: 0.45 + 0.3 * s, f0: 3200, f1: 140, vol: 0.9 });
      noise(d, { t, dur: 0.05, type: "highpass", f0: 1800, vol: 0.5 });
    },
    // huge: two booms on top of each other and a crackling tail
    mega(d, t, k, s) {
      tone(d, { t, dur: 1.1, f0: 95 * k, f1: 26 * k, vol: 1.1 });
      tone(d, { t: t + 0.09, dur: 0.9, f0: 130 * k, f1: 34 * k, vol: 0.6, type: "triangle" });
      noise(d, { t, dur: 1.3, f0: 2400, f1: 70, vol: 1.0 });
      noise(d, { t, dur: 1.5, brown: true, f0: 400, f1: 60, vol: 1.2 });
      for (let i = 0; i < 9; i++) noise(d, { t: t + 0.25 + i * rnd(0.05, 0.1), dur: 0.03, type: "highpass", f0: rnd(2500, 6000), vol: 0.25 });
    },
    // a short bright "pop"
    pop(d, t, k) {
      tone(d, { t, dur: 0.13, f0: 640 * k, f1: 170 * k, vol: 0.7 });
      noise(d, { t, dur: 0.1, type: "bandpass", f0: 2600, q: 1.4, vol: 0.55 });
    },
    // crackling sparks
    spark(d, t) {
      for (let i = 0; i < 12; i++) {
        noise(d, { t: t + i * rnd(0.015, 0.04), dur: 0.025, type: "highpass", f0: rnd(3500, 8000), vol: rnd(0.25, 0.55) });
      }
      tone(d, { t, dur: 0.12, f0: 2200, f1: 900, vol: 0.2, type: "triangle" });
    },
    // a rising whoosh and a soft thump
    flare(d, t, k) {
      noise(d, { t, dur: 0.4, type: "bandpass", f0: 350, f1: 3400, q: 3, vol: 0.5, atk: 0.15 });
      tone(d, { t: t + 0.28, dur: 0.4, f0: 115 * k, f1: 48 * k, vol: 0.8 });
      noise(d, { t: t + 0.28, dur: 0.35, f0: 1600, f1: 120, vol: 0.4 });
    },
    // sonar thump with echoing rings
    pulse(d, t, k) {
      tone(d, { t, dur: 0.5, f0: 75 * k, f1: 42 * k, vol: 1.0 });
      for (let i = 1; i <= 4; i++) tone(d, { t: t + i * 0.11, dur: 0.18, f0: 330, f1: 300, vol: 0.34 / i, type: "sine" });
    },
    // a bell ring
    ring(d, t, k) {
      const base = 480 * Math.min(1.3, k);
      [1, 2.76, 5.4, 8.9].forEach((r, i) => tone(d, { t, dur: 1.4 / Math.sqrt(1 + i * 1.5), f0: base * r, vol: 0.45 / (1 + i * 0.7) }));
      tone(d, { t, dur: 0.25, f0: 95 * k, f1: 50 * k, vol: 0.7 });
      noise(d, { t, dur: 0.08, type: "bandpass", f0: 3000, q: 2, vol: 0.3 });
    },
    // soft muffled puff of dirt
    dust(d, t, k) {
      noise(d, { t, dur: 0.5, f0: 900, f1: 110, vol: 0.9, atk: 0.01 });
      tone(d, { t, dur: 0.28, f0: 90 * k, f1: 46 * k, vol: 0.8 });
    },
    // wet splat with a few bubbles
    splat(d, t) {
      noise(d, { t, dur: 0.24, type: "bandpass", f0: 1300, f1: 280, q: 2.2, vol: 0.9 });
      for (let i = 0; i < 4; i++) {
        const f = rnd(220, 380);
        tone(d, { t: t + 0.06 + i * rnd(0.04, 0.07), dur: 0.07, f0: f, f1: f * rnd(1.6, 2.2), vol: 0.35 });
      }
      tone(d, { t, dur: 0.15, f0: 110, f1: 60, vol: 0.5 });
    },
    // grinding, crunching earth
    dig(d, t, k) {
      for (let i = 0; i < 6; i++) noise(d, { t: t + i * 0.07, dur: 0.1, f0: 1500 - i * 120, f1: 300, vol: 0.75, q: 1.2 });
      tone(d, { t, dur: 0.5, f0: 78 * k, f1: 52 * k, vol: 0.3, type: "sawtooth", lp: 320 });
      tone(d, { t, dur: 0.2, f0: 100 * k, f1: 40 * k, vol: 0.7 });
    },
    // geometric "clang" from square waves
    shape(d, t, k) {
      tone(d, { t, dur: 0.32, f0: 330 * k, f1: 165 * k, vol: 0.3, type: "square", lp: 2200 });
      tone(d, { t, dur: 0.26, f0: 495 * k, f1: 247 * k, vol: 0.2, type: "square", lp: 2200 });
      tone(d, { t, dur: 0.3, f0: 125 * k, f1: 48 * k, vol: 0.9 });
      noise(d, { t, dur: 0.07, type: "highpass", f0: 2000, vol: 0.45 });
    },
    // electric zap
    electric(d, t) {
      tone(d, { t, dur: 0.4, f0: 2600, f1: 110, vol: 0.32, type: "sawtooth", am: { rate: 48, depth: 0.8 }, slide: 0.9 });
      tone(d, { t, dur: 0.3, f0: 1300, f1: 70, vol: 0.25, type: "square", am: { rate: 31, depth: 0.7 } });
      for (let i = 0; i < 8; i++) noise(d, { t: t + i * rnd(0.02, 0.05), dur: 0.03, type: "highpass", f0: rnd(4000, 9000), vol: 0.4 });
      tone(d, { t, dur: 0.2, f0: 90, f1: 45, vol: 0.5 });
    },
    // a bang and glittering sparkles falling down
    firework(d, t, k) {
      noise(d, { t, dur: 0.22, type: "bandpass", f0: 1500, q: 0.8, vol: 0.85 });
      tone(d, { t, dur: 0.25, f0: 180 * k, f1: 60 * k, vol: 0.8 });
      for (let i = 0; i < 9; i++) {
        const tt = t + 0.12 + i * 0.09;
        noise(d, { t: tt, dur: 0.03, type: "highpass", f0: rnd(5000, 9000), vol: 0.3 });
        tone(d, { t: tt, dur: 0.1, f0: 2800 - i * 190 + rnd(-80, 80), vol: 0.13, type: "triangle" });
      }
    },
    // hissing, sizzling slag
    slag(d, t) {
      noise(d, { t, dur: 0.75, type: "highpass", f0: 3200, f1: 5200, vol: 0.38, atk: 0.02 });
      for (let i = 0; i < 10; i++) noise(d, { t: t + rnd(0, 0.6), dur: 0.02, type: "highpass", f0: 6000, vol: 0.4 });
      tone(d, { t, dur: 0.45, f0: 95, f1: 60, vol: 0.5, am: { rate: 28, depth: 0.7 } });
      tone(d, { t, dur: 0.2, f0: 110, f1: 50, vol: 0.5 });
    },
    // a swelling gust of wind
    gale(d, t) {
      noise(d, { t, dur: 1.1, type: "bandpass", f0: 220, f1: 1500, q: 1.1, vol: 1.1, atk: 0.3 });
      noise(d, { t: t + 0.1, dur: 0.9, type: "bandpass", f0: 900, f1: 300, q: 2, vol: 0.4, atk: 0.2 });
      tone(d, { t, dur: 0.3, f0: 100, f1: 50, vol: 0.5 });
    },
    // deep rumbling earthquake
    quake(d, t) {
      noise(d, { t, dur: 1.7, brown: true, f0: 160, f1: 50, vol: 1.7, atk: 0.05 });
      tone(d, { t, dur: 1.6, f0: 46, f1: 28, vol: 0.6, type: "sawtooth", lp: 140, am: { rate: 9, depth: 0.5 } });
      for (let i = 0; i < 4; i++) tone(d, { t: t + i * 0.24, dur: 0.3, f0: 62, f1: 30, vol: 0.9 / (1 + i * 0.5) });
    },
    // ice: a glassy crack and tinkling shards
    frost(d, t, k) {
      noise(d, { t, dur: 0.1, type: "highpass", f0: 3500, vol: 0.8, atk: 0.001 });
      tone(d, { t, dur: 0.25, f0: 160 * k, f1: 70 * k, vol: 0.7 });
      for (let i = 0; i < 8; i++) {
        const tt = t + 0.04 + i * rnd(0.04, 0.08), f = rnd(2400, 5200);
        tone(d, { t: tt, dur: 0.18, f0: f, f1: f * 0.98, vol: 0.14, type: "sine" });
        tone(d, { t: tt, dur: 0.12, f0: f * 1.5, vol: 0.06, type: "sine" });
      }
    },
    // fire: a roaring whoomph and crackle
    flame(d, t, k) {
      noise(d, { t, dur: 0.6, type: "bandpass", f0: 500, f1: 1800, q: 0.9, vol: 0.8, atk: 0.06 });
      tone(d, { t, dur: 0.45, f0: 120 * k, f1: 45 * k, vol: 0.8 });
      for (let i = 0; i < 10; i++) noise(d, { t: t + 0.1 + i * rnd(0.03, 0.08), dur: 0.02, type: "highpass", f0: rnd(2500, 6000), vol: 0.3 });
    },
    // nuclear: deep, long boom, a rising whine and a sub drop
    nuke(d, t, k) {
      tone(d, { t, dur: 1.9, f0: 80 * k, f1: 20, vol: 1.3 });
      tone(d, { t: t + 0.05, dur: 1.2, f0: 220, f1: 40, vol: 0.5, type: "sawtooth", lp: 700 });
      noise(d, { t, dur: 1.8, f0: 2600, f1: 60, vol: 1.1 });
      noise(d, { t, dur: 2.0, brown: true, f0: 500, f1: 50, vol: 1.5 });
      tone(d, { t: t + 0.25, dur: 1.4, f0: 300, f1: 1100, vol: 0.12, type: "sine", vib: { rate: 7, cents: 60 } });   // eerie whine
      for (let i = 0; i < 10; i++) noise(d, { t: t + 0.4 + i * rnd(0.08, 0.16), dur: 0.02, type: "highpass", f0: rnd(2000, 5000), vol: 0.35 });
    },
    // the fallout cloud: geiger counter clicks
    fallout(d, t) {
      for (let i = 0; i < 22; i++) noise(d, { t: t + i * rnd(0.02, 0.07), dur: 0.012, type: "highpass", f0: rnd(3500, 6500), vol: rnd(0.25, 0.6) });
      tone(d, { t, dur: 0.9, f0: 90, f1: 70, vol: 0.18, type: "sine", am: { rate: 6, depth: 0.7 } });
    },
    // EMP: a falling zap and a power-down
    emp(d, t) {
      tone(d, { t, dur: 0.5, f0: 3200, f1: 90, vol: 0.28, type: "square", am: { rate: 70, depth: 0.8 } });
      tone(d, { t: t + 0.05, dur: 0.6, f0: 900, f1: 55, vol: 0.3, type: "sawtooth", lp: 1400 });
      noise(d, { t, dur: 0.15, type: "highpass", f0: 5000, vol: 0.6 });
      tone(d, { t, dur: 0.25, f0: 100, f1: 45, vol: 0.7 });
    },
    bolt(d, t) {
      noise(d, { t, dur: 0.1, type: "highpass", f0: 2200, f1: 9000, vol: 1.2, atk: 0.001 });
      noise(d, { t, dur: 0.18, type: "bandpass", f0: 3000, f1: 800, q: 0.8, vol: 0.9, atk: 0.001 });
      noise(d, { t: t + 0.05, dur: 1.6, brown: true, f0: 1100, f1: 60, vol: 1.8 });
      tone(d, { t: t + 0.05, dur: 1.2, f0: 62, f1: 28, vol: 0.9 });
    },
    // meteor impact: fireball, huge boom and falling debris
    meteor(d, t) {
      noise(d, { t, dur: 0.5, type: "bandpass", f0: 3000, f1: 300, q: 0.8, vol: 0.9 });
      tone(d, { t, dur: 1.3, f0: 85, f1: 24, vol: 1.2 });
      tone(d, { t, dur: 0.7, f0: 280, f1: 40, vol: 0.4, type: "sawtooth", lp: 900 });
      noise(d, { t, dur: 1.5, brown: true, f0: 600, f1: 50, vol: 1.5 });
      for (let i = 0; i < 6; i++) noise(d, { t: t + 0.3 + i * rnd(0.08, 0.15), dur: 0.05, f0: rnd(500, 1200), f1: 150, vol: 0.35 });
    },
  };

  function explosionSound(e, t) {
    const style = e.kind === "bolt" ? "bolt" : e.kind === "meteor" ? "meteor"
      : e.kind === "arc" ? "electric" : e.kind === "quake" ? "quake" : (e.style && BOOM[e.style] ? e.style : "blast");
    const s = clamp((e.r || 30) / 55, 0.3, 1.25);
    const k = clamp(1.3 - s * 0.55, 0.65, 1.2);
    const heavy = style === "mega" || style === "quake" || style === "meteor" || style === "bolt";
    const cost = heavy ? 10 : 4;
    if (!room(t, cost)) return;
    take(t, heavy ? 1.5 : 0.6, cost);
    const x = (e.x || 480) / 960;
    const loud = e.kind === "dirt" ? 0.8 : 1;
    const d = channel(sfxBus, loud * (0.55 + 0.45 * Math.min(1, s)), (x * 2 - 1) * 0.65);
    BOOM[style](d, t, k, s);
    if (heavy) duck(0.3, 0.7, t);
    else if (s > 0.6) duck(0.55, 0.4, t);
  }

  // Music gets quieter for a moment under a big explosion
  function duck(level, recover, t) {
    const g = duckBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + 0.03);
    g.linearRampToValueAtTime(1, t + recover);
  }

  // ---------------------------------------------------------------
  //  Launch sounds: the style of the weapon decides what it sounds like
  // ---------------------------------------------------------------
  const LAUNCH = {
    cannon(d, t, p) {       // the standard cannon thump
      tone(d, { t, dur: 0.16, f0: 230 * p, f1: 62 * p, vol: 0.9 });
      noise(d, { t, dur: 0.17, f0: 2200, f1: 220, vol: 0.7 });
    },
    heavy(d, t, p) {        // slow, deep and long
      tone(d, { t, dur: 0.4, f0: 130 * p, f1: 34 * p, vol: 1.0 });
      noise(d, { t, dur: 0.4, f0: 1400, f1: 90, vol: 0.8 });
      noise(d, { t, dur: 0.45, brown: true, f0: 300, f1: 50, vol: 0.8 });
    },
    pip(d, t, p) {          // small bright shot
      tone(d, { t, dur: 0.09, f0: 900 * p, f1: 380 * p, vol: 0.55, type: "square", lp: 3000 });
      noise(d, { t, dur: 0.06, type: "highpass", f0: 2500, vol: 0.4 });
    },
    sonar(d, t, p) {
      tone(d, { t, dur: 0.3, f0: 640 * p, vol: 0.4 });
      tone(d, { t: t + 0.09, dur: 0.25, f0: 640 * p, vol: 0.2 });
      tone(d, { t, dur: 0.12, f0: 150, f1: 70, vol: 0.5 });
    },
    bell(d, t, p) {
      tone(d, { t, dur: 0.5, f0: 880 * p, vol: 0.35 });
      tone(d, { t, dur: 0.35, f0: 880 * p * 2.76, vol: 0.18 });
      tone(d, { t, dur: 0.12, f0: 180, f1: 80, vol: 0.5 });
    },
    plop(d, t, p) {         // wet plop for dirt and goo
      tone(d, { t, dur: 0.14, f0: 160 * p, f1: 420 * p, vol: 0.7 });
      noise(d, { t, dur: 0.12, type: "bandpass", f0: 700, f1: 250, q: 2, vol: 0.5 });
    },
    motor(d, t, p) {        // drills and diggers
      tone(d, { t, dur: 0.4, f0: 62 * p, f1: 120 * p, vol: 0.4, type: "sawtooth", lp: 600, am: { rate: 36, depth: 0.6 } });
      noise(d, { t, dur: 0.35, f0: 900, f1: 400, vol: 0.45, q: 1 });
      tone(d, { t, dur: 0.1, f0: 200, f1: 70, vol: 0.6 });
    },
    clang(d, t, p) {
      tone(d, { t, dur: 0.14, f0: 520 * p, f1: 260 * p, vol: 0.35, type: "square", lp: 2400 });
      tone(d, { t, dur: 0.14, f0: 210 * p, f1: 70 * p, vol: 0.8 });
      noise(d, { t, dur: 0.05, type: "highpass", f0: 2500, vol: 0.4 });
    },
    zap(d, t, p) {
      tone(d, { t, dur: 0.2, f0: 1800 * p, f1: 300, vol: 0.28, type: "sawtooth", am: { rate: 40, depth: 0.7 } });
      tone(d, { t, dur: 0.1, f0: 190, f1: 70, vol: 0.5 });
    },
    rocket(d, t, p) {       // rises like a firework
      tone(d, { t, dur: 0.35, f0: 500 * p, f1: 1600 * p, vol: 0.22, type: "triangle" });
      noise(d, { t, dur: 0.4, type: "bandpass", f0: 800, f1: 2800, q: 2, vol: 0.4, atk: 0.05 });
      tone(d, { t, dur: 0.12, f0: 200, f1: 70, vol: 0.6 });
    },
    sizzle(d, t, p) {
      noise(d, { t, dur: 0.3, type: "highpass", f0: 3500, vol: 0.4, atk: 0.02 });
      tone(d, { t, dur: 0.2, f0: 150 * p, f1: 60, vol: 0.7 });
    },
    whoosh(d, t, p) {
      noise(d, { t, dur: 0.5, type: "bandpass", f0: 250, f1: 1500 * p, q: 1.2, vol: 0.9, atk: 0.12 });
      tone(d, { t, dur: 0.12, f0: 130, f1: 60, vol: 0.5 });
    },
    icy(d, t, p) {          // a glassy "tink"
      tone(d, { t, dur: 0.3, f0: 1800 * p, f1: 1700 * p, vol: 0.22 });
      tone(d, { t: t + 0.04, dur: 0.25, f0: 2700 * p, vol: 0.14 });
      tone(d, { t, dur: 0.14, f0: 190, f1: 70, vol: 0.6 });
    },
    burn(d, t, p) {         // a hissing fire-whoosh
      noise(d, { t, dur: 0.45, type: "bandpass", f0: 400, f1: 1500, q: 0.9, vol: 0.9, atk: 0.1 });
      tone(d, { t, dur: 0.15, f0: 170, f1: 60, vol: 0.7 });
    },
    siren(d, t, p) {        // the big one: a low horn
      tone(d, { t, dur: 0.6, f0: 110 * p, f1: 70 * p, vol: 0.9 });
      tone(d, { t, dur: 0.7, f0: 220 * p, f1: 330 * p, vol: 0.18, type: "sawtooth", lp: 900, vib: { rate: 8, cents: 40 } });
      noise(d, { t, dur: 0.4, f0: 1200, f1: 90, vol: 0.7 });
    },
    magnet(d, t, p) {       // homing weapons get a rising "seeking" tone
      LAUNCH.cannon(d, t, p);
      tone(d, { t: t + 0.05, dur: 0.35, f0: 420, f1: 1050, vol: 0.18, type: "triangle", vib: { rate: 12, cents: 40 } });
    },
  };
  const LAUNCH_BY_FX = {
    blast: "cannon", mega: "heavy", pop: "pip", spark: "pip", flare: "rocket", pulse: "sonar", ring: "bell",
    dust: "plop", splat: "plop", dig: "motor", shape: "clang", electric: "zap", firework: "rocket",
    slag: "sizzle", gale: "whoosh", quake: "heavy", frost: "icy", flame: "burn", nuke: "siren", emp: "zap",
  };

  function launchSound(w, idx, x, t) {
    if (!w) return;
    let kind = LAUNCH_BY_FX[w.fx] || "cannon";
    if (w.hop) kind = "whoosh";
    else if (w.drill) kind = "motor";
    else if (w.homing && kind === "cannon") kind = "magnet";
    const pitch = 0.88 + ((idx || 0) % 7) * 0.035;     // every weapon gets its own pitch
    const pan = ((x || 480) / 960 * 2 - 1) * 0.6;
    const count = w.volley ? Math.min(w.volley.count, 6) : 1;
    for (let i = 0; i < count; i++) {
      const tt = t + (w.volley ? i * (w.volley.stagger || 0.03) : 0);
      if (!room(tt, 3)) continue;
      take(tt, 0.5, 3);
      LAUNCH[kind](channel(sfxBus, count > 1 ? 0.7 : 0.9, pan), tt, pitch * (1 + i * 0.03));
    }
  }

  // ---------------------------------------------------------------
  //  Small game sounds
  // ---------------------------------------------------------------
  const SMALL = {
    click(t) { tone(channel(sfxBus, 0.5), { t, dur: 0.05, f0: 1250, f1: 900, vol: 0.5, type: "square", lp: 3500 }); },
    pick(t) {
      const d = channel(sfxBus, 0.55);
      tone(d, { t, dur: 0.08, f0: 660, vol: 0.5, wave: pulse(0.25) });
      tone(d, { t: t + 0.07, dur: 0.14, f0: 990, vol: 0.5, wave: pulse(0.25) });
    },
    tick(t, v) { tone(channel(sfxBus, 0.35), { t, dur: 0.03, f0: 500 + v * 700, vol: 0.5, type: "square", lp: 3000 }); },
    weapon(t) {
      const d = channel(sfxBus, 0.5);
      tone(d, { t, dur: 0.05, f0: 420, vol: 0.5, type: "square", lp: 2500 });
      tone(d, { t: t + 0.05, dur: 0.07, f0: 640, vol: 0.5, type: "square", lp: 2500 });
    },
    turn(t, player) {
      const d = channel(sfxBus, 0.5, player === 0 ? -0.4 : 0.4);
      const base = player === 0 ? 659 : 523;
      tone(d, { t, dur: 0.1, f0: base, vol: 0.5, wave: pulse(0.5) });
      tone(d, { t: t + 0.09, dur: 0.18, f0: base * 1.5, vol: 0.5, wave: pulse(0.5) });
    },
    hit(t, points) {      // a cheerful chime that rises with the score
      const d = channel(sfxBus, 0.55);
      const n = points >= 60 ? 4 : points >= 25 ? 3 : 2;
      for (let i = 0; i < n; i++) tone(d, { t: t + i * 0.07, dur: 0.22, f0: midi(76 + i * 4 + (i === n - 1 ? 3 : 0)), vol: 0.5, wave: pulse(0.25) });
    },
    ouch(t) {             // a sad slide down
      const d = channel(sfxBus, 0.55);
      tone(d, { t, dur: 0.45, f0: 420, f1: 110, vol: 0.5, type: "sawtooth", lp: 1400, vib: { rate: 9, cents: 50 } });
      tone(d, { t, dur: 0.1, f0: 160, f1: 60, vol: 0.5 });
    },
    mud(t) {
      const d = channel(sfxBus, 0.8);
      noise(d, { t, dur: 0.35, f0: 600, f1: 90, vol: 0.9 });
      tone(d, { t, dur: 0.3, f0: 85, f1: 45, vol: 0.9 });
      tone(d, { t: t + 0.12, dur: 0.1, f0: 190, f1: 330, vol: 0.3 });
    },
    free(t) {
      const d = channel(sfxBus, 0.6);
      tone(d, { t, dur: 0.15, f0: 220, f1: 700, vol: 0.5, type: "triangle" });
      tone(d, { t: t + 0.1, dur: 0.18, f0: 990, vol: 0.35, wave: pulse(0.25) });
    },
    warn(t, kind) {       // the sky is about to attack
      const d = channel(sfxBus, 0.8);
      if (kind === "meteor") {
        tone(d, { t, dur: 1.0, f0: 40, f1: 75, vol: 0.7, type: "sawtooth", lp: 180, atk: 0.5 });
        noise(d, { t, dur: 1.0, brown: true, f0: 150, f1: 400, vol: 0.9, atk: 0.5 });
      } else {
        noise(d, { t, dur: 1.2, brown: true, f0: 400, f1: 80, vol: 1.0, atk: 0.4 });
      }
    },
    status(t, note) {     // a short sound for whatever effect starts on a turn
      const d = channel(sfxBus, 0.7);
      if (/FROZEN/.test(note)) { [2600, 3400, 2000].forEach((f, i) => tone(d, { t: t + i * 0.06, dur: 0.2, f0: f, vol: 0.2 })); noise(d, { t, dur: 0.06, type: "highpass", f0: 4000, vol: 0.5 }); }
      if (/EMP/.test(note)) { tone(d, { t, dur: 0.4, f0: 2000, f1: 80, vol: 0.2, type: "square", am: { rate: 60, depth: 0.8 } }); }
      if (/RADIATION/.test(note)) { for (let i = 0; i < 14; i++) noise(d, { t: t + i * rnd(0.03, 0.08), dur: 0.012, type: "highpass", f0: rnd(3500, 6500), vol: 0.5 }); tone(d, { t, dur: 0.5, f0: 330, f1: 260, vol: 0.12, type: "triangle", vib: { rate: 9, cents: 80 } }); }
      if (/SCRAMBLED/.test(note)) { for (let i = 0; i < 6; i++) tone(d, { t: t + 0.25 + i * 0.07, dur: 0.07, f0: rnd(300, 1400), vol: 0.14, type: "square", lp: 2500 }); }
    },
    win(t) {
      const d = channel(sfxBus, 0.7), p = pulse(0.25);
      [72, 76, 79, 84, 88].forEach((m, i) => tone(d, { t: t + i * 0.1, dur: 0.14, f0: midi(m), vol: 0.5, wave: p }));
      [72, 76, 79, 84].forEach((m) => tone(d, { t: t + 0.55, dur: 1.1, f0: midi(m), vol: 0.3, wave: pulse(0.5), atk: 0.01 }));
      tone(d, { t: t + 0.55, dur: 1.1, f0: midi(48), vol: 0.5, type: "triangle" });
    },
    lose(t) {
      const d = channel(sfxBus, 0.7);
      [64, 62, 60, 55].forEach((m, i) => tone(d, { t: t + i * 0.3, dur: i === 3 ? 1.2 : 0.32, f0: midi(m), vol: 0.5, type: "triangle", vib: { rate: 6, cents: 25 } }));
    },
    draw(t) {
      const d = channel(sfxBus, 0.6);
      [67, 67].forEach((m, i) => tone(d, { t: t + i * 0.25, dur: 0.4, f0: midi(m), vol: 0.5, wave: pulse(0.5) }));
    },
  };

  // Continuous sounds: the whistle of a shell and the engine of a driving tank
  let whistle = null, engine = null;
  function startWhistle() {
    if (whistle) return;
    const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 400;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 800; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(f); f.connect(g); g.connect(sfxBus); osc.start();
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.15);
    whistle = { osc, g, f };
  }
  function stopWhistle() {
    if (!whistle) return;
    const w = whistle; whistle = null;
    w.g.gain.cancelScheduledValues(ctx.currentTime);
    w.g.gain.setValueAtTime(w.g.gain.value, ctx.currentTime);
    w.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    w.osc.stop(ctx.currentTime + 0.12);
  }
  function startEngine() {
    if (engine) return;
    const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 52;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
    const chug = ctx.createGain(); chug.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 13;
    const lg = ctx.createGain(); lg.gain.value = 0.4;
    lfo.connect(lg); lg.connect(chug.gain);
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(lp); lp.connect(chug); chug.connect(g); g.connect(sfxBus);
    osc.start(); lfo.start();
    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
    engine = { osc, lfo, g };
  }
  function stopEngine() {
    if (!engine) return;
    const e = engine; engine = null;
    e.g.gain.cancelScheduledValues(ctx.currentTime);
    e.g.gain.setValueAtTime(e.g.gain.value, ctx.currentTime);
    e.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    e.osc.stop(ctx.currentTime + 0.15); e.lfo.stop(ctx.currentTime + 0.15);
  }

  // ---------------------------------------------------------------
  //  Music
  //  The songs are written as a few numbers and rules below, then played by a tiny tracker.
  //  A song is 32 bars: intro, verse (with lead), bridge (a step higher), verse again.
  // ---------------------------------------------------------------
  const MIN = [0, 3, 7, 12, 15, 19], MAJ = [0, 4, 7, 12, 16, 19];
  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  const PROG_A = [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [5, MIN], [7, MAJ]];
  const PROG_B = [[5, MIN], [0, MIN], [8, MAJ], [7, MAJ], [5, MIN], [0, MIN], [8, MAJ], [7, MAJ]];
  const RHYTHMS = [
    [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
    [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]],
    [[0, 4], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4]],
  ];
  const PROFILES = {
    battle: { bpm: 146, key: 57, arpStep: 1, drums: 1, leadVol: 0.2, arpVol: 0.1, seed: 1337, lift: 2 },
    menu: { bpm: 104, key: 50, arpStep: 2, drums: 0.5, leadVol: 0.15, arpVol: 0.085, seed: 4242, lift: 0 },
  };

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Compose the lead melody for a whole song: 32 bars x 16 steps (null = rest, else { m, len })
  function compose(profile) {
    const rand = mulberry(profile.seed);
    const bars = [];
    let prev = profile.key + 19;
    for (let bar = 0; bar < 32; bar++) {
      const sec = Math.floor(bar / 8), inSec = bar % 8;
      const prog = sec === 2 ? PROG_B : PROG_A;
      const [rootOff, chordTones] = prog[inSec];
      const trans = sec === 2 ? profile.lift : 0;
      const root = profile.key + rootOff + trans;
      const rhythm = RHYTHMS[(sec === 2 ? [1, 3, 2, 0] : [0, 4, 2, 1])[Math.floor(inSec / 2)] % RHYTHMS.length];
      const row = new Array(16).fill(null);
      const lo = profile.key + 12, hi = profile.key + 31;
      rhythm.forEach(([step, len], i) => {
        let m;
        if (i === 0 || step % 8 === 0) {
          // strong beat: land on a note of the chord, near the previous note
          const cands = [];
          for (let oct = 12; oct <= 36; oct += 12) for (const c of chordTones.slice(0, 3)) cands.push(root + c + oct - 12);
          m = cands.filter((c) => c >= lo && c <= hi).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[Math.floor(rand() * 2)];
          if (m === undefined) m = root + 12;
        } else {
          // weak beat: walk along the scale
          const dir = rand() < 0.55 ? 1 : -1, stepSize = 1 + Math.floor(rand() * 2);
          const deg = SCALE.map((s) => s + profile.key + trans);
          let cur = prev, n = stepSize;
          while (n > 0) {
            cur += dir;
            if (deg.some((d) => (cur - d) % 12 === 0)) n--;
          }
          m = clamp(cur, lo, hi);
        }
        prev = m;
        row[step] = { m: m, len: len };
      });
      // sections 0 and 3 vary: intro has no lead, verse 2 adds a high echo
      bars.push(sec === 0 ? new Array(16).fill(null) : row);
    }
    return bars;
  }

  // ---------------------------------------------------------------
  //  The battle song: written by hand, 40 bars at 150 BPM, loops forever.
  //  C minor with bright major chords: intro, tune A, tune B (the "euphoric" one), breakdown, A again, B again.
  //  Four tracker channels: lead, arpeggio, bass and drums.
  // ---------------------------------------------------------------
  const NOTE_NUM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // "G5-2 r-2 Bb5-4" = note + length in 16ths; r = rest. Every bar must add up to 16.
  function tune(bars) {
    return bars.map((str) => {
      const row = new Array(16).fill(null);
      let step = 0;
      str.trim().split(/\s+/).forEach((tok) => {
        const [name, len] = tok.split("-"), n = parseInt(len, 10);
        if (name !== "r") {
          const m = /^([A-G])([b#]?)(\d)$/.exec(name);
          row[step] = { m: 12 * (parseInt(m[3], 10) + 1) + NOTE_NUM[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0), len: n };
        }
        step += n;
      });
      if (step !== 16) throw new Error("tune bar is " + step + " steps: " + str);
      return row;
    });
  }
  const TUNE_A = tune([
    "G5-2 G5-1 Bb5-1 C6-4 Bb5-2 G5-2 Eb5-2 r-2",   // Cm
    "Ab5-2 Ab5-1 C6-1 Eb6-4 D6-2 C6-2 Ab5-2 r-2",   // Ab
    "G5-2 G5-1 Bb5-1 Eb6-4 D6-2 Bb5-2 G5-2 r-2",    // Eb
    "F5-2 F5-1 Bb5-1 D6-3 C6-1 Bb5-2 F5-2 D5-2 r-2", // Bb
    "C6-2 C6-1 D6-1 Eb6-4 D6-2 C6-2 G5-2 r-2",      // Cm
    "Eb6-2 D6-1 C6-1 Ab5-4 C6-2 Eb6-2 C6-2 r-2",    // Ab
    "D6-2 D6-1 C6-1 Bb5-4 D6-2 F6-2 D6-2 r-2",      // Bb
    "B5-2 D6-2 B5-2 G5-2 B5-2 D6-4 r-2",            // G (the major chord that pulls back to the start)
  ]);
  const TUNE_B = tune([
    "C6-3 C6-1 Eb6-4 Eb6-2 D6-2 C6-4",              // Ab
    "Bb5-3 Bb5-1 Eb6-4 G6-2 F6-2 Eb6-4",            // Eb
    "D6-3 D6-1 F6-4 F6-2 Eb6-2 D6-4",               // Bb
    "A5-3 A5-1 C6-4 F6-4 E6-2 C6-2",                // F (major: the happy lift)
    "Eb6-2 Eb6-1 C6-1 Ab5-2 C6-2 Eb6-4 C6-4",       // Ab
    "G6-2 G6-1 Eb6-1 Bb5-2 Eb6-2 G6-4 Eb6-4",       // Eb
    "F6-2 Eb6-1 C6-1 Ab5-2 C6-2 F6-2 C6-2 Ab5-2 r-2", // Fm
    "D6-2 B5-2 G5-2 B5-2 D6-2 G6-4 r-2",            // G
  ]);
  const PROG_BA = [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [10, MAJ], [7, MAJ]];
  const PROG_BB = [[8, MAJ], [3, MAJ], [10, MAJ], [5, MAJ], [8, MAJ], [3, MAJ], [5, MIN], [7, MAJ]];
  const PROG_IN = [[0, MIN], [8, MAJ], [10, MAJ], [7, MAJ]];
  // what every bar of the 40 is: [section kind, chord, melody bar or null]
  const BATTLE_BARS = [];
  (function () {
    const add = (kind, prog, tuneRows) => prog.forEach((c, i) => BATTLE_BARS.push({ kind: kind, root: c[0], chord: c[1], lead: tuneRows ? tuneRows[i] : null, i: i, n: prog.length }));
    add("intro", PROG_IN, null);
    add("A", PROG_BA, TUNE_A);
    add("B", PROG_BB, TUNE_B);
    add("break", PROG_IN, null);
    add("A2", PROG_BA, TUNE_A);
    add("B2", PROG_BB, TUNE_B);
  })();
  const BATTLE_KEY = 48, BATTLE_BPM = 150;

  function playBattle(step, t, bus) {
    const dur = 60 / BATTLE_BPM / 4;
    const bi = Math.floor(step / 16) % BATTLE_BARS.length, s = step % 16;
    const B = BATTLE_BARS[bi], kind = B.kind, root = BATTLE_KEY + B.root, chord = B.chord;
    const isB = kind === "B" || kind === "B2", isA = kind === "A" || kind === "A2";
    const second = kind === "A2" || kind === "B2";
    const echo = (g, a) => { const s2 = ctx.createGain(); s2.gain.value = a === undefined ? 0.35 : a; g.connect(s2); s2.connect(echoIn); };

    // ---- channel 2: the cascading arpeggio, one note per 16th, ping-ponging left and right
    {
      const pat = isB ? [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 3, 4, 5, 3]
        : kind === "break" ? [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3]
        : [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2];
      const vol = (kind === "intro" ? 0.085 : kind === "break" ? 0.1 : 0.1) * (kind === "intro" && B.i < 2 ? 0.8 : 1);
      const g = channel(bus, vol, s % 2 === 0 ? -0.3 : 0.3);
      echo(g, 0.3);
      tone(g, { t, dur: dur * 0.9, f0: midi(root + chord[pat[s]] + 12), vol: 1, wave: pulse(isB ? 0.125 : kind === "break" ? 0.5 : 0.25), atk: 0.002 });
    }
    // ---- channel 3: the bouncing bass (triangle body + a little pulse for crunch)
    if (kind !== "intro" || B.i >= 1) {
      const hits = kind === "break" ? [0, 8] : (isB ? [0, 3, 6, 8, 11, 14] : [0, 2, 3, 6, 8, 10, 11, 14]);
      if (hits.includes(s)) {
        const oct = (s === 3 || s === 11 || s === 14) ? 12 : 0;
        const g = channel(bus, 0.34, 0);
        tone(g, { t, dur: dur * (kind === "break" ? 7 : 1.9), f0: midi(root - 12 + oct), vol: 1, type: "triangle", atk: 0.003 });
        if (kind !== "break") tone(g, { t, dur: dur * 1.1, f0: midi(root - 12 + oct), vol: 0.4, wave: pulse(0.25), atk: 0.002 });
      }
    }
    // ---- channel 1: the lead
    const note = B.lead ? B.lead[s] : null;
    if (note) {
      const g = channel(bus, 0.2, 0);
      echo(g);
      const ln = Math.max(dur * note.len * 0.92, dur);
      const o = { t, dur: ln, f0: midi(note.m), vol: 1, atk: 0.004, vib: { rate: 5.5, cents: 12 } };
      if (second || isB) { o.pwm = { duty: isB ? 0.45 : 0.35, depth: 0.28, rate: 1.7 }; o.vol = 0.9; }
      else { o.wave = pulse(0.25); }
      tone(g, o);
      if (second) tone(g, { t, dur: Math.max(dur * note.len * 0.6, dur), f0: midi(note.m + 12), vol: 0.3, wave: pulse(0.125), atk: 0.004 });
    }
    // ---- channel 4: drums
    {
      const d = channel(bus, 0.5, 0);
      const full = kind !== "intro" && kind !== "break";
      const kickOn = full ? (isB ? [0, 3, 4, 8, 10, 12] : [0, 4, 8, 10, 12]) : (kind === "intro" && B.i >= 2 ? [0, 8] : []);
      if (kickOn.includes(s)) {
        tone(d, { t, dur: 0.14, f0: 160, f1: 44, vol: 1.0 });
        noise(d, { t, dur: 0.02, type: "highpass", f0: 1500, vol: 0.3 });
      }
      if (full && (s === 4 || s === 12)) {
        noise(d, { t, dur: 0.14, type: "bandpass", f0: 2600, q: 0.8, vol: 0.55 });
        tone(d, { t, dur: 0.09, f0: 210, f1: 150, vol: 0.4, type: "triangle" });
      }
      // crash at the start of each big section
      if (s === 0 && B.i === 0 && kind !== "intro" && kind !== "break") {
        noise(d, { t, dur: 0.9, type: "highpass", f0: 5200, vol: 0.28 });
      }
      // snare roll at the end of every fourth bar, and a big riser in the breakdown
      if (full && (bi % 4 === 3) && s >= 12) noise(d, { t, dur: 0.07, type: "bandpass", f0: 2800, q: 0.8, vol: 0.3 + (s - 12) * 0.08 });
      if (kind === "break" && B.i === 3) {
        noise(d, { t, dur: dur * 1.2, type: "bandpass", f0: 600 + s * 420, q: 1.2, vol: 0.12 + s * 0.018 });
        if (s >= 8 && s % 2 === 0) noise(d, { t, dur: 0.07, type: "bandpass", f0: 2800, q: 0.8, vol: 0.25 + (s - 8) * 0.05 });
      }
      // hi-hats: eighths in the intro, sixteenths with open hats in the big parts
      const hatStep = full ? 2 : 4;
      if (s % hatStep === 0 && !(kind === "break" && B.i === 3)) {
        const open = full && s % 4 === 2;
        noise(d, { t, dur: open ? 0.09 : 0.03, type: "highpass", f0: 7500, vol: open ? 0.22 : 0.16 });
      }
    }
    return dur;
  }

  const songs = {};
  function songOf(name) {
    if (!songs[name]) songs[name] = { profile: PROFILES[name], lead: compose(PROFILES[name]) };
    return songs[name];
  }

  // Schedules one 16th-note step of a song at time t on the destination bus
  function playStep(name, step, t, bus) {
    if (name === "battle") return playBattle(step, t, bus);
    const song = songOf(name), P = song.profile;
    const dur = 60 / P.bpm / 4;
    const bar = Math.floor(step / 16) % 32, s = step % 16, sec = Math.floor(bar / 8), inSec = bar % 8;
    const prog = sec === 2 ? PROG_B : PROG_A;
    const trans = sec === 2 ? P.lift : 0;
    const [rootOff, chord] = prog[inSec];
    const root = P.key + rootOff + trans;
    const echo = (g) => { const s2 = ctx.createGain(); s2.gain.value = 0.35; g.connect(s2); s2.connect(echoIn); };
    const mellow = name === "menu";

    // ---- arpeggio: the classic fast tracker arpeggio
    {
      const sp = P.arpStep;
      if (s % sp === 0) {
        const idx = (s / sp) % 8;
        const pattern = sec === 2 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 1, 3, 2, 1, 2];
        const note = root + chord[pattern[idx]] + 12;
        const g = channel(bus, P.arpVol * (sec === 0 && inSec < 4 ? 0.75 : 1), s % 4 === 0 ? -0.2 : 0.2);
        echo(g);
        tone(g, { t, dur: dur * sp * 0.9, f0: midi(note), vol: 1, wave: pulse(sec === 2 ? 0.125 : 0.25), atk: 0.002 });
      }
    }
    // ---- bass: triangle, bouncing between the root and the octave
    {
      const hits = mellow ? [0, 8] : (sec === 0 ? [0, 6, 8, 14] : [0, 3, 6, 8, 11, 14]);
      if (hits.includes(s)) {
        const oct = (s === 6 || s === 14 || s === 3) ? 12 : 0;
        const g = channel(bus, mellow ? 0.32 : 0.34, 0);
        tone(g, { t, dur: dur * (mellow ? 7 : 2.4), f0: midi(root - 12 + oct), vol: 1, type: "triangle", atk: 0.003 });
        if (!mellow) tone(g, { t, dur: dur * 1.2, f0: midi(root - 12 + oct), vol: 0.35, wave: pulse(0.5), atk: 0.002 });
      }
    }
    // ---- soft pad for the menu music
    if (mellow && s === 0) {
      const g = channel(bus, 0.07, 0);
      chord.slice(0, 3).forEach((c) => tone(g, { t, dur: dur * 15, f0: midi(root + c), vol: 1, type: "triangle", atk: 0.25 }));
    }
    // ---- lead melody
    const note = song.lead[bar][s];
    if (note) {
      const g = channel(bus, P.leadVol * (mellow ? 0.9 : 1), 0);
      echo(g);
      const from = bar % 2 === 1 && note.len >= 4 ? midi(note.m - 2) : midi(note.m);  // little slide into long notes
      tone(g, {
        t, dur: Math.max(dur * note.len * 0.92, dur), f0: from, f1: midi(note.m), slide: 0.12, vol: 1,
        wave: pulse(sec === 2 ? 0.25 : 0.5), atk: 0.004, vib: { rate: 5.5, cents: 14 },
      });
      if (sec === 3 && !mellow) {   // last verse: a second voice one octave up
        tone(g, { t, dur: Math.max(dur * note.len * 0.6, dur), f0: midi(note.m + 12), vol: 0.35, wave: pulse(0.125), atk: 0.004 });
      }
    }
    // ---- drums
    const dv = P.drums;
    if (dv > 0) {
      const d = channel(bus, 0.5 * dv, 0);
      const full = sec > 0 || inSec >= 4;
      const kicks = mellow ? [0, 8] : (sec === 2 ? [0, 3, 4, 8, 10, 12] : (full ? [0, 4, 8, 10, 12] : [0, 8]));
      const snares = mellow ? [] : (full ? [4, 12] : []);
      if (kicks.includes(s)) {
        tone(d, { t, dur: 0.14, f0: 160, f1: 44, vol: 1.0 });
        noise(d, { t, dur: 0.02, type: "highpass", f0: 1500, vol: 0.3 });
      }
      if (snares.includes(s)) {
        noise(d, { t, dur: 0.14, type: "bandpass", f0: 2600, q: 0.8, vol: 0.55 });
        tone(d, { t, dur: 0.09, f0: 210, f1: 150, vol: 0.4, type: "triangle" });
      }
      // a snare roll at the end of every fourth bar
      if (!mellow && (bar % 4 === 3) && s >= 12 && full) {
        noise(d, { t, dur: 0.07, type: "bandpass", f0: 2800, q: 0.8, vol: 0.3 + (s - 12) * 0.08 });
      }
      const hatStep = mellow ? 4 : (full ? 2 : 4);
      if (s % hatStep === 0) {
        const open = !mellow && full && s % 4 === 2;
        noise(d, { t, dur: open ? 0.09 : 0.03, type: "highpass", f0: 7500, vol: open ? 0.22 : 0.16 });
      }
    }
    return dur;
  }

  // ---- the player: a lookahead scheduler so notes are sharp and tempo is steady
  let track = null;            // { name, gain, step, next, timer }
  let wantTrack = null;
  const LOOKAHEAD = 0.25;

  function startTrack(name) {
    if (!ctx) return;
    const g = ctx.createGain(); g.gain.value = 0;
    g.connect(duckBus);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.35);
    const tr = { name: name, gain: g, step: 0, next: ctx.currentTime + 0.08, timer: 0 };
    tr.tick = function () {
      while (tr.next < ctx.currentTime + LOOKAHEAD) {
        tr.next += playStep(name, tr.step, tr.next, g);
        tr.step++;
      }
    };
    tr.timer = setInterval(tr.tick, 40);
    tr.tick();
    track = tr;
  }
  function stopTrack(tr, fade) {
    clearInterval(tr.timer);
    const now = ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(now);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, now);
    tr.gain.gain.linearRampToValueAtTime(0, now + (fade || 0.3));
    setTimeout(() => { try { tr.gain.disconnect(); } catch (e) { /* already gone */ } }, ((fade || 0.3) + 1.5) * 1000);
  }
  function syncTrack() {
    if (!ctx || ctx.state !== "running") return;
    if (!musicOn) { if (track) { stopTrack(track, 0.2); track = null; } return; }
    if (track && track.name === wantTrack) return;
    if (track) stopTrack(track, 0.4);
    track = null;
    if (wantTrack) startTrack(wantTrack);
  }

  // ---------------------------------------------------------------
  //  Watching the game
  // ---------------------------------------------------------------
  const seen = {
    seed: null, phase: "", explId: 0, score: [0, 0], buried: [false, false], current: -1,
    angle: null, power: null, weapon: null, lastTick: 0, driveUntil: 0, over: false, tank: -1, note: "",
  };

  function observe(game, inMenu) {
    wantTrack = inMenu ? "menu" : "battle";
    if (!ctx) return;
    syncTrack();
    if (ctx.state !== "running") return;
    const now = ctx.currentTime;
    const counter = typeof explosionCounter !== "undefined" ? explosionCounter : 0;

    // a new match: forget the old state
    if (game.seed !== seen.seed) {
      seen.seed = game.seed; seen.phase = game.phase; seen.explId = counter;
      seen.score = [game.tanks[0].score, game.tanks[1].score];
      seen.buried = [!!game.tanks[0].buried, !!game.tanks[1].buried];
      seen.current = game.current; seen.angle = null; seen.power = null; seen.weapon = null; seen.over = false;
      stopWhistle(); stopEngine();
      return;
    }
    if (inMenu) { stopWhistle(); stopEngine(); seen.explId = counter; seen.phase = game.phase; return; }

    // shot fired
    if (seen.phase === "aim" && game.phase === "flight") {
      const w = game.usedWeapon;
      const idx = w ? WEAPON_LIST.indexOf(w) : 0;
      if (sfxOn) launchSound(w, idx, game.tank.x, now + 0.01);
      stopEngine();
    }
    // new explosions
    const fresh = game.explosions.filter((e) => e.id > seen.explId);
    if (fresh.length) {
      seen.explId = Math.max.apply(null, fresh.map((e) => e.id));
      if (sfxOn) fresh.slice(0, 8).forEach((e, i) => explosionSound(e, now + 0.01 + i * 0.015));
    }
    // points won and lost
    for (let i = 0; i < 2; i++) {
      const sc = game.tanks[i].score, dlt = sc - seen.score[i];
      if (dlt !== 0 && sfxOn) {
        const t = now + 0.12;
        const good = (dlt > 0);
        if (good) SMALL.hit(t, dlt); else SMALL.ouch(t);
      }
      seen.score[i] = sc;
      const b = !!game.tanks[i].buried;
      if (b !== seen.buried[i] && sfxOn) { if (b) SMALL.mud(now + 0.15); else SMALL.free(now + 0.05); }
      seen.buried[i] = b;
    }
    // storm warning when the weather phase begins
    if (game.phase === "weather" && seen.phase !== "weather" && sfxOn) {
      SMALL.warn(now, game.weather === "apocalypse" ? "meteor" : "storm");
    }
    // whistle of the shell in the air
    if (game.phase === "flight" && game.projs.length && sfxOn) {
      startWhistle();
      const p = game.projs[0];
      const sp = Math.hypot(p.vx || 0, p.vy || 0);
      const f = clamp(240 + sp * 0.8 + Math.max(0, p.vy || 0) * 0.5, 200, 1500);
      whistle.osc.frequency.setTargetAtTime(f, now, 0.03);
      whistle.f.frequency.setTargetAtTime(f, now, 0.03);
    } else stopWhistle();

    // driving
    if (game.drivingNow) seen.driveUntil = now + 0.12;
    if (sfxOn && now < seen.driveUntil && game.phase === "aim") {
      startEngine();
      if (engine) engine.osc.frequency.setTargetAtTime(48 + Math.abs(game.moveDir) * 8, now, 0.1);
    } else stopEngine();

    // whose turn, and the small clicks while aiming
    if (game.phase === "aim") {
      if (seen.current !== game.current && seen.phase !== "over" && sfxOn) SMALL.turn(now + 0.05, game.current);
      const t = game.tank;
      if (!game.isAiTurn && seen.current === game.current && sfxOn) {
        if (seen.weapon !== null && t.weapon !== seen.weapon) SMALL.weapon(now);
        else if (now - seen.lastTick > 0.045 &&
          ((seen.angle !== null && t.angle !== seen.angle) || (seen.power !== null && t.power !== seen.power))) {
          SMALL.tick(now, t.power !== seen.power ? t.power / 100 : t.angle / 180);
          seen.lastTick = now;
        }
      }
      seen.angle = t.angle; seen.power = t.power; seen.weapon = t.weapon;
    }
    seen.current = game.current;
    if (game.phase === "aim" && game.statusNote && game.statusNote !== seen.note && sfxOn) SMALL.status(now + 0.1, game.statusNote);
    seen.note = game.phase === "aim" ? game.statusNote : "";
    // crackling while flames burn
    if (game.flames.length && sfxOn && Math.random() < Math.min(0.5, game.flames.length * 0.06)) {
      noise(channel(sfxBus, 0.35, 0), { t: now + 0.005, dur: 0.02, type: "highpass", f0: 2000 + Math.random() * 3500, vol: 0.4 });
    }

    // the end of the game
    if (game.phase === "over" && !seen.over) {
      seen.over = true;
      if (sfxOn) {
        const a = game.tanks[0].score, b = game.tanks[1].score;
        const t = now + 0.5;
        if (a === b) SMALL.draw(t);
        else if (game.ai[1] && b > a) SMALL.lose(t);
        else SMALL.win(t);
        duck(0.2, 3.5, t);
      }
    }
    if (game.phase !== "over") seen.over = false;
    seen.phase = game.phase;
  }

  // ---------------------------------------------------------------
  //  Switches, saving and starting
  // ---------------------------------------------------------------
  function applyLevels() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(sfxOn ? SFX_VOL : 0, ctx.currentTime, 0.02);
    musBus.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, ctx.currentTime, 0.05);
    if (!sfxOn) { stopWhistle(); stopEngine(); }
    syncTrack();
  }
  function save() {
    try { localStorage.setItem("rustyTanksSound", (sfxOn ? "1" : "0") + (musicOn ? "1" : "0")); } catch (e) { /* not saved */ }
  }
  function load() {
    try {
      const v = localStorage.getItem("rustyTanksSound");
      if (v && v.length === 2) { sfxOn = v[0] === "1"; musicOn = v[1] === "1"; }
    } catch (e) { /* default: on */ }
  }

  // Browsers only allow sound after the player has clicked or pressed a key
  function unlock() {
    if (!AC) return;
    if (!ctx) { attach(new AC()); applyLevels(); }
    if (ctx.state === "suspended") ctx.resume();
  }

  const api = {
    attach: attach,
    unlock: unlock,
    observe: observe,
    setSfx(on) { sfxOn = !!on; save(); applyLevels(); },
    setMusic(on) { musicOn = !!on; save(); applyLevels(); },
    get sfx() { return sfxOn; },
    get music() { return musicOn; },
    // For tests: build things at an exact time on an (offline) context
    _explosion(e, t) { explosionSound(e, t); },
    _launch(w, idx, x, t) { launchSound(w, idx, x, t); },
    _small: SMALL,
    _step: playStep,
    _styles: Object.keys(BOOM),
    _launches: Object.keys(LAUNCH),
    _clear() { voices = []; },
    _compose: compose,
    _profiles: PROFILES,
    _setBuses(sfx, music) { sfxOn = sfx; musicOn = music; },
  };

  if (typeof window !== "undefined") {
    load();
    const first = () => unlock();
    window.addEventListener("pointerdown", first, { passive: true });
    window.addEventListener("keydown", first, { passive: true });
    // M = music on/off
    window.addEventListener("keydown", (e) => {
      if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) {
        api.setMusic(!musicOn);
        const box = document.getElementById("music");
        if (box) box.checked = musicOn;
      }
    });
    // every button click gets a small blip (weapon cards a nicer one)
    document.addEventListener("click", (e) => {
      if (!ctx || ctx.state !== "running" || !sfxOn) return;
      const b = e.target.closest && e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.id === "fire") return;
      if (b.closest("#weaponGrid") || b.id === "draftRandom") SMALL.pick(ctx.currentTime);
      else SMALL.click(ctx.currentTime);
    });
  }
  return api;
})();
