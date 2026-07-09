import { db } from '../lib/db';
import { getBusinessDate } from '../utils/businessDayCalculation';
import { syncDoc } from '../utils/syncToFirestore';

export async function migrateBusinessDates() {
  console.log('Starting businessDate migration...');
  
  try {
    const allOrders = await db.orders.toArray();
    console.log(`Found ${allOrders.length} orders to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const order of allOrders) {
      // Calculate correct businessDate
      const completedAt = order.completedAt || order.createdAt || Date.now();
      const correctBusinessDate = getBusinessDate(completedAt);
      const correctBusinessDateMs = correctBusinessDate.getTime();
      
      // Compare with current value
      const currentBusinessDateMs = 
        typeof order.businessDate === 'number' 
          ? order.businessDate 
          : order.businessDate?.getTime?.();
      
      // Only update if different
      if (correctBusinessDateMs !== currentBusinessDateMs) {
        order.businessDate = correctBusinessDateMs;
        
        // Update in Dexie
        await db.orders.put(order);
        
        // Sync to Firebase
        await syncDoc('orders', order.id, {
          businessDate: correctBusinessDateMs,
          updatedAt: Date.now()
        });
        
        migratedCount++;
        
        if (migratedCount % 50 === 0) {
          console.log(`Migrated ${migratedCount} orders...`);
        }
      } else {
        skippedCount++;
      }
    }
    
    console.log(`Migration complete!`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    
    return { migratedCount, skippedCount };
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
