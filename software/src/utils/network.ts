/**
 * Utility to check the actual network connection,
 * providing a fallback ping in case navigator.onLine is inaccurate (common in Electron).
 */
export async function checkActualConnection(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  
  if (navigator.onLine) {
    return true; // Simple fast-path
  }
  
  // If navigator.onLine is false, it might be an Electron false negative.
  // We perform a fallback lightweight ping to a highly available, reliable service.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    await fetch('https://dns.google', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    clearTimeout(timeoutId);
    return true; // Successfully pinged!
  } catch (err) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('https://1.1.1.1', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeoutId);
      return true;
    } catch (innerErr) {
      // If a ping fails via a thrown exception (like a CSP Refused to connect block),
      // catch the exception, default to navigator.onLine to determine current availability,
      // and avoid forcing the database offline artificially.
      console.warn('Network connection ping failed. Defaulting to navigator.onLine:', navigator.onLine, innerErr);
      return navigator.onLine;
    }
  }
}
