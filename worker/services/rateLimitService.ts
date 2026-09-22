import { D1Database } from '@cloudflare/workers-types';

export class RateLimitError extends Error {
  constructor(message = 'Too many attempts. Please try again after 15 minutes.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export type RateLimitAction = 'login' | 'forgot_password' | 'reset_password' | 'bootstrap';

export async function checkRateLimit(
  db: D1Database,
  action: RateLimitAction,
  identifier: string,
  maxAttempts = 5,
  windowMinutes = 15
): Promise<void> {
  const key = `ratelimit:${action}:${identifier.trim().toLowerCase()}`;

  try {
    const row = await db.prepare(`
      SELECT attempts, window_start, blocked_until
      FROM auth_rate_limits
      WHERE rate_key = ?
    `).bind(key).first<any>();

    if (row) {
      if (row.blocked_until && new Date(row.blocked_until).getTime() > Date.now()) {
        throw new RateLimitError('Too many failed attempts. Please try again after 15 minutes.');
      }

      const windowStartMs = new Date(row.window_start).getTime();
      const windowExpired = Date.now() - windowStartMs > windowMinutes * 60 * 1000;

      if (!windowExpired && row.attempts >= maxAttempts) {
        // Block for 15 minutes
        const blockedUntil = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
        await db.prepare(`
          UPDATE auth_rate_limits
          SET blocked_until = ?
          WHERE rate_key = ?
        `).bind(blockedUntil, key).run();

        throw new RateLimitError('Too many failed attempts. Please try again after 15 minutes.');
      }
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    console.error('checkRateLimit error:', err);
  }
}

export async function recordFailedAttempt(
  db: D1Database,
  action: RateLimitAction,
  identifier: string,
  windowMinutes = 15
): Promise<void> {
  const key = `ratelimit:${action}:${identifier.trim().toLowerCase()}`;

  try {
    const row = await db.prepare(`
      SELECT attempts, window_start
      FROM auth_rate_limits
      WHERE rate_key = ?
    `).bind(key).first<any>();

    if (!row) {
      await db.prepare(`
        INSERT INTO auth_rate_limits (rate_key, attempts, window_start, blocked_until)
        VALUES (?, 1, datetime('now'), NULL)
      `).bind(key).run();
    } else {
      const windowStartMs = new Date(row.window_start).getTime();
      const windowExpired = Date.now() - windowStartMs > windowMinutes * 60 * 1000;

      if (windowExpired) {
        await db.prepare(`
          UPDATE auth_rate_limits
          SET attempts = 1, window_start = datetime('now'), blocked_until = NULL
          WHERE rate_key = ?
        `).bind(key).run();
      } else {
        await db.prepare(`
          UPDATE auth_rate_limits
          SET attempts = attempts + 1
          WHERE rate_key = ?
        `).bind(key).run();
      }
    }
  } catch (err) {
    console.error('recordFailedAttempt error:', err);
  }
}

export async function clearRateLimit(
  db: D1Database,
  action: RateLimitAction,
  identifier: string
): Promise<void> {
  const key = `ratelimit:${action}:${identifier.trim().toLowerCase()}`;
  try {
    await db.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').bind(key).run();
  } catch (err) {
    console.error('clearRateLimit error:', err);
  }
}
