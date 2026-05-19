// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {

  apiKey: "AIzaSyCzusMA4ZE4UFIdOIjTux4UhjNHZ05ZdmU",

  authDomain: "couples-corner-d175a.firebaseapp.com",

  projectId: "couples-corner-d175a",

  storageBucket: "couples-corner-d175a.firebasestorage.app",

  messagingSenderId: "889004108643",

  appId: "1:889004108643:web:db3461ece514c07feb8156",

  measurementId: "G-ERW88R1C2R"

};

let userName = null;

async function checkUserName() {
    const storedName = localStorage.getItem("couplesCornerName");
    if (storedName) {
        userName = storedName;
    } else {
        document.getElementById("name-modal").classList.remove("hidden");
    }
}

document.getElementById("name-submit-btn").addEventListener("click", () => {
    const nameInput = document.getElementById("name-input").value.trim();
    if (nameInput) {
        userName = nameInput;
        localStorage.setItem("couplesCornerName", nameInput);
        document.getElementById("name-modal").classList.add("hidden");
    }
});

document.getElementById("name-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        document.getElementById("name-submit-btn").click();
    }
});

checkUserName();



// Initialize Firebase

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const WEATHER_API_KEY = "d47c5d80f0a52e814ae14977826b50d6"
const storage = getStorage(app);

document.getElementById("stack-of-books").addEventListener("click", () => {
    document.getElementById("books-modal").classList.remove("hidden");
});

document.getElementById("close-books-btn").addEventListener("click", () => {
    document.getElementById("books-modal").classList.add("hidden");
});

document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // Update active tab button
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Show correct panel
        document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
});

