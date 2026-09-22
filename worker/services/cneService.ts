import { AuthenticatedUser } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';

export interface PublicCneDto {
  id: string;
  cne_id: string;
  title: string;
  category: string;
  area_id: string;
  area_name: string;
  venue: string;
  cne_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: string;
  created_at: string;
}

interface CneListParams {
  area?: string;
  category?: string;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

function appendFilters(query: string, binds: any[], params: CneListParams): string {
  if (params.area && params.area !== 'ALL') {
    query += ' AND (c.area_id = ? OR a.code = ?)';
    binds.push(params.area, params.area);
  }
  if (params.category && params.category !== 'ALL') {
    query += ' AND c.category = ?';
    binds.push(params.category);
  }
  if (params.status && params.status !== 'ALL') {
    query += ' AND c.status = ?';
    binds.push(params.status);
  }
  if (params.search) {
    query += ' AND (c.title LIKE ? OR c.cne_id LIKE ? OR c.venue LIKE ? OR a.name LIKE ?)';
    const term = `%${params.search.trim()}%`;
    binds.push(term, term, term, term);
  }
  if (params.start_date) {
    query += ' AND c.cne_date >= ?';
    binds.push(params.start_date);
  }
  if (params.end_date) {
    query += ' AND c.cne_date <= ?';
    binds.push(params.end_date);
  }
  return query;
}

export async function getPublicSchedule(db: D1Database, params: CneListParams): Promise<{ items: PublicCneDto[]; total: number }> {
  let base = `FROM cnes c JOIN areas a ON c.area_id = a.id WHERE 1=1`;
  const binds: any[] = [];
  base = appendFilters(base, binds, params);

  const totalRow = await db.prepare(`SELECT COUNT(*) as count ${base}`).bind(...binds).first<any>();
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(params.page_size || 100)));
  const offset = (page - 1) * pageSize;

  const rows = await db.prepare(`
    SELECT c.id, c.cne_id, c.title, c.category, c.area_id, a.name as area_name,
           c.venue, c.cne_date, c.start_time, c.end_time, c.capacity, c.status, c.created_at
    ${base}
    ORDER BY c.cne_date DESC, c.start_time ASC
    LIMIT ? OFFSET ?
  `).bind(...binds, pageSize, offset).all<PublicCneDto>();

  return { items: rows.results || [], total: totalRow?.count || 0 };
}

export async function listCnes(
  db: D1Database,
  params: CneListParams,
  user?: AuthenticatedUser | null
): Promise<{ items: any[]; total: number }> {
  let base = `FROM cnes c JOIN areas a ON c.area_id = a.id WHERE 1=1`;
  const binds: any[] = [];
  base = appendFilters(base, binds, params);

  const totalRow = await db.prepare(`SELECT COUNT(*) as count ${base}`).bind(...binds).first<any>();
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(params.page_size || 100)));
  const offset = (page - 1) * pageSize;

  let userFields = `NULL as my_application_status, 0 as attended`;
  const queryBinds = [...binds];
  if (user) {
    userFields = `
      (SELECT ca.status FROM cne_applications ca WHERE ca.cne_id = c.id AND ca.employee_id = ? LIMIT 1) as my_application_status,
      EXISTS(SELECT 1 FROM cne_attendance catt WHERE catt.cne_id = c.id AND catt.employee_id = ?) as attended
    `;
    queryBinds.unshift(user.employee_id, user.employee_id);
  }

  const rows = await db.prepare(`
    SELECT c.*, a.name as area_name, a.code as area_code,
      (SELECT COUNT(*) FROM cne_applications ca WHERE ca.cne_id = c.id) as applications_count,
      (SELECT COUNT(*) FROM cne_applications ca WHERE ca.cne_id = c.id AND ca.status = 'Pending') as pending_applications_count,
      (SELECT COUNT(*) FROM cne_participants cp WHERE cp.cne_id = c.id) as participants_count,
      (SELECT COUNT(*) FROM cne_attendance catt WHERE catt.cne_id = c.id) as attendance_count,
      (SELECT COUNT(*) FROM cne_resources cr WHERE cr.cne_id = c.id) as resources_count,
      (SELECT COUNT(*) FROM cne_questions cq WHERE cq.cne_id = c.id) as questions_count,
      (SELECT ags.status FROM ai_generation_state ags WHERE ags.cne_id = c.id) as ai_state,
      ${userFields}
    ${base}
    ORDER BY c.cne_date DESC, c.start_time ASC
    LIMIT ? OFFSET ?
  `).bind(...queryBinds, pageSize, offset).all<any>();

  return { items: rows.results || [], total: totalRow?.count || 0 };
}

