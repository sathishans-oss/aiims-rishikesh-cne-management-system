import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE_PATH = path.resolve(process.cwd(), 'cne_d1.sqlite');
const MIGRATION_PATH = path.resolve(process.cwd(), 'migrations', '0001_initial_schema.sql');

let sqlDb: Database | null = null;

// Helper to hash password with salt and pepper
export function hashPassword(password: string, salt: string): string {
  const pepper = process.env.PASSWORD_PEPPER || 'development-only-ephemeral-pepper';
  return crypto.createHash('sha256').update(`${password}:${salt}:${pepper}`).digest('hex');
}

// Convert params to sql.js format
function sanitizeParam(param: any): any {
  if (param === undefined || param === null) return null;
  if (typeof param === 'boolean') return param ? 1 : 0;
  return param;
}

// D1-compatible statement interface
export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<{ results: T[]; success: boolean }>;
  first<T = any>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number; last_row_id: number } }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<{ count: number; duration: number }>;
  save(): void;
}

class SqlJsPreparedStatement implements D1PreparedStatement {
  private query: string;
  private params: any[] = [];
  private db: Database;
  private onMutate: () => void;

  constructor(query: string, db: Database, onMutate: () => void) {
    this.query = query;
    this.db = db;
    this.onMutate = onMutate;
  }

  bind(...values: any[]): D1PreparedStatement {
    this.params = values.map(sanitizeParam);
    return this;
  }

  async all<T = any>(): Promise<{ results: T[]; success: boolean }> {
    try {
      const stmt = this.db.prepare(this.query);
      if (this.params.length > 0) {
        stmt.bind(this.params);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      stmt.free();
      return { results, success: true };
    } catch (err: any) {
      console.error('SQL all() error:', err.message, 'Query:', this.query, 'Params:', this.params);
      throw err;
    }
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    try {
      const stmt = this.db.prepare(this.query);
      if (this.params.length > 0) {
        stmt.bind(this.params);
      }
      let result: any = null;
      if (stmt.step()) {
        const row = stmt.getAsObject();
        if (colName) {
          result = (row as any)[colName] ?? null;
        } else {
          result = row as T;
        }
      }
      stmt.free();
      return result;
    } catch (err: any) {
      console.error('SQL first() error:', err.message, 'Query:', this.query);
      throw err;
    }
  }

  async run(): Promise<{ success: boolean; meta?: { changes: number; last_row_id: number } }> {
    try {
      const stmt = this.db.prepare(this.query);
      if (this.params.length > 0) {
        stmt.bind(this.params);
      }
      stmt.step();
      stmt.free();

      // Trigger disk persist
      this.onMutate();

      return {
        success: true,
        meta: {
          changes: this.db.getRowsModified(),
          last_row_id: 0
        }
      };
    } catch (err: any) {
      console.error('SQL run() error:', err.message, 'Query:', this.query, 'Params:', this.params);
      throw err;
    }
  }
}

export class D1DatabaseWrapper implements D1DatabaseLike {
  private db: Database;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(db: Database) {
    this.db = db;
  }

  prepare(query: string): D1PreparedStatement {
    return new SqlJsPreparedStatement(query, this.db, () => this.scheduleSave());
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const start = Date.now();
    this.db.exec(query);
    this.save();
    return { count: 1, duration: Date.now() - start };
  }

  save(): void {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE_PATH, buffer);
    } catch (e) {
      console.error('Failed to save SQLite DB file:', e);
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.save();
    }, 100);
  }
}

let dbInstance: D1DatabaseWrapper | null = null;

export async function getDb(): Promise<D1DatabaseWrapper> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      sqlDb = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh database...', e);
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  dbInstance = new D1DatabaseWrapper(sqlDb);

  // Apply migrations if tables don't exist yet
  await ensureSchema(dbInstance);

  return dbInstance;
}

