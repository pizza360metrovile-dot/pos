import { subDays, startOfDay, endOfDay, subWeeks, subMonths, format } from 'date-fns';
import { Order, OrderItem, OrderItemModifier, MenuItem, Ingredient, Expense, ExpenseCategory } from './types';

// Let's establish menu items first
export const initialMenuItems: MenuItem[] = [
  { id: 'm1', name: 'Truffle Burger', price: 18.5, category: 'Burgers' },
  { id: 'm2', name: 'Classic Cheeseburger', price: 14.0, category: 'Burgers' },
  { id: 'm3', name: 'Spicy Chicken Wings', price: 12.0, category: 'Starters' },
  { id: 'm4', name: 'Caesar Salad with Chicken', price: 15.5, category: 'Salads' },
  { id: 'm5', name: 'Margherita Pizza 12\"', price: 16.5, category: 'Pizza' },
  { id: 'm6', name: 'Pepperoni Pizza 12\"', price: 19.0, category: 'Pizza' },
  { id: 'm7', name: 'Fries with Garlic Aioli', price: 6.5, category: 'Starters' },
  { id: 'm8', name: 'Sweet Potato Fries', price: 7.5, category: 'Starters' },
  { id: 'm9', name: 'Craft IPA Beet', price: 8.0, category: 'Beverages' },
  { id: 'm10', name: 'Fresh Lemonade', price: 4.5, category: 'Beverages' },
  { id: 'm11', name: 'Chocolate Fudge Brownie', price: 9.0, category: 'Desserts' },
];

export const initialExpenseCategories: ExpenseCategory[] = [
  { id: 'ec1', name: 'Inventory & Food Cost' },
  { id: 'ec2', name: 'Rent & Utilities' },
  { id: 'ec3', name: 'Salaries & Wages' },
  { id: 'ec4', name: 'Marketing & Advertising' },
  { id: 'ec5', name: 'Equipment & Repairs' },
  { id: 'ec6', name: 'Miscellaneous' },
];

// Helper to get relative dates
const now = new Date();
const todayDate = now;
const yesterdayDate = subDays(now, 1);
const threeDaysAgo = subDays(now, 3);
const fiveDaysAgo = subDays(now, 5);
const tenDaysAgo = subDays(now, 10);
const lastMonthDate = subDays(now, 26); // last month context
const fortyDaysAgo = subDays(now, 40);

// Helper to convert date to ISO string or simulate Timestamp
export const dateToTimestampSim = (d: Date) => d.toISOString();

