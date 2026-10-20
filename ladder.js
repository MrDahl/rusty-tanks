// The Ladder: five matches against computer opponents, each in a harsher world.
// This file only holds the rules and the progress (no drawing), so it can be tested on its own.

const LADDER_RUNGS = [
  { name: "Rookie",    ai: "easy",   season: "normal",       wind: 0,   quip: "Fresh out of the scrapyard. Calm skies, no wind. Be gentle." },
  { name: "Mudlark",   ai: "easy",   season: "monsoon",      wind: 0.5, quip: "Rain and mud. A tank that sits still sinks, so keep moving." },
  { name: "Frostbite", ai: "normal", season: "iceage",       wind: 1,   quip: "Slippery ground and bouncy shells. Everything slides." },
  { name: "Thunder",   ai: "hard",   season: "thunderstorm", wind: 1,   quip: "A sharp shooter, and lightning strikes every turn." },
  { name: "Doomsday",  ai: "hard",   season: "apocalypse",   wind: 1.5, quip: "Meteors fall, the wind howls, and the computer does not miss." },
];
const LADDER_CONTINUES = 2;      // how many lost matches you may retry before the ladder starts over

const WIND_WORDS = { 0: "No wind", 0.5: "Light wind", 1: "Normal wind", 1.5: "Strong wind" };

class LadderRun {
  // saved = what toJSON() gave earlier (or nothing for a fresh ladder)
  constructor(saved) {
    this.reset();
    if (saved && typeof saved === "object") {
      const n = LADDER_RUNGS.length;
      if (Number.isInteger(saved.rung) && saved.rung >= 0 && saved.rung <= n) this.rung = saved.rung;
      if (Number.isInteger(saved.continues) && saved.continues >= 0 && saved.continues <= LADDER_CONTINUES) this.continues = saved.continues;
      if (Array.isArray(saved.results)) this.results = saved.results.slice(0, n).map((r) => (r && typeof r.you === "number" && typeof r.cpu === "number" ? { you: r.you, cpu: r.cpu } : null));
      if (Number.isInteger(saved.titles) && saved.titles > 0) this.titles = saved.titles;
    }
  }
  reset() {
    this.rung = 0;                       // the next match to play (5 = the ladder is won)
    this.continues = LADDER_CONTINUES;
    this.results = Array(LADDER_RUNGS.length).fill(null);
    if (this.titles === undefined) this.titles = 0;   // how many times the whole ladder was won
  }
  get size() { return LADDER_RUNGS.length; }
  get done() { return this.rung >= LADDER_RUNGS.length; }
  get current() { return this.done ? null : LADDER_RUNGS[this.rung]; }

  // A match ended: say what happens next.
  //   "advance"  you won, on to the next opponent       "champion"  you won the last one
  //   "retry"    you lost, a continue was used          "failed"    you lost with no continues left: starts over
  //   "draw"     nobody won, play the match again
  finish(you, cpu) {
    if (this.done) return "champion";
    if (you === cpu) return "draw";
    if (you > cpu) {
      this.results[this.rung] = { you, cpu };
      this.rung++;
      if (this.done) { this.titles++; return "champion"; }
      return "advance";
    }
    if (this.continues > 0) { this.continues--; return "retry"; }
    this.reset();
    return "failed";
  }
  // After the champion screen: start a new run (keeps the title count)
  restart() { this.reset(); }

  toJSON() { return { rung: this.rung, continues: this.continues, results: this.results, titles: this.titles }; }
}

if (typeof module !== "undefined") module.exports = { LADDER_RUNGS, LADDER_CONTINUES, WIND_WORDS, LadderRun };
