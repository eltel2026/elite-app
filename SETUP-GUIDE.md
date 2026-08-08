# ELITE — Setup Guide

Welcome! This is your ELITE app: profiles, XP & levels, ELITE Points, a Cube Workshop, and four fully working games — **ELITE Cube**, **Rock Paper Scissors**, **Four in a Row**, and **ELITE Dice**. You can play every game solo against the ELITE AI, or challenge another ELITE player 1v1 once real accounts are switched on.

This guide has three stages. You don't have to do them all at once:

1. **Try it right now** — no setup at all.
2. **Put it on the web** (GitHub Pages) so you and anyone else can open it from a link, and add it to an iPhone home screen like a real app.
3. **Turn on real accounts** (Firebase, free) so people can sign up, log in from any device, and challenge each other.

---

## Stage 1 — Try it right now (Local Demo Mode)

Everything in this ZIP already works without any setup, in what the app calls **Local Demo Mode**. Open `index.html` in a browser (double-click it, or see Stage 2 to put it online) and you can:

- Create a guest ELITE ID and avatar
- Play all four games solo against the ELITE AI
- Level up, earn XP, see your rank change
- Customise your Cube in the Workshop

You'll see a banner on the dashboard reminding you that you're in Local Demo Mode. In this mode your progress is only saved on that one device/browser, and the **Challenge a Player** feature is disabled (it needs real accounts — see Stage 3) — everything else works fully.

> Note: opening `index.html` by double-clicking it can show a blank page in some browsers because the app is built from small JavaScript files that need to be "served" rather than opened directly from disk. If that happens, just skip ahead to Stage 2 — once it's on GitHub Pages it will work perfectly, including on your iPhone.

---

## Stage 2 — Put ELITE on the web with GitHub Pages

This gives you a real web address anyone can open, and it's what lets you add ELITE to your iPhone's home screen like an app.

### 2.1 Create a new repository

