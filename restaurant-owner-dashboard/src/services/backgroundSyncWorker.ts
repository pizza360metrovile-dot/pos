/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/db';
import { fireStore } from '../lib/firebase';
import { useStore } from '../store/useStore';

const SYNC_INTERVAL = 60000; // 60 seconds
let syncInProgress = false;

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

export async function startBackgroundSync() {
  console.log('🔄 Background sync worker started (60 sec interval)');
  
  // Run sync immediately on start
  await performSync();
  
  // Then run every 60 seconds
  setInterval(() => {
    performSync();
  }, SYNC_INTERVAL);
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
      await state.init();
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
  
  const tables = [
    'settings', 'categories', 'menuItems', 'orders', 'orderItems',
    'ingredients', 'recipes', 'recipeItems', 'stockLog', 'kotSnapshots',
    'modifierGroups', 'modifierOptions', 'orderItemModifiers', 'dealItems',
    'dealOrderComponents', 'expenses', 'expenseCategories', 'cashiers'
  ];
  
  let totalPushed = 0;
  
  for (const tableName of tables) {
    try {
      // Get all unsynced records in this table
      const unsynced = await (db as any)[tableName]
        .where('isSynced')
        .equals(0)
        .toArray();
      
      if (unsynced.length > 0) {
        console.log(`  ${tableName}: ${unsynced.length} unsynced records to push`);
      }
      
      for (const record of unsynced) {
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
        } catch (err) {
          console.warn(`Failed to push ${tableName}/${record.id}:`, err);
        }
      }
    } catch (err) {
      console.warn(`Failed to query unsynced records for ${tableName}:`, err);
    }
  }
  
  if (totalPushed > 0) {
    console.log(`📤 Pushed ${totalPushed} records to Firestore`);
  }
}

async function pullRemoteChanges(restaurantId: string): Promise<boolean> {
  console.log('📥 Pulling remote changes from Firestore...');
  
  const tables = [
    'settings', 'categories', 'menuItems', 'orders', 'orderItems',
    'ingredients', 'recipes', 'recipeItems', 'stockLog', 'kotSnapshots',
    'modifierGroups', 'modifierOptions', 'orderItemModifiers', 'dealItems',
    'dealOrderComponents', 'expenses', 'expenseCategories', 'cashiers'
  ];
  
  const lastSync = getLastSyncTimestamp();
  
  let totalPulled = 0;
  let syncFailed = false;
  const syncStartTime = Date.now();
  
  for (const tableName of tables) {
    try {
      const q = lastSync > 0
        ? query(
            collection(fireStore, 'restaurants', restaurantId, tableName),
            where('updatedAt', '>', lastSync),
            limit(100)
          )
        : query(
            collection(fireStore, 'restaurants', restaurantId, tableName),
            limit(100)
          );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.log(`  📥 ${tableName}: ${snapshot.size} remote changes`);
        
        await db.transaction('rw', [(db as any)[tableName]], async (tx) => {
          (tx as any).fromFirestore = true;
          
          for (const docObj of snapshot.docs) {
            const remoteData = docObj.data();
            const docId = parseId(docObj.id);
            
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
      }
    } catch (err) {
      console.warn(`Failed to pull from ${tableName}:`, err);
      syncFailed = true;
    }
  }
  
  // Persist lastSyncTimestamp to localStorage ONLY AFTER fully successful sync completes
  if (!syncFailed) {
    setLastSyncTimestamp(syncStartTime);
  } else {
    console.warn('⚠️ Some tables failed to sync. lastSyncTimestamp was NOT updated.');
  }
  
  if (totalPulled > 0) {
    console.log(`📥 Pulled ${totalPulled} records from Firestore`);
    return true;
  }
  
  return false;
}
