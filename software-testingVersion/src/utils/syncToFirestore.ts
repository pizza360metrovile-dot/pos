/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, deleteDoc as fsDeleteDoc, serverTimestamp } from 'firebase/firestore';
import { fireStore } from '../lib/firebase';
import { useStore } from '../store/useStore';

export function isSyncEnabled(): boolean {
  if (!fireStore) return false;
  try {
    const state = useStore.getState();
    return !!state.cloudSync && !!state.user?.uid;
  } catch (err) {
    return false;
  }
}

export function getFirebaseUID(): string {
  const state = useStore.getState();
  const uid = state.user?.uid;
  if (!uid) {
    throw new Error('User not authenticated or UID missing');
  }
  return uid;
}

export async function syncDoc(collection: string, id: number | string, data: any) {
  if (!isSyncEnabled()) return;
  try {
    const uid = getFirebaseUID();
    
    // Sanitize any undefined properties because Firestore doesn't support them
    const sanitizedData = JSON.parse(JSON.stringify(data, (_, val) => {
      if (val === undefined) return null;
      return val;
    }));

    await setDoc(
      doc(fireStore, `restaurants/${uid}/${collection}/${id.toString()}`),
      { ...sanitizedData, _syncedAt: serverTimestamp() },
      { merge: true }
    );
    // Successfully synced, clear quota exceeded flag
    useStore.setState({ isQuotaExceeded: false });
  } catch (err: any) {
    console.warn(`Firestore sync failed for ${collection}/${id}:`, err);
    if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
      useStore.setState({ isQuotaExceeded: true });
    }
  }
}

export async function deleteDoc(collection: string, id: number | string) {
  if (!isSyncEnabled()) return;
  try {
    const uid = getFirebaseUID();
    await fsDeleteDoc(
      doc(fireStore, `restaurants/${uid}/${collection}/${id.toString()}`)
    );
    // Successfully deleted, clear quota exceeded flag
    useStore.setState({ isQuotaExceeded: false });
  } catch (err: any) {
    console.warn(`Firestore delete failed for ${collection}/${id}:`, err);
    if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
      useStore.setState({ isQuotaExceeded: true });
    }
  }
}
