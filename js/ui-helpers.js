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

// Generic wiring for every element with data-nav="screenId" so any
// screen can just add the attribute instead of a bespoke listener.
export function wireDataNavButtons() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (btn) showScreen(btn.dataset.nav);
  });
}
