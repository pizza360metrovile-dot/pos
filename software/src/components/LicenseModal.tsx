import React, { useState } from 'react'
import { Lock, AlertCircle, Copy, Check } from 'lucide-react'
import { 
  isValidLicenseFormat, 
  verifyLicenseWithBackend,
  LicenseData,
  getRestaurantId,
  getRestaurantInfo
} from '../utils/licenseValidator'
import { saveLicenseToFirebase } from '../services/licenseService'

interface LicenseModalProps {
  isOpen: boolean
  onLicenseValid: (license: LicenseData) => void
  errorMessage?: string
}

export default function LicenseModal({
  isOpen,
  onLicenseValid,
  errorMessage
}: LicenseModalProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  
  const restaurantId = getRestaurantId()
  const restaurantInfo = getRestaurantInfo()

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(restaurantId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // License keys are Base64 encoded
      // Should be approximately 80-150 characters
      const licenseKeyRegex = /^[A-Za-z0-9+/=]{80,150}$/
      
      if (!licenseKeyRegex.test(licenseKey)) {
        setError('Invalid license key format. License should be a long alphanumeric string.')
        setIsLoading(false)
        return
      }

      // Verify with backend
      const verification = await verifyLicenseWithBackend(
        licenseKey,
        restaurantId  // Pass the restaurant ID for validation
      )
      
      if (!verification.isValid) {
        setError(verification.error || 'License key is invalid or expired')
        setIsLoading(false)
        return
      }

      // Create license data
      const licenseData: LicenseData = {
        licenseKey,
        licensedRestaurant: restaurantInfo.name,
        validUntil: verification.validUntil,
        activatedAt: Date.now(),
        isValid: true,
        deviceId: generateDeviceId(),
        restaurantId: restaurantId,
      }

      // Save to Firebase
      const saved = await saveLicenseToFirebase(licenseData)
      
      if (saved) {
        onLicenseValid(licenseData)
      } else {
        setError('Failed to save license. Please try again.')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">License Activation</h2>
              <p className="text-blue-100 text-sm">Activate subscription to continue</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Restaurant Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Restaurant</p>
            <p className="text-lg font-bold text-gray-900">{restaurantInfo.name}</p>
            <p className="text-sm text-gray-600 mt-1">{restaurantInfo.location}</p>
          </div>

          {/* Restaurant ID Section */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">
              Step 1: Copy Your Restaurant ID
            </p>
            
            <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Your Restaurant ID</p>
                <p className="font-mono text-lg font-bold text-gray-900 break-all">
                  {restaurantId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="ml-3 flex-shrink-0 p-2 hover:bg-gray-200 rounded transition"
                title="Copy ID"
              >
                {copiedId ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
            
            <p className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
              <strong>Next:</strong> Copy this ID above, paste it in your license generator tool to get a license key.
            </p>
          </div>

          {/* License Key Section */}
          <div className="space-y-3 border-t pt-6">
            <p className="text-sm font-semibold text-gray-900">
              Step 2: Enter License Key
            </p>
            
            {/* Error Message */}
            {(error || errorMessage) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Error</p>
                  <p>{error || errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.trim())}
                  placeholder="Paste license key from generator..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition font-mono text-center text-lg"
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-2 text-center">
                  License key is a long alphanumeric string (Base64 encoded)
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !licenseKey.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-white"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Activate License'
                )}
              </button>
            </form>
          </div>

          {/* Support */}
          <div className="border-t pt-4 text-center">
            <p className="text-xs text-gray-600">
              Don't have a license key?{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:underline font-medium">
                Contact Support
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

function generateDeviceId(): string {
  // Generate unique device ID from browser info
  return `${navigator.userAgent}-${Date.now()}`
}
