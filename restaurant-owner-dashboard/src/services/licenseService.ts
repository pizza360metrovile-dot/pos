/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../lib/db';
import { fireStore } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { LicenseData } from '../utils/licenseValidator';

export const SECRET_SALT = "78R4JHGFpizza360metrovileEWIUH34@12<D>";

export interface SubscriptionSettings {
  expiryDate: number; // millisecond timestamp
}

/**
 * Returns the unique registered name/ID of the POS.
 */
export async function getRestaurantId(): Promise<string> {
  const settingsEntry = await db.settings.where({ key: 'main' }).first();
  const name = settingsEntry?.value?.name || 'LUX BISTRO';
  // Standardize alphanumeric POS registry name/ID representation
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'lux-bistro';
}

/**
 * Helper to generate SHA-256 hash
 */
export async function hashSHA256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Decode and crypto-validate the Base64 input string.
 * Format is either timestamp:signature or JSON format
 */
export async function validateKey(inputKey: string): Promise<{ timestamp: string; signature: string }> {
  if (!inputKey || !inputKey.trim()) {
    throw new Error("License key cannot be empty");
  }

  let timestamp = '';
  let signature = '';

  try {
    const decoded = atob(inputKey.trim());
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const parsed = JSON.parse(decoded);
      timestamp = String(parsed.timestamp || '');
      signature = parsed.signature || '';
    } else {
      const parts = decoded.includes(':') ? decoded.split(':') : decoded.split('|').filter(Boolean);
      if (parts.length >= 2) {
        timestamp = parts[0];
        signature = parts[1];
      } else {
        throw new Error();
      }
    }
  } catch (e) {
    throw new Error("Invalid Key format (must be Base64-encoded)");
  }

  if (!timestamp || !signature) {
    throw new Error("Invalid key structure (missing timestamp or signature)");
  }

  const restaurantId = await getRestaurantId();
  const expectedMessage = restaurantId + timestamp + SECRET_SALT;
  const expectedHash = await hashSHA256(expectedMessage);

  if (expectedHash !== signature) {
    throw new Error("Invalid License Key for this POS");
  }

  return { timestamp, signature };
}

/**
 * Get the current local subscription settings, defaulting to no trial.
 */
export async function getLocalSubscription(): Promise<SubscriptionSettings> {
  const entry = await db.settings.where({ key: 'subscriptionSettings' }).first();
  if (entry && entry.value) {
    return {
      expiryDate: Number((entry.value as any).expiryDate || 0)
    };
  }
  // Default first-run setup: No free trial. Initialize as unactivated (0 expiry date)
  const newSub = { expiryDate: 0 };
  await db.settings.put({ key: 'subscriptionSettings', value: newSub });
  return newSub;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const diEntry = await db.table('appMeta').get('_di');
  if (diEntry && diEntry.value) {
    return diEntry.value;
  }
  const newDeviceId = 'device-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await db.table('appMeta').put({ key: '_di', value: newDeviceId });
  return newDeviceId;
}

export async function computeChecksum(keyId: string, expiresAt: number, deviceId: string): Promise<string> {
  const message = `${keyId}:${expiresAt}:${deviceId}:${SECRET_SALT}`;
  return hashSHA256(message);
}

/**
 * Offline-first Activation: Validate, check IndexedDB, extend subscription, queue sync payload
 */
export async function activateLicenseKey(inputKey: string): Promise<SubscriptionSettings> {
  // 1. Validate cryptographic license parameters
  const { timestamp, signature } = await validateKey(inputKey);

  // 2. Query IndexedDB for existing signature reuse
  const alreadyUsed = await db.used_keys.get(signature);
  if (alreadyUsed) {
    throw new Error("Key already used");
  }

  // 3. Mark signature and timestamp inside used_keys locally
  await db.used_keys.add({ signature, timestamp });

  // 4. Update local subscriptionSettings: Stack 180 days to expiry
  const currentSub = await getLocalSubscription();
  const currentExpiry = currentSub.expiryDate;
  
  // Stacking logic: if already expired, start from current date
  const baseDate = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = baseDate + 180 * 24 * 60 * 60 * 1000;

  const updatedSub = { expiryDate: newExpiry };
  await db.settings.put({ key: 'subscriptionSettings', value: updatedSub });

  // Save to appMeta table
  const keyId = signature;
  const expiresAt = newExpiry;
  const deviceId = await getOrCreateDeviceId();
  const checksum = await computeChecksum(keyId, expiresAt, deviceId);

  await db.table('appMeta').put({
    key: '_ki', value: keyId });
  await db.table('appMeta').put({
    key: '_xe', value: Number(expiresAt) });
  await db.table('appMeta').put({
    key: '_di', value: deviceId });
  await db.table('appMeta').put({
    key: '_ia', value: true });
  await db.table('appMeta').put({
    key: '_cs', value: checksum });
  await db.table('appMeta').put({
    key: '_lv', value: Date.now() });

  console.log('License saved:', await db.table('appMeta').toArray());

  // 5. Query and push payload metadata into Dexie background Sync Queue
  await db.sync_queue.add({
    signature,
    timestamp,
    synced: 0
  });

  // 6. Trigger background syncing right away if connected online
  if (navigator.onLine) {
    triggerBackgroundSync().catch(err => console.warn('Sync failed:', err));
  }

  return updatedSub;
}

