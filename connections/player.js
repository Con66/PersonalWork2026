// ============================================================
// Player page logic.
//
// Responsibilities:
//   1. Load the most recently published puzzle from Firestore.
//   2. Shuffle its 16 words and render them as clickable tiles.
//   3. Let the player select up to 4 tiles and submit a guess.
//   4. Give feedback: correct group solved, wrong guess, or "one away".
//   5. Track mistakes (4 allowed, like the original game) and detect
//      win/lose.
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const MAX_MISTAKES = 4;

// ---- Game state lives in these variables ----
let groups = [];          // [{ category, difficulty, words: [...] }, ...] as loaded from Firestore
let tiles = [];           // [{ word, groupIndex }, ...] - current on-screen order, unsolved tiles only
let selected = [];        // words currently selected, in click order
let solvedGroupIndices = [];
let mistakesRemaining = MAX_MISTAKES;
let guessHistory = [];    // arrays of words already guessed together, to block exact repeats
let gameOver = false;
let puzzleDifficulty = null; // 1-5, set by the creator, revealed at game end

// ---- DOM references ----
const statusLine = document.getElementById("status-line");
const difficultyBadgeEl = document.getElementById("difficulty-badge");
const solvedGroupsEl = document.getElementById("solved-groups");
const tileGrid = document.getElementById("tile-grid");
const mistakeDotsEl = document.getElementById("mistake-dots");
const shuffleBtn = document.getElementById("shuffle-btn");
const deselectBtn = document.getElementById("deselect-btn");
const submitBtn = document.getElementById("submit-btn");

