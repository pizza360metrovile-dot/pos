/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { fireStore } from '../lib/firebase';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { isTabVisible } from '../config/tabVisibility';

const activeListeners = new Map<string, () => void>();

export function registerListener(
  id: string,
  unsubscribe: () => void
): void {
  // Stop old listener if exists
  if (activeListeners.has(id)) {
    console.warn(`Listener ${id} already active, unsubscribing old one`);
    activeListeners.get(id)?.();
  }
  
  // Register new listener
  activeListeners.set(id, unsubscribe);
  console.log(`Registered listener: ${id} (total active: ${activeListeners.size})`);
}

export function unregisterListener(id: string): void {
  const unsubscribe = activeListeners.get(id);
  if (unsubscribe) {
    unsubscribe();
    activeListeners.delete(id);
    console.log(`Unregistered listener: ${id} (total active: ${activeListeners.size})`);
  }
}

export function stopAllListeners(): void {
  console.log(`Stopping ${activeListeners.size} active listeners...`);
  activeListeners.forEach((unsubscribe, id) => {
    try {
      unsubscribe();
      console.log(`Stopped: ${id}`);
    } catch (err) {
      console.error(`Error stopping listener ${id}:`, err);
    }
  });
  activeListeners.clear();
  console.log('All listeners stopped');
}

export function getActiveListenerCount(): number {
  return activeListeners.size;
}

export function logActiveListeners(): void {
  console.log('=== ACTIVE FIRESTORE LISTENERS ===');
  activeListeners.forEach((_, id) => {
    console.log(`  - ${id}`);
  });
  console.log(`Total: ${activeListeners.size}`);
}

// Global exposure for debugging in console
if (typeof window !== 'undefined') {
  (window as any).registerListener = registerListener;
  (window as any).unregisterListener = unregisterListener;
  (window as any).stopAllListeners = stopAllListeners;
  (window as any).getActiveListenerCount = getActiveListenerCount;
  (window as any).logActiveListeners = logActiveListeners;
}

function parseId(idStr: string): number | string {
  const num = Number(idStr);
  if (!Number.isNaN(num) && idStr.trim() !== '') {
    return num;
  }
  return idStr;
}

export function convertTimestampsToMs(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) {
    return obj.getTime();
  }
  if (typeof obj !== 'object') return obj;
  
  if (typeof obj.seconds === 'number') {
    return obj.seconds * 1000;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestampsToMs(item));
  }
  
  const output: any = {};
  for (const key of Object.keys(obj)) {
    output[key] = convertTimestampsToMs(obj[key]);
  }
  return output;
}

export async function refreshOrdersInStore() {
  const orders = await db.orders.orderBy('createdAt').reverse().toArray();
  useStore.setState({ orders, lastSynced: Date.now() });
}

export async function refreshMenuInStore() {
  const menuItems = await db.menuItems.toArray();
  const categories = await db.categories.toArray();
  useStore.setState({ menuItems, categories, lastSynced: Date.now() });
}

export async function refreshExpensesInStore() {
  const expenses = await db.expenses.orderBy('date').reverse().toArray();
  const expenseCategories = await db.expenseCategories.toArray();
  useStore.setState({ expenses, expenseCategories, lastSynced: Date.now() });
}

export async function refreshInventoryInStore() {
  const ingredients = await db.ingredients.toArray();
  const recipes = await db.recipes.toArray();
  const recipeItems = await db.recipeItems.toArray();
  const stockLogs = await db.stockLog.orderBy('createdAt').reverse().toArray();
  useStore.setState({ ingredients, recipes, recipeItems, stockLogs, lastSynced: Date.now() });
}

export async function refreshModifiersInStore() {
  const modifierGroups = await db.modifierGroups.toArray();
  const modifierOptions = await db.modifierOptions.toArray();
  useStore.setState({ modifierGroups, modifierOptions, lastSynced: Date.now() });
}

export async function refreshDealsInStore() {
  const dealItems = await db.dealItems.toArray();
  const dealOrderComponents = await db.dealOrderComponents.toArray();
  useStore.setState({ dealItems, dealOrderComponents, lastSynced: Date.now() });
}

export async function refreshKotSnapshotsInStore() {
  const kotSnapshots = await db.kotSnapshots.toArray();
  useStore.setState({ kotSnapshots, lastSynced: Date.now() });
}

export async function refreshSettingsInStore() {
  const settingEntry = await db.settings.where({ key: 'main' }).first();
  if (settingEntry && settingEntry.value) {
    const currentSettings = useStore.getState().settings;
    useStore.setState({
      settings: { ...currentSettings, ...settingEntry.value },
      lastSynced: Date.now()
    });
  }
}

const refreshMapping: Record<string, () => Promise<void>> = {
  orders: refreshOrdersInStore,
  orderItems: async () => {},
  orderItemModifiers: async () => {},
  dealOrderComponents: refreshDealsInStore,
  kotSnapshots: refreshKotSnapshotsInStore,
  menuItems: refreshMenuInStore,
  categories: refreshMenuInStore,
  modifierGroups: refreshModifiersInStore,
  modifierOptions: refreshModifiersInStore,
  dealItems: refreshDealsInStore,
  ingredients: refreshInventoryInStore,
  recipes: refreshInventoryInStore,
  recipeItems: refreshInventoryInStore,
  stockLog: refreshInventoryInStore,
  settings: refreshSettingsInStore,
  expenses: refreshExpensesInStore,
  expenseCategories: refreshExpensesInStore,
};

