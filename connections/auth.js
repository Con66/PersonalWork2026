// ============================================================
// Shared authentication + user-profile helpers.
//
// Both creator.js and player.js import from this file, so the
// sign-in, "remember me," admin-check, and username logic only
// has to be written once.
// ============================================================

import { auth, googleProvider, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ------------------------------------------------------------
// Change this to your own Google account's email address.
// Only this account will be treated as admin (able to publish
// puzzles). This check is a UI convenience only - the real
// enforcement is in the Firestore security rules (see README.md),
// which check the same email server-side.
// ------------------------------------------------------------
export const ADMIN_EMAIL = "cbabcockoneill@gmail.com";

export function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL;
}

// remember = true  -> stays signed in after the browser is closed (local persistence)
// remember = false -> signed out again once the tab/browser closes (session persistence)
export async function signIn(remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

// callback receives the Firebase User object, or null when signed out.
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// Look up this user's profile doc (username, join date, etc).
// Returns null if they haven't chosen a username yet.
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Attempt to claim a username.
// Returns { ok: true } on success, or { ok: false, reason } on failure,
// where reason is "invalid" (bad length) or "taken".
export async function claimUsername(uid, desiredUsername) {
  const trimmed = (desiredUsername || "").trim();

  if (trimmed.length < 2 || trimmed.length > 20) {
    return { ok: false, reason: "invalid" };
  }

  // Usernames are matched case-insensitively so "Alex" and "alex" can't
  // both be taken - the lowercase version is what we actually reserve.
  const usernameKey = trimmed.toLowerCase();
  const usernameRef = doc(db, "usernames", usernameKey);

  const existing = await getDoc(usernameRef);
  if (existing.exists()) {
    return { ok: false, reason: "taken" };
  }

  // Reserve the name and create the profile in the same atomic batch,
  // so we never end up with one written but not the other.
  try {
    const batch = writeBatch(db);
    batch.set(usernameRef, { uid });
    batch.set(doc(db, "users", uid), {
      username: trimmed,
      usernameLower: usernameKey,
      joinedAt: serverTimestamp()
    });
    await batch.commit();
    return { ok: true };
  } catch (err) {
    console.error("claimUsername failed:", err.code, err.message);

    if (err.code === "permission-denied") {
      // This means Firestore's security rules rejected the write - almost
      // always because the rules for "usernames" or "users" haven't been
      // published yet, NOT because the name is actually taken.
      return { ok: false, reason: "rules" };
    }

    // Most likely explanation for any other failure here: someone else
    // grabbed the same name a moment earlier, and the security rules
    // (which only allow *creating* a username doc, never overwriting
    // one) rejected this write because the doc now already exists.
    return { ok: false, reason: "taken" };
  }
}
