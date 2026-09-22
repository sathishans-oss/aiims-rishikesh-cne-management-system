-- ==============================================================================
-- CNE MANAGEMENT SYSTEM - CLOUDFLARE D1 DATABASE SCHEMA
-- Migration: 0001_initial_schema.sql
-- ==============================================================================

-- 1. EMPLOYEES (Synchronized from Institutional Officers Google Sheet)
CREATE TABLE IF NOT EXISTS employees (
  employee_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_joining TEXT NOT NULL, -- Format: YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, RETIRED, TRANSFERRED
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. USERS (Application Authentication & Credentials)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, PENDING_RESET
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. ROLES (Application Access Control)
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'ADMIN', 'AREA_INCHARGE', 'EMPLOYEE'
  description TEXT NOT NULL
);

-- 4. USER ROLES (Role Assignments)
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, role_id)
);

-- 5. AREAS (Hospital Wards / Clinical Units / Academic Blocks)
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. CNES (Core Clinical Nursing Education Sessions)
CREATE TABLE IF NOT EXISTS cnes (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL UNIQUE, -- Human-readable, e.g. CNE-2026-001
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. Clinical Skills, Emergency Care, Infection Control, Oncology, Pediatrics, Critical Care
  area_id TEXT NOT NULL REFERENCES areas(id),
  venue TEXT NOT NULL,
  cne_date TEXT NOT NULL, -- Format: YYYY-MM-DD
  start_time TEXT NOT NULL, -- Format: HH:MM (24h)
  end_time TEXT NOT NULL,   -- Format: HH:MM (24h)
  capacity INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Scheduled', -- 'Scheduled', 'Modified & Scheduled', 'Completed', 'Canceled'
  cancel_reason TEXT,
  created_by TEXT NOT NULL REFERENCES employees(employee_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. CNE RESOURCE PERSONS (Instructors / Facilitators)
CREATE TABLE IF NOT EXISTS cne_resource_persons (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  role_title TEXT NOT NULL DEFAULT 'Primary Speaker', -- Primary Speaker, Co-Speaker, Moderator
  notes TEXT,
  UNIQUE(cne_id, employee_id)
);

-- 8. CNE APPLICATIONS (Nurse Registrations)
CREATE TABLE IF NOT EXISTS cne_applications (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT REFERENCES employees(employee_id),
  reviewed_at TEXT,
  review_notes TEXT,
  UNIQUE(cne_id, employee_id)
);

-- 9. CNE PARTICIPANTS (Confirmed Attendees)
CREATE TABLE IF NOT EXISTS cne_participants (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL DEFAULT 'APPLICATION', -- 'APPLICATION', 'DIRECT_ENROLL', 'ADMIN_ADD'
  status TEXT NOT NULL DEFAULT 'REGISTERED', -- 'REGISTERED', 'ATTENDED', 'ABSENT'
  UNIQUE(cne_id, employee_id)
);

-- 10. CNE ATTENDANCE (Verified Attendance Records)
CREATE TABLE IF NOT EXISTS cne_attendance (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  marked_at TEXT NOT NULL DEFAULT (datetime('now')),
  method TEXT NOT NULL DEFAULT 'QR_SCAN', -- 'QR_SCAN', 'MANUAL_OFFICER'
  verified_by TEXT REFERENCES employees(employee_id),
  UNIQUE(cne_id, employee_id)
);

-- 11. CNE RESOURCES (Uploaded Educational Materials for Specific CNE)
CREATE TABLE IF NOT EXISTS cne_resources (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_url TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'COMPLETED', 'FAILED'
  extraction_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'INDEXED', 'FAILED'
  extraction_error TEXT,
  extracted_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. LIBRARY DOCUMENTS (Centralized Institutional Reference Library)
CREATE TABLE IF NOT EXISTS library_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Standard Operating Procedure',
  drive_file_id TEXT NOT NULL,
  file_url TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  extraction_status TEXT NOT NULL DEFAULT 'PENDING',
  extraction_error TEXT,
  extracted_text TEXT,
  drive_modified_at TEXT,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. LIBRARY CHUNKS (Indexed Knowledge Chunks for AI Retrieval)
CREATE TABLE IF NOT EXISTS library_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES library_documents(id) ON DELETE CASCADE,
  resource_id TEXT REFERENCES cne_resources(id) ON DELETE CASCADE,
  cne_id TEXT REFERENCES cnes(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. CNE QUESTIONS (Post-Test MCQs)
CREATE TABLE IF NOT EXISTS cne_questions (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
  explanation TEXT,
  source_reference TEXT,
  order_num INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL, -- 'AI_GENERATED', 'MANUAL_ADMIN'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. AI GENERATION STATE (Strict 1-Generation State Machine per CNE)
CREATE TABLE IF NOT EXISTS ai_generation_state (
  cne_id TEXT PRIMARY KEY REFERENCES cnes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_USED', -- 'NOT_USED', 'IN_PROGRESS', 'GENERATED', 'FAILED'
  model_used TEXT,
  evidence_source TEXT, -- 'CNE_SPECIFIC', 'LIBRARY_FALLBACK', 'NONE'
  prompt_summary TEXT,
  error_message TEXT,
  generated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. POST TEST ATTEMPTS (Employee Test Submissions)
CREATE TABLE IF NOT EXISTS post_test_attempts (
  id TEXT PRIMARY KEY,
  cne_id TEXT NOT NULL REFERENCES cnes(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  percentage REAL NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0, -- 1 if >= 60%
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cne_id, employee_id)
);

-- 17. POST TEST ANSWERS (Item-level Responses)
CREATE TABLE IF NOT EXISTS post_test_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES post_test_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES cne_questions(id),
  selected_option TEXT NOT NULL,
  is_correct INTEGER NOT NULL
);

-- 18. GALLERY ITEMS (Public Home Page Showcase)
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT,
  drive_file_id TEXT,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 19. NEWS & CIRCULARS (Public Home Page)
CREATE TABLE IF NOT EXISTS news_circulars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  file_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 20. QUICK LINKS (Public Home Page)
CREATE TABLE IF NOT EXISTS quick_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 21. CHAIRPERSON CONTENT (Public Home Page)
CREATE TABLE IF NOT EXISTS chairperson_content (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  message TEXT NOT NULL,
  photo_drive_id TEXT,
  photo_url TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 22. COORDINATOR CONTENT (Public Home Page)
CREATE TABLE IF NOT EXISTS coordinator_content (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 23. INSTITUTIONAL CONTENT / DATA IMPACT (Public Home Page Statistics)
CREATE TABLE IF NOT EXISTS institutional_content (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 24. BACKUP JOBS (Google Sheets Backup Queue)
CREATE TABLE IF NOT EXISTS backup_jobs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  payload TEXT NOT NULL, -- JSON serialized data
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'BACKED_UP', 'FAILED_RETRYABLE', 'FAILED_PERMANENT'
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  backed_up_at TEXT
);

-- 25. AUDIT LOG (Security & Administrative Event History)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 26. SESSIONS (Secure Authentication Tokens)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 27. RESET TOKENS (Forgot Password Token)
CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 28. AUTH RATE LIMITS (Durable authentication throttling)
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  blocked_until TEXT
);

-- 29. AREA IN-CHARGE ASSIGNMENTS (Scope AREA_INCHARGE permissions)
CREATE TABLE IF NOT EXISTS area_incharge_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  area_id TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  assigned_by TEXT REFERENCES employees(employee_id),
  UNIQUE(employee_id, area_id)
);

-- 30. SYSTEM STATE (One-time bootstrap claim and durable global flags)
CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 31. CNE HUMAN ID SEQUENCES (Atomic yearly sequence)
CREATE TABLE IF NOT EXISTS cne_sequences (
  year INTEGER PRIMARY KEY,
  next_value INTEGER NOT NULL
);

-- Seed only application roles. No fake employees or passwords are seeded.
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('ROLE_ADMIN', 'ADMIN', 'Full institutional administrator'),
  ('ROLE_AREA_INCHARGE', 'AREA_INCHARGE', 'Area-scoped CNE coordinator/in-charge'),
  ('ROLE_EMPLOYEE', 'EMPLOYEE', 'Authenticated institutional employee');


-- Database-level participant-capacity guard to protect concurrent approvals/direct enrollment.
CREATE TRIGGER IF NOT EXISTS trg_cne_participant_capacity
BEFORE INSERT ON cne_participants
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM cne_participants WHERE cne_id = NEW.cne_id) >=
     (SELECT capacity FROM cnes WHERE id = NEW.cne_id)
BEGIN
  SELECT RAISE(ABORT, 'CNE participant capacity reached');
END;

-- INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_cnes_date ON cnes(cne_date);
CREATE INDEX IF NOT EXISTS idx_cnes_status ON cnes(status);
CREATE INDEX IF NOT EXISTS idx_cnes_area ON cnes(area_id);
CREATE INDEX IF NOT EXISTS idx_cne_apps_cne ON cne_applications(cne_id);
CREATE INDEX IF NOT EXISTS idx_cne_apps_emp ON cne_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_cne_part_cne ON cne_participants(cne_id);
CREATE INDEX IF NOT EXISTS idx_cne_part_emp ON cne_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_cne_att_cne ON cne_attendance(cne_id);
CREATE INDEX IF NOT EXISTS idx_cne_att_emp ON cne_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_chunks_cne ON library_chunks(cne_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON library_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_resource ON library_chunks(resource_id);
CREATE INDEX IF NOT EXISTS idx_questions_cne ON cne_questions(cne_id);
CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sessions_emp ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_area_incharge_emp ON area_incharge_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_area_incharge_area ON area_incharge_assignments(area_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked ON auth_rate_limits(blocked_until);
