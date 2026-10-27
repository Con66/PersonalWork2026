import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getShops } from './transformShops.js';
import opening_hours from 'opening_hours';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { db } from './firebase.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';



// Center coordinates — your apartment
const HOME = { lat: 40.72208853729934, lng: -73.94335157965742 }; // replace with your real coordinates

const map = L.map('map').setView([HOME.lat, HOME.lng], 15);

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

// Home marker — custom house icon
const homeIcon = L.divIcon({
  html: '🏠',
  className: 'home-icon', // strips Leaflet's default icon styling so only the emoji shows
  iconSize: [30, 30],
});

L.marker([HOME.lat, HOME.lng], { icon: homeIcon })
  .addTo(map)
  .bindPopup('Home');

// Coffee shop markers
const shops = getShops();


shops.forEach((shop) => {
  L.marker([shop.lat, shop.lng])
    .addTo(map)
    .on('click', () => openModal(shop));
});

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

    // Check if closing within the next hour
    const nextChange = oh.getNextChange();
    const msUntilChange = nextChange - new Date();
    const oneHourMs = 60 * 60 * 1000;

    if (msUntilChange <= oneHourMs) {
      return { className: 'closing-soon', text: 'Closing soon' };
    }

    return { className: 'open', text: 'Open now' };
  } catch (err) {
    console.warn('Could not parse opening hours:', openingHoursString, err);
    return { className: 'unavailable', text: 'Hours unavailable' };
  }
}

// Modal elements
const modalOverlay = document.getElementById('modal-overlay');
const modalShopName = document.getElementById('modal-shop-name');
const modalShopAddress = document.getElementById('modal-shop-address');
const modalClose = document.getElementById('modal-close');

const modalHoursStatus = document.getElementById('modal-hours-status');
const modalHoursText = document.getElementById('modal-hours-text');

function openModal(shop) {
  modalShopName.textContent = shop.name;
  modalShopAddress.textContent = shop.address || 'Address unavailable';

  const status = getHoursStatus(shop.openingHours);
  modalHoursStatus.className = status.className; // resets classes each time, avoiding stacking from previous shop
  modalHoursText.textContent = status.text;

  modalOverlay.classList.remove('hidden');
}

function setupRatingWidget(containerId, itemSelector, filledClass) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll(itemSelector);

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
      container.dataset.value = clickedValue;
      paintUpTo(clickedValue, filledClass);
    });
  });

  container.addEventListener('mouseleave', () => {
    items.forEach((item) => item.classList.remove('hover'));
    // restore actual saved state on mouse leave
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

function closeModal() {
  modalOverlay.classList.add('hidden');
}

modalClose.addEventListener('click', closeModal);

// Close when clicking the dark overlay itself, but not the modal content
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

