// =====================================================================
// ELITE — main app entry: routing, auth flow, dashboard, challenges.
// =====================================================================
import { $, $all, showScreen, toast, formatNumber, wireDataNavButtons } from "./ui-helpers.js";
import * as auth from "./auth.js";
import * as store from "./store.js";
import { RANKS } from "./progression.js";
import { initWorkshopScreen, loadWorkshopForProfile } from "./screens/workshop.js";
import { loadLeaderboard } from "./screens/leaderboard.js";

import * as rpsUi from "./games/rps-ui.js";
import * as connect4Ui from "./games/connect4-ui.js";
import * as diceUi from "./games/dice-ui.js";
import * as cubeUi from "./games/cube-ui.js";

const AVATARS = ["🙂", "😎", "🤖", "🦁", "🐯", "🚀", "🔥", "⚡", "🎯", "🏆", "🦊", "🐺"];

const GAMES = [
  { id: "cube", name: "ELITE Cube", icon: "🧩", desc: "Speed & precision", mode: "async", screen: "screen-cube" },
  { id: "rps", name: "Rock Paper Scissors", icon: "🪨📄✂️", desc: "Instant 1v1", mode: "live", screen: "screen-rps" },
  { id: "connect4", name: "Four in a Row", icon: "🔴🟡", desc: "Strategy", mode: "live", screen: "screen-connect4" },
  { id: "dice", name: "ELITE Dice", icon: "🎲", desc: "Risk & decision", mode: "async", screen: "screen-dice" }
];

const GAME_MODULES = { rps: rpsUi, connect4: connect4Ui, dice: diceUi, cube: cubeUi };

const state = {
  user: null,
  profile: null,
  selectedGame: null,
  selectedWager: null,
  incomingChallenges: [],
  activeChallenges: [],
  profileUnsub: null,
  incomingUnsub: null,
  activeUnsub: null,
  currentGameCleanup: null
};

function cleanupCurrentGame() {
  if (state.currentGameCleanup) {
    state.currentGameCleanup();
    state.currentGameCleanup = null;
  }
}

function cleanupSubscriptions() {
  state.profileUnsub?.();
  state.incomingUnsub?.();
  state.activeUnsub?.();
  state.profileUnsub = state.incomingUnsub = state.activeUnsub = null;
}

// ---------- Splash ----------

function wireSplash() {
  $("#btn-play-now").addEventListener("click", () => {
    showScreen(state.user ? "screen-dashboard" : "screen-signup");
  });
  $("#btn-splash-login").addEventListener("click", () => {
    if (!auth.isFirebaseConfigured) {
      toast("Local Demo Mode: tap PLAY NOW to create a guest ID. See SETUP-GUIDE.md for real accounts.");
      return;
    }
    showScreen("screen-login");
  });
  // Purely decorative "players online" flavour number for v1.
  $("#online-count").textContent = formatNumber(900 + Math.floor(Math.random() * 900));
}

