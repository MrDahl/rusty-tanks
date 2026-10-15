# Rusty Tanks
<p align="left">
  <img src="assets/tanks_logo.svg" alt="Rusty Tanks by Marc Sonne Dahl" width="200">
</p>
A two-player artillery game for the browser, inspired by classic tank games. Built from a clean slate: all code is original.

Play it: https://mrdahl.github.io/rusty-tanks/

## How to play
- Pick 1 Player (vs the computer: Easy, Normal or Hard) or 2 Players on one screen from the main menu.
- Then draft your weapons: players take turns picking 10 weapons each from a pool of 29 (both players may pick the same one). Each pick is one use in the battle.
- Loose dirt falls: overhangs and tunnel roofs collapse after every shot.
- Each turn: optionally drive a little (60 px per turn), set angle and power, choose a weapon and fire. Watch the wind.
- Hits earn points, hitting yourself loses points. Each player gets 10 shots.

Keys: left/right = angle, up/down = power (hold Shift for big steps), A / D = drive, 1-9 = choose weapon, Space = fire, N = rematch (same weapons), Esc = menu.

## Files
- `index.html`: page layout and styling
- `weapons.js`: the list of weapons (copy a line to invent a new one)
- `game.js`: the rules (terrain, physics, wind, scoring, turns, computer opponent)
- `main.js`: drawing, menus, weapon draft and controls
