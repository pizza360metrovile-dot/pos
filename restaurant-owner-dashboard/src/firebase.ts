import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Get configuration from VITE_ environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if we have at least apiKey and projectId to initialize firebase
const isValidConfig = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.apiKey.trim() !== ""
);

let app;
let db: any = null;
let isDemoMode = true;

// Force isDemoMode = false if projectId is actively matching our environment keys, cutting off local mock generation rules entirely
if (firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" && firebaseConfig.projectId.trim() !== "") {
  isDemoMode = false;
}

if (isValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase initialized successfully in Production Mode using project: " + firebaseConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // Even if there is an initialization issue, do not set isDemoMode to true if keys are active
  }
} else {
  console.log("No valid Firebase configuration found or placeholder detected. Running in Demo Mode (Local state with real-time simulator).");
  isDemoMode = true;
}

export { db, isDemoMode };
export const DEFAULT_RESTAURANT_ID = import.meta.env.VITE_REST_ID || "operator-1";

