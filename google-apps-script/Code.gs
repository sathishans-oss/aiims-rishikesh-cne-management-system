/**
 * CNE MANAGEMENT SYSTEM — GOOGLE APPS SCRIPT INTEGRATION
 * Server-to-server bridge for Officers Master sync, Drive files/extraction,
 * and idempotent Google Sheets backup. Configure Script Properties:
 * INTEGRATION_SECRET, OFFICERS_SPREADSHEET_ID, BACKUP_SPREADSHEET_ID.
 * Enable the Advanced Google Drive service (Drive API) for DOC/DOCX/PDF/PPT/PPTX extraction.
 */

function getRequiredProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || String(value).trim() === '') throw new Error(name + ' is not configured in Script Properties.');
  return String(value).trim();
}

function authorizeBody(body) {
  try { return body && String(body.integration_secret || '').trim() === getRequiredProperty('INTEGRATION_SECRET'); }
  catch (err) { return false; }
}

function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ok(data) { return json({ success: true, data: data || {}, error: null }); }
function fail(message) { return json({ success: false, data: null, error: String(message || 'Unknown integration error') }); }

function getBackupSpreadsheet() { return SpreadsheetApp.openById(getRequiredProperty('BACKUP_SPREADSHEET_ID')); }
function getOfficersSpreadsheet() { return SpreadsheetApp.openById(getRequiredProperty('OFFICERS_SPREADSHEET_ID')); }

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function findHeaderIndex(headers, aliases) {
  for (var a = 0; a < aliases.length; a++) {
    var target = normalizeHeader(aliases[a]);
    for (var i = 0; i < headers.length; i++) if (normalizeHeader(headers[i]) === target) return i;
  }
  return -1;
}
function asDateYmd(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  return String(value || '').trim();
}

function getOrCreateFolderPath(path) {
  var parts = String(path || 'CNE Management System').split('/').map(function(x){ return x.trim(); }).filter(function(x){ return x; });
  var parent = null;
  for (var i = 0; i < parts.length; i++) {
    var iterator = parent ? parent.getFoldersByName(parts[i]) : DriveApp.getFoldersByName(parts[i]);
    var folder = iterator.hasNext() ? iterator.next() : (parent ? parent.createFolder(parts[i]) : DriveApp.createFolder(parts[i]));
    parent = folder;
  }
  return parent || DriveApp.createFolder('CNE Management System');
}

function extractGoogleDoc(fileId) {
  var doc = DocumentApp.openById(fileId);
  return doc.getBody().getText();
}
function extractGoogleSlides(fileId) {
  var pres = SlidesApp.openById(fileId); var out = [];
  pres.getSlides().forEach(function(slide){
    slide.getPageElements().forEach(function(el){
      try { if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) out.push(el.asShape().getText().asString()); } catch (_) {}
    });
  });
  return out.join('\n\n');
}

function extractTextFromDriveFile(fileId, mimeType) {
  var file = DriveApp.getFileById(fileId);
  var mime = String(mimeType || file.getMimeType() || '');
  if (mime === 'text/plain') return file.getBlob().getDataAsString();
  if (mime === MimeType.GOOGLE_DOCS || mime === 'application/vnd.google-apps.document') return extractGoogleDoc(fileId);
  if (mime === MimeType.GOOGLE_SLIDES || mime === 'application/vnd.google-apps.presentation') return extractGoogleSlides(fileId);

  var isSlides = mime.indexOf('powerpoint') >= 0 || mime.indexOf('presentationml') >= 0;
  var isDoc = mime === 'application/pdf' || mime.indexOf('word') >= 0 || mime.indexOf('wordprocessingml') >= 0;
  if (!isSlides && !isDoc) throw new Error('Automatic extraction is not supported for MIME type: ' + mime);

  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.create) {
    throw new Error('Advanced Drive service is not enabled. Enable Drive API in Apps Script Services for document extraction.');
  }

  var convertedMime = isSlides ? 'application/vnd.google-apps.presentation' : 'application/vnd.google-apps.document';
  var converted = Drive.Files.create({ name: 'CNE_TEMP_EXTRACT_' + file.getName(), mimeType: convertedMime }, file.getBlob(), { fields: 'id' });
  if (!converted || !converted.id) throw new Error('Google Drive conversion did not return a temporary file ID.');
  try { return isSlides ? extractGoogleSlides(converted.id) : extractGoogleDoc(converted.id); }
  finally { try { DriveApp.getFileById(converted.id).setTrashed(true); } catch (_) {} }
}

function listFilesInFolder(folder) {
  var files = []; var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    files.push({
      id: f.getId(), name: f.getName(), mime_type: f.getMimeType(), size: f.getSize(), url: f.getUrl(),
      modified_at: Utilities.formatDate(f.getLastUpdated(), 'GMT', "yyyy-MM-dd'T'HH:mm:ss'Z'")
    });
  }
  return files;
}

