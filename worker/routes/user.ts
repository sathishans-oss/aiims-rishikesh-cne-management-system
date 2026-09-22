import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { getUserDashboard, getMyCneRecords } from '../services/reportService';
import { requireAuth } from '../middleware/auth';

export async function handleUserRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // GET /api/user/dashboard
  if (path === '/api/user/dashboard' && method === 'GET') {
    try {
      const user = await requireAuth(request, env);
      const dashboard = await getUserDashboard(env.DB, user);
      return successResponse(dashboard);
    } catch (err: any) {
      return errorResponse('DASHBOARD_ERROR', err.message || 'Failed to load user dashboard.', err.status || 400);
    }
  }

  // GET /api/user/my-cne-records
  if (path === '/api/user/my-cne-records' && method === 'GET') {
    try {
      const user = await requireAuth(request, env);
      const search = url.searchParams.get('search') || undefined;
      const records = await getMyCneRecords(env.DB, user, search);
      return successResponse(records);
    } catch (err: any) {
      return errorResponse('RECORDS_ERROR', err.message || 'Failed to load user records.', err.status || 400);
    }
  }

  return null;
}
