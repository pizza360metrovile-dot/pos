/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { db } from '../lib/db';
import { MenuItem, Category, Order, OrderItem, RestaurantSettings, OrderType, Ingredient, Recipe, RecipeItem, StockLog, KotSnapshot, ModifierGroup, ModifierOption, OrderItemModifier, DealItem, DealOrderComponent, Expense, ExpenseCategory, Cashier } from '../types';
import { toast } from 'sonner';
import { fireStore } from '../lib/firebase';
import { getLocalSubscription, activateLicenseKey, triggerBackgroundSync, SubscriptionSettings, getOrCreateDeviceId, computeChecksum, getRestaurantId } from '../services/licenseService';
import { LicenseData } from '../utils/licenseValidator';
import { getBusinessDate, initializeBusinessDayCutoff } from '../utils/businessDayCalculation';
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
  getDoc,
  enableNetwork,
  disableNetwork
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
  dealItems: DealItem[];
  dealOrderComponents: DealOrderComponent[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  cashiers: Cashier[];
  activeCashierName: string | null;
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
  
  discountType: 'percent' | 'flat' | null;
  discountValue: number;
  setDiscountType: (type: 'percent' | 'flat' | null) => void;
  setDiscountValue: (value: number) => void;
  deliveryCharge: number | null;
  setDeliveryCharge: (charge: number | null) => void;
  
  // Auth & Sync State
  user: AppUser | null;
  isOnline: boolean;
  cloudSync: boolean;
  isQuotaExceeded: boolean;
  isLicenseSyncFailed: boolean;
  syncError: string | null;
  setCloudSync: (enabled: boolean) => Promise<void>;
  lastSynced: number | null;
  lastAction: number;
  sidebarState: 'expanded' | 'collapsed';
  
  // Licensing State & Actions
  subscription: SubscriptionSettings | null;
  activateLicense: (key: string) => Promise<void>;
  syncLicenses: () => Promise<void>;
  licenseData: LicenseData | null;
  isLicenseValid: boolean;
  licenseError: string | null;
  setLicenseData: (license: LicenseData) => void;
  clearLicenseData: () => void;
  checkLicenseValidity: () => Promise<boolean>;

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
  saveDealItems: (dealMenuItemId: string, items: { componentMenuItemId: string; quantity: number; sortOrder: number }[]) => Promise<void>;
  
  // Category Actions
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string | number) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;

  // Cashier Actions
  addCashier: (name: string) => Promise<void>;
  toggleCashierActive: (id: number) => Promise<void>;
  deleteCashier: (id: number) => Promise<void>;
  setActiveCashierName: (name: string | null) => Promise<void>;

  // Expense Actions
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  addExpenseCategory: (category: Omit<ExpenseCategory, 'id'>) => Promise<void>;
  deleteExpenseCategory: (id: number) => Promise<void>;
  updateExpenseCategory: (category: ExpenseCategory) => Promise<void>;
  
  // Order Actions
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string | number, reason?: string, byEmail?: string) => Promise<void>;
  restoreOrder: (id: string | number) => Promise<void>;
  cancelOrder: (id: string | number, reason: string, cashierName: string | null) => Promise<void>;
  
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
  addDealToCart: (item: MenuItem, dealComponents: DealOrderComponent[]) => void;
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
  importData: (jsonOrObj: any) => Promise<void>;
  deleteAllAppData: (keepMenuItems: boolean) => Promise<void>;

  // Global Dialog states
  confirmModal: ConfirmModalState | null;
  promptModal: PromptModalState | null;

  // Remote Kill Switch State & Actions
  globalShutdown: boolean;
  globalShutdownMessage: string;
  restaurantShutdown: boolean;
  restaurantShutdownMessage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  killSwitchListeners: (() => void)[] | null;
  startKillSwitchListeners: () => Promise<void>;
  stopKillSwitchListeners: () => void;
  fetchLatestKillSwitchState: () => Promise<void>;
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


let activeSyncUnsubscribers: (() => void)[] = [];
let licenseExpiryCheckInterval: any = null;

const parseId = (idStr: string): number | string => {
  const num = Number(idStr);
  if (!Number.isNaN(num) && idStr.trim() !== '') {
    return num;
  }
  return idStr;
};


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
  logoDataURL: '',
  logoHeightReceipt: 20,
  logoHeightKOT: 15,
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

