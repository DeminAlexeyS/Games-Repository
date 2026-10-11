# Last Line — Goalkeeper Simulator

A browser game where you are the goalkeeper. An attacker runs in from a real shooting position. You read the situation and pick one of nine spots in the goal to dive to. Every shot is a real on-target shot from professional football, sampled from StatsBomb's open data.

> Working title — rename freely.

## How to play

1. Press **Play**.
2. An attacker runs at you from a spot where a real player once took a shot. A countdown runs while they approach: **3 seconds** if they are close to goal, up to **5 seconds** if they are far out.
3. Tap or click one of the **nine zones** of the goal (3×3 grid) to choose where to dive. You can change your mind until the countdown ends.
4. The attacker shoots to the zone the real player hit.
   - **Same zone → save.** You score points.
   - **Different zone → goal.** You lose one of your **3 lives**.
5. After 3 goals conceded the game ends. You see your score and a heatmap of every shot you faced.

### Scoring

| Saves in a row | Points per save |
|---|---|
| 1st – 5th | 1 |
| 6th – 10th | 2 |
| 11th and beyond | 3 |

Conceding a goal resets the streak to zero.

**Tip:** shot position matters. Real attackers shoot differently from tight angles, from the edge of the box and from long range. Learn the patterns.

## Running locally

The game is plain HTML, CSS and JavaScript with no build step. Because it loads a JSON file and ES modules, it must be served over HTTP; opening `index.html` directly from disk will not work.

```bash
# from the repository root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

## Playing on GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. The game will be live at `https://<your-username>.github.io/<repo-name>/`.

## Project structure

```
index.html              Entry point
css/style.css           Page layout, letterboxing, mobile scroll/zoom prevention
js/
  main.js               Boot: load font, sprites + data, size the canvas, run the game loop
  config.js             All tunable numbers (timings, sizes, scoring, colours, layout)
  game.js               State machine and rules (no drawing)
  render.js             Canvas drawing (pitch, sprites, ball, HUD, screens)
  input.js              Pointer events (mouse, touch, pen) + keyboard → game
  audio.js              Sound effects (Web Audio synthesis, optional .mp3 overrides)
  data.js               Loads and samples shots.json
  heatmap.js            End-of-game heatmap
  projection.js         Fake-3D projection: pitch coordinates → screen
  geometry.js           The 3×3 goal grid, derived from GOAL_MOUTH
  sprites.js            Image loading with code-drawn placeholders
  text.js               Pixel-font text helper
assets/
  sprites/              Pixel art (supplied by the author — see below)
  sounds/               Optional sound files (see assets/sounds/README.md)
  statsbomb-logo.png    Optional StatsBomb logo for the credits (text credit if missing)
data/shots.json         Processed real shot data (generated)
tools/build_shots.py    Script that builds shots.json from StatsBomb open data
docs/
  GAME_DESIGN.md        Full game design document
  DATA_METHODOLOGY.md   How the shot data was gathered and processed
LICENSE                 MIT (code only)
.nojekyll               Tells GitHub Pages to publish the folder as-is
```

## Tuning the game

Everything you might want to change is in `js/config.js`, with a comment on each value. No build step: edit, save, reload. Highlights:

| Section | What it controls |
|---|---|
| `TIMING` | countdown range and distance thresholds, ball flight time, dive time, how long the result banner stays |
| `RULES` / `STREAK_TIERS` | lives, the default cell when nothing is chosen, points per streak tier |
| `PROJECTION` | the fake 3D: `F` (how fast things shrink with distance), `K` (how wide the pitch looks), horizon and goal-line heights |
| `GOAL_MOUTH` / `GOAL_IMAGE` | where the goal is on screen (see *Replacing the placeholders* below) |
| `SPRITES` | the base scale of each sprite and the size of the code-drawn placeholders |
| `COLORS`, `LAYOUT`, `FONT` | the look of everything drawn in code |
| `DEBUG` | `showGoalMouth` outlines the goal mouth; `showShotInfo` prints the current shot's data |

The whole game is drawn at **480×270 logical pixels** and scaled to fit the window, so all sizes in `config.js` are in those units. Set `SNAP_INTEGER_SCALE` to `true` if you prefer perfectly square pixels over filling the window.

In the browser console, `lastLine.game` is the live game object if you want to poke at it.

## Art assets

Pixel art lives in `assets/sprites/`. Required file names:

| File | Content |
|---|---|
| `attacker_run_1.png` | Attacker running, frame 1 |
| `attacker_run_2.png` | Attacker running, frame 2 |
| `attacker_kick.png` | Attacker kicking |
| `keeper_idle.png` | Goalkeeper standing (seen from behind) |
| `keeper_dive.png` | Goalkeeper diving, drawn diving to **the right** (mirrored in code for left dives) |
| `keeper_jump.png` | Goalkeeper jumping straight up, arms raised (for centre-middle and centre-top saves) |
| `ball.png` | Ball |
| `goal.png` | Goal frame (posts, crossbar, net) seen from behind |

See `docs/GAME_DESIGN.md` → *Assets* for sizes and anchor points.

### Replacing the placeholders

Until the PNGs exist, the game draws coloured placeholder figures in code. Each file is loaded independently, so you can add them one at a time; a missing or broken file never stops the game.

1. **Drop the PNGs into `assets/sprites/`** with the exact names above. Transparent backgrounds. Anchors are bottom-centre (the feet) for the attacker and keeper, and the centre for the ball. Draw `keeper_dive.png` diving to the **right**; the game mirrors it for left-hand cells.
2. **Set each sprite's scale** in `config.js` → `SPRITES`. The drawn size is the image size × `scale` (the attacker and his ball also shrink with distance). Whole-number scales look crispest. As a guide, with the default goal the keeper is about 72 px tall and the attacker about 64 px tall when standing on the goal line.
3. **Line up the goal.** `GOAL_MOUTH` is the inside of the goal frame in screen pixels; the 3×3 grid, the ball's landing points and the keeper's dives all derive from it. When `goal.png` arrives:
   - note the pixel rectangle of the inside of the posts/crossbar within the PNG (`px, py, pw, ph`),
   - choose where to draw the image with `GOAL_IMAGE` (`x`, `y`, `scale`),
   - set `GOAL_MOUTH = { x: GOAL_IMAGE.x + px·scale, y: GOAL_IMAGE.y + py·scale, w: pw·scale, h: ph·scale }`,
   - turn on `DEBUG.showGoalMouth` to see the rectangle while you adjust, then turn it off.
   Keep the mouth large: each of the nine cells should stay at least ~44 CSS px on a phone in landscape (with the default 192×96 mouth, cells are 64×32 logical px, which is ~85×43 px on a typical phone).
4. **Keeper reach.** `KEEPER.diveReach` / `jumpReach` say which part of the sprite lands on the chosen cell's centre (0 = top edge, 0.5 = middle). Adjust if your dive or jump art has the gloves somewhere else.

### Sounds

All sound effects are synthesised with the Web Audio API. To use your own, put `kick.mp3`, `save.mp3` and/or `goal.mp3` in `assets/sounds/` — see the README in that folder. The mute button (bottom-right, or the **M** key) is remembered between visits.

### Controls

- **Mouse / touch / pen:** click or tap a zone of the goal while the attacker runs in. You can change your mind until the countdown reaches zero. Taps slightly outside the goal snap to the nearest zone.
- **Keyboard:** `1`–`9` in numpad layout (`7 8 9` top row, `4 5 6` middle, `1 2 3` bottom), `Enter`/`Space` to play, `M` to mute.

## Rebuilding the shot data

`data/shots.json` is committed, so you don't need to run this to play. To regenerate it:

```bash
pip install requests
python3 tools/build_shots.py
```

This downloads the StatsBomb open data, filters it and writes `data/shots.json` and `data/shots_summary.md`. Full details are in `docs/DATA_METHODOLOGY.md`.

## Data attribution

Shot data © **StatsBomb**, from the [StatsBomb Open Data](https://github.com/hudl/open-data) repository. StatsBomb's terms ask that anything published using the data names StatsBomb as the source and shows the StatsBomb logo. The logo is available in their [Media Pack](https://statsbomb.com/media-pack/). It is shown in the game's credits and here.

To show the logo in the game's title screen, save it as `assets/statsbomb-logo.png`; until then the credit reads "Data: StatsBomb".

<!-- Add the StatsBomb logo image here, e.g. ![StatsBomb](assets/statsbomb-logo.png) -->

## License

Code: MIT (see `LICENSE`). Art assets: © the author, all rights reserved unless stated otherwise. Shot data: subject to the StatsBomb Open Data licence.
