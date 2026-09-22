import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { applyForCne, getMyApplications, listApplications, reviewApplication } from '../services/applicationService';
import { requireAuth, requireRole } from '../middleware/auth';

export async function handleApplicationRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/applications/apply
  if (path === '/api/applications/apply' && method === 'POST') {
    try {
      const user = await requireAuth(request, env);
      const body: any = await request.json().catch(() => ({}));
      const { cne_id } = body;

      if (!cne_id) {
        return errorResponse('MISSING_FIELDS', 'CNE ID is required.');
      }

      const application = await applyForCne(env.DB, user, cne_id);
      return successResponse(application, 201);
    } catch (err: any) {
      return errorResponse('APPLICATION_ERROR', err.message || 'Failed to submit application.', err.status || 400);
    }
  }

  // GET /api/applications/my
  if (path === '/api/applications/my' && method === 'GET') {
    try {
      const user = await requireAuth(request, env);
      const myApps = await getMyApplications(env.DB, user.employee_id);
      return successResponse(myApps);
    } catch (err: any) {
      return errorResponse('MY_APPLICATIONS_ERROR', err.message || 'Failed to load applications.', err.status || 400);
    }
  }

  // GET /api/applications (Admin / Area In-Charge)
  if (path === '/api/applications' && method === 'GET') {
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const cne_id = url.searchParams.get('cne_id') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const area = url.searchParams.get('area') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const date_from = url.searchParams.get('date_from') || undefined;
      const date_to = url.searchParams.get('date_to') || undefined;
      const page = Number(url.searchParams.get('page') || 1);
      const page_size = Number(url.searchParams.get('page_size') || 25);

      const apps = await listApplications(env.DB, { cne_id, status, area, search, date_from, date_to, page, page_size }, user);
      return successResponse(apps);
    } catch (err: any) {
      return errorResponse('APPLICATIONS_LIST_ERROR', err.message || 'Failed to list applications.', err.status || 400);
    }
  }

  // POST /api/applications/:id/review
  const reviewMatch = path.match(/^\/api\/applications\/([^/]+)\/review$/);
  if (reviewMatch && method === 'POST') {
    const appId = reviewMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const body: any = await request.json().catch(() => ({}));
      const { decision, review_notes } = body;

      if (!decision || (decision !== 'Approved' && decision !== 'Rejected')) {
        return errorResponse('INVALID_DECISION', 'Review decision must be "Approved" or "Rejected".');
      }

      const reviewed = await reviewApplication(env.DB, user, appId, decision, review_notes);
      return successResponse(reviewed);
    } catch (err: any) {
      return errorResponse('REVIEW_ERROR', err.message || 'Failed to review application.', err.status || 400);
    }
  }

  return null;
}
