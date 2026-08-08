// =====================================================================
// ELITE — Progression logic (pure functions, no DOM / Firebase deps)
// Kept separate and dependency-free so it can be unit tested directly.
// =====================================================================

export const RANKS = [
  { name: "Rookie", minLevel: 1, icon: "🥉" },
  { name: "Challenger", minLevel: 5, icon: "🥈" },
  { name: "Competitor", minLevel: 10, icon: "🥇" },
  { name: "Elite", minLevel: 15, icon: "💎" },
  { name: "Master", minLevel: 20, icon: "👑" },
  { name: "Grandmaster", minLevel: 25, icon: "⚡" },
  { name: "Legend", minLevel: 30, icon: "🏆" }
];

export const UNLOCKS = {
  5: "New avatar style",
  10: "New Cube design",
  15: "Victory animation",
  20: "Gold profile badge",
  25: "Premium Cube"
};

// XP needed to go from `level` to `level + 1`.
export function xpRequiredForLevel(level) {
  return Math.round(100 + (level - 1) * 25);
}

export function rankForLevel(level) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

// Adds XP to a profile-like object { level, xp } and rolls over any
// level-ups. Returns a NEW object plus metadata about what happened,
// it does not mutate the input.
export function addXp(profile, amount) {
  let level = profile.level ?? 1;
  let xp = (profile.xp ?? 0) + Math.max(0, Math.round(amount));
  const leveledUpTo = [];

  let required = xpRequiredForLevel(level);
  while (xp >= required) {
    xp -= required;
    level += 1;
    leveledUpTo.push(level);
    required = xpRequiredForLevel(level);
  }

  const unlocks = leveledUpTo.filter((lvl) => UNLOCKS[lvl]).map((lvl) => ({
    level: lvl,
    reward: UNLOCKS[lvl]
  }));

  return {
    level,
    xp,
    xpToNext: required,
    rank: rankForLevel(level).name,
    leveledUp: leveledUpTo.length > 0,
    leveledUpTo,
    unlocks
  };
}

// Simple Elo-style rating update. K is the maximum swing per match.
export function eloDelta(myRating, oppRating, didWin, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  const actual = didWin ? 1 : 0;
  return Math.round(k * (actual - expected));
}

// Resolves the outcome of a challenge for BOTH players at once and
// returns everything the UI / Firestore writer needs.
export function resolveChallenge({
  winner, // profile-like { level, xp, rating, winStreak }
  loser, // profile-like { level, xp, rating, winStreak }
  wager, // ELITE Points on the line
  winnerXp = 150,
  loserXp = 40
}) {
  const ratingDelta = Math.abs(
    eloDelta(winner.rating ?? 1200, loser.rating ?? 1200, true)
  );

  const winnerProgress = addXp(winner, winnerXp);
  const loserProgress = addXp(loser, loserXp);

  return {
    winner: {
      ...winnerProgress,
      rating: (winner.rating ?? 1200) + ratingDelta,
      points: (winner.points ?? 0) + wager,
      winStreak: (winner.winStreak ?? 0) + 1
    },
    loser: {
      ...loserProgress,
      rating: Math.max(100, (loser.rating ?? 1200) - ratingDelta),
      points: Math.max(0, (loser.points ?? 0) - wager),
      winStreak: 0
    }
  };
}

// Solo play (no opponent, no wager) — smaller, flat XP reward, bigger
// for a win. Doesn't touch rating, points or win streak.
export function resolveSoloPlay(profile, didWin, { winXp = 60, loseXp = 20 } = {}) {
  return addXp(profile, didWin ? winXp : loseXp);
}
