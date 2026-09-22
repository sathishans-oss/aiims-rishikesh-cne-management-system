/**
 * Web Crypto utilities for Cloudflare Workers.
 * Passwords use PBKDF2-SHA-256 with a per-user salt and server-side pepper.
 */

const PBKDF2_ITERATIONS = 210_000;

export function generateRandomToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(bytes = 16): string {
  return generateRandomToken(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error('Invalid hexadecimal salt.');
  return new Uint8Array(hex.match(/.{2}/g)!.map(v => parseInt(v, 16)));
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${password}\u0000${pepper}`),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt) as unknown as BufferSource, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToHex(bits)}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function verifyPassword(passwordAttempt: string, salt: string, pepper: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashPassword(passwordAttempt, salt, pepper);
  return timingSafeEqual(computedHash, storedHash);
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigHex = bytesToHex(signature);
  return `${btoa(payload)}.${sigHex}`;
}

export async function verifyAndDecodePayload(token: string, secret: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64Payload, sigHex] = parts;
    const payload = atob(b64Payload);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = hexToBytes(sigHex);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, encoder.encode(payload));
    return valid ? payload : null;
  } catch {
    return null;
  }
}
