// =====================================================================
// ELITE Dice (Yahtzee-style) — UI layer.
// Solo: play a full 13-category scorecard against yourself, chasing a
// high score. Challenge: both players independently play a full
// scorecard and whoever's grand total is higher wins the wager.
// =====================================================================
import {
  CATEGORIES, CATEGORY_LABELS, rollDice, rerollHeld, scoreCategory, computeTotals, isScorecardComplete
} from "./dice-logic.js";
import { el, formatNumber } from "../ui-helpers.js";
import * as store from "../store.js";

const WIN_SCORE_THRESHOLD = 120; // rough "good game" bar for solo XP purposes

function emptyScorecard() {
  const sc = {};
  CATEGORIES.forEach((c) => (sc[c] = null));
  return sc;
}

function diceFace(v) {
  return ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][v] ?? v;
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
  let hasRolledOnce = false;
  let scorecard = emptyScorecard();
  let finished = false;

  root.appendChild(
    el(`
    <div>
      <div class="dice-row" id="dice-row"></div>
      <p class="center-text text-dim" id="dice-hint">Tap ROLL to start your turn.</p>
      <button class="btn btn-gold" id="dice-roll">🎲 ROLL (<span id="rolls-left">3</span> left)</button>
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
    wrap.innerHTML =
      CATEGORIES.map((cat) => {
        const filled = scorecard[cat] !== null;
        const preview = !filled && hasRolledOnce ? scoreCategory(cat, dice) : null;
        return `
        <div class="scorecard-row">
          <span>${CATEGORY_LABELS[cat]}</span>
          ${filled
            ? `<span class="filled">${scorecard[cat]}</span>`
            : `<button data-cat="${cat}" ${hasRolledOnce ? "" : "disabled"}>${preview ?? "—"}</button>`}
        </div>`;
      }).join("") +
      `<div class="scorecard-row"><span>Upper bonus (63+)</span><span class="filled">${totals.bonus}</span></div>
       <div class="scorecard-row"><strong>Grand Total</strong><strong class="text-gold">${totals.grandTotal}</strong></div>`;

    wrap.querySelectorAll("button[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => lockCategory(btn.dataset.cat));
    });
  }

  function lockCategory(cat) {
    if (finished || scorecard[cat] !== null || !hasRolledOnce) return;
    scorecard[cat] = scoreCategory(cat, dice);
    hasRolledOnce = false;
    rollsLeft = 3;
    held = [false, false, false, false, false];
    document.getElementById("rolls-left").textContent = rollsLeft;
    document.getElementById("dice-hint").textContent = "Tap ROLL to start your next turn.";
    document.getElementById("dice-roll").disabled = false;
    renderDice();
    renderScorecard();
    if (isScorecardComplete(scorecard)) finishGame();
  }

  document.getElementById("dice-roll").addEventListener("click", () => {
    if (rollsLeft === 0 || finished) return;
    dice = hasRolledOnce ? rerollHeld(dice, held.map((h, i) => (h ? i : -1)).filter((i) => i >= 0)) : rollDice();
    hasRolledOnce = true;
    rollsLeft -= 1;
    document.getElementById("rolls-left").textContent = rollsLeft;
    document.getElementById("dice-hint").textContent =
      rollsLeft === 0 ? "No rolls left — pick a category below." : "Tap dice to hold them, then roll again or score.";
    document.getElementById("dice-roll").disabled = rollsLeft === 0;
    renderDice();
    renderScorecard();
  });

  function finishGame() {
    finished = true;
    const totals = computeTotals(scorecard);
    document.getElementById("dice-roll").disabled = true;
    const finishEl = document.getElementById("dice-finish");

    if (solo) {
      const didWin = totals.grandTotal >= WIN_SCORE_THRESHOLD;
      finishEl.innerHTML = `
        <h2 class="center-text text-gold mt-16">Final Score: ${totals.grandTotal}</h2>
        <p class="center-text">${didWin ? "🏆 Great scorecard!" : "Keep practicing — chase that ELITE score!"}</p>
        <button class="btn btn-gold" id="dice-again">PLAY AGAIN</button>
        <button class="btn btn-outline mt-8" id="dice-done">DONE</button>
      `;
      document.getElementById("dice-again").addEventListener("click", () => {
        root.innerHTML = "";
        mountGame(root, ctx, { solo: true });
      });
      document.getElementById("dice-done").addEventListener("click", () => ctx.onSoloResult(didWin));
    } else {
      submitChallengeResult(totals.grandTotal, finishEl);
    }
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
    root.querySelector("#dice-hint").insertAdjacentHTML(
      "beforebegin",
      `<p class="center-text">⭐ ${ctx.challenge.wager} points on the line · play your own scorecard, highest total wins</p>`
    );
  }

  renderDice();
  renderScorecard();
  return () => {};
}
