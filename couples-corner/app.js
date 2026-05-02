// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

testRead();

// CALL THE FUNCTION
testWrite();