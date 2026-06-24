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
  // Cutoff time: 04:00 (4 AM)
  const CUTOFF_HOUR = 4;
  const CUTOFF_MINUTE = 0;

  // Create a date object from timestamp
  const orderDateTime = new Date(timestamp);
  
  // Get the calendar date of this order
  // (year, month, date only - zero out hours)
  const orderYear = orderDateTime.getFullYear();
  const orderMonth = orderDateTime.getMonth();
  const orderDate = orderDateTime.getDate();
  
  // Create cutoff time for THIS calendar day
  const cutoffDateTime = new Date(
    orderYear,
    orderMonth,
    orderDate,
    CUTOFF_HOUR,
    CUTOFF_MINUTE,
    0,
    0
  );
  
  // RULE: If order time >= cutoff time on its calendar day,
  // then business day = that calendar day
  if (orderDateTime.getTime() >= cutoffDateTime.getTime()) {
    // Business day started on this day
    // Return start of this business day (at cutoff)
    return cutoffDateTime;
  } else {
    // Order is before cutoff on its day
    // So it belongs to PREVIOUS business day
    // Business day = previous calendar day at cutoff
    const previousDay = new Date(
      orderYear,
      orderMonth,
      orderDate - 1,  // Previous calendar date
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    return previousDay;
  }
}

export function getRecordsDateRange(
  period: string,
  cutoff: string = cachedCutoff
): { startDate: Date; endDate: Date } {
  const CUTOFF_HOUR = 4;
  const CUTOFF_MINUTE = 0;
  
  // Current moment
  const now = new Date();
  
  // Today's calendar date at cutoff time
  const todayAtCutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    CUTOFF_HOUR,
    CUTOFF_MINUTE,
    0,
    0
  );
  
  let startDate: Date;
  let endDate: Date;
  
  if (period === 'today') {
    // If current time >= cutoff, today's business day started at cutoff
    // If current time < cutoff, still in yesterday's business day
    if (now.getTime() >= todayAtCutoff.getTime()) {
      // Business day started
      startDate = new Date(todayAtCutoff);
      // End is tomorrow at cutoff - 1ms
      endDate = new Date(todayAtCutoff);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setMilliseconds(-1);
    } else {
      // Still in yesterday's business day
      startDate = new Date(todayAtCutoff);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(todayAtCutoff);
      endDate.setMilliseconds(-1);
    }
  } 
  else if (period === 'yesterday') {
    // Yesterday's business day = (yesterday calendar day at cutoff) to (today at cutoff - 1ms)
    startDate = new Date(todayAtCutoff);
    startDate.setDate(startDate.getDate() - 1);
    endDate = new Date(todayAtCutoff);
    endDate.setMilliseconds(-1);
  } 
  else if (period === 'thisWeek' || period === 'week') {
    // This week = Monday of this week at cutoff to now
    const dayOfWeek = now.getDay(); 
    // 0=Sunday, 1=Monday, ... 6=Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    startDate = new Date(now);
    startDate.setDate(now.getDate() - daysToMonday);
    startDate.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    endDate = new Date(now);
  } 
  else if (period === 'thisMonth' || period === 'month') {
    // This month = 1st of month at cutoff to now
    startDate = new Date(now);
    startDate.setDate(1);
    startDate.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    endDate = new Date(now);
  } 
  else if (period === 'lastMonth' || period === 'last-month') {
    // Last month helper logic
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    endDate = new Date(firstOfThisMonth.getTime() - 1);
  }
  else {
    // All time
    startDate = new Date(0);
    endDate = new Date(now);
  }
  
  return { startDate, endDate };
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
