// NOVA SWARM — entry program for make.fun best-game-01 (Node 22, stdlib only).
//
// The game lives in game/ as plain static files (index.html plus ES modules, no
// library, no network). This program hands it in: it copies game/ and
// screenshots/ from this repository into the output directory and writes
// dossier.json there with the vendored make.fun library, so the judge can read
// the game from one place.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used instead.
// The run is deterministic: same repository, same bytes out, every time.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy a tree recursively, counting files, so the log shows what went in.
// (cpSync alone would do the copying; the walk also lets us fail early on a
// missing game/ instead of writing a dossier for an empty entry.)
function copyTree(source: string, target: string): number {
  mkdirSync(target, { recursive: true });
  let files = 0;
  for (const entry of readdirSync(source)) {
    const from = join(source, entry);
    const to = join(target, entry);
    if (statSync(from).isDirectory()) files += copyTree(from, to);
    else {
      cpSync(from, to);
      files++;
    }
  }
  return files;
}

const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}

mkdirSync(outputDir, { recursive: true });
const gameFiles = copyTree(gameDir, join(outputDir, 'game'));

let shotFiles = 0;
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  shotFiles = copyTree(shotsDir, join(outputDir, 'screenshots'));
}

// The scorer's caps for this bounty: the dossier text is capped at 160 KiB,
// at most 4 screenshots of 256 KiB each, game/ at most 993 files and 48 MiB,
// no path under game/ longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`nova-swarm entry written to ${outputDir} (${gameFiles} game files, ${shotFiles} screenshots)`);
