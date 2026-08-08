// =====================================================================
// Shared "skin" renderer for the ELITE Cube — turns a saved
// { body, color, effect } customisation into CSS applied to a .rubik
// element, used both in the Cube Workshop preview and in-game.
// =====================================================================

const BODY_FILTERS = {
  standard: "none",
  chrome: "contrast(1.2) saturate(1.35) brightness(1.12)",
  carbon: "brightness(.78) contrast(1.25)",
  gold: "sepia(.35) saturate(1.5) brightness(1.05)",
  obsidian: "brightness(.55) contrast(1.35)"
};

const EFFECT_GLOW = {
  none: null,
  glow: (color) => color,
  electric: () => "#4dd0ff",
  fire: () => "#ff5b1f",
  galaxy: () => "#a259ff"
};

// IMPORTANT: `filter` must NEVER be applied directly to the .rubik
// element itself. CSS flattens any 3D transforms (transform-style:
// preserve-3d) on an element that also has a filter/opacity/mask
// applied to its own box — so putting a filter on .rubik would collapse
// the 6 cube faces into a single flat square instead of a cube. Instead
// we apply the filter to the WRAPPING .cube-viewport element (a plain
// ancestor with no preserve-3d of its own), which keeps .rubik's 3D
// rendering intact while still visually filtering the whole cube.
export function applyCubeSkin(rubikEl, cube = {}) {
  const body = cube.body ?? "standard";
  const effect = cube.effect ?? "none";
  const color = cube.color ?? "#f2c14e";
  const filterTarget = rubikEl.parentElement ?? rubikEl;

  let filterValue = BODY_FILTERS[body] ?? "none";
  if (filterValue === "none") filterValue = "";

  const glowFn = EFFECT_GLOW[effect];
  if (glowFn) {
    const glowColor = glowFn(color);
    filterValue += ` drop-shadow(0 0 16px ${glowColor})`;
    rubikEl.style.animation = effect === "electric" || effect === "fire" ? "spinCube 2.4s linear infinite" : "";
  } else {
    rubikEl.style.animation = "";
  }

  filterTarget.style.filter = filterValue.trim() || "none";
}

export const CUBE_BODIES = [
  { id: "standard", label: "Standard" },
  { id: "chrome", label: "Chrome" },
  { id: "carbon", label: "Carbon" },
  { id: "gold", label: "Gold" },
  { id: "obsidian", label: "Obsidian" }
];

export const CUBE_COLORS = ["#f2c14e", "#3d7dfa", "#e63946", "#2ecc71", "#a259ff", "#ffffff", "#ff8c42"];

export const CUBE_EFFECTS = [
  { id: "none", label: "None" },
  { id: "glow", label: "Glow" },
  { id: "electric", label: "Electric" },
  { id: "fire", label: "Fire" },
  { id: "galaxy", label: "Galaxy" }
];
