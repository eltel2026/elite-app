// =====================================================================
// Rock Paper Scissors — pure game logic (no DOM).
// =====================================================================

export const CHOICES = ["rock", "paper", "scissors"];
export const EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };

const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

// Returns "p1", "p2", or "draw".
export function resolveRound(p1Choice, p2Choice) {
  if (!CHOICES.includes(p1Choice) || !CHOICES.includes(p2Choice)) {
    throw new Error("Invalid choice");
  }
  if (p1Choice === p2Choice) return "draw";
  return BEATS[p1Choice] === p2Choice ? "p1" : "p2";
}

export function randomChoice(rand = Math.random) {
  return CHOICES[Math.floor(rand() * CHOICES.length)];
}

// Best-of-N match helper: given an array of round results ("p1"/"p2"/"draw"),
// determines whether the match is decided and who the overall winner is.
export function matchStatus(roundResults, bestOf = 3) {
  const needed = Math.ceil(bestOf / 2);
  const p1Wins = roundResults.filter((r) => r === "p1").length;
  const p2Wins = roundResults.filter((r) => r === "p2").length;
  if (p1Wins >= needed) return { decided: true, winner: "p1", p1Wins, p2Wins };
  if (p2Wins >= needed) return { decided: true, winner: "p2", p1Wins, p2Wins };
  return { decided: false, winner: null, p1Wins, p2Wins };
}
