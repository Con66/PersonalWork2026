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
  apiKey: "AIzaSyDvG3hRahhWJnYZLNriVQJ0vRMmJHXAzVI",
  authDomain: "connections-674d7.firebaseapp.com",
  projectId: "connections-674d7",
  storageBucket: "connections-674d7.firebasestorage.app",
  messagingSenderId: "321589595159",
  appId: "1:321589595159:web:e5ddc008a917cb6a58e052"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
