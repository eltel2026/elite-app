// =====================================================================
// ELITE Dice — Yahtzee-style scoring, pure game logic (no DOM).
// =====================================================================

export const CATEGORIES = [
  "ones", "twos", "threes", "fours", "fives", "sixes",
  "threeKind", "fourKind", "fullHouse", "smallStraight", "largeStraight",
  "yahtzee", "chance"
];

export const CATEGORY_LABELS = {
  ones: "Ones", twos: "Twos", threes: "Threes", fours: "Fours",
  fives: "Fives", sixes: "Sixes",
  threeKind: "Three of a Kind", fourKind: "Four of a Kind",
  fullHouse: "Full House", smallStraight: "Small Straight",
  largeStraight: "Large Straight", yahtzee: "ELITE Five (Yahtzee)",
  chance: "Chance"
};

export function rollDice(rand = Math.random, count = 5) {
  return Array.from({ length: count }, () => 1 + Math.floor(rand() * 6));
}

// Re-rolls only the dice at the given indices, keeping the rest held.
export function rerollHeld(dice, holdIndices, rand = Math.random) {
  return dice.map((v, i) => (holdIndices.includes(i) ? v : 1 + Math.floor(rand() * 6)));
}

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0]; // index 1..6 used
  for (const d of dice) c[d]++;
  return c;
}

function sumAll(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

function sumOf(dice, face) {
  return dice.filter((d) => d === face).length * face;
}

export function hasStraight(dice, run) {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === unique[i - 1] + 1) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best >= run;
}

export function scoreCategory(category, dice) {
  const c = counts(dice);
  switch (category) {
    case "ones": return sumOf(dice, 1);
    case "twos": return sumOf(dice, 2);
    case "threes": return sumOf(dice, 3);
    case "fours": return sumOf(dice, 4);
    case "fives": return sumOf(dice, 5);
    case "sixes": return sumOf(dice, 6);
    case "threeKind": return c.some((n) => n >= 3) ? sumAll(dice) : 0;
    case "fourKind": return c.some((n) => n >= 4) ? sumAll(dice) : 0;
    case "fullHouse": {
      const vals = c.filter((n) => n > 0);
      const hasThree = vals.includes(3);
      const hasTwo = vals.includes(2);
      return hasThree && hasTwo ? 25 : 0;
    }
    case "smallStraight": return hasStraight(dice, 4) ? 30 : 0;
    case "largeStraight": return hasStraight(dice, 5) ? 40 : 0;
    case "yahtzee": return c.some((n) => n === 5) ? 50 : 0;
    case "chance": return sumAll(dice);
    default: throw new Error(`Unknown category: ${category}`);
  }
}

// Given a scorecard object { category: score|null, ... }, computes the
// upper section subtotal, the +35 bonus (>=63 pts across ones..sixes),
// and the grand total.
export function computeTotals(scorecard) {
  const upperCats = ["ones", "twos", "threes", "fours", "fives", "sixes"];
  const upperSum = upperCats.reduce((sum, cat) => sum + (scorecard[cat] ?? 0), 0);
  const bonus = upperSum >= 63 ? 35 : 0;
  const lowerCats = CATEGORIES.filter((c) => !upperCats.includes(c));
  const lowerSum = lowerCats.reduce((sum, cat) => sum + (scorecard[cat] ?? 0), 0);
  return {
    upperSum,
    bonus,
    lowerSum,
    grandTotal: upperSum + bonus + lowerSum
  };
}

export function isScorecardComplete(scorecard) {
  return CATEGORIES.every((cat) => scorecard[cat] !== null && scorecard[cat] !== undefined);
}
