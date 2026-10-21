// Checks the weather songs: every weather has one, every tune bar adds up, notes stay in a playable range.
const SONGS = require("../songs.js");
let ok = true;
const check = (c, m) => { if (!c) { ok = false; console.log("FAIL:", m); } else console.log("ok:", m); };
const WEATHER = ["normal", "monsoon", "iceage", "thunderstorm", "hurricane", "apocalypse"];
let lastBpm = 0;
for (const w of WEATHER) {
  const s = SONGS.all[w];
  check(!!s, w + " has a song");
  if (!s) continue;
  check(s.bars.length >= 32 && s.bars.length <= 48, w + " has " + s.bars.length + " bars");
  const notes = s.bars.filter((b) => b.lead).flatMap((b) => b.lead.filter(Boolean).map((n) => n.m));
  check(notes.length > 40 && Math.min(...notes) >= 60 && Math.max(...notes) <= 96, w + " melody range " + Math.min(...notes) + ".." + Math.max(...notes));
  check(s.bpm > lastBpm, w + " is faster (" + s.bpm + " BPM) than the one before");
  lastBpm = s.bpm;
  check(s.bars.every((b) => b.n > 0 && b.chord.length === 6), w + " every bar has a chord");
}
let threw = false;
try { SONGS.tune(["C5-4 D5-4"]); } catch (e) { threw = true; }
check(threw, "a bar that does not add up to 16 steps is refused");
console.log(ok ? "ALL SONG CHECKS PASSED" : "SONG CHECKS FAILED");
process.exit(ok ? 0 : 1);
