import { Env, AuthenticatedUser, Role } from '../types';

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });

  return list;
}

export function extractSessionToken(request: Request): string | null {
  // Strict HttpOnly Cookie session authentication for browser users
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  return cookies['cne_session'] || null;
}

export async function getAuthUser(request: Request, env: Env): Promise<AuthenticatedUser | null> {
  const token = extractSessionToken(request);
  if (!token) return null;

  try {
    const sessionUser = await env.DB.prepare(`
      SELECT 
        s.token,
        s.employee_id,
        s.expires_at,
        e.name,
        e.designation,
        e.department,
        e.email,
        e.phone,
        e.status
      FROM sessions s
      JOIN employees e ON s.employee_id = e.employee_id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).bind(token).first<any>();

    if (!sessionUser) return null;
    if (sessionUser.status !== 'ACTIVE') return null;

    // Fetch user roles
    const roleRows = await env.DB.prepare(`
      SELECT r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.employee_id = ?
    `).bind(sessionUser.employee_id).all<any>();

    const roles: Role[] = (roleRows.results || []).map((r: any) => r.role_name as Role);
    if (!roles.includes('EMPLOYEE')) {
      roles.push('EMPLOYEE');
    }

    return {
      employee_id: sessionUser.employee_id,
      name: sessionUser.name,
      designation: sessionUser.designation,
      department: sessionUser.department,
      email: sessionUser.email,
      phone: sessionUser.phone,
      status: sessionUser.status,
      roles
    };
  } catch (err) {
    console.error('getAuthUser error:', err);
    return null;
  }
}

export class AuthError extends Error {
  constructor(public code: string, message: string, public status = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireAuth(request: Request, env: Env): Promise<AuthenticatedUser> {
  const user = await getAuthUser(request, env);
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required. Please sign in with your employee credentials.', 401);
  }
  return user;
}

export function requireRole(user: AuthenticatedUser, allowedRoles: Role[]): void {
  const hasRole = allowedRoles.some(role => user.roles.includes(role));
  if (!hasRole) {
    throw new AuthError('FORBIDDEN', `Access denied. Requires one of: ${allowedRoles.join(', ')}`, 403);
  }
}

export async function getAssignedAreaIds(db: D1Database, employeeId: string): Promise<string[]> {
  try {
    const rows = await db.prepare(`
      SELECT area_id FROM area_incharge_assignments
      WHERE employee_id = ? AND active = 1
    `).bind(employeeId).all<any>();
    return (rows.results || []).map((r: any) => r.area_id);
  } catch (err) {
    console.error('getAssignedAreaIds error:', err);
    return [];
  }
}

export async function verifyAreaInchargeAccess(
  db: D1Database,
  user: AuthenticatedUser,
  areaId: string
): Promise<void> {
  if (user.roles.includes('ADMIN')) {
    return; // Institutional administrators have global access
  }
  if (!user.roles.includes('AREA_INCHARGE')) {
    throw new AuthError('FORBIDDEN', 'Administrative or Area In-Charge role required.', 403);
  }

  const assignedAreaIds = await getAssignedAreaIds(db, user.employee_id);
  if (!assignedAreaIds.includes(areaId)) {
    throw new AuthError('FORBIDDEN', 'You are not assigned as In-Charge for this clinical area/ward.', 403);
  }
}

export async function verifyCneInchargeAccess(
  db: D1Database,
  user: AuthenticatedUser,
  cneId: string
): Promise<any> {
  if (user.roles.includes('ADMIN')) {
    const cne = await db.prepare('SELECT id, cne_id, area_id, status FROM cnes WHERE id = ? OR cne_id = ?').bind(cneId, cneId).first<any>();
    if (!cne) {
      throw new Error('CNE session not found.');
    }
    return cne;
  }

  const cne = await db.prepare('SELECT id, cne_id, area_id, status FROM cnes WHERE id = ? OR cne_id = ?').bind(cneId, cneId).first<any>();
  if (!cne) {
    throw new Error('CNE session not found.');
  }

  await verifyAreaInchargeAccess(db, user, cne.area_id);
  return cne;
}

