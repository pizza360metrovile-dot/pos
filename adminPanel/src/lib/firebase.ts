import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ⚠️ Replace these placeholders with your actual Firebase web config
// (Firebase Console → Project Settings → Your apps → Web app).
// This must point to the SAME Firebase project as your POS app.
const firebaseConfig: FirebaseOptions = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE.firebaseapp.com",
  projectId: "REPLACE_PROJECT_ID",
  storageBucket: "REPLACE.appspot.com",
  messagingSenderId: "REPLACE_SENDER_ID",
  appId: "REPLACE_APP_ID",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
