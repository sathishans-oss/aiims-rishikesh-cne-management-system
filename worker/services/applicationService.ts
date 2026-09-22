import { AuthenticatedUser } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';
import { verifyCneInchargeAccess, getAssignedAreaIds } from '../middleware/auth';

export async function applyForCne(
  db: D1Database,
  user: AuthenticatedUser,
  cneId: string
): Promise<any> {
  // 1. Verify CNE exists and is eligible for application
  const cne = await db.prepare(`
    SELECT id, cne_id, title, status, capacity,
           (SELECT COUNT(*) FROM cne_participants WHERE cne_id = cnes.id) as participant_count
    FROM cnes
    WHERE id = ? OR cne_id = ?
  `).bind(cneId, cneId).first<any>();

  if (!cne) {
    throw new Error('CNE not found.');
  }

  if (cne.status !== 'Scheduled' && cne.status !== 'Modified & Scheduled') {
    throw new Error(`Applications are not accepted for CNEs with status '${cne.status}'.`);
  }

  if (cne.participant_count >= cne.capacity) {
    throw new Error(`This CNE session has reached full capacity (${cne.participant_count}/${cne.capacity}).`);
  }

  // 2. Prevent duplicate applications
  const existingApp = await db.prepare(`
    SELECT id, status FROM cne_applications
    WHERE cne_id = ? AND employee_id = ?
  `).bind(cne.id, user.employee_id).first<any>();

  if (existingApp) {
    throw new Error(`You have already applied for this CNE (Current status: ${existingApp.status}).`);
  }

  // 3. Create application
  const appId = 'APP_' + generateRandomToken(8);
  await db.prepare(`
    INSERT INTO cne_applications (id, cne_id, employee_id, status, applied_at)
    VALUES (?, ?, ?, 'Pending', datetime('now'))
  `).bind(appId, cne.id, user.employee_id).run();

  await logAuditAction(db, user.employee_id, 'APPLICATION_SUBMITTED', 'APPLICATION', appId, { cne_id: cne.cne_id });
  await enqueueBackup(db, 'cne_applications', appId, 'INSERT', { id: appId, cne_id: cne.id, employee_id: user.employee_id, status: 'Pending' });

  return db.prepare(`
    SELECT ca.*, c.title as cne_title, c.cne_id as cne_code, c.cne_date, c.venue
    FROM cne_applications ca
    JOIN cnes c ON ca.cne_id = c.id
    WHERE ca.id = ?
  `).bind(appId).first<any>();
}

export async function getMyApplications(
  db: D1Database,
  employeeId: string
): Promise<{ items: any[]; total: number }> {
  const rows = await db.prepare(`
    SELECT 
      ca.*,
      c.title as cne_title,
      c.cne_id as cne_code,
      c.cne_date,
      c.start_time,
      c.end_time,
      c.venue,
      c.category,
      c.status as cne_status
    FROM cne_applications ca
    JOIN cnes c ON ca.cne_id = c.id
    WHERE ca.employee_id = ?
    ORDER BY ca.applied_at DESC
  `).bind(employeeId).all<any>();

  const items = rows.results || [];
  return { items, total: items.length };
}

export async function listApplications(
  db: D1Database,
  params: { cne_id?: string; status?: string; area?: string; search?: string; date_from?: string; date_to?: string; page?: number; page_size?: number },
  user?: AuthenticatedUser
): Promise<{ items: any[]; total: number; page: number; page_size: number }> {
  let fromWhere = `
    FROM cne_applications ca
    JOIN employees e ON ca.employee_id = e.employee_id
    JOIN cnes c ON ca.cne_id = c.id
    JOIN areas a ON c.area_id = a.id
    WHERE 1=1
  `;
  const binds: any[] = [];

  if (user && !user.roles.includes('ADMIN') && user.roles.includes('AREA_INCHARGE')) {
    const assignedAreaIds = await getAssignedAreaIds(db, user.employee_id);
    if (!assignedAreaIds.length) return { items: [], total: 0, page: 1, page_size: Number(params.page_size || 25) };
    fromWhere += ` AND c.area_id IN (${assignedAreaIds.map(() => '?').join(',')})`;
    binds.push(...assignedAreaIds);
  }
  if (params.cne_id && params.cne_id !== 'ALL') { fromWhere += ' AND (ca.cne_id = ? OR c.cne_id = ?)'; binds.push(params.cne_id, params.cne_id); }
  if (params.status && params.status !== 'ALL') { fromWhere += ' AND ca.status = ?'; binds.push(params.status); }
  if (params.area && params.area !== 'ALL') { fromWhere += ' AND c.area_id = ?'; binds.push(params.area); }
  if (params.date_from) { fromWhere += ' AND c.cne_date >= ?'; binds.push(params.date_from); }
  if (params.date_to) { fromWhere += ' AND c.cne_date <= ?'; binds.push(params.date_to); }
  if (params.search?.trim()) {
    fromWhere += ' AND (e.employee_id LIKE ? OR e.name LIKE ? OR c.title LIKE ? OR c.cne_id LIKE ?)';
    const term = `%${params.search.trim()}%`; binds.push(term, term, term, term);
  }

  const totalRow = await db.prepare(`SELECT COUNT(*) as count ${fromWhere}`).bind(...binds).first<any>();
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.page_size || 25)));
  const offset = (page - 1) * pageSize;
  const rows = await db.prepare(`
    SELECT ca.*, e.name as employee_name, e.designation, e.department, e.email, e.phone,
           c.title as cne_title, c.cne_id as cne_code, c.cne_date, c.start_time, c.end_time, c.venue,
           c.status as cne_status, c.area_id, a.name as area_name
    ${fromWhere}
    ORDER BY ca.applied_at DESC LIMIT ? OFFSET ?
  `).bind(...binds, pageSize, offset).all<any>();
  return { items: rows.results || [], total: Number(totalRow?.count || 0), page, page_size: pageSize };
}

