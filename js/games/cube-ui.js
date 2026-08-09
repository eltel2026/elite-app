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
      <button class="cube-hold-btn" id="cube-hold-btn" type="button">🔒 Hold</button>
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

// Two interaction modes share one pointer listener set on the cube:
//   - Hold OFF (default): dragging spins the cube around so you can look
//     at any face — pure viewing, no move is made.
//   - Hold ON: the view freezes, and swiping across a face twists that
//     face instead. Whichever face was actually touched is looked up via
//     the DOM (so it's always correct no matter how the cube is
//     currently rotated), and the turn direction is found from the
//     rotational sense of the swipe around that face's on-screen centre —
//     e.g. dragging along the top edge to the right is a clockwise turn,
//     the same way turning a steering wheel works. Because you can only
//     ever swipe a face that's actually facing the camera, "clockwise on
//     screen" always matches the standard "clockwise looking at that
//     face from outside" cube notation, regardless of the viewing angle.
function enableCubeControls(cubeEl, { getHoldActive, canMove, onFaceMove }) {
  let rotX = -28;
  let rotY = -35;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let swipe = null;

  cubeEl.style.touchAction = "none";
  cubeEl.style.cursor = "grab";

  function applyRotation() {
    cubeEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }
  applyRotation();

  cubeEl.addEventListener("pointerdown", (e) => {
    if (getHoldActive()) {
      const faceEl = e.target.closest(".rubik-face[data-face]");
      if (!faceEl) return;
      const rect = faceEl.getBoundingClientRect();
      swipe = {
        face: faceEl.dataset.face,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        sx: e.clientX,
        sy: e.clientY
      };
      cubeEl.setPointerCapture?.(e.pointerId);
      return;
    }
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    cubeEl.style.cursor = "grabbing";
    cubeEl.style.transition = "none";
    cubeEl.setPointerCapture?.(e.pointerId);
  });

  cubeEl.addEventListener("pointermove", (e) => {
    if (getHoldActive() || !dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.5;
    rotX = Math.max(-90, Math.min(90, rotX - dy * 0.5));
    applyRotation();
  });

  function endGesture(e) {
    if (getHoldActive()) {
      const s = swipe;
      swipe = null;
      if (!s) return;
      const dx = e.clientX - s.sx;
      const dy = e.clientY - s.sy;
      if (Math.hypot(dx, dy) < 18) return; // too small — treat as a tap, not a turn
      if (canMove && !canMove()) return;
      const relX = s.sx - s.cx;
      const relY = s.sy - s.cy;
      const cross = relX * dy - relY * dx; // >0 = clockwise sweep around the face's centre
      onFaceMove(s.face, cross > 0 ? 1 : -1);
      return;
    }
    if (!dragging) return;
    dragging = false;
    cubeEl.style.cursor = "grab";
    cubeEl.style.transition = "transform .15s ease";
  }
  cubeEl.addEventListener("pointerup", endGesture);
  cubeEl.addEventListener("pointercancel", endGesture);
  cubeEl.addEventListener("pointerleave", endGesture);

  return { reset: () => { rotX = -28; rotY = -35; applyRotation(); } };
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

  let holdActive = false;
  let movesEnabled = false;
  enableCubeControls(rubikEl, {
    getHoldActive: () => holdActive,
    canMove: () => movesEnabled && !finished,
    onFaceMove: (face, dir) => performMove(dir === 1 ? `${face}'` : face)
  });

  const holdBtn = document.getElementById("cube-hold-btn");
  holdBtn.addEventListener("click", () => {
    holdActive = !holdActive;
    holdBtn.classList.toggle("active", holdActive);
    holdBtn.textContent = holdActive ? "🔓 Holding" : "🔒 Hold";
    if (movesEnabled && !finished) {
      document.getElementById("cube-hint").textContent = holdActive
        ? "Cube held — swipe a face to turn it."
        : "Drag to look around the cube.";
    }
  });

  setControlsEnabled(false);

  function setControlsEnabled(enabled) {
    movesEnabled = enabled;
    document.querySelectorAll("#cube-controls button").forEach((b) => (b.disabled = !enabled));
  }

  function performMove(move) {
    if (finished || !movesEnabled) return;
    state = applyMove(state, move);
    paintCube(state);
    updateSolveAura();
    if (isSolved(state)) onSolved();
  }

  // The glow/sparkle "aura" around the cube ramps up the closer the
  // scramble gets to solved — a rough per-sticker match against the
  // solved reference is a good enough proxy for "getting warmer".
  function updateSolveAura() {
    const solved = solvedState();
    let correct = 0;
    for (let i = 0; i < 54; i++) if (state[i] === solved[i]) correct++;
    const fraction = correct / 54;
    const viewport = document.querySelector(".cube-viewport");
    viewport.classList.remove("tier-1", "tier-2", "tier-3", "solved");
    if (finished) viewport.classList.add("solved");
    else if (fraction >= 0.85) viewport.classList.add("tier-3");
    else if (fraction >= 0.6) viewport.classList.add("tier-2");
    else if (fraction >= 0.35) viewport.classList.add("tier-1");
  }
  updateSolveAura();

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
    if (!btn) return;
    performMove(btn.dataset.move);
  });

  function onSolved() {
    finished = true;
    clearInterval(intervalId);
    setControlsEnabled(false);
    updateSolveAura();
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
