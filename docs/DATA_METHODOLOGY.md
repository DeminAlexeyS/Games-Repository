# Data Methodology — Real Shot Data

This document explains where the game's shots come from, how they were filtered, and how real coordinates become what you see on screen.

## 1. Source

**StatsBomb Open Data** — https://github.com/hudl/open-data (formerly `statsbomb/open-data`).

StatsBomb publishes event data for a selection of competitions free for public use, as JSON files:

- `data/competitions.json`: every competition and season available.
- `data/matches/{competition_id}/{season_id}.json`: the matches in that season.
- `data/events/{match_id}.json`: every event in that match, including shots.

**Scope:** all competitions and seasons in the open data, both men's and women's, as of the date the build script is run.

**Attribution:** StatsBomb's terms ask that published work using the data names StatsBomb as the source and uses the StatsBomb logo (from their Media Pack). The game shows this in its title screen credits and in the README.

## 2. Relevant StatsBomb fields

For each event with `type.name == "Shot"`:

| Field | Meaning |
|---|---|
| `location` | `[x, y]`: where the shot was taken |
| `shot.end_location` | `[x, y, z]`: where the ball ended up; for on-target shots, roughly where it crossed the goal line or was stopped |
| `shot.outcome.name` | e.g. `Goal`, `Saved`, `Saved to Post`, `Off T`, `Wide`, `Post`, `Blocked`, `Saved Off Target`, `Wasted` |
| `shot.type.name` | `Open Play`, `Free Kick`, `Penalty`, `Corner`, `Kick Off` |

### Coordinate system

- Pitch: **120 × 80** units (roughly yards). `x` runs along the pitch, `y` across it.
- Origin `(0, 0)` is the top-left corner when the pitch is drawn with the attacking team going **left → right**.
- StatsBomb normalises every event so the shooting team attacks toward **x = 120**. This means every shot targets the same goal.
- Goal: centred at `(120, 40)`. Posts at **y = 36** and **y = 44** (8 units wide). Crossbar at **z ≈ 2.67** (8 ft, in yards).

## 3. Filtering

A shot is **kept** if all of these are true:

1. `shot.type.name != "Penalty"`. Penalties are excluded by design.
2. `shot.outcome.name` is one of **`Goal`, `Saved`, `Saved to Post`**. These are on-target shots.
   - Excluded: `Off T`, `Wide`, `Post` (missed the target), `Saved Off Target` (saved but going wide), `Blocked` (stopped by an outfield player, so the end location says nothing about where it was aimed), `Wasted`.
3. `shot.end_location` has all three values `[x, y, z]`. Some records lack a height, and those are dropped because they can't be placed in a grid row.
4. `location` is on the pitch (`0 ≤ x ≤ 120`, `0 ≤ y ≤ 80`).

Own goals are not recorded as shots in StatsBomb, so they are naturally excluded.

## 4. Mapping the end location to the 3×3 grid

For saved shots, `end_location` is where the keeper stopped the ball. This can be slightly in front of the goal line or marginally outside the posts. So `y` and `z` are **clamped** into the goal mouth first:

```
gy = clamp(end_y, 36.0, 44.0)
gz = clamp(end_z, 0.0, 2.67)
```

**Row** (height):

| `gz` | Row |
|---|---|
| `0 ≤ gz < 0.89` | bottom (2) |
| `0.89 ≤ gz < 1.78` | middle (1) |
| `1.78 ≤ gz ≤ 2.67` | top (0) |

**Column** (as seen on screen, from behind the keeper — see §5):

| `gy` | Screen column |
|---|---|
| `41.33 < gy ≤ 44` | left (0) |
| `38.67 ≤ gy ≤ 41.33` | centre (1) |
| `36 ≤ gy < 38.67` | right (2) |

The exact landing point within the cell is kept too, normalised to `0..1`. It is used for the ball animation and the heatmap dots:

```
u = (44 - gy) / 8        # 0 = screen-left post, 1 = screen-right post
v = gz / 2.67            # 0 = ground, 1 = crossbar
```

## 5. Why "left" is high y

