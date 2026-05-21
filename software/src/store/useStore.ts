/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { db } from '../lib/db';
import { MenuItem, Category, Order, OrderItem, RestaurantSettings, OrderType, Ingredient, Recipe, RecipeItem, StockLog, KotSnapshot, ModifierGroup, ModifierOption, OrderItemModifier } from '../types';
import { toast } from 'sonner';
import { fireStore } from '../lib/firebase';
import { getLocalSubscription, activateLicenseKey, triggerBackgroundSync, SubscriptionSettings } from '../services/licenseService';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query, 
  getDocs, 
  writeBatch,
  Timestamp,
  getDoc
} from 'firebase/firestore';

interface AppUser {
  uid: string;
  email: string;
}

interface StoreState {
  menuItems: MenuItem[];
  categories: Category[];
  orders: Order[];
  settings: RestaurantSettings;
  ingredients: Ingredient[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  stockLogs: StockLog[];
  kotSnapshots: KotSnapshot[];
  modifierGroups: ModifierGroup[];
  modifierOptions: ModifierOption[];
  isLoading: boolean;
  
  // POS State
  cart: OrderItem[];
  orderType: OrderType;
  customerName: string;
  tableNumber: string;
  activeOrder: Order | null;
  
  // Delivery Charge POS State
  deliveryChargeWaived: boolean;
  deliveryChargeWaivedReason: string;
  
  // Auth & Sync State
  user: AppUser | null;
  isOnline: boolean;
  lastSynced: number | null;
  lastAction: number;
  sidebarState: 'expanded' | 'collapsed';
  
  // Licensing State & Actions
  subscription: SubscriptionSettings | null;
  activateLicense: (key: string) => Promise<void>;
  syncLicenses: () => Promise<void>;

  // Actions
  init: () => Promise<void>;
  setSidebarState: (state: 'expanded' | 'collapsed') => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  forceSync: () => Promise<void>;
  setupSync: (uid: string) => Promise<void>;
  syncToFirebase: (collectionName: string, id: string | number, data: any) => Promise<void>;
  
  // Menu Actions
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string | number) => Promise<void>;
  
  // Category Actions
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string | number) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  
  // Order Actions
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string | number) => Promise<void>;
  
  // Settings Actions
  updateSettings: (settings: RestaurantSettings) => Promise<void>;
  
  // Inventory Actions
  addIngredient: (ingredient: Omit<Ingredient, 'id'>) => Promise<void>;
  updateIngredient: (ingredient: Ingredient) => Promise<void>;
  deleteIngredient: (id: number) => Promise<void>;
  restockIngredient: (id: number, amount: number, note?: string) => Promise<void>;
  saveRecipe: (menuItemId: string | number, items: Omit<RecipeItem, 'id' | 'recipeId'>[]) => Promise<void>;
  restockMenuItem: (id: string | number, amount: number, note?: string) => Promise<void>;
  addKotSnapshot: (snapshot: KotSnapshot) => Promise<void>;
  
  // Modifier Actions
  saveModifierGroup: (group: ModifierGroup, options: ModifierOption[]) => Promise<void>;
  deleteModifierGroup: (groupId: string | number) => Promise<void>;

  // POS Actions
  setCart: (cart: OrderItem[]) => void;
  clearCart: () => void;
  addToCart: (item: MenuItem, modifiers?: OrderItemModifier[], notes?: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  updateOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setTableNumber: (num: string) => void;
  setActiveOrder: (order: Order | null) => void;
  setDeliveryChargeWaived: (waived: boolean) => void;
  setDeliveryChargeWaivedReason: (reason: string) => void;
  retrieveOrder: (order: Order, menuItems: MenuItem[]) => { unavailable: string[], updatedCart: OrderItem[] };
  cancelHeldOrder: (id: string) => Promise<void>;
  updateCartItem: (id: string, modifiers: OrderItemModifier[], notes: string) => void;

  // Data Export/Import
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;

  // Global Dialog states
  confirmModal: ConfirmModalState | null;
  promptModal: PromptModalState | null;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDanger: boolean;
  resolve: (value: boolean) => void;
}

export interface PromptModalState {
  isOpen: boolean;
  title: string;
  message: string;
  defaultValue: string;
  resolve: (value: string | null) => void;
}


const DEFAULT_SETTINGS: RestaurantSettings = {
  name: 'LUX BISTRO',
  address: '123 ELEGANCE WAY, PLATINUM CITY',
  phone: '+1 555 LUXURY',
  email: 'contact@luxbistro.com',
  taxPercentage: 8,
  taxLabel: 'Tax',
  taxInclusion: 'exclusive',
  showTaxBreakdown: true,
  currency: '$',
  currencyPosition: 'before',
  receiptHeader: 'WELCOME TO LUX BISTRO',
  receiptFooter: 'EXPERIENCE THE TASTE OF EXCELLENCE',
  autoPrintKOT: true,
  showCustomerNameOnKOT: true,
  showOrderTypeOnKOT: true,
  showTableNumberOnKOT: true,
  kotFontSize: 'normal',
  autoPrintReceipt: true,
  showTaxLine: true,
  showOrderTypeOnReceipt: true,
  showCustomerNameOnReceipt: true,
  showTableNumberOnReceipt: true,
  deliveryChargeEnabled: true,
  deliveryChargeAmount: 0,
  deliveryChargeLabel: 'Delivery Charge',
  deliveryChargeTaxable: false,
  autoLogoutTimeout: '8',
};

