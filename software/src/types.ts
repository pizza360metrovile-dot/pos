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
  isDeal?: boolean;
}

export interface DealItem {
  id?: number;
  dealMenuItemId: string;
  componentMenuItemId: string;
  quantity: number;
  sortOrder: number;
}

export interface DealOrderComponent {
  id?: number;
  orderItemId: string;          // the deal's orderItem id
  componentMenuItemId: string;
  componentName: string;        // snapshot of name
  unitIndex: number;            // 1, 2 etc
  quantity: number;             // always 1
  notes?: string;
  modifiers: any[];             // JSON array of selected modifiers / modifiers payload
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
  isDeal?: boolean;
  dealComponents?: DealOrderComponent[];
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
  status: 'pending' | 'in-progress' | 'completed' | 'held';
  createdAt: number;
  updatedAt: number;
  notes?: string;
  kotPrinted?: boolean;
  deliveryCharge?: number;
  deliveryChargeWaived?: boolean;
  deliveryChargeWaivedReason?: string;
  discountType?: 'percent' | 'flat' | null;
  discountValue?: number;
  discountAmount?: number;
  isDeleted?: boolean;
  deletedAt?: number | null;
  deletedReason?: string | null;
  deletedBy?: string | null;
  cashierName?: string | null;
  isCancelled?: boolean;
  cancelledAt?: number | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  completedAt?: number;
  businessDate?: any;
}

export interface KotSnapshot {
  id?: number;
  orderId: string;
  sentAt: number;
  kotNumber: number;
  items: OrderItem[];
  notes?: string;
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
  licenseExpiry?: number;
  logoDataURL?: string;
  logoHeightReceipt?: number;
  logoHeightKOT?: number;
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
  note?: string;
}

export interface ModifierGroup {
  id: string | number;
  menuItemId: string | number;
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

export interface Expense {
  id?: number;
  title: string;
  amount: number;
  categoryId: string | number;
  date: number; // timestamp
  notes?: string;
  createdAt: number; // timestamp
  businessDate?: any;
}

export interface ExpenseCategory {
  id?: number;
  name: string;
}

export interface Cashier {
  id?: number;
  name: string;
  isActive: boolean;
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
  dealItems: DealItem[];
  dealOrderComponents: DealOrderComponent[];
  cashiers: Cashier[];
}
