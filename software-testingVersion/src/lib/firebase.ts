/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if we have a valid configuration (e.g. apiKey exists and is not empty or "undefined")
const isValidConfig = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'undefined' && 
  firebaseConfig.apiKey.trim() !== ''
);

let app: any = null;
let auth: any = null;
let fireStore: any = null;

if (isValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    fireStore = getFirestore(app);

    // Enable offline persistence
    enableIndexedDbPersistence(fireStore).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled
        // in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported');
      }
    });
  } catch (err) {
    console.error('Failed to initialize Firebase services:', err);
  }
} else {
  console.warn('Firebase configuration is missing or invalid. Running in offline/local-only mode.');
}

export { auth, fireStore };
