import { chromium } from "playwright";

const BASE = "http://localhost:8934";
const errors = [];

function attachErrorCapture(page, label) {
  page.on("pageerror", (err) => {
    const line = `[${label}] pageerror: ${err.message}`;
    errors.push(line);
    console.log("!!", line);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const line = `[${label}] console.error: ${msg.text()}`;
      errors.push(line);
      console.log("!!", line);
    }
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `/tmp/elite-shots/${name}.png` });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  attachErrorCapture(page, "main");

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await shot(page, "01-splash");

  await page.click("#btn-play-now");
  await page.waitForTimeout(200);
  await shot(page, "02-signup");

  await page.fill("#input-elite-id", "TestPilot1");
  await page.click("#btn-do-signup");
  await page.waitForTimeout(400);
  await shot(page, "03-dashboard");

  const dashVisible = await page.isVisible("#screen-dashboard.active");
  console.log("Dashboard active after signup:", dashVisible);

  // --- Play each solo game end to end ---

  // RPS
  await page.click('[data-game="rps"]');
  await page.waitForTimeout(150);
  await page.click("#btn-play-solo");
  await page.waitForTimeout(150);
  await shot(page, "04-rps-start");
  for (let i = 0; i < 20; i++) {
    const doneBtnEarly = await page.$("#rps-done");
    if (doneBtnEarly) break;
    const hasChoices = await page.isVisible('[data-choice="rock"]:not([disabled])');
    if (!hasChoices) {
      await page.waitForTimeout(400);
      continue;
    }
    await page.click('[data-choice="rock"]');
    await page.waitForTimeout(2200); // wait through countdown + reveal
  }
  const doneBtn = await page.$("#rps-done");
  if (doneBtn) {
    await shot(page, "05-rps-finished");
    await doneBtn.click();
  } else {
    console.log("!! RPS match did not finish within iteration budget (best-of-3 vs random AI can be slow due to draws) — clicking dashboard nav directly.");
    await page.click('#bottom-nav [data-nav="screen-dashboard"]');
  }
  await page.waitForTimeout(300);
  await shot(page, "06-back-to-dashboard-after-rps");

  // Connect 4 solo (just play a handful of moves, don't need to finish whole game)
  await page.click('[data-game="connect4"]');
  await page.waitForTimeout(150);
  await page.click("#btn-play-solo");
  await page.waitForTimeout(200);
  await shot(page, "07-connect4-start");
  for (let i = 0; i < 4; i++) {
    const cells = await page.$$("#c4-board .c4-cell");
    if (!cells.length) break;
    // click column 3 (index within row 0 => col index 3, first row cells are indices 0-6)
    await cells[3].click();
    await page.waitForTimeout(900);
  }
  await shot(page, "08-connect4-midgame");
  await page.click('#bottom-nav [data-nav="screen-dashboard"]');
  await page.waitForTimeout(200);

  // Dice solo — roll, hold nothing, score first available category a few times
  await page.click('[data-game="dice"]');
  await page.waitForTimeout(150);
  await page.click("#btn-play-solo");
  await page.waitForTimeout(200);
  await shot(page, "09-dice-start");
  await page.click("#dice-roll");
  await page.waitForTimeout(200);
  await shot(page, "10-dice-rolled");
  const firstScoreBtn = await page.$("#scorecard button[data-cat]");
  if (firstScoreBtn) {
    await firstScoreBtn.click();
    await page.waitForTimeout(200);
    await shot(page, "11-dice-scored-one");
  }
  await page.click('#bottom-nav [data-nav="screen-dashboard"]');
  await page.waitForTimeout(200);

  // Cube solo — go, then apply a couple of moves
  await page.click('[data-game="cube"]');
  await page.waitForTimeout(150);
  await page.click("#btn-play-solo");
  await page.waitForTimeout(200);
  await shot(page, "12-cube-scrambled");
  await page.click("#cube-go");
  await page.waitForTimeout(2500); // wait through 3-2-1 countdown
  await shot(page, "13-cube-ready");
  const moveBtn = await page.$('#cube-controls [data-move="U"]');
  if (moveBtn) {
    await moveBtn.click();
    await page.waitForTimeout(150);
    await shot(page, "14-cube-after-move");
  }
  await page.click('#bottom-nav [data-nav="screen-dashboard"]');
  await page.waitForTimeout(200);

  // Workshop
  await page.click('[data-nav="screen-workshop"]');
  await page.waitForTimeout(300);
  await shot(page, "15-workshop");
  const chromeChip = await page.$('[data-body="chrome"]');
  if (chromeChip) await chromeChip.click();
  const glowChip = await page.$('[data-effect="glow"]');
  if (glowChip) await glowChip.click();
  await page.waitForTimeout(150);
  await shot(page, "16-workshop-customised");
  await page.click("#btn-save-cube");
  await page.waitForTimeout(200);
  await shot(page, "17-workshop-saved");

  // Leaderboard
  await page.click('[data-nav="screen-leaderboard"]');
  await page.waitForTimeout(300);
  await shot(page, "18-leaderboard");

  // Back to dashboard, check challenge setup screen renders (won't actually send, no backend)
  await page.click('#bottom-nav [data-nav="screen-dashboard"]');
  await page.waitForTimeout(200);
  await page.click('[data-game="rps"]');
  await page.waitForTimeout(150);
  await page.click("#btn-open-challenge");
  await page.waitForTimeout(150);
  await shot(page, "19-challenge-setup");
  await page.fill("#input-opponent-id", "SomePlayer");
  await page.click('[data-wager="500"]');
  await page.click("#btn-send-challenge");
  await page.waitForTimeout(300);
  await shot(page, "20-challenge-send-attempt-local-mode");

  await browser.close();

  console.log("\n===== CONSOLE / PAGE ERRORS =====");
  if (errors.length === 0) {
    console.log("None. ✅");
  } else {
    errors.forEach((e) => console.log(e));
  }
  console.log(`\nTotal errors: ${errors.length}`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  console.log("\n===== ERRORS CAPTURED BEFORE FAILURE =====");
  errors.forEach((e) => console.log(e));
  process.exit(1);
});