async function deductInventory(order: Order, get: () => any) {
  const autoDisabledItems: string[] = [];

  for (const item of order.items) {
    if (item.isDeal) {
      const components = item.dealComponents || await db.dealOrderComponents.where({ orderItemId: item.id }).toArray();
      for (const comp of components) {
        const componentMenuItem = await db.menuItems.get(comp.componentMenuItemId);
        if (componentMenuItem) {
          const categoryId = isNaN(Number(componentMenuItem.categoryId)) ? componentMenuItem.categoryId : Number(componentMenuItem.categoryId);
          const category = await db.categories.get(categoryId);
          const deductQty = comp.quantity || 1;

          if (category?.type === 'stocked') {
            const newDirectStock = Math.max(0, componentMenuItem.directStock - deductQty);
            const isOut = newDirectStock <= 0;
            const updatedItem = { 
              ...componentMenuItem, 
              directStock: newDirectStock,
              isActive: isOut ? false : componentMenuItem.isActive,
              disabledReason: isOut ? 'out_of_stock' : componentMenuItem.disabledReason
            };
            await db.menuItems.update(componentMenuItem.id, updatedItem as any);
            get().syncToFirebase('menuItems', componentMenuItem.id, updatedItem);

            const logEntry: StockLog = {
              menuItemId: componentMenuItem.id,
              changeAmount: -deductQty,
              reason: 'sale',
              remainingAfter: newDirectStock,
              createdAt: Date.now()
            };
            const logId = await db.stockLog.add(logEntry);
            get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

            if (newDirectStock === 0) {
              toast.warning(`Component "${componentMenuItem.name}" is now out of stock and has been hidden from the menu`);
            } else if (newDirectStock <= componentMenuItem.minStock) {
              toast.warning(`Component "${componentMenuItem.name}" stock is low — only ${newDirectStock} remaining`);
            }
          }

          const recipe = await db.recipes.where({ menuItemId: componentMenuItem.id }).first();
          if (recipe && category?.type === 'prepared') {
            const recipeItems = await db.recipeItems.where({ recipeId: recipe.id }).toArray();
            for (const rItem of recipeItems) {
              const ingredient = await db.ingredients.get(rItem.ingredientId!);
              if (ingredient) {
                const deduction = rItem.quantityUsed * deductQty;
                const newStock = ingredient.currentStock - deduction;
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

                if (newStock < 0) {
                  toast.warning(`Ingredient "${ingredient.name}" current stock is insufficient. Deficit logged: ${newStock.toFixed(2)} ${ingredient.unit}`);
                } else if (newStock <= ingredient.reorderThreshold) {
                  toast.warning(`Ingredient "${ingredient.name}" stock is low — only ${newStock.toFixed(2)} ${ingredient.unit} remaining`);
                }

                if (newStock <= 0) {
                  const affectedRecipes = await db.recipeItems.where({ ingredientId: ingredient.id! }).toArray();
                  for (const affRecipeItem of affectedRecipes) {
                    const affRecipe = await db.recipes.get(affRecipeItem.recipeId);
                    if (affRecipe) {
                      const affMenuItem = await db.menuItems.get(affRecipe.menuItemId);
                      if (affMenuItem && affMenuItem.isActive) {
                        const affCategoryId = isNaN(Number(affMenuItem.categoryId)) ? affMenuItem.categoryId : Number(affMenuItem.categoryId);
                        const affCategory = await db.categories.get(affCategoryId);
                        if (affCategory?.type === 'stocked') {
                          const updatedAffItem = { 
                            ...affMenuItem, 
                            isActive: false,
                            disabledReason: 'out_of_stock'
                          } as MenuItem;
                          await db.menuItems.update(affMenuItem.id, updatedAffItem as any);
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
      }
      continue;
    }

    // 1. Stock deduction for the item itself if it is a 'stocked' type
    const menuItem = await db.menuItems.get(item.menuItemId);
    if (menuItem) {
      const categoryId = isNaN(Number(menuItem.categoryId)) ? menuItem.categoryId : Number(menuItem.categoryId);
      const category = await db.categories.get(categoryId);
      
      if (category?.type === 'stocked') {
        const newDirectStock = Math.max(0, menuItem.directStock - item.quantity);
        const isOut = newDirectStock <= 0;
        const updatedItem = { 
          ...menuItem, 
          directStock: newDirectStock,
          isActive: isOut ? false : menuItem.isActive,
          disabledReason: isOut ? 'out_of_stock' : menuItem.disabledReason
        };
        await db.menuItems.update(menuItem.id, updatedItem as any);
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
          // Subtract the exact quantity defined in the recipe, allowing negative stock
          const newStock = ingredient.currentStock - deduction;
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

          if (newStock < 0) {
            // Low stock alert with negative deficit logged
            toast.warning(`Ingredient "${ingredient.name}" current stock is insufficient. Deficit logged: ${newStock.toFixed(2)} ${ingredient.unit}`);
          } else if (newStock <= ingredient.reorderThreshold) {
            toast.warning(`Ingredient "${ingredient.name}" stock is low — only ${newStock.toFixed(2)} ${ingredient.unit} remaining`);
          }

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
                    await db.menuItems.update(affMenuItem.id, updatedAffItem as any);
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

async function deductInventoryOnRestore(order: Order, get: () => any) {
  const autoDisabledItems: string[] = [];
  const items = order.items || await db.orderItems.where({ orderId: order.id }).toArray();

  for (const item of items) {
    if (item.isDeal) {
      const components = item.dealComponents || await db.dealOrderComponents.where({ orderItemId: item.id }).toArray();
      for (const comp of components) {
        const componentMenuItem = await db.menuItems.get(comp.componentMenuItemId);
        if (componentMenuItem) {
          const categoryId = isNaN(Number(componentMenuItem.categoryId)) ? componentMenuItem.categoryId : Number(componentMenuItem.categoryId);
          const category = await db.categories.get(categoryId);
          const deductQty = comp.quantity || 1;

          if (category?.type === 'stocked') {
            const newDirectStock = Math.max(0, componentMenuItem.directStock - deductQty);
            const isOut = newDirectStock <= 0;
            const updatedItem = { 
              ...componentMenuItem, 
              directStock: newDirectStock,
              isActive: isOut ? false : componentMenuItem.isActive,
              disabledReason: isOut ? 'out_of_stock' : componentMenuItem.disabledReason
            };
            await db.menuItems.update(componentMenuItem.id, updatedItem as any);
            get().syncToFirebase('menuItems', componentMenuItem.id, updatedItem);

            const logEntry: StockLog = {
              menuItemId: componentMenuItem.id,
              changeAmount: -deductQty,
              reason: 'order_restored',
              remainingAfter: newDirectStock,
              createdAt: Date.now()
            };
            const logId = await db.stockLog.add(logEntry);
            get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

            if (newDirectStock === 0) {
              toast.warning(`Component "${componentMenuItem.name}" is now out of stock and has been hidden from the menu`);
            } else if (newDirectStock <= componentMenuItem.minStock) {
              toast.warning(`Component "${componentMenuItem.name}" stock is low — only ${newDirectStock} remaining`);
            }
          }

          const recipe = await db.recipes.where({ menuItemId: componentMenuItem.id }).first();
          if (recipe && category?.type === 'prepared') {
            const recipeItems = await db.recipeItems.where({ recipeId: recipe.id }).toArray();
            for (const rItem of recipeItems) {
              const ingredient = await db.ingredients.get(rItem.ingredientId!);
              if (ingredient) {
                const deduction = rItem.quantityUsed * deductQty;
                const newStock = ingredient.currentStock - deduction;
                const updatedIngredient = { ...ingredient, currentStock: newStock };
                
                await db.ingredients.update(ingredient.id!, updatedIngredient);
                get().syncToFirebase('ingredients', ingredient.id!, updatedIngredient);
                
                const logEntry = {
                  ingredientId: ingredient.id!,
                  changeAmount: -deduction,
                  reason: 'order_restored',
                  remainingAfter: newStock,
                  createdAt: Date.now()
                };
                const logId = await db.stockLog.add(logEntry);
                get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

                if (newStock < 0) {
                  toast.warning(`Ingredient "${ingredient.name}" current stock is insufficient. Deficit logged: ${newStock.toFixed(2)} ${ingredient.unit}`);
                } else if (newStock <= ingredient.reorderThreshold) {
                  toast.warning(`Ingredient "${ingredient.name}" stock is low — only ${newStock.toFixed(2)} ${ingredient.unit} remaining`);
                }

                if (newStock <= 0) {
                  const affectedRecipes = await db.recipeItems.where({ ingredientId: ingredient.id! }).toArray();
                  for (const affRecipeItem of affectedRecipes) {
                    const affRecipe = await db.recipes.get(affRecipeItem.recipeId);
                    if (affRecipe) {
                      const affMenuItem = await db.menuItems.get(affRecipe.menuItemId);
                      if (affMenuItem && affMenuItem.isActive) {
                        const affCategoryId = isNaN(Number(affMenuItem.categoryId)) ? affMenuItem.categoryId : Number(affMenuItem.categoryId);
                        const affCategory = await db.categories.get(affCategoryId);
                        if (affCategory?.type === 'stocked') {
                          const updatedAffItem = { 
                            ...affMenuItem, 
                            isActive: false,
                            disabledReason: 'out_of_stock'
                          } as MenuItem;
                          await db.menuItems.update(affMenuItem.id, updatedAffItem as any);
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
      }
      continue;
    }

    // 1. Stock deduction for the item itself if it is a 'stocked' type
    const menuItem = await db.menuItems.get(item.menuItemId);
    if (menuItem) {
      const categoryId = isNaN(Number(menuItem.categoryId)) ? menuItem.categoryId : Number(menuItem.categoryId);
      const category = await db.categories.get(categoryId);
      
      if (category?.type === 'stocked') {
        const newDirectStock = Math.max(0, menuItem.directStock - item.quantity);
        const isOut = newDirectStock <= 0;
        const updatedItem = { 
          ...menuItem, 
          directStock: newDirectStock,
          isActive: isOut ? false : menuItem.isActive,
          disabledReason: isOut ? 'out_of_stock' : menuItem.disabledReason
        };
        await db.menuItems.update(menuItem.id, updatedItem as any);
        get().syncToFirebase('menuItems', menuItem.id, updatedItem);

        // Stock Log for restored order (making a deduction)
        const logEntry: StockLog = {
          menuItemId: menuItem.id,
          changeAmount: -item.quantity,
          reason: 'order_restored',
          remainingAfter: newDirectStock,
          createdAt: Date.now(),
          note: `Order #${order.id} restored`
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
          // Subtract the exact quantity defined in the recipe, allowing negative stock
          const newStock = ingredient.currentStock - deduction;
          const updatedIngredient = { ...ingredient, currentStock: newStock };
          
          await db.ingredients.update(ingredient.id!, updatedIngredient);
          get().syncToFirebase('ingredients', ingredient.id!, updatedIngredient);
          
          const logEntry = {
            ingredientId: ingredient.id!,
            changeAmount: -deduction,
            reason: 'order_restored',
            remainingAfter: newStock,
            createdAt: Date.now(),
            note: `Order #${order.id} restored`
          };
          const logId = await db.stockLog.add(logEntry);
          get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

          if (newStock < 0) {
            // Low stock alert with negative deficit logged
            toast.warning(`Ingredient "${ingredient.name}" current stock is insufficient. Deficit logged: ${newStock.toFixed(2)} ${ingredient.unit}`);
          } else if (newStock <= ingredient.reorderThreshold) {
            toast.warning(`Ingredient "${ingredient.name}" stock is low — only ${newStock.toFixed(2)} ${ingredient.unit} remaining`);
          }

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
                    await db.menuItems.update(affMenuItem.id, updatedAffItem as any);
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

let syncRetryCount = 0;
let syncRetryTimeout: any = null;
const MAX_RETRIES = 3;

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
  dealItems: [],
  dealOrderComponents: [],
  expenses: [],
  expenseCategories: [],
  cashiers: [],
  activeCashierName: null,
  isLoading: true,
  user: null,
  isOnline: typeof window !== 'undefined' ? window.navigator.onLine : true,
  cloudSync: true,
  isQuotaExceeded: false,
  isLicenseSyncFailed: false,
  syncError: null,
  lastSynced: null,
  lastAction: Date.now(),
  sidebarState: 'expanded',
  subscription: null,
  licenseData: null,
  isLicenseValid: false,
  licenseError: null,
  
  setLicenseData: (license) => {
    set({ licenseData: license, isLicenseValid: true })
  },
  
  clearLicenseData: () => {
    set({ 
      licenseData: null, 
      isLicenseValid: false,
      licenseError: null 
    })
  },
  
  checkLicenseValidity: async () => {
    const state = get()
    if (!state.licenseData) return false
    
    const isExpired = 
      Date.now() > state.licenseData.validUntil
    
    return !isExpired
  },
  confirmModal: null,
  promptModal: null,

  // Remote Kill Switch default values
  globalShutdown: false,
  globalShutdownMessage: '',
  restaurantShutdown: false,
  restaurantShutdownMessage: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  killSwitchListeners: null,

  // POS Initial State
  cart: [],
  orderType: OrderType.DINE_IN,
  customerName: '',
  tableNumber: '',
  activeOrder: null,
  deliveryChargeWaived: false,
  deliveryChargeWaivedReason: '',
  discountType: 'percent',
  discountValue: 0,
  deliveryCharge: null,

  init: async () => {
    set({ isLoading: true });

    // Read sync setting
    const syncObj = await db.appMeta.get('_sync');
    const isSyncEnabled = syncObj ? syncObj.value !== false : true;
    set({ cloudSync: isSyncEnabled });
    if (!isSyncEnabled && fireStore) {
      try {
        await disableNetwork(fireStore);
        set({ isOnline: false });
      } catch (err) {
        console.warn('Failed to disable firestore network on init:', err);
      }
    }

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
      if (get().cloudSync) {
        set({ isOnline: true });
        triggerBackgroundSync().catch(err => console.warn('Background sync on network restore failed:', err));
      }
    });
    window.addEventListener('offline', () => {
      if (get().cloudSync) {
        set({ isOnline: false });
      }
    });

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

    // Initialize businessDayCutoff setting and run migration for older data
    await initializeBusinessDayCutoff();
    try {
      const ordersToMigrate = await db.orders.toArray();
      for (const order of ordersToMigrate) {
        let changed = false;

        // Ensure businessDate is convert to ms first if stored as other types
        if (order.businessDate && typeof order.businessDate === 'object' && typeof order.businessDate.seconds === 'number') {
          order.businessDate = order.businessDate.seconds * 1000;
          changed = true;
        } else if (order.businessDate instanceof Date || (order.businessDate && typeof order.businessDate.getTime === 'function')) {
          order.businessDate = order.businessDate.getTime();
          changed = true;
        } else if (typeof order.businessDate === 'string') {
          const parsed = new Date(order.businessDate).getTime();
          if (!isNaN(parsed)) {
            order.businessDate = parsed;
            changed = true;
          }
        }

        const completedTime = order.completedAt || order.createdAt || Date.now();
        const correctBusDate = getBusinessDate(completedTime).getTime();

        if (order.businessDate !== correctBusDate) {
          order.businessDate = correctBusDate;
          if (order.status === 'completed' && !order.completedAt) {
            order.completedAt = completedTime;
          }
          changed = true;
        }

        if (changed) {
          await db.orders.put(order);
          get().syncToFirebase('orders', order.id, order);
        }
      }

      const expensesToMigrate = await db.expenses.toArray();
      for (const expense of expensesToMigrate) {
        let changed = false;

        if (expense.businessDate && typeof expense.businessDate === 'object' && typeof expense.businessDate.seconds === 'number') {
          expense.businessDate = expense.businessDate.seconds * 1000;
          changed = true;
        } else if (expense.businessDate instanceof Date || (expense.businessDate && typeof expense.businessDate.getTime === 'function')) {
          expense.businessDate = expense.businessDate.getTime();
          changed = true;
        } else if (typeof expense.businessDate === 'string') {
          const parsed = new Date(expense.businessDate).getTime();
          if (!isNaN(parsed)) {
            expense.businessDate = parsed;
            changed = true;
          }
        }

        const correctBusDate = getBusinessDate(expense.date).getTime();

        if (expense.businessDate !== correctBusDate) {
          expense.businessDate = correctBusDate;
          changed = true;
        }

        if (changed) {
          await db.expenses.put(expense);
          get().syncToFirebase('expenses', expense.id!, expense);
        }
      }
    } catch (migErr) {
      console.warn('Migration for businessDayCutoff and businessDate failed:', migErr);
    }

    // Initial load from Dexie
    let categories = await db.categories.toArray();
    let menuItems = await db.menuItems.toArray();
    const dealItems = await db.dealItems.toArray();
    set({ dealItems });

    // Load and seed expenses / categories
    const expenses = await db.expenses.orderBy('date').reverse().toArray();
    let expenseCategories = await db.expenseCategories.toArray();
    if (expenseCategories.length === 0) {
      const DEFAULT_EXPENSE_CATEGORIES = [
        { name: 'Rent' },
        { name: 'Salaries' },
        { name: 'Utilities' },
        { name: 'Raw Materials' },
        { name: 'Maintenance' },
        { name: 'Other' }
      ];
      await db.expenseCategories.bulkAdd(DEFAULT_EXPENSE_CATEGORIES);
      expenseCategories = await db.expenseCategories.toArray();
    }
    set({ expenses, expenseCategories });

    // Revert/Cleanup: Delete any existing Deals category and deal items from IndexedDB
    if (categories.some(c => c.id === 'deals-cat' || c.name === 'Deals')) {
      try {
        await db.categories.delete('deals-cat');
        categories = categories.filter(c => c.id !== 'deals-cat');
      } catch (err) {
        console.warn('Failed to clean up deals category', err);
      }
    }
    if (menuItems.some(i => i.id === 'deal-1' || i.id === 'deal-2')) {
      try {
        await db.menuItems.delete('deal-1');
        await db.menuItems.delete('deal-2');
        menuItems = menuItems.filter(i => i.id !== 'deal-1' && i.id !== 'deal-2');
      } catch (err) {
        console.warn('Failed to clean up deal items', err);
      }
    }

    const settingsEntry = await db.settings.where({ key: 'main' }).first();
    const settings = settingsEntry ? settingsEntry.value : DEFAULT_SETTINGS;

    // Clear any temporary 'in-progress' orders from previous sessions to prevent persistence
    try {
      const inProgressInDb = await db.orders.where({ status: 'in-progress' }).toArray();
      for (const order of inProgressInDb) {
        await db.orders.delete(order.id);
        get().syncToFirebase('orders', order.id, null);
        // Delete corresponding order items
        const oItems = await db.orderItems.where({ orderId: order.id }).toArray();
        for (const item of oItems) {
          await db.orderItems.delete(item.id!);
          get().syncToFirebase('orderItems', item.id!, null);
        }
      }
    } catch (err) {
      console.warn('Failed to clean up in-progress orders on init:', err);
    }

    const orders = await db.orders.orderBy('createdAt').reverse().toArray();
    const ingredients = await db.ingredients.toArray();
    const recipes = await db.recipes.toArray();
    const recipeItems = await db.recipeItems.toArray();
    const stockLogs = await db.stockLog.orderBy('createdAt').reverse().toArray();
    const kotSnapshots = await db.kotSnapshots.toArray();
    const modifierGroups = await db.modifierGroups.toArray();
    const modifierOptions = await db.modifierOptions.toArray();
    const cashiers = await db.cashiers.toArray();
    const activeCashierRecord = await db.appMeta.get('_activeCashier');
    const activeCashierName = activeCashierRecord ? activeCashierRecord.value : null;
    
    // Ensure stable device ID is generated once
    await getOrCreateDeviceId();

    // 4.5 Launch License Check Sequence
    const keyRecord = await db.appMeta.get('_xe');
    const expiresAt = Number(keyRecord?.value);
    const now = Date.now();

    if (isNaN(expiresAt)) {
      // expiresAt corrupt or missing
      await db.appMeta.delete('_ki');
      await db.appMeta.delete('_xe');
      await db.appMeta.delete('_ia');
      await db.appMeta.delete('_cs');
      await db.appMeta.delete('_lv');
      await db.appMeta.delete('_warn');

      const subscription = { expiryDate: 0 };
      await db.settings.put({ key: 'subscriptionSettings', value: subscription });
      const mergedSettings = { ...settings, licenseExpiry: 0 };
      set({
        categories,
        menuItems,
        settings: mergedSettings,
        orders,
        ingredients,
        recipes,
        recipeItems,
        stockLogs,
        kotSnapshots,
        modifierGroups,
        modifierOptions,
        subscription,
        isLoading: false
      });
      return; // Stop here.
    }

    if (expiresAt <= now) {
      // License expired
      const subscription = { expiryDate: expiresAt };
      await db.settings.put({ key: 'subscriptionSettings', value: subscription });
      const mergedSettings = { ...settings, licenseExpiry: expiresAt };
      set({
        categories,
        menuItems,
        settings: mergedSettings,
        orders,
        ingredients,
        recipes,
        recipeItems,
        stockLogs,
        kotSnapshots,
        modifierGroups,
        modifierOptions,
        subscription,
        isLoading: false
      });
      return; // Stop here.
    }

    if ((expiresAt - now) <= 10 * 24 * 60 * 60 * 1000) {
      // 10 days or less remaining
      await db.appMeta.put({
        key: '_warn', value: true
      });
    } else {
      await db.appMeta.delete('_warn');
    }

    // Now proceed with normal cryptographic signature and checksum check
    const ki = await db.appMeta.get('_ki');
    const di = await db.appMeta.get('_di');
    const cs = await db.appMeta.get('_cs');

    let licenseValid = false;
    let finalExpiry = 0;

    if (ki && di && cs && ki.value !== undefined && di.value !== undefined && cs.value !== undefined) {
      const recomputed = await computeChecksum(ki.value, expiresAt, di.value);
      if (recomputed === cs.value) {
        licenseValid = true;
        finalExpiry = expiresAt;
      } else {
        // Mismatch: clear appMeta (keeping deviceId)
        await db.appMeta.delete('_ki');
        await db.appMeta.delete('_xe');
        await db.appMeta.delete('_ia');
        await db.appMeta.delete('_cs');
        await db.appMeta.delete('_lv');
        await db.appMeta.delete('_warn');
      }
    }

    if (!licenseValid) {
      // If signature mismatch or not valid, treat as 0
      finalExpiry = 0;
      const subscription = { expiryDate: 0 };
      await db.settings.put({ key: 'subscriptionSettings', value: subscription });
      const mergedSettings = { ...settings, licenseExpiry: 0 };
      set({
        categories,
        menuItems,
        settings: mergedSettings,
        orders,
        ingredients,
        recipes,
        recipeItems,
        stockLogs,
        kotSnapshots,
        modifierGroups,
        modifierOptions,
        subscription,
        isLoading: false
      });
      return;
    }

    // Start real-time expiry interval check while app is open
    if (!licenseExpiryCheckInterval) {
      licenseExpiryCheckInterval = setInterval(async () => {
        const record = await db.appMeta.get('_xe');
        const expiresAtVal = Number(record?.value);
        if (expiresAtVal && expiresAtVal <= Date.now()) {
          // License just expired while app was open
          window.location.reload();
          // Reload triggers launch check 
          // which shows hard stop screen
        }
      }, 60 * 60 * 1000);
    }

    // Update local subscriptionSettings to stay in sync with our verified check
    await db.settings.put({ key: 'subscriptionSettings', value: { expiryDate: finalExpiry } });
    const subscription = { expiryDate: finalExpiry };

    // 4.6 Launch Remote Kill Switch sequence (STEP 1, 2, 3)
    const cachedSd = await db.appMeta.get('_sd');
    const cachedRsd = await db.appMeta.get('_rsd');
    const cachedMm = await db.appMeta.get('_mm');
    const cachedSdMsg = await db.appMeta.get('_sd_msg');
    const cachedRsdMsg = await db.appMeta.get('_rsd_msg');
    const cachedMmMsg = await db.appMeta.get('_mm_msg');

    const localShutdown = cachedSd?.value === true;
    const localRShutdown = cachedRsd?.value === true;
    const localMaintenance = cachedMm?.value === true;

    set({
      globalShutdown: localShutdown,
      globalShutdownMessage: cachedSdMsg?.value || '',
      restaurantShutdown: localRShutdown,
      restaurantShutdownMessage: cachedRsdMsg?.value || '',
      maintenanceMode: localMaintenance,
      maintenanceMessage: cachedMmMsg?.value || '',
    });

    // STEP 1 — Read local cached state from Dexie:
    if (localShutdown || localRShutdown) {
      // Show shutdown screen immediately. Do not check internet. Do not proceed to login/app.
      const mergedSettings = { ...settings, licenseExpiry: subscription?.expiryDate };
      set({ 
        categories, 
        menuItems, 
        settings: mergedSettings, 
        orders, 
        ingredients,
        recipes,
        recipeItems,
        stockLogs,
        kotSnapshots,
        modifierGroups,
        modifierOptions,
        subscription,
        isLoading: false 
      });
      return;
    }

    if (localMaintenance) {
      // Show maintenance screen immediately. Show retry button that attempts Firebase fetch only.
      const mergedSettings = { ...settings, licenseExpiry: subscription?.expiryDate };
      set({ 
        categories, 
        menuItems, 
        settings: mergedSettings, 
        orders, 
        ingredients,
        recipes,
        recipeItems,
        stockLogs,
        kotSnapshots,
        modifierGroups,
        modifierOptions,
        subscription,
        isLoading: false 
      });
      return;
    }

    // STEP 2 — If online and cloudSync is enabled, fetch Firebase to get latest state:
    if (navigator.onLine && fireStore && isSyncEnabled) {
      try {
        const rid = await getRestaurantId();
        const globalDocRef = doc(fireStore, 'appControl', 'global');
        const restDocRef = doc(fireStore, 'appControl', rid);

        const [globalSnap, restSnap] = await Promise.all([
          getDoc(globalDocRef),
          getDoc(restDocRef)
        ]);

        const globalData = globalSnap.exists() ? globalSnap.data() : null;
        const restData = restSnap.exists() ? restSnap.data() : null;

        const remoteShutdown = globalData?.shutdown === true;
        const remoteRShutdown = restData?.shutdown === true;
        const remoteMaintenance = globalData?.maintenanceMode === true;

        const remoteShutdownMsg = globalData?.shutdownMessage || '';
        const remoteRShutdownMsg = restData?.shutdownMessage || '';
        const remoteMaintenanceMsg = globalData?.maintenanceMessage || '';

        // If either shutdown is true: save to Dexie, show shutdown screen, stop here.
        if (remoteShutdown || remoteRShutdown) {
          if (remoteShutdown) {
            await db.appMeta.put({ key: '_sd', value: true });
            if (remoteShutdownMsg) await db.appMeta.put({ key: '_sd_msg', value: remoteShutdownMsg });
          }
          if (remoteRShutdown) {
            await db.appMeta.put({ key: '_rsd', value: true });
            if (remoteRShutdownMsg) await db.appMeta.put({ key: '_rsd_msg', value: remoteRShutdownMsg });
          }

          set({
            globalShutdown: remoteShutdown,
            globalShutdownMessage: remoteShutdownMsg,
            restaurantShutdown: remoteRShutdown,
            restaurantShutdownMessage: remoteRShutdownMsg,
          });

          const mergedSettings = { ...settings, licenseExpiry: subscription?.expiryDate };
          set({
            categories,
            menuItems,
            settings: mergedSettings,
            orders,
            ingredients,
            recipes,
            recipeItems,
            stockLogs,
            kotSnapshots,
            modifierGroups,
            modifierOptions,
            subscription,
            isLoading: false
          });
          return;
        } else {
          // If global.shutdown === false AND restaurant.shutdown === false:
          // Delete '_sd' and '_rsd' from Dexie (clears cached shutdown — app unlocked)
          await db.appMeta.delete('_sd');
          await db.appMeta.delete('_sd_msg');
          await db.appMeta.delete('_rsd');
          await db.appMeta.delete('_rsd_msg');
          
          set({
            globalShutdown: false,
            restaurantShutdown: false,
            globalShutdownMessage: '',
            restaurantShutdownMessage: ''
          });
        }

        if (remoteMaintenance) {
          // Save '_mm': true to Dexie, show maintenance screen, stop here.
          await db.appMeta.put({ key: '_mm', value: true });
          if (remoteMaintenanceMsg) await db.appMeta.put({ key: '_mm_msg', value: remoteMaintenanceMsg });

          set({
            maintenanceMode: true,
            maintenanceMessage: remoteMaintenanceMsg,
          });

          const mergedSettings = { ...settings, licenseExpiry: subscription?.expiryDate };
          set({
            categories,
            menuItems,
            settings: mergedSettings,
            orders,
            ingredients,
            recipes,
            recipeItems,
            stockLogs,
            kotSnapshots,
            modifierGroups,
            modifierOptions,
            subscription,
            isLoading: false
          });
          return;
        } else {
          // Delete '_mm' from Dexie
          await db.appMeta.delete('_mm');
          await db.appMeta.delete('_mm_msg');
          set({
            maintenanceMode: false,
            maintenanceMessage: ''
          });
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('offline') || err?.code === 'unavailable' || !navigator.onLine) {
          console.warn('Launcher remote kill switch validation skipped: client is offline.');
          set({ isOnline: false });
        } else {
          console.error('Error during launcher remote kill switch validation:', err);
        }
      }
    }

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
          await db.menuItems.update(item.id, repairedMenuItems[i] as any);
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
      cashiers,
      activeCashierName,
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

    const { doc, getDoc, getDocs, collection } = await import('firebase/firestore');

    const parseId = (idStr: string): number | string => {
      const num = Number(idStr);
      if (!Number.isNaN(num) && idStr.trim() !== '') {
        return num;
      }
      return idStr;
    };

    const getDocWithTimeout = (docRef: any, timeoutMs: number = 3000) => {
      return Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore connection timeout')), timeoutMs)
        )
      ]);
    };

    try {
      const settingsSnap = await getDocWithTimeout(doc(fireStore, 'restaurants', uid), 3000);
      
      // Success! Reset tracking state
      syncRetryCount = 0;
      if (syncRetryTimeout) {
        clearTimeout(syncRetryTimeout);
        syncRetryTimeout = null;
      }
      set({ syncError: null, isOnline: true });

      if (settingsSnap.exists()) {
        console.log('Restaurants settings exist on Firestore. Restoring collections to local Dexie (first device migration)...');
        
        // 1. Settings restoration
        const remoteSettings = settingsSnap.data() as RestaurantSettings;
        await db.settings.put({ key: 'main', value: remoteSettings });

        // 2. Clear out other tables and restore all from Firestore
        const collectionsToPull = [
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
          { name: 'orderItemModifiers', table: db.orderItemModifiers },
          { name: 'dealItems', table: db.dealItems },
          { name: 'dealOrderComponents', table: db.dealOrderComponents },
          { name: 'expenses', table: db.expenses },
          { name: 'expenseCategories', table: db.expenseCategories },
          { name: 'cashiers', table: db.cashiers }
        ];

        for (const col of collectionsToPull) {
          const querySnap = await getDocs(collection(fireStore, `restaurants/${uid}/${col.name}`));
          // Run in write transaction marked fromFirestore to prevent hook infinite loop syncing
          await db.transaction('rw', [col.table], async (tx: any) => {
            tx.fromFirestore = true;
            // Clear current table contents first before restoring
            await col.table.clear();
            for (const docObj of querySnap.docs) {
              const data = docObj.data();
              const docId = parseId(docObj.id);
              await col.table.put({
                ...data,
                id: docId
              } as any);
            }
          });
        }

        // Hydrate Zustand store slices
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
        const dealItems = await db.dealItems.toArray();
        const dealOrderComponents = await db.dealOrderComponents.toArray();
        const expenses = await db.expenses.orderBy('date').reverse().toArray();
        const expenseCategories = await db.expenseCategories.toArray();

        const d_cashiers = await db.cashiers.toArray();

        set({
          categories,
          menuItems,
          settings: { ...settings, licenseExpiry: get().subscription?.expiryDate },
          orders,
          ingredients,
          recipes,
          recipeItems,
          stockLogs,
          kotSnapshots,
          modifierGroups,
          modifierOptions,
          dealItems,
          dealOrderComponents,
          expenses,
          expenseCategories,
          cashiers: d_cashiers,
          isOnline: true
        });
      } else {
        // Firestore is empty - push local local Dexie data to Firestore (first device migration)
        console.log('No settings found on Firestore. Running force sync of local data to Cloud...');
        await get().forceSync();
      }

      // Now start the listeners only on success
      const { initAllListeners } = await import('../services/firestoreListeners');
      await initAllListeners(uid);

    } catch (err: any) {
      console.warn('Initial sync check / migration failed or ran offline:', err.message);
      
      if (err.message?.toLowerCase().includes('offline') || err.code === 'unavailable' || err.message?.toLowerCase().includes('timeout')) {
        set({ isOnline: false });
        try {
          await disableNetwork(fireStore);
        } catch (networkErr) {
          console.warn('Failed to disable Firestore network during fallback:', networkErr);
        }
      }

      if (syncRetryCount >= MAX_RETRIES) {
        console.error('setupSync: Max retries reached, giving up');
        set({ syncError: 'Firestore connection timeout. Using local offline mode.' });
        return; // STOP - Don't retry, run completely in local offline mode
      }

      syncRetryCount++;
      const delayMs = Math.min(1000 * Math.pow(2, syncRetryCount), 10000);
      console.warn(`setupSync retry ${syncRetryCount}/${MAX_RETRIES} in ${delayMs}ms`);

      if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
      syncRetryTimeout = setTimeout(() => {
        get().setupSync(uid);
      }, delayMs);
    }
  },

  syncToFirebase: async (collectionName: string, id: string | number, data: any) => {
    const { user, cloudSync } = get();
    if (!user || !fireStore || !cloudSync) return;
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

  setCloudSync: async (enabled: boolean) => {
    if (!fireStore) {
      toast.error('Firebase is not configured.');
      return;
    }
    try {
      if (enabled) {
        // Reset retry count on manual toggle
        syncRetryCount = 0;
        if (syncRetryTimeout) {
          clearTimeout(syncRetryTimeout);
          syncRetryTimeout = null;
        }
        set({ syncError: null });

        await enableNetwork(fireStore);
        await db.appMeta.put({ key: '_sync', value: true });
        set({ cloudSync: true, isOnline: window.navigator.onLine });
        
        const { user } = get();
        if (user) {
          set({ isLoading: true });
          toast.info('Synchronizing data from cloud...');
          
          const uid = user.uid;
          const basePath = `restaurants/${uid}`;
          
          try {
            // Document Pull: settings
            const settingsSnap = await getDoc(doc(fireStore, basePath));
            if (settingsSnap.exists()) {
              await db.transaction('rw', [db.settings], async (tx: any) => {
                tx.fromFirestore = true;
                await db.settings.put({ key: 'main', value: settingsSnap.data() });
              });
            }

            // Collection Pull: fetch each and put to Dexie
            const collectionsToPull = [
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
              { name: 'orderItemModifiers', table: db.orderItemModifiers },
              { name: 'dealItems', table: db.dealItems },
              { name: 'dealOrderComponents', table: db.dealOrderComponents },
              { name: 'expenses', table: db.expenses },
              { name: 'expenseCategories', table: db.expenseCategories },
              { name: 'cashiers', table: db.cashiers }
            ];

            for (const col of collectionsToPull) {
              const querySnap = await getDocs(collection(fireStore, basePath, col.name));
              await db.transaction('rw', [col.table], async (tx: any) => {
                tx.fromFirestore = true;
                for (const docObj of querySnap.docs) {
                  const data = docObj.data();
                  const docId = parseId(docObj.id);
                  await col.table.put({
                    ...data,
                    id: docId
                  } as any);
                }
              });
            }

            // Rehydrate Zustand store from the newly populated IndexDB tables:
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
            const dealItems = await db.dealItems.toArray();
            const dealOrderComponents = await db.dealOrderComponents.toArray();
            const expenses = await db.expenses.orderBy('date').reverse().toArray();
            const expenseCategories = await db.expenseCategories.toArray();
            const d_cashiers = await db.cashiers.toArray();

            const mergedSettings = { ...settings, licenseExpiry: get().subscription?.expiryDate };

            set({
              categories,
              menuItems,
              settings: mergedSettings,
              orders,
              ingredients,
              recipes,
              recipeItems,
              stockLogs,
              kotSnapshots,
              modifierGroups,
              modifierOptions,
              dealItems,
              dealOrderComponents,
              expenses,
              expenseCategories,
              cashiers: d_cashiers,
              isLoading: false
            });

            toast.success('Cloud sync enabled. Data restored from cloud.');

          } catch (fetchErr: any) {
            console.error('Failed to pull Firestore data during sync activation:', fetchErr);
            toast.error('Sync enabled, but failed to retrieve latest database: ' + fetchErr.message);
            set({ isLoading: false });
          }

          // Restart Firestore snapshot listeners - clean old ones first
          activeSyncUnsubscribers.forEach(unsub => {
            try { unsub(); } catch (e) {}
          });
          activeSyncUnsubscribers = [];

          get().setupSync(user.uid);
          get().startKillSwitchListeners();
        } else {
          toast.success('Cloud sync enabled');
        }
      } else {
        await disableNetwork(fireStore);
        await db.appMeta.put({ key: '_sync', value: false });
        
        try {
          const { stopAllListeners } = await import('../services/firestoreListeners');
          stopAllListeners();
        } catch (e) {
          console.warn('Failed to stop listeners on disable sync:', e);
        }
        
        set({ cloudSync: false, isOnline: false });
        toast.success('Cloud sync disabled. App running in local mode.');
      }
    } catch (err) {
      console.error('Failed to change sync state:', err);
      toast.error('Failed to update cloud sync state');
    }
  },

  login: async (email, password, remember) => {
    const user = await db.users.where({ email }).first();
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }
    
    // Reset retry count on manual login
    syncRetryCount = 0;
    if (syncRetryTimeout) {
      clearTimeout(syncRetryTimeout);
      syncRetryTimeout = null;
    }
    set({ syncError: null });
    
    set({ user: { uid: user.id, email: user.email }, lastAction: Date.now() });
    if (remember) {
      localStorage.setItem('rms_session', user.id);
    }
    
    get().setupSync(user.id);
    toast.success('Login successful');
  },

  logout: async () => {
    try {
      const { stopAllListeners } = await import('../services/firestoreListeners');
      stopAllListeners();
    } catch (e) {
      console.warn('Failed to stop listeners on logout:', e);
    }
    localStorage.removeItem('rms_session');
    set({
      user: null,
      settings: DEFAULT_SETTINGS,
      categories: [],
      menuItems: [],
      orders: [],
      ingredients: [],
      recipes: [],
      recipeItems: [],
      stockLogs: [],
      kotSnapshots: [],
      modifierGroups: [],
      modifierOptions: [],
      dealItems: [],
      dealOrderComponents: [],
      expenses: [],
      expenseCategories: []
    });
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
      { name: 'orderItemModifiers', table: db.orderItemModifiers },
      { name: 'dealItems', table: db.dealItems },
      { name: 'dealOrderComponents', table: db.dealOrderComponents },
      { name: 'cashiers', table: db.cashiers }
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
    // Try both string and number types
    await db.menuItems.delete(id);
    const numId = Number(id);
    if (!isNaN(numId)) {
      await db.menuItems.delete(numId);
    }

    // Also delete any modifier groups associated with this menu item
    const modGroups = await db.modifierGroups.toArray();
    for (const group of modGroups) {
      if (String(group.menuItemId) === String(id)) {
        await db.modifierGroups.delete(group.id!);
        get().syncToFirebase('modifierGroups', group.id!, null);
        const options = await db.modifierOptions.toArray();
        for (const opt of options) {
          if (String(opt.groupId) === String(group.id)) {
            await db.modifierOptions.delete(opt.id!);
            get().syncToFirebase('modifierOptions', opt.id!, null);
          }
        }
      }
    }

    // Also delete any dealItems associated with this menu item as a deal or as a component
    const dItems = await db.dealItems.toArray();
    for (const dItem of dItems) {
      if (String(dItem.dealMenuItemId) === String(id) || String(dItem.componentMenuItemId) === String(id)) {
        await db.dealItems.delete(dItem.id!);
        get().syncToFirebase('dealItems', dItem.id!, null);
      }
    }

    get().syncToFirebase('menuItems', id, null);

    // Refresh state using db.toArray() to guarantee absolute sync
    const [groups, opts, items, finalDealItems] = await Promise.all([
      db.modifierGroups.toArray(),
      db.modifierOptions.toArray(),
      db.menuItems.toArray(),
      db.dealItems.toArray()
    ]);

    set({ 
      menuItems: items,
      modifierGroups: groups,
      modifierOptions: opts,
      dealItems: finalDealItems
    });
    toast.success('Menu item deleted');
  },

  saveDealItems: async (dealMenuItemId, items) => {
    // delete existing dealItems for this dealMenuItemId first
    const existing = await db.dealItems.where({ dealMenuItemId: String(dealMenuItemId) }).toArray();
    for (const item of existing) {
      await db.dealItems.delete(item.id!);
      get().syncToFirebase('dealItems', item.id!, null);
    }
    // then re-insert updated list
    for (const item of items) {
      const id = await db.dealItems.add({
        dealMenuItemId: String(dealMenuItemId),
        componentMenuItemId: String(item.componentMenuItemId),
        quantity: item.quantity,
        sortOrder: item.sortOrder
      });
      const added = await db.dealItems.get(id);
      if (added) {
        get().syncToFirebase('dealItems', added.id!, added);
      }
    }
    // refresh state
    const updated = await db.dealItems.toArray();
    set({ dealItems: updated });
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
    const items = await db.menuItems.toArray();
    const hasItems = items.some(item => String(item.categoryId) === String(id));
    if (hasItems) {
      toast.error('Cannot delete category with assigned items');
      return;
    }
    await db.categories.delete(id);
    const numId = Number(id);
    if (!isNaN(numId)) {
      await db.categories.delete(numId);
    }
    get().syncToFirebase('categories', id, null);
    set(state => ({ categories: state.categories.filter(c => String(c.id) !== String(id)) }));
    toast.success('Category deleted');
  },

  addCashier: async (name) => {
    if (!name || name.trim() === '') {
      toast.error('Cashier name cannot be empty');
      return;
    }
    const trimmedName = name.trim();
    const existing = await db.cashiers.where('name').equalsIgnoreCase(trimmedName).first();
    if (existing) {
      toast.error('Cashier with this name already exists');
      return;
    }
    const newCashier = {
      name: trimmedName,
      isActive: true
    };
    const id = await db.cashiers.add(newCashier);
    const added = await db.cashiers.get(id);
    if (added) {
      get().syncToFirebase('cashiers', added.id!, added);
      set(state => ({ cashiers: [...state.cashiers, added] }));
      toast.success('Cashier added');
    }
  },

  toggleCashierActive: async (id) => {
    const cashier = await db.cashiers.get(id);
    if (cashier) {
      const updated = { ...cashier, isActive: !cashier.isActive };
      await db.cashiers.put(updated);
      get().syncToFirebase('cashiers', id, updated);
      set(state => ({
        cashiers: state.cashiers.map(c => c.id === id ? updated : c)
      }));
      toast.success('Cashier status updated');
    }
  },

  deleteCashier: async (id) => {
    const cashier = await db.cashiers.get(id);
    if (cashier) {
      await db.cashiers.delete(id);
      get().syncToFirebase('cashiers', id, null);
      set(state => ({
        cashiers: state.cashiers.filter(c => c.id !== id)
      }));
      toast.success('Cashier removed');
    }
  },

  setActiveCashierName: async (name) => {
    if (name) {
      await db.appMeta.put({ key: '_activeCashier', value: name });
    } else {
      await db.appMeta.delete('_activeCashier');
    }
    set({ activeCashierName: name });
  },

  addOrder: async (order) => {
    if (!order.cashierName) {
      order.cashierName = get().activeCashierName || null;
    }
    if (order.status === 'completed') {
      if (!order.completedAt) {
        order.completedAt = Date.now();
      }
    }
    await db.transaction('rw', [db.orders, db.orderItems, db.menuItems, db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.categories, db.dealOrderComponents], async () => {
      await db.orders.add(order);
      get().syncToFirebase('orders', order.id, order);
      
      const orderItems = order.items.map(item => ({ ...item, orderId: order.id }));
      await db.orderItems.bulkAdd(orderItems);
      orderItems.forEach(item => get().syncToFirebase('orderItems', item.id, item));

      // Save deal components to db
      for (const item of orderItems) {
        if (item.isDeal && item.dealComponents?.length) {
          for (const comp of item.dealComponents) {
            const compToSave = {
              orderItemId: item.id,
              componentMenuItemId: comp.componentMenuItemId,
              componentName: comp.componentName,
              unitIndex: comp.unitIndex,
              quantity: comp.quantity || 1,
              notes: comp.notes || '',
              modifiers: comp.modifiers || []
            };
            const addedCompId = await db.dealOrderComponents.add(compToSave);
            get().syncToFirebase('dealOrderComponents', addedCompId, { ...compToSave, id: addedCompId });
          }
        }
      }

      if (order.status === 'completed') {
        await deductInventory(order, get);
      }
    });

    const [newMenuItems, newIngredients, newStockLogs, newDealOrderComponents] = await Promise.all([
      db.menuItems.toArray(),
      db.ingredients.toArray(),
      db.stockLog.orderBy('createdAt').reverse().toArray(),
      db.dealOrderComponents.toArray()
    ]);

    set(state => ({ 
      orders: [order, ...state.orders],
      menuItems: newMenuItems,
      ingredients: newIngredients,
      stockLogs: newStockLogs,
      dealOrderComponents: newDealOrderComponents
    }));
    
    if (order.status === 'completed') {
      toast.success('Order completed and inventory updated');
    }
  },
  updateOrder: async (order) => {
    if (order.status === 'completed' && !order.cashierName) {
      order.cashierName = get().activeCashierName || null;
    }
    if (order.status === 'completed') {
      if (!order.completedAt) {
        order.completedAt = Date.now();
      }
    }
    await db.transaction('rw', [db.orders, db.orderItems, db.menuItems, db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.categories, db.dealOrderComponents], async () => {
      await db.orders.put(order);
      get().syncToFirebase('orders', order.id, order);

      if (order.status === 'completed') {
        await deductInventory(order, get);
      }
    });

    const [newOrders, newMenuItems, newIngredients, newStockLogs, newDealOrderComponents] = await Promise.all([
      db.orders.orderBy('createdAt').reverse().toArray(),
      db.menuItems.toArray(),
      db.ingredients.toArray(),
      db.stockLog.orderBy('createdAt').reverse().toArray(),
      db.dealOrderComponents.toArray()
    ]);

    set(state => ({ 
      orders: newOrders,
      menuItems: newMenuItems,
      ingredients: newIngredients,
      stockLogs: newStockLogs,
      dealOrderComponents: newDealOrderComponents
    }));

    if (order.status === 'completed') {
      toast.success('Order completed and inventory updated');
    } else {
      toast.success('Order updated');
    }
  },
  deleteOrder: async (id, reason, byEmail) => {
    const order = await db.orders.get(id);
    if (order) {
      const updatedOrder = {
        ...order,
        isDeleted: true,
        deletedAt: Date.now(),
        deletedReason: reason || 'N/A',
        deletedBy: byEmail || 'N/A'
      };

      const restoredIngredients = new Set<string>();
      let hasReversed = false;

      await db.transaction('rw', [db.orders, db.orderItems, db.menuItems, db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.categories, db.dealOrderComponents], async () => {
        await db.orders.put(updatedOrder);
        get().syncToFirebase('orders', id, updatedOrder);

        // Only reverse inventory for orders that actually caused deductions (completed, in-progress)
        if (order.status === 'completed' || order.status === 'in-progress') {
          hasReversed = true;
          const orderItems = await db.orderItems.where({ orderId: id }).toArray();
          for (const orderItem of orderItems) {
            if (orderItem.isDeal) {
              const components = await db.dealOrderComponents.where({ orderItemId: orderItem.id }).toArray();
              for (const comp of components) {
                const componentMenuItem = await db.menuItems.get(comp.componentMenuItemId);
                if (componentMenuItem) {
                  const categoryId = isNaN(Number(componentMenuItem.categoryId)) ? componentMenuItem.categoryId : Number(componentMenuItem.categoryId);
                  const category = await db.categories.get(categoryId);
                  const restoreQty = comp.quantity || 1;

                  if (category) {
                    if (category.type === 'stocked') {
                      const oldDirectStock = componentMenuItem.directStock || 0;
                      const newStock = oldDirectStock + restoreQty;
                      const updatedItem = {
                        ...componentMenuItem,
                        directStock: newStock,
                        isActive: true,
                        disabledReason: null
                      };
                      await db.menuItems.put(updatedItem as any);
                      get().syncToFirebase('menuItems', componentMenuItem.id, updatedItem);

                      const logEntry: StockLog = {
                        menuItemId: componentMenuItem.id,
                        changeAmount: restoreQty,
                        reason: 'order_deleted',
                        remainingAfter: newStock,
                        createdAt: Date.now(),
                        note: `Order #${id} deleted (Deal Component)`
                      };
                      const logId = await db.stockLog.add(logEntry);
                      get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });
                      restoredIngredients.add(componentMenuItem.name);
                    } else if (category.type === 'prepared') {
                      const recipe = await db.recipes.where({ menuItemId: componentMenuItem.id }).first();
                      if (recipe) {
                        const rItems = await db.recipeItems.where({ recipeId: recipe.id }).toArray();
                        for (const rItem of rItems) {
                          const totalRestoreQty = rItem.quantityUsed * restoreQty;
                          const ingredient = await db.ingredients.get(rItem.ingredientId!);
                          if (ingredient) {
                            const oldStock = ingredient.currentStock;
                            const newStock = oldStock + totalRestoreQty;
                            const updatedIngredient = { ...ingredient, currentStock: newStock };
                            await db.ingredients.update(ingredient.id!, updatedIngredient);
                            get().syncToFirebase('ingredients', ingredient.id!, updatedIngredient);

                            const logEntry: StockLog = {
                              ingredientId: ingredient.id!,
                              changeAmount: totalRestoreQty,
                              reason: 'order_deleted',
                              remainingAfter: newStock,
                              createdAt: Date.now(),
                              note: `Order #${id} deleted (Deal Component)`
                            };
                            const logId = await db.stockLog.add(logEntry);
                            get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });
                            restoredIngredients.add(ingredient.name);

                            if (oldStock <= 0 && newStock > 0) {
                              const affectedRecipes = await db.recipeItems.where({ ingredientId: ingredient.id! }).toArray();
                              for (const affRecipeItem of affectedRecipes) {
                                const affRecipe = await db.recipes.get(affRecipeItem.recipeId);
                                if (affRecipe) {
                                  const affMenuItem = await db.menuItems.get(affRecipe.menuItemId);
                                  if (affMenuItem) {
                                    const updatedAffItem = {
                                      ...affMenuItem,
                                      isActive: true,
                                      disabledReason: null
                                    };
                                    await db.menuItems.put(updatedAffItem as any);
                                    get().syncToFirebase('menuItems', affMenuItem.id, updatedAffItem);
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              continue;
            }

            const menuItem = await db.menuItems.get(orderItem.menuItemId);
            if (menuItem) {
              const categoryId = isNaN(Number(menuItem.categoryId)) ? menuItem.categoryId : Number(menuItem.categoryId);
              const category = await db.categories.get(categoryId);
              
              if (category) {
                if (category.type === 'prepared') {
                  const recipe = await db.recipes.where({ menuItemId: menuItem.id }).first();
                  if (recipe) {
                    const rItems = await db.recipeItems.where({ recipeId: recipe.id }).toArray();
                    for (const rItem of rItems) {
                      const restoreQty = rItem.quantityUsed * orderItem.quantity;
                      const ingredient = await db.ingredients.get(rItem.ingredientId!);
                      if (ingredient) {
                        const oldStock = ingredient.currentStock;
                        const newStock = oldStock + restoreQty;
                        const updatedIngredient = { ...ingredient, currentStock: newStock };
                        await db.ingredients.update(ingredient.id!, updatedIngredient);
                        get().syncToFirebase('ingredients', ingredient.id!, updatedIngredient);

                        const logEntry: StockLog = {
                          ingredientId: ingredient.id!,
                          changeAmount: restoreQty,
                          reason: 'order_deleted',
                          remainingAfter: newStock,
                          createdAt: Date.now(),
                          note: `Order #${id} deleted`
                        };
                        const logId = await db.stockLog.add(logEntry);
                        get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

                        restoredIngredients.add(ingredient.name);

                        // IF ingredient was previously disabled (currentStock was 0 before restore):
                        if (oldStock <= 0 && newStock > 0) {
                          // Check if any menu items using this ingredient should be re-enabled:
                          // IF newStock > 0: Re-enable those menuItems (isActive: true) in Dexie
                          const affectedRecipes = await db.recipeItems.where({ ingredientId: ingredient.id! }).toArray();
                          for (const affRecipeItem of affectedRecipes) {
                            const affRecipe = await db.recipes.get(affRecipeItem.recipeId);
                            if (affRecipe) {
                              const affMenuItem = await db.menuItems.get(affRecipe.menuItemId);
                              if (affMenuItem) {
                                const updatedAffItem = {
                                  ...affMenuItem,
                                  isActive: true,
                                  disabledReason: null
                                };
                                await db.menuItems.put(updatedAffItem as any);
                                get().syncToFirebase('menuItems', affMenuItem.id, updatedAffItem);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else if (category.type === 'stocked') {
                  const restoreQty = orderItem.quantity;
                  const oldDirectStock = menuItem.directStock || 0;
                  const newStock = oldDirectStock + restoreQty;
                  
                  const updatedItem = {
                    ...menuItem,
                    directStock: newStock,
                    isActive: oldDirectStock <= 0 ? true : menuItem.isActive,
                    disabledReason: oldDirectStock <= 0 ? null : menuItem.disabledReason
                  };
                  await db.menuItems.put(updatedItem as any);
                  get().syncToFirebase('menuItems', menuItem.id, updatedItem);

                  const logEntry: StockLog = {
                    menuItemId: menuItem.id,
                    changeAmount: restoreQty,
                    reason: 'order_deleted',
                    remainingAfter: newStock,
                    createdAt: Date.now(),
                    note: `Order #${id} deleted`
                  };
                  const logId = await db.stockLog.add(logEntry);
                  get().syncToFirebase('stockLog', logId, { ...logEntry, id: logId });

                  restoredIngredients.add(menuItem.name);
                }
              }
            }
          }
        }
      });

      // Update Zustand state
      const [updatedOrders, newMenuItems, newIngredients, newStockLogs] = await Promise.all([
        db.orders.orderBy('createdAt').reverse().toArray(),
        db.menuItems.toArray(),
        db.ingredients.toArray(),
        db.stockLog.orderBy('createdAt').reverse().toArray()
      ]);

      set({ 
        orders: updatedOrders,
        menuItems: newMenuItems,
        ingredients: newIngredients,
        stockLogs: newStockLogs
      });

      if (hasReversed) {
        toast.success(`Order #${order.orderNumber} deleted. Inventory restored for ${restoredIngredients.size} ingredients.`);
      } else {
        toast.success(`Order #${order.orderNumber} deleted.`);
      }
    }
  },

  restoreOrder: async (id) => {
    const order = await db.orders.get(id);
    if (order) {
      const updatedOrder = {
        ...order,
        isDeleted: false,
        deletedAt: null,
        deletedReason: null,
        deletedBy: null
      };

      await db.transaction('rw', [db.orders, db.orderItems, db.menuItems, db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.categories], async () => {
        await db.orders.put(updatedOrder);
        get().syncToFirebase('orders', id, updatedOrder);

        if (order.status === 'completed' || order.status === 'in-progress') {
          await deductInventoryOnRestore(updatedOrder, get);
        }
      });

      // Update Zustand state
      const [updatedOrders, newMenuItems, newIngredients, newStockLogs] = await Promise.all([
        db.orders.orderBy('createdAt').reverse().toArray(),
        db.menuItems.toArray(),
        db.ingredients.toArray(),
        db.stockLog.orderBy('createdAt').reverse().toArray()
      ]);

      set({ 
        orders: updatedOrders,
        menuItems: newMenuItems,
        ingredients: newIngredients,
        stockLogs: newStockLogs
      });

      toast.success(`Order #${order.orderNumber} restored. Inventory re-adjusted.`);
    }
  },

  cancelOrder: async (id, reason, cashierName) => {
    const order = await db.orders.get(id);
    if (order) {
      const completedTime = Date.now();
      const updatedOrder = {
        ...order,
        status: 'completed' as const,
        isCancelled: true,
        cancelledAt: completedTime,
        cancellationReason: reason,
        cancelledBy: cashierName || '—',
        completedAt: completedTime
      };

      await db.transaction('rw', [db.orders], async () => {
        await db.orders.put(updatedOrder);
        get().syncToFirebase('orders', id, updatedOrder);
      });

      // Update Zustand state
      const updatedOrders = await db.orders.orderBy('createdAt').reverse().toArray();
      set({ orders: updatedOrders });

      toast.success(`Order #${order.orderNumber} cancelled`);
    }
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
    await db.menuItems.update(id, updatedItem as any);
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
    const numGroupId = Number(groupId);
    await db.transaction('rw', [db.modifierGroups, db.modifierOptions], async () => {
      await db.modifierGroups.delete(groupId);
      if (!isNaN(numGroupId)) {
        await db.modifierGroups.delete(numGroupId);
      }
      get().syncToFirebase('modifierGroups', groupId, null);

      const options = await db.modifierOptions.toArray();
      for (const opt of options) {
        if (String(opt.groupId) === String(groupId)) {
          await db.modifierOptions.delete(opt.id!);
          get().syncToFirebase('modifierOptions', opt.id!, null);
        }
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
    deliveryChargeWaivedReason: '',
    discountType: 'percent',
    discountValue: 0,
    deliveryCharge: null
  }),
  setDiscountType: (discountType) => set({ discountType }),
  setDiscountValue: (discountValue) => set({ discountValue }),
  setDeliveryCharge: (deliveryCharge) => set({ deliveryCharge }),
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
  addDealToCart: (item, dealComponents) => {
    const { cart } = get();
    set({
      cart: [...cart, {
        id: crypto.randomUUID(),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        notes: '',
        modifiers: [],
        isDeal: true,
        dealComponents
      }]
    });
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
      discountType: order.discountType || 'percent',
      discountValue: order.discountValue || 0,
      deliveryCharge: order.deliveryCharge !== undefined ? order.deliveryCharge : null,
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
    const backup = {
      exportedAt: Date.now(),
      version: 1,
      data: {
        settings:          await db.settings.toArray(),
        categories:        await db.categories.toArray(),
        menuItems:         await db.menuItems.toArray(),
        modifierGroups:    await db.modifierGroups.toArray(),
        modifierOptions:   await db.modifierOptions.toArray(),
        orders:            await db.orders.toArray(),
        orderItems:        await db.orderItems.toArray(),
        orderItemModifiers:await db.orderItemModifiers.toArray(),
        kotSnapshots:      await db.kotSnapshots.toArray(),
        ingredients:       await db.ingredients.toArray(),
        recipes:           await db.recipes.toArray(),
        recipeItems:       await db.recipeItems.toArray(),
        stockLog:          await db.stockLog.toArray(),
        users:             await db.users.toArray(),
        appMeta:           await db.appMeta.toArray(),
        used_keys:         await db.used_keys.toArray(),
        sync_queue:        await db.sync_queue.toArray(),
        dealItems:         await db.dealItems.toArray(),
        dealOrderComponents:await db.dealOrderComponents.toArray(),
        expenses:           await db.expenses.toArray(),
        expenseCategories:  await db.expenseCategories.toArray(),
        cashiers:           await db.cashiers.toArray(),
      }
    };
    
    return JSON.stringify(backup, null, 2);
  },

  importData: async (jsonOrObj) => {
    try {
      const backup = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
      
      if (!backup || typeof backup !== 'object') {
        throw new Error('Invalid backup file');
      }
      
      if (!backup.data || typeof backup.data !== 'object') {
        throw new Error('Corrupted backup file');
      }

      const tables = [
        db.settings, db.categories, db.menuItems, db.modifierGroups, 
        db.modifierOptions, db.orders, db.orderItems, db.orderItemModifiers, 
        db.kotSnapshots, db.ingredients, db.recipes, db.recipeItems, db.stockLog,
        db.users, db.appMeta, db.used_keys, db.sync_queue, db.dealItems, db.dealOrderComponents,
        db.expenses, db.expenseCategories, db.cashiers
      ];

      await db.transaction('rw', tables, async () => {
        // STEP 1 - Clear all existing Dexie data in these tables completely
        for (const table of tables) {
          await table.clear();
        }

        // STEP 2 - Restore from backup file, ensuring IDs are preserved with bulkPut
        const d = backup.data;
        
        if (d.settings && d.settings.length) {
          await db.settings.bulkPut(d.settings);
        } else if (d.settings && !Array.isArray(d.settings)) {
          // Fallback if settings was saved as a single object previously
          await db.settings.put(d.settings.key ? d.settings : { key: 'main', value: d.settings });
        }
        
        if (d.categories?.length) await db.categories.bulkPut(d.categories);
        if (d.menuItems?.length) await db.menuItems.bulkPut(d.menuItems);
        if (d.modifierGroups?.length) await db.modifierGroups.bulkPut(d.modifierGroups);
        if (d.modifierOptions?.length) await db.modifierOptions.bulkPut(d.modifierOptions);
        if (d.orders?.length) await db.orders.bulkPut(d.orders);
        if (d.orderItems?.length) await db.orderItems.bulkPut(d.orderItems);
        if (d.orderItemModifiers?.length) await db.orderItemModifiers.bulkPut(d.orderItemModifiers);
        if (d.kotSnapshots?.length) await db.kotSnapshots.bulkPut(d.kotSnapshots);
        if (d.ingredients?.length) await db.ingredients.bulkPut(d.ingredients);
        if (d.recipes?.length) await db.recipes.bulkPut(d.recipes);
        if (d.recipeItems?.length) await db.recipeItems.bulkPut(d.recipeItems);
        if (d.stockLog?.length) await db.stockLog.bulkPut(d.stockLog);
        if (d.dealItems?.length) await db.dealItems.bulkPut(d.dealItems);
        if (d.dealOrderComponents?.length) await db.dealOrderComponents.bulkPut(d.dealOrderComponents);
        if (d.expenses?.length) await db.expenses.bulkPut(d.expenses);
        if (d.expenseCategories?.length) await db.expenseCategories.bulkPut(d.expenseCategories);
        if (d.cashiers?.length) await db.cashiers.bulkPut(d.cashiers);
        
        // Optional tables for backward compatibility with older snapshots
        if (d.users?.length) await db.users.bulkPut(d.users);
        if (d.appMeta?.length) await db.appMeta.bulkPut(d.appMeta);
        if (d.used_keys?.length) await db.used_keys.bulkPut(d.used_keys);
        if (d.sync_queue?.length) await db.sync_queue.bulkPut(d.sync_queue);
      });

      // Step 5: Reload/Re-hydrate Zustand store from IndexDB completely
      await get().init();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  deleteAllAppData: async (keepMenuItems: boolean) => {
    try {
      if (keepMenuItems) {
        // Clear specified tables
        await db.transaction('rw', [
          db.orders, db.orderItems, db.orderItemModifiers, db.kotSnapshots,
          db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.settings,
          db.sync_queue, db.dealOrderComponents, db.expenses
        ], async () => {
          await db.orders.clear();
          await db.orderItems.clear();
          await db.orderItemModifiers.clear();
          await db.kotSnapshots.clear();
          await db.ingredients.clear();
          await db.recipes.clear();
          await db.recipeItems.clear();
          await db.stockLog.clear();
          await db.sync_queue.clear();
          await db.dealOrderComponents.clear();
          await db.expenses.clear();
          
          await db.settings.clear();
          await db.settings.add({ key: 'main', value: DEFAULT_SETTINGS });
        });

        // Reset Zustand store state (Keep menu items, categories, modifiers, appMeta, user session)
        set({
          orders: [],
          ingredients: [],
          recipes: [],
          recipeItems: [],
          stockLogs: [],
          kotSnapshots: [],
          dealOrderComponents: [],
          expenses: [],
          settings: DEFAULT_SETTINGS,
          cart: []
        });

        toast.success('All data deleted successfully');
        setTimeout(() => window.location.reload(), 1500);

      } else {
        // Delete EVERYTHING except appMeta
        await db.transaction('rw', [
          db.orders, db.orderItems, db.orderItemModifiers, db.kotSnapshots,
          db.ingredients, db.recipes, db.recipeItems, db.stockLog, db.settings,
          db.sync_queue, db.menuItems, db.categories, db.modifierGroups, db.modifierOptions,
          db.dealItems, db.dealOrderComponents, db.expenses, db.expenseCategories, db.cashiers
        ], async () => {
          await db.orders.clear();
          await db.orderItems.clear();
          await db.orderItemModifiers.clear();
          await db.kotSnapshots.clear();
          await db.ingredients.clear();
          await db.recipes.clear();
          await db.recipeItems.clear();
          await db.stockLog.clear();
          await db.sync_queue.clear();
          await db.menuItems.clear();
          await db.categories.clear();
          await db.modifierGroups.clear();
          await db.modifierOptions.clear();
          await db.dealItems.clear();
          await db.dealOrderComponents.clear();
          await db.expenses.clear();
          await db.expenseCategories.clear();
          await db.cashiers.clear();

          await db.settings.clear();
          await db.settings.add({ key: 'main', value: DEFAULT_SETTINGS });
        });

        // Reset Zustand store state completely
        set({
          menuItems: [],
          categories: [],
          orders: [],
          ingredients: [],
          recipes: [],
          recipeItems: [],
          stockLogs: [],
          kotSnapshots: [],
          modifierGroups: [],
          modifierOptions: [],
          dealItems: [],
          dealOrderComponents: [],
          expenses: [],
          expenseCategories: [],
          cashiers: [],
          activeCashierName: null,
          cart: [],
          settings: DEFAULT_SETTINGS
        });

        toast.success('All data deleted successfully');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.error('Failed to delete all app data:', err);
      toast.error('Failed to delete app data');
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
        settings: { ...state.settings, licenseExpiry: sub.expiryDate },
        isLicenseSyncFailed: false
      }));
    } catch (err: any) {
      console.warn("Manual licensing sync failed:", err);
      set({ isLicenseSyncFailed: true });
    }
  },

  startKillSwitchListeners: async () => {
    if (!fireStore || !get().cloudSync) return;

    // Clean up any existing listeners first
    get().stopKillSwitchListeners();

    try {
      const rid = await getRestaurantId();
      const globalDocRef = doc(fireStore, 'appControl', 'global');
      const restDocRef = doc(fireStore, 'appControl', rid);

      const unsubGlobal = onSnapshot(globalDocRef, async (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : { shutdown: false, shutdownMessage: '', maintenanceMode: false, maintenanceMessage: '' };
        const currentGlobalShutdown = get().globalShutdown;
        const currentMaintenance = get().maintenanceMode;

        const remoteShutdown = data?.shutdown === true;
        const remoteShutdownMsg = data?.shutdownMessage || '';
        const remoteMaintenance = data?.maintenanceMode === true;
        const remoteMaintenanceMsg = data?.maintenanceMessage || '';

        // Handle Global Shutdown change
        if (remoteShutdown !== currentGlobalShutdown) {
          if (remoteShutdown) {
            await db.appMeta.put({ key: '_sd', value: true });
            if (remoteShutdownMsg) {
              await db.appMeta.put({ key: '_sd_msg', value: remoteShutdownMsg });
            }
            set({ globalShutdown: true, globalShutdownMessage: remoteShutdownMsg });
          } else {
            await db.appMeta.delete('_sd');
            await db.appMeta.delete('_sd_msg');
            set({ globalShutdown: false, globalShutdownMessage: '' });

            // Show toast on transition from true to false
            if (currentGlobalShutdown === true) {
              toast.success("Service restored");
              // Redirect to login automatically
              get().logout();
            }
          }
        } else if (remoteShutdown && remoteShutdownMsg !== get().globalShutdownMessage) {
          // Message updated
          if (remoteShutdownMsg) {
            await db.appMeta.put({ key: '_sd_msg', value: remoteShutdownMsg });
          }
          set({ globalShutdownMessage: remoteShutdownMsg });
        }

        // Handle Maintenance Mode change
        if (remoteMaintenance !== currentMaintenance) {
          if (remoteMaintenance) {
            await db.appMeta.put({ key: '_mm', value: true });
            if (remoteMaintenanceMsg) {
              await db.appMeta.put({ key: '_mm_msg', value: remoteMaintenanceMsg });
            }
            set({ maintenanceMode: true, maintenanceMessage: remoteMaintenanceMsg });
          } else {
            await db.appMeta.delete('_mm');
            await db.appMeta.delete('_mm_msg');
            set({ maintenanceMode: false, maintenanceMessage: '' });

            // Show toast on transition from true to false
            if (currentMaintenance === true) {
              toast.success("Maintenance complete");
              get().logout();
            }
          }
        } else if (remoteMaintenance && remoteMaintenanceMsg !== get().maintenanceMessage) {
          if (remoteMaintenanceMsg) {
            await db.appMeta.put({ key: '_mm_msg', value: remoteMaintenanceMsg });
          }
          set({ maintenanceMessage: remoteMaintenanceMsg });
        }
      }, (err) => {
        console.error("Global kill switch listener error:", err);
      });

      const unsubRest = onSnapshot(restDocRef, async (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : { shutdown: false, shutdownMessage: '' };
        const currentRestShutdown = get().restaurantShutdown;

        const remoteRShutdown = data?.shutdown === true;
        const remoteRShutdownMsg = data?.shutdownMessage || '';

        // Handle Restaurant Shutdown change
        if (remoteRShutdown !== currentRestShutdown) {
          if (remoteRShutdown) {
            await db.appMeta.put({ key: '_rsd', value: true });
            if (remoteRShutdownMsg) {
              await db.appMeta.put({ key: '_rsd_msg', value: remoteRShutdownMsg });
            }
            set({ restaurantShutdown: true, restaurantShutdownMessage: remoteRShutdownMsg });
          } else {
            await db.appMeta.delete('_rsd');
            await db.appMeta.delete('_rsd_msg');
            set({ restaurantShutdown: false, restaurantShutdownMessage: '' });

            if (currentRestShutdown === true) {
              toast.success("Service restored");
              get().logout();
            }
          }
        } else if (remoteRShutdown && remoteRShutdownMsg !== get().restaurantShutdownMessage) {
          if (remoteRShutdownMsg) {
            await db.appMeta.put({ key: '_rsd_msg', value: remoteRShutdownMsg });
          }
          set({ restaurantShutdownMessage: remoteRShutdownMsg });
        }
      }, (err) => {
        console.error("Restaurant kill switch listener error:", err);
      });

      set({ killSwitchListeners: [unsubGlobal, unsubRest] });
    } catch (e) {
      console.error("Failed to start kill switch listeners:", e);
    }
  },

  stopKillSwitchListeners: () => {
    const listeners = get().killSwitchListeners;
    if (listeners) {
      listeners.forEach(unsub => {
        try {
          unsub();
        } catch (e) {
          console.warn("Failed unsubscribing:", e);
        }
      });
      set({ killSwitchListeners: null });
    }
  },

  fetchLatestKillSwitchState: async () => {
    if (!fireStore || !get().cloudSync) return;
    try {
      const rid = await getRestaurantId();
      const globalDocRef = doc(fireStore, 'appControl', 'global');
      const restDocRef = doc(fireStore, 'appControl', rid);

      const [globalSnap, restSnap] = await Promise.all([
        getDoc(globalDocRef),
        getDoc(restDocRef)
      ]);

      const globalData = globalSnap.exists() ? globalSnap.data() : null;
      const restData = restSnap.exists() ? restSnap.data() : null;

      const remoteShutdown = globalData?.shutdown === true;
      const remoteRShutdown = restData?.shutdown === true;
      const remoteMaintenance = globalData?.maintenanceMode === true;

      const remoteShutdownMsg = globalData?.shutdownMessage || '';
      const remoteRShutdownMsg = restData?.shutdownMessage || '';
      const remoteMaintenanceMsg = globalData?.maintenanceMessage || '';

      // Update states and Dexie
      if (remoteShutdown || remoteRShutdown) {
        if (remoteShutdown) {
          await db.appMeta.put({ key: '_sd', value: true });
          if (remoteShutdownMsg) {
            await db.appMeta.put({ key: '_sd_msg', value: remoteShutdownMsg });
          }
        }
        if (remoteRShutdown) {
          await db.appMeta.put({ key: '_rsd', value: true });
          if (remoteRShutdownMsg) {
            await db.appMeta.put({ key: '_rsd_msg', value: remoteRShutdownMsg });
          }
        }
      } else {
        await db.appMeta.delete('_sd');
        await db.appMeta.delete('_sd_msg');
        await db.appMeta.delete('_rsd');
        await db.appMeta.delete('_rsd_msg');
      }

      if (remoteMaintenance) {
        await db.appMeta.put({ key: '_mm', value: true });
        if (remoteMaintenanceMsg) {
          await db.appMeta.put({ key: '_mm_msg', value: remoteMaintenanceMsg });
        }
      } else {
        await db.appMeta.delete('_mm');
        await db.appMeta.delete('_mm_msg');
      }

      set({
        globalShutdown: remoteShutdown,
        globalShutdownMessage: remoteShutdownMsg,
        restaurantShutdown: remoteRShutdown,
        restaurantShutdownMessage: remoteRShutdownMsg,
        maintenanceMode: remoteMaintenance,
        maintenanceMessage: remoteMaintenanceMsg
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('offline') || err?.code === 'unavailable' || !navigator.onLine) {
        console.warn('Failed to fetch latest kill switch state: client is offline.');
        set({ isOnline: false });
        throw new Error('Failed to connect to the server. Please check your internet connection.');
      } else {
        console.error('Error fetching latest kill switch state:', err);
        throw err;
      }
    }
  },

  addExpense: async (expenseData) => {
    const businessDate = getBusinessDate(expenseData.date).getTime();
    const finalExpense = { ...expenseData, businessDate };
    const id = await db.expenses.add(finalExpense);
    const added = await db.expenses.get(id);
    if (added) {
      await get().syncToFirebase('expenses', added.id!, added);
      set((state) => ({ expenses: [added, ...state.expenses] }));
    }
  },
  updateExpense: async (expense) => {
    const businessDate = getBusinessDate(expense.date).getTime();
    const updatedExpense = { ...expense, businessDate };
    await db.expenses.put(updatedExpense);
    await get().syncToFirebase('expenses', expense.id!, updatedExpense);
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === expense.id ? updatedExpense : e)),
    }));
  },
  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    await get().syncToFirebase('expenses', id, null);
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    }));
  },
  addExpenseCategory: async (categoryData) => {
    const id = await db.expenseCategories.add(categoryData);
    const added = await db.expenseCategories.get(id);
    if (added) {
      await get().syncToFirebase('expenseCategories', added.id!, added);
      set((state) => ({ expenseCategories: [...state.expenseCategories, added] }));
    }
  },
  deleteExpenseCategory: async (id) => {
    await db.expenseCategories.delete(id);
    await get().syncToFirebase('expenseCategories', id, null);
    set((state) => ({
      expenseCategories: state.expenseCategories.filter((c) => c.id !== id),
    }));
  },
  updateExpenseCategory: async (category) => {
    await db.expenseCategories.put(category);
    await get().syncToFirebase('expenseCategories', category.id!, category);
    set((state) => ({
      expenseCategories: state.expenseCategories.map((c) => (c.id === category.id ? category : c)),
    }));
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