export async function searchResourcePersons(db: D1Database, search?: string): Promise<any[]> {
  let sql = `SELECT employee_id, name, designation, department, email FROM employees WHERE status = 'ACTIVE'`;
  const binds: any[] = [];
  if (search?.trim()) {
    sql += ` AND (employee_id LIKE ? OR name LIKE ? OR designation LIKE ? OR department LIKE ?)`;
    const term = `%${search.trim()}%`;
    binds.push(term, term, term, term);
  }
  sql += ` ORDER BY name ASC LIMIT 50`;
  const rows = await db.prepare(sql).bind(...binds).all<any>();
  return rows.results || [];
}

export async function getCne(db: D1Database, id: string, user?: AuthenticatedUser | null): Promise<any> {
  const cne = await db.prepare(`
    SELECT c.*, a.name as area_name, a.code as area_code,
      (SELECT COUNT(*) FROM cne_applications ca WHERE ca.cne_id = c.id) as applications_count,
      (SELECT COUNT(*) FROM cne_participants cp WHERE cp.cne_id = c.id) as participants_count,
      (SELECT COUNT(*) FROM cne_attendance ca WHERE ca.cne_id = c.id) as attendance_count,
      (SELECT COUNT(*) FROM cne_resources cr WHERE cr.cne_id = c.id) as resources_count,
      (SELECT COUNT(*) FROM cne_questions cq WHERE cq.cne_id = c.id) as questions_count,
      (SELECT ags.status FROM ai_generation_state ags WHERE ags.cne_id = c.id) as ai_state
    FROM cnes c JOIN areas a ON c.area_id = a.id
    WHERE c.id = ? OR c.cne_id = ?
  `).bind(id, id).first<any>();
  if (!cne) throw new Error('CNE record not found.');

  if (!user) {
    return {
      id: cne.id, cne_id: cne.cne_id, title: cne.title, category: cne.category,
      area_id: cne.area_id, area_name: cne.area_name, venue: cne.venue,
      cne_date: cne.cne_date, start_time: cne.start_time, end_time: cne.end_time,
      capacity: cne.capacity, status: cne.status, created_at: cne.created_at
    };
  }

  const speakers = await db.prepare(`
    SELECT crp.*, e.name, e.name as employee_name, e.designation, e.department, e.email
    FROM cne_resource_persons crp JOIN employees e ON crp.employee_id = e.employee_id
    WHERE crp.cne_id = ? ORDER BY CASE crp.role_title WHEN 'Primary Speaker' THEN 0 ELSE 1 END, e.name
  `).bind(cne.id).all<any>();
  cne.resource_persons = speakers.results || [];

  const myApp = await db.prepare(`SELECT status FROM cne_applications WHERE cne_id = ? AND employee_id = ? LIMIT 1`)
    .bind(cne.id, user.employee_id).first<any>();
  cne.my_application_status = myApp?.status || null;
  const attended = await db.prepare(`SELECT 1 as yes FROM cne_attendance WHERE cne_id = ? AND employee_id = ? LIMIT 1`)
    .bind(cne.id, user.employee_id).first<any>();
  cne.attended = Boolean(attended);
  return cne;
}

