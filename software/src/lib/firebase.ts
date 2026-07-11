/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  enableNetwork, 
  disableNetwork 
} from 'firebase/firestore';

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

export async function safeEnableNetwork() {
  if (!fireStore) return;
  if ((fireStore as any)._terminated) {
    console.warn('Firestore instance is terminated. Cannot enable network.');
    return;
  }
  try {
    await enableNetwork(fireStore);
    console.log('Firestore network connection enabled successfully.');
  } catch (err: any) {
    console.warn("Forcing network reset due to stream lock:", err);
    try {
      await disableNetwork(fireStore);
      await enableNetwork(fireStore);
      console.log('Firestore network connection force-reset and enabled successfully.');
    } catch (resetErr: any) {
      console.error('Critical failure during network reset retry:', resetErr);
    }
  }
}

export async function safeDisableNetwork() {
  if (!fireStore) return;
  if ((fireStore as any)._terminated) {
    console.warn('Firestore instance is terminated. Cannot disable network.');
    return;
  }
  try {
    await disableNetwork(fireStore);
    console.log('Firestore network connection disabled successfully.');
  } catch (err: any) {
    console.warn('Failed to disable Firestore network safely:', err.message || err);
  }
}

if (isValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Fix Firestore Multi-Tab Sync Crash (Assertion Failed) using the modern cache framework
    fireStore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

    console.log('Firestore initialized with modern persistentLocalCache & persistentMultipleTabManager.');

  } catch (err) {
    console.error('Failed to initialize Firebase services:', err);
  }
} else {
  console.warn('Firebase configuration is missing or invalid. Running in offline/local-only mode.');
}

export async function reconnectFirestore() {
  await safeEnableNetwork();
}

export { auth, fireStore };
