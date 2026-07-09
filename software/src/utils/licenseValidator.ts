import { RESTAURANT_ID, RESTAURANT_INFO } from '../config/restaurantConfig'

/**
 * License validation and management
 * Stores license data in Firebase under restaurant doc
 */

export interface LicenseData {
  licenseKey: string
  licensedRestaurant: string
  validUntil: number // Timestamp in ms
  activatedAt: number // Timestamp in ms
  isValid: boolean
  deviceId: string // Device that activated it
  restaurantId: string // Unique restaurant identifier
}

/**
 * Get restaurant ID for license generation
 */
export function getRestaurantId(): string {
  return RESTAURANT_ID
}

/**
 * Get restaurant info
 */
export function getRestaurantInfo() {
  return RESTAURANT_INFO
}

/**
 * Validate license format
 * License key format: XXXX-XXXX-XXXX-XXXX (example)
 * Adjust regex based on your actual license format
 */
export function isValidLicenseFormat(key: string): boolean {
  // Basic format check - adjust regex as needed
  const licenseRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  return licenseRegex.test(key)
}

/**
 * Check if license is expired
 */
export function isLicenseExpired(validUntil: number): boolean {
  const now = Date.now()
  return now > validUntil
}

/**
 * Calculate days remaining on license
 */
export function getLicenseDaysRemaining(validUntil: number): number {
  const now = Date.now()
  const msPerDay = 86400000
  const daysRemaining = Math.ceil((validUntil - now) / msPerDay)
  return Math.max(0, daysRemaining)
}

/**
 * Verify license with backend (mock implementation)
 * In production: Call your license server to validate key
 */
const SECRET_SALT = "78R4JHGFpizza360metrovileEWIUH34@12<D>"
const LICENSE_VALIDITY_DAYS = 365

/**
 * SHA256 hash function for license validation
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify license key format and authenticity
 * License format: Base64(timestamp|signature)
 * Signature: SHA256(restaurantId + timestamp + SECRET_SALT)
 */
export async function verifyLicenseWithBackend(
  licenseKey: string,
  restaurantId: string
): Promise<{
  isValid: boolean
  restaurantName: string
  validUntil: number
  error?: string
}> {
  try {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid or Expired License Key',
      };
    }

    // Step A: Decode Base64 and split by pipe symbol (|) or colon (:) for compatibility
    let decodedKey: string;
    try {
      decodedKey = atob(trimmedKey);
    } catch (err) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid or Expired License Key',
      };
    }

    const parts = decodedKey.includes('|') ? decodedKey.split('|') : decodedKey.split(':');
    if (parts.length < 2) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid or Expired License Key',
      };
    }

    const [timestampStr, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid or Expired License Key',
      };
    }

    // Step B: Perform an expiration check.
    // 6 months is defined as: 180 days * 24 hours * 60 mins * 60 secs * 1000 ms = 15552000000 ms
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - timestamp > SIX_MONTHS_MS;
    if (isExpired) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Expired License',
      };
    }

    // Step C: Re-generate the SHA-256 hash locally using normalized restaurantId
    const normalizedRestaurantId = restaurantId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'lux-bistro';

    const rawString = normalizedRestaurantId + timestamp + SECRET_SALT;
    const expectedSignature = await sha256(rawString);

    // Step D: Compare the newly calculated hash with the extracted signature.
    if (providedSignature !== expectedSignature) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid or Expired License Key',
      };
    }

    // Graceful Local Fallback: Save timestamp and key to local storage
    try {
      localStorage.setItem('license_key', trimmedKey);
      localStorage.setItem('license_timestamp', String(timestamp));
    } catch (lsErr) {
      console.warn('Failed to save to localStorage:', lsErr);
    }

    const validUntil = timestamp + SIX_MONTHS_MS;

    return {
      isValid: true,
      restaurantName: normalizedRestaurantId,
      validUntil: validUntil,
    };
  } catch (error) {
    console.error('License verification error:', error);
    return {
      isValid: false,
      restaurantName: '',
      validUntil: 0,
      error: 'Invalid or Expired License Key',
    };
  }
}
