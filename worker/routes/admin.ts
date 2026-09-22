import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import {
  listAreas,
  createArea,
  updateArea,
  listEmployeesWithRoles,
  assignRole,
  syncOfficersFromGoogleSheet,
  getAdminContent,
  updateChairperson,
  updateCoordinator,
  createNews,
  updateNews,
  deleteNews,
  createQuickLink,
  updateQuickLink,
  deleteQuickLink,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  updateInstitutionalMetric,
  listAreaIncharges,
  assignAreaIncharge,
  removeAreaIncharge
} from '../services/adminMasterService';
import { getAdminReports } from '../services/reportService';
import { getSystemDiagnostics } from '../services/diagnosticsService';
import { pingGemini } from '../services/aiMcqService';
import { processBackupQueue } from '../services/backupService';
import { requireAuth, requireRole, getAssignedAreaIds } from '../middleware/auth';

export async function handleAdminRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  if (!path.startsWith('/api/admin')) {
    return null;
  }

  // All /api/admin routes require authentication; each route applies least-privilege RBAC below.
  const user = await requireAuth(request, env);

  // Areas Admin Management
  if (path === '/api/admin/areas' && method === 'GET') {
    requireRole(user, ['ADMIN']);
    const areas = await listAreas(env.DB, false);
    return successResponse(areas);
  }

  if (path === '/api/admin/areas' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const { name, code, description } = body;
    if (!name || !code) {
      return errorResponse('MISSING_FIELDS', 'Area name and code are required.');
    }
    const created = await createArea(env.DB, user, name, code, description);
    return successResponse(created, 201);
  }

  const areaIdMatch = path.match(/^\/api\/admin\/areas\/([^/]+)$/);
  if (areaIdMatch && method === 'PUT') {
    requireRole(user, ['ADMIN']);
    const id = areaIdMatch[1];
    const body: any = await request.json().catch(() => ({}));
    const updated = await updateArea(env.DB, user, id, body.name, body.description, body.active);
    return successResponse(updated);
  }

  // RBAC Role Assignment
  if (path === '/api/admin/roles/employees' && method === 'GET') {
    requireRole(user, ['ADMIN']);
    const search = url.searchParams.get('search') || undefined;
    const employees = await listEmployeesWithRoles(env.DB, search);
    return successResponse(employees);
  }

  if (path === '/api/admin/roles/assign' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const { employee_id, role } = body;
    if (!employee_id || !role) {
      return errorResponse('MISSING_FIELDS', 'Employee ID and role are required.');
    }
    const result = await assignRole(env.DB, user, employee_id, role);
    return successResponse(result);
  }

  // AREA_INCHARGE clinical-area assignment (ADMIN only)
  if (path === '/api/admin/area-incharges' && method === 'GET') {
    requireRole(user, ['ADMIN']);
    const areaId = url.searchParams.get('area_id') || undefined;
    return successResponse(await listAreaIncharges(env.DB, areaId));
  }

  if (path === '/api/admin/area-incharges' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    if (!body.employee_id || !body.area_id) return errorResponse('MISSING_FIELDS', 'Employee ID and Area are required.');
    return successResponse(await assignAreaIncharge(env.DB, user, body.employee_id, body.area_id), 201);
  }

  if (path === '/api/admin/area-incharges' && method === 'DELETE') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    if (!body.employee_id || !body.area_id) return errorResponse('MISSING_FIELDS', 'Employee ID and Area are required.');
    return successResponse(await removeAreaIncharge(env.DB, user, body.employee_id, body.area_id));
  }

  // Google Sheet Officers Sync
  if (path === '/api/admin/sync-officers' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const result = await syncOfficersFromGoogleSheet(env.DB, env, user);
    return successResponse(result);
  }

  // Portal Content Management
  if (path === '/api/admin/content' && method === 'GET') {
    requireRole(user, ['ADMIN']);
    const content = await getAdminContent(env.DB);
    return successResponse(content);
  }

  if (path === '/api/admin/content/chairperson' && method === 'PUT') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const updated = await updateChairperson(env.DB, user, body, env);
    return successResponse(updated);
  }

  if (path === '/api/admin/content/coordinator' && method === 'PUT') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const updated = await updateCoordinator(env.DB, user, body);
    return successResponse(updated);
  }

  if (path === '/api/admin/content/news' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const created = await createNews(env.DB, user, body);
    return successResponse(created, 201);
  }

  const newsUpdateMatch = path.match(/^\/api\/admin\/content\/news\/([^/]+)$/);
  if (newsUpdateMatch && method === 'PUT') { requireRole(user, ['ADMIN']); const body:any=await request.json().catch(()=>({})); return successResponse(await updateNews(env.DB,user,newsUpdateMatch[1],body)); }

  const newsDelMatch = path.match(/^\/api\/admin\/content\/news\/([^/]+)$/);
  if (newsDelMatch && method === 'DELETE') {
    requireRole(user, ['ADMIN']);
    await deleteNews(env.DB, user, newsDelMatch[1]);
    return successResponse({ message: 'News circular removed.' });
  }

  if (path === '/api/admin/content/quick-links' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const created = await createQuickLink(env.DB, user, body);
    return successResponse(created, 201);
  }

  const linkUpdateMatch = path.match(/^\/api\/admin\/content\/quick-links\/([^/]+)$/);
  if (linkUpdateMatch && method === 'PUT') { requireRole(user, ['ADMIN']); const body:any=await request.json().catch(()=>({})); return successResponse(await updateQuickLink(env.DB,user,linkUpdateMatch[1],body)); }

  const linkDelMatch = path.match(/^\/api\/admin\/content\/quick-links\/([^/]+)$/);
  if (linkDelMatch && method === 'DELETE') {
    requireRole(user, ['ADMIN']);
    await deleteQuickLink(env.DB, user, linkDelMatch[1]);
    return successResponse({ message: 'Quick link removed.' });
  }

  if (path === '/api/admin/content/gallery' && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const created = await createGalleryItem(env.DB, user, body, env);
    return successResponse(created, 201);
  }

  const galUpdateMatch = path.match(/^\/api\/admin\/content\/gallery\/([^/]+)$/);
  if (galUpdateMatch && method === 'PUT') { requireRole(user, ['ADMIN']); const body:any=await request.json().catch(()=>({})); return successResponse(await updateGalleryItem(env.DB,user,galUpdateMatch[1],body,env)); }

  const galDelMatch = path.match(/^\/api\/admin\/content\/gallery\/([^/]+)$/);
  if (galDelMatch && method === 'DELETE') {
    requireRole(user, ['ADMIN']);
    await deleteGalleryItem(env.DB, user, galDelMatch[1]);
    return successResponse({ message: 'Gallery item removed.' });
  }

  if (path === '/api/admin/content/institutional-metric' && method === 'PUT') {
    requireRole(user, ['ADMIN']);
    const body: any = await request.json().catch(() => ({}));
    const updated = await updateInstitutionalMetric(env.DB, user, body.key, body.value);
    return successResponse(updated);
  }

  // Reports
  if (path === '/api/admin/reports' && method === 'GET') {
    const year = url.searchParams.get('year') || undefined;
    const area = url.searchParams.get('area') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const date_from = url.searchParams.get('date_from') || undefined;
    const date_to = url.searchParams.get('date_to') || undefined;
    const employee = url.searchParams.get('employee') || undefined;
    requireRole(user, ['ADMIN', 'AREA_INCHARGE']);
    const allowedAreaIds = user.roles.includes('ADMIN') ? undefined : await getAssignedAreaIds(env.DB, user.employee_id);
    if (!user.roles.includes('ADMIN') && allowedAreaIds?.length === 0) return errorResponse('FORBIDDEN', 'No clinical Area is assigned to this Area In-Charge.', 403);
    if (!user.roles.includes('ADMIN') && area && area !== 'ALL' && !allowedAreaIds!.includes(area)) return errorResponse('FORBIDDEN', 'Report access is limited to your assigned clinical Area(s).', 403);
    const reports = await getAdminReports(env.DB, { year, area, category, status, date_from, date_to, employee, allowedAreaIds });
    return successResponse(reports);
  }

  // System Diagnostics
  if (path === '/api/admin/diagnostics' && method === 'GET') {
    requireRole(user, ['ADMIN']);
    const diagnostics = await getSystemDiagnostics(env.DB, env);
    return successResponse(diagnostics);
  }

  // Test Gemini Connection
  if ((path === '/api/admin/diagnostics/test-gemini' || path === '/api/admin/test-gemini') && method === 'POST') {
    requireRole(user, ['ADMIN']);
    try {
      const pingResult = await pingGemini(env);
      return successResponse(pingResult);
    } catch (err: any) {
      return errorResponse('GEMINI_TEST_FAILED', err.message || 'Gemini connection failed.', 500);
    }
  }

  // Trigger Backup Sync
  if ((path === '/api/admin/backup/trigger-sync' || path === '/api/admin/process-backup-queue') && method === 'POST') {
    requireRole(user, ['ADMIN']);
    const result = await processBackupQueue(env.DB, env);
    return successResponse(result);
  }

  return null;
}
