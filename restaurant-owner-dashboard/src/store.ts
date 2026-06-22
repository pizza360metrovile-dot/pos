import { create } from 'zustand';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Order, OrderItem, OrderItemModifier, MenuItem, Ingredient, Expense, ExpenseCategory, QuickFilterType, MainTabType } from './types';
import { db, isDemoMode, DEFAULT_RESTAURANT_ID } from './firebase';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';

export interface FirestoreDiagnostic {
  collection: string;
  status: 'active' | 'loading' | 'error' | 'empty';
  errorMsg?: string;
  docCount: number;
  lastUpdated?: string;
}

// 1) Parse and dynamically determine target Restaurant ID (UID)
export function getInitialRestaurantId(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('uid') || params.get('restaurantId') || params.get('restaurant_id') || params.get('restaurantUid') || params.get('restaurant_uid');
    if (urlId && urlId.trim()) {
      const cleaned = urlId.trim();
      localStorage.setItem('activeRestaurantUID', cleaned);
      localStorage.setItem('target_restaurant_uid', cleaned);
      return cleaned;
    }
  } catch (e) {
    console.error("Failed to parse URL restaurantId: ", e);
  }

  try {
    const localId = localStorage.getItem('activeRestaurantUID') || localStorage.getItem('target_restaurant_uid') || localStorage.getItem('restaurant_id') || localStorage.getItem('restaurant_uid');
    if (localId && localId.trim()) {
      return localId.trim();
    }
  } catch (e) {
    console.error("Failed to parse localStorage restaurantId: ", e);
  }

  const fallback = "operator-1";
  try {
    localStorage.setItem('activeRestaurantUID', fallback);
    localStorage.setItem('target_restaurant_uid', fallback);
  } catch (e) {}
  return fallback;
}

// Helper to convert any timestamp representation safely to Date
export function toJSDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date();
}

// Convert password+timestamp to simple string representation of hash
function generateSessionToken(password: string): string {
  const salt = Math.random().toString(36).substring(2, 10);
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour validity
  return `session_${password}_${expiry}_${salt}`;
}

export function isSessionValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('_');
    if (parts.length < 3) return false;
    const expiry = parseInt(parts[2], 10);
    return Date.now() < expiry;
  } catch (e) {
    return false;
  }
}

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DashboardState {
  isAuthenticated: boolean;
  sessionToken: string | null;
  lastActivity: number;
  connectionStatus: 'connected' | 'connecting' | 'offline';
  
  // Dynamic Restaurant context handler
  restaurantId: string;
  firestoreDiagnostics: Record<string, FirestoreDiagnostic>;
  setRestaurantId: (id: string) => void;
  updateDiagnostic: (collection: string, status: 'active' | 'loading' | 'error' | 'empty', errorMsg?: string, docCount?: number) => void;

  // Real or simulated collections
  orders: Order[];
  orderItems: OrderItem[];
  orderItemModifiers: OrderItemModifier[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];

  // Active Tab
  activeTab: MainTabType;
  
  // Date range filters for different tabs
  performanceDateFilter: QuickFilterType;
  performanceCustomRange: DateRange;
  
  recordsDateFilter: QuickFilterType;
  recordsCustomRange: DateRange;
  recordsTypeFilter: 'ALL' | 'Dine-In' | 'Takeaway' | 'Delivery';
  recordsStatusFilter: 'ALL' | 'In-Progress' | 'Completed';
  recordsCashierFilter: string; // "ALL" or specific name
  recordsSearchQuery: string;

  deletedDateFilter: QuickFilterType;
  deletedCustomRange: DateRange;
  deletedSubTab: 'CANCELLED_KOT' | 'DELETED_COMPLETED';

  expensesDateFilter: QuickFilterType;
  expensesCustomRange: DateRange;
  expensesCategoryFilter: string; // "ALL" or specific name
  expensesSearchQuery: string;

  // Actions
  login: (password: string) => { success: boolean; error?: string };
  logout: () => void;
  updateActivity: () => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'offline') => void;
  setActiveTab: (tab: MainTabType) => void;
  
  // Filtering mutations
  setPerformanceFilter: (filter: QuickFilterType, customRange?: DateRange) => void;
  setRecordsFilter: (filter: QuickFilterType, customRange?: DateRange) => void;
  setRecordsTypeFilter: (type: 'ALL' | 'Dine-In' | 'Takeaway' | 'Delivery') => void;
  setRecordsStatusFilter: (status: 'ALL' | 'In-Progress' | 'Completed') => void;
  setRecordsCashierFilter: (cashier: string) => void;
  setRecordsSearchQuery: (query: string) => void;

  setDeletedFilter: (filter: QuickFilterType, customRange?: DateRange) => void;
  setDeletedSubTab: (subTab: 'CANCELLED_KOT' | 'DELETED_COMPLETED') => void;

  setExpensesFilter: (filter: QuickFilterType, customRange?: DateRange) => void;
  setExpensesCategoryFilter: (category: string) => void;
  setExpensesSearchQuery: (query: string) => void;

  // Real-time synchronization loader
  initRealtimeSync: () => (() => void);
  
  // Demo Mode manual order generator to show alive POS update
  simulatePOSActivity: () => void;
}

