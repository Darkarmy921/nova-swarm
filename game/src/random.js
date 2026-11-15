// random.js — mulberry32, a small fast seeded PRNG, plus the helpers the game
// needs. A run started with ?seed=N replays the same spawn and pickup rolls.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  // Float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of a non-empty array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // Angle in radians, uniform over the circle.
  angle() {
    return this.next() * Math.PI * 2;
  }
}

// A seed from the page URL (?seed=1234); falls back to the clock when absent.
export function seedFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const n = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? n >>> 0 : (Date.now() % 2147483647);
  } catch {
    return (Date.now() % 2147483647);
  }
}
