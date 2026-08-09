// =====================================================================
// ELITE Dice (Yahtzee-style) — UI layer.
// Solo: play a full 13-category scorecard against yourself, chasing a
// high score. Challenge: both players independently play a full
// scorecard and whoever's grand total is higher wins the wager.
// =====================================================================
import {
  CATEGORIES, CATEGORY_LABELS, rollDice, rerollHeld, scoreCategory, computeTotals, isScorecardComplete
} from "./dice-logic.js";
import { el, formatNumber, toast } from "../ui-helpers.js";
import * as store from "../store.js";

const WIN_SCORE_THRESHOLD = 120; // rough "good game" bar for solo XP purposes
const EXTRA_ROLL_COSTS = [100, 200]; // cost of a 4th roll, then a 5th roll (max 2 extra per turn)

function emptyScorecard() {
  const sc = {};
  CATEGORIES.forEach((c) => (sc[c] = null));
  return sc;
}

const PIP_PATTERNS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function diceFace(v) {
  const pips = PIP_PATTERNS[v] ?? [];
  let cells = "";
  for (let i = 0; i < 9; i++) cells += pips.includes(i) ? '<span class="pip"></span>' : "<span></span>";
  return `<div class="die-face">${cells}</div>`;
}

const CATEGORY_BADGE = {
  ones: { icon: "1", color: "#e63946" },
  twos: { icon: "2", color: "#e6633f" },
  threes: { icon: "3", color: "#e68b2f" },
  fours: { icon: "4", color: "#2ecc71" },
  fives: { icon: "5", color: "#22a3d1" },
  sixes: { icon: "6", color: "#3d7dfa" },
  threeKind: { icon: "🎲🎲🎲", color: "#a259ff" },
  fourKind: { icon: "🎲🎲🎲🎲", color: "#7b3ff2" },
  fullHouse: { icon: "🏠", color: "#ff6b9d" },
  smallStraight: { icon: "📈", color: "#22c1a3" },
  largeStraight: { icon: "📈+", color: "#1a9e85" },
  yahtzee: { icon: "👑", color: "#ffd23f" },
  chance: { icon: "🎯", color: "#8a94a6" }
};

function categoryBadgeHTML(cat) {
  const b = CATEGORY_BADGE[cat] ?? { icon: "•", color: "#8a94a6" };
  return `<span class="cat-badge" style="background:${b.color}">${b.icon}</span>`;
}

const UPPER_CATS = CATEGORIES.slice(0, 6);
const LOWER_CATS = CATEGORIES.slice(6);

// Confetti + flashing banner played the moment the upper-section bonus
// is first earned in a game.
function celebrateBonus() {
  const overlay = document.createElement("div");
  overlay.className = "bonus-celebrate-overlay";
  overlay.innerHTML = '<div class="bonus-celebrate-banner">🎉 BONUS WON! 🎉</div>';
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
    piece.style.setProperty("--rot", `${Math.floor(Math.random() * 360)}deg`);
    piece.style.background = ["#f2c14e", "#ffe28a", "#ffffff", "#ffd23f", "#ff8c42"][Math.floor(Math.random() * 5)];
    overlay.appendChild(piece);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2200);
}

export function mount(root, ctx) {
  root.innerHTML = "";
  if (ctx.mode === "solo") return mountGame(root, ctx, { solo: true });
  return mountGame(root, ctx, { solo: false });
}