async function searchBooks(searchTerm) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&maxResults=8&key=AIzaSyBEDxzjEjpUHYJbN78hKia49QM0kTOJICY`
        );
        const data = await response.json();
        console.log("API response:", data);

        if (!data.items) {
            document.getElementById("search-results").innerHTML = 
                "<p style='color: #a08060;'>No books found.</p>";
            return;
        }

        displaySearchResults(data.items);

    } catch (error) {
        console.error("Error searching books:", error);
    }
}

function displaySearchResults(books) {
    const container = document.getElementById("search-results");
    container.innerHTML = "";

    books.forEach(book => {
        const info = book.volumeInfo;
        const title = info.title || "Unknown Title";
        const author = info.authors ? info.authors.join(", ") : "Unknown Author";
        const blurb = info.description || "No description available.";
        const cover = info.imageLinks?.thumbnail || "assets/no-cover.png";
        const googleId = book.id;

        const banner = document.createElement("div");
        banner.classList.add("book-banner");
        banner.innerHTML = `
            <img class="book-cover" src="${cover}" alt="${title}">
            <div class="book-info">
                <p class="book-title">${title}</p>
                <p class="book-author">${author}</p>
                <p class="book-blurb">${blurb}</p>
                <div class="book-actions">
                    <button onclick="addToRecommended('${googleId}', \`${title.replace(/`/g, "'")}\`, \`${author.replace(/`/g, "'")}\`, '${cover}', \`${blurb.replace(/`/g, "'").substring(0, 200)}\`)">
                        + Add to Reading List
                    </button>
                </div>
            </div>
        `;

        container.appendChild(banner);
    });
}

document.getElementById("book-search-btn").addEventListener("click", () => {
    const query = document.getElementById("book-search-input").value.trim();
    if (query) searchBooks(query);
});

document.getElementById("book-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("book-search-btn").click();
});

window.addToRecommended = async (googleId, title, author, cover, blurb) => {
    try {
        await addDoc(collection(db, "books"), {
            googleId,
            title,
            author,
            cover,
            blurb,
            status: "recommended",
            addedBy: userName,
            ratings: {},
            reviews: {},
            progress: {}
        });
        console.log("Book added to reading list!");
        
        // Clear search results
        document.getElementById("search-results").innerHTML = 
            "<p style='color: #a08060; font-size: 13px;'>✓ Book added to your reading list!</p>";
        document.getElementById("book-search-input").value = "";
        
        // Reload books
        loadBooks();
        // Switch to recommended tab
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
        document.querySelector("[data-tab='recommended']").classList.add("active");
        document.getElementById("tab-recommended").classList.remove("hidden");
    } catch (error) {
        console.error("Error adding book:", error);
    }
}

async function loadBooks() {
    const q = query(collection(db, "books"));
    const snapshot = await getDocs(q);

    const recommended = [];
    const inprogress = [];
    const completed = [];

    snapshot.forEach(doc => {
        const book = { id: doc.id, ...doc.data() };
        if (book.status === "recommended") recommended.push(book);
        else if (book.status === "inprogress") inprogress.push(book);
        else if (book.status === "completed") completed.push(book);
    });

    displayBookList(recommended, "recommended-list", "recommended");
    displayBookList(inprogress, "inprogress-list", "inprogress");
    displayBookList(completed, "completed-list", "completed");
}

function displayBookList(books, containerId, status) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (books.length === 0) {
        container.innerHTML = "<p style='color: #a08060; font-size: 13px;'>Nothing here yet.</p>";
        return;
    }

    books.forEach(book => {
        const banner = document.createElement("div");
        banner.classList.add("book-banner");

        let actionsHTML = "";

        if (status === "recommended") {
            actionsHTML = `
                <button onclick="moveBook('${book.id}', 'inprogress')">Start Reading</button>
            `;
        } else if (status === "inprogress") {
            actionsHTML = `
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <input type="number" placeholder="Pages read" 
                        id="pages-${book.id}" 
                        value="${book.progress?.[userName] || ''}"
                        style="width:100px; padding:4px 8px; border-radius:6px; border:2px solid #6c492e; background:#1a0f07; color:#f0e6d3; font-family:Georgia,serif; font-size:11px;">
                    <button onclick="logPages('${book.id}')">Log Pages</button>
                    <button onclick="moveBook('${book.id}', 'completed')">Mark Complete</button>
                </div>
                ${book.progress ? `<p style="color:#a08060; font-size:11px; margin-top:5px;">${formatProgress(book.progress)}</p>` : ""}
            `;
        } else if (status === "completed") {
            if (status === "completed") {
                const alreadyRated = book.ratings?.[userName];
                const alreadyReviewed = book.reviews?.[userName];

                actionsHTML = `
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        ${!alreadyRated ? `
                            <input type="number" min="1" max="10" placeholder="Your rating /10" 
                                id="rating-${book.id}"
                                style="width:120px; padding:4px 8px; border-radius:6px; border:2px solid #6c492e; background:#1a0f07; color:#f0e6d3; font-family:Georgia,serif; font-size:11px;">
                            <button onclick="submitRating('${book.id}')">Rate</button>
                        ` : `<p style="color:#f0c070; font-size:11px;">Your rating: ${alreadyRated}/10</p>`}
                    </div>
                    <div style="margin-top:8px;">
                        ${!alreadyReviewed ? `
                            <textarea placeholder="Write your review..." 
                                id="review-${book.id}"
                                style="width:100%; padding:6px; border-radius:6px; border:2px solid #6c492e; background:#1a0f07; color:#f0e6d3; font-family:Georgia,serif; font-size:11px; resize:vertical;"></textarea>
                            <button onclick="submitReview('${book.id}')">Save Review</button>
                        ` : `<p style="color:#a08060; font-size:11px; margin-top:4px;"><em>Your review:</em> "${alreadyReviewed}"</p>`}
                    </div>
                    ${formatRatingsAndReviews(book)}
                `;
}
        }

        banner.innerHTML = `
            <img class="book-cover" src="${book.cover}" alt="${book.title}">
            <div class="book-info">
                <p class="book-title">${book.title}</p>
                <p class="book-author">${book.author}</p>
                <p class="book-blurb">${book.blurb}</p>
                <p style="color:#a08060; font-size:11px;">Added by ${book.addedBy}</p>
                <div class="book-actions">${actionsHTML}</div>
            </div>
        `;

        container.appendChild(banner);
    });
}

function formatProgress(progress) {
    return Object.entries(progress)
        .map(([name, pages]) => `${name}: page ${pages}`)
        .join(" · ");
}

function formatRatingsAndReviews(book) {
    let html = "";
    if (book.ratings && Object.keys(book.ratings).length > 0) {
        html += `<div style="margin-top:8px;">`;
        Object.entries(book.ratings).forEach(([name, rating]) => {
            html += `<p style="color:#f0c070; font-size:11px;">${name}: ${rating}/10</p>`;
        });
        html += `</div>`;
    }
    if (book.reviews && Object.keys(book.reviews).length > 0) {
        Object.entries(book.reviews).forEach(([name, review]) => {
            html += `<p style="color:#a08060; font-size:11px; margin-top:4px;"><em>${name}:</em> "${review}"</p>`;
        });
    }
    return html;
}

window.moveBook = async (bookId, newStatus) => {
    try {
        await updateDoc(doc(db, "books", bookId), { status: newStatus });
        loadBooks();
    } catch (error) {
        console.error("Error moving book:", error);
    }
}

window.logPages = async (bookId) => {
    const pages = document.getElementById(`pages-${bookId}`).value;
    if (!pages) return;
    try {
        await updateDoc(doc(db, "books", bookId), {
            [`progress.${userName}`]: parseInt(pages)
        });
        loadBooks();
    } catch (error) {
        console.error("Error logging pages:", error);
    }
}

window.submitRating = async (bookId) => {
    const rating = document.getElementById(`rating-${bookId}`).value;
    if (!rating) return;
    try {
        await updateDoc(doc(db, "books", bookId), {
            [`ratings.${userName}`]: parseInt(rating)
        });
        loadBooks();
    } catch (error) {
        console.error("Error submitting rating:", error);
    }
}

window.submitReview = async (bookId) => {
    const review = document.getElementById(`review-${bookId}`).value.trim();
    if (!review) return;
    try {
        await updateDoc(doc(db, "books", bookId), {
            [`reviews.${userName}`]: review
        });
        loadBooks();
    } catch (error) {
        console.error("Error submitting review:", error);
    }
}

// TEST WRITE FUNCTION
async function testWrite() {
    try {
        await setDoc(doc(db, "room", "state"), {
            fireplace: true,
            weather: "rainy",
            message: "Hello from Couples Corner!"
        });
        console.log("Data written successfully!");
    } catch (error) {
        console.error("Error writing data: ", error);
    }
}


async function testRead() {
    try {
        const docRef = doc(db, "room", "state");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Data retrieved:", docSnap.data());
        } else {
            console.log("No document found!");
        }
    } catch (error) {
        console.error("Error reading data:", error);
    }
}

// Get button elements
const fireplaceBtn = document.getElementById("fireplace");
const weatherBtn = document.getElementById("weather-btn");
const pictureBtn = document.getElementById("picture-frame");

// Fireplace button
fireplaceBtn.addEventListener("click", async () => {
    try {
        const docRef = doc(db, "room", "state");
        const docSnap = await getDoc(docRef);
        const currentState = docSnap.data();

        const newFireplaceState = !currentState.fireplace;

        await setDoc(docRef, {
            ...currentState,
            fireplace: newFireplaceState
        });

        console.log("Fireplace is now:", newFireplaceState);
    } catch (error) {
        console.error("Error toggling fireplace:", error);
    }
});

//Picture button
pictureBtn.addEventListener("click", () => {
    document.getElementById("upload-panel").classList.remove("hidden");
});

document.getElementById("close-upload-btn").addEventListener("click", () => {
    document.getElementById("upload-panel").classList.add("hidden");
});

async function uploadPhoto(file) {
    console.log("Uploading:", file.name);
    try {
        // Create a unique filename using timestamp
        const fileName = `photos/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);

        // Upload the file
        await uploadBytes(storageRef, file);
        console.log("Photo uploaded successfully!");

        // Hide the panel after upload
        document.getElementById("upload-panel").classList.add("hidden");

        // Refresh the photo cycle
        loadPhotos();

    } catch (error) {
        console.error("Error uploading photo:", error);
    }
}

