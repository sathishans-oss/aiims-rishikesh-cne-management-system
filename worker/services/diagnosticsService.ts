import { Env } from '../types';
import { getApprovedModel } from './aiMcqService';

export async function getSystemDiagnostics(db: D1Database, env: Env): Promise<any> {
  let d1Status = 'HEALTHY';
  let d1Error: string | null = null;
  let tableCount = 0;
  try {
    const probe = await db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").first<any>();
    tableCount = Number(probe?.count || 0);
  } catch (err: any) {
    d1Status = 'ERROR';
    d1Error = err.message || 'D1 probe failed';
  }

  const counts = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM employees) as employees_total,
      (SELECT COUNT(*) FROM cnes) as cnes_total,
      (SELECT COUNT(*) FROM cne_applications) as applications_total,
      (SELECT COUNT(*) FROM cne_attendance) as attendance_total
  `).first<any>();
  const sync = await db.prepare(`SELECT MAX(synced_at) as last_synced_at FROM employees`).first<any>();

  const backupStats = await db.prepare(`SELECT status, COUNT(*) as count FROM backup_jobs GROUP BY status`).all<any>();
  const queueCounts: Record<string, number> = { PENDING: 0, BACKED_UP: 0, FAILED_RETRYABLE: 0, FAILED_PERMANENT: 0 };
  for (const r of (backupStats.results || [])) queueCounts[r.status] = Number(r.count || 0);

  let modelName = env.GEMINI_MODEL || 'not configured';
  try { modelName = getApprovedModel(env); } catch { /* show invalid configured value without calling API */ }
  const libraryStats = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM library_documents WHERE active=1) as active_documents,
      (SELECT COUNT(*) FROM library_chunks) as indexed_chunks,
      (SELECT COUNT(*) FROM library_documents WHERE active=1 AND extraction_status='PENDING') as extraction_pending,
      (SELECT COUNT(*) FROM library_documents WHERE active=1 AND extraction_status='FAILED') as extraction_failed
  `).first<any>();

  return {
    system: {
      runtime: 'Cloudflare Worker + D1',
      environment: env.ENVIRONMENT || 'production',
      timestamp: new Date().toISOString()
    },
    database: {
      status: d1Status,
      tables_count: tableCount,
      employees_total: Number(counts?.employees_total || 0),
      cnes_total: Number(counts?.cnes_total || 0),
      applications_total: Number(counts?.applications_total || 0),
      attendance_total: Number(counts?.attendance_total || 0),
      error: d1Error,
      // Compatibility fields
      engine: 'Cloudflare D1',
      total_employees: Number(counts?.employees_total || 0),
      total_cnes: Number(counts?.cnes_total || 0)
    },
    google_integration: {
      configured: Boolean(env.GOOGLE_APPS_SCRIPT_URL && env.GOOGLE_INTEGRATION_SECRET),
      script_url_present: Boolean(env.GOOGLE_APPS_SCRIPT_URL),
      integration_secret_present: Boolean(env.GOOGLE_INTEGRATION_SECRET),
      pending_backup_items: queueCounts.PENDING
    },
    backup_queue: {
      total_pending: queueCounts.PENDING,
      total_backed_up: queueCounts.BACKED_UP,
      failed_retryable: queueCounts.FAILED_RETRYABLE,
      failed_permanent: queueCounts.FAILED_PERMANENT
    },
    officers_sync: {
      last_synced_at: sync?.last_synced_at || null,
      employees_total: Number(counts?.employees_total || 0)
    },
    ai_service: {
      configured: Boolean(env.GEMINI_API_KEY),
      model_name: modelName,
      generation_rule: 'One successful AI generation per CNE; no automatic model fallback'
    },
    institutional_library: {
      active_documents: Number(libraryStats?.active_documents || 0),
      indexed_chunks: Number(libraryStats?.indexed_chunks || 0),
      extraction_pending: Number(libraryStats?.extraction_pending || 0),
      extraction_failed: Number(libraryStats?.extraction_failed || 0)
    }
  };
}
