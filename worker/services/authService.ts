import { Env, AuthenticatedUser, Role } from '../types';
import { generateRandomToken, generateSalt, hashPassword, verifyPassword } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { getRequiredSecret } from '../utils/secrets';

export function getCookieOptions(env: Env, maxAgeSeconds = 30 * 24 * 60 * 60): string {
  const isProd = env.ENVIRONMENT === 'production';
  // In production, enforce Secure. SameSite=Lax, Path=/, HttpOnly
  const secureFlag = isProd ? '; Secure' : '';
  return `Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export async function login(
  db: D1Database,
  env: Env,
  employeeId: string,
  passwordAttempt: string,
  ipAddress?: string | null
): Promise<{ user: AuthenticatedUser; sessionToken: string; cookieHeader: string }> {
  const pepper = getRequiredSecret(env, 'PASSWORD_PEPPER', 'PASSWORD_PEPPER');
  getRequiredSecret(env, 'SESSION_SECRET', 'SESSION_SECRET');

  const cleanEmpId = employeeId.trim().toUpperCase();

  // Find user and employee records
  const record = await db.prepare(`
    SELECT 
      u.id as user_id,
      u.password_hash,
      u.salt,
      u.status as user_status,
      e.employee_id,
      e.name,
      e.designation,
      e.department,
      e.email,
      e.phone,
      e.status as employee_status
    FROM users u
    JOIN employees e ON u.employee_id = e.employee_id
    WHERE u.employee_id = ?
  `).bind(cleanEmpId).first<any>();

  if (!record) {
    throw new Error('Invalid Employee ID or password.');
  }

  if (record.user_status !== 'ACTIVE' || record.employee_status !== 'ACTIVE') {
    throw new Error('Account is suspended or inactive. Contact Nursing Administration.');
  }

  const isValid = await verifyPassword(passwordAttempt, record.salt, pepper, record.password_hash);
  if (!isValid) {
    await logAuditAction(db, cleanEmpId, 'LOGIN_FAILED', 'AUTH', cleanEmpId, { reason: 'BAD_PASSWORD' }, ipAddress);
    throw new Error('Invalid Employee ID or password.');
  }

  // Fetch assigned roles
  const roleRows = await db.prepare(`
    SELECT r.name as role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.employee_id = ?
  `).bind(cleanEmpId).all<any>();

  const roles: Role[] = (roleRows.results || []).map((r: any) => r.role_name as Role);
  if (!roles.includes('EMPLOYEE')) {
    roles.push('EMPLOYEE');
  }

  // Generate session token (30-day validity)
  const sessionToken = generateRandomToken(32);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO sessions (token, employee_id, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(sessionToken, cleanEmpId, expiresAt).run();

  await db.prepare(`
    UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now')
    WHERE employee_id = ?
  `).bind(cleanEmpId).run();

  await logAuditAction(db, cleanEmpId, 'LOGIN_SUCCESS', 'AUTH', cleanEmpId, { roles }, ipAddress);

  const cookieHeader = `cne_session=${sessionToken}; ${getCookieOptions(env, 30 * 24 * 60 * 60)}`;

  const user: AuthenticatedUser = {
    employee_id: record.employee_id,
    name: record.name,
    designation: record.designation,
    department: record.department,
    email: record.email,
    phone: record.phone,
    status: record.employee_status,
    roles
  };

  return { user, sessionToken, cookieHeader };
}

export async function logout(
  db: D1Database,
  env: Env,
  sessionToken: string | null,
  employeeId?: string | null
): Promise<{ clearCookieHeader: string }> {
  if (sessionToken) {
    try {
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(sessionToken).run();
      if (employeeId) {
        await logAuditAction(db, employeeId, 'LOGOUT', 'AUTH', employeeId);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  const clearCookieHeader = `cne_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${env.ENVIRONMENT === 'production' ? '; Secure' : ''}`;
  return { clearCookieHeader };
}

export async function forgotPassword(
  db: D1Database,
  employeeId: string,
  dateOfJoining: string,
  ipAddress?: string | null
): Promise<{ resetToken: string }> {
  const cleanId = employeeId.trim().toUpperCase();
  const cleanDoj = dateOfJoining.trim();

  // Atomically verify employee ID + Date of Joining
  const employee = await db.prepare(`
    SELECT e.employee_id, u.id as user_id
    FROM employees e
    LEFT JOIN users u ON e.employee_id = u.employee_id
    WHERE e.employee_id = ? AND e.date_of_joining = ? AND e.status = 'ACTIVE'
  `).bind(cleanId, cleanDoj).first<any>();

  if (!employee) {
    await logAuditAction(db, cleanId, 'PASSWORD_RESET_ATTEMPT_FAILED', 'AUTH', cleanId, { reason: 'DOJ_MISMATCH' }, ipAddress);
    // Strict generic error per Section 27
    throw new Error('Employee ID or Date of Joining is incorrect.');
  }

  // Create random, expiring, single-use reset token (15-minute validity)
  const resetToken = 'RST_' + generateRandomToken(24);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO reset_tokens (token, employee_id, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(resetToken, cleanId, expiresAt).run();

  await logAuditAction(db, cleanId, 'PASSWORD_RESET_TOKEN_ISSUED', 'AUTH', cleanId, {}, ipAddress);

  return { resetToken };
}

export async function resetPassword(
  db: D1Database,
  env: Env,
  resetToken: string,
  newPassword: string,
  ipAddress?: string | null
): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const pepper = getRequiredSecret(env, 'PASSWORD_PEPPER', 'PASSWORD_PEPPER');

  // 1. Verify existence of valid, unexpired, unconsumed token record
  const tokenRecord = await db.prepare(`
    SELECT token, employee_id, expires_at, used_at
    FROM reset_tokens
    WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
  `).bind(resetToken).first<any>();

  if (!tokenRecord) {
    throw new Error('Invalid or expired password reset token. Please initiate a new request.');
  }

  // 2. Atomic conditional token consumption:
  // Only one concurrent request can successfully transition used_at IS NULL -> datetime('now')
  const claimResult = await db.prepare(`
    UPDATE reset_tokens
    SET used_at = datetime('now')
    WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
  `).bind(resetToken).run();

  const changes = claimResult.meta?.changes ?? (claimResult as any).changes ?? 0;
  if (changes === 0) {
    throw new Error('This password reset token has already been consumed or expired.');
  }

  // 3. Only after successfully claiming the reset token should password replacement proceed
  const empId = tokenRecord.employee_id;
  const newSalt = generateSalt(16);
  const newHash = await hashPassword(newPassword, newSalt, pepper);

  // Update password in users table
  await db.prepare(`
    UPDATE users
    SET password_hash = ?, salt = ?, updated_at = datetime('now'), status = 'ACTIVE'
    WHERE employee_id = ?
  `).bind(newHash, newSalt, empId).run();

  // 4. Invalidate all active sessions for this employee
  await db.prepare('DELETE FROM sessions WHERE employee_id = ?').bind(empId).run();

  await logAuditAction(db, empId, 'PASSWORD_RESET_SUCCESS', 'AUTH', empId, {}, ipAddress);
}

export async function getBootstrapStatus(db: D1Database): Promise<{ can_bootstrap: boolean }> {
  const adminCount = await db.prepare(`
    SELECT COUNT(*) as count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'ADMIN'
  `).first<any>();
  const state = await db.prepare("SELECT value FROM system_state WHERE key = 'initial_admin_bootstrap'").first<any>();

  return {
    can_bootstrap: (adminCount?.count || 0) === 0 && state?.value !== 'COMPLETED' && state?.value !== 'IN_PROGRESS'
  };
}

export async function bootstrapInitialAdmin(
  db: D1Database,
  env: Env,
  data: {
    employee_id: string;
    name: string;
    designation?: string;
    department?: string;
    email?: string;
    phone?: string;
    date_of_joining: string;
    password: string;
    setup_token?: string;
  },
  ipAddress?: string
): Promise<{ success: boolean; employee_id: string; message: string }> {
  const configuredSetupToken = env.BOOTSTRAP_TOKEN?.trim();
  if (env.ENVIRONMENT === 'production' && !configuredSetupToken) {
    throw new Error('BOOTSTRAP_TOKEN is not configured. Initial administrator setup is disabled until the server secret is configured.');
  }
  if (configuredSetupToken && (!data.setup_token || !timingSafeTokenEqual(data.setup_token.trim(), configuredSetupToken))) {
    throw new Error('Invalid or missing bootstrap setup token.');
  }

  const cleanEmpId = data.employee_id.trim().toUpperCase();
  const cleanName = data.name.trim();
  const cleanDoj = data.date_of_joining?.trim();
  if (!cleanEmpId || !cleanName || !cleanDoj || !data.password) {
    throw new Error('Employee ID, Name, Date of Joining, and Password are required for initial administrator setup.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDoj)) {
    throw new Error('Date of Joining must be in YYYY-MM-DD format.');
  }
  if (data.password.length < 10) {
    throw new Error('Password must be at least 10 characters long.');
  }

  // Atomic one-time claim. Exactly one concurrent request can acquire this row.
  const claim = await db.prepare(`
    INSERT OR IGNORE INTO system_state (key, value, updated_at)
    VALUES ('initial_admin_bootstrap', 'IN_PROGRESS', datetime('now'))
  `).run();
  if ((claim.meta?.changes || 0) !== 1) {
    throw new Error('Initial bootstrap is closed or another bootstrap request is already in progress.');
  }

  try {
    const adminCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'ADMIN'
    `).first<any>();
    if ((adminCount?.count || 0) > 0) {
      await db.prepare("UPDATE system_state SET value = 'COMPLETED', updated_at = datetime('now') WHERE key = 'initial_admin_bootstrap'").run();
      throw new Error('Initial bootstrap is permanently closed. An administrator account already exists.');
    }

    const pepper = getRequiredSecret(env, 'PASSWORD_PEPPER', 'PASSWORD_PEPPER');

    await db.prepare(`
      INSERT INTO employees (employee_id, name, designation, department, email, phone, date_of_joining, status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
      ON CONFLICT(employee_id) DO UPDATE SET
        name = excluded.name,
        designation = excluded.designation,
        department = excluded.department,
        email = excluded.email,
        phone = excluded.phone,
        date_of_joining = excluded.date_of_joining,
        status = 'ACTIVE',
        synced_at = datetime('now')
    `).bind(
      cleanEmpId,
      cleanName,
      data.designation?.trim() || 'Administrator',
      data.department?.trim() || 'Nursing Services',
      data.email?.trim() || null,
      data.phone?.trim() || null,
      cleanDoj
    ).run();

    const salt = generateSalt(16);
    const pwdHash = await hashPassword(data.password, salt, pepper);
    await db.prepare(`
      INSERT INTO users (id, employee_id, password_hash, salt, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
      ON CONFLICT(employee_id) DO UPDATE SET
        password_hash = excluded.password_hash,
        salt = excluded.salt,
        status = 'ACTIVE',
        updated_at = datetime('now')
    `).bind('USR_' + cleanEmpId, cleanEmpId, pwdHash, salt).run();

    const adminRole = await db.prepare("SELECT id FROM roles WHERE name = 'ADMIN'").first<any>();
    if (!adminRole) throw new Error('ADMIN role is missing from the database migration.');

    await db.prepare(`
      INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by, created_at)
      VALUES (?, ?, ?, 'BOOTSTRAP', datetime('now'))
    `).bind('UR_' + generateRandomToken(8), cleanEmpId, adminRole.id).run();

    await db.prepare("UPDATE system_state SET value = 'COMPLETED', updated_at = datetime('now') WHERE key = 'initial_admin_bootstrap'").run();
    await logAuditAction(db, cleanEmpId, 'INITIAL_ADMIN_BOOTSTRAPPED', 'AUTH', cleanEmpId, { name: cleanName }, ipAddress);

    return { success: true, employee_id: cleanEmpId, message: 'Initial administrator account successfully established. Bootstrap is now permanently disabled.' };
  } catch (err) {
    const state = await db.prepare("SELECT value FROM system_state WHERE key = 'initial_admin_bootstrap'").first<any>();
    if (state?.value === 'IN_PROGRESS') {
      await db.prepare("DELETE FROM system_state WHERE key = 'initial_admin_bootstrap' AND value = 'IN_PROGRESS'").run();
    }
    throw err;
  }
}

function timingSafeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
