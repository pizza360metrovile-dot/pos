/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, getDocs } from 'firebase/firestore';
import { fireStore } from '../lib/firebase';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';

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

async function performOneTimeFetch(uid: string, col: { name: string; table: any }) {
  if (!fireStore) return;
  try {
    console.log(`[One-time sync] Fetching ${col.name} from Firestore...`);
    const querySnap = await getDocs(
      collection(fireStore, `restaurants/${uid}/${col.name}`)
    );
    
    await db.transaction('rw', [col.table], async (tx: any) => {
      tx.fromFirestore = true;
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

    const callback = refreshMapping[col.name];
    if (callback) {
      await callback();
    }
  } catch (err: any) {
    console.warn(`One-time fetch failed for ${col.name}:`, err);
    if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota')) {
      useStore.setState({ isQuotaExceeded: true });
    }
  }
}

export async function syncRouteData(uid: string, path: string) {
  if (!fireStore) {
    console.warn('Firestore is not configured. Skipping route sync.');
    return;
  }

  // Check if offline
  if (useStore.getState().cloudSync === false) {
    console.log('Cloud sync is disabled. Skipping route sync.');
    return;
  }

  // Map path to route keys
  let activeRoute = 'pos';
  if (path === '/' || path === '') activeRoute = 'pos';
  else if (path.startsWith('/menu')) activeRoute = 'menu';
  else if (path.startsWith('/inventory')) activeRoute = 'inventory';
  else if (path.startsWith('/records')) activeRoute = 'records';
  else if (path.startsWith('/performance')) activeRoute = 'performance';
  else if (path.startsWith('/expenses')) activeRoute = 'expenses';
  else if (path.startsWith('/settings')) activeRoute = 'settings';

  console.log(`[One-time sync] Fetching collections for route: ${activeRoute}...`);

  const collectionsToFetch: Array<{ name: string; table: any }> = [];

  // Core app settings always needed
  collectionsToFetch.push({ name: 'settings', table: db.settings });

  if (activeRoute === 'pos') {
    collectionsToFetch.push(
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
  } else if (activeRoute === 'menu') {
    collectionsToFetch.push(
      { name: 'menuItems', table: db.menuItems },
      { name: 'categories', table: db.categories },
      { name: 'modifierGroups', table: db.modifierGroups },
      { name: 'modifierOptions', table: db.modifierOptions },
      { name: 'dealItems', table: db.dealItems }
    );
  } else if (activeRoute === 'records' || activeRoute === 'performance') {
    collectionsToFetch.push(
      { name: 'orders', table: db.orders },
      { name: 'orderItems', table: db.orderItems },
      { name: 'orderItemModifiers', table: db.orderItemModifiers },
      { name: 'dealOrderComponents', table: db.dealOrderComponents },
      { name: 'kotSnapshots', table: db.kotSnapshots }
    );
  } else if (activeRoute === 'inventory') {
    collectionsToFetch.push(
      { name: 'ingredients', table: db.ingredients },
      { name: 'recipes', table: db.recipes },
      { name: 'recipeItems', table: db.recipeItems },
      { name: 'stockLog', table: db.stockLog }
    );
  } else if (activeRoute === 'expenses') {
    collectionsToFetch.push(
      { name: 'expenses', table: db.expenses },
      { name: 'expenseCategories', table: db.expenseCategories }
    );
  }

  // Perform one-time fetches in parallel
  await Promise.all(collectionsToFetch.map(col => performOneTimeFetch(uid, col)));
}
