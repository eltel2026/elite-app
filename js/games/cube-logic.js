// =====================================================================
// ELITE Cube — pure game logic (no DOM). Move tables below were NOT
// hand-typed: they were derived from first-principles 3D geometry by
// scripts/generate-cube-tables.mjs, and only accepted after passing a
// battery of self-checks (each move has order 4, move/move' are true
// inverses, a 10-move scramble is undone perfectly by its reverse-
// inverse, and the classic (R U R' U')x6 = identity group law holds).
// Sticker order: U0-8, D0-8, F0-8, B0-8, L0-8, R0-8, each face row-major:
//   0 1 2
//   3 4 5
//   6 7 8
// =====================================================================

export const FACES = ["U", "D", "F", "B", "L", "R"];

export const MOVE_TABLES = {
  U: [2,5,8,1,4,7,0,3,6,9,10,11,12,13,14,15,16,17,36,37,38,21,22,23,24,25,26,45,46,47,30,31,32,33,34,35,27,28,29,39,40,41,42,43,44,18,19,20,48,49,50,51,52,53],
  "U'": [6,3,0,7,4,1,8,5,2,9,10,11,12,13,14,15,16,17,45,46,47,21,22,23,24,25,26,36,37,38,30,31,32,33,34,35,18,19,20,39,40,41,42,43,44,27,28,29,48,49,50,51,52,53],
  D: [0,1,2,3,4,5,6,7,8,15,12,9,16,13,10,17,14,11,18,19,20,21,22,23,42,43,44,27,28,29,30,31,32,51,52,53,36,37,38,39,40,41,33,34,35,45,46,47,48,49,50,24,25,26],
  "D'": [0,1,2,3,4,5,6,7,8,11,14,17,10,13,16,9,12,15,18,19,20,21,22,23,51,52,53,27,28,29,30,31,32,42,43,44,36,37,38,39,40,41,24,25,26,45,46,47,48,49,50,33,34,35],
  F: [0,1,2,3,4,5,45,48,51,38,41,44,12,13,14,15,16,17,20,23,26,19,22,25,18,21,24,27,28,29,30,31,32,33,34,35,36,37,8,39,40,7,42,43,6,11,46,47,10,49,50,9,52,53],
  "F'": [0,1,2,3,4,5,44,41,38,51,48,45,12,13,14,15,16,17,24,21,18,25,22,19,26,23,20,27,28,29,30,31,32,33,34,35,36,37,9,39,40,10,42,43,11,6,46,47,7,49,50,8,52,53],
  B: [47,50,53,3,4,5,6,7,8,9,10,11,12,13,14,36,39,42,18,19,20,21,22,23,24,25,26,33,30,27,34,31,28,35,32,29,2,37,38,1,40,41,0,43,44,45,46,17,48,49,16,51,52,15],
  "B'": [42,39,36,3,4,5,6,7,8,9,10,11,12,13,14,53,50,47,18,19,20,21,22,23,24,25,26,29,32,35,28,31,34,27,30,33,15,37,38,16,40,41,17,43,44,45,46,0,48,49,1,51,52,2],
  L: [35,1,2,32,4,5,29,7,8,18,10,11,21,13,14,24,16,17,0,19,20,3,22,23,6,25,26,27,28,15,30,31,12,33,34,9,42,39,36,43,40,37,44,41,38,45,46,47,48,49,50,51,52,53],
  "L'": [18,1,2,21,4,5,24,7,8,35,10,11,32,13,14,29,16,17,9,19,20,12,22,23,15,25,26,27,28,6,30,31,3,33,34,0,38,41,44,37,40,43,36,39,42,45,46,47,48,49,50,51,52,53],
  R: [0,1,33,3,4,30,6,7,27,9,10,20,12,13,23,15,16,26,18,19,2,21,22,5,24,25,8,17,28,29,14,31,32,11,34,35,36,37,38,39,40,41,42,43,44,47,50,53,46,49,52,45,48,51],
  "R'": [0,1,20,3,4,23,6,7,26,9,10,33,12,13,30,15,16,27,18,19,11,21,22,14,24,25,17,8,28,29,5,31,32,2,34,35,36,37,38,39,40,41,42,43,44,51,48,45,52,49,46,53,50,47]
};

export const MOVE_NAMES = Object.keys(MOVE_TABLES);

export function solvedState() {
  const state = new Array(54);
  FACES.forEach((face, fi) => {
    for (let k = 0; k < 9; k++) state[fi * 9 + k] = face;
  });
  return state;
}

export function applyMove(state, move) {
  const table = MOVE_TABLES[move];
  if (!table) throw new Error(`Unknown move: ${move}`);
  return table.map((srcIdx) => state[srcIdx]);
}

export function applyMoves(state, moves) {
  return moves.reduce((s, m) => applyMove(s, m), state);
}

export function isSolved(state) {
  for (let f = 0; f < 6; f++) {
    const first = state[f * 9];
    for (let k = 1; k < 9; k++) {
      if (state[f * 9 + k] !== first) return false;
    }
  }
  return true;
}

// Deterministic seeded PRNG (mulberry32) so two players in the same
// async challenge get an IDENTICAL scramble to solve.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// Generates a scramble with no immediately-redundant moves (never plays
// the same face twice in a row, which would just be a shorter turn).
export function generateScramble(seed, length = 20) {
  const rand = mulberry32(seed);
  const scramble = [];
  let lastFace = null;
  while (scramble.length < length) {
    const face = FACES[Math.floor(rand() * FACES.length)];
    if (face === lastFace) continue;
    const suffix = rand() < 0.5 ? "" : "'";
    scramble.push(face + suffix);
    lastFace = face;
  }
  return scramble;
}

export function inverseMove(move) {
  return move.endsWith("'") ? move.slice(0, -1) : move + "'";
}

// Colour used for rendering each face in its solved state.
export const FACE_COLORS = {
  U: "#f5f5f5", // white
  D: "#f7c948", // yellow
  F: "#2ecc71", // green
  B: "#3d7dfa", // blue
  L: "#f5811f", // orange
  R: "#e63946" // red
};
