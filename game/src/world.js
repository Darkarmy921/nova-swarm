// world.js — the arena's rules: wave composition and spawning, collisions,
// scoring and the combo chain, pickups, the Nova bomb, lives and game over.
// The World owns every entity list and the numbers the HUD reads.

import { ARENA, BOMB, COMBO, ENEMIES, PARTICLES, PICKUPS, PLAYER, WAVES } from './config.js';
import {
  burst,
  makeBullet,
  makeEnemy,
  makeFloatText,
  makePickup,
  makePlayer,
  makeShard,
  updateBullet,
  updateEnemy,
  updateFloatText,
  updateOrb,
  updateParticle,
  updatePickup,
  updatePlayer,
  updateShard,
} from './entities.js';

export class World {
  constructor(rng) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.player = makePlayer();
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.particles = [];
    this.pickups = [];
    this.shards = [];
    this.texts = [];
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem('novaswarm_best') || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.wave = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.bombs = BOMB.startCount;
    this.comboChain = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.phase = 'banner'; // 'banner' | 'active' | 'clear'
    this.phaseTimer = WAVES.bannerTime;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.over = false;
    this.startWave(1);
  }

  // --- waves -------------------------------------------------------------

  startWave(n) {
    this.wave = n;
    this.phase = 'banner';
    this.phaseTimer = WAVES.bannerTime;
    this.spawnQueue = this.buildWave(n);
    this.spawnTimer = 0;
  }

  buildWave(n) {
    const queue = [];
    const count = WAVES.baseCount + n * WAVES.perWave;
    for (let i = 0; i < count; i++) {
      const roll = this.rng.float();
      if (n >= 3 && roll < 0.2) queue.push('splitter');
      else if (n >= 2 && roll < 0.45) queue.push('weaver');
      else queue.push('drifter');
    }
    if (n % WAVES.eliteEvery === 0) {
      const elites = 1 + Math.floor(n / 10);
      for (let i = 0; i < elites; i++) queue.unshift('elite');
    }
    // Shuffle so elites do not always lead the pack.
    for (let i = queue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  spawnOne() {
    const kind = this.spawnQueue.shift();
    if (!kind) return;
    // Spawn at an arena edge, at least 260px from the player.
    for (let tries = 0; tries < 12; tries++) {
      const side = this.rng.int(0, 3);
      let x;
      let y;
      if (side === 0) { x = this.rng.range(40, ARENA.width - 40); y = 24; }
      else if (side === 1) { x = this.rng.range(40, ARENA.width - 40); y = ARENA.height - 24; }
      else if (side === 2) { x = 24; y = this.rng.range(40, ARENA.height - 40); }
      else { x = ARENA.width - 24; y = this.rng.range(40, ARENA.height - 40); }
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      if (Math.hypot(dx, dy) > 260 || tries === 11) {
        this.enemies.push(makeEnemy(kind, x, y, this.wave));
        return;
      }
    }
  }

  // --- combat ------------------------------------------------------------

  fireBullet() {
    const p = this.player;
    const spread = 0.05;
    const angle = p.angle + (this.rng.float() - 0.5) * spread;
    this.bullets.push(makeBullet(
      p.x + Math.cos(p.angle) * (p.radius + 6),
      p.y + Math.sin(p.angle) * (p.radius + 6),
      angle,
      PLAYER.bulletSpeed,
      PLAYER.bulletDamage,
    ));
    this.shotsFired++;
  }

  tryDash(move) {
    const p = this.player;
    if (p.dashCooldown > 0 || p.dashTimer > 0) return false;
    let dx = move.x;
    let dy = move.y;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    p.dashX = dx / len;
    p.dashY = dy / len;
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown;
    p.invulnUntil = Math.max(p.invulnUntil, this.time + PLAYER.dashInvuln);
    burst(this.particles, p.x, p.y, '#7df9ff', 10, 200, 0.4);
    return true;
  }

  detonateBomb(audio) {
    if (this.bombs <= 0 || this.enemies.length === 0) return false;
    this.bombs--;
    this.flash = 0.7;
    this.shake = Math.max(this.shake, 22);
    burst(this.particles, this.player.x, this.player.y, '#ffffff', 60, 520, 0.9);
    burst(this.particles, this.player.x, this.player.y, '#7df9ff', 40, 380, 0.8);
    const dead = [...this.enemies];
    for (const enemy of dead) this.killEnemy(enemy, true);
    if (audio) audio.bomb();
    this.texts.push(makeFloatText(this.player.x, this.player.y - 40, 'NOVA!', '#ffffff', 30));
    return true;
  }

  hurtPlayer(audio) {
    const p = this.player;
    if (this.time < p.invulnUntil || p.dashTimer > 0 || this.over) return;
    if (p.shield) {
      p.shield = false;
      p.invulnUntil = this.time + 1.2;
      this.flash = 0.35;
      burst(this.particles, p.x, p.y, '#4d9fff', 24, 300, 0.6);
      if (audio) audio.shieldUp();
      this.texts.push(makeFloatText(p.x, p.y - 30, 'SHIELD DOWN', '#4d9fff', 18));
      return;
    }
    p.lives--;
    p.invulnUntil = this.time + PLAYER.hitInvuln;
    this.flash = 0.6;
    this.shake = Math.max(this.shake, 16);
    this.comboChain = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    burst(this.particles, p.x, p.y, '#ff4d6d', 30, 320, 0.8);
    burst(this.particles, p.x, p.y, '#7df9ff', 16, 240, 0.6);
    if (audio) audio.hit();
    if (p.lives <= 0) {
      p.alive = false;
      this.over = true;
      burst(this.particles, p.x, p.y, '#7df9ff', 70, 480, 1.2);
      burst(this.particles, p.x, p.y, '#ffffff', 40, 360, 1.0);
      if (audio) audio.gameOver();
      if (this.score > this.best) {
        this.best = this.score;
        try { localStorage.setItem('novaswarm_best', String(this.best)); } catch { /* private mode */ }
      }
    }
  }

  // Debug handle: force n hits, ignoring shield and invulnerability.
  debugDamage(n) {
    const p = this.player;
    p.shield = false;
    p.invulnUntil = 0;
    p.lives = Math.max(0, p.lives - n);
    burst(this.particles, p.x, p.y, '#ff4d6d', 20, 300, 0.7);
    if (p.lives <= 0) {
      p.alive = false;
      this.over = true;
      if (this.score > this.best) {
        this.best = this.score;
        try { localStorage.setItem('novaswarm_best', String(this.best)); } catch { /* ignore */ }
      }
    }
  }

  killEnemy(enemy, byBomb = false) {
    const index = this.enemies.indexOf(enemy);
    if (index === -1) return;
    this.enemies.splice(index, 1);
    this.kills++;
    this.registerKill(enemy);
    burst(this.particles, enemy.x, enemy.y, enemy.color, PARTICLES.explosion, 300, 0.8);
    burst(this.particles, enemy.x, enemy.y, '#ffffff', 6, 200, 0.4);
    this.shake = Math.min(14, this.shake + (enemy.kind === 'elite' ? 10 : 2.5));
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const mini = makeEnemy('mini', enemy.x + (this.rng.float() - 0.5) * 30, enemy.y + (this.rng.float() - 0.5) * 30, this.wave);
        mini.angle = this.rng.angle();
        this.enemies.push(mini);
      }
    }
    if (enemy.kind === 'elite') {
      this.dropPickup(enemy.x, enemy.y, this.rng.pick(['bomb', 'shield', 'rapid']));
      for (let i = 0; i < 3; i++) this.shards.push(makeShard(enemy.x, enemy.y));
    } else if (this.rng.chance(PICKUPS.dropChance)) {
      this.dropPickup(enemy.x, enemy.y, null);
    }
    if (!byBomb && this.rng.chance(0.35)) {
      this.shards.push(makeShard(enemy.x, enemy.y));
    }
  }

  registerKill(enemy) {
    this.comboChain++;
    this.comboTimer = COMBO.window;
    this.multiplier = Math.min(COMBO.maxMult, 1 + Math.floor(this.comboChain / COMBO.killsPerStep));
    const gained = enemy.score * this.multiplier;
    this.score += gained;
    const label = this.multiplier > 1 ? `+${gained} x${this.multiplier}` : `+${gained}`;
    this.texts.push(makeFloatText(enemy.x, enemy.y - 10, label, this.multiplier > 1 ? '#ffe45e' : '#eaf6ff', this.multiplier > 1 ? 18 : 14));
  }

  dropPickup(x, y, forceKind) {
    const kind = forceKind ?? this.rng.pick(['shield', 'shield', 'rapid', 'rapid', 'bomb', 'shard']);
    if (kind === 'shard') {
      for (let i = 0; i < 3; i++) this.shards.push(makeShard(x, y));
      return;
    }
    this.pickups.push(makePickup(kind, x, y));
  }

  applyPickup(kind, audio) {
    const p = this.player;
    if (kind === 'shield') {
      p.shield = true;
      this.texts.push(makeFloatText(p.x, p.y - 30, 'SHIELD UP', '#4d9fff', 18));
    } else if (kind === 'rapid') {
      p.rapidUntil = this.time + PICKUPS.rapidDuration;
      this.texts.push(makeFloatText(p.x, p.y - 30, 'RAPID FIRE', '#ff7ad9', 18));
    } else if (kind === 'bomb') {
      this.bombs++;
      this.texts.push(makeFloatText(p.x, p.y - 30, '+1 NOVA BOMB', '#ffffff', 18));
    }
    if (audio) audio.pickup();
  }

  get accuracy() {
    return this.shotsFired === 0 ? 0 : Math.round((this.shotsHit / this.shotsFired) * 100);
  }

  // --- per-frame update ----------------------------------------------------

  update(input, dt, audio) {
    this.time += dt;
    const p = this.player;
    if (this.over) {
      this.updateFx(dt);
      return;
    }

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboChain = 0;
        this.multiplier = 1;
      }
    }

    // Wave phases.
    if (this.phase === 'banner') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'active';
        if (audio) audio.waveHorn();
      }
    } else if (this.phase === 'active') {
      if (this.spawnQueue.length > 0 && this.enemies.length < WAVES.maxAlive) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = WAVES.spawnInterval;
          this.spawnOne();
        }
      } else if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.phase = 'clear';
        this.phaseTimer = WAVES.clearPause;
      }
    } else if (this.phase === 'clear') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.startWave(this.wave + 1);
    }

    // Player: move, aim, fire, dash.
    const move = input.moveVector();
    const aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    updatePlayer(p, move, aim, dt, this.time);
    if (input.mouse.down && p.fireTimer <= 0 && p.alive) {
      p.fireTimer = this.time < p.rapidUntil ? PLAYER.rapidInterval : PLAYER.fireInterval;
      this.fireBullet();
      if (audio) audio.laser();
      // Muzzle spark.
      if (this.particles.length < PARTICLES.max) {
        this.particles.push({
          id: 0,
          x: p.x + Math.cos(p.angle) * (p.radius + 10),
          y: p.y + Math.sin(p.angle) * (p.radius + 10),
          vx: Math.cos(p.angle) * 120, vy: Math.sin(p.angle) * 120,
          color: '#ffe45e', life: 0.12, maxLife: 0.12, size: 3, drag: 0.9,
        });
      }
    }
    if ((input.pressedNow('Space') || input.pressedNow('ShiftLeft') || input.pressedNow('ShiftRight')) && p.alive) {
      if (this.tryDash(move) && audio) audio.dash();
    }
    if (input.pressedNow('KeyE')) this.detonateBomb(audio);

    // Thruster trail while moving.
    if (p.thrust > 0.2 && this.particles.length < PARTICLES.max && this.rng.chance(0.6)) {
      const back = p.angle + Math.PI;
      this.particles.push({
        id: 0,
        x: p.x + Math.cos(back) * p.radius * 0.9 + (this.rng.float() - 0.5) * 6,
        y: p.y + Math.sin(back) * p.radius * 0.9 + (this.rng.float() - 0.5) * 6,
        vx: Math.cos(back) * 90 + (this.rng.float() - 0.5) * 40,
        vy: Math.sin(back) * 90 + (this.rng.float() - 0.5) * 40,
        color: this.rng.pick(['#ff9d2e', '#ffd23e', '#7df9ff']),
        life: 0.35, maxLife: 0.35, size: 2.5, drag: 0.94,
      });
    }

    // Enemies.
    for (const enemy of [...this.enemies]) {
      updateEnemy(enemy, p, dt, this.time, this.orbs, audio);
    }

    // Bullets vs enemies.
    for (const bullet of [...this.bullets]) {
      updateBullet(bullet, dt);
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > ARENA.width + 20 || bullet.y < -20 || bullet.y > ARENA.height + 20) {
        this.bullets.splice(this.bullets.indexOf(bullet), 1);
        continue;
      }
      for (const enemy of [...this.enemies]) {
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const rr = bullet.radius + enemy.radius;
        if (dx * dx + dy * dy < rr * rr) {
          this.bullets.splice(this.bullets.indexOf(bullet), 1);
          this.shotsHit++;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.08;
          burst(this.particles, bullet.x, bullet.y, enemy.color, 4, 160, 0.3);
          if (enemy.hp <= 0) {
            this.killEnemy(enemy);
            if (audio) audio.explosion(enemy.kind === 'elite');
          }
          break;
        }
      }
    }

    // Orbs vs player.
    for (const orb of [...this.orbs]) {
      updateOrb(orb, dt);
      if (orb.life <= 0 || orb.x < -20 || orb.x > ARENA.width + 20 || orb.y < -20 || orb.y > ARENA.height + 20) {
        this.orbs.splice(this.orbs.indexOf(orb), 1);
        continue;
      }
      const dx = orb.x - p.x;
      const dy = orb.y - p.y;
      const rr = orb.radius + p.radius - 2;
      if (p.alive && dx * dx + dy * dy < rr * rr) {
        this.orbs.splice(this.orbs.indexOf(orb), 1);
        this.hurtPlayer(audio);
      }
    }

    // Enemies vs player (contact).
    for (const enemy of [...this.enemies]) {
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const rr = enemy.radius + p.radius - 2;
      if (p.alive && dx * dx + dy * dy < rr * rr) {
        this.hurtPlayer(audio);
        // Knock the enemy back so one hit does not chain instantly.
        const dist = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / dist) * 30;
        enemy.y += (dy / dist) * 30;
      }
    }

    // Pickups.
    for (const pickup of [...this.pickups]) {
      updatePickup(pickup, dt);
      if (pickup.life <= 0) {
        this.pickups.splice(this.pickups.indexOf(pickup), 1);
        continue;
      }
      const dx = pickup.x - p.x;
      const dy = pickup.y - p.y;
      const rr = pickup.radius + p.radius;
      if (p.alive && dx * dx + dy * dy < rr * rr) {
        this.pickups.splice(this.pickups.indexOf(pickup), 1);
        this.applyPickup(pickup.kind, audio);
        burst(this.particles, pickup.x, pickup.y, '#ffffff', 10, 180, 0.4);
      }
    }

    // Shards.
    for (const shard of [...this.shards]) {
      updateShard(shard, p, dt);
      if (shard.life <= 0) {
        this.shards.splice(this.shards.indexOf(shard), 1);
        continue;
      }
      const dx = shard.x - p.x;
      const dy = shard.y - p.y;
      const rr = shard.radius + p.radius;
      if (p.alive && dx * dx + dy * dy < rr * rr) {
        this.shards.splice(this.shards.indexOf(shard), 1);
        this.score += PICKUPS.shardValue;
        this.texts.push(makeFloatText(shard.x, shard.y - 8, `+${PICKUPS.shardValue}`, '#9dff57', 13));
        if (audio) audio.pickup();
      }
    }

    this.updateFx(dt);
  }

  updateFx(dt) {
    for (const particle of [...this.particles]) {
      updateParticle(particle, dt);
      if (particle.life <= 0) this.particles.splice(this.particles.indexOf(particle), 1);
    }
    for (const text of [...this.texts]) {
      updateFloatText(text, dt);
      if (text.life <= 0) this.texts.splice(this.texts.indexOf(text), 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 34);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  }
}
