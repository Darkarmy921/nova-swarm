// config.js — every tuning number for NOVA SWARM in one place.
// The arena is a fixed 1280x720 logical field; the canvas scales to the window.

export const ARENA = { width: 1280, height: 720 };

export const COLORS = {
  background: '#050510',
  player: '#7df9ff',
  playerCore: '#e8feff',
  bullet: '#ffe45e',
  orb: '#ff5d8f',
  drifter: '#ff2fd6',
  weaver: '#22e6ff',
  splitter: '#ffb020',
  mini: '#ffc95e',
  elite: '#ff3355',
  shield: '#4d9fff',
  rapid: '#ff7ad9',
  bomb: '#ffffff',
  shard: '#9dff57',
  text: '#eaf6ff',
  dim: '#8fa8c8',
  danger: '#ff4d6d',
};

export const PLAYER = {
  radius: 14,
  speed: 330,
  accel: 2600,
  fireInterval: 0.14,
  rapidInterval: 0.07,
  bulletSpeed: 760,
  bulletDamage: 1,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.5,
  dashInvuln: 0.4,
  hitInvuln: 2.0,
  lives: 3,
};

export const COMBO = {
  window: 2.5, // seconds between kills before the chain resets
  killsPerStep: 3, // every 3 chained kills raises the multiplier one step
  maxMult: 8,
};

export const PICKUPS = {
  dropChance: 0.14,
  shardValue: 25,
  rapidDuration: 8,
  magnetRadius: 150,
  magnetSpeed: 420,
  lifeTime: 12,
};

export const BOMB = {
  damage: 12,
  startCount: 1,
};

// Enemy kinds: shape, colour, behaviour, score. Speeds scale a little with wave.
export const ENEMIES = {
  drifter: {
    kind: 'drifter', shape: 'triangle', color: COLORS.drifter,
    radius: 16, hp: 2, speed: 78, score: 100, contact: 1,
  },
  weaver: {
    kind: 'weaver', shape: 'diamond', color: COLORS.weaver,
    radius: 15, hp: 3, speed: 96, score: 150, contact: 1,
    fireInterval: 2.4, orbSpeed: 170,
  },
  splitter: {
    kind: 'splitter', shape: 'hexagon', color: COLORS.splitter,
    radius: 22, hp: 4, speed: 56, score: 200, contact: 1,
  },
  mini: {
    kind: 'mini', shape: 'triangle', color: COLORS.mini,
    radius: 10, hp: 1, speed: 150, score: 50, contact: 1,
  },
  elite: {
    kind: 'elite', shape: 'ring', color: COLORS.elite,
    radius: 42, hp: 46, speed: 46, score: 1500, contact: 1,
    burstInterval: 2.9, burstCount: 12, orbSpeed: 150,
  },
};

export const WAVES = {
  bannerTime: 2.6, // seconds the "WAVE N" card shows before spawning
  clearPause: 1.6, // seconds of calm after the last enemy dies
  baseCount: 5, // enemies in wave 1
  perWave: 3, // extra enemies per wave
  maxAlive: 26, // spawn queue drains while fewer than this are alive
  spawnInterval: 0.55,
  speedPerWave: 5, // added to enemy speed each wave
  eliteEvery: 5, // an Elite Herald leads every 5th wave
  eliteHpPerWave: 5,
};

export const PARTICLES = {
  max: 420,
  explosion: 26,
  spark: 8,
};
