import { Env, AuthenticatedUser } from '../types';
import { generateRandomToken, signPayload, verifyAndDecodePayload } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';
import { getRequiredSecret } from '../utils/secrets';
import { verifyCneInchargeAccess } from '../middleware/auth';

function indiaDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function validateCneForAttendance(cne: any): void {
  if (!cne) throw new Error('CNE session not found.');
  if (!['Scheduled', 'Modified & Scheduled'].includes(cne.status)) {
    throw new Error(`Cannot record attendance while CNE status is '${cne.status}'.`);
  }
  const todayStr = indiaDateString();
  if (cne.cne_date !== todayStr) {
    throw new Error(`Attendance is permitted only on the scheduled CNE date (${cne.cne_date}, Asia/Kolkata).`);
  }
}


export async function listParticipants(
  db: D1Database,
  cneId: string
): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT 
      cp.*,
      e.name as employee_name,
      e.designation,
      e.department,
      e.email,
      e.phone,
      (SELECT COUNT(*) FROM cne_attendance ca WHERE ca.cne_id = cp.cne_id AND ca.employee_id = cp.employee_id) as attended
    FROM cne_participants cp
    JOIN employees e ON cp.employee_id = e.employee_id
    WHERE cp.cne_id = ?
    ORDER BY cp.registered_at ASC
  `).bind(cneId).all<any>();

  return rows.results || [];
}

export async function addParticipant(
  db: D1Database,
  officer: AuthenticatedUser,
  cneId: string,
  employeeId: string
): Promise<any> {
  const cleanEmpId = employeeId.trim().toUpperCase();

  // Area In-charge scoping check
  const cne = await verifyCneInchargeAccess(db, officer, cneId);

  // Capacity check
  const currentCount = await db.prepare('SELECT COUNT(*) as count FROM cne_participants WHERE cne_id = ?').bind(cne.id).first<any>();
  if ((currentCount?.count || 0) >= cne.capacity) {
    throw new Error(`Session capacity limit reached (${cne.capacity}). Cannot add more participants.`);
  }

  const emp = await db.prepare('SELECT employee_id, name FROM employees WHERE employee_id = ?').bind(cleanEmpId).first<any>();
  if (!emp) {
    throw new Error('Employee not found in institutional directory.');
  }

  const existing = await db.prepare('SELECT id FROM cne_participants WHERE cne_id = ? AND employee_id = ?').bind(cne.id, cleanEmpId).first<any>();
  if (existing) {
    throw new Error('Employee is already registered as a participant for this CNE.');
  }

  const id = 'PART_' + generateRandomToken(8);
  await db.prepare(`
    INSERT INTO cne_participants (id, cne_id, employee_id, registered_at, source, status)
    VALUES (?, ?, ?, datetime('now'), 'ADMIN_ADD', 'REGISTERED')
  `).bind(id, cne.id, cleanEmpId).run();

  await logAuditAction(db, officer.employee_id, 'PARTICIPANT_ADDED', 'PARTICIPANT', id, { cneId: cne.id, employeeId: cleanEmpId });
  await enqueueBackup(db, 'cne_participants', id, 'INSERT', { id, cne_id: cne.id, employee_id: cleanEmpId, source: 'ADMIN_ADD' });

  return db.prepare(`
    SELECT cp.*, e.name as employee_name, e.designation, e.department
    FROM cne_participants cp
    JOIN employees e ON cp.employee_id = e.employee_id
    WHERE cp.id = ?
  `).bind(id).first<any>();
}

export async function listAttendance(
  db: D1Database,
  cneId: string
): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT 
      ca.*,
      e.name as employee_name,
      e.designation,
      e.department,
      v.name as verified_by_name
    FROM cne_attendance ca
    JOIN employees e ON ca.employee_id = e.employee_id
    LEFT JOIN employees v ON ca.verified_by = v.employee_id
    WHERE ca.cne_id = ?
    ORDER BY ca.marked_at ASC
  `).bind(cneId).all<any>();

  return rows.results || [];
}

/**
 * Generates an opaque, HMAC-SHA256 signed QR attendance token valid for 4 hours.
 * Exposes NO sensitive patient, employee or database info in the QR string.
 */
export async function generateQrToken(
  cneId: string,
  env: Env,
  officer?: AuthenticatedUser
): Promise<{ qr_token: string; cne_id: string; expires_at: string }> {
  // Enforce session secret configuration without hard-coded fallbacks in production
  const secret = getRequiredSecret(env, 'SESSION_SECRET', 'SESSION_SECRET');

  const expiresAtMs = Date.now() + 4 * 60 * 60 * 1000;
  const nonce = generateRandomToken(8);
  const payload = `${cneId}:${expiresAtMs}:${nonce}`;

  const signedToken = await signPayload(payload, secret);
  return {
    qr_token: signedToken,
    cne_id: cneId,
    expires_at: new Date(expiresAtMs).toISOString()
  };
}