function validateCneInput(data: any): void {
  if (!data.title?.trim() || !data.category?.trim() || !data.area_id || !data.venue?.trim() || !data.cne_date || !data.start_time || !data.end_time) {
    throw new Error('Title, category, area, venue, date and start/end times are required.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.cne_date)) throw new Error('CNE date must be YYYY-MM-DD.');
  if (!/^\d{2}:\d{2}$/.test(data.start_time) || !/^\d{2}:\d{2}$/.test(data.end_time)) throw new Error('Start and end times must be HH:MM.');
  if (data.end_time <= data.start_time) throw new Error('End time must be later than start time.');
  const capacity = Number(data.capacity || 30);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) throw new Error('Participant capacity must be between 1 and 1000.');
}

async function replaceResourcePersons(db: D1Database, cneId: string, persons: Array<{employee_id: string; role_title?: string}>): Promise<void> {
  const unique = new Map<string, {employee_id: string; role_title: string}>();
  for (const raw of persons || []) {
    const employeeId = String(raw.employee_id || '').trim().toUpperCase();
    if (!employeeId) continue;
    unique.set(employeeId, { employee_id: employeeId, role_title: String(raw.role_title || 'Resource Person').trim() || 'Resource Person' });
  }
  if (unique.size === 0) throw new Error('At least one Resource Person is required.');

  const ids = [...unique.keys()];
  const placeholders = ids.map(() => '?').join(',');
  const employees = await db.prepare(`SELECT employee_id FROM employees WHERE status = 'ACTIVE' AND employee_id IN (${placeholders})`).bind(...ids).all<any>();
  const found = new Set((employees.results || []).map((e: any) => e.employee_id));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length) throw new Error(`Resource Person(s) not found/active in Officers directory: ${missing.join(', ')}`);

  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM cne_resource_persons WHERE cne_id = ?').bind(cneId)];
  for (const person of unique.values()) {
    stmts.push(db.prepare(`INSERT INTO cne_resource_persons (id, cne_id, employee_id, role_title) VALUES (?, ?, ?, ?)`)
      .bind('CRP_' + generateRandomToken(8), cneId, person.employee_id, person.role_title));
  }
  await db.batch(stmts);
}

export async function createCne(db: D1Database, user: AuthenticatedUser, data: any): Promise<any> {
  validateCneInput(data);
  const area = await db.prepare(`SELECT id FROM areas WHERE id = ? AND active = 1`).bind(data.area_id).first<any>();
  if (!area) throw new Error('Selected clinical Area is not active or does not exist.');

  const id = 'CNE_REC_' + generateRandomToken(10);
  const year = Number(String(data.cne_date).slice(0, 4));
  const seqRow = await db.prepare(`
    INSERT INTO cne_sequences (year, next_value) VALUES (?, 1)
    ON CONFLICT(year) DO UPDATE SET next_value = next_value + 1
    RETURNING next_value
  `).bind(year).first<any>();
  const humanId = `CNE-${year}-${String(seqRow?.next_value || 1).padStart(4, '0')}`;
  const capacity = Number(data.capacity || 30);

  const createStmt = db.prepare(`
    INSERT INTO cnes (id, cne_id, title, category, area_id, venue, cne_date, start_time, end_time, capacity, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, datetime('now'), datetime('now'))
  `).bind(id, humanId, data.title.trim(), data.category.trim(), data.area_id, data.venue.trim(), data.cne_date, data.start_time, data.end_time, capacity, user.employee_id);
  await db.batch([createStmt]);

  try {
    await replaceResourcePersons(db, id, data.resource_persons || (data.resource_person_id ? [{employee_id: data.resource_person_id, role_title: 'Primary Speaker'}] : []));
  } catch (err) {
    await db.prepare('DELETE FROM cnes WHERE id = ?').bind(id).run();
    throw err;
  }

  await logAuditAction(db, user.employee_id, 'CNE_CREATED', 'CNE', id, { cne_id: humanId, title: data.title });
  await enqueueBackup(db, 'cnes', id, 'INSERT', { id, cne_id: humanId, title: data.title, date: data.cne_date });
  return getCne(db, id, user);
}

