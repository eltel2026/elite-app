// =====================================================================
// ELITE — authentication wrapper. Transparently falls back to Local
// Demo Mode (see local-store.js) when Firebase hasn't been configured
// yet, so the app is playable immediately out of the box.
// =====================================================================
import {
  auth, isFirebaseConfigured, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "./firebase-init.js";
import * as store from "./store.js";
import { getLocalProfile, clearLocalProfile } from "./local-store.js";

export { isFirebaseConfigured };

export async function signUp({ eliteId, avatar, email, password }) {
  if (!eliteId || eliteId.trim().length < 3) {
    throw new Error("Your ELITE ID needs to be at least 3 characters.");
  }

  if (!isFirebaseConfigured) {
    await store.createProfile({ eliteId: eliteId.trim(), avatar });
    return { uid: "local" };
  }

  if (!email || !password || password.length < 6) {
    throw new Error("Enter an email and a password of at least 6 characters.");
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await store.createProfile({ uid: cred.user.uid, email, eliteId: eliteId.trim(), avatar });
  return cred.user;
}

export async function logIn({ email, password }) {
  if (!isFirebaseConfigured) {
    throw new Error("Logging in needs your free Firebase project connected first — see SETUP-GUIDE.md.");
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  if (!isFirebaseConfigured) {
    // In Local Demo Mode, "logging out" clears your local Guest profile
    // so you can try creating a fresh ELITE ID.
    clearLocalProfile();
    return;
  }
  await signOut(auth);
}

// Fires `callback(user)` whenever auth state changes. In Local Demo
// Mode there's no real auth session — we just check whether a local
// profile already exists and treat that as "logged in".
export function watchAuthState(callback) {
  if (!isFirebaseConfigured) {
    const profile = getLocalProfile();
    callback(profile ? { uid: "local" } : null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
