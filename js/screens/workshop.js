// =====================================================================
// ELITE — Cube Workshop screen: customise your Cube's body/colour/effect.
// =====================================================================
import { solvedState, FACE_COLORS } from "../games/cube-logic.js";
import { applyCubeSkin, CUBE_BODIES, CUBE_COLORS, CUBE_EFFECTS } from "../games/cube-skin.js";
import { toast, enableDragRotate } from "../ui-helpers.js";
import * as store from "../store.js";

let current = { body: "standard", color: "#f2c14e", effect: "none" };
let myUid = null;

function paintPreview() {
  const state = solvedState();
  const faces = ["U", "D", "F", "B", "L", "R"];
  faces.forEach((face, fi) => {
    const faceEl = document.querySelector(`#workshop-preview .rubik-face.${face}`);
    if (!faceEl) return;
    faceEl.innerHTML = "";
    for (let k = 0; k < 9; k++) {
      const sticker = document.createElement("div");
      sticker.className = "sticker";
      sticker.style.background = FACE_COLORS[state[fi * 9 + k]];
      faceEl.appendChild(sticker);
    }
  });
  const rubikEl = document.getElementById("workshop-preview");
  if (rubikEl) applyCubeSkin(rubikEl, current);
}

function renderPickers() {
  document.getElementById("workshop-body").innerHTML = CUBE_BODIES.map(
    (b) => `<div class="chip ${current.body === b.id ? "selected" : ""}" data-body="${b.id}">${b.label}</div>`
  ).join("");
  document.getElementById("workshop-color").innerHTML = CUBE_COLORS.map(
    (c) => `<div class="swatch ${current.color === c ? "selected" : ""}" data-color="${c}" style="background:${c};"></div>`
  ).join("");
  document.getElementById("workshop-effect").innerHTML = CUBE_EFFECTS.map(
    (fx) => `<div class="chip ${current.effect === fx.id ? "selected" : ""}" data-effect="${fx.id}">${fx.label}</div>`
  ).join("");

  document.querySelectorAll("[data-body]").forEach((chip) =>
    chip.addEventListener("click", () => {
      current.body = chip.dataset.body;
      renderPickers();
      paintPreview();
    })
  );
  document.querySelectorAll("[data-color]").forEach((sw) =>
    sw.addEventListener("click", () => {
      current.color = sw.dataset.color;
      renderPickers();
      paintPreview();
    })
  );
  document.querySelectorAll("[data-effect]").forEach((chip) =>
    chip.addEventListener("click", () => {
      current.effect = chip.dataset.effect;
      renderPickers();
      paintPreview();
    })
  );
}

export function initWorkshopScreen() {
  enableDragRotate(document.getElementById("workshop-preview"));
  document.getElementById("btn-save-cube").addEventListener("click", async () => {
    try {
      await store.saveCubeCustomisation(myUid, current);
      toast("🧩 Cube design saved!");
    } catch (err) {
      toast(err.message ?? "Couldn't save your design.");
    }
  });
}

export function loadWorkshopForProfile(profile) {
  myUid = profile.uid;
  current = { ...(profile.cube ?? { body: "standard", color: "#f2c14e", effect: "none" }) };
  renderPickers();
  paintPreview();
}