const SEED_CATEGORIES: Category[] = [
  { id: 1, name: 'Fast Food', type: 'prepared' },
  { id: 2, name: 'Italian', type: 'prepared' },
  { id: 3, name: 'Salads', type: 'prepared' },
  { id: 4, name: 'Beverages', type: 'stocked' },
];

const SEED_MENU_ITEMS: MenuItem[] = [
  { id: 'item-1', name: 'Classic Burger', price: 8.99, categoryId: 1, description: 'Juicy beef burger', isActive: true, stock: 50, minStock: 10, directStock: 50, createdAt: Date.now() },
  { id: 'item-2', name: 'Pepperoni Pizza', price: 13.99, categoryId: 2, description: 'Classic pepperoni and mozzarella', isActive: true, stock: 30, minStock: 5, directStock: 30, createdAt: Date.now() },
  { id: 'item-3', name: 'Caesar Salad', price: 7.49, categoryId: 3, description: 'Fresh romaine with dressing', isActive: true, stock: 40, minStock: 8, directStock: 40, createdAt: Date.now() },
  { id: 'item-4', name: 'Coca Cola', price: 1.99, categoryId: 4, description: 'Refreshing soft drink', isActive: true, stock: 100, minStock: 10, directStock: 100, createdAt: Date.now() },
  { id: 'item-5', name: 'Garlic Bread', price: 3.99, categoryId: 2, description: 'Warm garlic bread', isActive: true, stock: 40, minStock: 10, directStock: 40, createdAt: Date.now() },
];

