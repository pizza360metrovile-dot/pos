import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const metaEnv = (import.meta as any).env || {};

// Get optional configuration from VITE_ environment variables
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: metaEnv.VITE_FIREBASE_APP_ID,
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

if (isValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    isDemoMode = false;
    console.log("Firebase initialized successfully in Production Mode using project: " + firebaseConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization failed, falling back to Demo Mode:", error);
    isDemoMode = true;
  }
} else {
  console.log("No valid Firebase configuration found or placeholder detected. Running in Demo Mode (Local state with real-time simulator).");
  isDemoMode = true;
}

export { db, isDemoMode };
export const DEFAULT_RESTAURANT_ID = metaEnv.VITE_REST_ID || "pizza-metro-360";

