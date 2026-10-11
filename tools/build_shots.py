#!/usr/bin/env python3
"""
Build data/shots.json for Last Line from StatsBomb Open Data.

Usage:
    python3 tools/build_shots.py                      # download from GitHub (cached)
    python3 tools/build_shots.py --local /path/to/open-data

See docs/DATA_METHODOLOGY.md for the rules implemented here.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
import time
from collections import Counter
from pathlib import Path

RAW_BASE = "https://raw.githubusercontent.com/hudl/open-data/master/data"

# Goal geometry in StatsBomb units
POST_LOW_Y, POST_HIGH_Y = 36.0, 44.0
GOAL_W = POST_HIGH_Y - POST_LOW_Y
CROSSBAR_Z = 2.67
GOAL_CX, GOAL_CY = 120.0, 40.0

KEEP_OUTCOMES = {"Goal", "Saved", "Saved to Post"}
DIST_BANDS = [(0, 12, "< 12"), (12, 18, "12-18"), (18, 30, "18-30"), (30, 1e9, ">= 30")]
ROW_NAMES = ["top", "middle", "bottom"]
COL_NAMES = ["left", "centre", "right"]


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def grid_cell(end_y: float, end_z: float):
    """Return (u, v, col, row). col/row as seen on screen from behind the keeper."""
    gy = clamp(end_y, POST_LOW_Y, POST_HIGH_Y)
    gz = clamp(end_z, 0.0, CROSSBAR_Z)
    u = (POST_HIGH_Y - gy) / GOAL_W  # 0 = screen-left post (high y)
    v = gz / CROSSBAR_Z              # 0 = ground
    col = min(2, int(u * 3))
    row = 2 - min(2, int(v * 3))     # row 0 = top
    return u, v, col, row


def shots_from_events(events: list, stats: Counter) -> list:
    """Filter one match's events; return compact shot rows [x, y, u, v, col, row]."""
    out = []
    for ev in events:
        if ev.get("type", {}).get("name") != "Shot":
            continue
        stats["scanned"] += 1
        shot = ev.get("shot", {})
        if shot.get("type", {}).get("name") == "Penalty":
            stats["drop_penalty"] += 1
            continue
        if shot.get("outcome", {}).get("name") not in KEEP_OUTCOMES:
            stats["drop_off_target_or_blocked"] += 1
            continue
        end = shot.get("end_location") or []
        if len(end) < 3 or end[2] is None:
            stats["drop_no_height"] += 1
            continue
        loc = ev.get("location") or []
        if len(loc) < 2 or not (0 <= loc[0] <= 120 and 0 <= loc[1] <= 80):
            stats["drop_bad_location"] += 1
            continue
        u, v, col, row = grid_cell(float(end[1]), float(end[2]))
        out.append([round(loc[0], 1), round(loc[1], 1), round(u, 2), round(v, 2), col, row])
        stats["kept"] += 1
    return out


def distance(x: float, y: float) -> float:
    return math.hypot(GOAL_CX - x, GOAL_CY - y)


def grid_table(shots: list) -> str:
    counts = [[0] * 3 for _ in range(3)]
    for s in shots:
        counts[s[5]][s[4]] += 1
    total = max(1, len(shots))
    lines = ["| | " + " | ".join(COL_NAMES) + " |", "|---|---|---|---|"]
    for r in range(3):
        cells = [f"{counts[r][c]} ({100 * counts[r][c] / total:.1f}%)" for c in range(3)]
        lines.append(f"| **{ROW_NAMES[r]}** | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def write_outputs(shots: list, stats: Counter, matches: int, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    today = dt.date.today().isoformat()
    payload = {
        "source": "StatsBomb Open Data (https://github.com/hudl/open-data)",
        "generated": today,
        "matches": matches,
        "count": len(shots),
        "fields": ["x", "y", "u", "v", "col", "row"],
        "shots": shots,
    }
    (out_dir / "shots.json").write_text(json.dumps(payload, separators=(",", ":")))

    md = [
        "# Shot data summary",
        "",
        f"Generated {today} from StatsBomb Open Data by `tools/build_shots.py`.",
        "Columns are as seen on screen from behind the goalkeeper.",
        "",
        "## Filtering",
        "",
        f"- Matches processed: {matches}",
        f"- Shots scanned: {stats['scanned']}",
        f"- Removed — penalties: {stats['drop_penalty']}",
        f"- Removed — off target, post, blocked, wasted: {stats['drop_off_target_or_blocked']}",
        f"- Removed — no end height: {stats['drop_no_height']}",
        f"- Removed — bad location: {stats['drop_bad_location']}",
        f"- **Kept: {stats['kept']}**",
        "",
        "## Where all shots went",
        "",
        grid_table(shots),
        "",
        "## By distance from goal centre",
    ]
    for lo, hi, name in DIST_BANDS:
        band = [s for s in shots if lo <= distance(s[0], s[1]) < hi]
        md += ["", f"### Distance {name} ({len(band)} shots)", "", grid_table(band)]
    md += ["", "## By side of the pitch (as seen on screen)"]
    for name, test in [
        ("screen-left wide (y > 48)", lambda y: y > 48),
        ("central (32 <= y <= 48)", lambda y: 32 <= y <= 48),
        ("screen-right wide (y < 32)", lambda y: y < 32),
    ]:
        band = [s for s in shots if test(s[1])]
        md += ["", f"### {name} ({len(band)} shots)", "", grid_table(band)]
    (out_dir / "shots_summary.md").write_text("\n".join(md) + "\n")


# ---------- loaders ----------

def load_local(root: Path, rel: str):
    p = root / "data" / rel
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def load_remote(rel: str, cache: Path):
    import requests

    cp = cache / rel
    if cp.exists():
        return json.loads(cp.read_text(encoding="utf-8"))
    for attempt in range(4):
        try:
            r = requests.get(f"{RAW_BASE}/{rel}", timeout=60)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            cp.parent.mkdir(parents=True, exist_ok=True)
            cp.write_bytes(r.content)
            return r.json()
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                print(f"  failed {rel}: {e}", file=sys.stderr)
                return None
            time.sleep(2 * (attempt + 1))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--local", type=Path, help="path to a clone of hudl/open-data")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "data")
    ap.add_argument("--cache", type=Path, default=Path(__file__).resolve().parent / ".cache")
    args = ap.parse_args()

    load = (lambda rel: load_local(args.local, rel)) if args.local else (lambda rel: load_remote(rel, args.cache))

    comps = load("competitions.json") or []
    match_ids = []
    for c in comps:
        for m in load(f"matches/{c['competition_id']}/{c['season_id']}.json") or []:
            match_ids.append(m["match_id"])
    match_ids = sorted(set(match_ids))
    print(f"{len(comps)} competition-seasons, {len(match_ids)} matches")

    stats: Counter = Counter()
    shots: list = []
    done = 0
    for i, mid in enumerate(match_ids, 1):
        events = load(f"events/{mid}.json")
        if events is None:
            continue
        shots.extend(shots_from_events(events, stats))
        done += 1
        if i % 200 == 0:
            print(f"  {i}/{len(match_ids)} matches, {len(shots)} shots kept")

    write_outputs(shots, stats, done, args.out)
    print(f"Done: {len(shots)} shots from {done} matches -> {args.out / 'shots.json'}")


if __name__ == "__main__":
    main()
