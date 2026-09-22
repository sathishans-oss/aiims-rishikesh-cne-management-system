import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { createCne, modifyCne, cancelCne, completeCne } from '../services/cneService';
import { requireAuth, requireRole, verifyAreaInchargeAccess, verifyCneInchargeAccess } from '../middleware/auth';

export async function handleCneRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/cne (Create)
  if (path === '/api/cne' && method === 'POST') {
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const body: any = await request.json().catch(() => ({}));
      if (!user.roles.includes('ADMIN')) await verifyAreaInchargeAccess(env.DB, user, body.area_id);
      const { title, category, area_id, venue, cne_date, start_time, end_time, capacity, resource_person_id, resource_persons } = body;

      if (!title || !category || !area_id || !venue || !cne_date || !start_time || !end_time) {
        return errorResponse('MISSING_FIELDS', 'All core CNE fields (title, category, area, venue, date, start/end times) are required.');
      }

      const created = await createCne(env.DB, user, {
        title,
        category,
        area_id,
        venue,
        cne_date,
        start_time,
        end_time,
        capacity,
        resource_person_id,
        resource_persons
      });

      return successResponse(created, 201);
    } catch (err: any) {
      return errorResponse('CNE_CREATE_ERROR', err.message || 'Failed to create CNE.', err.status || 400);
    }
  }

  // POST /api/cne/:id/cancel
  const cancelMatch = path.match(/^\/api\/cne\/([^/]+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    const id = cancelMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, id);
      const body: any = await request.json().catch(() => ({}));
      const reason = body.cancel_reason || 'Administrative exigency';

      const canceled = await cancelCne(env.DB, user, id, reason);
      return successResponse(canceled);
    } catch (err: any) {
      return errorResponse('CNE_CANCEL_ERROR', err.message || 'Failed to cancel CNE.', err.status || 400);
    }
  }

  // POST /api/cne/:id/complete
  const completeMatch = path.match(/^\/api\/cne\/([^/]+)\/complete$/);
  if (completeMatch && method === 'POST') {
    const id = completeMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, id);
      const completed = await completeCne(env.DB, user, id);
      return successResponse(completed);
    } catch (err: any) {
      return errorResponse('CNE_COMPLETE_ERROR', err.message || 'Failed to complete CNE.', err.status || 400);
    }
  }

  // PUT /api/cne/:id (Modify)
  const putMatch = path.match(/^\/api\/cne\/([^/]+)$/);
  if (putMatch && method === 'PUT') {
    const id = putMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const body: any = await request.json().catch(() => ({}));
      await verifyCneInchargeAccess(env.DB, user, id);
      if (body.area_id && !user.roles.includes('ADMIN')) await verifyAreaInchargeAccess(env.DB, user, body.area_id);
      const modified = await modifyCne(env.DB, user, id, body);
      return successResponse(modified);
    } catch (err: any) {
      return errorResponse('CNE_MODIFY_ERROR', err.message || 'Failed to modify CNE.', err.status || 400);
    }
  }

  return null;
}
