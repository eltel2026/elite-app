# ELITE

Challenge. Compete. Conquer. 🏆

A free competitive mini-games platform: player profiles, XP & levels, ELITE Points, a Cube Workshop, a global League, and four fully playable games — **ELITE Cube**, **Rock Paper Scissors**, **Four in a Row**, and **ELITE Dice**.

**👉 Start with [SETUP-GUIDE.md](./SETUP-GUIDE.md)** — it walks through trying the app immediately, putting it online with GitHub Pages, adding it to your iPhone home screen, and (optionally) turning on real accounts with a free Firebase project.

## What's in this folder

- `index.html`, `css/`, `js/` — the app itself (plain HTML/CSS/JavaScript, no build step required).
- `js/games/*-logic.js` — the pure game-rule engines (Rubik's cube move logic, Connect-4, Yahtzee scoring, Rock Paper Scissors), fully unit tested — see `scripts/test-logic.mjs`.
- `js/games/*-ui.js`, `js/screens/*.js` — the on-screen UI for each game and screen.
- `js/store.js` — the only file that talks to Firebase/Firestore.
- `js/local-store.js` — powers "Local Demo Mode" so the app is playable before Firebase is set up.
- `firestore.rules` — the security rules to paste into your Firebase project (see the setup guide).
- `manifest.json`, `sw.js`, `assets/` — make ELITE installable as a home-screen app (PWA).
- `scripts/` — developer tooling: `test-logic.mjs` runs the full test suite for the pure game logic, `generate-cube-tables.mjs` is how the cube's move tables were derived (and verified) from real 3D geometry.

## Running the tests

```
node scripts/test-logic.mjs
```
