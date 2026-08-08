// =====================================================================
// Four in a Row — UI layer (DOM + Firestore wiring around the pure
// logic in connect4-logic.js).
// =====================================================================
import { createBoard, dropPiece, checkWinner, isBoardFull, pickAiMove, COLS, ROWS } from "./connect4-logic.js";
import { el } from "../ui-helpers.js";
import * as store from "../store.js";

export function mount(root, ctx) {
  root.innerHTML = "";
  if (ctx.mode === "solo") return mountSolo(root, ctx);
  return mountChallenge(root, ctx);
}

function renderBoard(board, winningCells = []) {
  const isWinCell = (r, c) => winningCells.some(([wr, wc]) => wr === r && wc === c);
  let cells = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      cells += `<div class="c4-cell ${player ?? ""} ${isWinCell(r, c) ? "win" : ""}" data-row="${r}" data-col="${c}"></div>`;
    }
  }
  return `<div class="c4-board" id="c4-board">${cells}</div>`;
}

function mountSolo(root, ctx) {
  let board = createBoard();
  let over = false;

  root.appendChild(
    el(`
    <div>
      <p class="center-text">You are <span style="color:var(--p1);font-weight:700;">Blue</span> · ELITE AI is <span style="color:var(--p2);font-weight:700;">Red</span></p>
      <div id="c4-wrap">${renderBoard(board)}</div>
      <div id="c4-status" class="center-text mt-16 text-dim">Your move — tap a column</div>
    </div>
  `)
  );

  wireClicks();

  function wireClicks() {
    document.querySelectorAll("#c4-board .c4-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        if (over) return;
        const col = Number(cell.dataset.col);
        onPlayerMove(col);
      });
    });
  }

  function redraw(winningCells = []) {
    document.getElementById("c4-wrap").innerHTML = renderBoard(board, winningCells);
    wireClicks();
  }

  function onPlayerMove(col) {
    const result = dropPiece(board, col, "P1");
    if (!result) return;
    board = result.board;
    const win = checkWinner(board);
    if (win) {
      redraw(win.cells);
      return finish(win.winner === "P1");
    }
    if (isBoardFull(board)) {
      redraw();
      return finish(null);
    }
    redraw();
    document.getElementById("c4-status").textContent = "ELITE AI is thinking...";
    setTimeout(aiMove, 550);
  }

  function aiMove() {
    const col = pickAiMove(board, "P2");
    const result = dropPiece(board, col, "P2");
    if (!result) return;
    board = result.board;
    const win = checkWinner(board);
    if (win) {
      redraw(win.cells);
      return finish(win.winner === "P1");
    }
    if (isBoardFull(board)) {
      redraw();
      return finish(null);
    }
    redraw();
    document.getElementById("c4-status").textContent = "Your move — tap a column";
  }

  function finish(didWin) {
    over = true;
    const status = document.getElementById("c4-status");
    const label = didWin === null ? "🤝 It's a draw!" : didWin ? "🏆 You win!" : "ELITE AI wins this one.";
    status.innerHTML = `
      <h3 class="${didWin ? "text-gold" : ""}">${label}</h3>
      <button class="btn btn-gold" id="c4-again">PLAY AGAIN</button>
      <button class="btn btn-outline mt-8" id="c4-done">DONE</button>
    `;
    document.getElementById("c4-again").addEventListener("click", () => {
      root.innerHTML = "";
      mountSolo(root, ctx);
    });
    document.getElementById("c4-done").addEventListener("click", () => ctx.onSoloResult(didWin === true));
  }

  return () => {};
}

function mountChallenge(root, ctx) {
  const { challenge, myUid } = ctx;
  const myPlayer = challenge.fromUid === myUid ? "P1" : "P2";
  const oppPlayer = myPlayer === "P1" ? "P2" : "P1";
  const oppUid = challenge.fromUid === myUid ? challenge.toUid : challenge.fromUid;
  let settled = false;

  root.appendChild(
    el(`
    <div>
      <p class="center-text">You are <span style="color:var(--${myPlayer === "P1" ? "p1" : "p2"});font-weight:700;">${myPlayer === "P1" ? "Blue" : "Red"}</span> · ⭐ ${challenge.wager} points on the line</p>
      <div id="c4-wrap">${renderBoard(createBoard())}</div>
      <div id="c4-status" class="center-text mt-16 text-dim">Loading...</div>
    </div>
  `)
  );

  function wireClicks() {
    document.querySelectorAll("#c4-board .c4-cell").forEach((cell) => {
      cell.addEventListener("click", () => onCellClick(Number(cell.dataset.col)));
    });
  }

  async function onCellClick(col) {
    await store.transactionalUpdateChallenge(challenge.id, (data) => {
      const s = data.state?.board ? data.state : { board: createBoard(), turn: data.fromUid };
      if (s.turn !== myUid) return null; // not your turn
      const result = dropPiece(s.board, col, myPlayer);
      if (!result) return null; // column full
      const win = checkWinner(result.board);
      const full = isBoardFull(result.board);
      return {
        state: {
          board: result.board,
          turn: oppUid,
          winner: win ? win.winner : full ? "draw" : null,
          winningCells: win ? win.cells : []
        }
      };
    });
  }

  const unsub = store.subscribeChallenge(challenge.id, (data) => {
    if (!data || settled) return;
    const s = data.state?.board ? data.state : { board: createBoard(), turn: data.fromUid, winner: null, winningCells: [] };
    document.getElementById("c4-wrap").innerHTML = renderBoard(s.board, s.winningCells ?? []);
    wireClicks();

    const status = document.getElementById("c4-status");
    if (s.winner) {
      settled = true;
      if (s.winner === "draw") {
        status.innerHTML = `<h3>🤝 It's a draw — no points change.</h3>`;
        setTimeout(() => ctx.onChallengeSettled(), 1500);
      } else {
        const winnerUid = s.winner === myPlayer ? myUid : oppUid;
        const loserUid = winnerUid === myUid ? oppUid : myUid;
        status.innerHTML = winnerUid === myUid ? `<h3 class="text-gold">🏆 YOU WON THE MATCH!</h3>` : `<h3>Match lost this time.</h3>`;
        store
          .completeChallenge(challenge.id, { winnerUid, loserUid, wager: challenge.wager })
          .catch(() => {})
          .finally(() => setTimeout(() => ctx.onChallengeSettled(), 1500));
      }
      return;
    }

    status.textContent = s.turn === myUid ? "Your move — tap a column" : "Waiting for opponent's move...";
  });

  return () => unsub();
}