function renderAvatarPicker() {
  const wrap = $("#avatar-picker");
  wrap.innerHTML = AVATARS.map((a, i) => `<div class="chip ${i === 0 ? "selected" : ""}" data-avatar="${a}">${a}</div>`).join("");
  wrap.querySelectorAll("[data-avatar]").forEach((chip) => {
    chip.addEventListener("click", () => {
      wrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });
}

function selectedAvatar() {
  return $("#avatar-picker .chip.selected")?.dataset.avatar ?? AVATARS[0];
}

// ---------- Auth forms ----------

function wireAuthForms() {
  if (!auth.isFirebaseConfigured) {
    [$("#input-signup-email"), $("#input-signup-password")].forEach((input) => {
      if (input.previousElementSibling?.tagName === "LABEL") {
        input.previousElementSibling.style.display = "none";
      }
      input.style.display = "none";
    });
  }

  $("#btn-do-signup").addEventListener("click", async () => {
    const btn = $("#btn-do-signup");
    btn.disabled = true;
    try {
      const user = await auth.signUp({
        eliteId: $("#input-elite-id").value,
        avatar: selectedAvatar(),
        email: $("#input-signup-email").value,
        password: $("#input-signup-password").value
      });
      toast(`Welcome to ELITE, ${$("#input-elite-id").value}! 🏆`);
      if (!auth.isFirebaseConfigured) await onAuthChanged(user);
    } catch (err) {
      toast(err.message ?? "Couldn't create your ELITE ID.");
    } finally {
      btn.disabled = false;
    }
  });

  $("#btn-do-login").addEventListener("click", async () => {
    const btn = $("#btn-do-login");
    btn.disabled = true;
    try {
      await auth.logIn({ email: $("#input-login-email").value, password: $("#input-login-password").value });
      toast("Welcome back! 🏆");
    } catch (err) {
      toast(err.message ?? "Couldn't log you in.");
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Dashboard ----------

function rankIcon(rankName) {
  return RANKS.find((r) => r.name === rankName)?.icon ?? "🥉";
}

function renderDashboard(profile) {
  $("#dash-avatar").textContent = profile.avatar ?? "🙂";
  $("#dash-name").textContent = profile.eliteId ?? "Player";
  $("#dash-level").textContent = profile.level ?? 1;
  $("#dash-rank").textContent = profile.rank ?? "Rookie";
  $("#dash-rank-icon").textContent = rankIcon(profile.rank);
  const pct = Math.min(100, Math.round(((profile.xp ?? 0) / (profile.xpToNext ?? 100)) * 100));
  $("#dash-xp-fill").style.width = `${pct}%`;
  $("#dash-xp").textContent = formatNumber(profile.xp ?? 0);
  $("#dash-xp-to-next").textContent = formatNumber(profile.xpToNext ?? 100);
  $("#dash-rating").textContent = formatNumber(profile.rating ?? 1200);
  $("#dash-points").textContent = formatNumber(profile.points ?? 0);
  $("#dash-streak").textContent = `🔥 ${profile.winStreak ?? 0}`;
}

function renderGameList() {
  $("#dash-game-list").innerHTML = GAMES.map(
    (g) => `
    <div class="card game-card" data-game="${g.id}">
      <div class="game-icon">${g.icon}</div>
      <div class="game-meta"><h3>${g.name}</h3><p>${g.desc}</p></div>
      <div>›</div>
    </div>`
  ).join("");
  $all("[data-game]").forEach((card) => {
    card.addEventListener("click", () => openGameDetail(card.dataset.game));
  });
}

function renderChallengesPanel() {
  const wrap = $("#dash-incoming-challenges");
  const pieces = [];

  if (state.incomingChallenges.length) {
    pieces.push(`<h3 class="mt-16">⚔️ Incoming Challenges</h3>`);
    state.incomingChallenges.forEach((c) => {
      const game = GAMES.find((g) => g.id === c.game);
      pieces.push(`
        <div class="card">
          <strong>${c.fromEliteId}</strong> challenged you!
          <div class="text-dim">${game?.icon ?? ""} ${game?.name ?? c.game} · ⭐ ${formatNumber(c.wager)} points</div>
          <div class="btn-row mt-8">
            <button class="btn btn-success btn-sm" data-accept="${c.id}">ACCEPT</button>
            <button class="btn btn-outline btn-sm" data-decline="${c.id}">DECLINE</button>
          </div>
        </div>`);
    });
  }

  if (state.activeChallenges.length) {
    pieces.push(`<h3 class="mt-16">▶️ Active Matches</h3>`);
    state.activeChallenges.forEach((c) => {
      const game = GAMES.find((g) => g.id === c.game);
      const opponent = c.fromUid === state.user.uid ? c.toEliteId : c.fromEliteId;
      pieces.push(`
        <div class="card">
          vs <strong>${opponent}</strong> — ${game?.icon ?? ""} ${game?.name ?? c.game}
          <span class="badge badge-live mt-8" style="display:block;width:fit-content;margin-top:6px;">LIVE</span>
          <button class="btn btn-gold btn-sm mt-8" data-continue="${c.id}">CONTINUE MATCH</button>
        </div>`);
    });
  }

  wrap.innerHTML = pieces.join("");

  wrap.querySelectorAll("[data-accept]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const challenge = state.incomingChallenges.find((c) => c.id === btn.dataset.accept);
      try {
        await store.respondToChallenge(challenge.id, true);
        openChallengeGame({ ...challenge, status: "active" });
      } catch (err) {
        toast(err.message ?? "Couldn't accept challenge.");
      }
    })
  );
  wrap.querySelectorAll("[data-decline]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await store.respondToChallenge(btn.dataset.decline, false);
      toast("Challenge declined.");
    })
  );
  wrap.querySelectorAll("[data-continue]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const challenge = state.activeChallenges.find((c) => c.id === btn.dataset.continue);
      if (challenge) openChallengeGame(challenge);
    })
  );
}

function wireDashboard() {
  $("#btn-logout").addEventListener("click", async () => {
    await auth.logOut();
    if (!auth.isFirebaseConfigured) await onAuthChanged(null);
  });

  $("#btn-quick-match").addEventListener("click", () => {
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];
    toast(`⚡ Matched vs ELITE AI — ${game.name}!`);
    openSoloGame(game.id);
  });
}

// ---------- Game detail / challenge setup ----------

function openGameDetail(gameId) {
  state.selectedGame = GAMES.find((g) => g.id === gameId);
  $("#gd-title").textContent = state.selectedGame.name;
  $("#gd-icon").textContent = state.selectedGame.icon;
  $("#gd-desc").textContent = state.selectedGame.desc;
  showScreen("screen-game-detail");
}

function wireGameDetail() {
  $("#btn-play-solo").addEventListener("click", () => openSoloGame(state.selectedGame.id));
  $("#btn-open-challenge").addEventListener("click", () => {
    $("#cs-game-label").textContent = `${state.selectedGame.icon} ${state.selectedGame.name}`;
    $("#input-opponent-id").value = "";
    state.selectedWager = null;
    $all(".chip", $("#wager-picker")).forEach((c) => c.classList.remove("selected"));
    $("#cs-wager-note").textContent = "Winner: +0 · Loser: −0";
    showScreen("screen-challenge-setup");
  });
}

