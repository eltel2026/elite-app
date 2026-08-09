// =====================================================================
// ELITE Cube — UI layer. A real 3x3 Rubik's cube built from 26 actual
// 3D pieces (not flat colored panels), so turning a face genuinely
// swings that layer of pieces through 3D space before it lands, and
// swiping/hold controls always grab the exact piece your finger is on.
// =====================================================================
import {
  solvedState, applyMove, isSolved, generateScramble, hashSeed, FACE_COLORS, MOVE_NAMES
} from "./cube-logic.js";
import { el } from "../ui-helpers.js";
import { applyCubeSkin } from "./cube-skin.js";
import * as store from "../store.js";

const SCRAMBLE_LENGTH = 20;
const FACE_ORDER = ["U", "D", "F", "B", "L", "R"];

// ---- 3D geometry -----------------------------------------------------
// Every cubie sits at a grid coordinate (gx,gy,gz) with each in
// {-1,0,1} (27 slots, minus the fully-hidden centre = 26 real pieces).
// This mapping from a sticker's (face,row,col) to its 3D grid position
// was derived from — and numerically verified against — the exact same
// geometry that generated the move tables in cube-logic.js, so a
// physical layer-turn animation and the logical move always agree.
const CUBIE = 76;
const GAP = 6;
const STEP = CUBIE + GAP;
const HALF = CUBIE / 2;

const AXIS_FOR_FACE = { U: "y", D: "y", F: "z", B: "z", L: "x", R: "x" };
const FIXED_FOR_FACE = { U: 1, D: -1, F: 1, B: -1, L: -1, R: 1 };

function xyzToRowCol(face, gx, gy, gz) {
  switch (face) {
    case "U": return { row: gz + 1, col: gx + 1 };
    case "D": return { row: 1 - gz, col: gx + 1 };
    case "F": return { row: 1 - gy, col: gx + 1 };
    case "B": return { row: 1 - gy, col: 1 - gx };
    case "L": return { row: 1 - gy, col: gz + 1 };
    case "R": return { row: 1 - gy, col: 1 - gz };
  }
}

const CF_ORIENT = {
  U: `rotateX(90deg) translateZ(${HALF}px)`,
  D: `rotateX(-90deg) translateZ(${HALF}px)`,
  F: `translateZ(${HALF}px)`,
  B: `rotateY(180deg) translateZ(${HALF}px)`,
  L: `rotateY(-90deg) translateZ(${HALF}px)`,
  R: `rotateY(90deg) translateZ(${HALF}px)`
};

const CUBIE_CELLS = [];
for (let gx = -1; gx <= 1; gx++) {
  for (let gy = -1; gy <= 1; gy++) {
    for (let gz = -1; gz <= 1; gz++) {
      if (gx === 0 && gy === 0 && gz === 0) continue;
      CUBIE_CELLS.push([gx, gy, gz]);
    }
  }
}

function renderCubeHTML() {
  return `
    <div class="cube-viewport">
      <button class="cube-hold-btn" id="cube-hold-btn" type="button">🔒 Hold</button>
      <div class="rubik" id="rubik"></div>
    </div>
  `;
}

// Rebuilds all 26 pieces from scratch to exactly match `state`. Called
// once up front, and again right as each move's animation finishes —
// by that point the pieces have already visually swung into place, so
// this just makes the final resting arrangement authoritative.
function buildCubieCube(container, state) {
  container.innerHTML = "";
  CUBIE_CELLS.forEach(([gx, gy, gz]) => {
    const cubie = document.createElement("div");
    cubie.className = "cubie";
    cubie.dataset.gx = gx;
    cubie.dataset.gy = gy;
    cubie.dataset.gz = gz;
    cubie.style.transform = `translate3d(${gx * STEP}px, ${-gy * STEP}px, ${gz * STEP}px)`;

    const activeFaces = [];
    if (gy === 1) activeFaces.push("U");
    if (gy === -1) activeFaces.push("D");
    if (gz === 1) activeFaces.push("F");
    if (gz === -1) activeFaces.push("B");
    if (gx === -1) activeFaces.push("L");
    if (gx === 1) activeFaces.push("R");

    activeFaces.forEach((face) => {
      const { row, col } = xyzToRowCol(face, gx, gy, gz);
      const faceIdx = FACE_ORDER.indexOf(face);
      const color = FACE_COLORS[state[faceIdx * 9 + row * 3 + col]];
      const sticker = document.createElement("div");
      sticker.className = "cf";
      sticker.dataset.face = face;
      sticker.style.background = color;
      sticker.style.transform = CF_ORIENT[face];
      cubie.appendChild(sticker);
    });

    container.appendChild(cubie);
  });
}