export const useStore = create<StoreState>((set, get) => ({
  menuItems: [],
  categories: [],
  orders: [],
  settings: DEFAULT_SETTINGS,
  ingredients: [],
  recipes: [],
  recipeItems: [],
  stockLogs: [],
  kotSnapshots: [],
  modifierGroups: [],
  modifierOptions: [],
  isLoading: true,
  user: null,
  isOnline: window.navigator.onLine,
  lastSynced: null,
  lastAction: Date.now(),
  sidebarState: 'expanded',
  subscription: null,
  confirmModal: null,
  promptModal: null,

  // POS Initial State
  cart: [],
  orderType: OrderType.DINE_IN,
  customerName: '',
  tableNumber: '',
  activeOrder: null,
  deliveryChargeWaived: false,
  deliveryChargeWaivedReason: '',

  init: async () => {
    set({ isLoading: true });

    // 1. Seed Default User
    const defaultUser = await db.users.get('operator-1');
    if (!defaultUser) {
      await db.users.add({
        id: 'operator-1',
        email: 'admin@restaurant.app',
        password: '123456'
      });
    } else if (defaultUser.email === 'abcd@email.com') {
      await db.users.update('operator-1', { email: 'admin@restaurant.app' });
    }

    // 2. Local Session Recovery
    const sessionId = localStorage.getItem('rms_session');
    if (sessionId) {
      const user = await db.users.get(sessionId);
      if (user) {
        set({ user: { uid: user.id, email: user.email }, lastAction: Date.now() });
        get().setupSync(user.id);
      }
    }

    // 3. Online/Offline Listeners
    window.addEventListener('online', () => {
      set({ isOnline: true });
      triggerBackgroundSync().catch(err => console.warn('Background sync on network restore failed:', err));
    });
    window.addEventListener('offline', () => set({ isOnline: false }));

    // 4. Activity Tracking (8h timeout)
    const updateActivity = () => {
      const now = Date.now();
      const last = get().lastAction;
      if (get().user && now - last > 8 * 60 * 60 * 1000) {
        get().logout();
        toast.info('Session expired due to inactivity');
      } else {
        set({ lastAction: now });
      }
    };
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);

    // Initial load from Dexie
    const categories = await db.categories.toArray();
    const menuItems = await db.menuItems.toArray();
    const settingsEntry = await db.settings.where({ key: 'main' }).first();
    const settings = settingsEntry ? settingsEntry.value : DEFAULT_SETTINGS;
    const orders = await db.orders.orderBy('createdAt').reverse().toArray();
    const ingredients = await db.ingredients.toArray();
    const recipes = await db.recipes.toArray();
    const recipeItems = await db.recipeItems.toArray();
    const stockLogs = await db.stockLog.orderBy('createdAt').reverse().toArray();
    const kotSnapshots = await db.kotSnapshots.toArray();
    const modifierGroups = await db.modifierGroups.toArray();
    const modifierOptions = await db.modifierOptions.toArray();
    
    // Load subscription settings
    const subscription = await getLocalSubscription();
    // Fire-and-forget background synchronization
    triggerBackgroundSync().catch(err => console.warn('Startup sync failed:', err));

    // Load Sidebar state
    const sidebarEntry = await db.settings.where({ key: 'sidebarState' }).first();
    const sidebarState = sidebarEntry ? sidebarEntry.value : 'expanded';

    // Seed initial data if empty and not logged in (to have SOMETHING to show)
    if (categories.length === 0 && !get().user) {
      await db.categories.bulkAdd(SEED_CATEGORIES);
      await db.menuItems.bulkAdd(SEED_MENU_ITEMS);
      await db.settings.add({ key: 'main', value: DEFAULT_SETTINGS });
      
      const newCats = await db.categories.toArray();
      const newItems = await db.menuItems.toArray();
      const newSettings = { ...DEFAULT_SETTINGS, licenseExpiry: subscription?.expiryDate };
      set({ 
        categories: newCats, 
        menuItems: newItems, 
        settings: newSettings, 
        subscription,
        isLoading: false 
      });
      return;
    }

    // 5. Startup Repair: Restore unprepared items auto-disabled by bug
    const repairedMenuItems = [...menuItems];
    let needsRepairUpdate = false;

    for (let i = 0; i < repairedMenuItems.length; i++) {
      const item = repairedMenuItems[i];
      if (!item.isActive && item.disabledReason === 'out_of_stock') {
        const category = categories.find(c => Number(c.id) === Number(item.categoryId));
        if (category?.type === 'prepared') {
          repairedMenuItems[i] = { ...item, isActive: true, disabledReason: null };
          await db.menuItems.update(item.id, repairedMenuItems[i]);
          console.log(`Auto-restored prepared item: ${item.name}`);
          needsRepairUpdate = true;
        }
      }
    }

    const mergedSettings = { ...settings, licenseExpiry: subscription?.expiryDate };
    set({ 
      categories, 
      menuItems: repairedMenuItems, 
      settings: mergedSettings, 
      orders, 
      ingredients,
      recipes,
      recipeItems,
      stockLogs,
      kotSnapshots,
      modifierGroups,
      modifierOptions,
      sidebarState,
      subscription,
      isLoading: false 
    });
  },

  setSidebarState: async (sidebarState) => {
    const existing = await db.settings.where({ key: 'sidebarState' }).first();
    if (existing) {
      await db.settings.update(existing.id!, { value: sidebarState });
    } else {
      await db.settings.add({ key: 'sidebarState', value: sidebarState });
    }
    set({ sidebarState });
  },

  setupSync: async (uid: string) => {
    if (!fireStore) {
      console.log('Firebase sync is disabled (missing or invalid configuration).');
      return;
    }
    // Check if migration is needed - handle offline gracefully
    try {
      const settingsSnap = await getDoc(doc(fireStore, 'restaurants', uid));
      if (!settingsSnap.exists()) {
        await get().forceSync();
      }
    } catch (err: any) {
      console.warn('Initial sync check skipped/failed:', err.message);
      if (err.message.includes('offline') || err.code === 'unavailable') {
        set({ isOnline: false });
      }
    }

    // Subscribe to snapshots
    const collections = [
      { name: 'categories', table: db.categories },
      { name: 'menuItems', table: db.menuItems },
      { name: 'orders', table: db.orders },
      { name: 'orderItems', table: db.orderItems },
      { name: 'ingredients', table: db.ingredients },
      { name: 'recipes', table: db.recipes },
      { name: 'recipeItems', table: db.recipeItems },
      { name: 'stockLog', table: db.stockLog },
      { name: 'modifierGroups', table: db.modifierGroups },
      { name: 'modifierOptions', table: db.modifierOptions },
      { name: 'orderItemModifiers', table: db.orderItemModifiers }
    ];

    collections.forEach(col => {
      onSnapshot(collection(fireStore, 'restaurants', uid, col.name), (snap) => {
        snap.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          if (change.type === 'added' || change.type === 'modified') {
            await col.table.put(data as any);
          } else if (change.type === 'removed') {
            await col.table.delete(change.doc.id as any);
          }
        });
        // Refresh state after merge
        if (col.name === 'categories') db.categories.toArray().then(items => set({ categories: items }));
        if (col.name === 'menuItems') db.menuItems.toArray().then(items => set({ menuItems: items }));
        if (col.name === 'orders') db.orders.orderBy('createdAt').reverse().toArray().then(items => set({ orders: items }));
        if (col.name === 'ingredients') db.ingredients.toArray().then(items => set({ ingredients: items }));
        if (col.name === 'recipes') db.recipes.toArray().then(items => set({ recipes: items }));
        if (col.name === 'recipeItems') db.recipeItems.toArray().then(items => set({ recipeItems: items }));
        if (col.name === 'stockLog') db.stockLog.orderBy('createdAt').reverse().toArray().then(items => set({ stockLogs: items }));
        if (col.name === 'modifierGroups') db.modifierGroups.toArray().then(items => set({ modifierGroups: items }));
        if (col.name === 'modifierOptions') db.modifierOptions.toArray().then(items => set({ modifierOptions: items }));
      }, (err) => {
        console.warn(`Snapshot error for ${col.name}:`, err);
        if (err.message.includes('offline')) set({ isOnline: false });
      });
    });

    // Settings sync
    onSnapshot(doc(fireStore, 'restaurants', uid), (snap) => {
      if (snap.exists()) {
        const settings = snap.data() as RestaurantSettings;
        db.settings.put({ key: 'main', value: settings });
        set(state => ({
          settings: { ...settings, licenseExpiry: state.subscription?.expiryDate },
          lastSynced: Date.now()
        }));
      }
    });
  },

  syncToFirebase: async (collectionName: string, id: string | number, data: any) => {
    const { user } = get();
    if (!user || !fireStore) return;
    try {
      if (data === null) {
        await deleteDoc(doc(fireStore, 'restaurants', user.uid, collectionName, id.toString()));
      } else {
        await setDoc(doc(fireStore, 'restaurants', user.uid, collectionName, id.toString()), data);
      }
      set({ lastSynced: Date.now() });
    } catch (err) {
      console.warn(`Sync failed for ${collectionName}:`, err);
    }
  },

  login: async (email, password, remember) => {
    const user = await db.users.where({ email }).first();
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }
    
    set({ user: { uid: user.id, email: user.email }, lastAction: Date.now() });
    if (remember) {
      localStorage.setItem('rms_session', user.id);
    }
    
    get().setupSync(user.id);
    toast.success('Login successful');
  },

  logout: async () => {
    localStorage.removeItem('rms_session');
    set({ user: null, settings: DEFAULT_SETTINGS, categories: [], menuItems: [], orders: [], ingredients: [], recipes: [], recipeItems: [], stockLogs: [] });
    // Note: We don't wipe the DB here because we want persistent local data
    toast.success('Logged out');
  },

  changePassword: async (newPassword) => {
    const { user } = get();
    if (user) {
      await db.users.update(user.uid, { password: newPassword });
      toast.success('Password updated');
    }
  },

  forceSync: async () => {
    const { user } = get();
    if (!user) return;
    if (!fireStore) {
      toast.error('Firebase sync is disabled (missing or invalid configuration).');
      return;
    }

    toast.info('Starting full sync...');
    
    // Sync settings
    const settings = get().settings;
    await setDoc(doc(fireStore, 'restaurants', user.uid), settings);

    // Sync collections
    const collections = [
      { name: 'categories', table: db.categories },
      { name: 'menuItems', table: db.menuItems },
      { name: 'orders', table: db.orders },
      { name: 'orderItems', table: db.orderItems },
      { name: 'ingredients', table: db.ingredients },
      { name: 'recipes', table: db.recipes },
      { name: 'recipeItems', table: db.recipeItems },
      { name: 'stockLog', table: db.stockLog },
      { name: 'modifierGroups', table: db.modifierGroups },
      { name: 'modifierOptions', table: db.modifierOptions },
      { name: 'orderItemModifiers', table: db.orderItemModifiers }
    ];

    for (const col of collections) {
      const items = await col.table.toArray();
      const batch = writeBatch(fireStore);
      items.forEach((item: any) => {
        const id = (item.id || item.crypto?.randomUUID?.() || Date.now().toString()).toString();
        batch.set(doc(fireStore, 'restaurants', user.uid, col.name, id), item);
      });
      await batch.commit();
    }

    set({ lastSynced: Date.now() });
    toast.success('Full sync completed');
  },

  addMenuItem: async (item) => {
    const id = await db.menuItems.add(item);
    const addedItem = await db.menuItems.get(id);
    if (addedItem) {
      get().syncToFirebase('menuItems', addedItem.id, addedItem);
      set(state => ({ menuItems: [...state.menuItems, addedItem] }));
    }
    toast.success('Menu item added');
  },
  updateMenuItem: async (item) => {
    await db.menuItems.put(item);
    get().syncToFirebase('menuItems', item.id, item);
    set(state => ({ menuItems: state.menuItems.map(i => i.id === item.id ? item : i) }));
    toast.success('Menu item updated');
  },
  deleteMenuItem: async (id) => {
    await db.menuItems.delete(id);
    get().syncToFirebase('menuItems', id, null);
    set(state => ({ menuItems: state.menuItems.filter(i => i.id !== id) }));
    toast.success('Menu item deleted');
  },

  addCategory: async (category) => {
    const id = await db.categories.add(category);
    const addedCategory = await db.categories.get(id);
    if (addedCategory) {
      get().syncToFirebase('categories', addedCategory.id, addedCategory);
      set(state => ({ categories: [...state.categories, addedCategory] }));
    }
    toast.success('Category added');
  },
  updateCategory: async (category) => {
    await db.categories.put(category);
    get().syncToFirebase('categories', category.id, category);
    set(state => ({ categories: state.categories.map(c => c.id === category.id ? category : c) }));
    toast.success('Category updated');
  },
  deleteCategory: async (id) => {
    const items = await db.menuItems.where({ categoryId: id }).count();
    if (items > 0) {
      toast.error('Cannot delete category with assigned items');
      return;
    }
    await db.categories.delete(id);
    get().syncToFirebase('categories', id, null);
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }));
    toast.success('Category deleted');
  },

  addOrder: async (order) => {
    await db.transaction('rw', [db.orders, db.orderItems, db.menuItems, db.ingredients, db.recipes, db.recipeItems, db.stockLog], async () => {
      await db.orders.add(order);
      get().syncToFirebase('orders', order.id, order);
      
      const orderItems = order.items.map(item => ({ ...item, orderId: order.id }));
      await db.orderItems.bulkAdd(orderItems);
      orderItems.forEach(item => get().syncToFirebase('orderItems', item.id, item));

      if (order.status === 'completed') {
        const autoDisabledItems: string[] = [];

        for (const item of order.items) {
          const menuItem = await db.menuItems.get(item.menuItemId);
          if (menuItem) {
            const categoryId = isNaN(Number(menuItem.categoryId)) ? menuItem.categoryId : Number(menuItem.categoryId);
            const category = await db.categories.get(categoryId);
            
            // Stock deduction for 'stocked' types
            if (category?.type === 'stocked') {
              const newDirectStock = Math.max(0, menuItem.directStock - item.quantity);
              const isOut = newDirectStock <= 0;
              const updatedItem = { 
                ...menuItem, 
                directStock: newDirectStock,
                isActive: isOut ? false : menuItem.isActive,
                disabledReason: isOut ? 'out_of_stock' : menuItem.disabledReason
              };
              await db.menuItems.update(menuItem.id, updatedItem);
              get().syncToFirebase('menuItems', menuItem.id, updatedItem);

              // Stock Log for sale
              const logEntry: StockLog = {
                menuItemId: menuItem.id,
                changeAmount: -item.quantity,
                reason: 'sale',
                remainingAfter: newDirectStock,
                createdAt: Date.now()
              };
              const logId = await db.stockLog.add(logEntry);
              get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

              if (newDirectStock === 0) {
                toast.warning(`${menuItem.name} is now out of stock and has been hidden from the menu`);
              } else if (newDirectStock <= menuItem.minStock) {
                toast.warning(`${menuItem.name} stock is low — only ${newDirectStock} remaining`);
              }
            }
          }

          const recipe = await db.recipes.where({ menuItemId: item.menuItemId }).first();
          if (recipe) {
            const recipeItems = await db.recipeItems.where({ recipeId: recipe.id }).toArray();
            for (const rItem of recipeItems) {
              const ingredient = await db.ingredients.get(rItem.ingredientId!);
              if (ingredient) {
                const deduction = rItem.quantityUsed * item.quantity;
                const newStock = Math.max(0, ingredient.currentStock - deduction);
                const updatedIngredient = { ...ingredient, currentStock: newStock };
                
                await db.ingredients.update(ingredient.id!, updatedIngredient);
                get().syncToFirebase('ingredients', ingredient.id!, updatedIngredient);
                
                const logEntry = {
                  ingredientId: ingredient.id!,
                  changeAmount: -deduction,
                  reason: 'sale',
                  remainingAfter: newStock,
                  createdAt: Date.now()
                };
                const logId = await db.stockLog.add(logEntry);
                get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

                if (newStock <= 0) {
                  const affectedRecipes = await db.recipeItems.where({ ingredientId: ingredient.id! }).toArray();
                  for (const affRecipeItem of affectedRecipes) {
                    const affRecipe = await db.recipes.get(affRecipeItem.recipeId);
                    if (affRecipe) {
                      const affMenuItem = await db.menuItems.get(affRecipe.menuItemId);
                      if (affMenuItem && affMenuItem.isActive) {
                        const affCategoryId = isNaN(Number(affMenuItem.categoryId)) ? affMenuItem.categoryId : Number(affMenuItem.categoryId);
                        const affCategory = await db.categories.get(affCategoryId);
                        // Only auto-disable if it's a Stocked item
                        if (affCategory?.type === 'stocked') {
                          const updatedAffItem = { 
                            ...affMenuItem, 
                            isActive: false,
                            disabledReason: 'out_of_stock'
                          } as MenuItem;
                          await db.menuItems.update(affMenuItem.id, updatedAffItem);
                          get().syncToFirebase('menuItems', affMenuItem.id, updatedAffItem);
                          autoDisabledItems.push(affMenuItem.name);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (autoDisabledItems.length > 0) {
          const uniqueDisabled = Array.from(new Set(autoDisabledItems));
          toast.warning(`Some items were auto-disabled: ${uniqueDisabled.join(', ')} due to out of stock ingredients`);
        }
      }
    });

    const [newMenuItems, newIngredients, newStockLogs] = await Promise.all([
      db.menuItems.toArray(),
      db.ingredients.toArray(),
      db.stockLog.orderBy('createdAt').reverse().toArray()
    ]);

    set(state => ({ 
      orders: [order, ...state.orders],
      menuItems: newMenuItems,
      ingredients: newIngredients,
      stockLogs: newStockLogs
    }));
    
    if (order.status === 'completed') {
      toast.success('Order completed and inventory updated');
    }
  },
  updateOrder: async (order) => {
    await db.orders.put(order);
    get().syncToFirebase('orders', order.id, order);
    set(state => ({ orders: state.orders.map(o => o.id === order.id ? order : o) }));
    toast.success('Order updated');
  },
  deleteOrder: async (id) => {
    await db.orders.delete(id);
    get().syncToFirebase('orders', id, null);
    const itms = await db.orderItems.where({ orderId: id }).toArray();
    for (const itm of itms) {
      await db.orderItems.delete(itm.id!);
      get().syncToFirebase('orderItems', itm.id!, null);
    }
    set(state => ({ orders: state.orders.filter(o => o.id !== id) }));
    toast.success('Order deleted');
  },

  updateSettings: async (settings) => {
    const existing = await db.settings.where({ key: 'main' }).first();
    if (existing) {
      await db.settings.update(existing.id!, { value: settings });
    } else {
      await db.settings.add({ key: 'main', value: settings });
    }
    const { user } = get();
    if (user && fireStore) {
      await setDoc(doc(fireStore, 'restaurants', user.uid), settings);
    }
    set(state => ({
      settings: { ...settings, licenseExpiry: state.settings.licenseExpiry },
      lastSynced: Date.now()
    }));
    toast.success('Settings updated');
  },

  addIngredient: async (ingredient) => {
    const id = await db.ingredients.add(ingredient as Ingredient);
    const newIngredient = { ...ingredient, id } as Ingredient;
    get().syncToFirebase('ingredients', id, newIngredient);
    set(state => ({ ingredients: [...state.ingredients, newIngredient] }));
    toast.success('Ingredient added');
  },
  updateIngredient: async (ingredient) => {
    await db.ingredients.put(ingredient);
    get().syncToFirebase('ingredients', ingredient.id!, ingredient);
    set(state => ({ ingredients: state.ingredients.map(i => i.id === ingredient.id ? ingredient : i) }));
    toast.success('Ingredient updated');
  },
  deleteIngredient: async (id) => {
    const usageCount = await db.recipeItems.where({ ingredientId: id }).count();
    if (usageCount > 0) {
      toast.error('Cannot delete: Ingredient is used in recipes');
      return;
    }
    await db.ingredients.delete(id);
    get().syncToFirebase('ingredients', id, null);
    set(state => ({ ingredients: state.ingredients.filter(i => i.id !== id) }));
    toast.success('Ingredient deleted');
  },
  restockIngredient: async (id, amount, note) => {
    const ingredient = await db.ingredients.get(id);
    if (!ingredient) return;
    const newStock = ingredient.currentStock + amount;
    const updatedIngredient = { ...ingredient, currentStock: newStock };
    await db.ingredients.update(id, updatedIngredient);
    get().syncToFirebase('ingredients', id, updatedIngredient);
    
    const logEntry = {
      ingredientId: id,
      changeAmount: amount,
      reason: 'restock',
      remainingAfter: newStock,
      createdAt: Date.now()
    };
    const logId = await db.stockLog.add(logEntry);
    get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

    const [newIngredients, newStockLogs] = await Promise.all([
      db.ingredients.toArray(),
      db.stockLog.orderBy('createdAt').reverse().toArray()
    ]);
    set({ ingredients: newIngredients, stockLogs: newStockLogs });
    toast.success(`${ingredient.name} restocked`);
  },
  saveRecipe: async (menuItemId, items) => {
    await db.transaction('rw', [db.recipes, db.recipeItems], async () => {
      let recipe = await db.recipes.where({ menuItemId }).first();
      if (!recipe) {
        const id = await db.recipes.add({ menuItemId } as Recipe);
        recipe = { id, menuItemId };
      }
      get().syncToFirebase('recipes', recipe.id!, recipe);

      const existingItems = await db.recipeItems.where({ recipeId: recipe.id! }).toArray();
      for (const exItem of existingItems) {
        await db.recipeItems.delete(exItem.id!);
        get().syncToFirebase('recipeItems', exItem.id!, null);
      }

      for (const item of items) {
        const newItem = { ...item, recipeId: recipe!.id! } as RecipeItem;
        const itemId = await db.recipeItems.add(newItem);
        get().syncToFirebase('recipeItems', itemId, { ...newItem, id: itemId });
      }
    });

    const [newRecipes, newRecipeItems] = await Promise.all([
      db.recipes.toArray(),
      db.recipeItems.toArray()
    ]);
    set({ recipes: newRecipes, recipeItems: newRecipeItems });
    toast.success('Recipe saved');
  },

  restockMenuItem: async (id, amount, note) => {
    const item = await db.menuItems.get(id);
    if (!item) return;

    const newStock = item.directStock + amount;
    const updatedItem = { ...item, directStock: newStock, isActive: true };
    await db.menuItems.update(id, updatedItem);
    get().syncToFirebase('menuItems', id, updatedItem);

    const logEntry: StockLog = {
      menuItemId: id,
      changeAmount: amount,
      reason: 'restock',
      remainingAfter: newStock,
      createdAt: Date.now(),
      reason_note: note // Optional note field reinforcement
    } as any;
    const logId = await db.stockLog.add(logEntry);
    get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

    const [newMenuItems, newStockLogs] = await Promise.all([
      db.menuItems.toArray(),
      db.stockLog.orderBy('createdAt').reverse().toArray()
    ]);
    set({ menuItems: newMenuItems, stockLogs: newStockLogs });
    toast.success(`${item.name} restocked to ${newStock}`);
  },

  addKotSnapshot: async (snapshot) => {
    const id = await db.kotSnapshots.add(snapshot);
    const newSnapshot = { ...snapshot, id };
    get().syncToFirebase('kotSnapshots', id, newSnapshot);
    set(state => ({ kotSnapshots: [...state.kotSnapshots, newSnapshot] }));
  },

  saveModifierGroup: async (group, options) => {
    await db.transaction('rw', [db.modifierGroups, db.modifierOptions, db.orderItemModifiers], async () => {
      await db.modifierGroups.put(group);
      get().syncToFirebase('modifierGroups', group.id, group);

      // Clean old options and add new ones
      const existingOptions = await db.modifierOptions.where({ groupId: group.id }).toArray();
      for (const opt of existingOptions) {
        await db.modifierOptions.delete(opt.id);
        get().syncToFirebase('modifierOptions', opt.id, null);
      }

      for (const opt of options) {
        await db.modifierOptions.add(opt);
        get().syncToFirebase('modifierOptions', opt.id, opt);
      }
    });

    const [groups, opts] = await Promise.all([
      db.modifierGroups.toArray(),
      db.modifierOptions.toArray()
    ]);
    set({ modifierGroups: groups, modifierOptions: opts });
    toast.success('Modifier group saved');
  },

  deleteModifierGroup: async (groupId) => {
    await db.transaction('rw', [db.modifierGroups, db.modifierOptions], async () => {
      await db.modifierGroups.delete(groupId);
      get().syncToFirebase('modifierGroups', groupId, null);

      const options = await db.modifierOptions.where({ groupId }).toArray();
      for (const opt of options) {
        await db.modifierOptions.delete(opt.id);
        get().syncToFirebase('modifierOptions', opt.id, null);
      }
    });

    const [groups, opts] = await Promise.all([
      db.modifierGroups.toArray(),
      db.modifierOptions.toArray()
    ]);
    set({ modifierGroups: groups, modifierOptions: opts });
    toast.success('Modifier group deleted');
  },

  // POS Actions Implementation
  setCart: (cart) => set({ cart }),
  clearCart: () => set({ 
    cart: [], 
    customerName: '', 
    tableNumber: '', 
    activeOrder: null,
    deliveryChargeWaived: false,
    deliveryChargeWaivedReason: ''
  }),
  addToCart: (item, modifiers = [], notes = '') => {
    const { cart } = get();
    // Check for item with same modifiers and notes
    const existingIndex = cart.findIndex(i => 
      i.menuItemId === item.id && 
      JSON.stringify(i.modifiers || []) === JSON.stringify(modifiers) &&
      i.notes === notes
    );

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + 1
      };
      set({ cart: updatedCart });
    } else {
      set({ 
        cart: [...cart, { 
          id: crypto.randomUUID(), 
          menuItemId: item.id, 
          name: item.name, 
          price: item.price, 
          quantity: 1,
          notes,
          modifiers
        }] 
      });
    }
  },
  updateQuantity: (itemId, delta) => {
    const { cart } = get();
    set({
      cart: cart.map(i => {
        if (i.id === itemId) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    });
  },
  removeFromCart: (itemId) => set({ cart: get().cart.filter(i => i.id !== itemId) }),
  updateCartItem: (id, modifiers, notes) => {
    set(state => ({
      cart: state.cart.map(item => 
        item.id === id ? { ...item, modifiers, notes } : item
      )
    }));
  },
  updateOrderType: (orderType) => set({ 
    orderType, 
    deliveryChargeWaived: orderType === OrderType.DELIVERY ? get().deliveryChargeWaived : false,
    deliveryChargeWaivedReason: orderType === OrderType.DELIVERY ? get().deliveryChargeWaivedReason : ''
  }),
  setCustomerName: (customerName) => set({ customerName }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setDeliveryChargeWaived: (deliveryChargeWaived) => set({ deliveryChargeWaived }),
  setDeliveryChargeWaivedReason: (deliveryChargeWaivedReason) => set({ deliveryChargeWaivedReason }),
  retrieveOrder: (order, menuItems) => {
    const unavailable: string[] = [];
    const updatedCart: OrderItem[] = order.items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      const category = get().categories.find(c => c.id === menuItem?.categoryId);
      
      const isAvailable = menuItem?.isActive && (category?.type === 'prepared' || menuItem.directStock > 0);
      
      if (!menuItem || !isAvailable) {
        unavailable.push(item.name);
      }
      return item;
    });

    set({
      cart: updatedCart,
      orderType: order.type,
      customerName: order.customerName || '',
      tableNumber: order.tableNumber || '',
      activeOrder: { ...order, status: 'in-progress' },
      deliveryChargeWaived: order.deliveryChargeWaived || false,
      deliveryChargeWaivedReason: order.deliveryChargeWaivedReason || '',
    });

    // Update status in DB - using the non-async version of updateOrder to avoid blocking UI immediately but we should probably await it if we were in an async action
    // But here we return the info for the UI
    db.orders.update(order.id, { status: 'in-progress', updatedAt: Date.now() }).then(() => {
       db.orders.orderBy('createdAt').reverse().toArray().then(items => set({ orders: items }));
    });

    return { unavailable, updatedCart };
  },
  cancelHeldOrder: async (id) => {
    await db.orders.delete(id);
    const itms = await db.orderItems.where({ orderId: id }).toArray();
    for (const itm of itms) {
      await db.orderItems.delete(itm.id!);
    }
    const orders = await db.orders.orderBy('createdAt').reverse().toArray();
    set({ orders });
  },

  exportData: async () => {
    const data = {
      settings: (await db.settings.where({ key: 'main' }).first())?.value || DEFAULT_SETTINGS,
      categories: await db.categories.toArray(),
      menuItems: await db.menuItems.toArray(),
      orders: await db.orders.toArray(),
      orderItems: await db.orderItems.toArray(),
      ingredients: await db.ingredients.toArray(),
      recipes: await db.recipes.toArray(),
      recipeItems: await db.recipeItems.toArray(),
      stockLog: await db.stockLog.toArray(),
      kotSnapshots: await db.kotSnapshots.toArray(),
      modifierGroups: await db.modifierGroups.toArray(),
      modifierOptions: await db.modifierOptions.toArray(),
      orderItemModifiers: await db.orderItemModifiers.toArray(),
    };
    
    return JSON.stringify(data, null, 2);
  },

  importData: async (json) => {
    try {
      const data = JSON.parse(json);
      
      const tables = [
        db.settings, db.categories, db.menuItems, db.orders, 
        db.orderItems, db.ingredients, db.recipes, db.recipeItems, 
        db.stockLog, db.kotSnapshots, db.modifierGroups, 
        db.modifierOptions, db.orderItemModifiers
      ];

      await db.transaction('rw', tables, async () => {
        await Promise.all(tables.map(t => t.clear()));

        if (data.settings) {
          await db.settings.add({ key: 'main', value: Array.isArray(data.settings) ? data.settings[0]?.value : data.settings });
        }
        if (data.categories) await db.categories.bulkAdd(data.categories);
        if (data.menuItems) await db.menuItems.bulkAdd(data.menuItems);
        if (data.orders) await db.orders.bulkAdd(data.orders);
        if (data.orderItems) await db.orderItems.bulkAdd(data.orderItems);
        if (data.ingredients) await db.ingredients.bulkAdd(data.ingredients);
        if (data.recipes) await db.recipes.bulkAdd(data.recipes);
        if (data.recipeItems) await db.recipeItems.bulkAdd(data.recipeItems);
        if (data.stockLog) await db.stockLog.bulkAdd(data.stockLog);
        if (data.kotSnapshots) await db.kotSnapshots.bulkAdd(data.kotSnapshots);
        if (data.modifierGroups) await db.modifierGroups.bulkAdd(data.modifierGroups);
        if (data.modifierOptions) await db.modifierOptions.bulkAdd(data.modifierOptions);
        if (data.orderItemModifiers) await db.orderItemModifiers.bulkAdd(data.orderItemModifiers);
      });

      await get().init();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  activateLicense: async (key: string) => {
    try {
      const updatedSub = await activateLicenseKey(key);
      set(state => ({
        subscription: updatedSub,
        settings: { ...state.settings, licenseExpiry: updatedSub.expiryDate }
      }));
      toast.success("License activated successfully! Extended by 180 days.");
    } catch (err: any) {
      toast.error(err.message || "Failed to activate license key");
      throw err;
    }
  },

  syncLicenses: async () => {
    try {
      await triggerBackgroundSync();
      const sub = await getLocalSubscription();
      set(state => ({
        subscription: sub,
        settings: { ...state.settings, licenseExpiry: sub.expiryDate }
      }));
    } catch (err: any) {
      console.warn("Manual licensing sync failed:", err);
    }
  },
}));

export const showConfirmModal = (options: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}): Promise<boolean> => {
  return new Promise((resolve) => {
    useStore.setState({
      confirmModal: {
        isOpen: true,
        title: options.title || 'Confirm',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        isDanger: !!options.isDanger,
        resolve,
      }
    });
  });
};

export const showPromptModal = (options: {
  title?: string;
  message: string;
  defaultValue?: string;
}): Promise<string | null> => {
  return new Promise((resolve) => {
    useStore.setState({
      promptModal: {
        isOpen: true,
        title: options.title || 'Prompt',
        message: options.message,
        defaultValue: options.defaultValue || '',
        resolve,
      }
    });
  });
};

