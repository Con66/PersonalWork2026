// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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



// Initialize Firebase

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const WEATHER_API_KEY = "d47c5d80f0a52e814ae14977826b50d6"

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
pictureBtn.addEventListener("click", async () => {
    console.log("Picture pressed!")
})

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
        console.log("UTC Now:", utcNow);
        console.log("Local Time:", localTime);
        console.log("Sunrise:", sunrise);
        console.log("Sunset:", sunset);
        console.log("Is Night:", isNight);
        console.log("Condition:", data.weather[0].main);

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