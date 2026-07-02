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
    // Step 1: Decode Base64
    let decodedKey: string
    try {
      decodedKey = atob(licenseKey)
    } catch (err) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid license key format (decode failed)',
      }
    }

    // Step 2: Parse timestamp and signature
    const parts = decodedKey.split('|')
    if (parts.length !== 2) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid license key format (missing components)',
      }
    }

    const [timestampStr, providedSignature] = parts
    const timestamp = parseInt(timestampStr, 10)

    // Step 3: Validate timestamp is a number
    if (isNaN(timestamp)) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'Invalid license key format (invalid timestamp)',
      }
    }

    // Step 4: Regenerate signature to verify authenticity
    const normalizedRestaurantId = restaurantId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'lux-bistro'

    const rawString = 
      normalizedRestaurantId + timestamp + SECRET_SALT

    const expectedSignature = await sha256(rawString)

    // Step 5: Compare signatures
    if (providedSignature !== expectedSignature) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'License key is invalid or tampered',
      }
    }

    // Step 6: Check license age (generated keys are valid for 365 days)
    const now = Date.now()
    const licenseAge = now - timestamp
    const maxLicenseAge = LICENSE_VALIDITY_DAYS * 86400000 // ms

    if (licenseAge > maxLicenseAge) {
      return {
        isValid: false,
        restaurantName: '',
        validUntil: 0,
        error: 'License key has expired',
      }
    }

    // Step 7: Calculate validity period
    // License is valid from generation until 365 days later
    const validUntil = timestamp + maxLicenseAge

    // Step 8: All checks passed
    return {
      isValid: true,
      restaurantName: normalizedRestaurantId,
      validUntil: validUntil,
    }
  } catch (error) {
    console.error('License verification error:', error)
    return {
      isValid: false,
      restaurantName: '',
      validUntil: 0,
      error: 'License verification failed. Please try again.',
    }
  }
}
