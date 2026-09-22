import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import {
  listParticipants,
  addParticipant,
  listAttendance,
  generateQrToken,
  scanQrAttendance,
  markManualAttendance
} from '../services/attendanceService';
import { requireAuth, requireRole, verifyCneInchargeAccess } from '../middleware/auth';

export async function handleAttendanceRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // GET /api/participants/:cneId
  const partListMatch = path.match(/^\/api\/participants\/([^/]+)$/);
  if (partListMatch && method === 'GET') {
    const cneId = partListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, cneId);
      const participants = await listParticipants(env.DB, cneId);
      return successResponse(participants);
    } catch (err: any) {
      return errorResponse('PARTICIPANTS_ERROR', err.message || 'Failed to list participants.', err.status || 400);
    }
  }

  // POST /api/participants/:cneId
  if (partListMatch && method === 'POST') {
    const cneId = partListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const body: any = await request.json().catch(() => ({}));
      const { employee_id } = body;

      if (!employee_id) {
        return errorResponse('MISSING_FIELDS', 'Employee ID is required.');
      }

      const participant = await addParticipant(env.DB, user, cneId, employee_id);
      return successResponse(participant, 201);
    } catch (err: any) {
      return errorResponse('ADD_PARTICIPANT_ERROR', err.message || 'Failed to add participant.', err.status || 400);
    }
  }

  // GET /api/attendance/:cneId/qr-token
  const qrTokenMatch = path.match(/^\/api\/attendance\/([^/]+)\/qr-token$/);
  if (qrTokenMatch && method === 'GET') {
    const cneId = qrTokenMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const scopedCne = await verifyCneInchargeAccess(env.DB, user, cneId);
      const tokenData = await generateQrToken(scopedCne.id, env);
      return successResponse(tokenData);
    } catch (err: any) {
      return errorResponse('QR_TOKEN_ERROR', err.message || 'Failed to generate QR token.', err.status || 400);
    }
  }

  // GET /api/attendance/:cneId
  const attListMatch = path.match(/^\/api\/attendance\/([^/]+)$/);
  if (attListMatch && method === 'GET') {
    const cneId = attListMatch[1];
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      await verifyCneInchargeAccess(env.DB, user, cneId);
      const attendance = await listAttendance(env.DB, cneId);
      return successResponse(attendance);
    } catch (err: any) {
      return errorResponse('ATTENDANCE_ERROR', err.message || 'Failed to list attendance.', err.status || 400);
    }
  }

  // POST /api/attendance/scan-qr
  if (path === '/api/attendance/scan-qr' && method === 'POST') {
    try {
      const user = await requireAuth(request, env);
      const body: any = await request.json().catch(() => ({}));
      const { qr_token } = body;

      if (!qr_token) {
        return errorResponse('MISSING_FIELDS', 'QR token is required.');
      }

      const result = await scanQrAttendance(env.DB, user, qr_token, env);
      return successResponse(result);
    } catch (err: any) {
      return errorResponse('SCAN_ERROR', err.message || 'Failed to scan QR attendance.', err.status || 400);
    }
  }

  // POST /api/attendance/manual
  if (path === '/api/attendance/manual' && method === 'POST') {
    try {
      const user = await requireAuth(request, env);
      requireRole(user, ['ADMIN', 'AREA_INCHARGE']);

      const body: any = await request.json().catch(() => ({}));
      const { cne_id, employee_id } = body;

      if (!cne_id || !employee_id) {
        return errorResponse('MISSING_FIELDS', 'CNE ID and employee ID are required.');
      }

      const marked = await markManualAttendance(env.DB, user, cne_id, employee_id);
      return successResponse(marked);
    } catch (err: any) {
      return errorResponse('MANUAL_ATTENDANCE_ERROR', err.message || 'Failed to mark manual attendance.', err.status || 400);
    }
  }

  return null;
}
