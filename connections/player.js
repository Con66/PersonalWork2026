// ============================================================
// Player page logic.
//
// Responsibilities:
//   1. Require sign-in (Google), and a chosen username, before playing.
//   2. Load the most recently published puzzle from Firestore.
//   3. If this user already has a saved result for that puzzle, show
//      the solved board + their past result instead of letting them
//      replay it.
//   4. Otherwise: shuffle the 16 words, let the player guess groups of
//      4, track mistakes (4 allowed), detect win/lose.
//   5. Save the result to Firestore, and show a leaderboard of every
//      player's stats.
// ============================================================

import { db } from "./firebase-config.js";
import {
  watchAuthState,
  signIn,
  signOutUser,
  getUserProfile,
  claimUsername
} from "./auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const MAX_MISTAKES = 4;

// ---- Game state ----
let groups = [];          // [{ category, difficulty, words: [...] }, ...] as loaded from Firestore
let tiles = [];           // [{ word, groupIndex }, ...] - current on-screen order, unsolved tiles only
let selected = [];        // words currently selected, in click order
let solvedGroupIndices = [];
let mistakesRemaining = MAX_MISTAKES;
let guessHistory = [];    // arrays of words already guessed together, to block exact repeats
let gameOver = false;
let puzzleDifficulty = null; // 1-5, set by the creator, revealed at game end

// ---- Auth / profile state ----
let currentUser = null;
let currentPuzzleId = null;
let resultAlreadySaved = false; // true once we've written (or found an existing) result for this puzzle

// ---- DOM references ----
const statusLine = document.getElementById("status-line");
const difficultyBadgeEl = document.getElementById("difficulty-badge");
const solvedGroupsEl = document.getElementById("solved-groups");
const tileGrid = document.getElementById("tile-grid");
const mistakeDotsEl = document.getElementById("mistake-dots");
const shuffleBtn = document.getElementById("shuffle-btn");
const deselectBtn = document.getElementById("deselect-btn");
const submitBtn = document.getElementById("submit-btn");

const authStatusEl = document.getElementById("auth-status");
const authUsernameEl = document.getElementById("auth-username");
const signOutBtn = document.getElementById("sign-out-btn");

const signinOverlay = document.getElementById("signin-overlay");
const signinBtn = document.getElementById("signin-btn");
const signinError = document.getElementById("signin-error");
const rememberCheckbox = document.getElementById("remember-me");

const usernameOverlay = document.getElementById("username-overlay");
const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");
const usernameError = document.getElementById("username-error");

const leaderboardBody = document.getElementById("leaderboard-body");

// ---- Fisher-Yates shuffle: standard, unbiased way to shuffle an array ----
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A tiny helper to safely drop a username into innerHTML - usernames
// are user-chosen text, so we escape them before inserting as HTML.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Auth flow
// ============================================================

watchAuthState(async (user) => {
  currentUser = user;

  if (!user) {
    authStatusEl.hidden = true;
    signinOverlay.hidden = false;
    usernameOverlay.hidden = true;
    return;
  }

  signinOverlay.hidden = true;

  const profile = await getUserProfile(user.uid);
  if (!profile) {
    usernameOverlay.hidden = false;
    return;
  }
  usernameOverlay.hidden = true;

  authStatusEl.hidden = false;
  authUsernameEl.textContent = profile.username;

  await startGameFlow();
});

signinBtn.addEventListener("click", async () => {
  signinError.textContent = "";
  try {
    await signIn(rememberCheckbox.checked);
  } catch (err) {
    console.error(err);
    signinError.textContent = "Sign-in failed: " + err.message;
  }
});

signOutBtn.addEventListener("click", () => signOutUser());

usernameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  usernameError.textContent = "";

  if (!currentUser) {
    usernameError.textContent = "You're not signed in yet - please refresh the page and sign in again.";
    return;
  }

  const result = await claimUsername(currentUser.uid, usernameInput.value);
  if (!result.ok) {
    if (result.reason === "taken") {
      usernameError.textContent = "That username is already taken - try another.";
    } else if (result.reason === "rules") {
      usernameError.textContent =
        "Couldn't save (permission denied) - double check your Firestore security rules match the README.";
    } else {
      usernameError.textContent = "Usernames must be 2-20 characters.";
    }
    return;
  }

  const profile = await getUserProfile(currentUser.uid);
  usernameOverlay.hidden = true;
  authStatusEl.hidden = false;
  authUsernameEl.textContent = profile.username;

  await startGameFlow();
});

// ============================================================
// Game flow
// ============================================================

// Fetches the newest puzzle. Returns true if a puzzle was found.
async function loadPuzzle() {
  const q = query(collection(db, "puzzles"), orderBy("createdAt", "desc"), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return false;
  }

  currentPuzzleId = snapshot.docs[0].id;
  const data = snapshot.docs[0].data();
  groups = data.groups;
  puzzleDifficulty = data.puzzleDifficulty || null;

  const allTiles = groups.flatMap((group, groupIndex) =>
    group.words.map((word) => ({ word, groupIndex }))
  );
  tiles = shuffle(allTiles);

  return true;
}

async function startGameFlow() {
  statusLine.textContent = "Loading puzzle...";
  statusLine.className = "status-line";

  try {
    const found = await loadPuzzle();
    if (!found) {
      statusLine.textContent = "No puzzle has been published yet. Check back soon!";
      statusLine.className = "status-line error";
      loadLeaderboard(null);
      return;
    }

    // Has this user already played this exact puzzle? If so, show them
    // the completed board instead of letting them replay for a better score.
    const resultRef = doc(db, "results", `${currentUser.uid}_${currentPuzzleId}`);
    const existingResult = await getDoc(resultRef);

    if (existingResult.exists()) {
      applyExistingResult(existingResult.data());
    } else {
      statusLine.textContent = "";
      renderAll();
    }

    loadLeaderboard(currentPuzzleId);
  } catch (err) {
    console.error(err);
    statusLine.textContent = "Couldn't load the puzzle: " + err.message;
    statusLine.className = "status-line error";
  }
}

