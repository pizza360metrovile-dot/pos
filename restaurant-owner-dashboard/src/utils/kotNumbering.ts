import { db } from '../lib/db';
import { getBusinessDate } from './businessDayCalculation';

export async function getNextKOTNumber(): Promise<number> {
  const currentBusinessDay = getBusinessDate(Date.now());
  
  // Fetch actual last KOT chronologically (by auto-increment ID or insertion)
  const lastKOT = await db.kotSnapshots.toCollection().last();
  
  if (!lastKOT) {
    console.log('[KOT] No previous KOTs found, returning KOT #1');
    return 1;
  }
  
  const lastKOTBusinessDay = getBusinessDate(lastKOT.sentAt);
  const isSameDay = currentBusinessDay.getTime() === lastKOTBusinessDay.getTime();
  
  console.log('[KOT] Current business day:', currentBusinessDay);
  console.log('[KOT] Last KOT business day:', lastKOTBusinessDay);
  console.log('[KOT] Same day?', isSameDay);
  
  const kotNumber = isSameDay ? (lastKOT.kotNumber + 1) : 1;
  console.log('[KOT] Next KOT number:', kotNumber);
  
  return kotNumber;
}

export function isSameBusinessDay(
  date1: number,
  date2: number
): boolean {
  const bd1 = getBusinessDate(date1);
  const bd2 = getBusinessDate(date2);
  
  return bd1.getTime() === bd2.getTime();
}
