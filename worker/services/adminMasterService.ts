import { Env, AuthenticatedUser } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';

export async function listAreas(db: D1Database, publicOnly = false): Promise<any[]> {
  if (publicOnly) {
    const rows = await db.prepare('SELECT id, name, code, active FROM areas WHERE active = 1 ORDER BY name ASC').all<any>();
    return rows.results || [];
  }
  const rows = await db.prepare('SELECT * FROM areas ORDER BY name ASC').all<any>();
  return rows.results || [];
}

export async function createArea(
  db: D1Database,
  user: AuthenticatedUser,
  name: string,
  code: string,
  description?: string
): Promise<any> {
  const id = 'AREA_' + code.toUpperCase().replace(/[^A-Z0-9]/g, '_');

  await db.prepare(`
    INSERT INTO areas (id, name, code, description, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(id, name.trim(), code.trim().toUpperCase(), description?.trim() || null).run();

  await logAuditAction(db, user.employee_id, 'AREA_CREATED', 'AREA', id, { name, code });
  await enqueueBackup(db, 'areas', id, 'INSERT', { id, name, code });

  return db.prepare('SELECT * FROM areas WHERE id = ?').bind(id).first<any>();
}

export async function updateArea(
  db: D1Database,
  user: AuthenticatedUser,
  id: string,
  name?: string,
  description?: string,
  active?: boolean
): Promise<any> {
  await db.prepare(`
    UPDATE areas
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        active = COALESCE(?, active),
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    name?.trim() || null,
    description?.trim() || null,
    active !== undefined ? (active ? 1 : 0) : null,
    id
  ).run();

  await logAuditAction(db, user.employee_id, 'AREA_UPDATED', 'AREA', id, { name, active });
  await enqueueBackup(db, 'areas', id, 'UPDATE', { id, name, active });

  return db.prepare('SELECT * FROM areas WHERE id = ?').bind(id).first<any>();
}

export async function listEmployeesWithRoles(db: D1Database, search?: string): Promise<any[]> {
  let query = `
    SELECT 
      e.employee_id,
      e.name,
      e.designation,
      e.department,
      e.email,
      e.phone,
      e.date_of_joining,
      e.status,
      COALESCE((
        SELECT json_group_array(r.name)
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.employee_id = e.employee_id
      ), '["EMPLOYEE"]') as roles_json
    FROM employees e
    WHERE 1=1
  `;
  const binds: any[] = [];

  if (search) {
    query += ' AND (e.name LIKE ? OR e.employee_id LIKE ? OR e.department LIKE ?)';
    const term = `%${search}%`;
    binds.push(term, term, term);
  }

  query += ' ORDER BY e.name ASC LIMIT 100';

  const rows = await db.prepare(query).bind(...binds).all<any>();
  return (rows.results || []).map((row: any) => {
    let parsedRoles = ['EMPLOYEE'];
    try {
      if (row.roles_json) parsedRoles = JSON.parse(row.roles_json);
    } catch {}
    return {
      ...row,
      roles: parsedRoles
    };
  });
}

