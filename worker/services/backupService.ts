import { Env } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { sanitizeRecordForSheets } from '../utils/sheetsSanitize';

export async function enqueueBackup(
  db: D1Database,
  tableName: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, any>
): Promise<void> {
  try {
    const id = 'JOB_' + generateRandomToken(12);
    const sanitizedPayload = sanitizeRecordForSheets(payload);
    const payloadStr = JSON.stringify(sanitizedPayload);

    await db.prepare(`
      INSERT INTO backup_jobs (id, table_name, record_id, operation, payload, status, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', 0, datetime('now'))
    `).bind(id, tableName, recordId, operation, payloadStr).run();
  } catch (err) {
    console.error('Failed to enqueue backup job:', err);
  }
}

export async function processBackupQueue(
  db: D1Database,
  env: Env,
  specificJobId?: string
): Promise<{ processed: number; success: boolean; message: string }> {
  // If Google Apps Script is not configured, do not claim it succeeded!
  if (!env.GOOGLE_APPS_SCRIPT_URL || !env.GOOGLE_INTEGRATION_SECRET) {
    return {
      processed: 0,
      success: false,
      message: 'Google Apps Script URL or Integration Secret not configured in environment. Jobs remain PENDING.'
    };
  }

  let jobs: any[] = [];
  if (specificJobId) {
    const jobRow = await db.prepare(`
      SELECT id, table_name, record_id, operation, payload, retry_count, status
      FROM backup_jobs
      WHERE id = ?
    `).bind(specificJobId).first<any>();

    if (!jobRow) {
      throw new Error(`Backup job ${specificJobId} not found.`);
    }
    if (jobRow.status === 'BACKED_UP') {
      throw new Error(`Backup job ${specificJobId} is already successfully backed up.`);
    }
    jobs = [jobRow];
  } else {
    // Atomically select up to 25 PENDING or retryable jobs
    const pendingJobs = await db.prepare(`
      SELECT id, table_name, record_id, operation, payload, retry_count, status
      FROM backup_jobs
      WHERE status = 'PENDING' OR (status = 'FAILED_RETRYABLE' AND retry_count < 3)
      ORDER BY created_at ASC
      LIMIT 25
    `).all<any>();

    jobs = pendingJobs.results || [];
  }

  if (jobs.length === 0) {
    return { processed: 0, success: true, message: 'Queue is empty or no eligible jobs.' };
  }

  let successCount = 0;

  for (const job of jobs) {
    try {
      const parsedPayload = JSON.parse(job.payload);

      const res = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'backup_record',
          integration_secret: env.GOOGLE_INTEGRATION_SECRET.trim(),
          table: job.table_name,
          record_id: job.record_id,
          operation: job.operation,
          data: parsedPayload,
          timestamp: new Date().toISOString()
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const resJson: any = await res.json().catch(() => null);
      if (resJson && resJson.success === true) {
        await db.prepare(`
          UPDATE backup_jobs
          SET status = 'BACKED_UP',
              backed_up_at = datetime('now'),
              last_attempt_at = datetime('now'),
              last_error = NULL
          WHERE id = ?
        `).bind(job.id).run();
        successCount++;
      } else {
        throw new Error(resJson?.error || 'Google Apps Script returned failure for backup_record');
      }
    } catch (err: any) {
      console.error(`Backup job ${job.id} failed:`, err);
      const newRetryCount = (job.retry_count || 0) + 1;
      const newStatus = newRetryCount >= 3 ? 'FAILED_PERMANENT' : 'FAILED_RETRYABLE';

      await db.prepare(`
        UPDATE backup_jobs
        SET status = ?,
            retry_count = ?,
            last_attempt_at = datetime('now'),
            last_error = ?
        WHERE id = ?
      `).bind(newStatus, newRetryCount, err.message?.slice(0, 500) || 'Unknown error', job.id).run();
    }
  }

  return {
    processed: jobs.length,
    success: successCount === jobs.length,
    message: `Processed ${jobs.length} backup jobs (${successCount} successful).`
  };
}

export async function requeueBackupJob(db: D1Database, jobId: string): Promise<void> {
  const job = await db.prepare('SELECT id, status FROM backup_jobs WHERE id = ?').bind(jobId).first<any>();
  if (!job) {
    throw new Error(`Backup job ${jobId} not found.`);
  }
  if (job.status === 'BACKED_UP') {
    throw new Error('Cannot requeue a job that is already backed up.');
  }

  await db.prepare(`
    UPDATE backup_jobs
    SET status = 'PENDING', retry_count = 0, last_error = NULL
    WHERE id = ?
  `).bind(jobId).run();
}
