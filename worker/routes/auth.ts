import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { login, logout, forgotPassword, resetPassword, getBootstrapStatus, bootstrapInitialAdmin } from '../services/authService';
import { getAuthUser, extractSessionToken } from '../middleware/auth';
import { checkRateLimit, recordFailedAttempt, clearRateLimit, RateLimitError } from '../services/rateLimitService';

export async function handleAuthRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown-client';
    try {
      await checkRateLimit(env.DB, 'login', clientIp);

      const body: any = await request.json().catch(() => ({}));
      const { employee_id, password } = body;

      if (!employee_id || !password) {
        return errorResponse('MISSING_CREDENTIALS', 'Employee ID and password are required.');
      }

      const { user, cookieHeader } = await login(env.DB, env, employee_id, password, clientIp);
      await clearRateLimit(env.DB, 'login', clientIp);

      const headers = new Headers();
      headers.set('Set-Cookie', cookieHeader);

      // Strict HttpOnly: do NOT return raw session token in JavaScript body
      return successResponse({
        user
      }, 200, headers);
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        return errorResponse('RATE_LIMITED', err.message, 429);
      }
      await recordFailedAttempt(env.DB, 'login', clientIp);
      return errorResponse('AUTH_FAILED', err.message || 'Login failed.', 401);
    }
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && method === 'GET') {
    const user = await getAuthUser(request, env);
    if (!user) {
      return successResponse({
        authenticated: false,
        user: null
      });
    }
    return successResponse({
      authenticated: true,
      user
    });
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = extractSessionToken(request);
    const user = await getAuthUser(request, env);
    const { clearCookieHeader } = await logout(env.DB, env, token, user?.employee_id);

    const headers = new Headers();
    headers.set('Set-Cookie', clearCookieHeader);

    return successResponse({ message: 'Logged out successfully.' }, 200, headers);
  }

  // POST /api/auth/forgot-password
  if (path === '/api/auth/forgot-password' && method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown-client';
    try {
      await checkRateLimit(env.DB, 'forgot_password', clientIp);

      const body: any = await request.json().catch(() => ({}));
      const { employee_id, date_of_joining } = body;

      if (!employee_id || !date_of_joining) {
        return errorResponse('MISSING_FIELDS', 'Employee ID and Date of Joining are required.');
      }

      const { resetToken } = await forgotPassword(env.DB, employee_id, date_of_joining, clientIp);
      await clearRateLimit(env.DB, 'forgot_password', clientIp);

      return successResponse({
        resetToken,
        message: 'Identity verified. You may now reset your password.'
      });
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        return errorResponse('RATE_LIMITED', err.message, 429);
      }
      await recordFailedAttempt(env.DB, 'forgot_password', clientIp);
      return errorResponse('VERIFICATION_FAILED', err.message || 'Verification failed.', 400);
    }
  }

  // POST /api/auth/reset-password
  if (path === '/api/auth/reset-password' && method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown-client';
    try {
      await checkRateLimit(env.DB, 'reset_password', clientIp);

      const body: any = await request.json().catch(() => ({}));
      const { reset_token, new_password } = body;

      if (!reset_token || !new_password) {
        return errorResponse('MISSING_FIELDS', 'Reset token and new password are required.');
      }

      await resetPassword(env.DB, env, reset_token, new_password, clientIp);
      await clearRateLimit(env.DB, 'reset_password', clientIp);

      return successResponse({
        message: 'Password has been successfully reset. Please log in with your new credentials.'
      });
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        return errorResponse('RATE_LIMITED', err.message, 429);
      }
      await recordFailedAttempt(env.DB, 'reset_password', clientIp);
      return errorResponse('RESET_FAILED', err.message || 'Failed to reset password.', 400);
    }
  }

  // GET /api/auth/bootstrap-status
  if (path === '/api/auth/bootstrap-status' && method === 'GET') {
    try {
      const status = await getBootstrapStatus(env.DB);
      return successResponse(status);
    } catch (err: any) {
      return errorResponse('BOOTSTRAP_STATUS_ERROR', err.message || 'Failed to query bootstrap status.', 500);
    }
  }

  // POST /api/auth/bootstrap
  if (path === '/api/auth/bootstrap' && method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown-client';
    try {
      await checkRateLimit(env.DB, 'bootstrap', clientIp);

      const body: any = await request.json().catch(() => ({}));
      const result = await bootstrapInitialAdmin(env.DB, env, body, clientIp);
      await clearRateLimit(env.DB, 'bootstrap', clientIp);

      return successResponse(result, 201);
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        return errorResponse('RATE_LIMITED', err.message, 429);
      }
      await recordFailedAttempt(env.DB, 'bootstrap', clientIp);
      return errorResponse('BOOTSTRAP_FAILED', err.message || 'Administrator bootstrap failed.', 400);
    }
  }

  return null;
}