export async function assignRole(
  db: D1Database,
  admin: AuthenticatedUser,
  employeeId: string,
  roleName: string
): Promise<any> {
  const cleanId = employeeId.trim().toUpperCase();
  const cleanRole = roleName.trim().toUpperCase();
  if (!['ADMIN', 'AREA_INCHARGE', 'EMPLOYEE'].includes(cleanRole)) throw new Error('Invalid role.');

  const emp = await db.prepare('SELECT employee_id FROM employees WHERE employee_id = ?').bind(cleanId).first<any>();
  if (!emp) throw new Error(`Employee '${cleanId}' does not exist.`);

  const role = await db.prepare('SELECT id FROM roles WHERE name = ?').bind(cleanRole).first<any>();
  if (!role) throw new Error(`Role '${cleanRole}' does not exist.`);

  // Do not allow removal of the final administrator.
  const targetIsAdmin = await db.prepare(`SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.employee_id=? AND r.name='ADMIN'`).bind(cleanId).first<any>();
  if (targetIsAdmin && cleanRole !== 'ADMIN') {
    const adminCount = await db.prepare(`SELECT COUNT(DISTINCT ur.employee_id) count FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE r.name='ADMIN'`).first<any>();
    if ((adminCount?.count || 0) <= 1) throw new Error('The final ADMIN account cannot be downgraded. Assign another ADMIN first.');
  }

  // Treat this UI operation as the primary privilege assignment: clear privileged roles first.
  await db.prepare(`DELETE FROM user_roles WHERE employee_id = ? AND role_id IN (SELECT id FROM roles WHERE name IN ('ADMIN','AREA_INCHARGE'))`).bind(cleanId).run();

  if (cleanRole !== 'EMPLOYEE') {
    await db.prepare(`INSERT OR IGNORE INTO user_roles (id, employee_id, role_id, assigned_by, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .bind('UR_' + generateRandomToken(8), cleanId, role.id, admin.employee_id).run();
  }

  await logAuditAction(db, admin.employee_id, 'ROLE_ASSIGNED', 'USER_ROLE', cleanId, { role: cleanRole });
  await enqueueBackup(db, 'user_roles', cleanId, 'UPDATE', { employee_id: cleanId, primary_role: cleanRole, assigned_by: admin.employee_id });
  return { success: true, message: `Primary role '${cleanRole}' assigned to ${cleanId}.` };
}

export async function syncOfficersFromGoogleSheet(
  db: D1Database,
  env: Env,
  admin: AuthenticatedUser
): Promise<{ success: boolean; syncedCount: number; message: string }> {
  if (!env.GOOGLE_APPS_SCRIPT_URL || !env.GOOGLE_INTEGRATION_SECRET) {
    return {
      success: false,
      syncedCount: 0,
      message: 'Google Apps Script URL or Integration Secret not configured in environment.'
    };
  }

  const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'get_officers',
      integration_secret: env.GOOGLE_INTEGRATION_SECRET.trim()
    })
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script returned HTTP ${response.status}: ${response.statusText}`);
  }

  const resData: any = await response.json();
  if (!resData.success) {
    throw new Error(resData.error || 'Google Apps Script returned an unsuccessful status for officers synchronization.');
  }

  const officers = resData.data?.officers || [];

  let count = 0;
  for (const o of officers) {
    if (o.employee_id && o.name && o.date_of_joining) {
      await db.prepare(`
        INSERT INTO employees (employee_id, name, designation, department, email, phone, date_of_joining, status, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(employee_id) DO UPDATE SET
          name = excluded.name,
          designation = excluded.designation,
          department = excluded.department,
          email = excluded.email,
          phone = excluded.phone,
          date_of_joining = excluded.date_of_joining,
          status = excluded.status,
          synced_at = datetime('now')
      `).bind(
        o.employee_id.trim().toUpperCase(),
        o.name.trim(),
        o.designation?.trim() || 'Nursing Officer',
        o.department?.trim() || 'General Nursing',
        o.email?.trim() || null,
        o.phone?.trim() || null,
        o.date_of_joining.trim(),
        (o.status || 'ACTIVE').trim().toUpperCase()
      ).run();
      count++;
    }
  }

  await logAuditAction(db, admin.employee_id, 'OFFICERS_SYNCED', 'OFFICERS', null, { syncedCount: count });

  return {
    success: true,
    syncedCount: count,
    message: `Synchronized ${count} authoritative officers from institutional Google Sheet.`
  };
}

export async function getAdminContent(db: D1Database): Promise<any> {
  const chairperson = await db.prepare('SELECT * FROM chairperson_content LIMIT 1').first<any>();
  const coordinator = await db.prepare('SELECT * FROM coordinator_content LIMIT 1').first<any>();
  const news = await db.prepare('SELECT * FROM news_circulars ORDER BY display_order ASC').all<any>();
  const quickLinks = await db.prepare('SELECT * FROM quick_links ORDER BY display_order ASC').all<any>();
  const gallery = await db.prepare('SELECT * FROM gallery_items ORDER BY display_order ASC').all<any>();
  const institutional = await db.prepare('SELECT * FROM institutional_content ORDER BY display_order ASC').all<any>();

  return {
    chairperson,
    coordinator,
    news: news.results || [],
    quick_links: quickLinks.results || [],
    gallery: gallery.results || [],
    institutional: institutional.results || []
  };
}