function mountGame(root, ctx, { solo }) {
  let dice = [1, 1, 1, 1, 1];
  let held = [false, false, false, false, false];
  let rollsLeft = 3;
  let extraRollsThisTurn = 0;
  let pointsBalance = ctx.profile?.points ?? 0;
  let hasRolledOnce = false;
  let scorecard = emptyScorecard();
  let finished = false;
  let bonusCelebrated = false;

  root.appendChild(
    el(`
    <div>
      <div class="dice-arena">
        <div class="dice-row" id="dice-row"></div>
        <p class="center-text dice-arena-hint" id="dice-hint">Tap ROLL to start your turn.</p>
        <button class="btn btn-gold" id="dice-roll">🎲 ROLL (<span id="rolls-left">3</span> left)</button>
        <button class="btn btn-outline mt-8" id="dice-buy-roll" style="display:none;"></button>
        <p class="center-text dice-arena-hint mt-8" id="dice-points">⭐ ${formatNumber(pointsBalance)} points</p>
      </div>
      <div class="divider"></div>
      <div id="scorecard"></div>
      <div id="dice-finish"></div>
    </div>
  `)
  );

  function renderDice() {
    const row = document.getElementById("dice-row");
    row.innerHTML = dice
      .map((v, i) => `<div class="die ${held[i] ? "held" : ""}" data-i="${i}">${diceFace(v)}</div>`)
      .join("");
    row.querySelectorAll(".die").forEach((d) => {
      d.addEventListener("click", () => {
        if (!hasRolledOnce || rollsLeft === 0 || finished) return;
        const i = Number(d.dataset.i);
        held[i] = !held[i];
        renderDice();
      });
    });
  }

  function renderScorecard() {
    const wrap = document.getElementById("scorecard");
    const totals = computeTotals(scorecard);

    function rowsFor(cats) {
      return cats.map((cat) => {
        const filled = scorecard[cat] !== null;
        const preview = !filled && hasRolledOnce ? scoreCategory(cat, dice) : null;
        return `
        <div class="scorecard-row">
          <span>${categoryBadgeHTML(cat)}${CATEGORY_LABELS[cat]}</span>
          ${filled
            ? `<span class="filled">${scorecard[cat]}</span>`
            : `<button data-cat="${cat}" ${hasRolledOnce ? "" : "disabled"}>${preview ?? "—"}</button>`}
        </div>`;
      }).join("");
    }

    wrap.innerHTML = `
      <div class="scorecard-cols">
        <div class="scorecard-col">
          ${rowsFor(UPPER_CATS)}
          <div class="scorecard-row bonus-row"><span>⭐ Bonus (63+)</span><span class="filled">${totals.bonus}</span></div>
        </div>
        <div class="scorecard-col">
          ${rowsFor(LOWER_CATS)}
        </div>
      </div>
      <div class="scorecard-row grand-total-row"><strong>Grand Total</strong><strong class="text-gold">${totals.grandTotal}</strong></div>
    `;

    wrap.querySelectorAll("button[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => lockCategory(btn.dataset.cat));
    });

    updateArenaGlow(totals.grandTotal);
    if (totals.bonus > 0 && !bonusCelebrated) {
      bonusCelebrated = true;
      celebrateBonus();
    }
  }

  // The dice arena's glow ramps up as the running total climbs, ending
  // in a full "on fire" look for a genuinely great scorecard.
  function updateArenaGlow(total) {
    const arena = document.querySelector(".dice-arena");
    arena.classList.remove("tier-1", "tier-2", "tier-3", "tier-4");
    if (total >= 200) arena.classList.add("tier-4");
    else if (total >= 150) arena.classList.add("tier-3");
    else if (total >= 100) arena.classList.add("tier-2");
    else if (total >= 50) arena.classList.add("tier-1");
  }

  function updateRollUI() {
    document.getElementById("rolls-left").textContent = rollsLeft;
    document.getElementById("dice-roll").disabled = rollsLeft === 0 || finished;

    const buyBtn = document.getElementById("dice-buy-roll");
    const canBuy = rollsLeft === 0 && !finished && extraRollsThisTurn < EXTRA_ROLL_COSTS.length;
    if (canBuy) {
      const cost = EXTRA_ROLL_COSTS[extraRollsThisTurn];
      buyBtn.style.display = "";
      buyBtn.disabled = pointsBalance < cost;
      buyBtn.textContent = pointsBalance < cost
        ? `⭐ Buy extra roll — ${formatNumber(cost)} pts (not enough points)`
        : `⭐ Buy extra roll — ${formatNumber(cost)} pts`;
    } else {
      buyBtn.style.display = "none";
    }

    document.getElementById("dice-hint").textContent =
      rollsLeft > 0
        ? "Tap dice to hold them, then roll again or score."
        : canBuy
          ? "No free rolls left — buy an extra roll above, or pick a category below."
          : "No rolls left — pick a category below.";
  }

  async function buyExtraRoll() {
    if (finished || rollsLeft > 0 || extraRollsThisTurn >= EXTRA_ROLL_COSTS.length) return;
    const cost = EXTRA_ROLL_COSTS[extraRollsThisTurn];
    try {
      await store.spendPoints(ctx.myUid, { points: pointsBalance }, cost);
      pointsBalance -= cost;
      extraRollsThisTurn += 1;
      rollsLeft += 1;
      document.getElementById("dice-points").textContent = `⭐ ${formatNumber(pointsBalance)} points`;
      updateRollUI();
    } catch (err) {
      toast(err.message ?? "Couldn't buy an extra roll.");
    }
  }
  document.getElementById("dice-buy-roll").addEventListener("click", buyExtraRoll);

  function lockCategory(cat) {
    if (finished || scorecard[cat] !== null || !hasRolledOnce) return;
    scorecard[cat] = scoreCategory(cat, dice);
    hasRolledOnce = false;
    rollsLeft = 3;
    extraRollsThisTurn = 0;
    held = [false, false, false, false, false];
    updateRollUI();
    document.getElementById("dice-hint").textContent = "Tap ROLL to start your next turn.";
    renderDice();
    renderScorecard();
    if (isScorecardComplete(scorecard)) finishGame();
  }

  document.getElementById("dice-roll").addEventListener("click", () => {
    if (rollsLeft === 0 || finished) return;
    const heldIdx = held.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
    document.getElementById("dice-roll").disabled = true;
    document.querySelectorAll("#dice-row .die").forEach((d, i) => {
      if (!held[i]) d.classList.add("rolling");
    });
    setTimeout(() => {
      dice = hasRolledOnce ? rerollHeld(dice, heldIdx) : rollDice();
      hasRolledOnce = true;
      rollsLeft -= 1;
      updateRollUI();
      renderDice();
      renderScorecard();
    }, 420);
  });

  function finishGame() {
    finished = true;
    const totals = computeTotals(scorecard);
    document.getElementById("dice-roll").disabled = true;
    document.getElementById("dice-buy-roll").style.display = "none";
    const finishEl = document.getElementById("dice-finish");

    if (solo) {
      const didWin = totals.grandTotal >= WIN_SCORE_THRESHOLD;
      if (ctx.profile) store.submitDiceHighScore(ctx.profile, totals.grandTotal).catch(() => {});
      finishEl.innerHTML = `
        <h2 class="center-text text-gold mt-16">Final Score: ${totals.grandTotal}</h2>
        <p class="center-text">${didWin ? "🏆 Great scorecard!" : "Keep practicing — chase that ELITE score!"}</p>
        <button class="btn btn-gold" id="dice-again">PLAY AGAIN</button>
        <button class="btn btn-outline mt-8" id="dice-done">DONE</button>
        <button class="btn btn-outline mt-8" id="dice-highscores-btn">🏆 View Top 20</button>
        <div id="dice-highscores-list" class="hs-list"></div>
      `;
      document.getElementById("dice-again").addEventListener("click", () => {
        root.innerHTML = "";
        mountGame(root, ctx, { solo: true });
      });
      document.getElementById("dice-done").addEventListener("click", () => ctx.onSoloResult(didWin));
      document.getElementById("dice-highscores-btn").addEventListener("click", showHighScores);
    } else {
      submitChallengeResult(totals.grandTotal, finishEl);
    }
  }

  function showHighScores() {
    const listEl = document.getElementById("dice-highscores-list");
    if (listEl.classList.contains("open")) {
      listEl.classList.remove("open");
      listEl.innerHTML = "";
      return;
    }
    listEl.classList.add("open");
    listEl.innerHTML = '<p class="center-text text-dim">Loading...</p>';
    store.subscribeDiceHighScores((rows) => {
      listEl.innerHTML = rows.length
        ? rows.map((r, i) => `
            <div class="hs-row">
              <span class="hs-rank">#${i + 1}</span>
              <span class="hs-avatar">${r.avatar ?? "🙂"}</span>
              <span class="hs-name">${r.eliteId ?? "Guest"}</span>
              <span class="hs-score">${r.score}</span>
            </div>`).join("")
        : '<p class="center-text text-dim">No scores yet — be the first!</p>';
    });
  }

  async function submitChallengeResult(score, finishEl) {
    finishEl.innerHTML = `<p class="center-text mt-16">Submitting your score of <strong>${score}</strong>...</p>`;
    const { challenge, myUid } = ctx;
    await store.transactionalUpdateChallenge(challenge.id, (data) => {
      const s = data.state ?? { results: {} };
      return { state: { ...s, results: { ...(s.results ?? {}), [myUid]: score } } };
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
        finishEl.innerHTML = `<p class="center-text mt-16">Your score: <strong>${mine}</strong>. Waiting for opponent to finish their scorecard...</p>`;
        return;
      }
      settled = true;
      if (mine === theirs) {
        finishEl.innerHTML = `<h3 class="center-text mt-16">🤝 Tied ${mine}-${theirs} — no points change.</h3>`;
        setTimeout(() => ctx.onChallengeSettled(), 1800);
      } else {
        const winnerUid = mine > theirs ? myUid : oppUid;
        const loserUid = winnerUid === myUid ? oppUid : myUid;
        finishEl.innerHTML = `<h3 class="center-text mt-16 ${winnerUid === myUid ? "text-gold" : ""}">${winnerUid === myUid ? "🏆 YOU WIN" : "You lose this one"} — ${mine} vs ${theirs}</h3>`;
        store
          .completeChallenge(challenge.id, { winnerUid, loserUid, wager: challenge.wager })
          .catch(() => {})
          .finally(() => setTimeout(() => ctx.onChallengeSettled(), 1800));
      }
      unsub();
    });
  }

  if (!solo) {
    root.querySelector(".dice-arena").insertAdjacentHTML(
      "beforebegin",
      `<p class="center-text">⭐ ${ctx.challenge.wager} points on the line · play your own scorecard, highest total wins</p>`
    );
  }

  renderDice();
  renderScorecard();
  return () => {};
}
