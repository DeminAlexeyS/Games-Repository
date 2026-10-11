# Sounds (optional)

The game synthesises all of its sound effects with the Web Audio API, so this
folder can stay empty.

To replace a synthesised sound with your own recording, drop a file here with
one of these exact names:

| File | Played when |
|---|---|
| `kick.mp3` | the attacker strikes the ball |
| `save.mp3` | the keeper makes a save |
| `goal.mp3` | a goal is conceded |

Each file is optional and loaded independently. A missing file falls back to
the built-in sound silently. Keep the clips short (under a second or two) and
reasonably quiet; the master volume is set in `js/config.js` (`AUDIO.masterVolume`).
