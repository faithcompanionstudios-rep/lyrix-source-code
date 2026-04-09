import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAGcC_oF9aLuK_ofHuE7I3wEafBs5ckfbo", // Fallback for existing build, but user should move to .env
    authDomain: "church-lyrics-viewer.firebaseapp.com",
    projectId: "church-lyrics-viewer",
    storageBucket: "church-lyrics-viewer.firebasestorage.app",
    messagingSenderId: "134711184790",
    appId: "1:134711184790:web:7889e6330bc459f00a21b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with default settings (React Native handles persistence differently usually, but standard init works for many cases in newer SDKs, 
// OR we let it default. For offline, we just need initializeFirestore)
const db = getFirestore(app);
const auth = getAuth(app);
export { db, auth };
