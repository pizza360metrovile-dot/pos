/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, onSnapshot } from 'firebase/firestore';
import { fireStore } from '../lib/firebase';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';

const unsubs: (() => void)[] = [];

function parseId(idStr: string): number | string {
  const num = Number(idStr);
  if (!Number.isNaN(num) && idStr.trim() !== '') {
    return num;
  }
  return idStr;
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

export function stopAllListeners() {
  console.log(`Stopping all active Firestore snapshot listeners (${unsubs.length} active)...`);
  unsubs.forEach(unsub => {
    try {
      unsub();
    } catch (e) {
      console.warn('Failed to stop listener:', e);
    }
  });
  unsubs.length = 0;
}

export async function initAllListeners(uid: string) {
  if (!fireStore) {
    console.warn('Firestore is not configured. Skipping listener initialization.');
    return;
  }

  // Clear existing active listeners to avoid duplicates
  stopAllListeners();

  console.log(`Initializing all real-time Firestore listeners for UID: ${uid}...`);

  const collectionsToSync = [
    { name: 'orders', table: db.orders },
    { name: 'orderItems', table: db.orderItems },
    { name: 'orderItemModifiers', table: db.orderItemModifiers },
    { name: 'dealOrderComponents', table: db.dealOrderComponents },
    { name: 'kotSnapshots', table: db.kotSnapshots },
    { name: 'menuItems', table: db.menuItems },
    { name: 'categories', table: db.categories },
    { name: 'modifierGroups', table: db.modifierGroups },
    { name: 'modifierOptions', table: db.modifierOptions },
    { name: 'dealItems', table: db.dealItems },
    { name: 'ingredients', table: db.ingredients },
    { name: 'recipes', table: db.recipes },
    { name: 'recipeItems', table: db.recipeItems },
    { name: 'stockLog', table: db.stockLog },
    { name: 'settings', table: db.settings },
    { name: 'expenses', table: db.expenses },
    { name: 'expenseCategories', table: db.expenseCategories }
  ];

  collectionsToSync.forEach(col => {
    const unsub = onSnapshot(
      collection(fireStore, `restaurants/${uid}/${col.name}`),
      async (snapshot) => {
        try {
          await db.transaction('rw', [col.table], async (tx: any) => {
            tx.fromFirestore = true;
            for (const change of snapshot.docChanges()) {
              const docId = parseId(change.doc.id);
              const data = change.doc.data();

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

    unsubs.push(unsub);
  });
}