function wireChallengeSetup() {
  $all(".chip", $("#wager-picker")).forEach((chip) => {
    chip.addEventListener("click", () => {
      $all(".chip", $("#wager-picker")).forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      state.selectedWager = Number(chip.dataset.wager);
      $("#cs-wager-note").textContent = `Winner: +${formatNumber(state.selectedWager)} · Loser: −${formatNumber(state.selectedWager)}`;
    });
  });

  $("#btn-send-challenge").addEventListener("click", async () => {
    const toEliteId = $("#input-opponent-id").value.trim();
    if (!toEliteId) return toast("Enter your opponent's ELITE ID.");
    if (!state.selectedWager) return toast("Choose a points wager.");
    const btn = $("#btn-send-challenge");
    btn.disabled = true;
    try {
      await store.createChallenge({
        fromProfile: state.profile,
        toEliteId,
        game: state.selectedGame.id,
        mode: state.selectedGame.mode,
        wager: state.selectedWager
      });
      toast(`⚔️ Challenge sent to ${toEliteId}!`);
      showScreen("screen-dashboard");
    } catch (err) {
      toast(err.message ?? "Couldn't send that challenge.");
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Launching games ----------

const WIN_COUNTER_FIELD = { rps: "rpsWins", connect4: "connect4Wins" };

function openSoloGame(gameId) {
  const meta = GAMES.find((g) => g.id === gameId);
  cleanupCurrentGame();
  showScreen(meta.screen);
  const root = $(`#${gameId}-root`);
  state.currentGameCleanup = GAME_MODULES[gameId].mount(root, {
    mode: "solo",
    profile: state.profile,
    myUid: state.user.uid,
    onSoloResult: async (didWin) => {
      try {
        const progressed = await store.applySoloResult(state.user.uid, state.profile, didWin);
        if (progressed?.leveledUp) toast(`🎉 Level up! You're now Level ${progressed.level} (${progressed.rank})`);
        const counterField = WIN_COUNTER_FIELD[gameId];
        if (didWin && counterField) await store.incrementWinCounter(state.user.uid, counterField);
      } catch (err) {
        toast(err.message ?? "Couldn't save your progress.");
      }
      cleanupCurrentGame();
      showScreen("screen-dashboard");
    }
  });
}

function openChallengeGame(challenge) {
  const meta = GAMES.find((g) => g.id === challenge.game);
  if (!meta) return;
  cleanupCurrentGame();
  showScreen(meta.screen);
  const root = $(`#${challenge.game}-root`);
  state.currentGameCleanup = GAME_MODULES[challenge.game].mount(root, {
    mode: "challenge",
    challenge,
    myUid: state.user.uid,
    profile: state.profile,
    onChallengeSettled: () => {
      cleanupCurrentGame();
      showScreen("screen-dashboard");
    }
  });
}

// ---------- Auth state / profile subscriptions ----------

async function onAuthChanged(user) {
  cleanupSubscriptions();
  cleanupCurrentGame();
  state.user = user;

  if (!user) {
    state.profile = null;
    $("#bottom-nav").classList.add("hidden");
    showScreen("screen-splash");
    return;
  }

  $("#bottom-nav").classList.remove("hidden");
  showScreen("screen-dashboard");

  state.profileUnsub = store.subscribeProfile(user.uid, (profile) => {
    state.profile = profile;
    if (profile) renderDashboard(profile);
  });
  state.incomingUnsub = store.subscribeIncomingChallenges(user.uid, (list) => {
    state.incomingChallenges = list;
    renderChallengesPanel();
  });
  state.activeUnsub = store.subscribeMyActiveChallenges(user.uid, (list) => {
    state.activeChallenges = list;
    renderChallengesPanel();
  });
}

// ---------- Nav wiring for screens that need a data load on entry ----------

function wireLeaderNav() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (!btn) return;
    cleanupCurrentGame();
    if (btn.dataset.nav === "screen-leaderboard") loadLeaderboard(state.user?.uid);
    if (btn.dataset.nav === "screen-workshop" && state.profile) loadWorkshopForProfile(state.profile);
  });
}

function showLocalModeBanner() {
  const banner = document.createElement("div");
  banner.className = "toast";
  banner.style.position = "static";
  banner.style.margin = "0 0 14px";
  banner.innerHTML = "🔧 <strong>Local Demo Mode</strong> — playing offline on this device. See SETUP-GUIDE.md to connect a free Firebase project for real accounts, cross-device sync and challenging friends.";
  const dashboard = $("#screen-dashboard");
  dashboard.insertBefore(banner, dashboard.children[1] ?? null);
}

// ---------- Boot ----------

function init() {
  wireDataNavButtons();
  wireLeaderNav();
  renderAvatarPicker();
  wireSplash();
  wireAuthForms();
  wireDashboard();
  renderGameList();
  wireGameDetail();
  wireChallengeSetup();
  initWorkshopScreen();
  if (!auth.isFirebaseConfigured) showLocalModeBanner();
  auth.watchAuthState(onAuthChanged);
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Non-fatal — the app still works fully online without the
      // offline app-shell cache, e.g. when opened via file:// locally.
    });
  });
}
