// =====================================================================
// ELITE — small shared DOM helpers used across every screen module.
// =====================================================================

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function showScreen(id) {
  $all(".screen").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);

  $all(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === id);
  });
}

export function toast(message, ms = 3200) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function formatNumber(n) {
  return Number(n ?? 0).toLocaleString("en-GB");
}

export function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// Lets the user drag/swipe (mouse or touch) to spin a 3D cube element
// around to look at its other faces. Works via Pointer Events, which
// cover mouse, touch and pen with one API.
export function enableDragRotate(cubeEl, { initialX = -28, initialY = -35 } = {}) {
  if (!cubeEl || cubeEl.dataset.dragRotateBound) return;
  cubeEl.dataset.dragRotateBound = "1";

  let rotX = initialX;
  let rotY = initialY;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  cubeEl.style.touchAction = "none"; // stop the page from scrolling while spinning the cube
  cubeEl.style.cursor = "grab";

  function apply() {
    cubeEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }
  apply();

  cubeEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    cubeEl.style.cursor = "grabbing";
    cubeEl.style.transition = "none";
    cubeEl.setPointerCapture?.(e.pointerId);
  });

  cubeEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.5;
    rotX = Math.max(-90, Math.min(90, rotX - dy * 0.5));
    apply();
  });

  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    cubeEl.style.cursor = "grab";
    cubeEl.style.transition = "transform .15s ease";
  }
  cubeEl.addEventListener("pointerup", stopDrag);
  cubeEl.addEventListener("pointercancel", stopDrag);
  cubeEl.addEventListener("pointerleave", stopDrag);

  return { reset: () => { rotX = initialX; rotY = initialY; apply(); } };
}

// Generic wiring for every element with data-nav="screenId" so any
// screen can just add the attribute instead of a bespoke listener.
export function wireDataNavButtons() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (btn) showScreen(btn.dataset.nav);
  });
}
