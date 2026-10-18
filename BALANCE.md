# Balance report

Made with `node tests/balance.js` (computer opponent on *Normal*, season *Normal*). Re-run it after changing weapon numbers.

* **Net points / shot**: average points won minus points lost to own shots, from 80 aimed shots on random maps. The median weapon is **6.3**, Rivet Shot (the plain all-rounder) is the yardstick. Fire, fallout and fall damage are included for the shot's own turn; the extra fallout turns come on top.
* **Match win %**: how often the owner of the weapon won, over 120 computer-vs-computer matches with random weapon pools (about 40 games per weapon, so differences of less than about 15 points are just noise). Weapons the computer can't aim (marked `-`) are never fired by it, so their win rate only shows how they fare as dead weight in a loadout.

| Weapon | Computer can aim | Net / shot | Hit % | Effect lands % | Match win % |
|---|---|---:|---:|---:|---:|
| Nuclear Warhead | yes | 16.2 | 75 | 75 | 60 |
| Big Bolt | yes | 16.1 | 35 | 0 | 60 |
| Rolling Barrel | no | 16.1 | 43 | 0 | 44 |
| Seismic Slam | no | 15.9 | 80 | 0 | 53 |
| Ticker | no | 15.9 | 29 | 0 | 54 |
| Crusher Drop | yes | 14.6 | 31 | 0 | 53 |
| Fire Bomb | yes | 13.9 | 55 | 0 | 57 |
| Lava Glob | no | 13.5 | 24 | 0 | 56 |
| Arc Lamp | yes | 13.0 | 68 | 0 | 40 |
| Hail of Slag | yes | 13.0 | 78 | 0 | 46 |
| Rapid Rivets | yes | 12.0 | 26 | 0 | 36 |
| Wrecker | no | 12.0 | 43 | 0 | 52 |
| Anvil | yes | 11.9 | 23 | 0 | 58 |
| Ragged Quarry | yes | 11.9 | 28 | 0 | 68 |
| Fuse Line | yes | 11.9 | 65 | 0 | 56 |
| Napalm Shell | yes | 11.0 | 33 | 0 | 50 |
| Chain Rattler | yes | 10.2 | 44 | 0 | 67 |
| Cryo Bomb | yes | 9.9 | 54 | 54 | 42 |
| Earth Eater | no | 8.7 | 49 | 0 | 64 |
| Ember Rain | yes | 8.7 | 57 | 0 | 57 |
| Triple Rivet | yes | 7.8 | 43 | 0 | 53 |
| Shrapnel Pod | yes | 7.7 | 61 | 0 | 43 |
| Burrower | yes | 7.6 | 23 | 0 | 40 |
| Sludge Bomb | no | 7.6 | 48 | 48 | 57 |
| EMP Pulse | yes | 7.2 | 51 | 51 | 55 |
| Cube Cutter | yes | 7.1 | 28 | 0 | 51 |
| Scatter Nuts | no | 7.0 | 61 | 0 | 39 |
| Twin Splitter | no | 6.9 | 31 | 0 | 48 |
| Avalanche | no | 6.6 | 41 | 41 | 60 |
| Ricochet Rivet | no | 6.6 | 28 | 0 | 47 |
| Firework Rocket | yes | 6.3 | 56 | 0 | 41 |
| Rivet Shot | yes | 6.2 | 28 | 0 | 51 |
| Funnel Shell | yes | 6.2 | 28 | 0 | 50 |
| Mystery Crate | no | 5.9 | 34 | 4 | 40 |
| Triple Mound | no | 5.6 | 35 | 35 | 44 |
| Proximity Pod | yes | 5.6 | 28 | 0 | 50 |
| Tunneler | yes | 5.4 | 21 | 0 | 42 |
| Bowl Maker | no | 5.4 | 30 | 0 | 63 |
| Frost Shell | yes | 5.3 | 28 | 28 | 48 |
| Trench Digger | yes | 5.2 | 34 | 0 | 33 |
| Pogo Bomb | no | 5.1 | 20 | 0 | 57 |
| Moat Maker | no | 4.8 | 24 | 0 | 45 |
| Needle Gun | yes | 4.7 | 15 | 0 | 37 |
| Magnet Dart | yes | 4.3 | 23 | 0 | 66 |
| Dirty Bomb | yes | 4.3 | 65 | 65 | 49 |
| Diamond Cutter | yes | 4.2 | 14 | 0 | 46 |
| Hornet Swarm | yes | 4.0 | 51 | 0 | 44 |
| Star Quarry | yes | 4.0 | 19 | 0 | 50 |
| Fan of Five | yes | 4.0 | 35 | 0 | 56 |
| Post Hole | no | 3.6 | 20 | 0 | 57 |
| Slag Heap | no | 3.0 | 19 | 19 | 59 |
| Silo Drill | yes | 2.8 | 15 | 0 | 44 |
| Landfill | no | 2.8 | 18 | 18 | 48 |
| Mud Pie | no | 2.0 | 13 | 13 | 49 |
| Wobble Shot | yes | 1.9 | 20 | 0 | 43 |
| Gale Cannon | no | 0.8 | 16 | 0 | 54 |
| Gravity Well | no | 0.6 | 15 | 0 | 45 |
| Scrap Wall | no | 0.0 | 0 | 0 | 52 |
| Warp Hop | no | 0.0 | 0 | 0 | 29 |
| Rocket Hop | no | 0.0 | 0 | 0 | 50 |
| Spire | no | 0.0 | 0 | 0 | 54 |

## What was changed because of the numbers
* The first run showed outliers: Lava Glob 33, Seismic Slam 31, Fire Bomb 24, Arc Lamp 19 and Napalm 19 points per shot (the median was under 5). Flame damage, quake damage and arc damage were cut; Nuclear Warhead, Rolling Barrel, Hail of Slag, Fuse Line and Crusher Drop were trimmed.
* Needle Gun and Anvil were close to useless for the computer (hit rate 15% and 1%): Needle Gun got a bigger blast, Anvil a longer reach.
* Weapons that only dig or build earned almost nothing. Now burying an enemy gives +16, freezing a turret or an EMP hit +12, and a tank that falls into a hole takes fall damage (up to 20) credited to the shooter.
* Weapons that are pure movement or defence (Warp Hop, Rocket Hop, Scrap Wall, Spire, Earth Eater) don't score by design. Treat them as tactical choices, not damage dealers.
