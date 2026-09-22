export function isValidEmployeeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{3,20}$/.test(id);
}

export function isValidDateFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function isValidTimeFormat(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr);
}

export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function parseJsonSafe<T = any>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