/**
 * Sync background offline-generated transactions back to Firebase Firestore
 */
export async function triggerBackgroundSync(): Promise<void> {
  if (!fireStore) {
    console.warn("Firebase Firestore not initialized. Sync ignored.");
    return;
  }
  if (!navigator.onLine) {
    console.log("App is offline. Sync queue postponed.");
    return;
  }

  const unsyncedItems = await db.sync_queue.where({ synced: 0 }).toArray();
  if (unsyncedItems.length === 0) {
    return;
  }

  console.log(`Syncing ${unsyncedItems.length} unsynced licenses to Firestore...`);
  const restaurantId = await getRestaurantId();
  const sub = await getLocalSubscription();

  for (const item of unsyncedItems) {
    try {
      // Create firestore documents
      const usedKeyRef = doc(fireStore, 'used_license_keys', item.signature);
      await setDoc(usedKeyRef, {
        signature: item.signature,
        timestamp: item.timestamp,
        restaurantId: restaurantId,
        syncedAt: Date.now()
      });

      // Update local storage status
      await db.sync_queue.update(item.id!, { synced: 1 });
      console.log(`Synced license signature: ${item.signature}`);
    } catch (err) {
      console.error(`Error syncing license ${item.signature}:`, err);
      break;
    }
  }

  // Update central subscriptionSettings
  try {
    const subRef = doc(fireStore, 'subscriptionSettings', restaurantId);
    await setDoc(subRef, {
      restaurantId: restaurantId,
      expiryDate: sub.expiryDate,
      updatedAt: Date.now()
    });
    console.log(`Synced subscription status on Firestore for restaurant: ${restaurantId}`);
  } catch (err) {
    console.error('Error syncing subscription status to Firestore:', err);
  }
}

/**
 * Generates an authentic testing key of the form btoa(timestamp:signature)
 */
export async function generateTestingKey(restaurantId: string, timestamp: number): Promise<string> {
  const expectedMessage = restaurantId + String(timestamp) + SECRET_SALT;
  const signature = await hashSHA256(expectedMessage);
  return btoa(`${timestamp}:${signature}`);
}

const uid = 'operator-1'; // Or get from auth

/**
 * Fetch license data from Firebase
 */
export async function fetchLicenseFromFirebase(): Promise<LicenseData | null> {
  try {
    if (!fireStore) {
      console.warn('Firestore is not initialized. Cannot fetch license.');
      return null;
    }
    const restaurantDoc = doc(fireStore, 'restaurants', uid);
    const docSnap = await getDoc(restaurantDoc);
    
    if (docSnap.exists() && docSnap.data().license) {
      return docSnap.data().license as LicenseData;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch license from Firebase:', error);
    return null;
  }
}

/**
 * Save license to Firebase
 */
export async function saveLicenseToFirebase(
  license: LicenseData
): Promise<boolean> {
  try {
    if (!fireStore) {
      console.warn('Firestore is not initialized. Cannot save license.');
      return false;
    }
    const restaurantDoc = doc(fireStore, 'restaurants', uid);
    
    const docSnap = await getDoc(restaurantDoc);
    if (!docSnap.exists()) {
      await setDoc(restaurantDoc, {
        license: license,
        licenseUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(restaurantDoc, {
        license: license,
        licenseUpdatedAt: serverTimestamp(),
      });
    }
    
    console.log('License saved to Firebase:', license.licenseKey);
    return true;
  } catch (error) {
    console.error('Failed to save license to Firebase:', error);
    return false;
  }
}

/**
 * Check if device has valid license
 */
export async function checkDeviceLicense(): Promise<{
  isValid: boolean
  license?: LicenseData
  message: string
}> {
  try {
    // Fetch from Firebase
    const firebaseLicense = await fetchLicenseFromFirebase();
    
    if (!firebaseLicense) {
      return {
        isValid: false,
        message: 'No license found. Please enter license key.'
      };
    }
    
    // Check expiration
    const isExpired = Date.now() > firebaseLicense.validUntil;
    
    if (isExpired) {
      return {
        isValid: false,
        message: 'License expired. Please renew.'
      };
    }
    
    // License valid
    return {
      isValid: true,
      license: firebaseLicense,
      message: 'License valid'
    };
  } catch (error) {
    console.error('License check failed:', error);
    return {
      isValid: false,
      message: 'License verification failed'
    };
  }
}