export const useStore = create<DashboardState>((set, get) => ({
  isAuthenticated: isSessionValid(localStorage.getItem('restaurant_owner_session_token')),
  sessionToken: localStorage.getItem('restaurant_owner_session_token'),
  lastActivity: Date.now(),
  connectionStatus: isDemoMode ? 'connected' : 'connecting',

  restaurantId: getInitialRestaurantId(),
  firestoreDiagnostics: {},

  setRestaurantId: (id: string) => {
    const cleaned = id.trim();
    localStorage.setItem('activeRestaurantUID', cleaned);
    localStorage.setItem('target_restaurant_uid', cleaned);
    set({ restaurantId: cleaned });
    console.log("Updated active Restaurant UID to:", cleaned);
  },

  updateDiagnostic: (collectionName: string, status: 'active' | 'loading' | 'error' | 'empty', errorMsg?: string, docCount?: number) => {
    set(state => {
      const current = { ...state.firestoreDiagnostics };
      current[collectionName] = {
        collection: collectionName,
        status,
        docCount: docCount !== undefined ? docCount : (current[collectionName]?.docCount || 0),
        errorMsg,
        lastUpdated: new Date().toLocaleTimeString()
      };
      return { firestoreDiagnostics: current };
    });
  },

  orders: [],
  orderItems: [],
  orderItemModifiers: [],
  menuItems: [],
  ingredients: [],
  expenses: [],
  expenseCategories: [],

  activeTab: 'PERFORMANCE',

  performanceDateFilter: 'THIS WEEK',
  performanceCustomRange: { startDate: null, endDate: null },

  recordsDateFilter: 'TODAY',
  recordsCustomRange: { startDate: null, endDate: null },
  recordsTypeFilter: 'ALL',
  recordsStatusFilter: 'ALL',
  recordsCashierFilter: 'ALL',
  recordsSearchQuery: '',

  deletedDateFilter: 'THIS MONTH',
  deletedCustomRange: { startDate: null, endDate: null },
  deletedSubTab: 'CANCELLED_KOT',

  expensesDateFilter: 'THIS MONTH',
  expensesCustomRange: { startDate: null, endDate: null },
  expensesCategoryFilter: 'ALL',
  expensesSearchQuery: '',

  login: (password: string) => {
    if (password === 'football66') {
      const token = generateSessionToken(password);
      localStorage.setItem('restaurant_owner_session_token', token);
      set({
        isAuthenticated: true,
        sessionToken: token,
        lastActivity: Date.now()
      });
      return { success: true };
    } else {
      return { success: false, error: 'Incorrect password' };
    }
  },

  logout: () => {
    localStorage.removeItem('restaurant_owner_session_token');
    set({
      isAuthenticated: false,
      sessionToken: null
    });
  },

  updateActivity: () => {
    const { isAuthenticated, sessionToken } = get();
    if (isAuthenticated) {
      if (!isSessionValid(sessionToken)) {
        get().logout();
      } else {
        set({ lastActivity: Date.now() });
      }
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setPerformanceFilter: (filter, customRange) => set({
    performanceDateFilter: filter,
    performanceCustomRange: customRange || { startDate: null, endDate: null }
  }),

  setRecordsFilter: (filter, customRange) => set({
    recordsDateFilter: filter,
    recordsCustomRange: customRange || { startDate: null, endDate: null }
  }),

  setRecordsTypeFilter: (type) => set({ recordsTypeFilter: type }),
  setRecordsStatusFilter: (status) => set({ recordsStatusFilter: status }),
  setRecordsCashierFilter: (cashier) => set({ recordsCashierFilter: cashier }),
  setRecordsSearchQuery: (query) => set({ recordsSearchQuery: query }),

  setDeletedFilter: (filter, customRange) => set({
    deletedDateFilter: filter,
    deletedCustomRange: customRange || { startDate: null, endDate: null }
  }),

  setDeletedSubTab: (subTab) => set({ deletedSubTab: subTab }),

  setExpensesFilter: (filter, customRange) => set({
    expensesDateFilter: filter,
    expensesCustomRange: customRange || { startDate: null, endDate: null }
  }),

  setExpensesCategoryFilter: (category) => set({ expensesCategoryFilter: category }),
  setExpensesSearchQuery: (query) => set({ expensesSearchQuery: query }),

  initRealtimeSync: () => {
    if (isDemoMode) {
      set({ connectionStatus: 'connected' });
      // In demo mode we can let simulate activities run in the background.
      return () => {};
    }

    set({ connectionStatus: 'connecting' });
    const unsubscribes: (() => void)[] = [];

    // Initialize diagnostics
    const colls = ['orders', 'orderItems', 'orderItemModifiers', 'menuItems', 'ingredients', 'expenses', 'expenseCategories'];
    colls.forEach(c => {
      get().updateDiagnostic(c, 'loading', undefined, 0);
    });

    const finalId = get().restaurantId || localStorage.getItem('activeRestaurantUID') || "operator-1";

    try {
      console.log(`Starting real-time subscription for restaurant ID: "${finalId}"`);

      // Closure-scoped trackers to combine separate collection orderItems with inline order items
      let fetchedItems: OrderItem[] = [];
      let inlineItemsList: OrderItem[] = [];

      const updateAndMergeOrderItems = () => {
        const itemMap = new Map<string, OrderItem>();
        
        // Add inline extracted items first
        inlineItemsList.forEach(item => {
          itemMap.set(item.id, item);
        });
        
        // Overwrite/add fetched sub-collection items
        fetchedItems.forEach(item => {
          itemMap.set(item.id, item);
        });
        
        const mergedList = Array.from(itemMap.values());
        set({ orderItems: mergedList });
        get().updateDiagnostic('orderItems', mergedList.length === 0 ? 'empty' : 'active', undefined, mergedList.length);
      };

      // 1. orders
      const ordersRef = collection(db, 'restaurants', finalId, 'orders');
      const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
        try {
          const currentInlineItems: OrderItem[] = [];
          const ordersData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              const id = doc.id;
              
              // Standardizing fields from potential alternative keys (aliases)
              const orderNo = data.orderNo || data.orderNumber || data.order_no || data.order_number || data.orderID || data.id || data._id || `#${id.slice(-4)}`;
              const timestamp = data.timestamp || data.createdAt || data.completedAt || data.completedTime || data.businessDate || data.date || new Date();
              const rawStatus = (data.status || data.orderStatus || data.order_status || data.state || 'In-Progress').trim();
              const statusNormalized = (rawStatus.toLowerCase() === 'completed') ? 'Completed' : 'In-Progress';
              const total = Number(data.total !== undefined ? data.total : (data.totalAmount !== undefined ? data.totalAmount : (data.grandTotal !== undefined ? data.grandTotal : (data.amount !== undefined ? data.amount : 0))));
              const cashier = data.cashier || 'System';
              const deleted = !!(data.deleted || data.isDeleted || data.is_deleted);
              const cancelled = !!(data.cancelled || data.isCancelled || data.is_cancelled || data.state?.toLowerCase() === 'cancelled' || rawStatus.toLowerCase() === 'cancelled');

              // If order contains inline items, parse and accumulate them
              const inlineItems = data.items || data.orderItems || data.products;
              if (Array.isArray(inlineItems)) {
                inlineItems.forEach((item: any, idx: number) => {
                  currentInlineItems.push({
                    id: item.id || `${id}-item-${idx}`,
                    orderId: id,
                    name: item.name || item.itemName || item.title || "Unknown Item",
                    quantity: Number(item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 1)),
                    price: Number(item.price !== undefined ? item.price : (item.cost !== undefined ? item.cost : 0)),
                    category: item.category || ""
                  });
                });
              }

              return {
                ...data,
                id,
                orderNo,
                timestamp,
                status: statusNormalized,
                total,
                cashier,
                deleted,
                cancelled
              } as Order;
            } catch (innerErr) {
              console.error(`Failed parsing order document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is Order => doc !== null);

          inlineItemsList = currentInlineItems;
          set({ orders: ordersData, connectionStatus: 'connected' });
          get().updateDiagnostic('orders', ordersData.length === 0 ? 'empty' : 'active', undefined, ordersData.length);
          
          // Re-trigger the Order Items merging
          updateAndMergeOrderItems();
        } catch (mapErr: any) {
          console.error("Orders mapping/state reduction failed safely:", mapErr);
          set({ orders: [], connectionStatus: 'connected' });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/orders`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        set({ connectionStatus: 'offline' });
        get().updateDiagnostic('orders', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubOrders);

      // 2. orderItems
      const itemsRef = collection(db, 'restaurants', finalId, 'orderItems');
      const unsubItems = onSnapshot(itemsRef, (snapshot) => {
        try {
          const itemsData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              const id = doc.id;
              const orderId = data.orderId || data.orderID || data.order_id || "";
              const name = data.name || data.itemName || data.title || "Unknown Item";
              const quantity = Number(data.quantity !== undefined ? data.quantity : (data.qty !== undefined ? data.qty : 1));
              const price = Number(data.price !== undefined ? data.price : (data.cost !== undefined ? data.cost : 0));
              const category = data.category || "";
              
              return {
                ...data,
                id,
                orderId,
                name,
                quantity,
                price,
                category
              } as OrderItem;
            } catch (innerErr) {
              console.error(`Failed parsing orderItem document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is OrderItem => doc !== null);

          fetchedItems = itemsData;
          updateAndMergeOrderItems();
        } catch (mapErr: any) {
          console.error("OrderItems mapping/state reduction failed safely:", mapErr);
          set({ orderItems: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/orderItems`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('orderItems', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubItems);

      // 3. orderItemModifiers
      const modRef = collection(db, 'restaurants', finalId, 'orderItemModifiers');
      const unsubMod = onSnapshot(modRef, (snapshot) => {
        try {
          const modData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              return { id: doc.id, ...data } as OrderItemModifier;
            } catch (innerErr) {
              console.error(`Failed parsing modifier document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is OrderItemModifier => doc !== null);
          set({ orderItemModifiers: modData });
          get().updateDiagnostic('orderItemModifiers', modData.length === 0 ? 'empty' : 'active', undefined, modData.length);
        } catch (mapErr: any) {
          console.error("OrderItemModifiers mapping/state reduction failed safely:", mapErr);
          set({ orderItemModifiers: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/orderItemModifiers`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('orderItemModifiers', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubMod);

      // 4. menuItems
      const menuRef = collection(db, 'restaurants', finalId, 'menuItems');
      const unsubMenu = onSnapshot(menuRef, (snapshot) => {
        try {
          const menuData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              const name = data.name || data.itemName || data.title || "Unknown MenuItem";
              const price = Number(data.price !== undefined ? data.price : (data.cost !== undefined ? data.cost : (data.basePrice !== undefined ? data.basePrice : 0)));
              const category = data.category || "General";
              return {
                ...data,
                id: doc.id,
                name,
                price,
                category
              } as MenuItem;
            } catch (innerErr) {
              console.error(`Failed parsing menuItem document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is MenuItem => doc !== null);
          set({ menuItems: menuData });
          get().updateDiagnostic('menuItems', menuData.length === 0 ? 'empty' : 'active', undefined, menuData.length);
        } catch (mapErr: any) {
          console.error("MenuItems mapping/state reduction failed safely:", mapErr);
          set({ menuItems: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/menuItems`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('menuItems', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubMenu);

      // 5. ingredients
      const ingRef = collection(db, 'restaurants', finalId, 'ingredients');
      const unsubIng = onSnapshot(ingRef, (snapshot) => {
        try {
          const ingData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              const name = data.name || data.ingredientName || "Unknown Ingredient";
              const currentQty = Number(data.currentQty !== undefined ? data.currentQty : (data.quantity !== undefined ? data.quantity : (data.currentQuantity !== undefined ? data.currentQuantity : (data.stock !== undefined ? data.stock : 0))));
              const unit = data.unit || "units";
              const lowStockThreshold = Number(data.lowStockThreshold !== undefined ? data.lowStockThreshold : 10);
              const directStock = data.directStock !== undefined ? !!data.directStock : false;
              return {
                ...data,
                id: doc.id,
                name,
                currentQty,
                unit,
                lowStockThreshold,
                directStock
              } as Ingredient;
            } catch (innerErr) {
              console.error(`Failed parsing ingredient document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is Ingredient => doc !== null);
          set({ ingredients: ingData });
          get().updateDiagnostic('ingredients', ingData.length === 0 ? 'empty' : 'active', undefined, ingData.length);
        } catch (mapErr: any) {
          console.error("Ingredients mapping/state reduction failed safely:", mapErr);
          set({ ingredients: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/ingredients`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('ingredients', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubIng);

      // 6. expenses
      const expRef = collection(db, 'restaurants', finalId, 'expenses');
      const unsubExp = onSnapshot(expRef, (snapshot) => {
        try {
          const expData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              const date = data.date || data.createdAt || data.timestamp || new Date().toISOString();
              const category = data.category || "General";
              const amount = Number(data.amount !== undefined ? data.amount : 0);
              const description = data.description || "";
              return {
                ...data,
                id: doc.id,
                date,
                category,
                amount,
                description
              } as Expense;
            } catch (innerErr) {
              console.error(`Failed parsing expense document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is Expense => doc !== null);
          set({ expenses: expData });
          get().updateDiagnostic('expenses', expData.length === 0 ? 'empty' : 'active', undefined, expData.length);
        } catch (mapErr: any) {
          console.error("Expenses mapping/state reduction failed safely:", mapErr);
          set({ expenses: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/expenses`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('expenses', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubExp);

      // 7. expenseCategories
      const expCatRef = collection(db, 'restaurants', finalId, 'expenseCategories');
      const unsubExpCat = onSnapshot(expCatRef, (snapshot) => {
        try {
          const catData = snapshot.docs.map(doc => {
            try {
              const data = doc.data();
              return { id: doc.id, ...data } as ExpenseCategory;
            } catch (innerErr) {
              console.error(`Failed parsing expenseCategory document ${doc.id}:`, innerErr);
              return null;
            }
          }).filter((doc): doc is ExpenseCategory => doc !== null);
          set({ expenseCategories: catData });
          get().updateDiagnostic('expenseCategories', catData.length === 0 ? 'empty' : 'active', undefined, catData.length);
        } catch (mapErr: any) {
          console.error("ExpenseCategories mapping/state reduction failed safely:", mapErr);
          set({ expenseCategories: [] });
        }
      }, (err) => {
        console.group("❌ FIRESTORE STREAM FAILURE DIAGNOSTIC");
        console.error("Collection Path Context:", `restaurants/${finalId}/expenseCategories`);
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.groupEnd();
        get().updateDiagnostic('expenseCategories', 'error', `${err.code}: ${err.message}`, 0);
      });
      unsubscribes.push(unsubExpCat);

    } catch (e: any) {
      console.error("Failed to setup real-time firestore listeners", e);
      set({ connectionStatus: 'offline' });
    }

    return () => {
      console.log(`Cleaning up real-time subscription for restaurant ID: "${finalId}"`);
      unsubscribes.forEach(unsub => unsub());
    };
  },

  simulatePOSActivity: () => {
    // Triggers a random simulated event when called:
    // This makes the owner panel dynamic and verifies real-time responsiveness within 1-2s in demo mode!
    const decision = Math.floor(Math.random() * 4);
    
    // Pick a random MenuItem to generate order for
    const menuItems = get().menuItems;
    if (!menuItems || menuItems.length === 0) return;
    
    const currentOrders = get().orders;
    const currentIngredients = get().ingredients;
    const currentExpenses = get().expenses;

    if (decision === 0) {
      // 0: COMPLETE A NEW ORDER
      const randomCount = Math.floor(Math.random() * 2) + 1;
      const orderNoNum = 2045 + Math.floor(Math.random() * 200);
      const newOrderId = `o_sim_${Date.now()}`;
      
      let itemSum = 0;
      const newItems: OrderItem[] = [];
      const newMods: OrderItemModifier[] = [];

      // Pick random food to add
      for (let i = 0; i < randomCount; i++) {
        const randMeal = menuItems[Math.floor(Math.random() * menuItems.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const itemTotal = randMeal.price * qty;
        itemSum += itemTotal;

        const itemId = `oi_sim_${Date.now()}_${i}`;
        newItems.push({
          id: itemId,
          orderId: newOrderId,
          name: randMeal.name,
          quantity: qty,
          price: randMeal.price,
          category: randMeal.category
        });

        // Chance of mod
        if (randMeal.category === 'Burgers' && Math.random() > 0.5) {
          const modId = `mdf_sim_${Date.now()}_${i}`;
          newMods.push({
            id: modId,
            orderItemId: itemId,
            name: 'Extra Cheddar Cheese',
            price: 1.0
          });
          itemSum += 1.0 * qty;
        }
      }

      const discount = Math.random() > 0.7 ? 5.0 : 0;
      const tax = parseFloat((itemSum * 0.08).toFixed(2));
      const calcTotal = parseFloat((itemSum - discount + tax).toFixed(2));
      const payType = Math.random() > 0.5 ? 'Dine-In' : (Math.random() > 0.5 ? 'Delivery' : 'Takeaway');
      const delCharge = payType === 'Delivery' ? 5.0 : 0;
      
      const newOrder: Order = {
        id: newOrderId,
        orderNo: `#${orderNoNum}`,
        timestamp: new Date().toISOString(),
        type: payType as any,
        status: 'Completed',
        total: parseFloat((calcTotal + delCharge).toFixed(2)),
        cashier: Math.random() > 0.5 ? 'Sarah Connor' : 'John Doe',
        discount,
        tax,
        deliveryCharge: delCharge
      };

      // Decrement inventory stock for materials
      const updatedIngredients = currentIngredients.map(ing => {
        // If bun and order had burger, deduct bun
        if (ing.name === 'Brioche Burger Buns' && newItems.some(ni => ni.category === 'Burgers')) {
          const burgerQty = newItems.filter(ni => ni.category === 'Burgers').reduce((acc, current) => acc + current.quantity, 0);
          return { ...ing, currentQty: Math.max(0, ing.currentQty - burgerQty) };
        }
        if (ing.name === 'Fresh Potatoes (Russet)' && newItems.some(ni => ni.name.includes('Fries'))) {
          return { ...ing, currentQty: Math.max(0, ing.currentQty - 2) };
        }
        return ing;
      });

      set({
        orders: [newOrder, ...currentOrders],
        orderItems: [...get().orderItems, ...newItems],
        orderItemModifiers: [...get().orderItemModifiers, ...newMods],
        ingredients: updatedIngredients
      });

    } else if (decision === 1) {
      // 1: CANCEL A KOT (In-Progress Ticket)
      const orderNoNum = 805 + Math.floor(Math.random() * 100);
      const newOrderId = `o_sim_cx_${Date.now()}`;
      
      const randMeal = menuItems[Math.floor(Math.random() * menuItems.length)];
      
      const newOrder: Order = {
        id: newOrderId,
        orderNo: `#KOT-${orderNoNum}`,
        timestamp: new Date().toISOString(),
        type: 'Dine-In',
        status: 'In-Progress',
        total: randMeal.price,
        cashier: 'Sarah Connor',
        discount: 0,
        tax: parseFloat((randMeal.price * 0.08).toFixed(2)),
        deliveryCharge: 0,
        cancelled: true,
        cancelledAt: new Date().toISOString(),
        cancelledReason: 'Incorrect seat table entered by host staff, cancelled order ticket',
        cancelledBy: 'Sarah Connor'
      };

      const newItem: OrderItem = {
        id: `oi_sim_cx_${Date.now()}`,
        orderId: newOrderId,
        name: randMeal.name,
        quantity: 1,
        price: randMeal.price,
        category: randMeal.category
      };

      set({
        orders: [newOrder, ...currentOrders],
        orderItems: [...get().orderItems, newItem]
      });

    } else if (decision === 2) {
      // 2: DEDUCT FROM INVENTORY (Simulate stock level fluctuations)
      const updatedIngredients = currentIngredients.map(ing => {
        const deduction = Math.floor(Math.random() * 5);
        if (ing.currentQty > deduction && Math.random() > 0.6) {
          return { ...ing, currentQty: ing.currentQty - deduction };
        }
        return ing;
      });
      set({ ingredients: updatedIngredients });

    } else {
      // 3: NEW EXPENSE
      const expNo = currentExpenses.length + 1;
      const expenseList = [
        { desc: 'Emergency premium packaging cartons', cat: 'Inventory & Food Cost', amt: 75.0 },
        { desc: 'Front patio lightbulb replacements', cat: 'Equipment & Repairs', amt: 45.0 },
        { desc: 'Local community newspaper print feature', cat: 'Marketing & Advertising', amt: 150.0 },
        { desc: 'Replenishing standard restroom materials', cat: 'Miscellaneous', amt: 35.0 }
      ];
      const pick = expenseList[Math.floor(Math.random() * expenseList.length)];
      
      const newExpense: Expense = {
        id: `e_sim_${Date.now()}`,
        date: new Date().toISOString(),
        description: pick.desc,
        category: pick.cat,
        amount: pick.amt
      };

      set({ expenses: [newExpense, ...currentExpenses] });
    }
  }
}));

// Function to calculate exact start and end date for quick dates
export function calculateDateLimits(filter: QuickFilterType, customRange?: DateRange) {
  const today = new Date();
  
  switch (filter) {
    case 'TODAY':
      return { start: startOfDay(today), end: endOfDay(today) };
    case 'YESTERDAY': {
      const yesterday = subDays(today, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case 'THIS WEEK':
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
    case 'THIS MONTH':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'LAST MONTH': {
      const prevMonth = subMonths(today, 1);
      return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
    }
    case 'ALL TIME':
      return { start: null, end: null };
    default:
      if (customRange && customRange.startDate) {
        return { 
          start: startOfDay(customRange.startDate), 
          end: customRange.endDate ? endOfDay(customRange.endDate) : endOfDay(customRange.startDate) 
        };
      }
      return { start: null, end: null };
  }
}
