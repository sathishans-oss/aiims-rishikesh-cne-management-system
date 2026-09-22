/**
 * Prevents CSV/Sheets formula injection attacks when exporting institutional data.
 */
export function sanitizeForSheets(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeRecordForSheets(record: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(record)) {
    if (typeof val === 'string') {
      clean[key] = sanitizeForSheets(val);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeRecordForSheets(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}
