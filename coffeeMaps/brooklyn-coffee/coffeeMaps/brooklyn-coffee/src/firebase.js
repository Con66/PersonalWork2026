import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCOwdEok4vm6cOFhi14nUp9XP87NJ7LDn4",
  authDomain: "coffeerater-7acde.firebaseapp.com",
  projectId: "coffeerater-7acde",
  storageBucket: "coffeerater-7acde.firebasestorage.app",
  messagingSenderId: "375806681303",
  appId: "1:375806681303:web:199ad86d5f79cadc515092",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);