// --- Fisher-Yates shuffle: standard, unbiased way to shuffle an array ---
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Load the newest puzzle from Firestore ---
async function loadPuzzle() {
  statusLine.textContent = "Loading puzzle...";

  try {
    const q = query(collection(db, "puzzles"), orderBy("createdAt", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      statusLine.textContent = "No puzzle has been published yet. Use the Creator tool first.";
      statusLine.className = "status-line error";
      return;
    }

    const data = snapshot.docs[0].data();
    groups = data.groups;
    puzzleDifficulty = data.puzzleDifficulty || null;

    const allTiles = groups.flatMap((group, groupIndex) =>
      group.words.map((word) => ({ word, groupIndex }))
    );
    tiles = shuffle(allTiles);

    statusLine.textContent = "";
    renderAll();
  } catch (err) {
    console.error(err);
    statusLine.textContent = "Couldn't load the puzzle: " + err.message;
    statusLine.className = "status-line error";
  }
}

// --- Render everything that can change: tiles, solved groups, mistake dots, buttons ---
function renderAll() {
  renderSolvedGroups();
  renderTiles();
  renderMistakeDots();
  renderSubmitButton();
}

function renderSolvedGroups() {
  solvedGroupsEl.innerHTML = "";
  solvedGroupIndices.forEach((groupIndex) => {
    const group = groups[groupIndex];
    const div = document.createElement("div");
    div.className = `solved-group ${group.difficulty}`;
    div.innerHTML = `
      <span class="cat-name">${group.category}</span>
      <span class="cat-words">${group.words.join(", ")}</span>
    `;
    solvedGroupsEl.appendChild(div);
  });
}

function renderTiles() {
  tileGrid.innerHTML = "";
  tiles.forEach((tile) => {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.textContent = tile.word;
    btn.disabled = gameOver;
    if (selected.includes(tile.word)) {
      btn.classList.add("selected");
    }
    btn.addEventListener("click", () => toggleSelect(tile.word));
    tileGrid.appendChild(btn);
  });
}

function renderMistakeDots() {
  mistakeDotsEl.innerHTML = "";
  for (let i = 0; i < MAX_MISTAKES; i++) {
    const dot = document.createElement("div");
    dot.className = "mistake-dot" + (i < MAX_MISTAKES - mistakesRemaining ? " used" : "");
    mistakeDotsEl.appendChild(dot);
  }
}

function renderSubmitButton() {
  submitBtn.disabled = selected.length !== 4 || gameOver;
}

// --- Selecting / deselecting tiles ---
function toggleSelect(word) {
  if (gameOver) return;

  if (selected.includes(word)) {
    selected = selected.filter((w) => w !== word);
  } else {
    if (selected.length >= 4) return; // already 4 selected, ignore further clicks
    selected.push(word);
  }
  renderTiles();
  renderSubmitButton();
}

// --- Core guess-checking logic ---
function submitGuess() {
  if (selected.length !== 4 || gameOver) return;

  const sortedGuess = [...selected].sort().join("|");
  const alreadyTried = guessHistory.some((g) => g === sortedGuess);
  if (alreadyTried) {
    setStatus("You already tried that combination.", true);
    return;
  }
  guessHistory.push(sortedGuess);

  // Which group does each selected word actually belong to?
  const groupIndexesOfSelected = selected.map((word) => {
    const tile = tiles.find((t) => t.word === word);
    return tile.groupIndex;
  });

  const allSameGroup = groupIndexesOfSelected.every(
    (gi) => gi === groupIndexesOfSelected[0]
  );

  if (allSameGroup) {
    handleCorrectGuess(groupIndexesOfSelected[0]);
  } else {
    handleWrongGuess(groupIndexesOfSelected);
  }
}

function handleCorrectGuess(groupIndex) {
  solvedGroupIndices.push(groupIndex);
  tiles = tiles.filter((t) => t.groupIndex !== groupIndex);
  selected = [];

  if (solvedGroupIndices.length === groups.length) {
    endGame(true);
    return;
  }

  setStatus("Nice - that's a group!", false);
  renderAll();
}

function handleWrongGuess(groupIndexesOfSelected) {
  mistakesRemaining -= 1;

  // "One away" hint: if 3 of the 4 selected words share a group.
  const counts = {};
  groupIndexesOfSelected.forEach((gi) => (counts[gi] = (counts[gi] || 0) + 1));
  const oneAway = Object.values(counts).some((count) => count === 3);

  setStatus(oneAway ? "One away..." : "Not quite - try again.", true);

  // Trigger the shake animation
  tileGrid.classList.remove("shake");
  void tileGrid.offsetWidth; // force reflow so the animation can replay
  tileGrid.classList.add("shake");

  selected = [];
  renderAll();

  if (mistakesRemaining <= 0) {
    endGame(false);
  }
}

function endGame(won) {
  gameOver = true;

  if (!won) {
    // Reveal every remaining (unsolved) group.
    const remainingIndexes = groups
      .map((_, i) => i)
      .filter((i) => !solvedGroupIndices.includes(i));
    solvedGroupIndices.push(...remainingIndexes);
    tiles = [];
  }

  setStatus(
    won
      ? `You solved it with ${MAX_MISTAKES - mistakesRemaining} mistake(s)!`
      : "Out of guesses - here are today's groups.",
    !won
  );
  revealDifficulty();
  renderAll();
}

function revealDifficulty() {
  if (!puzzleDifficulty) return; // older puzzles saved before this feature won't have it

  const filledStars = "\u2605".repeat(puzzleDifficulty);
  const emptyStars = "\u2606".repeat(5 - puzzleDifficulty);

  difficultyBadgeEl.textContent = `Difficulty: ${filledStars}${emptyStars} (${puzzleDifficulty}/5)`;
  difficultyBadgeEl.className = `difficulty-badge level-${puzzleDifficulty}`;
  difficultyBadgeEl.hidden = false;
}

function setStatus(message, isError) {
  statusLine.textContent = message;
  statusLine.className = "status-line" + (isError ? " error" : "");
}

// --- Controls ---
shuffleBtn.addEventListener("click", () => {
  tiles = shuffle(tiles);
  renderTiles();
});

deselectBtn.addEventListener("click", () => {
  selected = [];
  renderTiles();
  renderSubmitButton();
});

submitBtn.addEventListener("click", submitGuess);

loadPuzzle();
