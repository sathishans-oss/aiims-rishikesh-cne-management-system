import { AuthenticatedUser, Env } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

async function googleAction(env: Env | undefined, action: string, payload: Record<string, any>): Promise<any> {
  if (!env?.GOOGLE_APPS_SCRIPT_URL || !env?.GOOGLE_INTEGRATION_SECRET) {
    if (env?.ENVIRONMENT === 'production') {
      throw new Error('Google integration is not configured. Set GOOGLE_APPS_SCRIPT_URL and GOOGLE_INTEGRATION_SECRET.');
    }
    throw new Error('Google integration is required for this operation.');
  }
  const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, integration_secret: env.GOOGLE_INTEGRATION_SECRET.trim(), ...payload })
  });
  if (!response.ok) throw new Error(`Google integration failed (HTTP ${response.status}).`);
  const result: any = await response.json().catch(() => null);
  if (!result || result.success !== true) throw new Error(result?.error || `Google integration action '${action}' failed.`);
  return result.data || {};
}

async function uploadToGoogleDrive(
  env: Env | undefined,
  filename: string,
  mimeType: string,
  fileBase64: string,
  folderPath: string
): Promise<{ drive_file_id: string; file_url: string | null }> {
  const data = await googleAction(env, 'upload_to_drive', {
    filename, mime_type: mimeType, file_base64: fileBase64, folder_path: folderPath
  });
  if (!data.drive_file_id) throw new Error('Google Drive did not return a valid file ID.');
  return { drive_file_id: data.drive_file_id, file_url: data.file_url || null };
}

async function extractFromDrive(env: Env | undefined, driveFileId: string, mimeType: string): Promise<string> {
  const data = await googleAction(env, 'extract_text', { drive_file_id: driveFileId, mime_type: mimeType });
  const text = String(data.text || '').trim();
  if (text.length < 20) throw new Error('No usable text could be extracted from the document.');
  return text;
}

function validateDocument(filename: string, mimeType: string, fileSize: number, hasContent = true): void {
  if (!filename?.trim() || !mimeType?.trim()) throw new Error('Filename and MIME type are required.');
  if (!ALLOWED_DOC_MIMES.has(mimeType)) throw new Error('Unsupported file type. Upload PDF, DOC/DOCX, PPT/PPTX, or TXT.');
  if (!fileSize || fileSize <= 0) throw new Error('Valid file size is required.');
  if (fileSize > 8 * 1024 * 1024) throw new Error('File size exceeds the 8 MB upload limit for this integration path.');
  if (!hasContent) throw new Error('Actual file content is required.');
}

