// =====================================================================
// ELITE — Local Demo Mode
// Used ONLY when js/firebase-config.js hasn't been filled in yet, so
// you can open the app and actually play Solo games, level up, and
// customise your Cube immediately — before spending 10 minutes setting
// up a free Firebase project. Progress here lives only in this browser
// (localStorage) and does NOT sync across devices; Challenge and
// Leaderboard features are disabled in this mode since they inherently
// need a real backend to connect two different people.
// =====================================================================
import { xpRequiredForLevel } from "./progression.js";

const KEY = "elite_local_profile_v1";
const listeners = new Set();

function defaultProfile() {
  return {
    uid: "local",
    eliteId: "Guest",
    avatar: "🙂",
    level: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    rank: "Rookie",
    rating: 1200,
    points: 1000,
    winStreak: 0,
    cube: { body: "standard", color: "#f5f5f5", effect: "none" }
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(profile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
  listeners.forEach((cb) => cb(profile));
}

export function createLocalProfile({ eliteId, avatar }) {
  const profile = { ...defaultProfile(), eliteId, avatar };
  write(profile);
  return profile;
}

export function getLocalProfile() {
  return read();
}

export function subscribeLocalProfile(callback) {
  listeners.add(callback);
  callback(read());
  return () => listeners.delete(callback);
}

export function updateLocalProfile(patch) {
  const current = read() ?? defaultProfile();
  const updated = { ...current, ...patch };
  write(updated);
  return updated;
}

export function clearLocalProfile() {
  localStorage.removeItem(KEY);
  listeners.forEach((cb) => cb(null));
}