function sanitizeSheetCell(value) {
  if (value === null || value === undefined) return '';
  var s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function doGet() { return ok({ service: 'CNE Google Integration', status: 'ACTIVE' }); }

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    if (!authorizeBody(body)) return fail('Unauthorized integration request.');
    var action = String(body.action || '');

    if (action === 'get_officers') {
      var ss = getOfficersSpreadsheet();
      var sheetName = PropertiesService.getScriptProperties().getProperty('OFFICERS_SHEET_NAME') || 'Officers data';
      var sheet = ss.getSheetByName(sheetName) || ss.getSheetByName('Officers');
      if (!sheet) throw new Error('Officers sheet not found. Configure OFFICERS_SHEET_NAME.');
      var rows = sheet.getDataRange().getValues();
      if (!rows.length) return ok({ officers: [] });
      var h = rows[0];
      var idx = {
        employee_id: findHeaderIndex(h, ['employee id','employee_id','officer id','officer_id','id']),
        name: findHeaderIndex(h, ['name','employee name','officer name']),
        designation: findHeaderIndex(h, ['designation','post']),
        department: findHeaderIndex(h, ['department','area','ward','unit']),
        email: findHeaderIndex(h, ['email','email id','email_id']),
        phone: findHeaderIndex(h, ['phone','mobile','mobile number','contact']),
        date_of_joining: findHeaderIndex(h, ['date of joining','doj','date_of_joining']),
        status: findHeaderIndex(h, ['status','employee status'])
      };
      if (idx.employee_id < 0 || idx.name < 0 || idx.date_of_joining < 0) throw new Error('Officers sheet must contain Employee ID, Name, and Date of Joining headers.');
      var officers=[];
      for(var r=1;r<rows.length;r++){
        var row=rows[r]; var emp=String(row[idx.employee_id]||'').trim(); if(!emp) continue;
        officers.push({
          employee_id: emp.toUpperCase(), name:String(row[idx.name]||'').trim(),
          designation: idx.designation>=0?String(row[idx.designation]||'').trim():'',
          department: idx.department>=0?String(row[idx.department]||'').trim():'',
          email: idx.email>=0?String(row[idx.email]||'').trim():'', phone:idx.phone>=0?String(row[idx.phone]||'').trim():'',
          date_of_joining: asDateYmd(row[idx.date_of_joining]), status: idx.status>=0?String(row[idx.status]||'ACTIVE').trim().toUpperCase():'ACTIVE'
        });
      }
      return ok({officers:officers});
    }

    if (action === 'upload_to_drive') {
      if (!body.file_base64) return fail('Missing file_base64 payload.');
      var filename = String(body.filename || 'cne_document').replace(/[\\/:*?"<>|]/g, '_');
      var mimeType = String(body.mime_type || 'application/octet-stream');
      var folder = getOrCreateFolderPath(body.folder_path || body.folder || 'CNE Management System');
      var blob = Utilities.newBlob(Utilities.base64Decode(body.file_base64), mimeType, filename);
      var file = folder.createFile(blob);
      var fileUrl = file.getUrl();
      if (body.public_read === true) {
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); fileUrl = 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId()); }
        catch (shareErr) { throw new Error('Public portal image could not be shared for viewing: ' + shareErr.message); }
      }
      return ok({ drive_file_id:file.getId(), file_url:fileUrl });
    }

    if (action === 'extract_text') {
      if (!body.drive_file_id) return fail('drive_file_id is required.');
      var text = extractTextFromDriveFile(String(body.drive_file_id), String(body.mime_type || ''));
      if (!text || String(text).trim().length < 20) return fail('No usable text could be extracted from the document.');
      return ok({ text:String(text).trim() });
    }

    if (action === 'list_library_files') {
      var libFolder = getOrCreateFolderPath(body.folder_path || 'CNE Management System/CNE Library');
      return ok({ files:listFilesInFolder(libFolder) });
    }

    if (action === 'backup_record') {
      var recordId = String(body.recordId || body.record_id || ''); if (!recordId) return fail('record_id is required.');
      var tableName = String(body.table || 'General_Log').replace(/[^A-Za-z0-9_ -]/g,'_');
      var sheet = getBackupSpreadsheet().getSheetByName(tableName);
      if (!sheet) { sheet=getBackupSpreadsheet().insertSheet(tableName); sheet.appendRow(['Record_ID','Operation','Synced_At','Payload_JSON']); sheet.getRange(1,1,1,4).setFontWeight('bold'); }
      var values=sheet.getDataRange().getValues(); var rowIndex=-1;
      for(var i=1;i<values.length;i++) if(String(values[i][0])===recordId){rowIndex=i+1;break;}
      var now=Utilities.formatDate(new Date(),'GMT+05:30','yyyy-MM-dd HH:mm:ss');
      var payload=sanitizeSheetCell(body.data || {}); var operation=sanitizeSheetCell(body.operation || 'UPSERT');
      if(rowIndex>0) sheet.getRange(rowIndex,2,1,3).setValues([[operation,now,payload]]); else sheet.appendRow([sanitizeSheetCell(recordId),operation,now,payload]);
      return ok({record_id:recordId});
    }

    return fail('Unrecognized action: '+action);
  } catch(err) { return fail(err && err.message ? err.message : String(err)); }
}
