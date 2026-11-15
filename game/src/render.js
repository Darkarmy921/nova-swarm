// render.js — everything the player sees: the nebula backdrop and parallax
// starfield, the ships and shots with their glow, the HUD, and the title,
// pause, wave-banner and game-over screens. Canvas 2D only, no images.

import { ARENA, COLORS, PLAYER } from './config.js';
import { Rng } from './random.js';

// --- backdrop ------------------------------------------------------------

// A static nebula painted once to an offscreen canvas, then blitted cheaply.
function paintNebula() {
  const off = document.createElement('canvas');
  off.width = ARENA.width;
  off.height = ARENA.height;
  const c = off.getContext('2d');
  const base = c.createLinearGradient(0, 0, 0, ARENA.height);
  base.addColorStop(0, '#0a0620');
  base.addColorStop(0.55, '#050510');
  base.addColorStop(1, '#12041c');
  c.fillStyle = base;
  c.fillRect(0, 0, ARENA.width, ARENA.height);
  const blobs = [
    [240, 150, 320, 'rgba(88, 28, 135, 0.5)'],
    [1020, 120, 280, 'rgba(8, 120, 130, 0.42)'],
    [880, 560, 340, 'rgba(150, 20, 90, 0.38)'],
    [180, 580, 260, 'rgba(20, 60, 160, 0.35)'],
    [640, 360, 420, 'rgba(60, 10, 90, 0.28)'],
  ];
  for (const [x, y, r, color] of blobs) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return off;
}

function makeStars(seed, count, depth) {
  const rng = new Rng(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng.range(0, ARENA.width),
      y: rng.range(0, ARENA.height),
      size: rng.range(0.6, 1.8 + depth * 0.7),
      twinkle: rng.range(0, Math.PI * 2),
      speed: rng.range(0.4, 1.4),
    });
  }
  return stars;
}

const nebula = paintNebula();
const starLayers = [
  { stars: makeStars(11, 90, 0), parallax: 0.012, alpha: 0.5 },
  { stars: makeStars(23, 70, 1), parallax: 0.03, alpha: 0.75 },
  { stars: makeStars(37, 44, 2), parallax: 0.06, alpha: 1 },
];

function drawBackground(ctx, world, now) {
  ctx.drawImage(nebula, 0, 0);
  const px = world ? world.player.x - ARENA.width / 2 : 0;
  const py = world ? world.player.y - ARENA.height / 2 : 0;
  for (const layer of starLayers) {
    for (const star of layer.stars) {
      const tw = 0.6 + 0.4 * Math.sin(now * star.speed + star.twinkle);
      let sx = (star.x - px * layer.parallax) % ARENA.width;
      let sy = (star.y - py * layer.parallax) % ARENA.height;
      if (sx < 0) sx += ARENA.width;
      if (sy < 0) sy += ARENA.height;
      ctx.globalAlpha = layer.alpha * tw;
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(sx, sy, star.size, star.size);
    }
  }
  ctx.globalAlpha = 1;
}

// --- shapes ---------------------------------------------------------------

function pathShape(ctx, shape, radius) {
  ctx.beginPath();
  if (shape === 'triangle') {
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.8, radius * 0.75);
    ctx.lineTo(-radius * 0.35, 0);
    ctx.lineTo(-radius * 0.8, -radius * 0.75);
    ctx.closePath();
  } else if (shape === 'diamond') {
    ctx.moveTo(radius, 0);
    ctx.lineTo(0, radius * 0.8);
    ctx.lineTo(-radius, 0);
    ctx.lineTo(0, -radius * 0.8);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === 'ring') {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }
}

