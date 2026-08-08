// =====================================================================
// ELITE — League (leaderboard) screen.
// =====================================================================
import { formatNumber } from "../ui-helpers.js";
import * as store from "../store.js";

let unsub = null;

export function loadLeaderboard(myUid) {
  if (unsub) unsub();
  unsub = store.subscribeLeaderboard((rows) => {
    const list = document.getElementById("leaderboard-list");
    if (!rows.length) {
      list.innerHTML = `<p class="center-text text-dim">No ranked players yet — be the first!</p>`;
      return;
    }
    list.innerHTML = rows
      .map((row, i) => {
        const rankClass = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const isMe = row.uid === myUid;
        return `
        <div class="leaderboard-row">
          <div class="lb-rank ${rankClass}">${medal}</div>
          <div class="avatar" style="width:36px;height:36px;font-size:1.1rem;border-radius:10px;">${row.avatar ?? "🙂"}</div>
          <div class="lb-name">${row.eliteId ?? "Player"}${isMe ? " <span class='text-dim'>(you)</span>" : ""}</div>
          <div class="lb-rating">${formatNumber(row.rating ?? 1200)}</div>
        </div>`;
      })
      .join("");
  });
}
