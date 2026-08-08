// =====================================================================
// Rock Paper Scissors — UI layer (DOM + Firestore wiring around the
// pure logic in rps-logic.js).
// =====================================================================
import { CHOICES, EMOJI, resolveRound, randomChoice, matchStatus } from "./rps-logic.js";
import { el, toast } from "../ui-helpers.js";
import * as store from "../store.js";

const BEST_OF = 3;

export function mount(root, ctx) {
  root.innerHTML = "";
  if (ctx.mode === "solo") return mountSolo(root, ctx);
  return mountChallenge(root, ctx);
}

function mountSolo(root, ctx) {
  const rounds = [];
  let cancelled = false;

  function renderIdle() {
    root.appendChild(
      el(`
      <div>
        <p class="center-text">Best of ${BEST_OF} vs an ELITE AI opponent. Pick your move!</p>
        <div class="rps-options" id="rps-options">
          ${CHOICES.map((c) => `<button class="rps-option" data-choice="${c}">${EMOJI[c]}</button>`).join("")}
        </div>
        <div class="stat-row mt-16">
          <div class="stat-tile"><div class="value" id="rps-you">0</div><div class="label">You</div></div>
          <div class="stat-tile"><div class="value" id="rps-ai">0</div><div class="label">ELITE AI</div></div>
        </div>
        <div id="rps-result" class="center-text mt-16"></div>
      </div>
    `)
    );
    root.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => playRound(btn.dataset.choice));
    });
  }

  function playRound(myChoice) {
    if (cancelled) return;
    root.querySelectorAll("[data-choice]").forEach((b) => (b.disabled = true));
    const resultEl = document.getElementById("rps-result");
    let count = 3;
    resultEl.innerHTML = `<div class="countdown-num">${count}</div>`;
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        resultEl.innerHTML = `<div class="countdown-num">${count}</div>`;
      } else {
        clearInterval(timer);
        reveal(myChoice);
      }
    }, 500);
  }

  function reveal(myChoice) {
    const aiChoice = randomChoice();
    const outcome = resolveRound(myChoice, aiChoice);
    rounds.push(outcome);
    const status = matchStatus(rounds, BEST_OF);

    document.getElementById("rps-you").textContent = status.p1Wins;
    document.getElementById("rps-ai").textContent = status.p2Wins;

    const resultEl = document.getElementById("rps-result");
    const line = outcome === "draw" ? "🤝 DRAW" : outcome === "p1" ? "🏆 YOU WIN THE ROUND" : "💥 AI WINS THE ROUND";
    resultEl.innerHTML = `
      <div class="rps-arena">
        <div><div class="rps-choice-emoji">${EMOJI[myChoice]}</div><div class="text-dim">You</div></div>
        <div style="font-size:1.6rem;">VS</div>
        <div><div class="rps-choice-emoji">${EMOJI[aiChoice]}</div><div class="text-dim">ELITE AI</div></div>
      </div>
      <h3 class="text-gold">${line}</h3>
    `;

    if (status.decided) {
      const didWin = status.winner === "p1";
      const resultBanner = el(`
        <div class="mt-16">
          <h2 class="center-text">${didWin ? "🏆 MATCH WON!" : "Match lost — run it back?"}</h2>
          <button class="btn btn-gold" id="rps-again">PLAY AGAIN</button>
          <button class="btn btn-outline mt-8" id="rps-done">DONE</button>
        </div>
      `);
      resultEl.appendChild(resultBanner);
      document.getElementById("rps-again").addEventListener("click", () => {
        root.innerHTML = "";
        mountSolo(root, ctx);
      });
      document.getElementById("rps-done").addEventListener("click", () => ctx.onSoloResult(didWin));
    } else {
      setTimeout(() => {
        root.querySelectorAll("[data-choice]").forEach((b) => (b.disabled = false));
        resultEl.innerHTML += `<p class="text-dim mt-8">Next round...</p>`;
      }, 1400);
    }
  }

  renderIdle();
  return () => {
    cancelled = true;
  };
}

