import { AuthenticatedUser } from '../types';

export async function getUserDashboard(db: D1Database, user: AuthenticatedUser): Promise<any> {
  const empId = user.employee_id;

  const attCount = await db.prepare('SELECT COUNT(*) as count FROM cne_attendance WHERE employee_id = ?').bind(empId).first<any>();
  const appCount = await db.prepare('SELECT COUNT(*) as count FROM cne_applications WHERE employee_id = ?').bind(empId).first<any>();
  const testStats = await db.prepare(`
    SELECT COUNT(*) as total_attempts,
           SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as total_passed,
           AVG(percentage) as avg_score
    FROM post_test_attempts WHERE employee_id = ?
  `).bind(empId).first<any>();

  const upcoming = await db.prepare(`
    SELECT c.id, c.cne_id, c.title, c.category, c.status, c.cne_date, c.start_time, c.end_time, c.venue,
           c.capacity, c.area_id, a.name as area_name,
           (SELECT COUNT(*) FROM cne_participants cp2 WHERE cp2.cne_id = c.id) as participants_count
    FROM cne_participants cp
    JOIN cnes c ON cp.cne_id = c.id
    JOIN areas a ON c.area_id = a.id
    WHERE cp.employee_id = ? AND c.cne_date >= date('now') AND c.status IN ('Scheduled', 'Modified & Scheduled')
    ORDER BY c.cne_date ASC, c.start_time ASC LIMIT 5
  `).bind(empId).all<any>();

  const recentAttended = await db.prepare(`
    SELECT c.id, c.cne_id, c.title, c.cne_date, a.name as area_name,
           pta.percentage, pta.passed
    FROM cne_attendance ca
    JOIN cnes c ON ca.cne_id = c.id
    JOIN areas a ON c.area_id = a.id
    LEFT JOIN post_test_attempts pta ON pta.cne_id = c.id AND pta.employee_id = ca.employee_id
    WHERE ca.employee_id = ?
    ORDER BY c.cne_date DESC, ca.marked_at DESC LIMIT 5
  `).bind(empId).all<any>();

  const pendingApps = await db.prepare(`
    SELECT ca.id, ca.cne_id, c.title as cne_title, ca.applied_at
    FROM cne_applications ca JOIN cnes c ON ca.cne_id = c.id
    WHERE ca.employee_id = ? AND ca.status = 'Pending'
    ORDER BY ca.applied_at DESC LIMIT 10
  `).bind(empId).all<any>();

  const metrics = {
    cne_attended_count: Number(attCount?.count || 0),
    applications_submitted: Number(appCount?.count || 0),
    post_tests_completed: Number(testStats?.total_attempts || 0),
    post_tests_passed: Number(testStats?.total_passed || 0),
    average_competency_score: testStats?.avg_score ? Math.round(Number(testStats.avg_score) * 10) / 10 : 0
  };

  return {
    employee: {
      employee_id: user.employee_id,
      name: user.name,
      designation: user.designation,
      department: user.department
    },
    metrics,
    // Compatibility keys consumed by the current UI.
    attended_count: metrics.cne_attended_count,
    applications_count: metrics.applications_submitted,
    passed_tests_count: metrics.post_tests_passed,
    upcoming_classes: upcoming.results || [],
    upcoming_enrolled_cnes: upcoming.results || [],
    recent_attended: recentAttended.results || [],
    pending_applications: pendingApps.results || []
  };
}

export async function getMyCneRecords(db: D1Database, user: AuthenticatedUser, search?: string): Promise<any[]> {
  let query = `
    SELECT c.id as cne_id, c.cne_id as cne_code, c.title, c.category, c.cne_date, c.start_time, c.end_time,
           c.venue, c.status, a.name as area_name, ca.marked_at as attended_at, ca.method as attendance_method,
           pta.score, pta.max_score, pta.percentage, pta.passed, pta.submitted_at as test_submitted_at
    FROM cne_attendance ca
    JOIN cnes c ON ca.cne_id = c.id
    JOIN areas a ON c.area_id = a.id
    LEFT JOIN post_test_attempts pta ON pta.cne_id = c.id AND pta.employee_id = ca.employee_id
    WHERE ca.employee_id = ?
  `;
  const binds: any[] = [user.employee_id];
  if (search) {
    query += ' AND (c.title LIKE ? OR c.cne_id LIKE ? OR a.name LIKE ?)';
    const term = `%${search}%`;
    binds.push(term, term, term);
  }
  query += ' ORDER BY c.cne_date DESC, c.start_time DESC';
  const rows = await db.prepare(query).bind(...binds).all<any>();
  return rows.results || [];
}

