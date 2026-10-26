# Connections Game (Firebase + vanilla JS)

A two-sided clone of NYT's Connections, with Google sign-in, admin-gated
puzzle creation, and a leaderboard.

- `creator.html` / `creator.js` - **admin only.** Build a puzzle (4 categories x 4 words, plus a 1-5 difficulty) and publish it to Firestore.
- `index.html` / `player.js` - loads the most recently published puzzle, requires sign-in, shuffles the 16 tiles, tracks results, and shows a leaderboard.
- `auth.js` - shared sign-in / username / admin-check logic used by both pages.
- `style.css` - shared styling, matching NYT Connections' look.
- `firebase-config.js` - your Firebase project's connection info. **You create this yourself from the template below - it is never committed to git.**
- `firebase-config.example.js` - a safe-to-commit template showing the shape of `firebase-config.js`.

No build step, no npm install. Everything runs as static files plus calls out to Firebase.

## 1. Set up Firebase

1. Go to the [Firebase console](https://console.firebase.google.com/) and open your existing project.
2. If you haven't already registered a web app: Project settings (gear icon, top left) -> scroll to "Your apps" -> click the `</>` (web) icon -> give it a nickname -> register.
3. Firebase will show you a `firebaseConfig` object. Copy `firebase-config.example.js` to `firebase-config.js`, then paste those values in, replacing the placeholder strings.
4. In the left sidebar: **Build -> Firestore Database -> Create database** (if you haven't already).
5. Still in the sidebar: **Build -> Authentication -> Get started -> Sign-in method -> Google -> Enable.** Pick a support email when prompted, then Save.

## 2. Keeping your config out of git (fixes the GitHub warning)

Quick context: the values in `firebase-config.js` (apiKey, etc.) aren't actually secret - they're meant to run in public browser code, and your real protection is the Firestore rules below, not hiding this file. That said, GitHub's scanner doesn't know that and will flag it anyway, so the cleanest fix is to just not commit the real file at all:

- `firebase-config.js` is already listed in `.gitignore`, so `git add` will skip it automatically.
- If you already committed a version of `firebase-config.js` with real values in an earlier push, remove it from git's history for this repo with:
  ```bash
  git rm --cached firebase-config.js
  git commit -m "Stop tracking firebase-config.js"
  git push
  ```
  (This stops tracking it going forward - it stays on your disk, just untracked. If a key was already pushed to a public repo, rotating it in the Firebase console is the only way to be fully sure of no misuse, but for a private repo shared with family this step alone is generally enough.)
- Everyone who works on this project (just you, presumably) needs their own local `firebase-config.js` copied from the example file.

## 3. Set the admin email

Open `auth.js` and change this line to your own Google account's email:

```js
export const ADMIN_EMAIL = "YOUR_EMAIL@example.com";
```

This is the account that will be allowed to use `creator.html`.

## 4. Firestore security rules

Go to **Firestore Database -> Rules** and replace the rules with this (swap in your own admin email on the `puzzles` line):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Anyone signed in can read puzzles; only the admin account can write them.
    match /puzzles/{puzzleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.token.email == "YOUR_ADMIN_EMAIL@example.com";
    }

    // Username reservations. Anyone can create their OWN username doc once;
    // nobody can overwrite or delete an existing one (that's what stops two
    // people from ending up with the same name).
    match /usernames/{usernameLower} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }

    // Player profiles (username, join date).
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
                            && request.auth.uid == userId;
      allow delete: if false;
    }

    // One result per (user, puzzle) pair, ever. The document ID must be
    // exactly "<uid>_<puzzleId>", which is what stops someone from writing
    // unlimited fake "solved with 0 mistakes" results for the same puzzle
    // under different document IDs.
    match /results/{resultId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid
                    && resultId == request.auth.uid + '_' + request.resource.data.puzzleId;
      allow update, delete: if false;
    }
  }
}
```

**Honest limitation worth knowing:** these rules stop the obvious cheats (replaying a puzzle for a better score, impersonating another user, writing duplicate results), but they can't fully verify that a "solved" result is real, since the checking logic runs in the player's own browser, not on a server. Someone comfortable with browser dev tools could still fabricate a single fake win per puzzle. Closing that gap completely would mean moving the guess-checking logic into a Cloud Function, which requires upgrading to Firebase's Blaze (pay-as-you-go) plan. For a game shared with friends and family, the current setup is a reasonable line to draw - just flagging it so it's a known tradeoff, not a blind spot.

## 5. Run it locally

Browsers block ES module imports (`type="module"`) and `fetch` calls when you open an HTML file directly via `file://`. You need to serve the folder over `http://` instead:

- Install the **Live Server** extension in VS Code, then right-click `index.html` or `creator.html` -> "Open with Live Server."
- Or, with the Firebase CLI: `firebase serve` from this folder.
- Or: `python3 -m http.server 8000`, then visit `http://localhost:8000/creator.html`.

Google Sign-In's popup works over `localhost`, so local testing works the same as the deployed version.

## 6. Deploying so friends/family can play

See the Firebase Hosting steps you already set up (`firebase init hosting`, `firebase deploy --only hosting`). Once deployed, share the Hosting URL (e.g. `https://your-project-id.web.app`) - that's the player page. Don't share the `/creator.html` URL; it's gated by the admin check, but there's no reason to point curious friends at a page that will just tell them "not authorized."

## 7. Use it

**As admin:** open `creator.html`, sign in with your admin Google account, fill in 4 categories x 4 words each plus a difficulty, click **Publish puzzle**.

**As a player:** open `index.html`, sign in with Google, choose a username the first time (checked for uniqueness), then play. Correct groups lock in with their color; wrong guesses cost one of 4 mistakes; a 3-of-4 match shows "One away...". Once you finish (win or lose), your result is saved - reopening the same puzzle later shows your past result instead of letting you replay it. The leaderboard on the right shows every player's username, how many puzzles they've solved with 0/1/2/3 mistakes, and whether they've attempted the current puzzle yet.

## File structure

```
connections-game/
  index.html                 player page
  player.js                  player game logic + leaderboard
  creator.html                creator page (admin only)
  creator.js                 creator logic (form -> Firestore)
  auth.js                    shared sign-in / username / admin-check helpers
  style.css                   shared styles
  firebase-config.js          YOUR real Firebase credentials (gitignored)
  firebase-config.example.js  safe-to-commit template
  .gitignore
  README.md                   this file
```

## Firestore data model

- `puzzles/{auto-id}` - `{ groups: [...], puzzleDifficulty: 1-5, createdAt }`
- `usernames/{lowercaseUsername}` - `{ uid }` - reservation doc, enforces uniqueness
- `users/{uid}` - `{ username, usernameLower, joinedAt }`
- `results/{uid}_{puzzleId}` - `{ uid, puzzleId, solved, mistakesUsed, playedAt }`
