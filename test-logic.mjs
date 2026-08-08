// Plain-node test runner for every pure logic module (no DOM / Firebase
// deps), so this can run in CI or right here in the sandbox with just
// `node scripts/test-logic.mjs`. No test framework dependency needed.

import * as prog from "../js/progression.js";
import * as c4 from "../js/games/connect4-logic.js";
import * as dice from "../js/games/dice-logic.js";
import * as rps from "../js/games/rps-logic.js";
import * as cube from "../js/games/cube-logic.js";

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg} (expected ${e}, got ${a})`);
}

// ---------- progression.js ----------
{
  const p = prog.addXp({ level: 1, xp: 0 }, 50);
  assertEqual({ level: p.level, xp: p.xp }, { level: 1, xp: 50 }, "addXp: partial progress, no level up");

  const req1 = prog.xpRequiredForLevel(1);
  const p2 = prog.addXp({ level: 1, xp: 0 }, req1 + 10);
  assert(p2.level === 2 && p2.leveledUp, "addXp: single level up");
  assertEqual(p2.xp, 10, "addXp: leftover xp carries over after level up");

  // Multi level-up in one go, crossing unlock thresholds.
  let bigXp = 0;
  for (let lvl = 1; lvl < 6; lvl++) bigXp += prog.xpRequiredForLevel(lvl);
  const p3 = prog.addXp({ level: 1, xp: 0 }, bigXp + 5);
  assert(p3.level === 6, `addXp: multi level-up lands on level 6 (got ${p3.level})`);
  assert(p3.unlocks.some((u) => u.level === 5), "addXp: level-5 unlock detected when crossing it");

  assertEqual(prog.rankForLevel(1).name, "Rookie", "rankForLevel: 1 -> Rookie");
  assertEqual(prog.rankForLevel(5).name, "Challenger", "rankForLevel: 5 -> Challenger");
  assertEqual(prog.rankForLevel(30).name, "Legend", "rankForLevel: 30 -> Legend");
  assertEqual(prog.rankForLevel(4).name, "Rookie", "rankForLevel: 4 -> still Rookie");

  const higherRatedWinsSmallGain = prog.eloDelta(1600, 1200, true);
  const lowerRatedWinsBigGain = prog.eloDelta(1200, 1600, true);
  assert(higherRatedWinsSmallGain < lowerRatedWinsBigGain, "eloDelta: upset win gains more rating than expected win");
  assert(prog.eloDelta(1200, 1200, true) > 0, "eloDelta: equal-rated win is positive");

  const result = prog.resolveChallenge({
    winner: { level: 3, xp: 0, rating: 1200, winStreak: 2 },
    loser: { level: 3, xp: 0, rating: 1200, winStreak: 5 },
    wager: 500
  });
  assert(result.winner.points === 500, "resolveChallenge: winner gains wagered points");
  assert(result.loser.points === 0, "resolveChallenge: loser loses wagered points (floored at 0)");
  assert(result.winner.winStreak === 3, "resolveChallenge: winner streak increments");
  assert(result.loser.winStreak === 0, "resolveChallenge: loser streak resets");
  assert(result.winner.rating > 1200 && result.loser.rating < 1200, "resolveChallenge: rating shifts correctly");
}

// ---------- connect4-logic.js ----------
{
  let board = c4.createBoard();
  assert(board.length === 6 && board[0].length === 7, "connect4: board is 6x7");

  const r1 = c4.dropPiece(board, 3, "P1");
  assert(r1.row === 5, "connect4: first piece in a column lands on bottom row");
  board = r1.board;
  const r2 = c4.dropPiece(board, 3, "P2");
  assert(r2.row === 4, "connect4: second piece stacks on top");

  // Fill a column and ensure a 7th drop fails.
  let full = c4.createBoard();
  for (let i = 0; i < 6; i++) full = c4.dropPiece(full, 0, i % 2 === 0 ? "P1" : "P2").board;
  assert(c4.dropPiece(full, 0, "P1") === null, "connect4: dropping into a full column returns null");
  assert(!c4.getValidColumns(full).includes(0), "connect4: full column excluded from valid columns");

  // Horizontal win.
  let hb = c4.createBoard();
  for (const col of [0, 1, 2, 3]) hb = c4.dropPiece(hb, col, "P1").board;
  const hWin = c4.checkWinner(hb);
  assert(hWin && hWin.winner === "P1", "connect4: horizontal 4-in-a-row detected");

  // Diagonal win (down-right), built by carefully stacking blockers.
  let db = c4.createBoard();
  const seq = [
    [0, "P1"], [1, "P2"], [1, "P1"], [2, "P2"], [2, "P2"], [2, "P1"],
    [3, "P2"], [3, "P2"], [3, "P2"], [3, "P1"]
  ];
  for (const [col, player] of seq) db = c4.dropPiece(db, col, player).board;
  const dWin = c4.checkWinner(db);
  assert(dWin && dWin.winner === "P1", "connect4: diagonal 4-in-a-row detected");

  // No false positive on an empty board.
  assert(c4.checkWinner(c4.createBoard()) === null, "connect4: empty board has no winner");

  // AI takes the immediate winning move when available.
  let aiBoard = c4.createBoard();
  for (const col of [0, 1, 2]) aiBoard = c4.dropPiece(aiBoard, col, "P2").board;
  const aiMove = c4.pickAiMove(aiBoard, "P2", () => 0);
  assert(aiMove === 3, `connect4: AI takes winning move (got col ${aiMove})`);

  // AI blocks opponent's immediate win.
  let blockBoard = c4.createBoard();
  for (const col of [0, 1, 2]) blockBoard = c4.dropPiece(blockBoard, col, "P1").board;
  const blockMove = c4.pickAiMove(blockBoard, "P2", () => 0);
  assert(blockMove === 3, `connect4: AI blocks opponent win (got col ${blockMove})`);
}

// ---------- dice-logic.js (Yahtzee scoring) ----------
{
  assertEqual(dice.scoreCategory("ones", [1, 1, 3, 4, 5]), 2, "dice: ones scoring");
  assertEqual(dice.scoreCategory("sixes", [6, 6, 6, 2, 1]), 18, "dice: sixes scoring");
  assertEqual(dice.scoreCategory("threeKind", [3, 3, 3, 5, 6]), 20, "dice: three of a kind = sum of all");
  assertEqual(dice.scoreCategory("threeKind", [3, 3, 2, 5, 6]), 0, "dice: no three of a kind = 0");
  assertEqual(dice.scoreCategory("fourKind", [4, 4, 4, 4, 6]), 22, "dice: four of a kind = sum of all");
  assertEqual(dice.scoreCategory("fullHouse", [2, 2, 5, 5, 5]), 25, "dice: full house = 25");
  assertEqual(dice.scoreCategory("fullHouse", [2, 2, 2, 2, 5]), 0, "dice: four of a kind is NOT a full house");
  assertEqual(dice.scoreCategory("smallStraight", [1, 2, 3, 4, 6]), 30, "dice: small straight 1-2-3-4");
  assertEqual(dice.scoreCategory("smallStraight", [1, 2, 4, 5, 6]), 0, "dice: no small straight when gap breaks run");
  assertEqual(dice.scoreCategory("largeStraight", [2, 3, 4, 5, 6]), 40, "dice: large straight 2-3-4-5-6");
  assertEqual(dice.scoreCategory("yahtzee", [5, 5, 5, 5, 5]), 50, "dice: yahtzee (five of a kind)");
  assertEqual(dice.scoreCategory("chance", [1, 2, 3, 4, 5]), 15, "dice: chance = sum of all dice");

  const scorecard = {
    ones: 3, twos: 4, threes: 9, fours: 12, fives: 15, sixes: 18, // upper = 61
    threeKind: 0, fourKind: 0, fullHouse: 0, smallStraight: 0,
    largeStraight: 0, yahtzee: 0, chance: 0
  };
  const totalsNoBonus = dice.computeTotals(scorecard);
  assertEqual(totalsNoBonus.bonus, 0, "dice: no bonus below 63 upper points");
  scorecard.sixes = 24; // pushes upper sum to 67 (>=63)
  const totalsWithBonus = dice.computeTotals(scorecard);
  assertEqual(totalsWithBonus.bonus, 35, "dice: +35 bonus at >=63 upper points");
  assert(dice.isScorecardComplete(scorecard), "dice: fully-filled scorecard (all 13 categories, some zero) reports complete");
  const partialCard = { ...scorecard, chance: null };
  assert(!dice.isScorecardComplete(partialCard), "dice: scorecard missing one category reports incomplete");

  // rollDice / rerollHeld basic shape + determinism with seeded rand.
  let seed = 42;
  const seededRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const rolled = dice.rollDice(seededRand);
  assert(rolled.length === 5 && rolled.every((d) => d >= 1 && d <= 6), "dice: rollDice returns 5 valid dice");
  const held = dice.rerollHeld(rolled, [0, 1], seededRand);
  assertEqual(held[0], rolled[0], "dice: rerollHeld keeps held die 0");
  assertEqual(held[1], rolled[1], "dice: rerollHeld keeps held die 1");
}

// ---------- rps-logic.js ----------
{
  assertEqual(rps.resolveRound("rock", "scissors"), "p1", "rps: rock beats scissors");
  assertEqual(rps.resolveRound("scissors", "rock"), "p2", "rps: scissors loses to rock");
  assertEqual(rps.resolveRound("paper", "paper"), "draw", "rps: draw on same choice");
  assertEqual(rps.resolveRound("scissors", "paper"), "p1", "rps: scissors beats paper");

  const status = rps.matchStatus(["p1", "p1"], 3);
  assert(status.decided && status.winner === "p1", "rps: best-of-3 decided after 2 wins");
  const undecided = rps.matchStatus(["p1", "p2"], 3);
  assert(!undecided.decided, "rps: best-of-3 undecided at 1-1");
}

// ---------- cube-logic.js (shipped copy, re-verify independently) ----------
{
  const solved = cube.solvedState();
  assert(cube.isSolved(solved), "cube: fresh solved state reports solved");

  let s = cube.applyMove(solved, "U");
  assert(!cube.isSolved(s), "cube: single U turn is no longer solved");
  s = cube.applyMove(s, "U'");
  assertEqual(s, solved, "cube: U then U' returns to solved");

  // Every move x4 = identity.
  for (const move of ["U", "D", "F", "B", "L", "R"]) {
    let st = solved;
    for (let i = 0; i < 4; i++) st = cube.applyMove(st, move);
    assertEqual(st, solved, `cube: ${move} x4 = identity`);
  }

  // Classic sexy move x6 = identity.
  let sm = solved;
  for (let i = 0; i < 6; i++) sm = cube.applyMoves(sm, ["R", "U", "R'", "U'"]);
  assertEqual(sm, solved, "cube: (R U R' U') x6 = identity");

  // Scramble then inverse-reverse restores solved.
  const scramble = cube.generateScramble(12345, 20);
  let scrambled = cube.applyMoves(solved, scramble);
  assert(!cube.isSolved(scrambled), "cube: 20-move scramble is not solved");
  const inverseSeq = scramble.slice().reverse().map(cube.inverseMove);
  const restored = cube.applyMoves(scrambled, inverseSeq);
  assertEqual(restored, solved, "cube: scramble + reverse-inverse restores solved state");

  // Same seed => same scramble (needed so both challenge players get an
  // identical puzzle).
  const scrambleA = cube.generateScramble(999, 20);
  const scrambleB = cube.generateScramble(999, 20);
  assertEqual(scrambleA, scrambleB, "cube: same seed produces identical scramble");
  const scrambleC = cube.generateScramble(1000, 20);
  assert(JSON.stringify(scrambleA) !== JSON.stringify(scrambleC), "cube: different seed produces a different scramble");

  // No two consecutive moves turn the same face (would be a wasted move).
  const noRepeat = cube.generateScramble(7, 30);
  for (let i = 1; i < noRepeat.length; i++) {
    const faceOf = (m) => m[0];
    assert(faceOf(noRepeat[i]) !== faceOf(noRepeat[i - 1]), `cube: scramble never repeats a face back-to-back (index ${i})`);
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
