import { generateRandomToken } from '../utils/crypto';

export async function logAuditAction(
  db: D1Database,
  employeeId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: any,
  ipAddress?: string | null
): Promise<void> {
  try {
    const id = 'AUD_' + generateRandomToken(12);
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;

    await db.prepare(`
      INSERT INTO audit_log (id, employee_id, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      id,
      employeeId || 'SYSTEM',
      action,
      entityType,
      entityId || null,
      detailsStr,
      ipAddress || null
    ).run();
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
}
