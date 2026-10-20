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
COLS_A = [(13, 356), (373, 716), (734, 1078), (1095, 1438)]
SHEETS = {
    "shells": ("sheet4_shells.png", COLS_A, [(15, 255), (272, 521), (536, 783), (799, 1062)]),
    "ground": ("sheet5_ground.png", COLS_A, [(15, 261), (276, 524), (539, 768), (783, 1055)]),
    "forces": ("sheet6_forces.png", COLS_A, [(17, 253), (271, 518), (534, 768), (782, 1047)]),
    "fireground": ("sheet7_fire_ground.png", COLS_A, [(13, 257), (273, 522), (536, 769), (783, 1057)]),
}

# What is on each sheet, in reading order (row by row, left to right). Icons that are used for a weapon carry the weapon's name.
CONTENT = {
    "shells": ["Scatter Nuts", "Pogo Bomb", "Triple Rivet", "Fan of Five", "Proximity Pod", "Ticker", "Wrecker", "Anvil",
               "Crusher Drop", "Fuse Line", "Chain Rattler", "Wobble Shot", "Rocket Hop", "Mystery Crate", "Firework Rocket", "Dirty Bomb"],
    "ground": ["Post Hole", "Earth Eater (round bite)", "Scrap Wall", "Avalanche", "Spire", "Triple Mound", "Landfill", "Trench Digger",
               "Diamond Cutter", "Star Quarry", "Cube Cutter", "Funnel Shell", "Ragged Quarry", "Bowl Maker", "Moat Maker", "Cryo Bomb"],
    "forces": ["Rivet Shot", "Big Bolt", "Rapid Rivets", "Needle Gun", "Magnet Dart", "Hornet Swarm", "Twin Splitter", "Shrapnel Pod",
               "Ricochet Rivet", "Rolling Barrel", "Warp Hop", "Gale Cannon", "Gravity Well", "Arc Lamp", "Hail of Slag", "Seismic Slam"],
    "fireground": ["Burrower", "Silo Drill", "Tunneler", "Slag Heap", "Sludge Bomb", "Mud Pie", "Frost Shell", "Napalm Shell",
                   "Fire Bomb", "Lava Glob", "Ember Rain", "Nuclear Warhead", "EMP Pulse", "Earth Eater (jagged bite)", "Earth Eater", "Earth Eater (vacuum)"],
}

# Weapon name -> (sheet, icon name on that sheet).  A weapon that has no entry gets a plain placeholder.
# Every icon whose name is a weapon's name is used for that weapon. To use another icon, change its line here.
MAP = {}
for sheet, names in CONTENT.items():
    for name in names:
        if "(" not in name:
            MAP[name] = (sheet, name)


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