async function uploadCmsImage(env: Env, fileBase64: string, filename: string, mimeType: string, folderPath: string): Promise<{drive_file_id:string; file_url:string}> {
  if (!env.GOOGLE_APPS_SCRIPT_URL || !env.GOOGLE_INTEGRATION_SECRET) throw new Error('Google Drive integration is not configured.');
  if (!/^image\//.test(mimeType)) throw new Error('Only image files are accepted.');
  const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'upload_to_drive', integration_secret:env.GOOGLE_INTEGRATION_SECRET.trim(), filename, mime_type:mimeType, file_base64:fileBase64, folder_path:folderPath, public_read:true }) });
  const result:any = await response.json().catch(()=>null);
  if (!response.ok || !result?.success || !result.data?.drive_file_id || !result.data?.file_url) throw new Error(result?.error || 'Google Drive image upload failed.');
  return result.data;
}

export async function updateChairperson(
  db:D1Database,user:AuthenticatedUser,
  data:{name:string;designation:string;message:string;is_published?:boolean;photo_file_base64?:string;photo_filename?:string;photo_mime_type?:string},
  env:Env
):Promise<any>{
  const existing=await db.prepare('SELECT * FROM chairperson_content LIMIT 1').first<any>(); const id=existing?.id||'CHAIR_01';
  let photoDriveId=existing?.photo_drive_id||null, photoUrl=existing?.photo_url||null;
  if(data.photo_file_base64){const up=await uploadCmsImage(env,data.photo_file_base64,data.photo_filename||'chairperson.jpg',data.photo_mime_type||'image/jpeg','CNE Management System/Chairperson');photoDriveId=up.drive_file_id;photoUrl=up.file_url;}
  if(!photoUrl) throw new Error('Chairperson photograph is required before publishing.');
  await db.prepare(`INSERT INTO chairperson_content (id,name,designation,message,photo_drive_id,photo_url,is_published,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,designation=excluded.designation,message=excluded.message,photo_drive_id=excluded.photo_drive_id,photo_url=excluded.photo_url,is_published=excluded.is_published,updated_at=datetime('now')`)
    .bind(id,data.name.trim(),data.designation.trim(),data.message.trim(),photoDriveId,photoUrl,data.is_published===false?0:1).run();
  await logAuditAction(db,user.employee_id,'CONTENT_CHAIRPERSON_UPDATED','CONTENT',id,{is_published:data.is_published!==false});
  await enqueueBackup(db,'chairperson_content',id,'UPDATE',{id,name:data.name,designation:data.designation,is_published:data.is_published!==false});
  return db.prepare('SELECT * FROM chairperson_content WHERE id=?').bind(id).first<any>();
}

export async function updateCoordinator(db:D1Database,user:AuthenticatedUser,data:{name:string;title:string;message:string;is_published?:boolean}):Promise<any>{
  const existing=await db.prepare('SELECT id FROM coordinator_content LIMIT 1').first<any>(); const id=existing?.id||'COORD_01';
  await db.prepare(`INSERT INTO coordinator_content (id,name,title,message,is_published,updated_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title,message=excluded.message,is_published=excluded.is_published,updated_at=datetime('now')`)
    .bind(id,data.name.trim(),data.title.trim(),data.message.trim(),data.is_published===false?0:1).run();
  await logAuditAction(db,user.employee_id,'CONTENT_COORDINATOR_UPDATED','CONTENT',id,{is_published:data.is_published!==false});
  await enqueueBackup(db,'coordinator_content',id,'UPDATE',{id,name:data.name,is_published:data.is_published!==false});
  return db.prepare('SELECT * FROM coordinator_content WHERE id=?').bind(id).first<any>();
}

