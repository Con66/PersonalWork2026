# Connections Game (Firebase + vanilla JS)

A two-sided clone of NYT's Connections:

- `creator.html` / `creator.js` - build a puzzle (4 categories x 4 words) and publish it to Firestore.
- `index.html` / `player.js` - loads the most recently published puzzle, shuffles the 16 tiles, and lets a player guess groups of 4.
- `style.css` - shared styling, matching NYT Connections' look (cream background, yellow/green/blue/purple difficulty colors, rounded tiles).
- `firebase-config.js` - your Firebase project's connection info. **You need to edit this file before anything will work.**

No build step, no npm install. Everything runs as static files plus calls out to Firebase.

## 1. Set up Firebase

1. Go to the [Firebase console](https://console.firebase.google.com/) and open your existing project.
2. If you haven't already registered a web app: Project settings (gear icon, top left) -> scroll to "Your apps" -> click the `</>` (web) icon -> give it a nickname -> register.
3. Firebase will show you a `firebaseConfig` object. Copy those values into `firebase-config.js`, replacing the placeholder strings.
4. In the left sidebar, go to **Build -> Firestore Database -> Create database**. Start in test mode for now (we'll tighten this below).

## 2. Set Firestore security rules

Go to **Firestore Database -> Rules** and use something like this to start:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /puzzles/{puzzleId} {
      allow read: if true;   // anyone can read puzzles (players need this)
      allow write: if true;  // anyone can write puzzles (fine for now, see note below)
    }
  }
}
```

**Important note on security:** right now, anyone with your `creator.html` URL could publish a puzzle, because there's no login system yet. That's fine while you're the only one testing it and the URL isn't shared. Before you share this publicly, you'll want to:

- Add Firebase Authentication (email/password or Google sign-in is easiest) and change the rule to `allow write: if request.auth != null;` restricted to your own user ID, or
- Simply don't share the `creator.html` link, and treat its obscurity as a stopgap (not a real security boundary).

This project's structure already supports adding logins later without a rewrite - see "Adding logins later" below.

## 3. Run it locally

Browsers block ES module imports (`type="module"`) and `fetch` calls when you open an HTML file directly via `file://`. You need to serve the folder over `http://` instead. Easiest options in VS Code:

- Install the **Live Server** extension, then right-click `index.html` or `creator.html` -> "Open with Live Server."
- Or, if you have the Firebase CLI installed: `firebase serve` from this folder (after running `firebase init hosting` once, pointing it at this directory).
- Or, from a terminal in this folder: `python3 -m http.server 8000`, then visit `http://localhost:8000/creator.html`.

## 4. Use it

1. Open `creator.html`, fill in 4 categories x 4 words/phrases each, click **Publish puzzle**.
2. Open `index.html` - it loads whatever puzzle was most recently published and shuffles it.
3. Click tiles to select up to 4, then **Submit**. Correct groups lock in at the top with their color; wrong guesses cost you one of your 4 mistakes, and 3-of-4 matches get a "One away..." hint.

## Adding logins later

You mentioned wanting logins/profiles eventually. This structure is set up so that's additive, not a rewrite:

- Add Firebase Authentication (Email/Password or Google).
- On the creator side: wrap `creator.html`'s logic in a check for `auth.currentUser`, and tighten the Firestore rule above to check `request.auth.uid` against an "admins" list (or just your own UID) so random people can't publish puzzles.
- On the player side: if you want to track individual players' stats (streaks, completion times, etc.), add a `results` collection keyed by `userId + puzzleId`, written after each completed game.

## File structure

```
connections-game/
  index.html          player page
  player.js           player game logic
  creator.html         creator page
  creator.js          creator logic (form -> Firestore)
  style.css            shared styles
  firebase-config.js   YOUR Firebase project credentials go here
  README.md            this file
```
