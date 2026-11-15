// main.js — NOVA SWARM's entry point: the fixed-timestep game loop, the
// title → play → pause → game-over state machine, and the debug handle the
// screenshot driver uses. All game rules live in world.js; all drawing in
// render.js; this file only wires them together.

import { ARENA } from './config.js';
import { AudioSys } from './audio.js';
import { makeEnemy } from './entities.js';
import { Input } from './input.js';
import { Rng, seedFromUrl } from './random.js';
import { render } from './render.js';
import { World } from './world.js';

const STEP = 1 / 60; // fixed update step
const MAX_STEPS = 5; // clamp after a long frame so the game never spirals

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seedFromUrl();
    this.rng = new Rng(this.seed);
    this.world = new World(this.rng);
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.mode = 'title'; // 'title' | 'playing' | 'paused' | 'over'
    this.now = 0;
    this.accumulator = 0;
    this.lastTime = 0;
    this.muted = false;
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
  }

  // Backing store follows the display density (capped at 2x); the logical
  // field stays 1280x720 and the mouse math in input.js uses canvas.width,
  // so aiming stays exact at any window size.
  fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = ARENA.width * dpr;
    this.canvas.height = ARENA.height * dpr;
    this.dpr = dpr;
  }

  start() {
    this.input.attach();
    this.audio.unlock();
    this.lastTime = performance.now();
    const frame = (time) => {
      const elapsed = Math.min(0.25, (time - this.lastTime) / 1000);
      this.lastTime = time;
      this.accumulator += elapsed;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.tick(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.accumulator = 0;
      this.draw();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  tick(dt) {
    this.now += dt;
    const input = this.input;

    // Audio unlocks on the first gesture, wherever it happens.
    if (input.pressed.size > 0 || input.mouse.down) this.audio.unlock();

    // Mute is global, in every mode.
    if (input.pressedNow('KeyM')) {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
    }

    if (this.mode === 'title') {
      if (input.pressedNow('Enter') || input.mouse.down) this.beginPlay();
      return;
    }

    if (this.mode === 'playing') {
      if (input.pressedNow('KeyP') || input.pressedNow('Escape')) {
        this.mode = 'paused';
        this.audio.stopMusic();
        return;
      }
      this.world.update(input, dt, this.audio);
      if (this.world.over) {
        this.mode = 'over';
        this.audio.stopMusic();
      }
      return;
    }

    if (this.mode === 'paused') {
      if (input.pressedNow('KeyP') || input.pressedNow('Escape') || input.pressedNow('Enter')) {
        this.mode = 'playing';
        this.audio.startMusic();
      }
      return;
    }

    if (this.mode === 'over') {
      if (input.pressedNow('KeyR') || input.pressedNow('Enter')) this.beginPlay();
    }
  }

  beginPlay() {
    this.audio.unlock();
    this.rng = new Rng(this.seed);
    this.world = new World(this.rng);
    this.mode = 'playing';
    this.audio.startMusic();
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    render(ctx, { world: this.world, mode: this.mode, now: this.now, muted: this.muted });
  }
}

const game = new Game(document.getElementById('game'));
game.start();

// Debug handle for playtests and screenshot driving only — nothing here is
// reachable from the game's own UI.
window.NOVASWARM = {
  start() {
    game.beginPlay();
  },
  damage(n) {
    game.world.debugDamage(n);
    if (game.world.over) game.mode = 'over';
  },
  setWave(n) {
    game.world.startWave(Math.max(1, n | 0));
  },
  // Extra driving helpers: force a combo display and drop an elite in.
  setCombo(chain) {
    const w = game.world;
    w.comboChain = chain;
    w.comboTimer = 2.5;
    w.multiplier = Math.min(8, 1 + Math.floor(chain / 3));
  },
  targets() {
    return game.world.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind }));
  },
  playerPos() {
    return { x: game.world.player.x, y: game.world.player.y };
  },
  spawnElite() {
    const w = game.world;
    w.enemies.push(makeEnemy('elite', 960, 200, Math.max(5, w.wave)));
  },
  state() {
    const w = game.world;
    return {
      mode: game.mode,
      score: w.score,
      best: w.best,
      wave: w.wave,
      lives: w.player.lives,
      kills: w.kills,
      accuracy: w.accuracy,
      multiplier: w.multiplier,
      bombs: w.bombs,
      enemies: w.enemies.length,
      phase: w.phase,
      over: w.over,
      muted: game.muted,
    };
  },
};
