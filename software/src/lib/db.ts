/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { Table } from 'dexie';
import { 
  MenuItem, 
  Category, 
  Order, 
  OrderItem, 
  RestaurantSettings, 
  Ingredient,
  Recipe,
  RecipeItem,
  StockLog,
  KotSnapshot,
  ModifierGroup,
  ModifierOption,
  OrderItemModifier
} from '../types';

export class RMSDatabase extends Dexie {
  settings!: Table<{ id?: number; key: string; value: any }>;
  categories!: Table<Category>;
  menuItems!: Table<MenuItem>;
  orders!: Table<Order>;
  orderItems!: Table<OrderItem & { orderId: string }>;
  ingredients!: Table<Ingredient>;
  recipes!: Table<Recipe>;
  recipeItems!: Table<RecipeItem>;
  stockLog!: Table<StockLog>;
  kotSnapshots!: Table<KotSnapshot>;
  modifierGroups!: Table<ModifierGroup>;
  modifierOptions!: Table<ModifierOption>;
  orderItemModifiers!: Table<OrderItemModifier>;
  users!: Table<{ id: string; email: string; password: string }>;
  used_keys!: Table<{ signature: string; timestamp: string }>;
  sync_queue!: Table<{ id?: number; signature: string; timestamp: string; synced: number }>;
  appMeta!: Table<{ key: string; value: any }>;

  constructor() {
    super('rms_db');
    this.version(1).stores({
      settings: '++id, key',
      categories: '++id, name',
      menuItems: '++id, categoryId, name, isActive',
      orders: '++id, createdAt, status, type',
      orderItems: '++id, orderId, menuItemId'
    });

    this.version(2).stores({
      ingredients: '++id, name, unit',
      recipes: '++id, menuItemId',
      recipeItems: '++id, recipeId, ingredientId',
      stockLog: '++id, ingredientId, createdAt, reason'
    });

    this.version(3).stores({
      users: 'id, email'
    });

    this.version(4).stores({}).upgrade(tx => {
      return tx.table('menuItems').toCollection().modify(item => {
        delete item.imageUrl;
      });
    });

    this.version(5).stores({}).upgrade(tx => {
      tx.table('categories').toCollection().modify(cat => {
        if (!cat.type) cat.type = 'prepared';
      });
      tx.table('menuItems').toCollection().modify(item => {
        if (item.directStock === undefined) item.directStock = item.stock || 0;
      });
    });

    this.version(6).stores({
      kotSnapshots: '++id, orderId, sentAt'
    });

    this.version(7).stores({}).upgrade(tx => {
      return tx.table('menuItems').toCollection().modify(item => {
        if (!item.disabledReason) item.disabledReason = null;
      });
    });

    this.version(8).stores({}).upgrade(tx => {
      return tx.table('settings').toCollection().modify(s => {
        if (s.key === 'main') {
          if (s.value.deliveryChargeEnabled === undefined) s.value.deliveryChargeEnabled = true;
          if (s.value.deliveryChargeAmount === undefined) s.value.deliveryChargeAmount = 0;
          if (s.value.deliveryChargeLabel === undefined) s.value.deliveryChargeLabel = 'Delivery Charge';
          if (s.value.deliveryChargeTaxable === undefined) s.value.deliveryChargeTaxable = false;
        }
      });
    });

    this.version(9).stores({}).upgrade(tx => {
      // Cleanup any legacy shift fields in settings table as requested
      return tx.table('settings').toCollection().modify(setting => {
        if (setting.key === 'main' && setting.value) {
          delete setting.value.shiftIsOpen;
          delete setting.value.shiftOpenedAt;
          delete setting.value.shiftOpeningCash;
          delete setting.value.shiftClosingCash;
          delete setting.value.shiftNotes;
        }
      });
    });

    this.version(10).stores({
      modifierGroups: '++id, categoryId, name, type',
      modifierOptions: '++id, groupId, label, additionalPrice',
      orderItemModifiers: '++id, orderItemId, modifierGroupId'
    });

    this.version(11).stores({
      used_keys: 'signature, timestamp',
      sync_queue: '++id, signature, timestamp, synced'
    });

    this.version(12).stores({
      appMeta: 'key'
    });

    this.version(13).stores({
      modifierGroups: '++id, menuItemId, name, type'
    }).upgrade(tx => {
      return tx.table('modifierGroups').toCollection().modify(group => {
        group.menuItemId = null;
        delete (group as any).categoryId;
      });
    });

    this.version(14).stores({
      orderItemModifiers: '++id, orderItemId, modifierGroupId, orderId'
    });

    this.version(15).stores({}).upgrade(tx => {
      return tx.table('orders').toCollection().modify(order => {
        if (order.discountType === undefined) order.discountType = null;
        if (order.discountValue === undefined) order.discountValue = 0;
        if (order.discountAmount === undefined) order.discountAmount = 0;
      });
    });

    this.version(16).stores({}).upgrade(tx => {
      return tx.table('orders').toCollection().modify(order => {
        if (order.isDeleted === undefined) order.isDeleted = false;
        if (order.deletedAt === undefined) order.deletedAt = null;
        if (order.deletedReason === undefined) order.deletedReason = null;
        if (order.deletedBy === undefined) order.deletedBy = null;
      });
    });

    this.version(17).stores({}).upgrade(tx => {
      return tx.table('orders').toCollection().modify(order => {
        if (order.status === 'refunded') {
          order.status = 'completed';
          order.isDeleted = true;
          order.deletedReason = 'Refunded';
          order.deletedAt = Date.now();
        }
      });
    });
  }
}

export const db = new RMSDatabase();
