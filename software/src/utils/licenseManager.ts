/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../lib/db';
import { fireStore } from '../lib/firebase';
import { doc, getDocFromServer, updateDoc, serverTimestamp } from 'firebase/firestore';
import { validateLicenseKey, generateChecksum } from './validateKey';
import { SECRET_SALT } from '../constants/license';

export interface LocalLicenseInfo {
  keyId: string;
  restaurantId: string;
  expiresAt: number;
  isActive: boolean;
  deviceId: string;
  lastValidatedAt: number;
  checksum: string;
}

/**
 * Gets or creates a high-entropy device ID stored in localStorage.
 */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('rms_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('rms_device_id', id);
  }
  return id;
}

/**
 * Loads and validates local license info from Dexie appMeta table.
 * If data is corrupted, checksum fails, or misses vital fields, returns null.
 */
export async function loadLocalLicense(): Promise<LocalLicenseInfo | null> {
  try {
    const records = await db.appMeta.toArray();
    if (!records || records.length === 0) {
      return null;
    }

    const map = new Map<string, any>();
    records.forEach(r => map.set(r.key, r.value));

    const keyId = map.get('_ki');
    const restaurantId = map.get('_ri');
    const expiresAt = map.get('_xe');
    const isActive = map.get('_ia');
    const deviceId = map.get('_di');
    const lastValidatedAt = map.get('_lv');
    const checksum = map.get('_cs');

    if (!keyId || !restaurantId || expiresAt === undefined || isActive === undefined || !deviceId || lastValidatedAt === undefined || !checksum) {
      return null;
    }

    // Verify license checksum to detect local Dexie tampering
    const expectedChecksum = generateChecksum(keyId, expiresAt, deviceId);
    if (expectedChecksum !== checksum) {
      console.warn("License checksum mismatch. Local tamper detected! Clearing license.");
      await clearLocalLicense();
      return null;
    }

    return {
      keyId,
      restaurantId,
      expiresAt: Number(expiresAt),
      isActive: Boolean(isActive),
      deviceId,
      lastValidatedAt: Number(lastValidatedAt),
      checksum
    };
  } catch (err) {
    console.error("Failed to load local license:", err);
    return null;
  }
}

/**
 * Saves license information to Dexie. Generates standard checksum.
 */
export async function saveLocalLicense(
  keyId: string,
  restaurantId: string,
  expiresAt: number,
  isActive: boolean,
  deviceId: string,
  lastValidatedAt: number
): Promise<LocalLicenseInfo> {
  const checksum = generateChecksum(keyId, expiresAt, deviceId);

  await db.transaction('rw', db.appMeta, async () => {
    await db.appMeta.put({ key: '_ki', value: keyId });
    await db.appMeta.put({ key: '_ri', value: restaurantId });
    await db.appMeta.put({ key: '_xe', value: expiresAt });
    await db.appMeta.put({ key: '_ia', value: isActive });
    await db.appMeta.put({ key: '_di', value: deviceId });
    await db.appMeta.put({ key: '_lv', value: lastValidatedAt });
    await db.appMeta.put({ key: '_cs', value: checksum });
  });

  return {
    keyId,
    restaurantId,
    expiresAt,
    isActive,
    deviceId,
    lastValidatedAt,
    checksum
  };
}

/**
 * Fully removes license records from Dexie.
 */
export async function clearLocalLicense(): Promise<void> {
  try {
    await db.appMeta.clear();
  } catch (err) {
    console.error("Failed to clear local license:", err);
  }
}

export interface ActivationResult {
  success: boolean;
  reason?: string;
  expiresAt?: number;
}

/**
 * Validates, records, and activates a raw license key both locally and online against Firestore.
 */
export async function activateLicenseKey(rawKey: string): Promise<ActivationResult> {
  try {
    const deviceId = getOrCreateDeviceId();

    // 1. Local validation (crypto check & fields check)
    const localVal = await validateLicenseKey(rawKey);
    if (localVal.valid === false) {
      return { success: false, reason: localVal.reason };
    }

    const { keyId, restaurantId, expiresAt } = localVal.payload;

    // 2. Online verification (Single Use Enforcement)
    if (!fireStore) {
      return { success: false, reason: "Internet required for first-time license activation" };
    }

    let docSnap: any;
    try {
      docSnap = await getDocFromServer(doc(fireStore, 'licenseKeys', keyId));
    } catch (err) {
      console.error("Failed to fetch license key from Firestore:", err);
      return { success: false, reason: "Internet required for first-time license activation" };
    }

    if (!docSnap.exists()) {
      return { success: false, reason: "Invalid license key" };
    }

    const data = docSnap.data();

    // Handle single-use rules
    if (data.isUsed === true) {
      if (data.usedByDeviceId !== deviceId) {
        return { success: false, reason: "This license key has already been used on another device" };
      } else {
        // Re-activation on same device (e.g., app reinstalled)
        // Allow it and update lastValidatedAt locally and online
        try {
          await updateDoc(doc(fireStore, 'licenseKeys', keyId), {
            lastValidatedAt: Date.now()
          });
        } catch (e) {
          // Rule might allow or catch, ignore if minor
        }
      }
    } else {
      // License key is fresh and unused -> Activate it!
      try {
        await updateDoc(doc(fireStore, 'licenseKeys', keyId), {
          isUsed: true,
          usedAt: serverTimestamp(),
          usedByDeviceId: deviceId,
          lastValidatedAt: Date.now()
        });
      } catch (err) {
        console.error("Failed to write activation status to Firestore:", err);
        return { success: false, reason: "Failed to secure license registration on internet." };
      }
    }

    // 3. Persist locally to Dexie appMeta
    await saveLocalLicense(
      keyId,
      restaurantId,
      expiresAt,
      true,
      deviceId,
      Date.now()
    );

    return { success: true, expiresAt };
  } catch (err) {
    console.error("Activation process crashed:", err);
    return { success: false, reason: err instanceof Error ? err.message : "Activation error" };
  }
}
