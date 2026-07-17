/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  query, 
  where, 
  setDoc, 
  doc, 
  limit,
  getDocsFromServer
} from 'firebase/firestore';
import { db } from '../lib/db';
import { fireStore } from '../lib/firebase';
import { useStore } from '../store/useStore';

const SYNC_INTERVAL = 60000; // 60 seconds
let syncInProgress = false;
let syncIntervalId: any = null;

export function isBackgroundSyncInProgress(): boolean {
  return syncInProgress;
}

async function getLastSyncedAtForTable(tableName: string): Promise<number> {
  try {
    const meta = await db.appMeta.get(`lastSyncedAt_${tableName}`);
    return meta ? Number(meta.value) : 0;
  } catch (err) {
    console.warn(`Failed to read lastSyncedAt for ${tableName}:`, err);
    return 0;
  }
}

async function setLastSyncedAtForTable(tableName: string, timestamp: number): Promise<void> {
  try {
    await db.appMeta.put({ key: `lastSyncedAt_${tableName}`, value: timestamp });
  } catch (err) {
    console.error(`Failed to write lastSyncedAt for ${tableName}:`, err);
  }
}

function getLastSyncTimestamp(): number {
  const stored = localStorage.getItem('lastSyncTimestamp');
  return stored ? parseInt(stored, 10) : 0;
}

function setLastSyncTimestamp(timestamp: number): void {
  localStorage.setItem('lastSyncTimestamp', String(timestamp));
}

function parseId(idStr: string): number | string {
  const num = Number(idStr);
  if (!Number.isNaN(num) && idStr.trim() !== '') {
    return num;
  }
  return idStr;
}

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = err.code;
  return (
    code === 'unavailable' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unreachable') ||
    msg.includes('stream') ||
    msg.includes('token') ||
    msg.includes('handshake')
  );
}

export function startBackgroundSync(): () => void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  console.log('🔄 Background sync worker started (60 sec interval)');
  
  // Run sync immediately on start
  performSync().catch(err => console.error('Initial background sync failed:', err));
  
  // Then run every 60 seconds
  syncIntervalId = setInterval(() => {
    performSync().catch(err => console.error('Interval background sync failed:', err));
  }, SYNC_INTERVAL);

  return () => {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
      console.log('🛑 Background sync worker interval cleared');
    }
  };
}

export function stopBackgroundSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('🛑 Background sync worker stopped');
  }
}

export async function performSync() {
  const state = useStore.getState();
  const uid = state.user?.uid;
  if (!uid || !fireStore || state.cloudSync === false) {
    return;
  }

  if (syncInProgress) {
    console.log('⏳ Sync already in progress, skipping this cycle');
    return;
  }
  
  syncInProgress = true;
  
  try {
    // PHASE 1: Push local changes UP to Firestore
    await pushLocalChanges(uid);
    
    // PHASE 2: Pull remote changes DOWN to Dexie
    const hasChanges = await pullRemoteChanges(uid);
    
    // PHASE 3: Re-hydrate state if there were remote changes
    if (hasChanges) {
      console.log('🔄 Remote changes detected, re-hydrating Zustand store...');
      if (typeof state.rehydrateFromDexie === 'function') {
        await state.rehydrateFromDexie();
      } else {
        await state.init();
      }
    }
    
    console.log('✅ Sync cycle completed');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    syncInProgress = false;
  }
}

async function pushLocalChanges(restaurantId: string) {
  console.log('📤 Pushing local changes to Firestore...');

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('🔌 Client is offline, pausing push cycle.');
    return;
  }
  
  const tables = [
    'settings', 'categories', 'menuItems', 'orders', 'orderItems',
    'ingredients', 'recipes', 'recipeItems', 'stockLog', 'kotSnapshots',
    'modifierGroups', 'modifierOptions', 'orderItemModifiers', 'dealItems',
    'dealOrderComponents', 'expenses', 'expenseCategories', 'cashiers'
  ];
  
  let totalPushed = 0;
  
  for (const tableName of tables) {
    let unsynced: any[] = [];
    try {
      // Get all unsynced records in this table (filtering by integer 0)
      unsynced = await (db as any)[tableName]
        .where('isSynced')
        .equals(0)
        .toArray();
    } catch (err) {
      console.warn(`Failed to query unsynced records for ${tableName}:`, err);
      continue;
    }
    
    if (unsynced.length > 0) {
      console.log(`  ${tableName}: ${unsynced.length} unsynced records to push`);
    }
    
    for (const record of unsynced) {
      // Stream health check right before write invocation
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('🔌 Client offline during push, halting push loop.');
        return;
      }

      try {
        const docRef = doc(
          fireStore,
          'restaurants',
          restaurantId,
          tableName,
          record.id.toString()
        );
        
        // Remove undefined or incompatible fields
        const sanitizedRecord = JSON.parse(JSON.stringify(record, (_, val) => {
          if (val === undefined) return null;
          return val;
        }));

        // Mark as synced with updatedAt/isSynced set correctly
        const syncTime = Date.now();
        const recordToPush = {
          ...sanitizedRecord,
          isSynced: 1,
          updatedAt: record.updatedAt || syncTime
        };

        // Invoke the Firestore write
        await setDoc(docRef, recordToPush, { merge: true });
        
        // Mark as synced in local Dexie inside a transaction to bypass Dexie creating/updating hooks
        await db.transaction('rw', [(db as any)[tableName]], async (tx) => {
          (tx as any).fromFirestore = true;
          await (db as any)[tableName].update(record.id, {
            isSynced: 1,
            lastSyncedAt: syncTime
          });
        });
        
        totalPushed++;
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`🔌 Firestore network stream unhealthy, pausing sync push cycle safely: ${err.message || err}`);
          return; // pause current cycle completely
        } else {
          console.warn(`Failed to push ${tableName}/${record.id}:`, err);
        }
      }
    }
  }
  
  if (totalPushed > 0) {
    console.log(`📤 Pushed ${totalPushed} records to Firestore`);
  }
}

