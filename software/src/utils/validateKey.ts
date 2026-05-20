/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SECRET_SALT } from '../constants/license';

export interface LicensePayload {
  keyId: string;
  restaurantId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ValidationSuccess {
  valid: true;
  payload: LicensePayload;
}

export interface ValidationFailure {
  valid: false;
  reason: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Recomputes the HMAC SHA-256 signature of a message using a secret key.
 */
export async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const signature = await window.crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(message)
  );
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Validates a formatted license key locally and offline-capable.
 */
export async function validateLicenseKey(rawKey: string): Promise<ValidationResult> {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, reason: "License key is empty" };
  }

  // STEP 1 — Normalize input
  const normalizedKey = rawKey.replace(/-/g, '').toUpperCase().trim();

  if (normalizedKey.length <= 16) {
    return { valid: false, reason: "License key is too short" };
  }

  // STEP 2 — Split into payload and signature
  // We extract the signature part and payload parts.
  const signaturePart = normalizedKey.slice(-16);
  
  // To handle case-sensitive base64 (which atob requires), we also extract 
  // the original case-preserved payload before uppercasing.
  const rawNoDashes = rawKey.replace(/-/g, '').trim();
  const rawPayloadPart = rawNoDashes.slice(0, -16);
  const payloadPartUpper = normalizedKey.slice(0, -16);

  let payload: any = null;
  try {
    // Attempt decoding using raw case-preserved payload first (standard base64)
    const decodedRaw = atob(rawPayloadPart);
    payload = JSON.parse(decodedRaw);
  } catch (err1) {
    try {
      // Fallback to uppercase-only decoded payload
      const decodedUpper = atob(payloadPartUpper);
      payload = JSON.parse(decodedUpper);
    } catch (err2) {
      return { valid: false, reason: "Invalid key encoding (failed to parse payload)" };
    }
  }

  // STEP 3 — Recompute HMAC signature locally
  try {
    const expectedSig = await hmacSign(SECRET_SALT, JSON.stringify(payload));
    const expectedSigSlice = expectedSig.slice(0, 16).toUpperCase();

    if (expectedSigSlice !== signaturePart.toUpperCase()) {
      return { valid: false, reason: "Invalid license signature (key tampering or incorrect key)" };
    }
  } catch (err) {
    return { valid: false, reason: "Signature verification failed" };
  }

  // STEP 4 — Validate payload fields
  const { keyId, restaurantId, issuedAt, expiresAt } = payload || {};

  if (!keyId || typeof keyId !== 'string' || keyId.trim() === '') {
    return { valid: false, reason: "Invalid payload: key ID is missing" };
  }

  if (!restaurantId || typeof restaurantId !== 'string' || restaurantId.trim() === '') {
    return { valid: false, reason: "Invalid payload: restaurant ID is missing" };
  }

  const now = Date.now();

  if (typeof expiresAt !== 'number' || expiresAt <= now) {
    return { valid: false, reason: "License key has expired" };
  }

  if (typeof issuedAt !== 'number' || issuedAt > now) {
    return { valid: false, reason: "License key is future-dated" };
  }

  // STEP 5 — All validation checks pass successfully
  return {
    valid: true,
    payload: {
      keyId,
      restaurantId,
      issuedAt,
      expiresAt
    }
  };
}

/**
 * Generates tamper-detection checksum key-value:
 * btoa(keyId + expiresAt + deviceId + SECRET_SALT).slice(0, 24)
 */
export function generateChecksum(keyId: string, expiresAt: number, deviceId: string): string {
  try {
    return btoa(keyId + expiresAt + deviceId + SECRET_SALT).slice(0, 24);
  } catch (err) {
    return btoa(unescape(encodeURIComponent(keyId + expiresAt + deviceId + SECRET_SALT))).slice(0, 24);
  }
}