1. On [github.com](https://github.com), tap the **+** icon (top right) → **New repository**.
2. Name it something like `elite-app`.
3. Set it to **Public** (GitHub Pages on a free account needs a public repo).
4. Don't add a README — leave it empty. Tap **Create repository**.

### 2.2 Upload the files

You should now be looking at an empty repository page with an **"Add file"** button (or **"uploading an existing file"** link).

1. First, unzip the file I sent you:
   - **On iPhone:** open the Files app, find the ZIP, tap it once — it extracts automatically into a folder with the same name.
   - **On a computer:** double-click the ZIP to extract it.
2. Back on GitHub: tap **Add file → Upload files**.
3. Select **all the files and folders** from the unzipped ELITE folder (`index.html`, `manifest.json`, `sw.js`, the `css` folder, the `js` folder, the `assets` folder, `firestore.rules`, this guide, everything) and upload them together. Modern browsers let you drag a whole folder in — if your phone's browser won't let you select a folder, upload the top-level files first, then go **Add file → Upload files** again for each subfolder.
4. Scroll down and tap **Commit changes**.

Take your time with this step — it's the one that gave you trouble before. If GitHub's interface looks different from these instructions or you get stuck, tell me exactly what you see on screen and I'll walk you through the next tap.

### 2.3 Turn on GitHub Pages

1. In your repository, tap **Settings**.
2. In the left menu, tap **Pages**.
3. Under "Branch", choose `main` and folder `/ (root)`, then **Save**.
4. Wait about a minute, then refresh — GitHub will show you a web address like `https://yourusername.github.io/elite-app/`. That's your live ELITE app!

### 2.4 Add it to your iPhone home screen

1. Open your ELITE web address in **Safari** on your iPhone (must be Safari, not Chrome, for this to work).
2. Tap the **Share** button (square with an arrow).
3. Tap **Add to Home Screen**.
4. Give it a name (e.g. "ELITE") and tap **Add**.

You'll now have an ELITE icon on your home screen that opens full-screen, just like a real app — no browser address bar, its own icon, everything. This is the practical alternative to a native App Store app: it costs nothing, needs no Apple Developer account, and updates instantly whenever you update the files on GitHub.

---

## Stage 3 — Turn on real accounts (Firebase, free)

This is what unlocks: real sign-up/login with email & password, progress that syncs across every device you log in on, the global League leaderboard with real players, and the Challenge-a-Friend system.

Firebase is Google's backend service. The free tier ("Spark plan") is very generous and comfortably covers an app like this with normal usage.

### 3.1 Create your Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Create a project** (or **Add project**). Call it "ELITE" (or anything).
3. You can turn off Google Analytics for this project — it isn't needed.
4. Click **Create project** and wait for it to finish.

### 3.2 Register a web app

1. On your new project's overview page, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname like "ELITE Web" and click **Register app**. Don't tick the Firebase Hosting box — you're already using GitHub Pages.
3. Firebase will show you a block of code containing a `firebaseConfig` object with values like `apiKey`, `authDomain`, `projectId`, etc. Keep this page open — you'll need it in the next step.

### 3.3 Add your config to ELITE

1. In your GitHub repository, open the file `js/firebase-config.js` (click it, then click the pencil/edit icon).
2. Replace the placeholder values with the real values Firebase showed you, so it looks like:
   ```js
   export const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "elite-xxxxx.firebaseapp.com",
     projectId: "elite-xxxxx",
     storageBucket: "elite-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
3. Commit the change. GitHub Pages will automatically republish within a minute or two.

Once this file has real values, ELITE automatically switches out of Local Demo Mode into full real-accounts mode — nothing else to configure in the code.

### 3.4 Turn on Email/Password sign-in

1. Back in the Firebase console, left menu → **Build → Authentication**.
2. Click **Get started**, then choose **Email/Password** from the list of sign-in providers.
3. Toggle it **Enabled** and click **Save**.

### 3.5 Create the database

1. Left menu → **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (ELITE ships its own security rules — see next step).
4. Pick a location close to you/your players and click **Enable**.

### 3.6 Add ELITE's security rules

1. In Firestore, click the **Rules** tab.
2. Open the `firestore.rules` file from your GitHub repository, select all its contents, and copy them.
3. Paste them over everything in the Firebase Rules editor, replacing the default rules.
4. Click **Publish**.

That's it — real accounts, cross-device sync, and challenging friends are now fully live. Reload your ELITE web address (or reopen the home screen icon) and create a proper account with your email to try it.

---

## How the games work

- **ELITE Cube** — a genuine, fully-working 3x3 cube (built from real cube geometry, not a simplified fake). You turn faces with the on-screen buttons (U, D, F, B, L, R, and their reverses). Solo mode gives you a fresh scramble each time; in a Challenge, both players get the *identical* scramble and the fastest solve wins.
- **Rock Paper Scissors** — best of 3, with a dramatic 3-2-1 countdown and reveal.
- **Four in a Row** — classic Connect-4 rules, solo vs a sensible AI (it takes winning moves and blocks yours) or live 1v1.
- **ELITE Dice** — a full Yahtzee-style scorecard (13 categories, the classic +35 upper-section bonus). Solo, you're chasing a high score; in a Challenge, both players complete their own scorecard and the higher total wins.

Winning a Challenge moves ELITE Points from the loser to the winner, shifts both players' ELITE Rating (a chess-style Elo rating — beating a higher-rated player gains you more), and continues/breaks win streaks. Everyone starts with 1,000 ELITE Points and a 1,200 rating.

## Honest limitations of this v1 (and what to do about them)

- **"Quick Match"** currently matches you instantly against the ELITE AI on a random game, rather than a live pool of real opponents — a real skill-based matchmaking queue needs a small always-on backend component (a Cloud Function) and is a natural v1.1 addition once you have real players to match.
- **The security rules are intentionally permissive** on updating rating/points/XP so that either player's device can settle a finished Challenge. Since ELITE Points have no real-world value, this is a reasonable trade-off for a free casual game, but it does mean a technically determined person could tamper with their own stats via the browser dev tools. If ELITE ever attaches real value to points (cash prizes, paid entry, etc.), that logic should move into a Cloud Function instead — happy to help with that when the time comes.
- **The "players online" counter** on the splash screen is a decorative placeholder for now, not a live count — real presence tracking is a nice future addition once Firebase is connected.
- **A true native iOS App Store app** isn't part of this build (it needs Xcode, a Mac, and an Apple Developer account/fee) — the "Add to Home Screen" approach in Stage 2.4 is the practical free equivalent, and a huge number of real products ship this way (it's called a Progressive Web App).

## If something goes wrong

- **Blank white screen:** almost always means it's being opened as a local file rather than served over http(s) — make sure you're opening the GitHub Pages URL, not double-clicking `index.html`.
- **"ELITE ID already taken":** someone (maybe you, in an earlier test) already used that ID — try another.
- **Can't log in / challenges don't work:** double check `js/firebase-config.js` has your real values (not the `YOUR_API_KEY` placeholders) and that you completed steps 3.4–3.6.
- Anything else — send me what you're seeing and I'll help you fix it.

Have fun — and good luck climbing the ELITE League. 🏆
