# Game Design Document — Goalkeeper Simulator

## 1. Concept

**One-line pitch:** You are the goalkeeper. Read where the attacker is shooting from, guess where real players put the ball from there, and dive.

**Core fantasy:** the split-second read of a keeper facing a one-on-one.

**What makes it interesting:** every shot is a **real on-target shot** from professional football (StatsBomb open data). The attacker's starting position is the real shot location, and the ball goes to the zone of the goal the real shot went to. A player who learns real-world shooting tendencies (near post from tight angles, low shots from close range, and so on) will do better than one who guesses randomly.

**Platform:** web browser on desktop (mouse) and mobile/tablet (touch). Single player. Session length: 1–5 minutes.

## 2. Core loop

```
Title screen → [Round] → [Round] → … → 3 goals conceded → Game over screen → Play again
```

One **round**:

1. **Setup** (~0.5 s): a random real shot is sampled. The attacker appears far up the pitch, on the line between the goal and the shot location.
2. **Approach + countdown** (3–5 s): the attacker runs toward the shot location and grows larger (fake depth). The player selects a zone. The countdown is visible.
3. **Kick** (at countdown = 0): the attacker switches to the kick sprite. The kick sound plays. The ball leaves the foot.
4. **Shot + dive** (~0.6 s): the ball flies to the target zone while the keeper dives to the chosen zone.
5. **Result** (~1.2 s): "SAVE!" or "GOAL!" banner, sound, score/lives update.
6. Next round, or game over if lives = 0.

## 3. Rules

### 3.1 The goal grid

The goal mouth is divided into a **3×3 grid** of equal cells:

```
┌──────────┬──────────┬──────────┐
│ top-left │ top-ctr  │ top-right│
├──────────┼──────────┼──────────┤
│ mid-left │ mid-ctr  │ mid-right│
├──────────┼──────────┼──────────┤
│ bot-left │ bot-ctr  │ bot-right│
└──────────┴──────────┴──────────┘
```

Left/right are **as seen on screen**, from behind the keeper. Screen-left is the keeper's left.

### 3.2 Save or goal

- **Save:** the chosen cell equals the shot's target cell.
- **Goal:** any other cell. There is no partial credit and no "close enough".
- **No choice made** when the countdown ends: the keeper stays where he is, which counts as choosing **bottom-centre**.
- The choice can be changed freely until the countdown reaches 0. After that, input is locked.

### 3.3 Countdown length

The countdown depends on the attacker's distance `d` from the centre of the goal (StatsBomb pitch units, see the data doc):

| Distance | Countdown |
|---|---|
| `d ≤ 12` (roughly inside the 6-yard box to penalty spot) | 3.0 s |
| `12 < d < 30` | linear between 3.0 s and 5.0 s |
| `d ≥ 30` (long range) | 5.0 s |

```
countdown = 3 + 2 * clamp((d - 12) / (30 - 12), 0, 1)
```

The attacker's run-in animation lasts exactly the countdown, so the kick happens at 0. All thresholds live in `config.js`.

### 3.4 Lives

- Start with **3 lives**.
- Each goal conceded costs 1 life.
- At 0 lives → Game over.

### 3.5 Scoring and streaks

The streak counts consecutive saves. After each save, increment the streak, then award points:

| Streak value after this save | Points |
|---|---|
| 1–5 | 1 |
| 6–10 | 2 |
| 11+ | 3 |

A goal resets the streak to 0. The HUD shows the current multiplier (×1 / ×2 / ×3) once the streak reaches 5, so the player knows the next save is worth more.

## 4. Camera and presentation

### 4.1 Viewpoint

The camera is **just behind the goalkeeper, slightly above, looking out at the pitch**. The goal frame (`goal.png`) is drawn in the foreground and frames the view. The keeper is seen from behind. The pitch recedes toward the horizon. The attacker runs toward the camera.

This is the classic "penalty game" view. It lets the player see the attacker *and* tap the goal zones.

### 4.2 Fake depth (attacker)

- The pitch is drawn with simple perspective: a horizon line near the top, pitch lines converging.
- Each shot location (distance `d`, lateral offset) is projected to a screen position and scale.
  - Further away → higher on screen (closer to horizon), smaller.
  - Closer → lower, larger.
- The attacker starts at a point **behind** the shot location (further from goal, on the same line from goal through the shot spot) and runs to the shot spot during the countdown.
- Scale is interpolated continuously during the run.
- **Sprite animation:** alternate `attacker_run_1` / `attacker_run_2` every ~120 ms while running. Switch to `attacker_kick` at the moment of the kick and hold it until the round ends.

### 4.3 Lateral mapping

Shots from the attacker's right side of the box appear on the screen's left, and vice versa. The exact coordinate mapping is in `DATA_METHODOLOGY.md` §5. Getting this wrong breaks the "read the position" mechanic, so it must match the data.

### 4.4 Goalkeeper

| Chosen cell | Visual |
|---|---|
| bottom-centre | Keeper does **not** move and keeps `keeper_idle` |
| any left cell | `keeper_dive`, **mirrored**, tweened to that cell's centre |
| any right cell | `keeper_dive` (as drawn), tweened to that cell's centre |
| middle-centre, top-centre | `keeper_jump` (arms up), tweened straight up to that cell's centre |

The dive starts at the kick and takes about the same time as the ball's flight (~0.4–0.6 s).

### 4.5 Ball

- Before the kick: drawn at the attacker's feet, scaled with the attacker.
- After the kick: flies along a slight arc from the feet to a point inside the target cell, growing as it approaches the camera.
  - Use a random point within the cell (not dead centre) so shots don't look identical.