The attacker runs toward `x = 120`, so `y = 0` is on the **attacker's left**. The goalkeeper faces the opposite way, so `y = 0` is on the **keeper's right**.

The camera sits behind the keeper looking out, so the keeper's right is screen-right. Therefore:

- **Screen-left ↔ high `y` (toward 80)**
- **Screen-right ↔ low `y` (toward 0)**

The same rule applies to the shot's starting `location` when placing the attacker on the pitch. A shot from `y = 70` appears on the left of the screen and a shot from `y = 10` on the right.

## 6. Distance (for the countdown)

```
d = sqrt((120 - x)^2 + (40 - y)^2)
```

`d` is the distance from the shot location to the centre of the goal, in pitch units. The game uses it for the 3–5 s countdown (see `GAME_DESIGN.md` §3.3) and for the attacker's on-screen depth.

## 7. Output format — `data/shots.json`

Compact, to keep the file small for mobile:

```json
{
  "source": "StatsBomb Open Data",
  "generated": "2026-10-11",
  "count": 12345,
  "fields": ["x", "y", "u", "v", "col", "row"],
  "shots": [
    [108.2, 33.5, 0.71, 0.18, 2, 2],
    ...
  ]
}
```

- `x`, `y`: shot location, 1 decimal place.
- `u`, `v`: landing point in the goal mouth, 2 decimal places (§4).
- `col`, `row`: grid cell, 0–2 each (§4).

The outcome (goal or saved in real life) is **not** stored; the game decides the result from the player's choice. Match, player and team identifiers are not stored either.

## 8. Summary file — `data/shots_summary.md`

The build script also writes a human-readable summary:

- Total shots scanned, and how many were removed by each filter.
- Final shot count.
- 3×3 table of how many shots went to each cell, as counts and percentages.
- The same table split by distance band (`< 12`, `12–18`, `18–30`, `≥ 30`). This shows how location changes the target distribution, which is the pattern a skilled player learns.

These numbers are generated from the data and are **not** written by hand.

## 9. Build script — `tools/build_shots.py`

1. Download `competitions.json` from the open-data repository (raw GitHub URLs).
2. For every competition/season, download the matches file and collect match IDs.
3. For every match, download the events file and extract shots that pass §3.
4. Compute `col`, `row`, `u`, `v` (§4) and round values.
5. Write `data/shots.json` and `data/shots_summary.md`.

Notes:

- Thousands of event files are downloaded. The script caches them in `tools/.cache/` (git-ignored), so reruns are fast. It shows progress and retries failed downloads.
- Dependency: Python 3.9+ and `requests`.
- Alternatively, run it on a local clone of the open-data repository with `--local /path/to/open-data`. A shallow clone is enough: `git clone --depth 1 https://github.com/hudl/open-data.git` (several GB).

### Current build

The committed `data/shots.json` was built on 2026-10-11 from all 80 competition-seasons (3,961 matches) in the open data. 101,227 shots were scanned and **34,250** kept. `data/shots_summary.md` has the full breakdown. Headline patterns:

- **Low shots dominate:** half of all on-target shots go to the bottom row, mostly the two bottom corners.
- **Wide angles favour the near post:** from wide on either side, about 70% of shots go to the column on that side of the goal, and 36–37% go to the near-post bottom corner alone.
- **Close range is flatter:** inside 12 units, shots spread more evenly across the goal.
- **Long range is the hardest to read:** from 30+ units the nine cells are within a few percent of each other.

## 10. Known limitations

- **Saved shots' end location** is where the keeper made the save, not necessarily where the ball would have crossed the line. This is mitigated by clamping, but some saved shots may be placed one cell off from their true aim. It probably also inflates the near-post share from wide angles a little, because keepers stand near that post.
- **Coverage bias:** the open data over-represents certain competitions (e.g. a few clubs' full league histories, selected tournaments). The shot mix reflects those competitions, not football as a whole.
- **Grid simplification:** real shots are continuous, and the 3×3 split puts shots near cell borders on one side or the other.
- **Height precision:** `z` values are an estimate from event tagging, not ball tracking.
