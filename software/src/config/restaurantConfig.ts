/**
 * Restaurant Configuration
 * Change RESTAURANT_ID to generate unique license for different restaurants
 * 
 * Each restaurant gets its own unique ID
 * Use this ID in your license generator tool
 */

export const RESTAURANT_ID = 'pizza-360-mtrvl'

// Optional: Restaurant details (for reference)
export const RESTAURANT_INFO = {
  id: RESTAURANT_ID,
  name: 'Pizza Metro', // Update as needed
  location: 'Karachi', // Update as needed
  createdAt: new Date('2026-01-15').getTime(),
}

/**
 * Format for documentation:
 * 
 * Each new restaurant:
 * 1. Create unique RESTAURANT_ID (e.g., REST-2026-002)
 * 2. Update RESTAURANT_INFO with details
 * 3. User copies RESTAURANT_ID from license modal
 * 4. Paste into license generator tool
 * 5. Get license key back
 * 6. Enter license key in app
 * 
 * Format: REST-YYYY-NNN
 *   REST = prefix
 *   YYYY = year
 *   NNN = sequential number per year
 */