export async function createNews(db:D1Database,user:AuthenticatedUser,data:{title:string;content:string;publication_date:string;file_url?:string;is_published?:boolean;display_order?:number}):Promise<any>{
  const id='CIRC_'+generateRandomToken(8); const count=await db.prepare('SELECT COUNT(*) count FROM news_circulars').first<any>(); const order=Number(data.display_order||((count?.count||0)+1));
  await db.prepare(`INSERT INTO news_circulars (id,title,content,publication_date,file_url,is_published,display_order,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`).bind(id,data.title.trim(),data.content.trim(),data.publication_date,data.file_url||null,data.is_published===false?0:1,order).run();
  await logAuditAction(db,user.employee_id,'NEWS_CREATED','NEWS',id); await enqueueBackup(db,'news_circulars',id,'INSERT',{id,title:data.title}); return db.prepare('SELECT * FROM news_circulars WHERE id=?').bind(id).first<any>();
}
export async function updateNews(db:D1Database,user:AuthenticatedUser,id:string,data:any):Promise<any>{
  await db.prepare(`UPDATE news_circulars SET title=COALESCE(?,title),content=COALESCE(?,content),publication_date=COALESCE(?,publication_date),file_url=COALESCE(?,file_url),is_published=COALESCE(?,is_published),display_order=COALESCE(?,display_order) WHERE id=?`)
    .bind(data.title?.trim()||null,data.content?.trim()||null,data.publication_date||null,data.file_url??null,data.is_published===undefined?null:(data.is_published?1:0),data.display_order??null,id).run();
  await logAuditAction(db,user.employee_id,'NEWS_UPDATED','NEWS',id); await enqueueBackup(db,'news_circulars',id,'UPDATE',{id,...data}); return db.prepare('SELECT * FROM news_circulars WHERE id=?').bind(id).first<any>();
}
export async function deleteNews(db:D1Database,user:AuthenticatedUser,id:string):Promise<void>{await db.prepare('DELETE FROM news_circulars WHERE id=?').bind(id).run();await logAuditAction(db,user.employee_id,'NEWS_DELETED','NEWS',id);await enqueueBackup(db,'news_circulars',id,'DELETE',{id});}

export async function createQuickLink(db:D1Database,user:AuthenticatedUser,data:{title:string;url:string;is_active?:boolean;display_order?:number}):Promise<any>{
 const id='QL_'+generateRandomToken(8);const count=await db.prepare('SELECT COUNT(*) count FROM quick_links').first<any>();const order=Number(data.display_order||((count?.count||0)+1));
 await db.prepare(`INSERT INTO quick_links (id,title,url,is_active,display_order,created_at) VALUES (?,?,?,?,?,datetime('now'))`).bind(id,data.title.trim(),data.url.trim(),data.is_active===false?0:1,order).run();await logAuditAction(db,user.employee_id,'QUICK_LINK_CREATED','QUICK_LINK',id);await enqueueBackup(db,'quick_links',id,'INSERT',{id,title:data.title,url:data.url});return db.prepare('SELECT * FROM quick_links WHERE id=?').bind(id).first<any>();
}
export async function updateQuickLink(db:D1Database,user:AuthenticatedUser,id:string,data:any):Promise<any>{
 await db.prepare(`UPDATE quick_links SET title=COALESCE(?,title),url=COALESCE(?,url),is_active=COALESCE(?,is_active),display_order=COALESCE(?,display_order) WHERE id=?`).bind(data.title?.trim()||null,data.url?.trim()||null,data.is_active===undefined?null:(data.is_active?1:0),data.display_order??null,id).run();await logAuditAction(db,user.employee_id,'QUICK_LINK_UPDATED','QUICK_LINK',id);await enqueueBackup(db,'quick_links',id,'UPDATE',{id,...data});return db.prepare('SELECT * FROM quick_links WHERE id=?').bind(id).first<any>();
}
export async function deleteQuickLink(db:D1Database,user:AuthenticatedUser,id:string):Promise<void>{await db.prepare('DELETE FROM quick_links WHERE id=?').bind(id).run();await logAuditAction(db,user.employee_id,'QUICK_LINK_DELETED','QUICK_LINK',id);await enqueueBackup(db,'quick_links',id,'DELETE',{id});}