export async function modifyCne(db: D1Database, user: AuthenticatedUser, id: string, data: any): Promise<any> {
  const existing = await db.prepare('SELECT * FROM cnes WHERE id = ?').bind(id).first<any>();
  if (!existing) throw new Error('CNE not found.');
  if (['Completed', 'Canceled'].includes(existing.status)) throw new Error(`Cannot modify a CNE that is already ${existing.status}.`);

  const merged = { ...existing, ...data };
  validateCneInput(merged);
  if (data.area_id) {
    const area = await db.prepare(`SELECT id FROM areas WHERE id = ? AND active = 1`).bind(data.area_id).first<any>();
    if (!area) throw new Error('Selected clinical Area is not active or does not exist.');
  }

  await db.prepare(`
    UPDATE cnes SET title=?, category=?, area_id=?, venue=?, cne_date=?, start_time=?, end_time=?, capacity=?,
      status='Modified & Scheduled', updated_at=datetime('now') WHERE id=?
  `).bind(merged.title.trim(), merged.category.trim(), merged.area_id, merged.venue.trim(), merged.cne_date, merged.start_time, merged.end_time, Number(merged.capacity), id).run();

  if (data.resource_persons || data.resource_person_id) {
    await replaceResourcePersons(db, id, data.resource_persons || [{employee_id: data.resource_person_id, role_title: 'Primary Speaker'}]);
  }

  await logAuditAction(db, user.employee_id, 'CNE_MODIFIED', 'CNE', id, data);
  await enqueueBackup(db, 'cnes', id, 'UPDATE', { id, ...data, status: 'Modified & Scheduled' });
  return getCne(db, id, user);
}

export async function cancelCne(db: D1Database, user: AuthenticatedUser, id: string, cancelReason: string): Promise<any> {
  const existing = await db.prepare('SELECT * FROM cnes WHERE id = ?').bind(id).first<any>();
  if (!existing) throw new Error('CNE not found.');
  if (['Completed', 'Canceled'].includes(existing.status)) throw new Error(`Cannot cancel a CNE that is already ${existing.status}.`);
  await db.prepare(`UPDATE cnes SET status='Canceled', cancel_reason=?, updated_at=datetime('now') WHERE id=?`).bind(cancelReason.trim(), id).run();
  await logAuditAction(db, user.employee_id, 'CNE_CANCELED', 'CNE', id, { cancelReason });
  await enqueueBackup(db, 'cnes', id, 'UPDATE', { id, status: 'Canceled', cancel_reason: cancelReason });
  return getCne(db, id, user);
}

export async function completeCne(db: D1Database, user: AuthenticatedUser, id: string): Promise<any> {
  const existing = await db.prepare('SELECT * FROM cnes WHERE id = ?').bind(id).first<any>();
  if (!existing) throw new Error('CNE not found.');
  if (!['Scheduled', 'Modified & Scheduled'].includes(existing.status)) throw new Error(`Cannot complete a CNE with status '${existing.status}'.`);
  const attendance = await db.prepare('SELECT COUNT(*) as count FROM cne_attendance WHERE cne_id = ?').bind(id).first<any>();
  if ((attendance?.count || 0) === 0) throw new Error('Cannot complete this CNE because no verified attendance has been recorded.');
  await db.prepare(`UPDATE cnes SET status='Completed', updated_at=datetime('now') WHERE id=?`).bind(id).run();
  await logAuditAction(db, user.employee_id, 'CNE_COMPLETED', 'CNE', id);
  await enqueueBackup(db, 'cnes', id, 'UPDATE', { id, status: 'Completed' });
  return getCne(db, id, user);
}
