/**
 * Moodlog backup + reminders — Google Apps Script  (version 2)
 *
 * Paste this whole file into your Apps Script project (replace the old code), then:
 *   1. Run the function  authorize  once (▶ Run) and accept the permission prompts.
 *   2. Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.
 *      (Keep: Execute as "Me", Who has access "Anyone".)  The web app URL stays the same.
 *
 * What it does
 *   • Saves every entry / check-in to the "Entries" sheet (adds or updates the row — never duplicates).
 *   • Marks deleted entries instead of removing their rows, so the sheet stays a full backup.
 *   • Saves photos and voice recordings to a "Moodlog" folder in your Google Drive.
 *   • Creates repeating Google Calendar events with a popup alert = your phone reminders.
 */

// OPTIONAL: if you set a secret here, enter the same text in Moodlog → Settings → Secret.
const SECRET = '';
// OPTIONAL: leave empty when this script was created from inside your Google Sheet (Extensions → Apps Script).
// If the script is standalone, paste the Sheet's ID (the long text in its URL between /d/ and /edit).
const SHEET_ID = '';

const VERSION = '2';
const SHEET_NAME = 'Entries';
const DRIVE_FOLDER = 'Moodlog';
const HEADERS = ['_id', 'timestamp', 'type', 'moodScore', 'moodLabel', 'text', 'transcript', 'tags', 'latitude', 'longitude', 'accuracy', 'driveUrl', 'imageUrl', 'updatedAt', 'deleted'];
const REMINDER_TITLE = 'Moodlog check-in';

function authorize() {
  // Touching each service makes Google show the permission prompt once.
  if (SHEET_ID) SpreadsheetApp.openById(SHEET_ID); else SpreadsheetApp.getActiveSpreadsheet();
  DriveApp.getRootFolder();
  CalendarApp.getDefaultCalendar();
  Logger.log('Authorized. Now deploy a new version.');
}

function doGet() { return json_({ success: true, version: VERSION, message: 'Moodlog script is running' }); }

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json_({ success: false, error: 'Bad request' }); }
  if (SECRET && p.token !== SECRET) return json_({ success: false, error: 'Wrong secret' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    switch (p.action) {
      case 'ping': return json_({ success: true, version: VERSION });
      case 'addEntry':
      case 'upsertEntry': return json_(upsert_(p));
      case 'deleteEntry': return json_(markDeleted_(p));
      case 'uploadAudio': return json_(upload_(p));
      case 'setReminders': return json_(setReminders_(p));
      case 'testReminder': return json_(testReminder_(p));
      default: return json_({ success: false, error: 'Unknown action: ' + p.action });
    }
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ───────────────────────── sheet ─────────────────────────
function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet: create this script from inside your Sheet, or set SHEET_ID at the top.');
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}
// header names are compared ignoring case, spaces and underscores, so "Mood Score" and "moodScore" are the same column
const norm_ = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// returns {sheet, cols: {normalizedHeader: columnNumber}}; adds any missing columns at the end (existing columns are left alone)
function prepare_() {
  const sh = sheet_();
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  let width = Math.max(sh.getLastColumn(), 1);
  let head = sh.getRange(1, 1, 1, width).getValues()[0];
  const cols = {};
  head.forEach((h, i) => { if (h !== '') cols[norm_(h)] = i + 1; });
  HEADERS.forEach(h => {
    if (!cols[norm_(h)]) { width++; sh.getRange(1, width).setValue(h).setFontWeight('bold'); cols[norm_(h)] = width; }
  });
  return { sh, cols };
}

function findRow_(sh, idCol, id) {
  const last = sh.getLastRow(); if (last < 2) return 0;
  const vals = sh.getRange(2, idCol, last - 1, 1).getValues();
  const want = String(id);
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === want) return i + 2;
  return 0;
}

