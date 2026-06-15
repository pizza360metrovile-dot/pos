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
 * Output: Date object representing which business day this timestamp belongs to (at 00:00:00.000).
 */
export function getBusinessDate(timestamp: number): Date {
  const date = new Date(timestamp);
  const cutoff = cachedCutoff;
  const [hour, minute] = cutoff.split(':').map(Number);

  // Create a cutoff datetime for the calendar day of 'timestamp'
  const cutoffToday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);

  let resultDate: Date;
  if (timestamp >= cutoffToday.getTime()) {
    // Return today's date
    resultDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  } else {
    // Return yesterday's date
    const yesterday = new Date(date.getTime());
    yesterday.setDate(yesterday.getDate() - 1);
    resultDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
  }
  return resultDate;
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

export function getBusinessDayRange(
  period: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'week' | 'month' | 'last-month',
  cutoff: string = cachedCutoff
): { startDate: Date; endDate: Date } {
  const today = getTodayBusinessDay(cutoff);
  
  switch (period) {
    case 'today': {
      const tomorrow = new Date(today.getTime());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow.getTime() - 1);
      return { startDate: today, endDate };
    }
    case 'yesterday': {
      const yesterday = new Date(today.getTime());
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = new Date(today.getTime() - 1);
      return { startDate: yesterday, endDate };
    }
    case 'thisWeek':
    case 'week': {
      const currentDay = today.getDay();
      const gap = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(today.getTime());
      monday.setDate(today.getDate() - gap);
      
      const tomorrow = new Date(today.getTime());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow.getTime() - 1);
      return { startDate: monday, endDate };
    }
    case 'thisMonth':
    case 'month': {
      const firstOfMonth = new Date(today.getTime());
      firstOfMonth.setDate(1);
      
      const tomorrow = new Date(today.getTime());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow.getTime() - 1);
      return { startDate: firstOfMonth, endDate };
    }
    case 'lastMonth':
    case 'last-month': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1, today.getHours(), today.getMinutes(), 0, 0);
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1, today.getHours(), today.getMinutes(), 0, 0);
      const endDate = new Date(firstOfThisMonth.getTime() - 1);
      return { startDate: lastMonthStart, endDate };
    }
    default: {
      const tomorrow = new Date(today.getTime());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow.getTime() - 1);
      return { startDate: today, endDate };
    }
  }
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