// Cosmetic pre-roll: physically swings the 9 pieces of the turning
// layer through 90° in 3D before `onDone` fires (which is where the
// logical move + a fresh rebuild happen). The exact CSS rotation angle
// per axis below was derived algebraically from this file's own
// translate3d convention and cross-checked against the cube's other
// already-correct face placements — not guessed.
function animateLayerTurn(container, move, onDone) {
  const face = move[0];
  const axis = AXIS_FOR_FACE[face];
  const fixedVal = FIXED_FOR_FACE[face];
  const dirMath = move.endsWith("'") ? 1 : -1;
  const cssAngle = (axis === "y" ? dirMath : -dirMath) * 90;
  const rotateFn = axis === "x" ? "rotateX" : axis === "y" ? "rotateY" : "rotateZ";
  const attr = axis === "x" ? "gx" : axis === "y" ? "gy" : "gz";

  const layerCubies = Array.from(container.querySelectorAll(".cubie")).filter(
    (c) => Number(c.dataset[attr]) === fixedVal
  );

  layerCubies.forEach((cubie) => {
    const gx = Number(cubie.dataset.gx);
    const gy = Number(cubie.dataset.gy);
    const gz = Number(cubie.dataset.gz);
    const base = `translate3d(${gx * STEP}px, ${-gy * STEP}px, ${gz * STEP}px)`;
    cubie.style.transition = "none";
    cubie.style.transform = `${rotateFn}(0deg) ${base}`;
    void cubie.offsetHeight; // force a reflow so the transition below actually starts from 0deg
    cubie.style.transition = "transform 260ms ease-in-out";
    requestAnimationFrame(() => {
      cubie.style.transform = `${rotateFn}(${cssAngle}deg) ${base}`;
    });
  });

  setTimeout(onDone, 300);
}

// Averages the on-screen centre of every currently-visible sticker
// belonging to one macro face — used as the pivot point for detecting
// whether a swipe swept clockwise or counter-clockwise around it.
function faceScreenCentre(face) {
  const stickers = document.querySelectorAll(`[data-face="${face}"]`);
  let sx = 0, sy = 0, n = 0;
  stickers.forEach((elm) => {
    const r = elm.getBoundingClientRect();
    sx += r.left + r.width / 2;
    sy += r.top + r.height / 2;
    n++;
  });
  return n ? { x: sx / n, y: sy / n } : null;
}

// Two interaction modes share one pointer listener set on the cube:
//   - Hold OFF (default): dragging spins the cube around so you can look
//     at any face — pure viewing, no move is made.
//   - Hold ON: the view freezes, and swiping across a face twists that
//     face instead. `elementsFromPoint` finds the exact piece under the
//     finger (real 3D pieces give it plenty of distinct surface to grab,
//     unlike a single flat panel), and the turn direction comes from the
//     rotational sense of the swipe around that face's true on-screen
//     centre — e.g. dragging along the top edge to the right is a
//     clockwise turn, the same way turning a steering wheel works.
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

  function faceAt(x, y) {
    const stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    for (const node of stack) {
      const faceEl = node?.closest?.("[data-face]");
      if (faceEl) return faceEl.dataset.face;
    }
    return null;
  }

  cubeEl.addEventListener("pointerdown", (e) => {
    if (getHoldActive()) {
      const face = faceAt(e.clientX, e.clientY);
      if (!face) return;
      const centre = faceScreenCentre(face);
      if (!centre) return;
      swipe = { face, cx: centre.x, cy: centre.y, sx: e.clientX, sy: e.clientY };
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
            if (Math.hypot(dx, dy) < 45) return; // require a clear, deliberate swipe — not a small/ambiguous flick
      if (canMove && !canMove()) return;
      const relX = s.sx - s.cx;
      const relY = s.sy - s.cy;
      const cross = relX * dy - relY * dx;
      onFaceMove(s.face, cross > 0 ? -1 : 1);
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

export function mount(root, ctx) {
  root.innerHTML = "";
  if (ctx.mode === "solo") return mountGame(root, ctx, { solo: true, seed: hashSeed(String(Date.now() + Math.random())) });
  const seed = ctx.challenge.state?.seed ?? hashSeed(ctx.challenge.id);
  return mountGame(root, ctx, { solo: false, seed });
}

function mountGame(root, ctx, { solo, seed }) {
  const scramble = generateScramble(seed, SCRAMBLE_LENGTH);
  let state = scramble.reduce((s, m) => applyMove(s, m), solvedState());
  let startTime = null;
  let intervalId = null;
  let finished = false;
  let animating = false;

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

  const rubikEl = document.getElementById("rubik");
  buildCubieCube(rubikEl, state);
  if (ctx.profile?.cube) applyCubeSkin(rubikEl, ctx.profile.cube);

  let holdActive = false;
  let movesEnabled = false;
  enableCubeControls(rubikEl, {
    getHoldActive: () => holdActive,
    canMove: () => movesEnabled && !finished && !animating,
    onFaceMove: (face, dir) => performMove(dir === 1 ? face : `${face}'`)
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
    if (finished || !movesEnabled || animating) return;
    animating = true;
    setControlsEnabled(false);
    animateLayerTurn(rubikEl, move, () => {
      state = applyMove(state, move);
      buildCubieCube(rubikEl, state);
      if (ctx.profile?.cube) applyCubeSkin(rubikEl, ctx.profile.cube);
      updateSolveAura();
      animating = false;
      if (isSolved(state)) {
        onSolved();
      } else if (!finished) {
        setControlsEnabled(true);
      }
    });
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
      if (ctx.profile) store.submitCubeHighScore(ctx.profile, elapsedMs).catch(() => {});
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
