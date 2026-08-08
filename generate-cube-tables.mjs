// One-off generator: derives the 12 face-turn permutation tables for a
// 3x3x3 cube from pure 3D geometry, so we never hand-type sticker index
// cycles (a very error-prone thing to do by hand). Run with:
//   node scripts/generate-cube-tables.mjs
// It prints a JS object literal that gets pasted into js/games/cube-logic.js
// as CUBE_MOVE_TABLES. Also runs self-checks and refuses to print
// anything if any check fails.

const FACES = ["U", "D", "F", "B", "L", "R"];

// normal, right(image +x dir), up(image +y dir) as unit vectors in 3D.
const BASIS = {
  U: { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1] },
  D: { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] },
  F: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] },
  B: { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0] },
  L: { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0] },
  R: { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] }
};

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function roundVec(a) { return a.map((v) => Math.round(v)); }
function vecEq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function colToU(c) { return c - 1; }
function rowToV(r) { return 1 - r; }
function uToCol(u) { return u + 1; }
function vToRow(v) { return 1 - v; }

// Build the 54 stickers: index order U0..8,D0..8,F0..8,B0..8,L0..8,R0..8
// Each sticker carries its own face NORMAL explicitly — this is the key
// fix: at shared edges/corners, the raw 3D point alone is ambiguous
// (multiple faces' stickers can land on the same point in this simplified
// model), but the (normal, position) PAIR is always unique.
const STICKERS = [];
for (const face of FACES) {
  const { n, r: rt, u: up } = BASIS[face];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const pos = add(add(n, scale(rt, colToU(col))), scale(up, rowToV(row)));
      STICKERS.push({ face, row, col, pos, n });
    }
  }
}

function stickerIndex(face, row, col) {
  const faceIdx = FACES.indexOf(face);
  return faceIdx * 9 + row * 3 + col;
}

// Given an (normal, position) pair, find the unique (face,row,col).
// The face is found by exact-matching the normal vector (unambiguous —
// the 6 face normals are all distinct). Row/col then come from
// decomposing (pos - normal) in that face's own (right, up) basis.
function stickerAt(normal, pos) {
  const face = FACES.find((f) => vecEq(BASIS[f].n, normal));
  if (!face) throw new Error("No face matches normal " + normal);
  const { n, r: rt, u: up } = BASIS[face];
  const rel = sub(pos, n);
  const uComp = Math.round(dot(rel, rt));
  const vComp = Math.round(dot(rel, up));
  const col = uToCol(uComp);
  const row = vToRow(vComp);
  if (col < 0 || col > 2 || row < 0 || row > 2) {
    throw new Error(`Bad decomposition for face ${face}: row=${row} col=${col}`);
  }
  return { face, row, col };
}

// 3D rotation by +90 or -90 degrees about a principal axis (right-hand
// rotation convention). dir=+1 => +90 degrees, dir=-1 => -90 degrees.
function rotate(pos, axis, dir) {
  const [x, y, z] = pos;
  const s = dir;
  if (axis === 0) return [x, -s * z, s * y];
  if (axis === 1) return [s * z, y, -s * x];
  return [-s * y, s * x, z];
}

function axisOf(normal) {
  if (normal[0] !== 0) return 0;
  if (normal[1] !== 0) return 1;
  return 2;
}

// Build permutation table for a move: result[destIdx] = srcIdx, meaning
// newState[destIdx] = oldState[srcIdx].
function buildMoveTable(face, dir) {
  const { n } = BASIS[face];
  const axis = axisOf(n);
  const sign = n[axis];

  const result = STICKERS.map((_, i) => i); // identity by default
  const layerStickers = STICKERS.filter((s) => Math.round(s.pos[axis]) === sign);

  for (const dest of layerStickers) {
    // To find what ends up at `dest` after rotating the layer by `dir`,
    // rotate dest's (normal, position) BACKWARDS by dir to find the
    // source sticker's (normal, position) before the move.
    const srcNormal = roundVec(rotate(dest.n, axis, -dir));
    const srcPos = roundVec(rotate(dest.pos, axis, -dir));
    const src = stickerAt(srcNormal, srcPos);
    const destIdx = stickerIndex(dest.face, dest.row, dest.col);
    const srcIdx = stickerIndex(src.face, src.row, src.col);
    result[destIdx] = srcIdx;
  }
  return result;
}

