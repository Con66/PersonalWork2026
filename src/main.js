// ============================================================
// IMPORTS
// ============================================================

import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getShops } from './transformShops.js';
import opening_hours from 'opening_hours'; // parses OSM-format opening hours strings, tells us open/closed state


import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

// Leaflet's default marker icons don't resolve correctly under Vite's bundler,
// so we import the actual image files and manually point Leaflet at them below.
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { db } from './firebase.js';


// Lucide icons imported as raw SVG strings (Vite's `?raw` suffix), injected via innerHTML below
import wifiIconSvg from 'lucide-static/icons/wifi.svg?raw';
import armchairIconSvg from 'lucide-static/icons/armchair.svg?raw';
import coffeeIconSvg from 'lucide-static/icons/coffee.svg?raw';


// ============================================================
// COFFEE CUP MARKERS (colored by rating)
// ============================================================
// Maps a shop's overall rating to a marker color: gray for unreviewed,
// increasingly dark brown for higher ratings, gold border for a perfect 5.

const RATING_COLORS = {
  0: '#bbbbbb', // unreviewed
  1: '#f1b77d',
  2: '#b78955',
  3: '#7e4f1f',
  4: 'rgb(53, 30, 9)',
  5: 'rgb(2, 1, 0)',
};

function createCoffeeIcon(rating) {
  const color = RATING_COLORS[rating] ?? RATING_COLORS[0];
  const borderColor = rating === 5 ? '#ffd700' : 'transparent';

  return L.divIcon({
    html: `<div class="coffee-marker" style="--icon-color:${color}; border-color:${borderColor};">${coffeeIconSvg}</div>`,
    className: 'coffee-marker-wrapper', // empty on purpose — strips Leaflet's default icon styling
    iconSize: [32, 32],
    iconAnchor: [16, 16], // centers the round badge directly over the coordinate
  });
}

// shopId -> Leaflet marker, so we can recolor a specific marker instantly after saving,
// without needing to reload the whole page or re-fetch all shops again.
const shopMarkers = new Map();

// Fetches every shop's saved rating in ONE Firestore query, rather than one read per shop
// (40 separate reads would work but is unnecessarily slow and wasteful at this scale).
async function loadAllShopRatings() {
  const ratings = {};
  try {
    const snapshot = await getDocs(collection(db, 'shops'));
    snapshot.forEach((docSnap) => {
      ratings[docSnap.id] = docSnap.data();
    });
  } catch (err) {
    console.error('Failed to load shop ratings:', err);
  }
  return ratings;
}
// Pulls the cleaned shop list (name, lat/lng, address, opening hours) from transformShops.js
const shops = getShops();

