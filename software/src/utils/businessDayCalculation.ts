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