const MOVES = {};
for (const face of FACES) {
  MOVES[face] = buildMoveTable(face, 1);
  MOVES[face + "'"] = buildMoveTable(face, -1);
}

// ---- Self checks ----
function applyPerm(state, perm) {
  return perm.map((srcIdx) => state[srcIdx]);
}

function solvedState() {
  const state = new Array(54);
  FACES.forEach((face, fi) => {
    for (let k = 0; k < 9; k++) state[fi * 9 + k] = face;
  });
  return state;
}

let failures = 0;

function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  }
}

// Each permutation must be a bijection (no two destinations pulling from
// nothing / index used twice incorrectly is naturally true for a proper
// permutation array, but double-check it's actually a permutation of 0..53).
for (const face of FACES) {
  for (const key of [face, face + "'"]) {
    const perm = MOVES[key];
    const sorted = perm.slice().sort((a, b) => a - b);
    const isPerm = sorted.every((v, i) => v === i);
    check(`${key} is a valid permutation of 0..53`, isPerm);
  }
}

// Each move applied 4 times returns to identity.
for (const face of FACES) {
  let state = solvedState();
  for (let i = 0; i < 4; i++) state = applyPerm(state, MOVES[face]);
  check(`${face} applied 4x returns to solved`, JSON.stringify(state) === JSON.stringify(solvedState()));
}

// move and move' are true inverses.
for (const face of FACES) {
  let state = applyPerm(solvedState(), MOVES[face]);
  state = applyPerm(state, MOVES[face + "'"]);
  check(`${face} then ${face}' returns to solved`, JSON.stringify(state) === JSON.stringify(solvedState()));
}

// A move changes exactly 20 of the 21 layer-slot entries (the very
// center sticker of the turning face, row=1,col=1, always maps to
// itself since it sits on the rotation axis).
for (const face of FACES) {
  const perm = MOVES[face];
  const movedCount = perm.filter((srcIdx, destIdx) => srcIdx !== destIdx).length;
  check(`${face} move changes exactly 20 sticker slots (got ${movedCount})`, movedCount === 20);
}

// A well-known scramble, inverted move-by-move in reverse order, must
// restore the solved state — this proves multi-move composition works,
// not just single moves in isolation.
{
  const scramble = ["U", "R", "U'", "F", "R'", "D", "F'", "L", "B", "L'"];
  const inverseOf = (m) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
  let state = solvedState();
  for (const m of scramble) state = applyPerm(state, MOVES[m]);
  const inverseSeq = scramble.slice().reverse().map(inverseOf);
  for (const m of inverseSeq) state = applyPerm(state, MOVES[m]);
  check("scramble + reverse-inverse restores solved state", JSON.stringify(state) === JSON.stringify(solvedState()));
}

// After a single U turn: U face must stay uniform (its 9 stickers only
// permute among themselves), and the top rows of F/R/B/L must contain
// only colors from {F,R,B,L} (never U or D) — i.e. turning U never
// contaminates the side layers with U/D stickers.
{
  const state = applyPerm(solvedState(), MOVES["U"]);
  const uFace = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => state[stickerIndex("U", Math.floor(k / 3), k % 3)]);
  check("U face uniform after single U turn", uFace.every((c) => c === "U"));
  for (const face of ["F", "R", "B", "L"]) {
    const topRow = [0, 1, 2].map((c) => state[stickerIndex(face, 0, c)]);
    check(`${face} top row uncontaminated after U turn`, topRow.every((c) => c !== "U" && c !== "D"));
  }
  // D face must be completely untouched by a U turn.
  const dFace = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => state[stickerIndex("D", Math.floor(k / 3), k % 3)]);
  check("D face untouched by U turn", dFace.every((c) => c === "D"));
}

// Classic 4-move sequence (R U R' U') six times returns to solved (a
// well known finite-order property used as a sanity check on real cubes).
{
  let state = solvedState();
  const seq = ["R", "U", "R'", "U'"];
  for (let rep = 0; rep < 6; rep++) {
    for (const m of seq) state = applyPerm(state, MOVES[m]);
  }
  check("(R U R' U') x6 returns to solved", JSON.stringify(state) === JSON.stringify(solvedState()));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED. Not printing tables.`);
  process.exit(1);
}

console.error(`All geometric self-checks passed (0 failures).\n`);
console.log(JSON.stringify(MOVES));
