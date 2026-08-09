// =====================================================================
// ELITE — Firestore data access layer. Every read/write in the whole
// app goes through here, so the rest of the code never touches
// Firestore APIs directly.
//
// Firestore schema:
//   users/{uid}         profile: eliteId, level, xp, rating, points, ...
//   usernames/{idLower} { uid }  — reserves ELITE IDs so they're unique
//   challenges/{id}     a 1v1 challenge (live or async), see below
// =====================================================================
import {
  db, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query,
  where, orderBy, limit, serverTimestamp, runTransaction, isFirebaseConfigured
} from "./firebase-init.js";
import { addXp, resolveChallenge, resolveSoloPlay, rankForLevel, xpRequiredForLevel } from "./progression.js";
import * as local from "./local-store.js";

export { isFirebaseConfigured };

const STARTER_PROFILE = {
  level: 1,
  xp: 0,
  xpToNext: xpRequiredForLevel(1),
  rank: "Rookie",
  rating: 1200,
  points: 1000, // everyone starts with a pot of virtual ELITE Points
  winStreak: 0,
  cube: { body: "standard", color: "#f5f5f5", effect: "none" }
};

export function eliteIdLower(id) {
  return id.trim().toLowerCase();
}

function requireFirebase(featureName) {
  if (!isFirebaseConfigured) {
    throw new Error(
      `${featureName} needs your free Firebase project connected first. ` +
      `See SETUP-GUIDE.md — you're currently playing in Local Demo Mode.`
    );
  }
}

// Reserves an ELITE ID and creates the profile document atomically, so
// two people can never grab the same ID in a race.
export async function createProfile({ uid, email, eliteId, avatar }) {
  if (!isFirebaseConfigured) return local.createLocalProfile({ eliteId, avatar });
  const idLower = eliteIdLower(eliteId);
  const usernameRef = doc(db, "usernames", idLower);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists()) {
      throw new Error("ELITE ID already taken. Try another one.");
    }
    tx.set(usernameRef, { uid });
    tx.set(userRef, {
      ...STARTER_PROFILE,
      eliteId,
      eliteIdLower: idLower,
      avatar,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() };
}

export async function getProfile(uid) {
  if (!isFirebaseConfigured) return local.getLocalProfile();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function subscribeProfile(uid, callback) {
  if (!isFirebaseConfigured) return local.subscribeLocalProfile(callback);
  return onSnapshot(doc(db, "users", uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  });
}

export async function findUidByEliteId(eliteId) {
  const snap = await getDoc(doc(db, "usernames", eliteIdLower(eliteId)));
  return snap.exists() ? snap.data().uid : null;
}

// --- Progression writes ---

export async function applySoloResult(uid, currentProfile, didWin) {
  const progressed = resolveSoloPlay(currentProfile, didWin);
  if (!isFirebaseConfigured) return local.updateLocalProfile(progressed);
  await updateDoc(doc(db, "users", uid), {
    level: progressed.level,
    xp: progressed.xp,
    xpToNext: progressed.xpToNext,
    rank: progressed.rank,
    updatedAt: serverTimestamp()
  });
  return progressed;
}

export async function saveCubeCustomisation(uid, cube) {
  if (!isFirebaseConfigured) return local.updateLocalProfile({ cube });
  await updateDoc(doc(db, "users", uid), { cube, updatedAt: serverTimestamp() });
}

// Deducts ELITE Points for a paid perk (e.g. a bonus dice roll). Throws
// if the profile doesn't have enough points so callers can show a toast
// instead of ever letting a balance go negative.
export async function spendPoints(uid, currentProfile, amount) {
  const currentPoints = currentProfile.points ?? 0;
  if (currentPoints < amount) {
    throw new Error(`Not enough ELITE Points — you need ${amount}, you have ${currentPoints}.`);
  }
  const newPoints = currentPoints - amount;
  if (!isFirebaseConfigured) return local.updateLocalProfile({ points: newPoints });
  await updateDoc(doc(db, "users", uid), { points: newPoints, updatedAt: serverTimestamp() });
  return newPoints;
}

// --- Challenges ---
// A challenge document:
// {
//   game: 'rps' | 'connect4' | 'dice' | 'cube',
//   mode: 'live' | 'async',
//   fromUid, fromEliteId, toUid, toEliteId,
//   wager, status: 'pending' | 'declined' | 'active' | 'completed',
//   state: { ...game-specific... },
//   result: { winnerUid, loserUid } | null,
//   createdAt, updatedAt
// }

export async function createChallenge({ fromProfile, toEliteId, game, mode, wager }) {
  requireFirebase("Challenging another player");
  const toUid = await findUidByEliteId(toEliteId);
  if (!toUid) throw new Error(`No ELITE player found with ID "${toEliteId}".`);
  if (toUid === fromProfile.uid) throw new Error("You can't challenge yourself!");

  const ref = doc(collection(db, "challenges"));
  const initialState = mode === "async" ? { seed: Math.floor(Math.random() * 2 ** 31), results: {} } : {};

  await setDoc(ref, {
    game,
    mode,
    fromUid: fromProfile.uid,
    fromEliteId: fromProfile.eliteId,
    toUid,
    toEliteId,
    wager,
    status: "pending",
    state: initialState,
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function respondToChallenge(challengeId, accept) {
  await updateDoc(doc(db, "challenges", challengeId), {
    status: accept ? "active" : "declined",
    updatedAt: serverTimestamp()
  });
}

// Subscribe helpers below no-op gracefully (empty results, no crash) in
// Local Demo Mode, since challenges inherently need a real backend to
// connect two different people.
export function subscribeIncomingChallenges(uid, callback) {
  if (!isFirebaseConfigured) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, "challenges"),
    where("toUid", "==", uid),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeMyActiveChallenges(uid, callback) {
  if (!isFirebaseConfigured) {
    callback([]);
    return () => {};
  }
  const qFrom = query(
    collection(db, "challenges"),
    where("fromUid", "==", uid),
    where("status", "==", "active")
  );
  const qTo = query(
    collection(db, "challenges"),
    where("toUid", "==", uid),
    where("status", "==", "active")
  );
  let latestFrom = [];
  let latestTo = [];
  const emit = () => callback([...latestFrom, ...latestTo]);
  const unsub1 = onSnapshot(qFrom, (snap) => {
    latestFrom = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  const unsub2 = onSnapshot(qTo, (snap) => {
    latestTo = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeChallenge(challengeId, callback) {
  return onSnapshot(doc(db, "challenges", challengeId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function updateChallengeState(challengeId, statePatch) {
  await updateDoc(doc(db, "challenges", challengeId), {
    state: statePatch,
    updatedAt: serverTimestamp()
  });
}

// Race-safe read-modify-write for a challenge document. `updateFn`
// receives the CURRENT challenge data and returns either a patch object
// to merge in, or null/undefined to make no change (e.g. because by the
// time the transaction ran, another client had already applied this
// exact update — important for live 1v1 games where both players'
// clients might notice "both moves are in" at the same moment).
export async function transactionalUpdateChallenge(challengeId, updateFn) {
  const ref = doc(db, "challenges", challengeId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = { id: snap.id, ...snap.data() };
    const patch = updateFn(data);
    if (!patch) return;
    tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
  });
}

// Finalises a challenge: reads both live profiles inside a transaction,
// runs the shared prog
