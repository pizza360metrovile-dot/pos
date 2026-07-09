import { db } from '../lib/db';
import { getBusinessDate } from '../utils/businessDayCalculation';
import { syncDoc } from '../utils/syncToFirestore';

export async function fixAllBusinessDates() {
  console.log('🔄 Starting businessDate migration...');
  
  try {
    const allOrders = await db.orders.toArray();
    console.log(`Found ${allOrders.length} orders`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const order of allOrders) {
      const completedAt = order.completedAt || order.createdAt;
      if (!completedAt) {
        console.warn(`Order ${order.id} has no date`);
        skippedCount++;
        continue;
      }
      
      // Calculate CORRECT businessDate
      const correctBusinessDate = getBusinessDate(completedAt);
      const correctBusinessDateMs = correctBusinessDate.getTime();
      
      // Compare with current value
      const currentBusinessDateMs = 
        typeof order.businessDate === 'number'
          ? order.businessDate
          : (order.businessDate as any)?.getTime?.();
      
      // If different, FIX IT
      if (correctBusinessDateMs !== currentBusinessDateMs) {
        order.businessDate = correctBusinessDateMs;
        
        try {
          // Save to Dexie
          await db.orders.put(order);
          
          // Sync to Firebase
          await syncDoc('orders', order.id, {
            businessDate: correctBusinessDateMs,
            _migrationFixed: Date.now()
          });
          
          fixedCount++;
          
          if (fixedCount % 10 === 0) {
            console.log(`✓ Fixed ${fixedCount} orders...`);
          }
        } catch (error) {
          console.error(`Failed to fix order ${order.id}:`, error);
        }
      } else {
        skippedCount++;
      }
    }
    
    console.log(`✅ Migration complete!`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    
    return { fixedCount, skippedCount, total: allOrders.length };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
