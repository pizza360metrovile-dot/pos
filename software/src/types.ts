/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: string; // or number if using ++id, but we'll stick to string for manual IDs if needed, though Dexie will handle autoincrement if we use numbers.
  name: string;
  price: number;
  categoryId: string | number;
  description: string;
  isActive: boolean;
  stock: number; // Used as Initial Stock
  minStock: number; // Used as Min. Stock Alert
  directStock: number; // Current stock for stocked items
  disabledReason?: 'manual' | 'out_of_stock' | null;
  createdAt: number;
}

export interface Category {
  id: string | number;
  name: string;
  type: 'prepared' | 'stocked';
}

export enum OrderType {
  DINE_IN = 'Dine-In',
  TAKEAWAY = 'Takeaway',
  DELIVERY = 'Delivery',
}

export interface OrderItemModifier {
  id?: number;
  orderItemId?: string;
  modifierGroupId: string | number;
  modifierOptionId: string | number;
  label: string;
  additionalPrice: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  modifiers?: OrderItemModifier[];
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[]; // We'll keep them here for ease, and also in orderItems table if dexie requires it.
  subtotal: number;
  taxAmount: number;
  total: number;
  type: OrderType;
  customerName?: string;
  tableNumber?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'held' | 'refunded';
  createdAt: number;
  updatedAt: number;
  notes?: string;
  kotPrinted?: boolean;
  deliveryCharge?: number;
  deliveryChargeWaived?: boolean;
  deliveryChargeWaivedReason?: string;
}

export interface KotSnapshot {
  id?: number;
  orderId: string;
  sentAt: number;
  kotNumber: number;
  items: OrderItem[];
}

export interface RestaurantSettings {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  taxPercentage: number;
  taxLabel: string;
  taxInclusion: 'exclusive' | 'inclusive';
  showTaxBreakdown: boolean;
  currency: string;
  currencyPosition: 'before' | 'after';
  receiptHeader: string;
  receiptFooter: string;
  // Printing Settings
  autoPrintKOT: boolean;
  showCustomerNameOnKOT: boolean;
  showOrderTypeOnKOT: boolean;
  showTableNumberOnKOT: boolean;
  kotFontSize: 'normal' | 'large' | 'extra-large';
  autoPrintReceipt: boolean;
  showTaxLine: boolean;
  showOrderTypeOnReceipt: boolean;
  showCustomerNameOnReceipt: boolean;
  showTableNumberOnReceipt: boolean;
  // Delivery Charge Settings
  deliveryChargeEnabled: boolean;
  deliveryChargeAmount: number;
  deliveryChargeLabel: string;
  deliveryChargeTaxable: boolean;
  autoLogoutTimeout: '1' | '4' | '8' | 'never';
}

export interface Ingredient {
  id?: number;
  name: string;
  unit: 'kg' | 'g' | 'L' | 'ml' | 'pcs';
  currentStock: number;
  reorderThreshold: number;
  costPerUnit: number;
}

export interface Recipe {
  id?: number;
  menuItemId: string | number;
}

export interface RecipeItem {
  id?: number;
  recipeId: number;
  ingredientId: number;
  quantityUsed: number;
}

export interface StockLog {
  id?: number;
  ingredientId?: number;
  menuItemId?: string | number;
  changeAmount: number;
  reason: 'sale' | 'restock' | 'adjustment' | 'import' | string;
  remainingAfter: number;
  createdAt: number;
}

export interface ModifierGroup {
  id: string | number;
  categoryId: string | number;
  name: string;
  type: 'option' | 'addon';
  isRequired: boolean;
  sortOrder: number;
}

export interface ModifierOption {
  id: string | number;
  groupId: string | number;
  label: string;
  additionalPrice: number;
  sortOrder: number;
}

export interface AppState {
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
}