export async function getAdminReports(
  db: D1Database,
  params: {
    year?: string;
    area?: string;
    category?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    employee?: string;
    allowedAreaIds?: string[];
  }
): Promise<any> {
  const where: string[] = ['1=1'];
  const binds: any[] = [];

  if (params.year && params.year !== 'ALL') { where.push("strftime('%Y', c.cne_date) = ?"); binds.push(params.year.trim()); }
  if (params.date_from) { where.push('c.cne_date >= ?'); binds.push(params.date_from); }
  if (params.date_to) { where.push('c.cne_date <= ?'); binds.push(params.date_to); }
  if (params.category && params.category !== 'ALL') { where.push('c.category = ?'); binds.push(params.category); }
  if (params.status && params.status !== 'ALL') { where.push('c.status = ?'); binds.push(params.status); }
  if (params.area && params.area !== 'ALL') { where.push('c.area_id = ?'); binds.push(params.area); }
  else if (params.allowedAreaIds?.length) {
    where.push(`c.area_id IN (${params.allowedAreaIds.map(() => '?').join(',')})`);
    binds.push(...params.allowedAreaIds);
  }
  const cneWhere = where.join(' AND ');

  const cneStats = await db.prepare(`
    SELECT COUNT(*) as total_cnes,
           SUM(CASE WHEN c.status='Completed' THEN 1 ELSE 0 END) as completed_cnes
    FROM cnes c WHERE ${cneWhere}
  `).bind(...binds).first<any>();

  let employeeAttendanceClause = '';
  const attBinds = [...binds];
  if (params.employee?.trim()) {
    employeeAttendanceClause = ' AND (ca.employee_id LIKE ? OR e.name LIKE ?)';
    const term = `%${params.employee.trim()}%`;
    attBinds.push(term, term);
  }
  const attStats = await db.prepare(`
    SELECT COUNT(ca.id) as total_attendance
    FROM cne_attendance ca JOIN cnes c ON ca.cne_id=c.id JOIN employees e ON ca.employee_id=e.employee_id
    WHERE ${cneWhere}${employeeAttendanceClause}
  `).bind(...attBinds).first<any>();

  const testBinds = [...binds];
  let employeeTestClause = '';
  if (params.employee?.trim()) {
    employeeTestClause = ' AND (pta.employee_id LIKE ? OR e.name LIKE ?)';
    const term = `%${params.employee.trim()}%`;
    testBinds.push(term, term);
  }
  const testMetrics = await db.prepare(`
    SELECT COUNT(pta.id) as total_attempts,
           SUM(CASE WHEN pta.passed=1 THEN 1 ELSE 0 END) as passed_count,
           AVG(pta.percentage) as avg_pct
    FROM post_test_attempts pta JOIN cnes c ON pta.cne_id=c.id JOIN employees e ON pta.employee_id=e.employee_id
    WHERE ${cneWhere}${employeeTestClause}
  `).bind(...testBinds).first<any>();

  const areaBreakdown = await db.prepare(`
    SELECT a.id as area_id, a.name as area_name, a.code,
           COUNT(DISTINCT c.id) as cne_count,
           COUNT(ca.id) as attendance_count
    FROM areas a
    JOIN cnes c ON c.area_id=a.id
    LEFT JOIN cne_attendance ca ON ca.cne_id=c.id
    WHERE ${cneWhere}
    GROUP BY a.id, a.name, a.code ORDER BY attendance_count DESC, a.name ASC
  `).bind(...binds).all<any>();

  const categoryBreakdown = await db.prepare(`
    SELECT c.category, COUNT(*) as cne_count
    FROM cnes c WHERE ${cneWhere}
    GROUP BY c.category ORDER BY cne_count DESC, c.category ASC
  `).bind(...binds).all<any>();

  const totalAttempts = Number(testMetrics?.total_attempts || 0);
  const passedCount = Number(testMetrics?.passed_count || 0);
  const summary = {
    total_cnes: Number(cneStats?.total_cnes || 0),
    completed_cnes: Number(cneStats?.completed_cnes || 0),
    total_attendance_records: Number(attStats?.total_attendance || 0),
    post_test_attempts: totalAttempts,
    post_test_passed: passedCount,
    overall_pass_rate: totalAttempts ? Math.round((passedCount / totalAttempts) * 1000) / 10 : 0,
    average_percentage: testMetrics?.avg_pct ? Math.round(Number(testMetrics.avg_pct) * 10) / 10 : 0
  };

  return {
    summary,
    area_breakdown: areaBreakdown.results || [],
    category_breakdown: categoryBreakdown.results || [],
    // Compatibility keys for current frontend.
    total_cnes: summary.total_cnes,
    total_attendances: summary.total_attendance_records,
    pass_rate: summary.overall_pass_rate,
    avg_score: summary.average_percentage,
    by_category: (categoryBreakdown.results || []).map((r: any) => ({ category: r.category, count: r.cne_count })),
    by_area: (areaBreakdown.results || []).map((r: any) => ({ area_name: r.area_name, attendees: r.attendance_count, cne_count: r.cne_count }))
  };
}
