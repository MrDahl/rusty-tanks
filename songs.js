// ---------------------------------------------------------------
//  The soundtrack: one hand-composed song for every kind of weather, from calm to apocalyptic.
//  This file is only music data (notes, chords, which instruments play when).
//  sound.js plays it, like a tiny tracker.
//
//  Writing a tune: one string per bar of 16 steps. "G5-2 Bb5-1 r-1" = note name + length in steps
//  (r = rest). b = flat, # = sharp. Every bar must add up to 16 steps, or the game says so.
// ---------------------------------------------------------------
const SONGS = (function () {
  const NOTE_NUM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function tune(bars) {
    return bars.map((str) => {
      const row = new Array(16).fill(null);
      let step = 0;
      str.trim().split(/\s+/).forEach((tok) => {
        const parts = tok.split("-"), n = parseInt(parts[1], 10);
        if (parts[0] !== "r") {
          const m = /^([A-G])([b#]?)(\d)$/.exec(parts[0]);
          if (!m) throw new Error("bad note " + tok);
          row[step] = { m: 12 * (parseInt(m[3], 10) + 1) + NOTE_NUM[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0), len: n };
        }
        step += n;
      });
      if (step !== 16) throw new Error("tune bar is " + step + " steps: " + str);
      return row;
    });
  }

  // chords: semitones above the root (two octaves of them, so arpeggios can cascade)
  const MIN = [0, 3, 7, 12, 15, 19], MAJ = [0, 4, 7, 12, 16, 19], MIN7 = [0, 3, 7, 10, 15, 19], MAJ7 = [0, 4, 7, 11, 16, 19];
  const x = (a, b) => Object.assign({}, a, b);

  // ================= 1. NORMAL: calm and relaxed (D major, 104 BPM) =================
  const calmA = tune([
    "F#5-4 A5-4 F#5-2 E5-2 D5-4", "E5-4 A5-6 G5-2 E5-4", "D5-4 F#5-4 B5-4 A5-2 F#5-2", "B5-6 A5-2 G5-4 D5-4",
    "F#5-4 A5-4 D6-4 C#6-2 A5-2", "E6-6 C#6-2 A5-4 E5-4", "B5-4 D6-4 B5-2 A5-2 G5-4", "A5-4 G5-2 F#5-2 E5-8",
  ]);
  const calmB = tune([
    "B5-4 D6-4 B5-4 G5-4", "A5-4 D6-4 C#6-2 A5-2 F#5-4", "G5-4 B5-4 E6-6 D6-2", "C#6-4 E6-4 C#6-2 B5-2 A5-4",
    "D6-4 B5-2 D6-2 G6-4 F#6-4", "A5-2 D6-2 F#6-4 E6-2 D6-2 A5-4", "B5-4 G5-4 E5-4 G5-4", "E5-2 A5-2 C#6-4 E6-8",
  ]);
  const calmPA = [[0, MAJ7], [7, MAJ], [9, MIN7], [5, MAJ7], [0, MAJ7], [7, MAJ], [5, MAJ7], [7, MAJ]];
  const calmPB = [[5, MAJ7], [0, MAJ7], [2, MIN7], [7, MAJ], [5, MAJ7], [0, MAJ7], [2, MIN7], [7, MAJ]];
  const calmPI = [[0, MAJ7], [7, MAJ], [9, MIN7], [5, MAJ7]];
  const calmBase = {
    arp: { pat: [0, 1, 2, 3, 4, 3, 2, 1], step: 2, duty: 0.5, vol: 0.06, len: 1.7 },
    bass: { hits: [0, 8], up: [], len: 7, vol: 0.3, crunch: 0 },
    pad: 0.07,
  };
  const calmDrums = { kick: [0, 8], snare: [], rim: [4, 12], hat: 4, vol: 0.3 };
  const calm = {
    bpm: 104, key: 50,
    sections: [
      x(calmBase, { prog: calmPI, tune: null }),
      x(calmBase, { prog: calmPA, tune: calmA, drums: calmDrums, lead: { vol: 0.15, duty: 0.5, vib: { rate: 5, cents: 10 }, echo: 0.4 } }),
      x(calmBase, { prog: calmPB, tune: calmB, drums: calmDrums, lead: { vol: 0.15, duty: 0.25, vib: { rate: 5, cents: 10 }, echo: 0.4 } }),
      x(calmBase, { prog: calmPA, tune: calmA, drums: calmDrums, lead: { vol: 0.15, duty: 0.5, vib: { rate: 5, cents: 10 }, echo: 0.4, octUp: true } }),
      x(calmBase, { prog: calmPB, tune: calmB, drums: calmDrums, lead: { vol: 0.15, duty: 0.25, vib: { rate: 5, cents: 10 }, echo: 0.4, octUp: true } }),
    ],
  };

  // ================= 2. MONSOON: rain and melancholy (A minor, 116 BPM) =================
  const monA = tune([
    "E5-4 A5-4 C6-4 B5-2 A5-2", "A5-4 C6-6 A5-2 F5-4", "G5-4 C6-4 E6-6 D6-2", "D6-4 B5-4 G5-4 B5-2 D6-2",
    "C6-4 E6-4 D6-2 C6-2 B5-4", "C6-4 A5-4 C6-2 D6-2 C6-4", "D6-4 F6-4 E6-2 D6-2 A5-4", "G#5-4 B5-4 E6-8",
  ]);
  const monB = tune([
    "F5-2 A5-2 D6-4 C6-2 A5-2 F5-4", "G5-2 B5-2 D6-4 B5-2 G5-2 D5-4", "E5-2 G5-2 C6-4 E6-4 D6-2 C6-2", "C6-2 B5-2 A5-4 C6-2 E6-6",
    "A5-2 C6-2 F6-4 E6-2 C6-2 A5-4", "B5-2 D6-2 G6-4 F6-2 D6-2 B5-4", "B5-2 E6-2 G#6-4 E6-2 B5-2 G#5-4", "A5-4 C6-4 E6-8",
  ]);
  const monPA = [[0, MIN7], [8, MAJ7], [3, MAJ], [10, MAJ], [0, MIN7], [8, MAJ7], [5, MIN7], [7, MAJ]];
  const monPB = [[5, MIN7], [10, MAJ], [3, MAJ], [0, MIN7], [8, MAJ7], [10, MAJ], [7, MAJ], [0, MIN]];
  const monPI = [[0, MIN7], [8, MAJ7], [3, MAJ], [10, MAJ]];
  const monBase = {
    arp: { pat: [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 3], step: 1, duty: 0.125, vol: 0.09, len: 0.55 },
    bass: { hits: [0, 3, 8, 11], up: [3, 11], len: 2.2, vol: 0.32, crunch: 0.2 },
    pad: 0.05,
  };
  const monDrums = { kick: [0, 6, 8], snare: [4, 12], hat: 2, hatVol: 0.12, vol: 0.4 };
  const monLead = { vol: 0.17, duty: 0.25, vib: { rate: 5.2, cents: 13 }, echo: 0.38 };
  const mon = {
    bpm: 116, key: 45,
    sections: [
      x(monBase, { prog: monPI, tune: null, drums: { kick: [], snare: [], hat: 4, hatVol: 0.1, vol: 0.4 } }),
      x(monBase, { prog: monPA, tune: monA, drums: monDrums, lead: monLead }),
      x(monBase, { prog: monPB, tune: monB, drums: monDrums, lead: monLead }),
      x(monBase, { prog: monPA, tune: monA, drums: monDrums, lead: x(monLead, { octUp: true }) }),
      x(monBase, { prog: monPB, tune: monB, drums: monDrums, lead: x(monLead, { octUp: true }) }),
    ],
  };

  // ================= 3. ICE AGE: cold, glassy and tense (E minor, 126 BPM) =================
  const iceA = tune([
    "B5-6 B5-2 E6-4 D6-2 B5-2", "C6-6 C6-2 E6-4 D6-2 C6-2", "D6-6 D6-2 G6-4 F#6-2 D6-2", "A5-4 D6-4 F#6-6 E6-2",
    "G5-4 B5-4 E6-6 B5-2", "E5-4 G5-4 C6-4 G5-4", "A5-4 C6-4 E6-6 C6-2", "D#6-4 F#6-4 B5-8",
  ]);
  const iceB = tune([
    "E6-2 D6-2 B5-2 D6-2 E6-4 G6-4", "E6-2 D6-2 C6-2 D6-2 E6-4 C6-4", "D6-2 B5-2 D6-2 G6-2 F#6-4 D6-4", "F#6-2 E6-2 D6-2 E6-2 F#6-4 A6-4",
    "C6-2 E6-2 C6-2 E6-2 A5-4 C6-4", "G5-2 C6-2 E6-2 C6-2 G6-4 E6-4", "A5-2 C6-2 E6-2 C6-2 A5-8", "D#6-2 F#6-2 B5-4 A#5-2 F#5-2 B5-4",
  ]);
  const icePA = [[0, MIN7], [8, MAJ7], [3, MAJ], [10, MAJ], [0, MIN7], [8, MAJ7], [5, MIN7], [7, MAJ]];
  const icePI = [[0, MIN7], [8, MAJ7], [3, MAJ], [7, MAJ]];
  const iceBase = {
    arp: { pat: [0, 3, 5, 3, 4, 2, 5, 4], step: 2, duty: 0.125, vol: 0.09, len: 2.4, oct: 24 },
    bass: { hits: [0, 6, 8, 14], up: [6, 14], len: 3, vol: 0.3, crunch: 0 },
    pad: 0.09,
  };
  const iceLead = { vol: 0.16, pwm: { duty: 0.5, depth: 0.3, rate: 0.8 }, vib: { rate: 4.5, cents: 9 }, echo: 0.5 };
  const ice = {
    bpm: 126, key: 52,
    sections: [
      x(iceBase, { prog: icePI, tune: null }),
      x(iceBase, { prog: icePA, tune: iceA, drums: { kick: [0, 8], snare: [], rim: [12], hat: 4, hatVol: 0.14, vol: 0.4 }, lead: iceLead }),
      x(iceBase, { prog: icePA, tune: iceB, drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: 2, hatVol: 0.14, vol: 0.45 }, lead: iceLead, arp: x(iceBase.arp, { step: 1, pat: [0, 3, 5, 3, 4, 2, 5, 4, 0, 3, 5, 4, 5, 3, 2, 1], len: 1.4 }) }),
      x(iceBase, { prog: icePA, tune: iceA, drums: { kick: [0, 8], snare: [4, 12], hat: 4, hatVol: 0.14, vol: 0.45 }, lead: x(iceLead, { octUp: true }) }),
      x(iceBase, { prog: icePA, tune: iceB, drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: 2, open: true, hatVol: 0.14, vol: 0.5, crash: true }, lead: x(iceLead, { octUp: true }), arp: x(iceBase.arp, { step: 1, pat: [0, 3, 5, 3, 4, 2, 5, 4, 0, 3, 5, 4, 5, 3, 2, 1], len: 1.4 }) }),
    ],
  };

  // ================= 4. THUNDERSTORM: driving, with thunder (D minor, 138 BPM) =================
  const thA = tune([
    "A5-2 A5-1 D6-1 F6-4 E6-2 D6-2 A5-2 r-2", "D6-2 D6-1 F6-1 G6-4 F6-2 D6-2 Bb5-2 r-2", "C6-2 C6-1 D6-1 F6-4 E6-2 C6-2 A5-2 r-2", "G5-2 G5-1 C6-1 E6-4 D6-2 C6-2 G5-2 r-2",
    "D6-2 D6-1 E6-1 F6-4 A6-4 F6-2 D6-2", "Bb5-2 D6-2 F6-4 D6-2 Bb5-2 F5-4", "G5-2 Bb5-2 D6-2 G6-4 F6-2 D6-2 Bb5-2", "C#6-2 E6-2 A6-4 G6-2 E6-2 C#6-2 A5-2",
  ]);
  const thB = tune([
    "D6-3 D6-1 F6-4 F6-2 E6-2 D6-4", "C6-3 C6-1 F6-4 A6-2 G6-2 F6-4", "E6-3 E6-1 G6-4 G6-2 F6-2 E6-4", "F6-3 F6-1 A6-4 D6-4 F6-4",
    "D6-2 D6-1 Bb5-1 F6-4 D6-4 Bb5-4", "C6-2 C6-1 A5-1 F6-4 C6-4 A5-4", "D6-2 G6-2 F6-2 D6-2 Bb5-2 D6-2 G5-4", "E6-2 C#6-2 A5-2 C#6-2 E6-4 A6-4",
  ]);
  const thPA = [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [5, MIN], [7, MAJ]];
  const thPB = [[8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [3, MAJ], [5, MIN], [7, MAJ]];
  const thPI = [[0, MIN], [8, MAJ], [3, MAJ], [7, MAJ]];
  const thArp = { pat: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2], step: 1, duty: 0.25, vol: 0.1, len: 0.9 };
  const thArpB = x(thArp, { pat: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 3, 4, 5, 3], duty: 0.125 });
  const thBass = { hits: [0, 3, 6, 8, 11, 14], up: [3, 11, 14], len: 1.9, vol: 0.34, crunch: 0.4 };
  const thDrumsA = { kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: 2, open: true, fill: true, crash: true, thunder: true, vol: 0.5 };
  const thLead = { vol: 0.2, duty: 0.25, vib: { rate: 5.5, cents: 12 }, echo: 0.35 };
  const th = {
    bpm: 138, key: 50,
    sections: [
      x({ arp: thArp, bass: x(thBass, { from: 1 }) }, { prog: thPI, tune: null, drums: { kick: [0, 8], kickFrom: 2, snare: [], hat: 4, vol: 0.5 } }),
      { prog: thPA, tune: thA, arp: thArp, bass: thBass, drums: thDrumsA, lead: thLead },
      { prog: thPB, tune: thB, arp: thArpB, bass: x(thBass, { hits: [0, 3, 6, 8, 11, 14] }), drums: x(thDrumsA, { kick: [0, 3, 4, 8, 10, 12] }), lead: x(thLead, { pwm: { duty: 0.45, depth: 0.28, rate: 1.7 }, vol: 0.18 }) },
      { prog: thPI, tune: null, arp: x(thArp, { pat: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3], duty: 0.5, vol: 0.1 }), bass: x(thBass, { hits: [0, 8], len: 7, crunch: 0 }), drums: { kick: [], snare: [], hat: 4, riser: true, vol: 0.5 } },
      { prog: thPA, tune: thA, arp: thArp, bass: thBass, drums: thDrumsA, lead: x(thLead, { pwm: { duty: 0.35, depth: 0.28, rate: 1.7 }, vol: 0.18, octUp: true }) },
      { prog: thPB, tune: thB, arp: thArpB, bass: thBass, drums: x(thDrumsA, { kick: [0, 3, 4, 8, 10, 12] }), lead: x(thLead, { pwm: { duty: 0.45, depth: 0.28, rate: 1.7 }, vol: 0.18, octUp: true }) },
    ],
  };

  // ================= 5. HURRICANE: the fast one (C minor, 150 BPM) =================
  const huA = tune([
    "G5-2 G5-1 Bb5-1 C6-4 Bb5-2 G5-2 Eb5-2 r-2", "Ab5-2 Ab5-1 C6-1 Eb6-4 D6-2 C6-2 Ab5-2 r-2", "G5-2 G5-1 Bb5-1 Eb6-4 D6-2 Bb5-2 G5-2 r-2", "F5-2 F5-1 Bb5-1 D6-3 C6-1 Bb5-2 F5-2 D5-2 r-2",
    "C6-2 C6-1 D6-1 Eb6-4 D6-2 C6-2 G5-2 r-2", "Eb6-2 D6-1 C6-1 Ab5-4 C6-2 Eb6-2 C6-2 r-2", "D6-2 D6-1 C6-1 Bb5-4 D6-2 F6-2 D6-2 r-2", "B5-2 D6-2 B5-2 G5-2 B5-2 D6-4 r-2",
  ]);
  const huB = tune([
    "C6-3 C6-1 Eb6-4 Eb6-2 D6-2 C6-4", "Bb5-3 Bb5-1 Eb6-4 G6-2 F6-2 Eb6-4", "D6-3 D6-1 F6-4 F6-2 Eb6-2 D6-4", "A5-3 A5-1 C6-4 F6-4 E6-2 C6-2",
    "Eb6-2 Eb6-1 C6-1 Ab5-2 C6-2 Eb6-4 C6-4", "G6-2 G6-1 Eb6-1 Bb5-2 Eb6-2 G6-4 Eb6-4", "F6-2 Eb6-1 C6-1 Ab5-2 C6-2 F6-2 C6-2 Ab5-2 r-2", "D6-2 B5-2 G5-2 B5-2 D6-2 G6-4 r-2",
  ]);
  const huPA = [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ], [0, MIN], [8, MAJ], [10, MAJ], [7, MAJ]];
  const huPB = [[8, MAJ], [3, MAJ], [10, MAJ], [5, MAJ], [8, MAJ], [3, MAJ], [5, MIN], [7, MAJ]];
  const huPI = [[0, MIN], [8, MAJ], [10, MAJ], [7, MAJ]];
  const huArpA = { pat: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2], step: 1, duty: 0.25, vol: 0.1, len: 0.9 };
  const huArpB = x(huArpA, { pat: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 3, 4, 5, 3], duty: 0.125 });
  const huBass = { hits: [0, 2, 3, 6, 8, 10, 11, 14], up: [3, 11, 14], len: 1.9, vol: 0.34, crunch: 0.4 };
  const huBassB = x(huBass, { hits: [0, 3, 6, 8, 11, 14] });
  const huDrums = { kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: 2, open: true, fill: true, crash: true, vol: 0.5 };
  const huLead = { vol: 0.2, duty: 0.25, vib: { rate: 5.5, cents: 12 }, echo: 0.35 };
  const hu = {
    bpm: 150, key: 48,
    sections: [
      { prog: huPI, tune: null, arp: x(huArpA, { vol: 0.085 }), bass: x(huBass, { from: 1 }), drums: { kick: [0, 8], kickFrom: 2, snare: [], hat: 4, vol: 0.5 } },
      { prog: huPA, tune: huA, arp: huArpA, bass: huBass, drums: huDrums, lead: huLead },
      { prog: huPB, tune: huB, arp: huArpB, bass: huBassB, drums: x(huDrums, { kick: [0, 3, 4, 8, 10, 12] }), lead: x(huLead, { pwm: { duty: 0.45, depth: 0.28, rate: 1.7 }, vol: 0.18 }) },
      { prog: huPI, tune: null, arp: x(huArpA, { pat: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3], duty: 0.5 }), bass: x(huBass, { hits: [0, 8], len: 7, crunch: 0 }), drums: { kick: [], snare: [], hat: 4, riser: true, vol: 0.5 } },
      { prog: huPA, tune: huA, arp: huArpA, bass: huBass, drums: huDrums, lead: x(huLead, { pwm: { duty: 0.35, depth: 0.28, rate: 1.7 }, vol: 0.18, octUp: true }) },
      { prog: huPB, tune: huB, arp: huArpB, bass: huBassB, drums: x(huDrums, { kick: [0, 3, 4, 8, 10, 12] }), lead: x(huLead, { pwm: { duty: 0.45, depth: 0.28, rate: 1.7 }, vol: 0.18, octUp: true }) },
    ],
  };

  // ================= 6. APOCALYPSE: the end of the world (F minor, 172 BPM) =================
  const apA = tune([
    "F5-1 F5-1 Ab5-1 C6-1 F6-4 Eb6-2 C6-2 Ab5-4", "Db6-1 Db6-1 F6-1 Ab6-1 F6-4 Db6-2 Ab5-2 F5-4",
    "Bb5-1 Bb5-1 Db6-1 F6-1 Eb6-4 Db6-2 Bb5-2 F5-4", "C6-1 C6-1 E6-1 G6-1 C6-4 B5-2 G5-2 E5-4",
    "F6-2 F6-1 Eb6-1 C6-2 Ab5-2 C6-2 Eb6-2 F6-4", "Gb5-2 Bb5-2 Db6-2 Gb6-6 F6-2 Db6-2",
    "Bb5-2 Db6-2 F6-2 Db6-2 Bb5-2 F6-2 Db6-2 Bb5-2", "G5-2 C6-2 E6-2 G6-4 E6-2 C6-2 G5-2",
  ]);
  const apB = tune([
    "F6-4 F6-2 Ab6-2 F6-4 Db6-4", "Eb6-4 Eb6-2 Ab6-2 Eb6-4 C6-4", "G6-4 G6-2 F6-2 Eb6-4 Bb5-4", "E6-4 G6-4 E6-4 C6-4",
    "Ab6-2 F6-2 Db6-2 F6-2 Ab6-8", "C6-2 Eb6-2 Ab6-2 Eb6-2 C6-8", "Db6-2 F6-2 Db6-2 Bb5-2 F6-8", "G5-2 B5-2 D6-2 G6-2 G6-8",
  ]);
  const apPA = [[0, MIN], [8, MAJ], [5, MIN], [7, MAJ], [0, MIN], [1, MAJ], [5, MIN], [7, MAJ]];
  const apPB = [[8, MAJ], [3, MAJ], [10, MAJ], [7, MAJ], [8, MAJ], [3, MAJ], [5, MIN], [7, MAJ]];
  const apPI = [[0, MIN], [8, MAJ], [5, MIN], [7, MAJ]];
  const apArp = { pat: [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 5, 4, 3, 2], step: 1, duty: 0.125, vol: 0.105, len: 0.85 };
  const apBass = { hits: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15], up: [3, 7, 11, 15], len: 1.2, vol: 0.36, crunch: 0.6 };
  const apDrums = { kick: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], snare: [4, 12], hat: 1, hatVol: 0.12, open: true, fill: true, crash: true, rumble: true, fall: true, vol: 0.46 };
  const apLead = { vol: 0.21, pwm: { duty: 0.4, depth: 0.35, rate: 3.2 }, vib: { rate: 6.5, cents: 20 }, echo: 0.4, power: true };
  const ap = {
    bpm: 172, key: 53,
    sections: [
      { prog: apPI, tune: null, arp: x(apArp, { vol: 0.09 }), bass: x(apBass, { from: 1 }), drums: { kick: [0, 8], kickFrom: 2, snare: [], hat: 2, rumble: true, siren: true, vol: 0.52 } },
      { prog: apPA, tune: apA, arp: apArp, bass: apBass, drums: apDrums, lead: apLead },
      { prog: apPB, tune: apB, arp: x(apArp, { pat: [0, 2, 4, 5, 4, 2, 0, 2, 3, 5, 3, 1, 3, 5, 4, 2] }), bass: apBass, drums: x(apDrums, { snare: [4, 12], kick: [0, 3, 4, 8, 10, 12] }), lead: x(apLead, { octUp: true }) },
      { prog: apPI, tune: null, arp: x(apArp, { pat: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3], duty: 0.5 }), bass: x(apBass, { hits: [0, 8], len: 7, crunch: 0.3 }), drums: { kick: [], snare: [], hat: 4, riser: true, rumble: true, siren: true, vol: 0.52 } },
      { prog: apPA, tune: apA, arp: apArp, bass: apBass, drums: apDrums, lead: x(apLead, { octUp: true }) },
      { prog: apPB, tune: apB, arp: x(apArp, { pat: [0, 2, 4, 5, 4, 2, 0, 2, 3, 5, 3, 1, 3, 5, 4, 2] }), bass: apBass, drums: x(apDrums, { kick: [0, 3, 4, 8, 10, 12] }), lead: x(apLead, { octUp: true }) },
    ],
  };

  // The weather names are the same as in game.js. Anything unknown gets the calm song.
  const all = { normal: calm, monsoon: mon, iceage: ice, thunderstorm: th, hurricane: hu, apocalypse: ap };

  // Unroll every song into a flat list of bars: { sec, i (bar in section), n (bars in section), root, chord, lead }
  Object.keys(all).forEach((k) => {
    const song = all[k];
    song.bars = [];
    song.sections.forEach((sec, si) => {
      sec.prog.forEach((c, i) => song.bars.push({ sec: sec, si: si, i: i, n: sec.prog.length, root: c[0], chord: c[1], lead: sec.tune ? sec.tune[i] : null }));
    });
  });
  return { all: all, tune: tune };
})();
if (typeof module !== "undefined") module.exports = SONGS;