let photoIndex = 0;
let photoURLs = [];

async function loadPhotos() {

    try {
        const photosRef = ref(storage, "photos/");
        const result = await listAll(photosRef);

        // Get download URLs for all photos
        photoURLs = await Promise.all(
            result.items.map(item => getDownloadURL(item))
        );

        console.log("Photos loaded:", photoURLs.length);

        // Start cycling if photos exist
        if (photoURLs.length > 0) {
            showPhoto(photoIndex);
        }

    } catch (error) {
        console.error("Error loading photos:", error);
    }
}

function showPhoto(index) {
    const frame = document.getElementById("picture-in-frame").querySelector("img");
    frame.src = photoURLs[index];
}

// Cycle through photos every 5 seconds
setInterval(() => {
    if (photoURLs.length > 0) {
        photoIndex = (photoIndex + 1) % photoURLs.length;
        showPhoto(photoIndex);
    }
}, 15000);


// Load photos on startup
loadPhotos();


document.getElementById("upload-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("photo-upload");
    const file = fileInput.files[0];  // get the actual file directly

    if (!file) {
        console.log("No file selected");
        return;
    }

    await uploadPhoto(file);
    fileInput.value = "";
});

function openGallery() {
    const grid = document.getElementById("gallery-grid");
    grid.innerHTML = ""; // clear existing thumbnails

    if (photoURLs.length === 0) {
        grid.innerHTML = "<p style='color: #a08060; font-size: 12px;'>No photos yet!</p>";
    } else {
        photoURLs.forEach((url, index) => {
            // Create gallery item
            const item = document.createElement("div");
            item.classList.add("gallery-item");

            // Thumbnail
            const img = document.createElement("img");
            img.src = url;
            img.alt = `Photo ${index + 1}`;

            // Download button
            const downloadBtn = document.createElement("button");
            downloadBtn.textContent = "Download";
            downloadBtn.addEventListener("click", () => downloadPhoto(url, index));

            item.appendChild(img);
            item.appendChild(downloadBtn);
            grid.appendChild(item);
        });
    }

    document.getElementById("gallery-panel").classList.remove("hidden");
    document.getElementById("upload-panel").classList.add("hidden");
}

