#!/usr/bin/env python3
"""Builds assets/weapon-icons.webp (+ .json) from the art sheets in assets/weapon-art/.

Run it from the repo folder:   python3 tools/build_weapon_icons.py
Needs Python with Pillow (pip install pillow) and Node (to read the weapon names).

What it does: cuts every icon out of its sheet (just inside the neon frame), scales it to one
common size and packs all weapons into one picture, in the same order as weapons.js.
To change an icon: edit the MAP below (or replace the sheet) and run the script again.
"""
import json, subprocess, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, "assets", "weapon-art")
CELL_W, CELL_H = 144, 96          # size of one icon in the finished picture (3:2)
COLS = 8
INSET = 12                         # pixels cut away inside the frame (removes the neon outline)

# Frame positions on each sheet: columns (left, right) and rows (top, bottom), found by looking for the neon outlines.
OLD_COLS = [(110, 578), (681, 1148), (1252, 1719), (1822, 2289)]
OLD_ROWS = [(74, 383), (506, 812), (933, 1241), (1360, 1668)]
NEW_COLS = [(13, 356), (373, 716), (734, 1078), (1095, 1438)]
SHEETS = {
    "s1": ("sheet1.jpg", OLD_COLS, OLD_ROWS),
    "s2": ("sheet2.jpg", OLD_COLS, OLD_ROWS),
    "s3": ("sheet3.jpg", OLD_COLS, OLD_ROWS),
    "shells": ("sheet4_shells.png", NEW_COLS, [(15, 255), (272, 521), (536, 783), (799, 1062)]),
    "ground": ("sheet5_ground.png", NEW_COLS, [(15, 261), (276, 524), (539, 768), (783, 1055)]),
}

# What is on each sheet, in reading order (row by row, left to right)
CONTENT = {
    "s1": ["Tsunami", "Magma Flow", "Geyser", "Plasma Ball", "Gravity Well", "Tornado", "Photon Rain", "Heli-Bomb",
           "Rock Drill", "Vulcan", "Acid Blast", "Fireball", "Teleport", "Shield", "Meteor", "Doomsday"],
    "s2": ["Laser", "Shockwave", "Cluster Bomb", "Lightning", "Bouncer", "Black Hole", "Ghost Shot", "Ice Spikes",
           "Swarm", "Mud Bomb", "Railgun", "Reflector", "Dirt Bomb", "Orbital Beam", "Spider Bomb", "EMP Blast"],
    "s3": ["Single", "Big Shot", "Burrower", "Acid Rain", "Splitter", "Roller", "Dirt Mover", "Digger",
           "Volcano", "Sniper", "Tracer", "Napalm", "Seismic", "Homing", "Barrier", "Nuke"],
    "shells": ["Scatter Nuts", "Pogo Bomb", "Triple Rivet", "Fan of Five", "Proximity Pod", "Ticker", "Wrecker", "Anvil",
               "Crusher Drop", "Fuse Line", "Chain Rattler", "Wobble Shot", "Rocket Hop", "Mystery Crate", "Firework Rocket", "Dirty Bomb"],
    "ground": ["Post Hole", "Earth Eater", "Scrap Wall", "Avalanche", "Spire", "Triple Mound", "Landfill", "Trench Digger",
               "Diamond Cutter", "Star Quarry", "Cube Cutter", "Funnel Shell", "Ragged Quarry", "Bowl Maker", "Moat Maker", "Cryo Bomb"],
}

# Weapon name -> (sheet, icon name on that sheet).  A weapon that has no entry gets a plain placeholder.
MAP = {
    "Rivet Shot": ("s3", "Single"), "Big Bolt": ("s3", "Big Shot"), "Burrower": ("s3", "Burrower"),
    "Slag Heap": ("s2", "Dirt Bomb"), "Rapid Rivets": ("s1", "Vulcan"), "Magnet Dart": ("s3", "Homing"),
    "Needle Gun": ("s3", "Sniper"), "Ricochet Rivet": ("s2", "Bouncer"), "Rolling Barrel": ("s3", "Roller"),
    "Sludge Bomb": ("s3", "Dirt Mover"), "Shrapnel Pod": ("s2", "Cluster Bomb"), "Hail of Slag": ("s1", "Meteor"),
    "Warp Hop": ("s1", "Teleport"), "Mud Pie": ("s2", "Mud Bomb"), "Silo Drill": ("s3", "Digger"),
    "Tunneler": ("s1", "Rock Drill"), "Gale Cannon": ("s1", "Tornado"), "Gravity Well": ("s1", "Gravity Well"),
    "Hornet Swarm": ("s2", "Swarm"), "Arc Lamp": ("s2", "Lightning"), "Twin Splitter": ("s3", "Splitter"),
    "Seismic Slam": ("s3", "Seismic"), "Frost Shell": ("s2", "Ice Spikes"), "Napalm Shell": ("s3", "Napalm"),
    "Fire Bomb": ("s1", "Fireball"), "Lava Glob": ("s1", "Magma Flow"), "Ember Rain": ("s3", "Volcano"),
    "Nuclear Warhead": ("s3", "Nuke"), "EMP Pulse": ("s2", "EMP Blast"),
}
# The new sheets: the icon has the same name as the weapon
for name in CONTENT["shells"]: MAP[name] = ("shells", name)
for name in CONTENT["ground"]: MAP[name] = ("ground", name)
MAP["Cryo Bomb"] = ("ground", "Cryo Bomb")


def weapon_names():
    out = subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./weapons.js').WEAPONS.map(w=>w.name)))"],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def cut(sheet_key, icon_name, cache={}):
    fname, cols, rows = SHEETS[sheet_key]
    if fname not in cache:
        cache[fname] = Image.open(os.path.join(ART, fname)).convert("RGB")
    im = cache[fname]
    n = CONTENT[sheet_key].index(icon_name)
    (l, r), (t, b) = cols[n % 4], rows[n // 4]
    box = [l + INSET, t + INSET, r - INSET, b - INSET]
    # crop to the 3:2 shape of the cell (cut equally from both sides), then scale down
    w, h = box[2] - box[0], box[3] - box[1]
    want = CELL_W / CELL_H
    if w / h > want:
        d = int(w - h * want); box[0] += d // 2; box[2] -= d - d // 2
    else:
        d = int(h - w / want); box[1] += d // 2; box[3] -= d - d // 2
    return im.crop(tuple(box)).resize((CELL_W, CELL_H), Image.LANCZOS)


def main():
    names = weapon_names()
    rows = (len(names) + COLS - 1) // COLS
    atlas = Image.new("RGB", (COLS * CELL_W, rows * CELL_H), (10, 15, 36))
    index, missing = {}, []
    for i, name in enumerate(names):
        index[name] = i
        if name in MAP:
            atlas.paste(cut(*MAP[name]), ((i % COLS) * CELL_W, (i // COLS) * CELL_H))
        else:
            missing.append(name)
    out_png = os.path.join(ROOT, "assets", "weapon-icons.webp")
    atlas.save(out_png, "WEBP", quality=88, method=6)
    meta = {"file": "assets/weapon-icons.webp", "cellW": CELL_W, "cellH": CELL_H, "cols": COLS, "index": index}
    with open(os.path.join(ROOT, "assets", "weapon-icons.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("icons:", len(names) - len(missing), "of", len(names), "| atlas", atlas.size, "|", os.path.getsize(out_png) // 1024, "KB")
    if missing:
        print("no art yet for:", ", ".join(missing))


if __name__ == "__main__":
    sys.exit(main())
