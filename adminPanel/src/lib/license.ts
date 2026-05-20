import { SECRET_SALT, LICENSE_DURATION_MS } from "./constants";

export interface LicensePayload {
  restaurantId: string;
  issuedAt: number;
  expiresAt: number;
  keyId: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateKeyId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) id += chars[arr[i] % chars.length];
  return id;
}

export async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatChunks(input: string): string {
  const clean = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 5) chunks.push(clean.slice(i, i + 5));
  return chunks.join("-");
}

export async function generateLicenseKey(payload: LicensePayload): Promise<string> {
  const json = JSON.stringify(payload);
  const signature = await hmacSign(SECRET_SALT, json);
  const raw = btoa(json) + "." + signature.slice(0, 16);
  return formatChunks(raw).slice(0, 29); // 5 chunks * 5 chars + 4 dashes = 29
}

export function buildPayload(restaurantId: string, keyId: string): LicensePayload {
  const issuedAt = Date.now();
  return {
    restaurantId,
    issuedAt,
    expiresAt: issuedAt + LICENSE_DURATION_MS,
    keyId,
  };
}
