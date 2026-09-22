import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import {
  listQuestions,
  generateAiMcqsForCne,
  createManualQuestion,
  updateQuestion,
  deleteQuestion
} from '../services/aiMcqService';
import { requireAuth, requireRole, verifyCneInchargeAccess } from '../middleware/auth';

export async function handleQuestionRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/questions/:cneId/generate-ai
  const aiGenMatch = path.match(/^\/api\/questions\/([^/]+)\/generate-ai$/);
  if (aiGenMatch && method === 'POST') {
    const cneId = aiGenMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, cneId);
      const result = await generateAiMcqsForCne(env.DB, env, cneId, user.employee_id);
      return successResponse(result);
    } catch (err: any) {
      return errorResponse('AI_GENERATION_ERROR', err.message || 'AI MCQ generation failed.', err.status || 400);
    }
  }

  // POST /api/questions/:cneId/manual
  const manualMatch = path.match(/^\/api\/questions\/([^/]+)\/manual$/);
  if (manualMatch && method === 'POST') {
    const cneId = manualMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, cneId);
      const body: any = await request.json().catch(() => ({}));
      const question = await createManualQuestion(env.DB, cneId, user, body);
      return successResponse(question, 201);
    } catch (err: any) {
      return errorResponse('QUESTION_CREATE_ERROR', err.message || 'Failed to create question.', err.status || 400);
    }
  }

  // GET /api/questions/:cneId
  const qListMatch = path.match(/^\/api\/questions\/([^/]+)$/);
  if (qListMatch && method === 'GET') {
    const cneId = qListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, cneId);
      const questions = await listQuestions(env.DB, cneId);
      return successResponse(questions);
    } catch (err: any) {
      return errorResponse('QUESTIONS_ERROR', err.message || 'Failed to list questions.', err.status || 400);
    }
  }

  // PUT /api/questions/:id
  if (qListMatch && method === 'PUT') {
    const questionId = qListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const q = await env.DB.prepare('SELECT cne_id FROM cne_questions WHERE id = ?').bind(questionId).first<any>();
      if (!q) throw new Error('Question not found.');
      await verifyCneInchargeAccess(env.DB, user, q.cne_id);
      const body: any = await request.json().catch(() => ({}));
      const updated = await updateQuestion(env.DB, questionId, user, body);
      return successResponse(updated);
    } catch (err: any) {
      return errorResponse('QUESTION_UPDATE_ERROR', err.message || 'Failed to update question.', err.status || 400);
    }
  }

  // DELETE /api/questions/:id
  if (qListMatch && method === 'DELETE') {
    const questionId = qListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const q = await env.DB.prepare('SELECT cne_id FROM cne_questions WHERE id = ?').bind(questionId).first<any>();
      if (!q) throw new Error('Question not found.');
      await verifyCneInchargeAccess(env.DB, user, q.cne_id);
      await deleteQuestion(env.DB, questionId, user);
      return successResponse({ message: 'Question deleted successfully.' });
    } catch (err: any) {
      return errorResponse('QUESTION_DELETE_ERROR', err.message || 'Failed to delete question.', err.status || 400);
    }
  }

  return null;
}