async function ensureSchema(db: D1DatabaseWrapper) {
  // Check if roles table exists
  const check = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'").first();
  if (!check) {
    console.log('Initializing D1 SQLite schema from migrations...');
    if (fs.existsSync(MIGRATION_PATH)) {
      const schemaSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
      await db.exec(schemaSql);
      console.log('Schema created successfully.');
      await seedInitialData(db);
    } else {
      console.error('Migration file not found at:', MIGRATION_PATH);
    }
  } else {
    const areaCheck = await db.prepare("SELECT count(*) as count FROM areas").first<{ count: number }>();
    if (!areaCheck || areaCheck.count === 0) {
      console.log('Seeding initial data into empty areas/roles tables...');
      await seedInitialData(db);
    }
  }
}

async function seedInitialData(db: D1DatabaseWrapper) {
  console.log('Seeding initial institutional data into D1...');

  // 1. Roles
  const roles = [
    { id: 'ROLE_ADMIN', name: 'ADMIN', description: 'Full administrative control over CNE system, masters, reports, and content' },
    { id: 'ROLE_AREA_INCHARGE', name: 'AREA_INCHARGE', description: 'Area / Ward nursing supervisor with approval and CNE coordination rights' },
    { id: 'ROLE_EMPLOYEE', name: 'EMPLOYEE', description: 'Clinical nursing staff with class attendance and self-service capabilities' }
  ];

  for (const r of roles) {
    await db.prepare('INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)').bind(r.id, r.name, r.description).run();
  }

  // 2. Areas / Clinical Wards
  const areas = [
    { id: 'AREA_ICU', name: 'Intensive Care Unit (ICU)', code: 'ICU-MAIN', description: 'Multi-specialty adult intensive care complex' },
    { id: 'AREA_EMERGENCY', name: 'Emergency & Trauma Centre', code: 'EMR-TRM', description: 'Triage, acute resuscitation, and emergency nursing' },
    { id: 'AREA_OT', name: 'Operation Theatre Complex', code: 'OT-CMPLX', description: 'Main surgical suites and post-anesthesia recovery' },
    { id: 'AREA_PEDIATRIC', name: 'Pediatric & Neonatal Wards', code: 'PED-NICU', description: 'NICU, PICU, and general pediatric inpatient unit' },
    { id: 'AREA_ONCOLOGY', name: 'Oncology Day Care & Ward', code: 'ONC-DAY', description: 'Chemotherapy infusion, oncology medical/surgical care' },
    { id: 'AREA_CARDIAC', name: 'Cardiac Care Unit (CCU)', code: 'CARD-CCU', description: 'Coronary care unit, cath lab, and cardiology step-down' },
    { id: 'AREA_NEPHRO', name: 'Dialysis & Nephrology Unit', code: 'NEPH-DIAL', description: 'Hemodialysis, peritoneal dialysis, and nephrology inpatient' },
    { id: 'AREA_MEDICINE', name: 'General Medicine Wards', code: 'MED-INPAT', description: 'Inpatient medical wards and subspecialty bays' }
  ];

  for (const a of areas) {
    await db.prepare('INSERT OR IGNORE INTO areas (id, name, code, description, active) VALUES (?, ?, ?, ?, 1)').bind(a.id, a.name, a.code, a.description).run();
  }

  // 3. Neutral Institutional Leadership & Coordinator Content
  await db.prepare(`
    INSERT OR IGNORE INTO chairperson_content (id, name, designation, message, photo_drive_id, photo_url, is_published)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).bind(
    'CHAIR_01',
    'Chairperson, Nursing Education Committee',
    'Nursing Education Committee',
    'Welcome to the Clinical Nursing Education (CNE) portal. Lifelong nursing education is the cornerstone of patient safety, clinical precision, and institutional excellence. We encourage every nursing officer to participate actively in scheduled modular training programs, enhance hands-on competencies, and uphold the highest standards of evidence-based nursing care.',
    null,
    null
  ).run();

  await db.prepare(`
    INSERT OR IGNORE INTO coordinator_content (id, name, title, message, is_published)
    VALUES (?, ?, ?, ?, 1)
  `).bind(
    'COORD_01',
    'Coordinator, CNE Cell',
    'Coordinator, Clinical Nursing Education Cell',
    'The CNE Cell organizes certified competency modules across trauma management, critical care ventilator protocols, infection prevention bundles, and pharmacovigilance. Registration closes 24 hours prior to class commencement. Ensure QR attendance check-in at the venue for credit certification.'
  ).run();

  // 4. Demo Seed Guard (STRICT: only populated when DEV_DEMO_SEED=true and NOT in production)
  const isDevDemoSeed = process.env.DEV_DEMO_SEED === 'true' && process.env.ENVIRONMENT !== 'production' && process.env.NODE_ENV !== 'production';

  if (isDevDemoSeed) {
    console.log('DEV_DEMO_SEED=true: Seeding demo employees and test accounts...');
    const defaultEmployees = [
      {
        id: 'EMP001',
        name: 'Demo Administrator',
        designation: 'Chief Nursing Officer & CNE Chairperson',
        department: 'Nursing Administration',
        email: 'admin.cne@aiimsrishikesh.edu.in',
        phone: '+91-135-2462901',
        doj: '2015-08-10'
      },
      {
        id: 'EMP002',
        name: 'Demo Area Incharge',
        designation: 'Assistant Nursing Superintendent & In-Charge',
        department: 'Critical Care Nursing',
        email: 'incharge.icu@aiimsrishikesh.edu.in',
        phone: '+91-135-2462902',
        doj: '2017-03-15'
      },
      {
        id: 'EMP003',
        name: 'Demo Staff Nurse A',
        designation: 'Senior Nursing Officer',
        department: 'Emergency & Trauma Care',
        email: 'staff.a@aiimsrishikesh.edu.in',
        phone: '+91-135-2462903',
        doj: '2019-06-20'
      },
      {
        id: 'EMP004',
        name: 'Demo Staff Nurse B',
        designation: 'Nursing Officer',
        department: 'Operation Theatre Complex',
        email: 'staff.b@aiimsrishikesh.edu.in',
        phone: '+91-135-2462904',
        doj: '2021-11-01'
      },
      {
        id: 'EMP005',
        name: 'Demo Staff Nurse C',
        designation: 'Nursing Officer',
        department: 'Pediatric Care Unit',
        email: 'staff.c@aiimsrishikesh.edu.in',
        phone: '+91-135-2462905',
        doj: '2022-02-14'
      }
    ];

    for (const emp of defaultEmployees) {
      await db.prepare(`
        INSERT OR IGNORE INTO employees (employee_id, name, designation, department, email, phone, date_of_joining, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).bind(emp.id, emp.name, emp.designation, emp.department, emp.email, emp.phone, emp.doj).run();

      const salt = Buffer.from(crypto.randomBytes(16)).toString('hex');
      const defaultPassword = emp.id === 'EMP001' ? process.env.DEV_ADMIN_PASSWORD : process.env.DEV_EMPLOYEE_PASSWORD;
      if (!defaultPassword) throw new Error('DEV_DEMO_SEED requires DEV_ADMIN_PASSWORD and DEV_EMPLOYEE_PASSWORD.');
      const pwdHash = hashPassword(defaultPassword, salt);

      await db.prepare(`
        INSERT INTO users (id, employee_id, password_hash, salt, status)
        VALUES (?, ?, ?, ?, 'ACTIVE')
        ON CONFLICT(employee_id) DO UPDATE SET
          password_hash = excluded.password_hash,
          salt = excluded.salt
      `).bind('USR_' + emp.id, emp.id, pwdHash, salt).run();
    }

    await db.prepare('INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').bind('UR_001', 'EMP001', 'ROLE_ADMIN', 'SYSTEM').run();
    await db.prepare('INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').bind('UR_002', 'EMP002', 'ROLE_AREA_INCHARGE', 'SYSTEM').run();
    await db.prepare('INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').bind('UR_003', 'EMP003', 'ROLE_EMPLOYEE', 'SYSTEM').run();
    await db.prepare('INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').bind('UR_004', 'EMP004', 'ROLE_EMPLOYEE', 'SYSTEM').run();
    await db.prepare('INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').bind('UR_005', 'EMP005', 'ROLE_EMPLOYEE', 'SYSTEM').run();
  } else {
    console.log('DEV_DEMO_SEED is OFF (default). Demo employees and passwords omitted for production security.');
  }

  // 7. News & Circulars
  const circulars = [
    {
      id: 'CIRC_01',
      title: 'Mandatory CNE: Advanced Resuscitation & High-Acuity Defibrillation Protocols',
      content: 'All ICU, Emergency, and Step-Down Nursing Officers are mandated to complete the Hands-on Resuscitation Module scheduled for this academic quarter. Pre-reading resources are available in the CNE Library.',
      pubDate: '2026-09-15',
      order: 1
    },
    {
      id: 'CIRC_02',
      title: 'Updated Hospital Infection Control (HIC) Bundles & Catheter-Associated UTI Prevention',
      content: 'Clinical audit guidelines have been revised in accordance with National Quality Assurance Standards. Please review the updated SOP document under the institutional repository.',
      pubDate: '2026-09-10',
      order: 2
    },
    {
      id: 'CIRC_03',
      title: 'Institutional Nursing Research & Clinical Audit Grant Notifications',
      content: 'Applications are invited from Nursing Officers for hospital clinical research mini-grants. Project proposals must be submitted through the Departmental Research Review Board.',
      pubDate: '2026-09-02',
      order: 3
    }
  ];

  for (const c of circulars) {
    await db.prepare(`
      INSERT OR IGNORE INTO news_circulars (id, title, content, publication_date, is_published, display_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `).bind(c.id, c.title, c.content, c.pubDate, c.order).run();
  }

  // 8. Quick Links
  const quickLinks = [
    { id: 'QL_01', title: 'Institutional Portal & Intranet', url: 'https://aiimsrishikesh.edu.in', order: 1 },
    { id: 'QL_02', title: 'Hospital Infection Control Guidelines', url: 'https://aiimsrishikesh.edu.in/hic', order: 2 },
    { id: 'QL_03', title: 'Indian Nursing Council CNE Credit Guidelines', url: 'https://indiannursingcouncil.org', order: 3 },
    { id: 'QL_04', title: 'WHO Patient Safety Curriculum', url: 'https://www.who.int/teams/integrated-health-services/patient-safety', order: 4 }
  ];

  for (const ql of quickLinks) {
    await db.prepare('INSERT OR IGNORE INTO quick_links (id, title, url, is_active, display_order) VALUES (?, ?, ?, 1, ?)').bind(ql.id, ql.title, ql.url, ql.order).run();
  }

  // 9. Institutional Impact Metrics
  const stats = [
    { id: 'STAT_01', key: 'CNE_HOURS', label: 'CNE Hours Delivered', value: '1,420+', desc: 'Certified clinical education hours this year', order: 1 },
    { id: 'STAT_02', key: 'OFFICERS_TRAINED', label: 'Nursing Officers Trained', value: '860+', desc: 'Active clinical staff completed modules', order: 2 },
    { id: 'STAT_03', key: 'MODULES_CONDUCTED', label: 'Workshops & Modules', value: '74', desc: 'Accredited skill sessions & masterclasses', order: 3 },
    { id: 'STAT_04', key: 'POST_TEST_PASS_RATE', label: 'Average Competency Pass Rate', value: '94.6%', desc: 'Objective post-test benchmark standard', order: 4 }
  ];

  for (const s of stats) {
    await db.prepare(`
      INSERT OR IGNORE INTO institutional_content (id, key, label, value, description, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s.id, s.key, s.label, s.value, s.desc, s.order).run();
  }

  // 10. Gallery Highlights
  const gallery = [
    {
      id: 'GAL_01',
      title: 'Advanced Mechanical Ventilation Skill Simulation',
      caption: 'Nursing officers mastering lung-protective ventilatory modes and alarm troubleshooting at the Clinical Simulation Laboratory.',
      driveId: 'DRIVE_IMG_001',
      url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800',
      order: 1
    },
    {
      id: 'GAL_02',
      title: 'Code Blue Resuscitation & Defibrillation Drill',
      caption: 'Multi-disciplinary emergency airway and high-quality CPR practice conducted by the Trauma Nursing Team.',
      driveId: 'DRIVE_IMG_002',
      url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800',
      order: 2
    },
    {
      id: 'GAL_03',
      title: 'Sterile Barrier & Infection Prevention Workshop',
      caption: 'Hospital Infection Control Cell demonstrating central line insertion site care and aseptic dressing changes.',
      driveId: 'DRIVE_IMG_003',
      url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800',
      order: 3
    }
  ];

  for (const g of gallery) {
    await db.prepare(`
      INSERT OR IGNORE INTO gallery_items (id, title, caption, drive_file_id, image_url, display_order, is_published)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(g.id, g.title, g.caption, g.driveId, g.url, g.order).run();
  }

  // 11. Initial Sample CNEs (Scheduled, Modified & Scheduled, Completed) - ONLY if DEV_DEMO_SEED=true
  if (isDevDemoSeed) {
    const sampleCnes = [
      {
        id: 'CNE_REC_001',
        cne_id: 'CNE-2026-001',
        title: 'Advanced Hemodynamic Monitoring & Arterial Line Management',
        category: 'Critical Care',
        area_id: 'AREA_ICU',
        venue: 'Auditorium 2, Academic Block B',
        date: '2026-09-24',
        start: '14:00',
        end: '16:30',
        capacity: 35,
        status: 'Scheduled',
        created_by: 'EMP001'
      },
      {
        id: 'CNE_REC_002',
        cne_id: 'CNE-2026-002',
        title: 'Pediatric Peripheral Venous Access & Safe Dose Calculations',
        category: 'Pediatrics',
        area_id: 'AREA_PEDIATRIC',
        venue: 'Skill Lab 3, Neonatal Wing',
        date: '2026-09-26',
        start: '10:00',
        end: '12:00',
        capacity: 25,
        status: 'Modified & Scheduled',
        created_by: 'EMP002'
      },
      {
        id: 'CNE_REC_003',
        cne_id: 'CNE-2026-003',
        title: 'Chemotherapy Extravasation Management & Safe Handling',
        category: 'Oncology',
        area_id: 'AREA_ONCOLOGY',
        venue: 'Seminar Hall, Oncology Centre',
        date: '2026-09-29',
        start: '15:00',
        end: '17:00',
        capacity: 30,
        status: 'Scheduled',
        created_by: 'EMP001'
      },
      {
        id: 'CNE_REC_004',
        cne_id: 'CNE-2026-004',
        title: 'Basic Life Support (BLS) & Rapid Triage Systems',
        category: 'Emergency Care',
        area_id: 'AREA_EMERGENCY',
        venue: 'Trauma Conference Room',
        date: '2026-09-12',
        start: '09:00',
        end: '12:00',
        capacity: 40,
        status: 'Completed',
        created_by: 'EMP001'
      }
    ];

    for (const c of sampleCnes) {
      await db.prepare(`
        INSERT OR IGNORE INTO cnes (id, cne_id, title, category, area_id, venue, cne_date, start_time, end_time, capacity, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(c.id, c.cne_id, c.title, c.category, c.area_id, c.venue, c.date, c.start, c.end, c.capacity, c.status, c.created_by).run();

      // Assign resource person
      await db.prepare('INSERT OR IGNORE INTO cne_resource_persons (id, cne_id, employee_id, role_title) VALUES (?, ?, ?, ?)').bind('RP_' + c.id, c.id, 'EMP002', 'Lead Clinical Instructor').run();

      // Initialize AI Generation state
      await db.prepare('INSERT OR IGNORE INTO ai_generation_state (cne_id, status) VALUES (?, ?)').bind(c.id, 'NOT_USED').run();
    }

  // 12. CNE Specific Materials & Central Library Reference Documents
  const libraryDocs = [
    {
      id: 'DOC_001',
      title: 'Institutional Clinical Guidelines for Invasive Arterial Blood Pressure Monitoring',
      category: 'Critical Care Protocol',
      driveId: 'DRIVE_DOC_ART_LINE_01',
      filename: 'SOP-ICU-Arterial-Monitoring-2026.pdf',
      mime: 'application/pdf',
      size: 1420500,
      text: `CLINICAL PRACTICE GUIDELINE: ARTERIAL LINE MANAGEMENT
1. Indications: Continuous arterial blood pressure monitoring, frequent arterial blood gas (ABG) sampling, titration of vasoactive infusions.
2. Cannulation Sites: Radial artery is first choice (requires Allen test verification). Femoral, brachial, and dorsalis pedis are secondary options.
3. Transducer Setup: Zeroing is performed at the phlebostatic axis (fourth intercostal space, mid-axillary line). Flush bag must be pressurized to 300 mmHg with 0.9% normal saline.
4. Square Wave Test (Dynamic Response): Performed every shift. Overdamped trace underestimates systolic, underdamped trace overestimates systolic pressure.
5. Complications: Distal ischemia, arterial thrombosis, catheter-related bloodstream infection, hematoma, air embolism. Strict aseptic technique during insertion and dressing maintenance every 7 days or when soiled.`
    },
    {
      id: 'DOC_002',
      title: 'Hospital Infection Control Guidelines for Central Venous Access and Bundle Care',
      category: 'Infection Control',
      driveId: 'DRIVE_DOC_HIC_CVL_02',
      filename: 'HIC-Central-Line-Bundle-2026.pdf',
      mime: 'application/pdf',
      size: 2150000,
      text: `CENTRAL LINE-ASSOCIATED BLOODSTREAM INFECTION (CLABSI) PREVENTION BUNDLE
1. Hand hygiene prior to insertion and catheter manipulation.
2. Maximal sterile barrier precautions: Cap, mask, sterile gown, sterile gloves, and large full-body drape.
3. Chlorhexidine skin antisepsis: >0.5% chlorhexidine gluconate in 70% isopropyl alcohol; allowed to dry completely before puncture.
4. Optimal catheter site selection: Subclavian is preferred over internal jugular and femoral for non-tunneled catheters in adults to minimize infection risk.
5. Daily review of line necessity with prompt removal when no longer essential.
6. Hub scrub: Clean access hubs for minimum 15 seconds with 70% alcohol and allow to air dry.`
    }
  ];

  for (const doc of libraryDocs) {
    await db.prepare(`
      INSERT OR IGNORE INTO library_documents (id, title, category, drive_file_id, filename, mime_type, file_size, active, extraction_status, extracted_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'INDEXED', ?)
    `).bind(doc.id, doc.title, doc.category, doc.driveId, doc.filename, doc.mime, doc.size, doc.text).run();

    // Create searchable chunks
    await db.prepare(`
      INSERT OR IGNORE INTO library_chunks (id, document_id, chunk_index, content, token_estimate)
      VALUES (?, ?, 1, ?, 180)
    `).bind('CHUNK_' + doc.id, doc.id, doc.text).run();
  }

  // Upload specific learning resource for CNE-2026-001
  await db.prepare(`
    INSERT OR IGNORE INTO cne_resources (id, cne_id, drive_file_id, filename, mime_type, file_size, upload_status, extraction_status, extracted_text)
    VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', 'INDEXED', ?)
  `).bind(
    'RES_CNE_001',
    'CNE_REC_001',
    'DRIVE_RES_HEMO_001',
    'CNE-001-Hemodynamic-Monitoring-Handout.pdf',
    'application/pdf',
    892000,
    `CNE-2026-001 SPECIFIC TRAINING MATERIAL:
Arterial Line Leveling: The transducer must be leveled precisely at the phlebostatic axis, which is defined as the junction of the 4th intercostal space and the mid-anteroposterior diameter of the chest.
Zeroing Procedure: Open stopcock to air (atmospheric pressure), press zero button on monitor, verify zero reading, close stopcock to atmospheric air and open to patient line.
Square Wave Test: Fast flush produces a sharp vertical step, followed by 1-2 rapid oscillations before returning to arterial wave.
Complication Prevention: Check 5 Ps (pain, pallor, pulselessness, paresthesia, paralysis) for distal extremity perfusion every 2 hours.`
  ).run();

  // Index chunk for CNE_REC_001
  await db.prepare(`
    INSERT OR IGNORE INTO library_chunks (id, cne_id, chunk_index, content, token_estimate)
    VALUES (?, ?, 1, ?, 150)
  `).bind(
    'CHUNK_CNE_001',
    'CNE_REC_001',
    'Arterial Line Leveling: Transducer leveled at phlebostatic axis (4th ICS mid-chest). Zeroing to atmospheric pressure. Fast flush square wave test checks dynamic response. Assess distal circulation and Allen test prior to puncture.'
  ).run();

  // Sample questions for CNE-2026-004 (Completed CNE)
  const q1 = {
    id: 'Q_004_1',
    cne_id: 'CNE_REC_004',
    text: 'What is the recommended compression-to-ventilation ratio for adult CPR by a single rescuer according to standard BLS guidelines?',
    a: '15:2',
    b: '30:2',
    c: '50:2',
    d: 'Continuous compressions only',
    correct: 'B',
    exp: 'Standard adult basic life support dictates 30 chest compressions followed by 2 rescue breaths.',
    ref: 'AHA/ERC BLS Guidelines',
    order: 1
  };
  await db.prepare(`
    INSERT OR IGNORE INTO cne_questions (id, cne_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source_reference, order_num, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_ADMIN')
  `).bind(q1.id, q1.cne_id, q1.text, q1.a, q1.b, q1.c, q1.d, q1.correct, q1.exp, q1.ref, q1.order).run();

  // Completed attendance & post test attempt for EMP003 in CNE_REC_004
  await db.prepare(`
    INSERT OR IGNORE INTO cne_participants (id, cne_id, employee_id, registered_at, source, status)
    VALUES (?, ?, ?, datetime('now', '-7 days'), 'APPLICATION', 'ATTENDED')
  `).bind('PART_004_EMP003', 'CNE_REC_004', 'EMP003').run();

  await db.prepare(`
    INSERT OR IGNORE INTO cne_attendance (id, cne_id, employee_id, marked_at, method, verified_by)
    VALUES (?, ?, ?, datetime('now', '-7 days'), 'QR_SCAN', 'EMP001')
  `).bind('ATT_004_EMP003', 'CNE_REC_004', 'EMP003').run();

  await db.prepare(`
    INSERT OR IGNORE INTO post_test_attempts (id, cne_id, employee_id, score, max_score, percentage, passed, submitted_at)
    VALUES (?, ?, ?, 1, 1, 100.0, 1, datetime('now', '-7 days'))
  `).bind('ATTEMPT_004_EMP003', 'CNE_REC_004', 'EMP003').run();
  }

  // Save to disk
  db.save();
  console.log('Institutional seed data populated successfully.');
}