export async function createGalleryItem(db:D1Database,user:AuthenticatedUser,data:{title:string;caption?:string;image_file_base64:string;image_filename:string;image_mime_type:string;is_published?:boolean;display_order?:number},env:Env):Promise<any>{
 if(!data.image_file_base64) throw new Error('Gallery image file is required.'); const up=await uploadCmsImage(env,data.image_file_base64,data.image_filename||'gallery.jpg',data.image_mime_type||'image/jpeg','CNE Management System/Gallery');
 const id='GAL_'+generateRandomToken(8);const count=await db.prepare('SELECT COUNT(*) count FROM gallery_items').first<any>();const order=Number(data.display_order||((count?.count||0)+1));
 await db.prepare(`INSERT INTO gallery_items (id,title,caption,drive_file_id,image_url,display_order,is_published,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`).bind(id,data.title.trim(),data.caption?.trim()||null,up.drive_file_id,up.file_url,order,data.is_published===false?0:1).run();await logAuditAction(db,user.employee_id,'GALLERY_ITEM_CREATED','GALLERY',id);await enqueueBackup(db,'gallery_items',id,'INSERT',{id,title:data.title,drive_file_id:up.drive_file_id});return db.prepare('SELECT * FROM gallery_items WHERE id=?').bind(id).first<any>();
}
export async function updateGalleryItem(db:D1Database,user:AuthenticatedUser,id:string,data:any,env:Env):Promise<any>{
 const existing=await db.prepare('SELECT * FROM gallery_items WHERE id=?').bind(id).first<any>();if(!existing) throw new Error('Gallery item not found.');let driveId=existing.drive_file_id,url=existing.image_url;
 if(data.image_file_base64){const up=await uploadCmsImage(env,data.image_file_base64,data.image_filename||'gallery.jpg',data.image_mime_type||'image/jpeg','CNE Management System/Gallery');driveId=up.drive_file_id;url=up.file_url;}
 await db.prepare(`UPDATE gallery_items SET title=COALESCE(?,title),caption=COALESCE(?,caption),drive_file_id=?,image_url=?,display_order=COALESCE(?,display_order),is_published=COALESCE(?,is_published) WHERE id=?`).bind(data.title?.trim()||null,data.caption??null,driveId,url,data.display_order??null,data.is_published===undefined?null:(data.is_published?1:0),id).run();await logAuditAction(db,user.employee_id,'GALLERY_ITEM_UPDATED','GALLERY',id);await enqueueBackup(db,'gallery_items',id,'UPDATE',{id,...data,image_file_base64:undefined});return db.prepare('SELECT * FROM gallery_items WHERE id=?').bind(id).first<any>();
}
export async function deleteGalleryItem(db:D1Database,user:AuthenticatedUser,id:string):Promise<void>{await db.prepare('DELETE FROM gallery_items WHERE id=?').bind(id).run();await logAuditAction(db,user.employee_id,'GALLERY_ITEM_DELETED','GALLERY',id);await enqueueBackup(db,'gallery_items',id,'DELETE',{id});}

export async function updateInstitutionalMetric(
  db: D1Database,
  user: AuthenticatedUser,
  key: string,
  value: string
): Promise<any> {
  await db.prepare(`
    UPDATE institutional_content
    SET value = ?, updated_at = datetime('now')
    WHERE key = ?
  `).bind(value.trim(), key.trim()).run();

  await logAuditAction(db, user.employee_id, 'METRIC_UPDATED', 'CONTENT', key, { value });
  await enqueueBackup(db, 'institutional_content', key, 'UPDATE', { key, value });

  return db.prepare('SELECT * FROM institutional_content WHERE key = ?').bind(key).first<any>();
}

