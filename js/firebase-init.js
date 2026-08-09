// =====================================================================
// ELITE — Firebase initialisation
// Uses the Firebase v10 modular SDK, loaded straight from Google's CDN
// so there is no build step — this all runs as plain ES module JS in
// the browser (and works fine on GitHub Pages / any static host).
//
// IMPORTANT: the SDK is only fetched from the CDN when Firebase has
// actually been configured (see firebase-config.js). Until then, ELITE
// runs entirely in Local Demo Mode with zero network dependency on
// Firebase — you can play offline before ever touching a Firebase
// project.
// =====================================================================
import { firebaseConfig } from "./firebase-config.js";

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY"
);

export let app, auth, db;
export let createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged;
export let doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy, limit, serverTimestamp, runTransaction, increment;

if (isFirebaseConfigured) {
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
  ]);

  app = initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);

  ({ createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } = authMod);
  ({ doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy, limit, serverTimestamp, runTransaction, increment } = fsMod);
}
