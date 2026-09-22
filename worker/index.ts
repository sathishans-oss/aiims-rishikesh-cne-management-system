import { Env } from './types';
import { handleCors, handleCorsPreflight } from './middleware/cors';
import { errorResponse } from './utils/response';
import { handlePublicRoutes } from './routes/public';
import { handleAuthRoutes } from './routes/auth';
import { handleCneRoutes } from './routes/cne';
import { handleApplicationRoutes } from './routes/applications';
import { handleAttendanceRoutes } from './routes/attendance';
import { handleResourceRoutes } from './routes/resources';
import { handleQuestionRoutes } from './routes/questions';
import { handlePostTestRoutes } from './routes/postTest';
import { handleUserRoutes } from './routes/user';
import { handleAdminRoutes } from './routes/admin';
import { processBackupQueue } from './services/backupService';
import { withSecurityHeaders } from './middleware/security';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return withSecurityHeaders(handleCorsPreflight(request, env), env);
    }

    try {
      let response: Response | null = null;

      // 2. Dispatch routes sequentially
      if (!response) response = await handlePublicRoutes(request, env, url);
      if (!response) response = await handleAuthRoutes(request, env, url);
      if (!response) response = await handleCneRoutes(request, env, url);
      if (!response) response = await handleApplicationRoutes(request, env, url);
      if (!response) response = await handleAttendanceRoutes(request, env, url);
      if (!response) response = await handleResourceRoutes(request, env, url);
      if (!response) response = await handleQuestionRoutes(request, env, url);
      if (!response) response = await handlePostTestRoutes(request, env, url);
      if (!response) response = await handleUserRoutes(request, env, url);
      if (!response) response = await handleAdminRoutes(request, env, url);

      // 3. Fallback for unhandled paths
      if (!response) {
        if (url.pathname.startsWith('/api')) {
          response = errorResponse('NOT_FOUND', `Endpoint ${url.pathname} not found on this server.`, 404);
        } else if (env.ASSETS) {
          // Serve static frontend assets if bound
          return withSecurityHeaders(await env.ASSETS.fetch(request), env);
        } else {
          response = new Response('Not Found', { status: 404 });
        }
      }

      // 4. Background queue processing via ctx.waitUntil for non-blocking persistence
      if (['POST', 'PUT', 'DELETE'].includes(request.method) && env.GOOGLE_APPS_SCRIPT_URL) {
        ctx.waitUntil(
          processBackupQueue(env.DB, env).catch(err => {
            console.error('Background backup queue processing error:', err);
          })
        );
      }

      // 5. Apply secure CORS headers to the response
      return withSecurityHeaders(handleCors(request, response, env), env);
    } catch (err: any) {
      console.error('Unhandled worker error:', err);
      const errRes = errorResponse(
        'INTERNAL_SERVER_ERROR',
        env.ENVIRONMENT === 'production' ? 'An internal server error occurred.' : err.message || 'Internal Server Error',
        500
      );
      return withSecurityHeaders(handleCors(request, errRes, env), env);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processBackupQueue(env.DB, env).catch(err => console.error('Scheduled backup retry failed:', err)));
  }
};