async function pullRemoteChanges(restaurantId: string): Promise<boolean> {
  console.log('📥 Pulling remote changes from Firestore...');

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('🔌 Client is offline, pausing pull cycle.');
    return false;
  }
  
  const tables = [
    'settings', 'categories', 'menuItems', 'orders', 'orderItems',
    'ingredients', 'recipes', 'recipeItems', 'stockLog', 'kotSnapshots',
    'modifierGroups', 'modifierOptions', 'orderItemModifiers', 'dealItems',
    'dealOrderComponents', 'expenses', 'expenseCategories', 'cashiers'
  ];
  
  let totalPulled = 0;
  let syncFailed = false;
  const syncStartTime = Date.now();
  
  for (const tableName of tables) {
    try {
      const lastSyncedAt = await getLastSyncedAtForTable(tableName);
      
      const q = query(
        collection(fireStore, 'restaurants', restaurantId, tableName),
        where('updatedAt', '>', lastSyncedAt)
      );
      
      const snapshot = await getDocsFromServer(q);
      
      if (!snapshot.empty) {
        console.log(`  📥 ${tableName}: ${snapshot.size} remote changes`);
        
        let maxUpdatedAt = lastSyncedAt;
        
        await db.transaction('rw', [(db as any)[tableName]], async (tx) => {
          (tx as any).fromFirestore = true;
          
          for (const docObj of snapshot.docs) {
            const remoteData = docObj.data();
            const docId = parseId(docObj.id);
            
            if (remoteData.updatedAt && typeof remoteData.updatedAt === 'number') {
              maxUpdatedAt = Math.max(maxUpdatedAt, remoteData.updatedAt);
            }
            
            // Get local doc
            const localData = await (db as any)[tableName].get(docId);
            
            // Last-Write-Wins: compare timestamps
            if (localData && (remoteData.updatedAt || 0) < (localData.updatedAt || 0)) {
              // Local is newer, skip remote
              continue;
            }
            
            // Remote is newer or no local copy, update
            const formattedData = {
              ...remoteData,
              id: docId,
              isSynced: 1
            };
            await (db as any)[tableName].put(formattedData);
            totalPulled++;
          }
        });

        // Update the local lastSyncedAt metadata tracker to the latest timestamp received
        await setLastSyncedAtForTable(tableName, maxUpdatedAt);
        console.log(`💾 Updated lastSyncedAt for ${tableName}: ${maxUpdatedAt}`);
      } else {
        // If we queried with 0 and got nothing, set lastSyncedAt to current syncStart so we don't fetch everything again
        if (lastSyncedAt === 0) {
          await setLastSyncedAtForTable(tableName, syncStartTime);
          console.log(`💾 Initialized empty table lastSyncedAt for ${tableName}: ${syncStartTime}`);
        }
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn(`🔌 Firestore network stream unhealthy during pull, halting sync pull cycle safely: ${err.message || err}`);
        return false; // pause current cycle completely
      }
      console.warn(`Failed to pull from ${tableName}:`, err);
      syncFailed = true;
    }
  }
  
  // Update global lastSyncTimestamp for compatibility
  if (!syncFailed && totalPulled > 0) {
    setLastSyncTimestamp(syncStartTime);
    console.log(`💾 Persisted lastSyncTimestamp: ${syncStartTime}`);
  } else if (syncFailed) {
    console.warn('⚠️ Some tables failed to sync. lastSyncTimestamp was NOT updated.');
  }
  
  if (totalPulled > 0) {
    console.log(`📥 Pulled ${totalPulled} records from Firestore`);
    return true;
  }
  
  return false;
}