export async function reviewApplication(
  db: D1Database,
  user: AuthenticatedUser,
  applicationId: string,
  decision: 'Approved' | 'Rejected',
  reviewNotes?: string
): Promise<any> {
  const app = await db.prepare(`
    SELECT ca.*, c.area_id, c.status as cne_status, c.capacity
    FROM cne_applications ca
    JOIN cnes c ON ca.cne_id = c.id
    WHERE ca.id = ?
  `).bind(applicationId).first<any>();

  if (!app) {
    throw new Error('Application not found.');
  }

  if (app.status !== 'Pending') {
    throw new Error(`Application has already been reviewed (${app.status}).`);
  }

  // Scoping check: Ensure officer has authority over this CNE's area
  await verifyCneInchargeAccess(db, user, app.cne_id);

  if (!['Scheduled', 'Modified & Scheduled'].includes(app.cne_status)) {
    throw new Error(`Applications cannot be reviewed while the CNE status is '${app.cne_status}'.`);
  }

  // Re-verify capacity atomically before approving
  if (decision === 'Approved') {
    const currentCountRow = await db.prepare(`
      SELECT COUNT(*) as count FROM cne_participants WHERE cne_id = ?
    `).bind(app.cne_id).first<any>();

    const currentCount = currentCountRow?.count || 0;
    if (currentCount >= app.capacity) {
      throw new Error(`Cannot approve application: CNE session has reached full capacity (${currentCount}/${app.capacity}). Increase session capacity before approving.`);
    }
  }

  // Review + enrollment is atomic. The DB capacity trigger protects concurrent approvals.
  const appUpdate = db.prepare(`
    UPDATE cne_applications
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_notes = ?
    WHERE id = ? AND status = 'Pending'
  `).bind(decision, user.employee_id, reviewNotes?.trim() || null, applicationId);

  let partId: string | null = null;
  const batch: D1PreparedStatement[] = [appUpdate];
  if (decision === 'Approved') {
    partId = 'PART_' + generateRandomToken(10);
    batch.push(db.prepare(`
      INSERT INTO cne_participants (id, cne_id, employee_id, registered_at, source, status)
      VALUES (?, ?, ?, datetime('now'), 'APPLICATION', 'REGISTERED')
      ON CONFLICT(cne_id, employee_id) DO NOTHING
    `).bind(partId, app.cne_id, app.employee_id));
  }

  try {
    const results = await db.batch(batch);
    const updateChanges = (results[0] as any)?.meta?.changes ?? 0;
    if (updateChanges === 0) throw new Error('Concurrent modification detected: Application status was already updated.');
  } catch (err: any) {
    if (String(err?.message || err).includes('capacity')) {
      throw new Error(`Cannot approve application: CNE session has reached full capacity (${app.capacity}).`);
    }
    throw err;
  }

  if (partId) {
    await enqueueBackup(db, 'cne_participants', partId, 'INSERT', { id: partId, cne_id: app.cne_id, employee_id: app.employee_id, source: 'APPLICATION' });
  }

  await logAuditAction(db, user.employee_id, 'APPLICATION_REVIEWED', 'APPLICATION', applicationId, { decision, reviewNotes });
  await enqueueBackup(db, 'cne_applications', applicationId, 'UPDATE', { id: applicationId, status: decision, reviewed_by: user.employee_id });

  return db.prepare(`
    SELECT ca.*, e.name as employee_name, c.title as cne_title
    FROM cne_applications ca
    JOIN employees e ON ca.employee_id = e.employee_id
    JOIN cnes c ON ca.cne_id = c.id
    WHERE ca.id = ?
  `).bind(applicationId).first<any>();
}
