// entities.js — the things that live in the arena: the player ship, the four
// enemy kinds, bullets, enemy orbs, particles, pickups, score shards and
// floating score text. Factories make them; update functions move them one
// step. Collision and scoring live in world.js; drawing lives in render.js.

import { ARENA, COLORS, ENEMIES, PARTICLES, PLAYER } from './config.js';

let nextId = 1;
function id() {
  return nextId++;
}

export function makePlayer() {
  return {
    id: id(),
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    lives: PLAYER.lives,
    shield: false,
    rapidUntil: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnUntil: 0,
    thrust: 0, // 0..1, how hard the engine is burning this frame
    alive: true,
  };
}

export function makeEnemy(kind, x, y, wave) {
  const base = ENEMIES[kind];
  const hpBonus = kind === 'elite' ? Math.max(0, wave - 5) * 5 : 0;
  return {
    id: id(),
    kind,
    shape: base.shape,
    color: base.color,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: base.radius,
    hp: base.hp + hpBonus,
    maxHp: base.hp + hpBonus,
    speed: base.speed + wave * 5,
    score: base.score,
    fireTimer: base.fireInterval ? base.fireInterval * (0.7 + Math.random() * 0.6) : 0,
    burstTimer: base.burstInterval ? 1.5 : 0,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 2 + Math.random() * 2,
    spin: (Math.random() - 0.5) * 1.5,
    flash: 0,
  };
}

export function makeBullet(x, y, angle, speed, damage) {
  return {
    id: id(), x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    damage,
    life: 1.1,
  };
}

export function makeOrb(x, y, angle, speed) {
  return {
    id: id(), x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    life: 6,
    pulse: Math.random() * Math.PI * 2,
  };
}

export function makeParticle(x, y, color, speed, life, size) {
  return {
    id: id(), x, y,
    vx: (Math.random() - 0.5) * 2 * speed,
    vy: (Math.random() - 0.5) * 2 * speed,
    color,
    life,
    maxLife: life,
    size: size ?? 2 + Math.random() * 3,
    drag: 0.92,
  };
}

export function burst(particles, x, y, color, count, speed = 260, life = 0.7) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= PARTICLES.max) return;
    particles.push(makeParticle(x, y, color, speed, life * (0.5 + Math.random() * 0.8)));
  }
}

export function makePickup(kind, x, y) {
  return {
    id: id(), kind, x, y,
    radius: 14,
    life: 12,
    bob: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
  };
}

export function makeShard(x, y) {
  return {
    id: id(), x, y,
    vx: (Math.random() - 0.5) * 120,
    vy: (Math.random() - 0.5) * 120,
    radius: 7,
    life: 10,
  };
}

export function makeFloatText(x, y, text, color, size = 16) {
  return { id: id(), x, y, text, color, size, life: 0.9, maxLife: 0.9 };
}

// --- per-entity updates -------------------------------------------------

export function updatePlayer(player, move, aimAngle, dt, now) {
  player.angle = aimAngle;
  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashX * PLAYER.dashSpeed;
    player.vy = player.dashY * PLAYER.dashSpeed;
  } else {
    const targetVx = move.x * PLAYER.speed;
    const targetVy = move.y * PLAYER.speed;
    const k = Math.min(1, (PLAYER.accel / PLAYER.speed) * dt);
    player.vx += (targetVx - player.vx) * k;
    player.vy += (targetVy - player.vy) * k;
    player.thrust = Math.min(1, Math.hypot(move.x, move.y));
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(player.radius, Math.min(ARENA.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(ARENA.height - player.radius, player.y));
  if (player.dashCooldown > 0) player.dashCooldown -= dt;
  if (player.fireTimer > 0) player.fireTimer -= dt;
  player.invulnerable = now < player.invulnUntil || player.dashTimer > 0;
}

export function updateEnemy(enemy, player, dt, now, orbs, audio) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.wobble += enemy.wobbleSpeed * dt;
  if (enemy.flash > 0) enemy.flash -= dt;

  if (enemy.kind === 'drifter' || enemy.kind === 'mini') {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
    enemy.angle = Math.atan2(dy, dx);
  } else if (enemy.kind === 'weaver') {
    // Sine-wave approach: chase, plus a sideways sway.
    const sway = Math.sin(enemy.wobble) * 0.9;
    enemy.vx = nx * enemy.speed + -ny * sway * enemy.speed * 0.6;
    enemy.vy = ny * enemy.speed + nx * sway * enemy.speed * 0.6;
    enemy.angle = Math.atan2(dy, dx);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 520 && dist > 120) {
      enemy.fireTimer = ENEMIES.weaver.fireInterval;
      orbs.push(makeOrb(enemy.x, enemy.y, Math.atan2(dy, dx), ENEMIES.weaver.orbSpeed));
      if (audio) audio.enemyShot();
    }
  } else if (enemy.kind === 'splitter') {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
    enemy.angle += enemy.spin * dt;
  } else if (enemy.kind === 'elite') {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
    enemy.angle += dt * 0.8;
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = ENEMIES.elite.burstInterval;
      const count = ENEMIES.elite.burstCount;
      const offset = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * Math.PI * 2;
        orbs.push(makeOrb(enemy.x, enemy.y, a, ENEMIES.elite.orbSpeed));
      }
      if (audio) audio.enemyShot();
    }
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Herd them back inside the arena instead of letting them drift off.
  const margin = 30;
  if (enemy.x < -margin) enemy.x = -margin;
  if (enemy.x > ARENA.width + margin) enemy.x = ARENA.width + margin;
  if (enemy.y < -margin) enemy.y = -margin;
  if (enemy.y > ARENA.height + margin) enemy.y = ARENA.height + margin;
}

export function updateBullet(bullet, dt) {
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  bullet.life -= dt;
}

export function updateOrb(orb, dt) {
  orb.x += orb.vx * dt;
  orb.y += orb.vy * dt;
  orb.life -= dt;
  orb.pulse += dt * 6;
}

export function updateParticle(particle, dt) {
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.vx *= particle.drag;
  particle.vy *= particle.drag;
  particle.life -= dt;
}

export function updatePickup(pickup, dt) {
  pickup.x += pickup.vx * dt;
  pickup.y += pickup.vy * dt;
  pickup.vx *= 0.98;
  pickup.vy *= 0.98;
  pickup.life -= dt;
  pickup.bob += dt * 3;
}

export function updateShard(shard, player, dt) {
  const dx = player.x - shard.x;
  const dy = player.y - shard.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist < 150) {
    shard.vx += (dx / dist) * 2600 * dt;
    shard.vy += (dy / dist) * 2600 * dt;
  } else {
    shard.vx *= 0.96;
    shard.vy *= 0.96;
  }
  const speed = Math.hypot(shard.vx, shard.vy);
  const cap = 420;
  if (speed > cap) {
    shard.vx = (shard.vx / speed) * cap;
    shard.vy = (shard.vy / speed) * cap;
  }
  shard.x += shard.vx * dt;
  shard.y += shard.vy * dt;
  shard.life -= dt;
}

export function updateFloatText(text, dt) {
  text.y -= 42 * dt;
  text.life -= dt;
}

export { COLORS };