function mountChallenge(root, ctx) {
  const { challenge, myUid } = ctx;
  const opponentUid = challenge.fromUid === myUid ? challenge.toUid : challenge.fromUid;
  const iAmP1 = challenge.fromUid === myUid; // just a stable convention for display
  let unsub = null;
  let settled = false;

  root.appendChild(
    el(`
    <div>
      <p class="center-text">Best of ${BEST_OF} · ⭐ ${challenge.wager} points on the line</p>
      <div class="rps-options" id="rps-options">
        ${CHOICES.map((c) => `<button class="rps-option" data-choice="${c}">${EMOJI[c]}</button>`).join("")}
      </div>
      <div class="stat-row mt-16">
        <div class="stat-tile"><div class="value" id="rps-you">0</div><div class="label">You</div></div>
        <div class="stat-tile"><div class="value" id="rps-opp">0</div><div class="label">Opponent</div></div>
      </div>
      <div id="rps-status" class="center-text mt-16 text-dim">Waiting for both players...</div>
    </div>
  `)
  );

  root.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      root.querySelectorAll("[data-choice]").forEach((b) => (b.disabled = true));
      document.querySelector(`[data-choice="${btn.dataset.choice}"]`).classList.add("picked");
      document.getElementById("rps-status").textContent = "Waiting for opponent's move...";
      const state = challenge.state ?? { rounds: [], picks: {} };
      await store.transactionalUpdateChallenge(challenge.id, (data) => {
        const s = data.state ?? { rounds: [], picks: {} };
        if (s.picks?.[myUid]) return null; // already picked this round
        return { state: { ...s, picks: { ...s.picks, [myUid]: btn.dataset.choice } } };
      });
      await maybeResolveRound();
    });
  });

  async function maybeResolveRound() {
    await store.transactionalUpdateChallenge(challenge.id, (data) => {
      const s = data.state ?? { rounds: [], picks: {} };
      const picks = s.picks ?? {};
      if (!picks[challenge.fromUid] || !picks[challenge.toUid]) return null; // not both in yet
      const outcome = resolveRound(picks[challenge.fromUid], picks[challenge.toUid]);
      const winnerUidThisRound = outcome === "draw" ? null : outcome === "p1" ? challenge.fromUid : challenge.toUid;
      const rounds = [...(s.rounds ?? []), { from: picks[challenge.fromUid], to: picks[challenge.toUid], winnerUid: winnerUidThisRound }];
      return { state: { rounds, picks: {} } };
    });
  }

  unsub = store.subscribeChallenge(challenge.id, (data) => {
    if (!data || settled) return;
    const rounds = data.state?.rounds ?? [];
    const myWins = rounds.filter((r) => r.winnerUid === myUid).length;
    const oppWins = rounds.filter((r) => r.winnerUid === opponentUid).length;
    document.getElementById("rps-you").textContent = myWins;
    document.getElementById("rps-opp").textContent = oppWins;

    const needed = Math.ceil(BEST_OF / 2);
    if (myWins >= needed || oppWins >= needed) {
      settled = true;
      const winnerUid = myWins >= needed ? myUid : opponentUid;
      const loserUid = winnerUid === myUid ? opponentUid : myUid;
      document.getElementById("rps-status").innerHTML =
        winnerUid === myUid ? `<h2 class="text-gold">🏆 YOU WON THE MATCH!</h2>` : `<h2>Match lost this time.</h2>`;
      store
        .completeChallenge(challenge.id, { winnerUid, loserUid, wager: challenge.wager })
        .catch(() => {}) // fine if the other client already settled it
        .finally(() => {
          setTimeout(() => ctx.onChallengeSettled(), 1500);
        });
      return;
    }

    // Mid-match status text.
    const picks = data.state?.picks ?? {};
    const iPicked = !!picks[myUid];
    const oppPicked = !!picks[opponentUid];
    if (!iPicked) {
      root.querySelectorAll("[data-choice]").forEach((b) => (b.disabled = false));
      root.querySelectorAll(".rps-option").forEach((b) => b.classList.remove("picked"));
      document.getElementById("rps-status").textContent = oppPicked
        ? "Opponent has moved — your turn!"
        : "Pick your move!";
    } else {
      document.getElementById("rps-status").textContent = "Waiting for opponent's move...";
    }
  });

  return () => {
    if (unsub) unsub();
  };
}