function applyExistingResult(result) {
  mistakesRemaining = MAX_MISTAKES - result.mistakesUsed;
  solvedGroupIndices = groups.map((_, i) => i); // reveal every group
  tiles = [];
  gameOver = true;
  resultAlreadySaved = true;

  setStatus(
    result.solved
      ? `You already played this puzzle - solved with ${result.mistakesUsed} mistake(s).`
      : "You already played this puzzle - you didn't solve it that time.",
    !result.solved
  );
  revealDifficulty();
  renderAll();
}

// ---- Render everything that can change: tiles, solved groups, mistake dots, buttons ----
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

// ---- Selecting / deselecting tiles ----
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

// ---- Core guess-checking logic ----
function submitGuess() {
  if (selected.length !== 4 || gameOver) return;

  const sortedGuess = [...selected].sort().join("|");
  const alreadyTried = guessHistory.some((g) => g === sortedGuess);
  if (alreadyTried) {
    setStatus("You already tried that combination.", true);
    return;
  }
  guessHistory.push(sortedGuess);

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

  const counts = {};
  groupIndexesOfSelected.forEach((gi) => (counts[gi] = (counts[gi] || 0) + 1));
  const oneAway = Object.values(counts).some((count) => count === 3);

  setStatus(oneAway ? "One away..." : "Not quite - try again.", true);

  // Trigger the shake animation, then clean up the class once it's done -
  // otherwise it lingers on the grid and replays every time tiles re-render
  // (e.g. on the player's next click), since renderTiles() rebuilds the
  // tile buttons from scratch.
  tileGrid.classList.remove("shake");
  void tileGrid.offsetWidth; // force reflow so the animation can replay
  tileGrid.classList.add("shake");
  setTimeout(() => tileGrid.classList.remove("shake"), 400); // matches the 0.4s CSS animation duration

  selected = [];
  renderAll();

  if (mistakesRemaining <= 0) {
    endGame(false);
  }
}

function endGame(won) {
  gameOver = true;

  if (!won) {
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
  recordResult(won);
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

// ---- Save this game's outcome, then refresh the leaderboard ----
async function recordResult(won) {
  if (resultAlreadySaved) return; // e.g. this was a replay of an already-played puzzle
  resultAlreadySaved = true;

  const mistakesUsed = MAX_MISTAKES - mistakesRemaining;

  try {
    await setDoc(doc(db, "results", `${currentUser.uid}_${currentPuzzleId}`), {
      uid: currentUser.uid,
      puzzleId: currentPuzzleId,
      solved: won,
      mistakesUsed,
      playedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Couldn't save your result:", err);
  }

  loadLeaderboard(currentPuzzleId);
}

// ============================================================
// Leaderboard
// ============================================================

async function loadLeaderboard(latestPuzzleId) {
  leaderboardBody.textContent = "Loading...";

  try {
    const [usersSnap, resultsSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "results"))
    ]);

    const usernamesByUid = {};
    usersSnap.forEach((d) => {
      usernamesByUid[d.id] = d.data().username;
    });

    const statsByUid = {};
    resultsSnap.forEach((d) => {
      const r = d.data();
      if (!statsByUid[r.uid]) {
        statsByUid[r.uid] = {
          0: 0, 1: 0, 2: 0, 3: 0,
          latestAttempted: false,
          latestMistakes: null,
          latestSolved: null
        };
      }
      const stats = statsByUid[r.uid];

      if (r.solved && r.mistakesUsed >= 0 && r.mistakesUsed <= 3) {
        stats[r.mistakesUsed] += 1;
      }

      if (latestPuzzleId && r.puzzleId === latestPuzzleId) {
        stats.latestAttempted = true;
        stats.latestMistakes = r.mistakesUsed;
        stats.latestSolved = r.solved;
      }
    });

    const rows = Object.keys(usernamesByUid).map((uid) => {
      const stats = statsByUid[uid] || {
        0: 0, 1: 0, 2: 0, 3: 0,
        latestAttempted: false,
        latestMistakes: null,
        latestSolved: null
      };
      return { uid, username: usernamesByUid[uid], ...stats };
    });

    rows.sort((a, b) => {
      const totalA = a[0] + a[1] + a[2] + a[3];
      const totalB = b[0] + b[1] + b[2] + b[3];
      return totalB - totalA;
    });

    renderLeaderboard(rows);
  } catch (err) {
    console.error(err);
    leaderboardBody.textContent = "Couldn't load leaderboard: " + err.message;
  }
}

function renderLeaderboard(rows) {
  if (rows.length === 0) {
    leaderboardBody.innerHTML = "<p>No players yet.</p>";
    return;
  }

  const tableRows = rows
    .map((r) => {
      const latestCell = !r.latestAttempted
        ? "-"
        : r.latestSolved
        ? `${r.latestMistakes} mistake(s)`
        : "Did not solve";

      return `
        <tr>
          <td>${escapeHtml(r.username)}</td>
          <td>${r[0]}</td>
          <td>${r[1]}</td>
          <td>${r[2]}</td>
          <td>${r[3]}</td>
          <td>${latestCell}</td>
        </tr>
      `;
    })
    .join("");

  leaderboardBody.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>0</th>
          <th>1</th>
          <th>2</th>
          <th>3</th>
          <th>Latest</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

// ============================================================
// Controls
// ============================================================

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
