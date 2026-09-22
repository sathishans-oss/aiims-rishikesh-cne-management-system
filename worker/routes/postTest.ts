import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { getPostTestForEmployee, submitPostTest } from '../services/postTestService';
import { requireAuth } from '../middleware/auth';

export async function handlePostTestRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/post-test/:cneId/submit
  const submitMatch = path.match(/^\/api\/post-test\/([^/]+)\/submit$/);
  if (submitMatch && method === 'POST') {
    const cneId = submitMatch[1];
    try {
      const user = await requireAuth(request, env);
      const body: any = await request.json().catch(() => ({}));
      const answers = body.answers || {};

      const result = await submitPostTest(env.DB, user, cneId, answers);
      return successResponse(result);
    } catch (err: any) {
      return errorResponse('POST_TEST_SUBMISSION_ERROR', err.message || 'Failed to submit post-test.', err.status || 400);
    }
  }

  // GET /api/post-test/:cneId
  const getMatch = path.match(/^\/api\/post-test\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    const cneId = getMatch[1];
    try {
      const user = await requireAuth(request, env);
      const testData = await getPostTestForEmployee(env.DB, user, cneId);
      return successResponse(testData);
    } catch (err: any) {
      return errorResponse('POST_TEST_ERROR', err.message || 'Failed to load post-test.', err.status || 400);
    }
  }

  return null;
}