export async function indexTextChunks(
  db: D1Database,
  source: { documentId?: string | null; resourceId?: string | null; cneId?: string | null },
  fullText: string
): Promise<void> {
  const documentId = source.documentId || null;
  const resourceId = source.resourceId || null;
  const cneId = source.cneId || null;
  if (!documentId && !resourceId) throw new Error('Chunk source identifier is required.');

  if (documentId) await db.prepare('DELETE FROM library_chunks WHERE document_id = ?').bind(documentId).run();
  if (resourceId) await db.prepare('DELETE FROM library_chunks WHERE resource_id = ?').bind(resourceId).run();

  const normalized = fullText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const paragraphs = normalized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  const maxChars = 1800;

  const push = () => {
    const value = current.trim();
    if (value.length >= 20) chunks.push(value);
    current = '';
  };

  for (const para of paragraphs.length ? paragraphs : [normalized]) {
    if ((current + '\n\n' + para).length > maxChars && current) push();
    if (para.length > maxChars) {
      let remaining = para;
      while (remaining.length > maxChars) {
        chunks.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      current = remaining;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  push();
  if (!chunks.length) throw new Error('Extracted text is too short to index.');

  const statements = chunks.map((content, i) => db.prepare(`
    INSERT INTO library_chunks (id, document_id, resource_id, cne_id, chunk_index, content, token_estimate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind('CHK_' + generateRandomToken(10), documentId, resourceId, cneId, i + 1, content, Math.ceil(content.length / 4)));
  await db.batch(statements);
}

async function finishCneExtraction(db: D1Database, resource: any, env?: Env): Promise<any> {
  try {
    const text = await extractFromDrive(env, resource.drive_file_id, resource.mime_type);
    await indexTextChunks(db, { resourceId: resource.id, cneId: resource.cne_id }, text);
    await db.prepare(`UPDATE cne_resources SET extracted_text = ?, extraction_status='INDEXED', extraction_error=NULL, updated_at=datetime('now') WHERE id=?`)
      .bind(text, resource.id).run();
  } catch (err: any) {
    await db.prepare(`UPDATE cne_resources SET extraction_status='FAILED', extraction_error=?, updated_at=datetime('now') WHERE id=?`)
      .bind(String(err?.message || err).slice(0, 1000), resource.id).run();
  }
  return db.prepare(`SELECT id,cne_id,drive_file_id,file_url,filename,mime_type,file_size,upload_status,extraction_status,extraction_error,created_at FROM cne_resources WHERE id=?`).bind(resource.id).first<any>();
}

async function finishLibraryExtraction(db: D1Database, document: any, env?: Env): Promise<any> {
  try {
    const text = await extractFromDrive(env, document.drive_file_id, document.mime_type);
    await indexTextChunks(db, { documentId: document.id }, text);
    await db.prepare(`UPDATE library_documents SET extracted_text=?, extraction_status='INDEXED', extraction_error=NULL, indexed_at=datetime('now') WHERE id=?`)
      .bind(text, document.id).run();
  } catch (err: any) {
    await db.prepare(`UPDATE library_documents SET extraction_status='FAILED', extraction_error=?, indexed_at=datetime('now') WHERE id=?`)
      .bind(String(err?.message || err).slice(0, 1000), document.id).run();
  }
  return db.prepare(`SELECT * FROM library_documents WHERE id=?`).bind(document.id).first<any>();
}

export async function listCneResources(db: D1Database, cneId: string): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT id,cne_id,drive_file_id,file_url,filename,mime_type,file_size,upload_status,extraction_status,extraction_error,created_at,updated_at
    FROM cne_resources WHERE cne_id=? ORDER BY created_at DESC
  `).bind(cneId).all<any>();
  return rows.results || [];
}

export async function addCneResource(
  db: D1Database,
  user: AuthenticatedUser,
  cneId: string,
  data: { filename: string; mime_type: string; file_size: number; file_base64?: string },
  env?: Env
): Promise<any> {
  validateDocument(data.filename, data.mime_type, data.file_size, Boolean(data.file_base64));
  const cne = await db.prepare('SELECT id,cne_id FROM cnes WHERE id=?').bind(cneId).first<any>();
  if (!cne) throw new Error('CNE not found.');
  const upload = await uploadToGoogleDrive(env, data.filename.trim(), data.mime_type, data.file_base64!, `CNE Management System/CNE Materials/${cne.cne_id}`);
  const id = 'RES_' + generateRandomToken(10);
  await db.prepare(`
    INSERT INTO cne_resources (id,cne_id,drive_file_id,file_url,filename,mime_type,file_size,upload_status,extraction_status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,'COMPLETED','PENDING',datetime('now'),datetime('now'))
  `).bind(id,cneId,upload.drive_file_id,upload.file_url,data.filename.trim(),data.mime_type,data.file_size).run();
  await logAuditAction(db,user.employee_id,'RESOURCE_UPLOADED','RESOURCE',id,{cneId,filename:data.filename});
  await enqueueBackup(db,'cne_resources',id,'INSERT',{id,cne_id:cneId,drive_file_id:upload.drive_file_id,filename:data.filename});
  const resource = await db.prepare('SELECT * FROM cne_resources WHERE id=?').bind(id).first<any>();
  return finishCneExtraction(db, resource, env);
}

export async function retryCneResourceExtraction(db: D1Database, user: AuthenticatedUser, resourceId: string, env?: Env): Promise<any> {
  const resource = await db.prepare('SELECT * FROM cne_resources WHERE id=?').bind(resourceId).first<any>();
  if (!resource) throw new Error('Resource not found.');
  await db.prepare(`UPDATE cne_resources SET extraction_status='PENDING', extraction_error=NULL, updated_at=datetime('now') WHERE id=?`).bind(resourceId).run();
  const result = await finishCneExtraction(db, resource, env);
  await logAuditAction(db,user.employee_id,'RESOURCE_EXTRACTION_RETRIED','RESOURCE',resourceId);
  return result;
}

export async function listLibraryDocuments(db: D1Database, search?: string): Promise<any[]> {
  let query = `SELECT id,title,category,drive_file_id,file_url,filename,mime_type,file_size,active,extraction_status,extraction_error,extracted_text,drive_modified_at,indexed_at,created_at FROM library_documents WHERE active=1`;
  const binds:any[]=[];
  if(search){query += ' AND (title LIKE ? OR filename LIKE ? OR category LIKE ?)'; const t=`%${search}%`; binds.push(t,t,t);}
  query += ' ORDER BY created_at DESC';
  const rows=await db.prepare(query).bind(...binds).all<any>(); return rows.results||[];
}

export async function addLibraryDocument(
  db:D1Database,user:AuthenticatedUser,
  data:{title:string;category?:string;filename:string;mime_type:string;file_size:number;file_base64?:string},
  env?:Env
):Promise<any>{
  if(!data.title?.trim()) throw new Error('Title is required.');
  validateDocument(data.filename,data.mime_type,data.file_size,Boolean(data.file_base64));
  const upload=await uploadToGoogleDrive(env,data.filename.trim(),data.mime_type,data.file_base64!,'CNE Management System/CNE Library');
  const id='LIB_'+generateRandomToken(10); const category=data.category?.trim()||'Institutional Guideline';
  await db.prepare(`INSERT INTO library_documents (id,title,category,drive_file_id,file_url,filename,mime_type,file_size,active,extraction_status,created_at,indexed_at) VALUES (?,?,?,?,?,?,?,?,1,'PENDING',datetime('now'),datetime('now'))`)
    .bind(id,data.title.trim(),category,upload.drive_file_id,upload.file_url,data.filename.trim(),data.mime_type,data.file_size).run();
  await logAuditAction(db,user.employee_id,'LIBRARY_DOC_ADDED','LIBRARY',id,{title:data.title});
  await enqueueBackup(db,'library_documents',id,'INSERT',{id,title:data.title,category,filename:data.filename});
  const doc=await db.prepare('SELECT * FROM library_documents WHERE id=?').bind(id).first<any>();
  return finishLibraryExtraction(db,doc,env);
}

export async function retryLibraryExtraction(db:D1Database,user:AuthenticatedUser,documentId:string,env?:Env):Promise<any>{
  const doc=await db.prepare('SELECT * FROM library_documents WHERE id=?').bind(documentId).first<any>();
  if(!doc) throw new Error('Library document not found.');
  await db.prepare(`UPDATE library_documents SET extraction_status='PENDING', extraction_error=NULL WHERE id=?`).bind(documentId).run();
  const result=await finishLibraryExtraction(db,doc,env);
  await logAuditAction(db,user.employee_id,'LIBRARY_EXTRACTION_RETRIED','LIBRARY',documentId);
  return result;
}

export async function syncDriveLibrary(db:D1Database,user:AuthenticatedUser,env?:Env):Promise<{added:number;updated:number;failed:number}>{
  const result=await googleAction(env,'list_library_files',{folder_path:'CNE Management System/CNE Library'});
  const files:any[]=Array.isArray(result.files)?result.files:[];
  let added=0,updated=0,failed=0;
  for(const f of files){
    try{
      if(!f.id||!f.name||!ALLOWED_DOC_MIMES.has(f.mime_type)) continue;
      let doc=await db.prepare('SELECT * FROM library_documents WHERE drive_file_id=?').bind(f.id).first<any>();
      const changed=!doc || String(doc.drive_modified_at||'')!==String(f.modified_at||'');
      if(!doc){
        const id='LIB_'+generateRandomToken(10);
        await db.prepare(`INSERT INTO library_documents (id,title,category,drive_file_id,file_url,filename,mime_type,file_size,active,extraction_status,drive_modified_at,indexed_at,created_at) VALUES (?,?,?,?,?,?,?, ?,1,'PENDING',?,datetime('now'),datetime('now'))`)
          .bind(id,f.name,'Institutional Library',f.id,f.url||null,f.name,f.mime_type,Number(f.size||0),f.modified_at||null).run();
        doc=await db.prepare('SELECT * FROM library_documents WHERE id=?').bind(id).first<any>(); added++;
      }else if(changed){
        await db.prepare(`UPDATE library_documents SET title=?,filename=?,mime_type=?,file_size=?,file_url=?,drive_modified_at=?,active=1,extraction_status='PENDING',extraction_error=NULL WHERE id=?`)
          .bind(f.name,f.name,f.mime_type,Number(f.size||0),f.url||doc.file_url,f.modified_at||null,doc.id).run();
        doc=await db.prepare('SELECT * FROM library_documents WHERE id=?').bind(doc.id).first<any>(); updated++;
      }
      if(changed) { const extraction = await finishLibraryExtraction(db,doc,env); if (extraction?.extraction_status === 'FAILED') failed++; }
    }catch(_){failed++;}
  }
  const seenIds = files.map(f => f.id).filter(Boolean);
  if (seenIds.length) {
    const placeholders = seenIds.map(() => '?').join(',');
    await db.prepare(`UPDATE library_documents SET active=0 WHERE active=1 AND drive_file_id NOT IN (${placeholders})`).bind(...seenIds).run();
  } else {
    await db.prepare('UPDATE library_documents SET active=0 WHERE active=1').run();
  }
  await logAuditAction(db,user.employee_id,'LIBRARY_DRIVE_SYNC','LIBRARY',null,{added,updated,failed});
  return {added,updated,failed};
}
