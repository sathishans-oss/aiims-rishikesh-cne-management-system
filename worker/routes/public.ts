import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { getPublicSchedule, getCne, listCnes, searchResourcePersons } from '../services/cneService';
import { listAreas } from '../services/adminMasterService';
import { getAuthUser } from '../middleware/auth';

export async function handlePublicRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const method = request.method;
  const path = url.pathname;

  // 1. Health check
  if (path === '/api/health' && method === 'GET') {
    return successResponse({
      status: 'ok',
      runtime: 'Cloudflare Worker',
      timestamp: new Date().toISOString()
    });
  }

  // 2. Public Home Content
  if (path === '/api/public/home' && method === 'GET') {
    try {
      const chairperson = await env.DB.prepare('SELECT name, designation, message, photo_url FROM chairperson_content WHERE is_published = 1 LIMIT 1').first();
      const coordinator = await env.DB.prepare('SELECT name, title, message FROM coordinator_content WHERE is_published = 1 LIMIT 1').first();
      const news = await env.DB.prepare('SELECT id, title, content, publication_date, file_url FROM news_circulars WHERE is_published = 1 ORDER BY display_order ASC, publication_date DESC LIMIT 5').all();
      const quickLinks = await env.DB.prepare('SELECT id, title, url FROM quick_links WHERE is_active = 1 ORDER BY display_order ASC').all();
      const gallery = await env.DB.prepare('SELECT id, title, caption, image_url FROM gallery_items WHERE is_published = 1 ORDER BY display_order ASC LIMIT 6').all();
      const institutional = await env.DB.prepare('SELECT key, label, value, description FROM institutional_content ORDER BY display_order ASC').all();

      const highlights = await env.DB.prepare(`
        SELECT c.id, c.cne_id, c.title, c.category, c.venue, c.cne_date, c.start_time, c.end_time, c.status, a.name as area_name
        FROM cnes c JOIN areas a ON c.area_id = a.id
        WHERE c.status IN ('Scheduled', 'Modified & Scheduled') AND c.cne_date >= date('now')
        ORDER BY c.cne_date ASC LIMIT 4
      `).all();

      return successResponse({
        chairperson: chairperson || null,
        coordinator: coordinator || null,
        news: news.results || [],
        quick_links: quickLinks.results || [],
        gallery: gallery.results || [],
        institutional: institutional.results || [],
        upcoming_highlights: highlights.results || []
      });
    } catch (err: any) {
      console.error('Failed to load public home data:', err);
      return errorResponse('PUBLIC_HOME_ERROR', 'Unable to retrieve portal overview at this time.', 500);
    }
  }

  // 3. Public CNE Schedule
  if (path === '/api/public/cne-schedule' && method === 'GET') {
    try {
      const area = url.searchParams.get('area') || undefined;
      const category = url.searchParams.get('category') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const status = url.searchParams.get('status') || undefined;

      const schedule = await getPublicSchedule(env.DB, { area, category, search, status });
      return successResponse(schedule);
    } catch (err: any) {
      console.error('Public schedule error:', err);
      return errorResponse('SCHEDULE_ERROR', 'Unable to retrieve CNE schedule.', 500);
    }
  }

  // 4. Public Areas (active areas only, safe subset of fields - Section 23)
  if (path === '/api/areas' && method === 'GET') {
    try {
      const areas = await listAreas(env.DB, true);
      return successResponse(areas);
    } catch (err: any) {
      console.error('Public areas error:', err);
      return errorResponse('AREAS_ERROR', 'Unable to retrieve clinical areas.', 500);
    }
  }

  // 5. CNE List: safe public projection for visitors, enriched D1 data for authenticated staff.
  if (path === '/api/cne' && method === 'GET') {
    try {
      const params = {
        area: url.searchParams.get('area') || undefined,
        category: url.searchParams.get('category') || undefined,
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined,
        start_date: url.searchParams.get('start_date') || undefined,
        end_date: url.searchParams.get('end_date') || undefined,
        page: Number(url.searchParams.get('page') || 1),
        page_size: Number(url.searchParams.get('page_size') || 100)
      };
      const user = await getAuthUser(request, env);
      const result = user ? await listCnes(env.DB, params, user) : await getPublicSchedule(env.DB, params);
      return successResponse(result);
    } catch (err: any) {
      console.error('CNE list error:', err);
      return errorResponse('CNE_LIST_ERROR', 'Unable to retrieve CNE list.', 500);
    }
  }

  // Authenticated Resource Person directory search. Keep before the dynamic /api/cne/:id route.
  if (path === '/api/cne/resource-persons' && method === 'GET') {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required.', 401);
    if (!user.roles.some(r => r === 'ADMIN' || r === 'AREA_INCHARGE')) return errorResponse('FORBIDDEN', 'CNE management role required.', 403);
    const people = await searchResourcePersons(env.DB, url.searchParams.get('search') || undefined);
    return successResponse(people);
  }

  // 6. CNE Details by ID (safe for public, enriched for authenticated staff)
  const cneIdMatch = path.match(/^\/api\/cne\/([^/]+)$/);
  if (cneIdMatch && method === 'GET') {
    const cneId = cneIdMatch[1];
    try {
      const user = await getAuthUser(request, env);
      const cne = await getCne(env.DB, cneId, user);
      return successResponse(cne);
    } catch (err: any) {
      return errorResponse('CNE_NOT_FOUND', err.message || 'CNE not found.', 404);
    }
  }

  return null;
}