export async function scanQrAttendance(
  db: D1Database,
  user: AuthenticatedUser,
  qrToken: string,
  env: Env
): Promise<any> {
  const secret = getRequiredSecret(env, 'SESSION_SECRET', 'SESSION_SECRET');
  const decoded = await verifyAndDecodePayload(qrToken, secret);

  if (!decoded) {
    throw new Error('Invalid or tampered QR attendance code.');
  }

  const [cneId, expiresAtStr] = decoded.split(':');
  const expiresAtMs = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
    throw new Error('This QR attendance code has expired. Request the Area In-Charge to refresh the token.');
  }

  // Ensure CNE exists and validate attendance lifecycle
  const cne = await db.prepare('SELECT id, cne_id, title, status, cne_date, area_id FROM cnes WHERE id = ?').bind(cneId).first<any>();
  validateCneForAttendance(cne);

  // Check if attendance already marked
  const existing = await db.prepare('SELECT id, marked_at FROM cne_attendance WHERE cne_id = ? AND employee_id = ?').bind(cne.id, user.employee_id).first<any>();
  if (existing) {
    return {
      already_marked: true,
      message: `Attendance already recorded on ${existing.marked_at}.`,
      cne_id: cne.cne_id,
      cne_title: cne.title
    };
  }

  // Check if user is an enrolled participant
  const participant = await db.prepare(`
    SELECT id, status FROM cne_participants WHERE cne_id = ? AND employee_id = ?
  `).bind(cne.id, user.employee_id).first<any>();

  if (!participant) {
    throw new Error('Registration required: You must be registered as an approved participant for this CNE before recording attendance.');
  }

  // Mark attendance and participant status atomically.
  const attId = 'ATT_' + generateRandomToken(10);
  await db.batch([
    db.prepare(`INSERT INTO cne_attendance (id, cne_id, employee_id, marked_at, method, verified_by)
                VALUES (?, ?, ?, datetime('now'), 'QR_SCAN', NULL)`).bind(attId, cne.id, user.employee_id),
    db.prepare(`UPDATE cne_participants SET status = 'ATTENDED' WHERE cne_id = ? AND employee_id = ?`).bind(cne.id, user.employee_id)
  ]);

  await logAuditAction(db, user.employee_id, 'ATTENDANCE_QR_SCANNED', 'ATTENDANCE', attId, { cneId: cne.id });
  await enqueueBackup(db, 'cne_attendance', attId, 'INSERT', { id: attId, cne_id: cne.id, employee_id: user.employee_id, method: 'QR_SCAN' });

  return {
    success: true,
    message: `Attendance successfully marked for "${cne.title}".`,
    cne_id: cne.cne_id,
    cne_title: cne.title,
    marked_at: new Date().toISOString()
  };
}

export async function markManualAttendance(
  db: D1Database,
  officer: AuthenticatedUser,
  cneId: string,
  employeeId: string
): Promise<any> {
  const cleanEmpId = employeeId.trim().toUpperCase();

  // Validate In-charge access to this CNE's area
  const cne = await verifyCneInchargeAccess(db, officer, cneId);

  // Validate attendance lifecycle
  validateCneForAttendance(cne);

  const emp = await db.prepare('SELECT employee_id, name FROM employees WHERE employee_id = ?').bind(cleanEmpId).first<any>();
  if (!emp) {
    throw new Error('Employee not found in directory.');
  }

  const existing = await db.prepare('SELECT id FROM cne_attendance WHERE cne_id = ? AND employee_id = ?').bind(cne.id, cleanEmpId).first<any>();
  if (existing) {
    throw new Error('Attendance is already marked for this employee.');
  }

  // Check if enrolled in participants
  const participant = await db.prepare(`
    SELECT id, status FROM cne_participants WHERE cne_id = ? AND employee_id = ?
  `).bind(cne.id, cleanEmpId).first<any>();

  if (!participant) {
    throw new Error(`Participant registration required: Employee ${cleanEmpId} must be added as a participant before recording attendance.`);
  }

  const attId = 'ATT_' + generateRandomToken(10);
  await db.batch([
    db.prepare(`INSERT INTO cne_attendance (id, cne_id, employee_id, marked_at, method, verified_by)
                VALUES (?, ?, ?, datetime('now'), 'MANUAL_OFFICER', ?)`).bind(attId, cne.id, cleanEmpId, officer.employee_id),
    db.prepare(`UPDATE cne_participants SET status = 'ATTENDED' WHERE cne_id = ? AND employee_id = ?`).bind(cne.id, cleanEmpId)
  ]);

  await logAuditAction(db, officer.employee_id, 'ATTENDANCE_MANUAL_MARKED', 'ATTENDANCE', attId, { cneId: cne.id, target: cleanEmpId });
  await enqueueBackup(db, 'cne_attendance', attId, 'INSERT', { id: attId, cne_id: cne.id, employee_id: cleanEmpId, method: 'MANUAL_OFFICER', verified_by: officer.employee_id });

  return db.prepare(`
    SELECT ca.*, e.name as employee_name, e.designation, e.department
    FROM cne_attendance ca
    JOIN employees e ON ca.employee_id = e.employee_id
    WHERE ca.id = ?
  `).bind(attId).first<any>();
}
