// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; 

// Your web app's Firebase configuration
// (Replace these placeholder values with your actual config from the Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyAYvCc77YYch8iYjXUyAE2pp6H3k5UXuVQ",
  authDomain: "timetablepro-e6695.firebaseapp.com",
  projectId: "timetablepro-e6695",
  storageBucket: "timetablepro-e6695.firebasestorage.app",
  messagingSenderId: "509396899611",
  appId: "1:509396899611:web:1e8978c8a1b88d8209a5be"
};

// Initialize the core Firebase App
const app = initializeApp(firebaseConfig);

// Initialize specific Firebase products and export them for use in your project
export const auth = getAuth(app);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app);




