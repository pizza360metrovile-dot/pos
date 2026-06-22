export interface Order {
  id: string;
  orderNo: string;
  timestamp: any; // Firestore Timestamp, string or Date
  type: 'Dine-In' | 'Takeaway' | 'Delivery';
  status: 'In-Progress' | 'Completed';
  total: number;
  cashier: string;
  discount: number;
  tax: number;
  deliveryCharge: number;
  // Audit properties
  deleted?: boolean;
  deletedAt?: any;
  deletedReason?: string;
  deletedBy?: string;
  cancelled?: boolean;
  cancelledAt?: any;
  cancelledReason?: string;
  cancelledBy?: string;
  businessDate?: any;
  createdAt?: any;
  isDeleted?: boolean;
  isCancelled?: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
}

export interface OrderItemModifier {
  id: string;
  orderItemId: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface Ingredient {
  id: string;
  name: string;
  currentQty: number; // For Direct Stock, this can be mapped to current stock
  unit: string;
  lowStockThreshold: number;
  directStock: boolean; // true = Stocked Item, false = Ingredient Stock
  category?: string; // only for Stocked Items
}

export interface Expense {
  id: string;
  date: any; // Timestamp or string
  description: string;
  category: string;
  amount: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export type QuickFilterType = 'TODAY' | 'YESTERDAY' | 'THIS WEEK' | 'THIS MONTH' | 'LAST MONTH' | 'ALL TIME';

export type MainTabType = 'PERFORMANCE' | 'RECORDS' | 'DELETED' | 'INVENTORY' | 'EXPENSES';
