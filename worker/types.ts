export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  SESSION_SECRET: string;
  PASSWORD_PEPPER: string;
  GOOGLE_APPS_SCRIPT_URL?: string;
  GOOGLE_INTEGRATION_SECRET?: string;
  ALLOWED_ORIGIN?: string;
  DEV_DEMO_SEED?: string;
  ENVIRONMENT?: string;
  BOOTSTRAP_TOKEN?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export type Role = 'ADMIN' | 'AREA_INCHARGE' | 'EMPLOYEE';

export interface AuthenticatedUser {
  employee_id: string;
  name: string;
  designation: string;
  department: string;
  email: string | null;
  phone: string | null;
  status: string;
  roles: Role[];
}

export interface SessionRecord {
  token: string;
  employee_id: string;
  expires_at: string;
  created_at: string;
}

export type BackupJobStatus = 'PENDING' | 'BACKED_UP' | 'FAILED_RETRYABLE' | 'FAILED_PERMANENT';

export interface BackupJob {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  status: BackupJobStatus;
  retry_count: number;
  last_error: string | null;
  last_attempt_at: string | null;
  created_at: string;
  backed_up_at: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}