function downloadPhoto(url, index) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `couples-corner-photo-${index + 1}.jpg`;
    a.target = "_blank";
    a.click();
}

document.getElementById("view-album-btn").addEventListener("click", () => {
    openGallery();
});

document.getElementById("close-gallery-btn").addEventListener("click", () => {
    document.getElementById("gallery-panel").classList.add("hidden");
});


async function fetchWeather(city, tempElementId, gifElementId, windowElementId) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=imperial`
        );
        const data = await response.json();
        
        // Check if city was found
        if (data.cod === "404") {
            console.error("City not found:", city);
            document.getElementById(tempElementId).textContent = "City not found";
            return; // stop the function here
        }
        // Update temperature
        const temp = Math.round(data.main.temp);
        document.getElementById(tempElementId).textContent = `${temp}°F`;
        document.getElementById(tempElementId).style.color = getTempColor(temp);

        // Determine day or night using sunrise/sunset and timezone offset
        const utcNow = Math.floor(Date.now() / 1000); // current UTC time in seconds
        const localTime = utcNow + data.timezone;      // city's local time in seconds
        const sunrise = data.sys.sunrise + data.timezone;
        const sunset = data.sys.sunset + data.timezone;
        const isNight = localTime < sunrise || localTime > sunset;

        // Add these debug lines
        // console.log("UTC Now:", utcNow);
        // console.log("Local Time:", localTime);
        // console.log("Sunrise:", sunrise);
        // console.log("Sunset:", sunset);
        // console.log("Is Night:", isNight);
        // console.log("Condition:", data.weather[0].main);

        // Update window background
        const windowEl = document.getElementById(windowElementId);
        if (isNight) {
            windowEl.style.backgroundColor = "#02020c";
        } else {
            windowEl.style.backgroundColor = "#37689c";
        }

        // Update GIF based on weather condition
        const condition = data.weather[0].main.toLowerCase();
        const gifElement = document.getElementById(gifElementId);

        if (condition.includes("clear")) {
            if (isNight) {
                gifElement.src = "assets/night.png";
            }
            else {
                gifElement.src = "assets/sunny.png";
            }
        } else if (condition.includes("cloud")) {
            gifElement.src = "assets/cloudy.png";
        } else if (condition.includes("rain")) {
            gifElement.src = "assets/rain.gif";
        } else if (condition.includes("snow")) {
            gifElement.src = "assets/snow.gif";
        } else if (condition.includes("thunder")) {
            gifElement.src = "assets/storm.gif";
        } else {
            gifElement.src = "assets/cloudy.png"; // default
        }

    } catch (error) {
        console.error("Error fetching weather:", error);
    }
}

function getTempColor(temp) {
    // Clamp temp between 20 and 100
    const min = 20;
    const max = 100;
    const clamped = Math.min(Math.max(temp, min), max);
    
    // Convert to a 0-1 scale
    const t = (clamped - min) / (max - min);

    // Define color stops
    // t=0.0 (20°F) → dark blue
    // t=0.4 (52°F) → beige
    // t=1.0 (100°F) → red
    let r, g, b;

    if (t < 0.4) {
        // dark blue to beige
        const s = t / 0.4;
        r = Math.round(30 + s * (210 - 30));
        g = Math.round(80 + s * (190 - 80));
        b = Math.round(180 + s * (170 - 180));
    } else {
        // beige to red
        const s = (t - 0.4) / 0.6;
        r = Math.round(210 + s * (220 - 210));
        g = Math.round(190 + s * (30 - 190));
        b = Math.round(170 + s * (30 - 170));
    }

    return `rgb(${r}, ${g}, ${b})`;
}

// Listen for real time changes
const docRef = doc(db, "room", "state");

onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        const state = docSnap.data();

        const flames = document.getElementById("flames");
        const fireplaceEl = document.getElementById("fireplace");

        if (state.fireplace) {
            flames.classList.remove("hidden");
            fireplaceEl.style.boxShadow = "0 0 40px rgba(255, 100, 0, 0.6)";
        } else {
            flames.classList.add("hidden");
            fireplaceEl.style.boxShadow = "none";
        }

        // Windows
        if (state.window_left?.location) {
            document.getElementById("location-display-left").textContent = state.window_left.location;
            fetchWeather(state.window_left.location, "temp-left", "weather-gif-left", "window-left");
}

        if (state.window_right?.location) {
            document.getElementById("location-display-right").textContent = state.window_right.location;
            fetchWeather(state.window_right.location, "temp-right", "weather-gif-right", "window-right");
        }
    }
});

// Left window
document.getElementById("location-btn-left").addEventListener("click", () => {
    document.getElementById("location-input-left").classList.remove("hidden");
    document.getElementById("location-input-left").focus();
});

document.getElementById("location-input-left").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        const city = e.target.value.trim();
        if (city) {
            await setDoc(docRef, { window_left: { location: city } }, { merge: true });
            e.target.value = "";
            e.target.classList.add("hidden");
        }
    }
});

// Right window
document.getElementById("location-btn-right").addEventListener("click", () => {
    document.getElementById("location-input-right").classList.remove("hidden");
    document.getElementById("location-input-right").focus();
});

document.getElementById("location-input-right").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        const city = e.target.value.trim();
        if (city) {
            await setDoc(docRef, { window_right: { location: city } }, { merge: true });
            e.target.value = "";
            e.target.classList.add("hidden");
        }
    }
});


//testing functions:
// testRead();

//testing functions
// testWrite();