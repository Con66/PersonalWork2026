// ============================================================
// Creator page logic.
//
// Responsibilities:
//   1. Read the 4 categories x 4 words out of the form.
//   2. Save them to Firestore as one new "puzzle" document.
//   3. Show a list of previously published puzzles below the form.
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DIFFICULTIES = ["yellow", "green", "blue", "purple"];

const form = document.getElementById("puzzle-form");
const statusEl = document.getElementById("save-status");
const listEl = document.getElementById("puzzle-list-items");

// --- Build a puzzle object out of the form's current values ---
function readPuzzleFromForm() {
  const groups = DIFFICULTIES.map((difficulty, groupIndex) => {
    const categoryInput = form.querySelector(
      `[data-group="${groupIndex}"][data-field="category"]`
    );
    const wordInputs = [0, 1, 2, 3].map((wordIndex) =>
      form.querySelector(`[data-group="${groupIndex}"][data-word="${wordIndex}"]`)
    );

    return {
      difficulty,
      category: categoryInput.value.trim(),
      words: wordInputs.map((input) => input.value.trim().toUpperCase())
    };
  });

  const puzzleDifficulty = Number(document.getElementById("puzzle-difficulty").value);

  return { groups, puzzleDifficulty };
}

// --- Basic validation: no empty fields, no duplicate words ---
function validatePuzzle(puzzle) {
  const allWords = [];

  for (const group of puzzle.groups) {
    if (!group.category) return "Every category needs a name.";
    for (const word of group.words) {
      if (!word) return "Every word field needs to be filled in.";
      allWords.push(word);
    }
  }

  const uniqueWords = new Set(allWords);
  if (uniqueWords.size !== allWords.length) {
    return "All 16 words/phrases must be unique.";
  }

  return null; // no error
}

// --- Handle form submission ---
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the browser's default page-reload behavior

  const puzzle = readPuzzleFromForm();
  const validationError = validatePuzzle(puzzle);

  if (validationError) {
    statusEl.textContent = validationError;
    statusEl.className = "save-status error";
    return;
  }

  statusEl.textContent = "Saving...";
  statusEl.className = "save-status";

  try {
    // addDoc() creates a new document with an auto-generated ID
    // inside the "puzzles" collection.
    await addDoc(collection(db, "puzzles"), {
      groups: puzzle.groups,
      puzzleDifficulty: puzzle.puzzleDifficulty,
      createdAt: serverTimestamp()
    });

    statusEl.textContent = "Puzzle published! Players will now see this one.";
    statusEl.className = "save-status success";
    form.reset();
    loadPuzzleList();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Something went wrong saving to Firebase: " + err.message;
    statusEl.className = "save-status error";
  }
});

// --- Show the most recent puzzles so you can see what's live ---
async function loadPuzzleList() {
  listEl.innerHTML = "<li>Loading...</li>";

  try {
    const q = query(collection(db, "puzzles"), orderBy("createdAt", "desc"), limit(10));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listEl.innerHTML = "<li>No puzzles published yet.</li>";
      return;
    }

    listEl.innerHTML = "";
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : "just now";
      const categories = data.groups.map((g) => g.category).join(" / ");
      const difficultyLabel = data.puzzleDifficulty ? ` [${data.puzzleDifficulty}/5]` : "";

      const li = document.createElement("li");
      li.innerHTML = `<span>${index === 0 ? "&#9733; (live) " : ""}${categories}${difficultyLabel}</span><span>${date}</span>`;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<li>Couldn't load puzzle list: ${err.message}</li>`;
  }
}

loadPuzzleList();