// Create 15 orders scattered across dates
export const initialOrders: Order[] = [
  // TODAY
  {
    id: 'o_td_1',
    orderNo: '#2041',
    timestamp: dateToTimestampSim(new Date(todayDate.setHours(12, 15, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 51.5,
    cashier: 'Sarah Connor',
    discount: 5.0,
    tax: 4.15,
    deliveryCharge: 0,
  },
  {
    id: 'o_td_2',
    orderNo: '#2042',
    timestamp: dateToTimestampSim(new Date(todayDate.setHours(13, 10, 0))),
    type: 'Takeaway',
    status: 'In-Progress',
    total: 30.5,
    cashier: ' Sarah Connor',
    discount: 0,
    tax: 2.50,
    deliveryCharge: 0,
  },
  {
    id: 'o_td_3',
    orderNo: '#2043',
    timestamp: dateToTimestampSim(new Date(todayDate.setHours(17, 45, 0))),
    type: 'Delivery',
    status: 'Completed',
    total: 78.0,
    cashier: 'John Doe',
    discount: 10.0,
    tax: 6.20,
    deliveryCharge: 5.50,
  },
  {
    id: 'o_td_4',
    orderNo: '#2044',
    timestamp: dateToTimestampSim(new Date(todayDate.setHours(19, 20, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 104.5,
    cashier: 'John Doe',
    discount: 0,
    tax: 8.50,
    deliveryCharge: 0,
  },
  // YESTERDAY
  {
    id: 'o_yst_1',
    orderNo: '#2035',
    timestamp: dateToTimestampSim(new Date(yesterdayDate.setHours(11, 30, 0))),
    type: 'Takeaway',
    status: 'Completed',
    total: 21.0,
    cashier: 'Sarah Connor',
    discount: 0,
    tax: 1.70,
    deliveryCharge: 0,
  },
  {
    id: 'o_yst_2',
    orderNo: '#2036',
    timestamp: dateToTimestampSim(new Date(yesterdayDate.setHours(18, 15, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 142.0,
    cashier: 'John Doe',
    discount: 15.0,
    tax: 11.20,
    deliveryCharge: 0,
  },
  {
    id: 'o_yst_3',
    orderNo: '#2037',
    timestamp: dateToTimestampSim(new Date(yesterdayDate.setHours(20, 0, 0))),
    type: 'Delivery',
    status: 'Completed',
    total: 48.5,
    cashier: 'John Doe',
    discount: 0,
    tax: 3.90,
    deliveryCharge: 4.50,
  },
  // 3 DAYS AGO
  {
    id: 'o_tda_1',
    orderNo: '#2021',
    timestamp: dateToTimestampSim(new Date(threeDaysAgo.setHours(13, 0, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 62.5,
    cashier: 'Sarah Connor',
    discount: 5.0,
    tax: 5.0,
    deliveryCharge: 0,
  },
  {
    id: 'o_tda_2',
    orderNo: '#2022',
    timestamp: dateToTimestampSim(new Date(threeDaysAgo.setHours(19, 40, 0))),
    type: 'Delivery',
    status: 'Completed',
    total: 94.0,
    cashier: 'John Doe',
    discount: 8.0,
    tax: 7.50,
    deliveryCharge: 6.0,
  },
  // 5 DAYS AGO
  {
    id: 'o_fda_1',
    orderNo: '#2010',
    timestamp: dateToTimestampSim(new Date(fiveDaysAgo.setHours(12, 10, 0))),
    type: 'Takeaway',
    status: 'Completed',
    total: 35.0,
    cashier: 'Sarah Connor',
    discount: 0,
    tax: 2.80,
    deliveryCharge: 0,
  },
  {
    id: 'o_fda_2',
    orderNo: '#2011',
    timestamp: dateToTimestampSim(new Date(fiveDaysAgo.setHours(18, 50, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 112.5,
    cashier: 'John Doe',
    discount: 10.0,
    tax: 9.0,
    deliveryCharge: 0,
  },
  // 10 DAYS AGO
  {
    id: 'o_tda10',
    orderNo: '#1980',
    timestamp: dateToTimestampSim(new Date(tenDaysAgo.setHours(19, 0, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 120.0,
    cashier: 'John Doe',
    discount: 0,
    tax: 9.50,
    deliveryCharge: 0,
  },
  // LAST MONTH
  {
    id: 'o_lm_1',
    orderNo: '#1812',
    timestamp: dateToTimestampSim(new Date(lastMonthDate.setHours(13, 20, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 82.5,
    cashier: 'Sarah Connor',
    discount: 10.0,
    tax: 6.60,
    deliveryCharge: 0,
  },
  {
    id: 'o_lm_2',
    orderNo: '#1813',
    timestamp: dateToTimestampSim(new Date(lastMonthDate.setHours(19, 15, 0))),
    type: 'Delivery',
    status: 'Completed',
    total: 58.0,
    cashier: 'John Doe',
    discount: 0,
    tax: 4.60,
    deliveryCharge: 5.0,
  },
  {
    id: 'o_lm_3',
    orderNo: '#1814',
    timestamp: dateToTimestampSim(new Date(lastMonthDate.setHours(21, 30, 0))),
    type: 'Takeaway',
    status: 'Completed',
    total: 39.0,
    cashier: 'Sarah Connor',
    discount: 0,
    tax: 3.10,
    deliveryCharge: 0,
  },

  // DELETED / AUDIT ORDERS
  // SUB-TAB 1: Cancelled KOTs (In-Progress orders that were cancelled)
  {
    id: 'o_cx_1',
    orderNo: '#KOT-804',
    timestamp: dateToTimestampSim(new Date(todayDate.setHours(11, 40, 0))),
    type: 'Dine-In',
    status: 'In-Progress',
    total: 44.5,
    cashier: 'Sarah Connor',
    discount: 0,
    tax: 3.50,
    deliveryCharge: 0,
    cancelled: true,
    cancelledAt: dateToTimestampSim(new Date(todayDate.setHours(12, 0, 0))),
    cancelledReason: 'Customer decided they did not want to wait for steak, changed mind',
    cancelledBy: 'Sarah Connor'
  },
  {
    id: 'o_cx_2',
    orderNo: '#KOT-711',
    timestamp: dateToTimestampSim(new Date(yesterdayDate.setHours(14, 15, 0))),
    type: 'Delivery',
    status: 'In-Progress',
    total: 51.0,
    cashier: 'John Doe',
    discount: 5.0,
    tax: 4.0,
    deliveryCharge: 4.5,
    cancelled: true,
    cancelledAt: dateToTimestampSim(new Date(yesterdayDate.setHours(14, 25, 0))),
    cancelledReason: 'Delivery address is out of our current delivery radius',
    cancelledBy: 'John Doe'
  },
  {
    id: 'o_cx_3',
    orderNo: '#KOT-695',
    timestamp: dateToTimestampSim(new Date(threeDaysAgo.setHours(18, 30, 0))),
    type: 'Dine-In',
    status: 'In-Progress',
    total: 21.0,
    cashier: 'Sarah Connor',
    discount: 0,
    tax: 1.70,
    deliveryCharge: 0,
    cancelled: true,
    cancelledAt: dateToTimestampSim(new Date(threeDaysAgo.setHours(18, 35, 0))),
    cancelledReason: 'Accidental duplicate ticket printed in the kitchen',
    cancelledBy: 'Sarah Connor'
  },

  // SUB-TAB 2: Deleted Completed (Completed orders that were soft-deleted)
  {
    id: 'o_del_1',
    orderNo: '#2001',
    timestamp: dateToTimestampSim(new Date(threeDaysAgo.setHours(20, 15, 0))),
    type: 'Dine-In',
    status: 'Completed',
    total: 89.0,
    cashier: 'Sarah Connor',
    discount: 10.0,
    tax: 7.10,
    deliveryCharge: 0,
    deleted: true,
    deletedAt: dateToTimestampSim(new Date(threeDaysAgo.setHours(20, 45, 0))),
    deletedReason: 'Double payment charged by card machine. Refunded and ticket voided.',
    deletedBy: 'Manager Sarah'
  },
  {
    id: 'o_del_2',
    orderNo: '#1942',
    timestamp: dateToTimestampSim(new Date(fortyDaysAgo.setHours(13, 10, 0))),
    type: 'Takeaway',
    status: 'Completed',
    total: 18.5,
    cashier: 'John Doe',
    discount: 0,
    tax: 1.50,
    deliveryCharge: 0,
    deleted: true,
    deletedAt: dateToTimestampSim(new Date(fortyDaysAgo.setHours(13, 22, 0))),
    deletedReason: 'Wrong order type selected. Cashier selected Dine-In instead of Takeaway. Reissued correctly.',
    deletedBy: 'Manager John'
  }
];

export const initialOrderItems: OrderItem[] = [
  // items for o_td_1
  { id: 'oi1', orderId: 'o_td_1', name: 'Truffle Burger', quantity: 2, price: 18.5, category: 'Burgers' },
  { id: 'oi2', orderId: 'o_td_1', name: 'Craft IPA Beet', quantity: 1, price: 8.0, category: 'Beverages' },
  { id: 'oi3', orderId: 'o_td_1', name: 'Fresh Lemonade', quantity: 1, price: 4.5, category: 'Beverages' },
  { id: 'oi4', orderId: 'o_td_1', name: 'Fries with Garlic Aioli', quantity: 1, price: 6.5, category: 'Starters' },

  // o_td_2
  { id: 'oi5', orderId: 'o_td_2', name: 'Classic Cheeseburger', quantity: 2, price: 14.0, category: 'Burgers' },

  // o_td_3
  { id: 'oi6', orderId: 'o_td_3', name: 'Pepperoni Pizza 12\"', quantity: 3, price: 19.0, category: 'Pizza' },
  { id: 'oi7', orderId: 'o_td_3', name: 'Chocolate Fudge Brownie', quantity: 2, price: 9.0, category: 'Desserts' },

  // o_td_4
  { id: 'oi8', orderId: 'o_td_4', name: 'Truffle Burger', quantity: 3, price: 18.5, category: 'Burgers' },
  { id: 'oi9', orderId: 'o_td_4', name: 'Spicy Chicken Wings', quantity: 2, price: 12.0, category: 'Starters' },
  { id: 'oi10', orderId: 'o_td_4', name: 'Fries with Garlic Aioli', quantity: 2, price: 6.5, category: 'Starters' },
  { id: 'oi11', orderId: 'o_td_4', name: 'Craft IPA Beet', quantity: 4, price: 8.0, category: 'Beverages' },

  // o_yst_1
  { id: 'oi12', orderId: 'o_yst_1', name: 'Caesar Salad with Chicken', quantity: 1, price: 15.5, category: 'Salads' },
  { id: 'oi13', orderId: 'o_yst_1', name: 'Fresh Lemonade', quantity: 1, price: 4.5, category: 'Beverages' },

  // o_yst_2
  { id: 'oi14', orderId: 'o_yst_2', name: 'Margherita Pizza 12\"', quantity: 4, price: 16.5, category: 'Pizza' },
  { id: 'oi15', orderId: 'o_yst_2', name: 'Pepperoni Pizza 12\"', quantity: 2, price: 19.0, category: 'Pizza' },
  { id: 'oi16', orderId: 'o_yst_2', name: 'Chocolate Fudge Brownie', quantity: 3, price: 9.0, category: 'Desserts' },

  // o_yst_3
  { id: 'oi17', orderId: 'o_yst_3', name: 'Classic Cheeseburger', quantity: 3, price: 14.0, category: 'Burgers' },

  // o_tda_1
  { id: 'oi18', orderId: 'o_tda_1', name: 'Truffle Burger', quantity: 2, price: 18.5, category: 'Burgers' },
  { id: 'oi19', orderId: 'o_tda_1', name: 'Sweet Potato Fries', quantity: 2, price: 7.5, category: 'Starters' },

  // o_tda_2
  { id: 'oi20', orderId: 'o_tda_2', name: 'Pepperoni Pizza 12\"', quantity: 4, price: 19.0, category: 'Pizza' },
  { id: 'oi21', orderId: 'o_tda_2', name: 'Craft IPA Beet', quantity: 2, price: 8.0, category: 'Beverages' },

  // o_fda_1
  { id: 'oi22', orderId: 'o_fda_1', name: 'Spicy Chicken Wings', quantity: 2, price: 12.0, category: 'Starters' },

  // o_fda_2
  { id: 'oi23', orderId: 'o_fda_2', name: 'Margherita Pizza 12\"', quantity: 2, price: 16.5, category: 'Pizza' },
  { id: 'oi24', orderId: 'o_fda_2', name: 'Truffle Burger', quantity: 3, price: 18.5, category: 'Burgers' },
  { id: 'oi25', orderId: 'o_fda_2', name: 'Chocolate Fudge Brownie', quantity: 2, price: 9.0, category: 'Desserts' },

  // o_tda10
  { id: 'oi26', orderId: 'o_tda10', name: 'Truffle Burger', quantity: 5, price: 18.5, category: 'Burgers' },
  { id: 'oi27', orderId: 'o_tda10', name: 'Fries with Garlic Aioli', quantity: 3, price: 6.5, category: 'Starters' },

  // o_lm_1
  { id: 'oi28', orderId: 'o_lm_1', name: 'Classic Cheeseburger', quantity: 4, price: 14.0, category: 'Burgers' },
  { id: 'oi29', orderId: 'o_lm_1', name: 'Sweet Potato Fries', quantity: 2, price: 7.5, category: 'Starters' },

  // o_lm_2
  { id: 'oi30', orderId: 'o_lm_2', name: 'Margherita Pizza 12\"', quantity: 3, price: 16.5, category: 'Pizza' },

  // o_lm_3
  { id: 'oi31', orderId: 'o_lm_3', name: 'Caesar Salad with Chicken', quantity: 2, price: 15.5, category: 'Salads' },

  // KOT cancelled 1
  { id: 'oi_cx1_1', orderId: 'o_cx_1', name: 'Truffle Burger', quantity: 2, price: 18.5, category: 'Burgers' },
  { id: 'oi_cx1_2', orderId: 'o_cx_1', name: 'Sweet Potato Fries', quantity: 1, price: 7.5, category: 'Starters' },

  // KOT cancelled 2
  { id: 'oi_cx2_1', orderId: 'o_cx_2', name: 'Pepperoni Pizza 12\"', quantity: 2, price: 19.0, category: 'Pizza' },
  { id: 'oi_cx2_2', orderId: 'o_cx_2', name: 'Craft IPA Beet', quantity: 1, price: 8.0, category: 'Beverages' },

  // KOT cancelled 3
  { id: 'oi_cx3_1', orderId: 'o_cx_3', name: 'Spicy Chicken Wings', quantity: 1, price: 12.0, category: 'Starters' },
  { id: 'oi_cx3_2', orderId: 'o_cx_3', name: 'Chocolate Fudge Brownie', quantity: 1, price: 9.0, category: 'Desserts' },

  // Deleted 1
  { id: 'oi_del1_1', orderId: 'o_del_1', name: 'Margherita Pizza 12\"', quantity: 3, price: 16.5, category: 'Pizza' },
  { id: 'oi_del1_2', orderId: 'o_del_1', name: 'Pepperoni Pizza 12\"', quantity: 2, price: 19.0, category: 'Pizza' },
  { id: 'oi_del1_3', orderId: 'o_del_1', name: 'Fresh Lemonade', quantity: 2, price: 4.5, category: 'Beverages' },

  // Deleted 2
  { id: 'oi_del2_1', orderId: 'o_del_2', name: 'Classic Cheeseburger', quantity: 1, price: 14.0, category: 'Burgers' },
  { id: 'oi_del2_2', orderId: 'o_del_2', name: 'Fresh Lemonade', quantity: 1, price: 4.5, category: 'Beverages' }
];

export const initialOrderItemModifiers: OrderItemModifier[] = [
  // Modifiers for oi1 (Truffle Burger)
  { id: 'mdf1', orderItemId: 'oi1', name: 'Extra Truffle Mayo', price: 1.5 },
  { id: 'mdf2', orderItemId: 'oi1', name: 'Gluten-Free Bun', price: 2.0 },
  // For oi5 (Classic Cheeseburger)
  { id: 'mdf3', orderItemId: 'oi5', name: 'Extra Cheddar Cheese', price: 1.0 },
  // For oi8 Burger
  { id: 'mdf4', orderItemId: 'oi8', name: 'Crispy Bacon Add-on', price: 2.5 },
  { id: 'mdf5', orderItemId: 'oi8', name: 'Double Beef Patty', price: 4.0 },
  // For oi17
  { id: 'mdf6', orderItemId: 'oi17', name: 'Extra Pickle', price: 0.5 },
  // For canceled o_cx_1 Burger
  { id: 'mdf7', orderItemId: 'oi_cx1_1', name: 'Well Done', price: 0 }
];

// INVENTORY ITEMS
export const initialIngredients: Ingredient[] = [
  // SECTION 1: Stocked Items (Items with directStock)
  { id: 'i1', name: 'Brioche Burger Buns', currentQty: 75, unit: 'pcs', lowStockThreshold: 20, directStock: true, category: 'Baking' },
  { id: 'i2', name: 'Craft IPA Kegs 15L', currentQty: 2, unit: 'kegs', lowStockThreshold: 3, directStock: true, category: 'Beverages' },
  { id: 'i3', name: 'Pre-Packaged Garlic Mayo', currentQty: 12, unit: 'bottles', lowStockThreshold: 15, directStock: true, category: 'Condiments' }, // LOW STOCK!
  { id: 'i4', name: 'Sweet Potato Fries (Frozen)', currentQty: 0, unit: 'bags', lowStockThreshold: 10, directStock: true, category: 'Frozen Food' }, // OUT OF STOCK!
  { id: 'i5', name: 'Single-Sourced Chocolate Brownies', currentQty: 8, unit: 'pcs', lowStockThreshold: 12, directStock: true, category: 'Dessert Prep' }, // LOW STOCK!
  { id: 'i6', name: 'Bottled Sparking Water', currentQty: 120, unit: 'bottles', lowStockThreshold: 30, directStock: true, category: 'Beverages' },

  // SECTION 2: Ingredient Stock (Ingredients for prepared items)
  { id: 'ing1', name: 'Fresh Prime Beef Patties (180g)', currentQty: 18, unit: 'pcs', lowStockThreshold: 25, directStock: false }, // LOW STOCK
  { id: 'ing2', name: 'Aged Cheddar Cheese Slices', currentQty: 140, unit: 'slices', lowStockThreshold: 50, directStock: false },
  { id: 'ing3', name: 'Truffle Oil Gold', currentQty: 1.5, unit: 'liters', lowStockThreshold: 0.5, directStock: false },
  { id: 'ing4', name: 'Mozzarella Shredded Cheese', currentQty: 22.0, unit: 'kg', lowStockThreshold: 10.0, directStock: false },
  { id: 'ing5', name: 'San Marzano Pizza Sauce Base', currentQty: 4.0, unit: 'kg', lowStockThreshold: 8.0, directStock: false }, // LOW STOCK
  { id: 'ing6', name: 'Fresh Potatoes (Russet)', currentQty: 85.0, unit: 'kg', lowStockThreshold: 30.0, directStock: false },
  { id: 'ing7', name: 'Whole Chicken Wings', currentQty: 0.0, unit: 'kg', lowStockThreshold: 15.0, directStock: false }, // OUT OF STOCK!
  { id: 'ing8', name: 'Romaine Lettuce Heads', currentQty: 45, unit: 'pcs', lowStockThreshold: 15, directStock: false },
  { id: 'ing9', name: 'Whole Chicken Breast', currentQty: 24.5, unit: 'kg', lowStockThreshold: 10.0, directStock: false }
];

// EXPENSES DATA (Distributed historically relative to current June date)
export const initialExpenses: Expense[] = [
  // Today's fresh supplier delivery
  {
    id: 'e1',
    date: dateToTimestampSim(new Date(todayDate.setHours(9, 30, 0))),
    description: 'Fresh vegetable delivery (Lettuce, Tomatoes, Potatoes, Herbs)',
    category: 'Inventory & Food Cost',
    amount: 185.0
  },
  // Yesterday's routine
  {
    id: 'e2',
    date: dateToTimestampSim(new Date(yesterdayDate.setHours(15, 0, 0))),
    description: 'Premium Meat Supplier (Beef Patties, Chicken Breasts)',
    category: 'Inventory & Food Cost',
    amount: 540.0
  },
  {
    id: 'e3',
    date: dateToTimestampSim(new Date(yesterdayDate.setHours(11, 0, 0))),
    description: 'Instagram advertising promotion - Summer Burgers blast',
    category: 'Marketing & Advertising',
    amount: 120.0
  },
  // This week
  {
    id: 'e4',
    date: dateToTimestampSim(new Date(threeDaysAgo.setHours(10, 15, 0))),
    description: 'Weekly restaurant deep cleaning services',
    category: 'Rent & Utilities',
    amount: 250.0
  },
  {
    id: 'e5',
    date: dateToTimestampSim(new Date(fiveDaysAgo.setHours(16, 45, 0))),
    description: 'Emergency repair of ice machine compressor Unit B',
    category: 'Equipment & Repairs',
    amount: 420.0
  },
  // Earlier in the month
  {
    id: 'e6',
    date: dateToTimestampSim(new Date(tenDaysAgo.setHours(14, 0, 0))),
    description: 'Bi-weekly front of house and kitchen shift wages payment',
    category: 'Salaries & Wages',
    amount: 2850.0
  },
  {
    id: 'e7',
    date: dateToTimestampSim(new Date(tenDaysAgo.setHours(11, 30, 0))),
    description: 'Waste management and recycling bin fees',
    category: 'Rent & Utilities',
    amount: 95.0
  },
  // Last month
  {
    id: 'e8',
    date: dateToTimestampSim(new Date(lastMonthDate.setHours(10, 0, 0))),
    description: 'Monthly commercial restaurant building rent payment',
    category: 'Rent & Utilities',
    amount: 3800.0
  },
  {
    id: 'e9',
    date: dateToTimestampSim(new Date(lastMonthDate.setHours(17, 0, 0))),
    description: 'Electricity & Gas monthly utility bill',
    category: 'Rent & Utilities',
    amount: 680.0
  },
  {
    id: 'e10',
    date: dateToTimestampSim(new Date(lastMonthDate.setHours(12, 0, 0))),
    description: 'Major order of baking items & brioche buns stock',
    category: 'Inventory & Food Cost',
    amount: 320.0
  },
  {
    id: 'e11',
    date: dateToTimestampSim(new Date(lastMonthDate.setHours(15, 30, 0))),
    description: 'Staff safety first aid kit refills & safety hazard signs',
    category: 'Miscellaneous',
    amount: 65.0
  }
];
