// ============================================================================
//  audio.js — sound effects.
//
//  By default every sound is synthesised with the Web Audio API, so no files
//  are needed. If assets/sounds/kick.mp3, save.mp3 or goal.mp3 exist they are
//  used instead; missing files fail silently.
//
//  Mobile browsers only allow sound after a user gesture, so main.js calls
//  audio.unlock() from the first Play press.
// ============================================================================

import { ASSET_PATHS, AUDIO } from './config.js';

export class AudioManager {
  constructor() {
    this.ctx = null;          // AudioContext, created lazily
    this.master = null;       // master gain node (used for mute)
    this.buffers = {};        // decoded .mp3 overrides, by sound name
    this.muted = this.loadMuted();
    this.unlocked = false;
  }

  // ---- mute state -------------------------------------------------------

  loadMuted() {
    try {
      return window.localStorage.getItem(AUDIO.storageKey) === '1';
    } catch (err) {
      return false; // localStorage can throw in private mode; default to sound on
    }
  }

  saveMuted() {
    try {
      window.localStorage.setItem(AUDIO.storageKey, this.muted ? '1' : '0');
    } catch (err) {
      /* ignore: storage unavailable */
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.saveMuted();
    this.applyVolume();
    return this.muted;
  }

  applyVolume() {
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : AUDIO.masterVolume;
    }
  }

  // ---- setup ------------------------------------------------------------

  /** Create the context and start loading overrides. Safe to call repeatedly. */
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // no Web Audio: the game simply runs silent
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      this.loadOverrides();
    } catch (err) {
      this.ctx = null;
    }
  }

  /** Must be called from a user gesture (the Play button). */
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.unlocked) {
      // Play a silent buffer: this is what actually unlocks iOS Safari.
      try {
        const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch (err) { /* ignore */ }
      this.unlocked = true;
    }
  }

  /** Try to load each optional .mp3. Any failure is ignored. */
  loadOverrides() {
    for (const [name, url] of Object.entries(ASSET_PATHS.sounds)) {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('missing');
          const type = res.headers.get('content-type') || '';
          if (type.includes('text/html')) throw new Error('not audio'); // GitHub Pages 404 page
          return res.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buffer) => { this.buffers[name] = buffer; })
        .catch(() => { /* no override: keep the synthesised sound */ });
    }
  }

  // ---- playback ---------------------------------------------------------

  /** Play a named sound: 'kick', 'save' or 'goal'. */
  play(name) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    if (this.buffers[name]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[name];
      src.connect(this.master);
      src.start();
      return;
    }
    try {
      if (name === 'kick') this.synthKick();
      else if (name === 'save') this.synthSave();
      else if (name === 'goal') this.synthGoal();
    } catch (err) {
      /* a synth failure must never break the game */
    }
  }

  // ---- synthesis helpers ------------------------------------------------

  /** A buffer of white noise, `seconds` long. */
  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Play a noise burst through a filter with an attack/decay envelope. */
  noise({ seconds, filterType, freqFrom, freqTo, gain, attack = 0.005, delay = 0, q = 1 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 20), t0 + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + seconds + 0.05);
  }

  /** Play an oscillator with a pitch sweep and a decay envelope. */
  tone({ type, freqFrom, freqTo, seconds, gain, delay = 0, attack = 0.005 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 20), t0 + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  /** Kick: a low thump plus a tiny click. */
  synthKick() {
    this.tone({ type: 'sine', freqFrom: 140, freqTo: 45, seconds: 0.16, gain: 0.9 });
    this.noise({ seconds: 0.05, filterType: 'lowpass', freqFrom: 1800, freqTo: 300, gain: 0.35 });
  }

  /** Save: a glove slap followed by a short crowd "ooh". */
  synthSave() {
    this.noise({ seconds: 0.09, filterType: 'bandpass', freqFrom: 1600, freqTo: 900, gain: 0.8, q: 1.2 });
    this.tone({ type: 'triangle', freqFrom: 220, freqTo: 160, seconds: 0.08, gain: 0.3 });
    // "ooh": a swell of low-filtered noise
    this.noise({ seconds: 0.55, filterType: 'lowpass', freqFrom: 500, freqTo: 900, gain: 0.45, attack: 0.18, delay: 0.1, q: 0.7 });
    this.tone({ type: 'sine', freqFrom: 280, freqTo: 240, seconds: 0.5, gain: 0.12, delay: 0.12, attack: 0.15 });
  }

  /** Goal: net swish, then a crowd roar with a two-note horn. */
  synthGoal() {
    this.noise({ seconds: 0.25, filterType: 'highpass', freqFrom: 1200, freqTo: 4000, gain: 0.5 });
    // Crowd roar
    this.noise({ seconds: 1.1, filterType: 'lowpass', freqFrom: 700, freqTo: 1600, gain: 0.5, attack: 0.25, delay: 0.12, q: 0.5 });
    // Horn: two sawtooth notes a fourth apart
    this.tone({ type: 'sawtooth', freqFrom: 196, freqTo: 196, seconds: 0.55, gain: 0.18, delay: 0.15, attack: 0.04 });
    this.tone({ type: 'sawtooth', freqFrom: 262, freqTo: 262, seconds: 0.55, gain: 0.14, delay: 0.15, attack: 0.04 });
    this.tone({ type: 'sawtooth', freqFrom: 233, freqTo: 233, seconds: 0.5, gain: 0.16, delay: 0.5, attack: 0.04 });
    this.tone({ type: 'sawtooth', freqFrom: 311, freqTo: 311, seconds: 0.5, gain: 0.12, delay: 0.5, attack: 0.04 });
  }
}
