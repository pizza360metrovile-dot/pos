// ⚠️ SECURITY: This salt MUST be identical in the POS app's constants file.
// Never expose this value in any UI, log, or commit it to a public repository.
// If you change it, all previously issued license keys become invalid.
export const SECRET_SALT =
  "78R4JHGFpizza360metrovileEWIUH34@12<D>";

// Hardcoded admin password for the panel login screen.
export const ADMIN_PASSWORD = "123456";

// Fixed license duration: 6 months in milliseconds.
export const LICENSE_DURATION_MS = 1000 * 60 * 60 * 24 * 30 * 6;