// Firestore document IDs can't contain "/", but OSM ids sometimes look like "node/123456789"
// (when falling back to properties['@id']), so we replace "/" with "_" before using it as a key.
function sanitizeId(id) {
  return String(id).replace(/\//g, '_');
}

// Creates all shop markers, colored according to their saved rating (if any).
async function initShopMarkers() {
  const allRatings = await loadAllShopRatings();

  shops.forEach((shop) => {
    const sanitized = sanitizeId(shop.id);
    const saved = allRatings[sanitized];
    const rating = saved?.overallRating || 0;

    const marker = L.marker([shop.lat, shop.lng], { icon: createCoffeeIcon(rating) })
      .addTo(map)
      .on('click', () => openModal(shop));

    shopMarkers.set(sanitized, marker);
  });
}

initShopMarkers();

// ============================================================
// FIRESTORE PERSISTENCE
// ============================================================
// Each shop's user-entered data (rating, cost, wifi, seating, drinks, notes) is stored
// as one document in a "shops" collection, keyed by the shop's id.



// Merges the given fields into this shop's document, creating it if it doesn't exist yet.
// Using { merge: true } is essential here — without it, saving just "drinks" would wipe out
// any previously saved rating/notes/etc. on that same document.
async function saveShopField(shopId, fieldData) {
  const shopDocRef = doc(db, 'shops', sanitizeId(shopId));
  try {
    await setDoc(shopDocRef, fieldData, { merge: true });
  } catch (err) {
    console.error('Failed to save to Firestore:', err);
  }
}

// Reads this shop's saved document, if one exists. Returns null for shops never rated yet.
async function loadShopData(shopId) {
  const shopDocRef = doc(db, 'shops', sanitizeId(shopId));
  try {
    const snap = await getDoc(shopDocRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('Failed to load from Firestore:', err);
    return null;
  }
}

// ============================================================
// MAP SETUP
// ============================================================

// Center coordinates — your apartment
const HOME = { lat: 40.72208853729934, lng: -73.94335157965742 };

const map = L.map('map').setView([HOME.lat, HOME.lng], 15);

// Fix for Leaflet's default marker icon paths breaking under Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

// Home marker — custom house emoji icon, distinct from coffee shop pins
const homeIcon = L.divIcon({
  html: '🏠',
  className: 'home-icon', // strips Leaflet's default icon styling so only the emoji shows
  iconSize: [30, 30],
});

L.marker([HOME.lat, HOME.lng], { icon: homeIcon })
  .addTo(map)
  .bindPopup('Home');

// ============================================================
// COFFEE SHOP MARKERS
// ============================================================





// ============================================================
// OPENING HOURS STATUS
// ============================================================

// Determines whether a shop is open, closing soon, closed, or has no hours data,
// using the opening_hours library to parse OSM's hours syntax.
function getHoursStatus(openingHoursString) {
  if (!openingHoursString) {
    return { className: 'unavailable', text: 'Hours unavailable' };
  }

  try {
    const oh = new opening_hours(openingHoursString);
    const isOpenNow = oh.getState();

    if (!isOpenNow) {
      return { className: 'closed', text: 'Closed' };
    }

    // Check if closing within the next hour, to show the "closing soon" (yellow) state
    const nextChange = oh.getNextChange();
    const msUntilChange = nextChange - new Date();
    const oneHourMs = 60 * 60 * 1000;

    if (msUntilChange <= oneHourMs) {
      return { className: 'closing-soon', text: 'Closing soon' };
    }

    return { className: 'open', text: 'Open now' };
  } catch (err) {
    // Some OSM entries have malformed hours syntax the library can't parse —
    // treat those the same as "no data" rather than crashing the modal.
    console.warn('Could not parse opening hours:', openingHoursString, err);
    return { className: 'unavailable', text: 'Hours unavailable' };
  }
}

// ============================================================
// MODAL — SHELL (open/close, name/address, hours status)
// ============================================================

const modalOverlay = document.getElementById('modal-overlay');
const modalShopName = document.getElementById('modal-shop-name');
const modalShopAddress = document.getElementById('modal-shop-address');
const modalClose = document.getElementById('modal-close');
const modalHoursStatus = document.getElementById('modal-hours-status');
const modalHoursText = document.getElementById('modal-hours-text');

// Tracks which shop the modal is currently showing, so the eventual "Save" button
// knows which Firestore document to write to. Set every time openModal runs.
let currentShop = null;

async function openModal(shop) {
  currentShop = shop;

  modalShopName.textContent = shop.name;
  modalShopAddress.textContent = shop.address || 'Address unavailable';

  const status = getHoursStatus(shop.openingHours);
  modalHoursStatus.className = status.className;
  modalHoursText.textContent = status.text;

  modalOverlay.classList.remove('hidden');

  // Show the modal immediately with blank/default state, then fill in saved data
  // once it arrives — avoids the modal feeling stuck/unresponsive while the network request runs.
  starRating.setValue(0);
  costRating.setValue(0);
  wifiToggle.setValue(false);
  seatingToggle.setValue(false);
  currentDrinks = [];
  renderDrinkList();
  currentNotes = [];
  renderNotesList();

  const saved = await loadShopData(shop.id);
  if (saved) {
    starRating.setValue(saved.overallRating || 0);
    costRating.setValue(saved.costRating || 0);
    wifiToggle.setValue(saved.wifi || false);
    seatingToggle.setValue(saved.seating || false);
    currentDrinks = saved.drinks || [];
    renderDrinkList();
    currentNotes = saved.notes || [];
    renderNotesList();
  }
}

document.getElementById('save-btn').addEventListener('click', () => {
  if (!currentShop) return;

  const newRating = starRating.getValue();

  saveShopField(currentShop.id, {
    overallRating: newRating,
    costRating: costRating.getValue(),
    wifi: wifiToggle.getValue(),
    seating: seatingToggle.getValue(),
  });

  const marker = shopMarkers.get(sanitizeId(currentShop.id));
  if (marker) marker.setIcon(createCoffeeIcon(newRating));

  closeModal();
});
// ============================================================
// DRINK LOG
// ============================================================
// Tracks drinks ordered at the currently open shop as an in-memory array of
// { drink, rating } objects. Reset per shop in openModal, same as the other widgets.
// TODO: once Firestore is wired up, this array becomes part of what gets saved/loaded
// per shop, instead of just living in memory for the current modal session.

const drinkNameInput = document.getElementById('drink-name-input');
const drinkAddBtn = document.getElementById('drink-add-btn');
const drinkList = document.getElementById('drink-list');

let currentDrinks = [];

// Re-renders the <ul> to match currentDrinks. Called any time the array changes,
// rather than trying to patch the DOM incrementally — simpler and fine at this scale.
function renderDrinkList() {
  drinkList.innerHTML = '';
  currentDrinks.forEach((entry, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="drink-name">${entry.drink}</span>
      <span class="drink-stars">${'★'.repeat(entry.rating)}</span>
      <button class="delete-btn" data-index="${index}" aria-label="Delete drink entry">&times;</button>
    `;
    drinkList.appendChild(li);
  });
}

function addDrinkEntry() {
  const drink = drinkNameInput.value.trim();
  const rating = drinkStarRating.getValue();

  if (!drink || rating === 0) return;

  currentDrinks.push({ drink, rating });
  renderDrinkList();

  drinkNameInput.value = '';
  drinkStarRating.setValue(0);
  drinkNameInput.focus();

  if (currentShop) {
    saveShopField(currentShop.id, { drinks: currentDrinks });
  }
}

drinkAddBtn.addEventListener('click', addDrinkEntry);

// Also allow pressing Enter in either input to add, not just clicking the button
// [drinkNameInput, drinkRatingInput].forEach((input) => {
//   input.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter') addDrinkEntry();
//   });
// });



drinkNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDrinkEntry();
});

// ============================================================
// NOTES
// ============================================================
// Tracks free-text notes for the currently open shop as an in-memory array of strings.
// Reset per shop in openModal, same pattern as drinks. Visual "sticky note" styling
// (rotation, shadow, etc.) deferred to the dedicated styling pass — these are placeholder
// yellow boxes for now.
// TODO: once Firestore is wired up, this array becomes part of what gets saved/loaded per shop.

const notesInput = document.getElementById('notes-input');
const notesAddBtn = document.getElementById('notes-add-btn');
const notesList = document.getElementById('notes-list');

let currentNotes = [];

function renderNotesList() {
  notesList.innerHTML = '';
  currentNotes.forEach((entry, index) => {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.style.backgroundColor = entry.color;
    div.style.transform = `rotate(${entry.rotation}deg)`;
    div.innerHTML = `
      <button class="delete-btn" data-index="${index}" aria-label="Delete note">&times;</button>
      <span class="note-text">${entry.text}</span>
    `;
    notesList.appendChild(div);
  });
}

drinkList.addEventListener('click', (e) => {
  if (!e.target.classList.contains('delete-btn')) return;
  const index = Number(e.target.dataset.index);
  currentDrinks.splice(index, 1);
  renderDrinkList();
  if (currentShop) saveShopField(currentShop.id, { drinks: currentDrinks });
});

notesList.addEventListener('click', (e) => {
  if (!e.target.classList.contains('delete-btn')) return;
  const index = Number(e.target.dataset.index);
  currentNotes.splice(index, 1);
  renderNotesList();
  if (currentShop) saveShopField(currentShop.id, { notes: currentNotes });
});

function addNote() {
  const note = notesInput.value.trim();
  if (!note) return;

  const colors = ['#e8e09a', '#b5939f', '#5b99cc', '#ad94db']; // pale yellow, pink, blue, lavender
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomRotation = (Math.random() * 6 - 3).toFixed(1); // range: -3deg to +3deg

  currentNotes.push({ text: note, color: randomColor, rotation: randomRotation });
  renderNotesList();

  notesInput.value = '';
  notesInput.focus();

  if (currentShop) {
    saveShopField(currentShop.id, { notes: currentNotes });
  }
}
notesAddBtn.addEventListener('click', addNote);

function closeModal() {
  modalOverlay.classList.add('hidden');
}

modalClose.addEventListener('click', closeModal);

// Close when clicking the dark background itself, but not when clicking inside the modal content
// (checking e.target === modalOverlay prevents clicks inside the modal from bubbling up and
// incorrectly triggering a close).
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ============================================================
// WIFI / SEATING TOGGLES
// ============================================================
// NOTE: this setup must only run ONCE, at the top level — not inside a function
// that gets called multiple times (e.g. setupRatingWidget below), or the wifi/seating
// buttons end up with duplicate click listeners, causing each click to toggle
// on-then-immediately-off and appear to do nothing.

// Inject the actual Lucide icon markup into our placeholder spans
document.querySelector('#wifi-toggle .icon-fill').innerHTML = wifiIconSvg;
document.querySelector('#seating-toggle .icon-fill').innerHTML = armchairIconSvg;

// Generic toggle setup: adds one click listener that flips an "active" class,
// and returns get/set helpers for reading or pre-filling the toggle's state later.
function setupToggle(buttonId) {
  const button = document.getElementById(buttonId);

  button.addEventListener('click', () => {
    button.classList.toggle('active');
  });

  return {
    getValue: () => button.classList.contains('active'),
    setValue: (value) => {
      button.classList.toggle('active', value);
    },
  };
}

const wifiToggle = setupToggle('wifi-toggle');
const seatingToggle = setupToggle('seating-toggle');

// ============================================================
// STAR / DOLLAR RATING WIDGETS
// ============================================================

// Generic rating widget setup: shared logic for both the 5-star "overall" rating
// and the 5-dollar-sign "cost" rating, since they behave identically —
// hover previews a value, click commits it, mouse-leave reverts to the saved value.
function setupRatingWidget(containerId, itemSelector, filledClass) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll(itemSelector);

  // Fills every star/dollar at or below `value` with `className`;
  // unfills everything above it. Reused for both hover preview and committed selection.
  function paintUpTo(value, className) {
    items.forEach((item) => {
      const itemValue = Number(item.dataset.value);
      item.classList.toggle(className, itemValue <= value);
    });
  }

  items.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      const hoverValue = Number(item.dataset.value);
      paintUpTo(hoverValue, 'hover');
    });

    item.addEventListener('click', () => {
      const clickedValue = Number(item.dataset.value);
      container.dataset.value = clickedValue; // commits the real, saved value
      paintUpTo(clickedValue, filledClass);
    });
  });

  // When the mouse leaves the whole row, clear the hover preview and restore
  // whatever was actually clicked/saved — so it doesn't stay stuck on a hovered value.
  container.addEventListener('mouseleave', () => {
    items.forEach((item) => item.classList.remove('hover'));
    paintUpTo(Number(container.dataset.value), filledClass);
  });

  return {
    getValue: () => Number(container.dataset.value),
    setValue: (value) => {
      container.dataset.value = value;
      paintUpTo(value, filledClass);
    },
  };
}

const starRating = setupRatingWidget('star-rating', '.star', 'filled');
const costRating = setupRatingWidget('cost-rating', '.dollar', 'filled');
const drinkStarRating = setupRatingWidget('drink-star-rating', '.star', 'filled');