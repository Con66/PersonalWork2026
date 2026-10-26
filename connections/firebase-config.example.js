// ============================================================
// Firebase initialization.
//
// Replace the firebaseConfig object below with YOUR project's config.
// Find it in the Firebase console:
//   Project settings (gear icon) -> General tab -> "Your apps" ->
//   Web app -> SDK setup and configuration -> "Config"
//
// This config (apiKey, projectId, etc.) is NOT a secret - it's meant
// to be public in client-side code. Your actual security comes from
// Firestore Security Rules (see README.md), not from hiding this file.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
