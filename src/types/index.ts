// ==============================================================================
// CNE MANAGEMENT SYSTEM - TYPES & DATA MODELS
// ==============================================================================

export type UserRole = 'ADMIN' | 'AREA_INCHARGE' | 'EMPLOYEE';

export type NavigationTab =
  | 'home'
  | 'dashboard'
  | 'upcoming_classes'
  | 'calendar'
  | 'my_records'
  | 'my_applications'
  | 'resources'
  | 'admin_cne'
  | 'admin_applications'
  | 'admin_areas'
  | 'admin_roles'
  | 'admin_content'
  | 'admin_reports'
  | 'admin_diagnostics';

export type CneStatus = 'Scheduled' | 'Modified & Scheduled' | 'Completed' | 'Canceled';
export type ApplicationStatus = 'Pending' | 'Approved' | 'Rejected';
export type ParticipantStatus = 'REGISTERED' | 'ATTENDED' | 'ABSENT';
export type AiGenerationStatus = 'NOT_USED' | 'IN_PROGRESS' | 'GENERATED' | 'FAILED';

export interface User {
  employee_id: string;
  name: string;
  designation: string;
  department: string;
  email: string | null;
  phone: string | null;
  status?: string;
  roles: UserRole[];
  isAdmin: boolean;
  isAreaIncharge: boolean;
}

export interface Employee {
  employee_id: string;
  name: string;
  designation: string;
  department: string;
  email: string | null;
  phone: string | null;
  date_of_joining: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'RETIRED' | 'TRANSFERRED';
  synced_at?: string;
  roles?: string[];
  last_login_at?: string;
  attended_cnes_count?: number;
}

export interface Area {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CneResourcePerson {
  id?: string;
  cne_id?: string;
  employee_id: string;
  name?: string;
  employee_name?: string;
  designation?: string;
  department?: string;
  email?: string;
  role_title: string;
  notes?: string;
}

export interface Cne {
  id: string;
  cne_id: string;
  title: string;
  category: string;
  area_id: string;
  area_name?: string;
  area_code?: string;
  venue: string;
  cne_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: CneStatus;
  cancel_reason?: string | null;
  created_by?: string;
  creator_name?: string;
  creator_designation?: string;
  created_at?: string;
  updated_at?: string;
  resource_persons?: CneResourcePerson[];
  applications_count?: number;
  pending_applications_count?: number;
  participants_count?: number;
  participant_count?: number;
  attendance_count?: number;
  resources_count?: number;
  questions_count?: number;
  ai_state?: AiGenerationStatus;
  my_application_status?: ApplicationStatus;
  attended?: boolean;
}

export interface CneApplication {
  id: string;
  cne_id: string;
  cne_code?: string;
  cne_title?: string;
  cne_date?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  cne_status?: CneStatus;
  area_id?: string;
  area_name?: string;
  employee_id: string;
  employee_name?: string;
  designation?: string;
  department?: string;
  email?: string;
  phone?: string;
  status: ApplicationStatus;
  applied_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface CneParticipant {
  id: string;
  cne_id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string;
  department?: string;
  email?: string;
  registered_at: string;
  source: string;
  status: ParticipantStatus;
  attended?: number | boolean;
  attended_at?: string | null;
  test_score?: number | null;
  test_passed?: number | boolean | null;
}

export interface CneAttendance {
  id: string;
  cne_id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string;
  department?: string;
  marked_at: string;
  method: 'QR_SCAN' | 'MANUAL_OFFICER';
  verified_by?: string | null;
  verifier_name?: string | null;
}

export interface CneResource {
  id: string;
  cne_id: string;
  drive_file_id: string;
  file_url?: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  upload_status: 'PENDING' | 'COMPLETED' | 'FAILED';
  extraction_status: 'PENDING' | 'INDEXED' | 'FAILED';
  extraction_error?: string | null;
  extracted_text?: string;
  created_at: string;
  updated_at?: string;
}

export interface LibraryDocument {
  id: string;
  title: string;
  category: string;
  drive_file_id: string;
  file_url?: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  active: number | boolean;
  extraction_status: 'PENDING' | 'INDEXED' | 'FAILED' | string;
  extraction_error?: string | null;
  extracted_text?: string;
  drive_modified_at?: string | null;
  indexed_at: string;
  created_at: string;
}

export interface CneQuestion {
  id: string;
  cne_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  source_reference?: string;
  order_num: number;
  created_by: 'AI_GENERATED' | 'MANUAL_ADMIN';
  created_at?: string;
}

export interface PostTestAttempt {
  id: string;
  cne_id: string;
  employee_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: number | boolean;
  submitted_at: string;
}

export interface ChairpersonContent {
  id?: string;
  name: string;
  designation: string;
  message: string;
  photo_url: string;
  photo_drive_id?: string | null;
  is_published?: number | boolean;
}

export interface CoordinatorContent {
  id?: string;
  name: string;
  title: string;
  message: string;
  is_published?: number | boolean;
}

export interface NewsCircular {
  id: string;
  title: string;
  content: string;
  publication_date: string;
  file_url?: string;
  is_published?: number | boolean;
  display_order?: number;
}

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  is_active?: number | boolean;
  display_order?: number;
}

export interface GalleryItem {
  id: string;
  title: string;
  caption?: string;
  image_url: string;
  drive_file_id?: string | null;
  is_published?: number | boolean;
  display_order?: number;
}

export interface InstitutionalMetric {
  id?: string;
  key: string;
  label: string;
  value: string;
  description?: string;
  display_order?: number;
}

export interface PublicHomeData {
  chairperson: ChairpersonContent | null;
  coordinator: CoordinatorContent | null;
  news: NewsCircular[];
  quick_links: QuickLink[];
  gallery: GalleryItem[];
  institutional: InstitutionalMetric[];
  upcoming_highlights: Cne[];
}

export type BackupJobStatus = 'PENDING' | 'BACKED_UP' | 'FAILED_RETRYABLE' | 'FAILED_PERMANENT';

export interface BackupJob {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  status: BackupJobStatus;
  retry_count: number;
  last_error?: string | null;
  last_attempt_at?: string | null;
  created_at: string;
  backed_up_at?: string | null;
}

export interface AdminDiagnosticsData {
  system: {
    runtime: string;
    environment: string;
    timestamp: string;
  };
  database: {
    status: string;
    tables_count: number;
    employees_total: number;
    cnes_total: number;
    applications_total: number;
    attendance_total: number;
    error: string | null;
  };
  google_integration: {
    configured: boolean;
    script_url_present: boolean;
    integration_secret_present: boolean;
  };
  backup_queue: {
    total_pending: number;
    total_backed_up: number;
    failed_retryable: number;
    failed_permanent: number;
  };
  officers_sync: {
    last_synced_at: string | null;
    employees_total: number;
  };
  ai_service: {
    configured: boolean;
    model_name: string;
    generation_rule: string;
  };
  institutional_library: {
    active_documents: number;
    indexed_chunks: number;
    extraction_pending: number;
    extraction_failed: number;
  };
}