function drawPlayer(ctx, player, now) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnerable && Math.floor(now * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  // Shield ring.
  if (player.shield) {
    ctx.strokeStyle = COLORS.shield;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65 + 0.25 * Math.sin(now * 5);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(player.angle);
  // Engine flame.
  const flame = 10 + Math.sin(now * 40) * 4 + player.thrust * 8;
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath();
  ctx.moveTo(-player.radius * 0.7, 5);
  ctx.lineTo(-player.radius * 0.7 - flame, 0);
  ctx.lineTo(-player.radius * 0.7, -5);
  ctx.closePath();
  ctx.fill();
  // Hull: a swept dart.
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(player.radius + 6, 0);
  ctx.lineTo(-player.radius * 0.8, player.radius * 0.72);
  ctx.lineTo(-player.radius * 0.35, 0);
  ctx.lineTo(-player.radius * 0.8, -player.radius * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy, now) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = enemy.color;
  ctx.strokeStyle = enemy.color;
  if (enemy.kind === 'elite') {
    // Hollow Herald: a thick ring with an inner eye and orbiting shards.
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-enemy.angle);
    ctx.fillStyle = '#ff8ba0';
    ctx.beginPath();
    ctx.arc(0, 0, 9 + Math.sin(now * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.color;
    for (let i = 0; i < 3; i++) {
      const a = now * 1.4 + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (enemy.radius + 12), Math.sin(a) * (enemy.radius + 12), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    pathShape(ctx, enemy.shape, enemy.radius);
    ctx.globalAlpha = enemy.flash > 0 ? 1 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.25, 0, Math.max(2, enemy.radius * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Elite health bar.
  if (enemy.kind === 'elite') {
    const w = 84;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 20, w, 7);
    ctx.fillStyle = COLORS.elite;
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 20, w * ratio, 7);
  }
}

function drawPickup(ctx, pickup, now) {
  const bobY = Math.sin(pickup.bob) * 3;
  const blink = pickup.life < 3 ? (Math.floor(now * 8) % 2 === 0 ? 0.35 : 1) : 1;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bobY);
  ctx.globalAlpha = blink;
  ctx.shadowBlur = 12;
  if (pickup.kind === 'shield') {
    ctx.shadowColor = COLORS.shield;
    ctx.strokeStyle = COLORS.shield;
    ctx.fillStyle = 'rgba(77,159,255,0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.shield;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (pickup.kind === 'rapid') {
    ctx.shadowColor = COLORS.rapid;
    ctx.fillStyle = COLORS.rapid;
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2.5, -2.5, 5, 5);
  } else if (pickup.kind === 'bomb') {
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3355';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + now;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// --- HUD -------------------------------------------------------------------

function drawShipIcon(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, 7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, world, muted) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Score, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(world.score).padStart(6, '0'), 24, 44);
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 24, 66);
  // Wave, top-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${world.wave}`, ARENA.width / 2, 40);
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  const remaining = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(world.phase === 'banner' ? 'INCOMING' : `${remaining} HOSTILE${remaining === 1 ? '' : 'S'}`, ARENA.width / 2, 62);
  // Lives + bombs, top-right.
  ctx.textAlign = 'right';
  for (let i = 0; i < PLAYER.lives; i++) {
    const x = ARENA.width - 30 - i * 28;
    if (i < p.lives) drawShipIcon(ctx, x, 34, 1);
    else {
      ctx.globalAlpha = 0.25;
      drawShipIcon(ctx, x, 34, 1);
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = world.bombs > 0 ? '#ffffff' : COLORS.dim;
  ctx.fillText(`NOVA x${world.bombs}  [E]`, ARENA.width - 24, 66);
  // Dash meter, bottom-left.
  const dashRatio = p.dashCooldown > 0 ? 1 - p.dashCooldown / 1.5 : 1;
  ctx.textAlign = 'left';
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('DASH', 24, ARENA.height - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(24, ARENA.height - 30, 130, 8);
  ctx.fillStyle = dashRatio >= 1 ? COLORS.player : '#4d9fff';
  ctx.fillRect(24, ARENA.height - 30, 130 * dashRatio, 8);
  if (p.rapidUntil > world.time) {
    ctx.fillStyle = COLORS.rapid;
    ctx.fillText(`RAPID ${Math.ceil(p.rapidUntil - world.time)}s`, 170, ARENA.height - 22);
  }
  if (p.shield) {
    ctx.fillStyle = COLORS.shield;
    ctx.fillText('SHIELD', 170, ARENA.height - 38);
  }
  // Combo, bottom-right — big when it matters.
  if (world.multiplier > 1) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe45e';
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`x${world.multiplier}`, ARENA.width - 24, ARENA.height - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(ARENA.width - 154, ARENA.height - 30, 130, 6);
    ctx.fillStyle = '#ffe45e';
    ctx.fillRect(ARENA.width - 154, ARENA.height - 30, 130 * (world.comboTimer / 2.5), 6);
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('COMBO', ARENA.width - 24, ARENA.height - 66);
  }
  if (muted) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('MUTED [M]', 24, ARENA.height - 58);
  }
}

// --- screens ---------------------------------------------------------------

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(3, 3, 12, ${alpha})`;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function centerText(ctx, text, y, font, color, glow = null) {
  ctx.textAlign = 'center';
  ctx.font = font;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, ARENA.width / 2, y);
  ctx.shadowBlur = 0;
}

function drawTitle(ctx, world, now) {
  const pulse = 0.75 + 0.25 * Math.sin(now * 2.4);
  centerText(ctx, 'NOVA SWARM', 218, '800 84px "Segoe UI", system-ui, sans-serif', '#eaf6ff', '#7df9ff');
  centerText(ctx, 'LAST DEFENDER OF THE NEBULA CORE', 258, '600 19px "Segoe UI", system-ui, sans-serif', COLORS.player);
  centerText(ctx, 'Blast the swarm. Chain kills into an x8 combo. Survive the Herald.', 300, '400 17px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  // Controls card.
  ctx.fillStyle = 'rgba(10, 16, 40, 0.72)';
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
  ctx.lineWidth = 1.5;
  const cardX = ARENA.width / 2 - 250;
  const cardY = 340;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, 500, 168, 12);
  ctx.fill();
  ctx.stroke();
  const rows = [
    ['WASD / ARROWS', 'fly the Kestrel'],
    ['MOUSE + HOLD CLICK', 'aim and fire'],
    ['SPACE / SHIFT', 'dash (brief invulnerability)'],
    ['E', 'detonate a Nova bomb'],
    ['P — pause', 'M — mute'],
  ];
  ctx.textAlign = 'left';
  rows.forEach(([key, desc], i) => {
    const y = cardY + 34 + i * 28;
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.player;
    ctx.fillText(key, cardX + 28, y);
    ctx.font = '400 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(desc, cardX + 210, y);
  });
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 566, '700 24px "Segoe UI", system-ui, sans-serif', '#ffe45e');
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    centerText(ctx, `BEST SCORE  ${world.best}`, 606, '600 17px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  }
  centerText(ctx, '3 lives · waves grow harder · an Elite Herald leads every 5th wave', 648, '400 14px "Segoe UI", system-ui, sans-serif', COLORS.dim);
}

function drawPause(ctx) {
  overlay(ctx, 0.55);
  centerText(ctx, 'PAUSED', 330, '800 56px "Segoe UI", system-ui, sans-serif', COLORS.text, '#7df9ff');
  centerText(ctx, 'Press P to resume', 380, '400 18px "Segoe UI", system-ui, sans-serif', COLORS.dim);
}

function drawWaveBanner(ctx, world) {
  const alpha = Math.min(1, world.phaseTimer > 2 ? (2.6 - world.phaseTimer) / 0.6 : 1);
  ctx.globalAlpha = alpha;
  centerText(ctx, `WAVE ${world.wave}`, 300, '800 64px "Segoe UI", system-ui, sans-serif', '#ffffff', '#ff2fd6');
  const sub = world.wave % 5 === 0
    ? 'THE HOLLOW HERALD APPROACHES'
    : world.wave === 1
      ? 'HOSTILES INBOUND — GOOD HUNTING, KESTREL'
      : `${world.spawnQueue.length} HOSTILES INBOUND`;
  centerText(ctx, sub, 344, '600 18px "Segoe UI", system-ui, sans-serif', COLORS.player);
  ctx.globalAlpha = 1;
}

function drawGameOver(ctx, world) {
  overlay(ctx, 0.62);
  centerText(ctx, 'SIGNAL LOST', 190, '800 68px "Segoe UI", system-ui, sans-serif', '#ff4d6d', '#ff3355');
  centerText(ctx, 'The Kestrel went down fighting.', 232, '400 18px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  // Stats card.
  ctx.fillStyle = 'rgba(10, 16, 40, 0.78)';
  ctx.strokeStyle = 'rgba(255, 77, 109, 0.4)';
  ctx.lineWidth = 1.5;
  const cardX = ARENA.width / 2 - 230;
  const cardY = 272;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, 460, 210, 12);
  ctx.fill();
  ctx.stroke();
  const rows = [
    ['FINAL SCORE', String(world.score)],
    ['BEST SCORE', String(Math.max(world.best, world.score))],
    ['WAVE REACHED', String(world.wave)],
    ['KILLS', String(world.kills)],
    ['ACCURACY', `${world.accuracy}%`],
  ];
  rows.forEach(([label, value], i) => {
    const y = cardY + 38 + i * 34;
    ctx.textAlign = 'left';
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(label, cardX + 32, y);
    ctx.textAlign = 'right';
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(value, cardX + 428, y);
  });
  const isBest = world.score > 0 && world.score >= world.best;
  if (isBest) {
    centerText(ctx, '★ NEW BEST SCORE ★', 512, '700 20px "Segoe UI", system-ui, sans-serif', '#ffe45e');
  }
  centerText(ctx, 'PRESS R TO FLY AGAIN', 566, '700 24px "Segoe UI", system-ui, sans-serif', '#ffe45e');
}

// --- main entry -------------------------------------------------------------

export function render(ctx, view) {
  const { world, mode, now, muted } = view;
  ctx.save();
  // Screen shake.
  if (world.shake > 0.3) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, world, now);

  if (mode === 'title') {
    // A few drifters cruise behind the title for life.
    drawTitle(ctx, world, now);
    ctx.restore();
    return;
  }

  // Additive glow pass for shots, orbs and particles.
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of world.bullets) {
    // Short trail so a stream of fire reads at a glance.
    ctx.strokeStyle = 'rgba(255, 228, 94, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.022, bullet.y - bullet.vy * 0.022);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.fillStyle = '#ffe45e';
    ctx.shadowColor = '#ffb020';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const orb of world.orbs) {
    const r = orb.radius + Math.sin(orb.pulse) * 1.5;
    ctx.fillStyle = COLORS.orb;
    ctx.shadowColor = COLORS.orb;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  for (const shard of world.shards) {
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(now * 3);
    ctx.fillStyle = '#9dff57';
    ctx.shadowColor = '#9dff57';
    ctx.shadowBlur = 8;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  for (const pickup of world.pickups) drawPickup(ctx, pickup, now);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy, now);
  if (world.player.alive) drawPlayer(ctx, world.player, now);

  // Floating score text.
  ctx.textAlign = 'center';
  for (const text of world.texts) {
    ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
    ctx.font = `700 ${text.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;

  // Hit flash.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 90, ${world.flash * 0.35})`;
    ctx.fillRect(-20, -20, ARENA.width + 40, ARENA.height + 40);
  }

  drawHud(ctx, world, muted);

  if (mode === 'playing' && world.phase === 'banner') drawWaveBanner(ctx, world);
  if (mode === 'paused') drawPause(ctx);
  if (mode === 'over') drawGameOver(ctx, world);
  ctx.restore();
}
