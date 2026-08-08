// =====================================================================
// Four in a Row — pure game logic (no DOM). 7 columns x 6 rows.
// Board is row-major: board[row][col], row 0 = TOP, row 5 = BOTTOM.
// Cells are null, "P1", or "P2".
// =====================================================================

export const ROWS = 6;
export const COLS = 7;

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// Returns { board, row } on success (new board, row the piece landed in)
// or null if the column is full.
export function dropPiece(board, col, player) {
  if (col < 0 || col >= COLS) return null;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      const next = cloneBoard(board);
      next[row][col] = player;
      return { board: next, row, col };
    }
  }
  return null;
}

export function getValidColumns(board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === null) cols.push(c);
  }
  return cols;
}

export function isBoardFull(board) {
  return getValidColumns(board).length === 0;
}

const DIRECTIONS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1] // diagonal down-left
];

// Returns the winning player ("P1"/"P2") or null. Also can return the
// four winning cell coordinates for highlighting, via the second return
// value in an array [player, cells].
export function checkWinner(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells = [];
        let ok = true;
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[rr][cc] !== player) {
            ok = false;
            break;
          }
          cells.push([rr, cc]);
        }
        if (ok) return { winner: player, cells };
      }
    }
  }
  return null;
}

export function otherPlayer(player) {
  return player === "P1" ? "P2" : "P1";
}

// --- Simple AI ---
// 1. Win immediately if possible.
// 2. Block opponent's immediate win if needed.
// 3. Otherwise prefer center columns (weighted), picked deterministically
//    from a provided RNG function so behaviour is testable.
export function pickAiMove(board, aiPlayer, rand = Math.random) {
  const human = otherPlayer(aiPlayer);
  const valid = getValidColumns(board);
  if (valid.length === 0) return null;

  for (const col of valid) {
    const result = dropPiece(board, col, aiPlayer);
    if (result && checkWinner(result.board)?.winner === aiPlayer) return col;
  }
  for (const col of valid) {
    const result = dropPiece(board, col, human);
    if (result && checkWinner(result.board)?.winner === human) return col;
  }

  const centerOrder = [3, 2, 4, 1, 5, 0, 6].filter((c) => valid.includes(c));
  // Small randomness among the top-weighted choices so the AI isn't
  // perfectly predictable, while still strongly preferring the center.
  const pool = centerOrder.slice(0, Math.min(3, centerOrder.length));
  return pool[Math.floor(rand() * pool.length)];
}