function getActiveRoute(): string {
  if (typeof window === 'undefined') return 'pos';
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'pos';
  if (path.startsWith('/menu')) return 'menu';
  if (path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/records')) return 'records';
  if (path.startsWith('/performance')) return 'performance';
  if (path.startsWith('/expenses')) return 'expenses';
  if (path.startsWith('/settings')) return 'settings';
  return 'pos';
}

async function performOneTimeFetch(uid: string, col: { name: string; table: any }) {
  if (!fireStore) return;
  try {
    console.log(`Performing one-time fetch for collection: ${col.name}...`);
    const querySnap = await getDocs(
      collection(fireStore, `restaurants/${uid}/${col.name}`)
    );
    
    await db.transaction('rw', [col.table], async (tx: any) => {
      tx.fromFirestore = true;
      // Clear local table first to ensure consistency with remote (deleted items get removed)
      await col.table.clear();
      
      for (const docObj of querySnap.docs) {
        const docId = parseId(docObj.id);
        const data = convertTimestampsToMs(docObj.data());
        
        if (col.name === 'settings') {
          await db.settings.put({
            id: docId === 'main' ? undefined : (typeof docId === 'number' ? docId : undefined),
            key: data.key || 'main',
            value: data.value
          });
        } else {
          const formattedData = {
            ...data,
            id: docId
          };
          await col.table.put(formattedData as any);
        }
      }
    });

    // Trigger associated store re-hydration
    const callback = refreshMapping[col.name];
    if (callback) {
      await callback();
    }
  } catch (err) {
    console.warn(`One-time fetch failed for ${col.name}:`, err);
  }
}

export async function initAllListeners(uid: string) {
  if (!fireStore) {
    console.warn('Firestore is not configured. Skipping listener initialization.');
    return;
  }

  // Clear existing active listeners to avoid duplicates
  stopAllListeners();

  const activeRoute = getActiveRoute();
  console.log(`Initializing listeners for route: ${activeRoute} for UID: ${uid}...`);

  const collectionsToSync: Array<{ name: string; table: any }> = [];
  const collectionsToOneTimeFetch: Array<{ name: string; table: any }> = [];

  // Core app settings always needed and kept in real-time sync
  collectionsToSync.push({ name: 'settings', table: db.settings });

  // 1. POS Route
  if (activeRoute === 'pos') {
    collectionsToSync.push(
      { name: 'orders', table: db.orders },
      { name: 'orderItems', table: db.orderItems },
      { name: 'orderItemModifiers', table: db.orderItemModifiers },
      { name: 'dealOrderComponents', table: db.dealOrderComponents },
      { name: 'kotSnapshots', table: db.kotSnapshots },
      { name: 'menuItems', table: db.menuItems },
      { name: 'categories', table: db.categories },
      { name: 'modifierGroups', table: db.modifierGroups },
      { name: 'modifierOptions', table: db.modifierOptions },
      { name: 'dealItems', table: db.dealItems }
    );
  }
  // 2. Menu Route
  else if (activeRoute === 'menu') {
    collectionsToSync.push(
      { name: 'menuItems', table: db.menuItems },
      { name: 'categories', table: db.categories },
      { name: 'modifierGroups', table: db.modifierGroups },
      { name: 'modifierOptions', table: db.modifierOptions },
      { name: 'dealItems', table: db.dealItems }
    );
  }
  // 3. Records / Performance Routes (one-time fetch)
  else if (activeRoute === 'records' || activeRoute === 'performance') {
    collectionsToOneTimeFetch.push(
      { name: 'orders', table: db.orders },
      { name: 'orderItems', table: db.orderItems },
      { name: 'orderItemModifiers', table: db.orderItemModifiers },
      { name: 'dealOrderComponents', table: db.dealOrderComponents },
      { name: 'kotSnapshots', table: db.kotSnapshots }
    );
  }
  // 4. Inventory Route (one-time fetch)
  else if (activeRoute === 'inventory') {
    collectionsToOneTimeFetch.push(
      { name: 'ingredients', table: db.ingredients },
      { name: 'recipes', table: db.recipes },
      { name: 'recipeItems', table: db.recipeItems },
      { name: 'stockLog', table: db.stockLog }
    );
  }
  // 5. Expenses Route (one-time fetch)
  else if (activeRoute === 'expenses') {
    collectionsToOneTimeFetch.push(
      { name: 'expenses', table: db.expenses },
      { name: 'expenseCategories', table: db.expenseCategories }
    );
  }

  // Set up active snapshot listeners
  collectionsToSync.forEach(col => {
    const unsub = onSnapshot(
      collection(fireStore, `restaurants/${uid}/${col.name}`),
      async (snapshot) => {
        try {
          await db.transaction('rw', [col.table], async (tx: any) => {
            tx.fromFirestore = true;
            for (const change of snapshot.docChanges()) {
              const docId = parseId(change.doc.id);
              const data = convertTimestampsToMs(change.doc.data());

              if (change.type === 'added' || change.type === 'modified') {
                if (col.name === 'settings') {
                  await db.settings.put({
                    id: docId === 'main' ? undefined : (typeof docId === 'number' ? docId : undefined),
                    key: data.key || 'main',
                    value: data.value
                  });
                } else {
                  const formattedData = {
                    ...data,
                    id: docId
                  };
                  await col.table.put(formattedData as any);
                }
              } else if (change.type === 'removed') {
                await col.table.delete(docId as any);
              }
            }
          });

          // Trigger associated store re-hydration
          const callback = refreshMapping[col.name];
          if (callback) {
            await callback();
          }
        } catch (err) {
          console.warn(`Firestore listener transaction error for ${col.name}:`, err);
        }
      },
      (err: any) => {
        console.warn(`Firestore listener stream error for ${col.name}:`, err);
        if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
          useStore.setState({ isQuotaExceeded: true });
        }
      }
    );

    registerListener(col.name, unsub);
  });

  // Perform one-time fetches in parallel
  collectionsToOneTimeFetch.forEach(col => {
    performOneTimeFetch(uid, col);
  });
}
