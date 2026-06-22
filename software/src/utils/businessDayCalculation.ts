/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../lib/db';

let cachedCutoff = '04:00';

/**
 * Initializes the business day cutoff from settings in Dexie.
 * Fallback to default of "04:00" if not set.
 */
export async function initializeBusinessDayCutoff(): Promise<string> {
  try {
    const entry = await db.settings.where({ key: 'businessDayCutoff' }).first();
    if (entry && entry.value) {
      cachedCutoff = entry.value;
    } else {
      // Seed default if not exists
      await db.settings.put({ key: 'businessDayCutoff', value: '04:00' });
      cachedCutoff = '04:00';
    }
  } catch (err) {
    console.warn('Failed to initialize business day cutoff from Dexie:', err);
  }
  return cachedCutoff;
}

/**
 * Updates the in-memory cache and saves the setting to Dexie.
 */
export async function updateBusinessDayCutoff(value: string): Promise<void> {
  cachedCutoff = value;
  try {
    const entry = await db.settings.where({ key: 'businessDayCutoff' }).first();
    if (entry) {
      await db.settings.update(entry.id!, { value });
    } else {
      await db.settings.add({ key: 'businessDayCutoff', value });
    }
  } catch (err) {
    console.error('Failed to update business day cutoff in Dexie Settings:', err);
  }
}

export function getCachedCutoff(): string {
  return cachedCutoff;
}

/**
 * Input: any timestamp (order creation, expense creation, etc.)
 * Output: Date object representing which business day this timestamp belongs to (at cutoff time).
 */
export function getBusinessDate(timestamp: number): Date {
  const orderTime = new Date(timestamp);
  const cutoff = cachedCutoff;
  const [hour, minute] = cutoff.split(':').map(Number);

  // Create today's cutoff datetime
  const todayAtCutoff = new Date(orderTime);
  todayAtCutoff.setHours(hour, minute, 0, 0);

  if (orderTime.getTime() >= todayAtCutoff.getTime()) {
    // Order is after or at cutoff, use today
    const businessDateStart = new Date(orderTime);
    businessDateStart.setHours(hour, minute, 0, 0);
    return businessDateStart;
  } else {
    // Order is before cutoff, use yesterday
    const yesterday = new Date(orderTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const businessDateStart = new Date(yesterday);
    businessDateStart.setHours(hour, minute, 0, 0);
    return businessDateStart;
  }
}

/**
 * Input: Two calendar dates, cutoff time
 * Output: Adjusted date range respecting business day logic.
 */
export function getBusinessDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number,
  cutoff: string = cachedCutoff
): { start: Date; end: Date } {
  const start = new Date(getBusinessDayStart(startDate, cutoff));
  const end = new Date(getBusinessDayEnd(endDate, cutoff));
  return { start, end };
}

/**
 * Input: any date
 * Output: timestamp of that business day's start (at cutoff time)
 */
export function getBusinessDayStart(date: Date | string | number, cutoff: string = cachedCutoff): number {
  const d = new Date(date);
  const [hour, minute] = cutoff.split(':').map(Number);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/**
 * Input: any date
 * Output: timestamp of that business day's end (just before next cutoff)
 */
export function getBusinessDayEnd(date: Date | string | number, cutoff: string = cachedCutoff): number {
  const d = new Date(date);
  const [hour, minute] = cutoff.split(':').map(Number);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.getTime() - 1;
}

function parseLocalDate(val: Date | string | number): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    if (!val.includes('T')) {
      return new Date(`${val}T00:00:00`);
    }
    return new Date(val);
  }
  return new Date(val);
}

export function getTodayBusinessDay(cutoff: string = cachedCutoff): Date {
  const now = new Date();
  const [hour, minute] = cutoff.split(':').map(Number);
  
  const todayAtCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  
  if (now.getTime() >= todayAtCutoff.getTime()) {
    return todayAtCutoff;
  } else {
    const yesterday = new Date(todayAtCutoff);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
}

export function getRecordsDateRange(
  period: string,
  cutoff: string = cachedCutoff
): { startDate: Date; endDate: Date } {
  const [hour, minute] = cutoff.split(':').map(Number);
  const now = new Date();
  
  // Create cutoff datetime for today
  const todayAtCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  
  let todayBusStart: Date;
  if (now.getTime() >= todayAtCutoff.getTime()) {
    // Business day already started
    todayBusStart = todayAtCutoff;
  } else {
    // Still in yesterday's business day
    todayBusStart = new Date(todayAtCutoff.getTime());
    todayBusStart.setDate(todayBusStart.getDate() - 1);
  }
  
  const tomorrowBusStart = new Date(todayBusStart.getTime());
  tomorrowBusStart.setDate(tomorrowBusStart.getDate() + 1);
  
  switch (period) {
    case 'today': {
      const startDate = todayBusStart;
      const endDate = new Date(tomorrowBusStart.getTime() - 1);
      return { startDate, endDate };
    }
    case 'yesterday': {
      const startDate = new Date(todayBusStart.getTime());
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(todayBusStart.getTime() - 1);
      return { startDate, endDate };
    }
    case 'thisWeek':
    case 'week': {
      const today = new Date();
      const dayOfWeek = today.getDay(); // (0=Sunday, 1=Monday)
      // Get Monday
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - daysToMonday);
      monday.setHours(hour, minute, 0, 0);

      const endDate = new Date(); // current moment
      return { startDate: monday, endDate };
    }
    case 'thisMonth':
    case 'month': {
      // Get 1st of current month
      const startDate = new Date(todayBusStart.getFullYear(), todayBusStart.getMonth(), 1, hour, minute, 0, 0);
      const endDate = new Date(tomorrowBusStart.getTime() - 1);
      return { startDate, endDate };
    }
    case 'lastMonth':
    case 'last-month': {
      const startDate = new Date(todayBusStart.getFullYear(), todayBusStart.getMonth() - 1, 1, hour, minute, 0, 0);
      const firstOfThisMonth = new Date(todayBusStart.getFullYear(), todayBusStart.getMonth(), 1, hour, minute, 0, 0);
      const endDate = new Date(firstOfThisMonth.getTime() - 1);
      return { startDate, endDate };
    }
    default: {
      const startDate = todayBusStart;
      const endDate = new Date(tomorrowBusStart.getTime() - 1);
      return { startDate, endDate };
    }
  }
}

export function getBusinessDayRange(
  period: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'week' | 'month' | 'last-month',
  cutoff: string = cachedCutoff
): { startDate: Date; endDate: Date } {
  return getRecordsDateRange(period, cutoff);
}

export function convertCustomDateRange(
  fromDate: Date | string | number,
  toDate: Date | string | number,
  cutoff: string = cachedCutoff
): { startDate: Date; endDate: Date } {
  const [hour, minute] = cutoff.split(':').map(Number);
  
  const from = parseLocalDate(fromDate);
  const startDate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute, 0, 0);
  
  const to = parseLocalDate(toDate);
  const nextDay = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, hour, minute, 0, 0);
  const endDate = new Date(nextDay.getTime() - 1);
  
  return { startDate, endDate };
}
