import { Env } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { listCneResources, addCneResource, listLibraryDocuments, addLibraryDocument, retryCneResourceExtraction, retryLibraryExtraction, syncDriveLibrary } from '../services/resourceService';
import { requireAuth, requireRole, verifyCneInchargeAccess } from '../middleware/auth';

export async function handleResourceRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const { method } = request; const path=url.pathname;

  const retryCne=path.match(/^\/api\/resources\/cne-resource\/([^/]+)\/retry-extraction$/);
  if(retryCne && method==='POST'){
    try{const user=await requireAuth(request,env); requireRole(user,['ADMIN','AREA_INCHARGE']);
      const row=await env.DB.prepare('SELECT cne_id FROM cne_resources WHERE id=?').bind(retryCne[1]).first<any>(); if(!row) return errorResponse('NOT_FOUND','Resource not found.',404);
      await verifyCneInchargeAccess(env.DB,user,row.cne_id); return successResponse(await retryCneResourceExtraction(env.DB,user,retryCne[1],env));
    }catch(err:any){return errorResponse('EXTRACTION_RETRY_ERROR',err.message||'Extraction retry failed.',err.status||400);}
  }

  const retryLib=path.match(/^\/api\/resources\/library\/([^/]+)\/retry-extraction$/);
  if(retryLib && method==='POST'){
    try{const user=await requireAuth(request,env); requireRole(user,['ADMIN']); return successResponse(await retryLibraryExtraction(env.DB,user,retryLib[1],env));}
    catch(err:any){return errorResponse('LIBRARY_RETRY_ERROR',err.message||'Library extraction retry failed.',err.status||400);}
  }

  if(path==='/api/resources/library/sync-drive' && method==='POST'){
    try{const user=await requireAuth(request,env); requireRole(user,['ADMIN']); return successResponse(await syncDriveLibrary(env.DB,user,env));}
    catch(err:any){return errorResponse('LIBRARY_SYNC_ERROR',err.message||'Drive Library synchronization failed.',err.status||400);}
  }

  const cneResMatch=path.match(/^\/api\/resources\/cne\/([^/]+)$/);
  if(cneResMatch && method==='GET'){
    try{await requireAuth(request,env); return successResponse(await listCneResources(env.DB,cneResMatch[1]));}
    catch(err:any){return errorResponse('RESOURCES_ERROR',err.message||'Failed to list resources.',err.status||400);}
  }
  if(cneResMatch && method==='POST'){
    try{const user=await requireAuth(request,env); requireRole(user,['ADMIN','AREA_INCHARGE']); await verifyCneInchargeAccess(env.DB,user,cneResMatch[1]);
      const body:any=await request.json().catch(()=>({})); return successResponse(await addCneResource(env.DB,user,cneResMatch[1],body,env),201);}
    catch(err:any){return errorResponse('RESOURCE_UPLOAD_ERROR',err.message||'Failed to add resource.',err.status||400);}
  }

  if(path==='/api/resources/library' && method==='GET'){
    try{await requireAuth(request,env); return successResponse(await listLibraryDocuments(env.DB,url.searchParams.get('search')||undefined));}
    catch(err:any){return errorResponse('LIBRARY_ERROR',err.message||'Failed to list library documents.',err.status||400);}
  }
  if(path==='/api/resources/library' && method==='POST'){
    try{const user=await requireAuth(request,env); requireRole(user,['ADMIN']); const body:any=await request.json().catch(()=>({})); return successResponse(await addLibraryDocument(env.DB,user,body,env),201);}
    catch(err:any){return errorResponse('LIBRARY_UPLOAD_ERROR',err.message||'Failed to add library document.',err.status||400);}
  }
  return null;
}