- **On save:** the ball stops at the keeper's hands, then drops/deflects slightly.
- **On goal:** the ball continues into the net, with a small net-ripple or shake of the goal sprite.

### 4.6 Selection feedback

- The 3×3 grid is drawn as a subtle overlay on the goal during the approach phase: thin lines and a faint fill.
- Hover (desktop) highlights a cell lightly. The selected cell gets a strong highlight.
- After the kick, the grid fades out so the shot animation is clean.

## 5. Screens

### 5.1 Title

- Game title, short "how to play" line, **Play** button.
- Small credits line: "Shot data: StatsBomb" + StatsBomb logo.
- The first tap/click on Play also unlocks audio (required on mobile browsers).

### 5.2 In-game HUD

- **Top-left:** Score.
- **Top-centre:** Countdown (large digits or a shrinking bar; turns red in the last second).
- **Top-right:** Lives as 3 icons (ball or glove icons drawn by code).
- **Under score:** streak indicator, e.g. "Streak 7 · ×2", visible from a streak of 1 and highlighted when the multiplier is active.
- **Result banner:** "SAVE! +2" / "GOAL!" centred, ~1 s.

### 5.3 Game over

- "GAME OVER", final score, longest streak, total shots faced, saves, goals.
- **Heatmap** (see §6).
- **Play again** button, which returns straight to a new game, not the title screen.

## 6. Heatmap (game over)

A drawing of the goal mouth with the 3×3 grid. Each cell shows the shots *this game* that went to that cell:

- **Cell fill:** intensity proportional to how many shots went there (darkest = most).
- **Cell contents:** saves count in green with a ✓ icon, goals count in red with an ✕ icon (e.g. "✓ 3  ✕ 1").
- **Dots:** one small dot per shot at its actual landing point inside the cell, green for saves and red for goals. This shows the spread inside each cell.
- **Legend** underneath: green = saved, red = conceded.

All heatmap UI is drawn in code (no supplied art needed).

## 7. Audio

| Event | Sound |
|---|---|
| Kick | short "thump" |
| Save | glove "slap" + small crowd "ooh" |
| Goal | net "swish" + crowd cheer (or a short horn) |

**Default:** sounds are synthesised in code with the Web Audio API (no asset files needed). **Override:** if `assets/sounds/kick.mp3`, `save.mp3` or `goal.mp3` exist, they are used instead.

A mute toggle button sits in a corner of the HUD. Its state is remembered in `localStorage`.

## 8. Controls and devices

- **Desktop:** mouse click on a grid cell. Optional keyboard: number keys 1–9 mapped like a phone keypad (7-8-9 top row, 4-5-6 middle, 1-2-3 bottom).
- **Mobile/tablet:** tap a grid cell. Use Pointer Events so mouse, touch and pen share one code path.
- Prevent double-tap zoom, page scroll and text selection on the game canvas.
- Touch targets: each grid cell must be at least ~44 px on the smallest supported phone. This drives the minimum goal size on screen.

### Layout and resolution

- The game is drawn on a single `<canvas>` with a fixed **logical resolution of 480×270** (16:9). This suits pixel art.
- The canvas is scaled to fit the window while keeping the aspect ratio (letterboxed), with `image-rendering: pixelated`.
- Logical coordinates are used everywhere; input coordinates are converted from screen to logical.
- **Portrait phones:** the game still works (letterboxed), but a small "Rotate for a bigger view" hint is shown.
- UI text uses a pixel-style font. Either a free web font (e.g. "Press Start 2P" via Google Fonts) or a bitmap font drawn in code.

## 9. Assets (supplied by author)

All in `assets/sprites/`, PNG with transparency.

| File | Notes |
|---|---|
| `attacker_run_1.png`, `attacker_run_2.png` | Same canvas size, attacker facing camera |
| `attacker_kick.png` | Same canvas size as run frames |
| `keeper_idle.png` | Seen from behind |
| `keeper_dive.png` | Diving to the **right**; code mirrors it for left |
| `keeper_jump.png` | Jumping straight up, arms raised; used for centre-middle and centre-top |
| `ball.png` | Small, square |
| `goal.png` | Goal frame seen from behind; the inner goal-mouth rectangle is where the grid goes |

**Conventions:**

- **Anchor point:** bottom-centre (feet) for attacker and keeper; centre for ball.
- **Goal mouth rectangle:** the pixel coordinates of the inside of the posts/crossbar within `goal.png` are set in `config.js` (`GOAL_MOUTH = {x, y, w, h}`). This lets the grid line up with any art.
- **Scale:** the base scale for each sprite is set in `config.js`. Integer scaling looks best for pixel art.
- **Placeholders:** if an image fails to load, the game draws a simple coloured placeholder shape, so it is playable before the art is ready.

## 10. Open questions

1. **Title/name** of the game. "Last Line" is a working title.

## 11. Out of scope (possible later)

High-score table, difficulty levels, penalties mode, shot-origin map on game over, multiple attacker skins, online leaderboard.

## 12. Technical summary

- **Stack:** vanilla HTML5 + CSS + JavaScript (ES modules), Canvas 2D. No framework, no build step, no dependencies at runtime.
- **Why:** runs in every modern desktop and mobile browser, deploys to GitHub Pages as-is, and is easy to read and edit.
- **Game loop:** `requestAnimationFrame` with delta-time. All timings are in seconds, from `config.js`.
- **States:** `LOADING → TITLE → ROUND_SETUP → APPROACH → SHOT → RESULT → (ROUND_SETUP | GAME_OVER)`.
- **Data:** `data/shots.json` is fetched once at load. Each round samples a uniformly random shot, which naturally reproduces the real-world distribution of shot locations and targets.
- **Persistence:** only the mute setting, in `localStorage`, with try/catch.