export async function listAreaIncharges(db: D1Database, areaId?: string): Promise<any[]> {
  let query = `
    SELECT aia.id, aia.employee_id, aia.area_id, aia.active, aia.assigned_at,
           e.name as employee_name, e.designation, e.department,
           a.name as area_name, a.code as area_code
    FROM area_incharge_assignments aia
    JOIN employees e ON aia.employee_id = e.employee_id
    JOIN areas a ON aia.area_id = a.id
    WHERE aia.active = 1
  `;
  const binds: any[] = [];
  if (areaId) {
    query += ' AND aia.area_id = ?';
    binds.push(areaId);
  }
  query += ' ORDER BY a.name ASC, e.name ASC';

  const rows = await db.prepare(query).bind(...binds).all<any>();
  return rows.results || [];
}

export async function assignAreaIncharge(
  db: D1Database,
  admin: AuthenticatedUser,
  employeeId: string,
  areaId: string
): Promise<any> {
  const cleanEmpId = employeeId.trim().toUpperCase();
  const cleanAreaId = areaId.trim();

  const area = await db.prepare('SELECT id, name FROM areas WHERE id = ?').bind(cleanAreaId).first<any>();
  if (!area) {
    throw new Error(`Area with ID ${cleanAreaId} not found.`);
  }

  const emp = await db.prepare('SELECT employee_id, name FROM employees WHERE employee_id = ?').bind(cleanEmpId).first<any>();
  if (!emp) {
    throw new Error(`Employee with ID ${cleanEmpId} not found.`);
  }

  // Ensure user has AREA_INCHARGE role
  const inchargeRole = await db.prepare("SELECT id FROM roles WHERE name = 'AREA_INCHARGE'").first<any>();
  if (inchargeRole) {
    const existingRole = await db.prepare('SELECT id FROM user_roles WHERE employee_id = ? AND role_id = ?')
      .bind(cleanEmpId, inchargeRole.id).first<any>();
    if (!existingRole) {
      const urId = 'UR_' + generateRandomToken(8);
      await db.prepare(`
        INSERT INTO user_roles (id, employee_id, role_id, assigned_by, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(urId, cleanEmpId, inchargeRole.id, admin.employee_id).run();
    }
  }

  const id = 'AIA_' + generateRandomToken(8);
  await db.prepare(`
    INSERT INTO area_incharge_assignments (id, employee_id, area_id, active, assigned_at, assigned_by)
    VALUES (?, ?, ?, 1, datetime('now'), ?)
    ON CONFLICT(employee_id, area_id) DO UPDATE SET
      active = 1,
      assigned_at = datetime('now'),
      assigned_by = excluded.assigned_by
  `).bind(id, cleanEmpId, cleanAreaId, admin.employee_id).run();

  await logAuditAction(db, admin.employee_id, 'AREA_INCHARGE_ASSIGNED', 'AREA_ASSIGNMENT', cleanAreaId, {
    employee_id: cleanEmpId,
    area_id: cleanAreaId
  });

  return { success: true, message: `Employee ${cleanEmpId} assigned as In-Charge for ${area.name}.` };
}

export async function removeAreaIncharge(
  db: D1Database,
  admin: AuthenticatedUser,
  employeeId: string,
  areaId: string
): Promise<any> {
  const cleanEmpId = employeeId.trim().toUpperCase();
  const cleanAreaId = areaId.trim();

  await db.prepare(`
    UPDATE area_incharge_assignments
    SET active = 0
    WHERE employee_id = ? AND area_id = ?
  `).bind(cleanEmpId, cleanAreaId).run();

  await logAuditAction(db, admin.employee_id, 'AREA_INCHARGE_REMOVED', 'AREA_ASSIGNMENT', cleanAreaId, {
    employee_id: cleanEmpId,
    area_id: cleanAreaId
  });

  return { success: true, message: `Employee ${cleanEmpId} unassigned from area ${cleanAreaId}.` };
}

