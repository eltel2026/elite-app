// =====================================================================
// ELITE — Leaderboards screen. Four tabs: ELITE Cube (best time), Rock
// Paper Scissors (most wins), Four in a Row (most wins), ELITE Dice
// (top score) — each its own top-20 board.
// =====================================================================
import { formatNumber } from "../ui-helpers.js";
import * as store from "../store.js";

let unsub = null;
let currentTab = "cube";

const TAB_CONFIG = {
  cube: { subscribe: (cb) => store.subscribeCubeHighScores(cb), render: renderTimeRows },
  rps: { subscribe: (cb) => store.subscribeWinsLeaderboard("rpsWins", cb), render: (rows, myUid) => renderCountRows(rows, myUid, "rpsWins") },
  connect4: { subscribe: (cb) => store.subscribeWinsLeaderboard("connect4Wins", cb), render: (rows, myUid) => renderCountRows(rows, myUid, "connect4Wins") },
  dice: { subscribe: (cb) => store.subscribeDiceHighScores(cb), render: renderScoreRows }
};

function medal(i) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
}
function rankClass(i) {
  return i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
}
function formatCubeTime(ms) {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = (totalSeconds % 60).toFixed(2).padStart(5, "0");
  return `${String(mins).padStart(2, "0")}:${secs}`;
}
function rowShell(i, avatar, name, isMe, value) {
  return `
    <div class="leaderboard-row">
      <div class="lb-rank ${rankClass(i)}">${medal(i)}</div>
      <div class="avatar" style="width:36px;height:36px;font-size:1.1rem;border-radius:10px;">${avatar ?? "🙂"}</div>
      <div class="lb-name">${name ?? "Player"}${isMe ? " <span class='text-dim'>(you)</span>" : ""}</div>
      <div class="lb-rating">${value}</div>
    </div>`;
}

function renderTimeRows(rows, myUid) {
  if (!rows.length) return `<p class="center-text text-dim">No times yet — be the first!</p>`;
  return rows.map((row, i) => rowShell(i, row.avatar, row.eliteId, row.uid === myUid, formatCubeTime(row.timeMs))).join("");
}
function renderScoreRows(rows, myUid) {
  if (!rows.length) return `<p class="center-text text-dim">No scores yet — be the first!</p>`;
  return rows.map((row, i) => rowShell(i, row.avatar, row.eliteId, row.uid === myUid, formatNumber(row.score))).join("");
}
function renderCountRows(rows, myUid, field) {
  const withWins = rows.filter((r) => (r[field] ?? 0) > 0);
  if (!withWins.length) return `<p class="center-text text-dim">No wins yet — be the first!</p>`;
  return withWins.map((row, i) => rowShell(i, row.avatar, row.eliteId, row.uid === myUid, `${formatNumber(row[field] ?? 0)} wins`)).join("");
}

export function loadLeaderboard(myUid) {
  wireTabs(myUid);
  loadTab(currentTab, myUid);
}

function wireTabs(myUid) {
  const tabsEl = document.getElementById("lb-tabs");
  if (tabsEl.dataset.wired) return;
  tabsEl.dataset.wired = "1";
  tabsEl.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      currentTab = btn.dataset.tab;
      loadTab(currentTab, myUid);
    });
  });
}

function loadTab(tab, myUid) {
  if (unsub) unsub();
  const list = document.getElementById("leaderboard-list");
  list.innerHTML = '<div class="spinner"></div>';
  const config = TAB_CONFIG[tab];
  unsub = config.subscribe((rows) => {
    list.innerHTML = config.render(rows, myUid);
  });
}
