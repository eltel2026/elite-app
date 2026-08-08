// =====================================================================
// ELITE Cube — UI layer. A real (if simplified-interaction) 3x3 Rubik's
// cube: press face-turn buttons to manipulate a genuine scrambled cube
// state (see cube-logic.js), race the clock to solve it.
// =====================================================================
import {
  solvedState, applyMove, isSolved, generateScramble, hashSeed, FACE_COLORS, MOVE_NAMES
} from "./cube-logic.js";
import { el, enableDragRotate } from "../ui-helpers.js";
import { applyCubeSkin } from "./cube-skin.js";
import * as store from "../store.js";

const SCRAMBLE_LENGTH = 20;
const FACE_ORDER = ["U", "D", "F", "B", "L", "R"];

export function mount(root, ctx) {
  root.innerHTML = "";
  if (ctx.mode === "solo") return mountGame(root, ctx, { solo: true, seed: hashSeed(String(Date.now() + Math.random())) });
  const seed = ctx.challenge.state?.seed ?? hashSeed(ctx.challenge.id);
  return mountGame(root, ctx, { solo: false, seed });
}

function renderCubeHTML() {
  return `
    <div class="cube-viewport">
      <div class="rubik" id="rubik">
        ${FACE_ORDER.map((f) => `<div class="rubik-face ${f}" data-face="${f}"></div>`).join("")}
      </div>
    </div>
  `;
}

function paintCube(state) {
  FACE_ORDER.forEach((face, fi) => {
    const faceEl = document.querySelector(`.rubik-face[data-face="${face}"]`);
    if (!faceEl) return;
    faceEl.innerHTML = "";
    for (let k = 0; k < 9; k++) {
      const color = FACE_COLORS[state[fi * 9 + k]];
      const sticker = document.createElement("div");
      sticker.className = "sticker";
      sticker.style.background = color;
      faceEl.appendChild(sticker);
    }
  });
}

function mountGame(root, ctx, { solo, seed }) {
  const scramble = generateScramble(seed, SCRAMBLE_LENGTH);
  let state = scramble.reduce((s, m) => applyMove(s, m), solvedState());
  let startTime = null;
  let intervalId = null;
  let finished = false;

  root.appendChild(
    el(`
    <div>
      ${!solo ? `<p class="center-text">⭐ ${ctx.challenge.wager} points on the line · same scramble as your opponent · fastest solve wins</p>` : ""}
      ${renderCubeHTML()}
      <div class="timer-display" id="cube-timer">00:00.00</div>
      <div class="cube-controls" id="cube-controls">
        ${MOVE_NAMES.map((m) => `<button data-move="${m}">${m}</button>`).join("")}
      </div>
      <p class="center-text text-dim mt-16" id="cube-hint">Scramble applied — tap GO when you're ready!</p>
      <button class="btn btn-gold mt-8" id="cube-go">GO!</button>
      <div id="cube-finish"></div>
    </div>
  `)
  );

  paintCube(state);
  const rubikEl = document.getElementById("rubik");
  if (rubikEl && ctx.profile?.cube) applyCubeSkin(rubikEl, ctx.profile.cube);
    enableDragRotate(rubikEl);
  setControlsEnabled(false);

  function setControlsEnabled(enabled) {
    document.querySelectorAll("#cube-controls button").forEach((b) => (b.disabled = !enabled));
  }

  document.getElementById("cube-go").addEventListener("click", (e) => {
    e.target.disabled = true;
    let count = 3;
    const hint = document.getElementById("cube-hint");
    hint.textContent = `${count}...`;
    const t = setInterval(() => {
      count--;
      if (count > 0) {
        hint.textContent = `${count}...`;
      } else {
        clearInterval(t);
        hint.textContent = "GO! Solve it!";
        startTimer();
        setControlsEnabled(true);
      }
    }, 700);
  });

  function startTimer() {
    startTime = performance.now();
    intervalId = setInterval(updateTimerDisplay, 30);
  }

  function updateTimerDisplay() {
    const elapsedMs = performance.now() - startTime;
    document.getElementById("cube-timer").textContent = formatTime(elapsedMs);
  }

  function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2).padStart(5, "0");
    return `${String(mins).padStart(2, "0")}:${secs}`;
  }

  document.getElementById("cube-controls").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-move]");
    if (!btn || finished) return;
    state = applyMove(state, btn.dataset.move);
    paintCube(state);
    if (isSolved(state)) onSolved();
  });

  function onSolved() {
    finished = true;
    clearInterval(intervalId);
    setControlsEnabled(false);
    const elapsedMs = performance.now() - startTime;
    const finishEl = document.getElementById("cube-finish");
    document.getElementById("cube-hint").textContent = "SOLVED!";

    if (solo) {
      finishEl.innerHTML = `
        <h2 class="center-text text-gold mt-16">🏆 SOLVED! ${formatTime(elapsedMs)}</h2>
        <button class="btn btn-gold" id="cube-again">SCRAMBLE AGAIN</button>
        <button class="btn btn-outline mt-8" id="cube-done">DONE</button>
      `;
      document.getElementById("cube-again").addEventListener("click", () => {
        root.innerHTML = "";
        mountGame(root, ctx, { solo: true, seed: hashSeed(String(Date.now() + Math.random())) });
      });
      document.getElementById("cube-done").addEventListener("click", () => ctx.onSoloResult(true));
    } else {
      submitChallengeTime(elapsedMs, finishEl);
    }
  }

  async function submitChallengeTime(elapsedMs, finishEl) {
    finishEl.innerHTML = `<p class="center-text mt-16">Submitting your time of <strong>${formatTime(elapsedMs)}</strong>...</p>`;
    const { challenge, myUid } = ctx;
    await store.transactionalUpdateChallenge(challenge.id, (data) => {
      const s = data.state ?? { seed, results: {} };
      return { state: { ...s, results: { ...(s.results ?? {}), [myUid]: elapsedMs } } };
    });
    watchForOpponent(finishEl);
  }

  function watchForOpponent(finishEl) {
    const { challenge, myUid } = ctx;
    const oppUid = challenge.fromUid === myUid ? challenge.toUid : challenge.fromUid;
    let settled = false;
    const unsub = store.subscribeChallenge(challenge.id, (data) => {
      if (!data || settled) return;
      const results = data.state?.results ?? {};
      const mine = results[myUid];
      const theirs = results[oppUid];
      if (mine === undefined) return;
      if (theirs === undefined) {
        finishEl.innerHTML = `<p class="center-text mt-16">Your time: <strong>${formatTime(mine)}</strong>. Waiting for opponent to finish...</p>`;
        return;
      }
      settled = true;
      if (mine === theirs) {
        finishEl.innerHTML = `<h3 class="center-text mt-16">🤝 Exact tie! No points change.</h3>`;
        setTimeout(() => ctx.onChallengeSettled(), 1800);
      } else {
        const winnerUid = mine < theirs ? myUid : oppUid; // lower time wins
        const loserUid = winnerUid === myUid ? oppUid : myUid;
        finishEl.innerHTML = `<h3 class="center-text mt-16 ${winnerUid === myUid ? "text-gold" : ""}">${winnerUid === myUid ? "🏆 YOU WIN" : "You lose this one"} — ${formatTime(mine)} vs ${formatTime(theirs)}</h3>`;
        store
          .completeChallenge(challenge.id, { winnerUid, loserUid, wager: challenge.wager })
          .catch(() => {})
          .finally(() => setTimeout(() => ctx.onChallengeSettled(), 1800));
      }
      unsub();
    });
  }

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}