function upsert_(p) {
  const { sh, cols } = prepare_();
  const c = n => cols[norm_(n)];
  const idCol = c('_id');
  let row = findRow_(sh, idCol, p._id);
  const isNew = !row;
  if (isNew) row = sh.getLastRow() + 1;
  const set = (name, val) => { const col = c(name); if (col) sh.getRange(row, col).setValue(val); };
  if (isNew) { sh.getRange(row, idCol).setNumberFormat('@'); }
  set('_id', String(p._id));
  set('timestamp', p.timestamp || '');
  set('type', p.type || '');
  set('moodScore', p.moodScore);
  set('moodLabel', p.moodLabel || '');
  set('text', p.text || '');
  set('transcript', p.transcript || '');
  set('tags', p.tags || '');
  set('latitude', p.latitude === undefined ? '' : p.latitude);
  set('longitude', p.longitude === undefined ? '' : p.longitude);
  set('accuracy', p.accuracy === undefined ? '' : p.accuracy);
  if (p.driveUrl) set('driveUrl', p.driveUrl);
  if (p.imageUrl) set('imageUrl', p.imageUrl);
  set('updatedAt', p.updatedAt || new Date().toISOString());
  set('deleted', '');
  return { success: true, row: row, created: isNew };
}

function markDeleted_(p) {
  const { sh, cols } = prepare_();
  const row = findRow_(sh, cols['id'], p._id);
  if (row) { sh.getRange(row, cols['deleted']).setValue('DELETED ' + new Date().toISOString()); sh.getRange(row, 1, 1, sh.getLastColumn()).setFontColor('#999999'); }
  return { success: true, found: !!row };
}

// ───────────────────────── drive ─────────────────────────
function upload_(p) {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mimeType || 'application/octet-stream', p.filename || ('moodlog-' + Date.now()));
  const file = folder.createFile(blob);
  return { success: true, driveUrl: file.getUrl() };
}

// ───────────────────────── reminders (Google Calendar) ─────────────────────────
function removeReminderSeries_(cal) {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 8 * 86400000);
  const seen = {};
  cal.getEvents(from, to, { search: REMINDER_TITLE }).forEach(ev => {
    if (ev.getTitle() !== REMINDER_TITLE) return;
    try {
      const s = ev.getEventSeries(); const id = s.getId();
      if (seen[id]) return; seen[id] = 1; s.deleteEventSeries();
    } catch (err) { try { ev.deleteEvent(); } catch (e2) {} }
  });
}

function setReminders_(p) {
  const cal = CalendarApp.getDefaultCalendar();
  removeReminderSeries_(cal);
  if (!p.enabled || !p.days || !p.days.length) return { success: true, created: 0 };
  const W = [CalendarApp.Weekday.SUNDAY, CalendarApp.Weekday.MONDAY, CalendarApp.Weekday.TUESDAY, CalendarApp.Weekday.WEDNESDAY, CalendarApp.Weekday.THURSDAY, CalendarApp.Weekday.FRIDAY, CalendarApp.Weekday.SATURDAY];
  const now = new Date(); let made = 0;
  p.days.forEach(d => {
    const hm = String(d.time || '20:00').split(':'), h = +hm[0] || 0, m = +hm[1] || 0;
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    let add = (d.dow - start.getDay() + 7) % 7;
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + add, h, m, 0);
    if (start.getTime() < now.getTime()) start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, h, m, 0);
    const end = new Date(start.getTime() + 10 * 60000);
    const series = cal.createEventSeries(REMINDER_TITLE, start, end, CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(W[d.dow]), { description: 'How are you feeling? ' + (p.appUrl || '') });
    series.removeAllReminders(); series.addPopupReminder(0);
    made++;
  });
  return { success: true, created: made, timeZone: Session.getScriptTimeZone() };
}

function testReminder_(p) {
  const cal = CalendarApp.getDefaultCalendar();
  const start = new Date(Date.now() + 2 * 60000), end = new Date(start.getTime() + 5 * 60000);
  const ev = cal.createEvent('Moodlog test reminder', start, end, { description: 'If you can see this on your phone, reminders work. ' + (p.appUrl || '') });
  ev.removeAllReminders(); ev.addPopupReminder(1);
  return { success: true, timeZone: Session.getScriptTimeZone() };
}
