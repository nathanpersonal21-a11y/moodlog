/**
 * Moodlog backup + reminders — Google Apps Script  (version 4)
 *
 * Uses YOUR ORIGINAL sheet layout — no new columns are ever created:
 *   A Timestamp (ISO) | B Timestamp (Readable) | C Mood Score | D Mood Label | E Entry Type | F Written Text
 *   G Voice Transcript | H Latitude | I Longitude | J GPS Accuracy (m) | K Audio Drive URL | L Image
 * (F and G show the first 5 words; the full text is in the cell note — hover / tap the cell. Tags are in F's note too.)
 *
 * Paste this whole file into your Apps Script project (replace the old code), then:
 *   1. Run  authorize  once (▶ Run) and accept the permission prompts.
 *   2. Optional, once: Run  repairSheet  to move rows written by the earlier version into the layout above
 *      (make a copy of the Sheet first: File → Make a copy).
 *   3. Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy. The web app URL stays the same.
 *
 * Edited entries update their own row (matched by the ISO timestamp in column A). Deleted entries are greyed out and
 * struck through, not removed. Photos and voice recordings go to the "Moodlog Audio" folder in Google Drive.
 * Reminders are repeating Google Calendar events with a popup alert.
 */

// OPTIONAL: if you set a secret here, enter the same text in Moodlog → Settings → Secret.
const SECRET = '';
// OPTIONAL: leave empty when this script was created from inside your Google Sheet (Extensions → Apps Script).
const SHEET_ID = '';

const VERSION = '4';
const SHEET_NAME = 'Entries';
const DRIVE_FOLDER_NAME = 'Moodlog Audio';
const HEADERS = ['Timestamp (ISO)', 'Timestamp (Readable)', 'Mood Score', 'Mood Label', 'Entry Type', 'Written Text', 'Voice Transcript', 'Latitude', 'Longitude', 'GPS Accuracy (m)', 'Audio Drive URL', 'Image'];
const NCOL = HEADERS.length;
const REMINDER_TITLE = 'Moodlog journal';
const OLD_TITLES = ['Moodlog check-in']; // reminders made by earlier versions get cleaned up too

function authorize() {
  getSheet_();
  DriveApp.getRootFolder();
  CalendarApp.getDefaultCalendar();
  Logger.log('Authorized. Now deploy a new version.');
}
function setup() { getSheet_(); getFolder_(); Logger.log('Setup complete.'); }

function doGet() { return json_({ success: true, status: 'ok', version: VERSION, message: 'Moodlog API running' }); }

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
      case 'uploadAudio':
      case 'uploadImage': return json_(upload_(p));
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

// ───────────────────────── sheet (original layout) ─────────────────────────
function getSheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet: create this script from inside your Sheet, or set SHEET_ID at the top.');
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, NCOL).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#c8a96e');
    sh.setFrozenRows(1);
    [200, 180, 100, 120, 90, 160, 160, 100, 100, 120, 160, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, NCOL).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#c8a96e');
  }
  return sh;
}

function words5_(str) {
  if (!str || !String(str).trim()) return '';
  const w = String(str).trim().split(/\s+/);
  return w.length <= 5 ? String(str) : w.slice(0, 5).join(' ') + '…';
}

function readable_(iso) {
  const d = new Date(iso); if (isNaN(d.getTime())) return new Date().toLocaleString('en-US');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d/yyyy, h:mm:ss a');
}

// find the row whose column A holds this entry's ISO timestamp (works whether Sheets kept it as text or turned it into a date)
function findRow_(sh, iso) {
  const last = sh.getLastRow(); if (last < 2) return 0;
  const want = Date.parse(iso); if (isNaN(want)) return 0;
  const vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0]; if (v === '' || v === null) continue;
    const t = (v instanceof Date) ? v.getTime() : Date.parse(String(v));
    if (!isNaN(t) && Math.abs(t - want) <= 1) return i + 2;
  }
  return 0;
}

function writeRow_(sh, row, p, isNew) {
  const text = p.text || '', tr = p.transcript || '', tags = p.tags || '';
  const a = sh.getRange(row, 1); a.setNumberFormat('@'); a.setValue(p.timestamp || new Date().toISOString());
  if (isNew) sh.getRange(row, 2).setValue(readable_(p.timestamp));
  sh.getRange(row, 3, 1, 3).setValues([[p.moodScore === undefined || p.moodScore === null ? '' : p.moodScore, p.moodLabel || '', p.type || 'text']]);
  sh.getRange(row, 6, 1, 2).setValues([[words5_(text), words5_(tr)]]);
  const f = sh.getRange(row, 6), g = sh.getRange(row, 7);
  f.setNote((text ? '📝 Full entry:\n\n' + text : '') + (tags ? (text ? '\n\n' : '') + '🏷 Tags: ' + tags : ''));
  g.setNote(tr ? '🎙 Full transcript:\n\n' + tr : '');
  sh.getRange(row, 6, 1, 2).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sh.getRange(row, 8, 1, 3).setValues([[p.latitude || '', p.longitude || '', p.accuracy || '']]);
  if (p.driveUrl) sh.getRange(row, 11).setFormula('=HYPERLINK("' + p.driveUrl + '","▶ Play audio")');
  if (p.imageUrl) sh.getRange(row, 12).setFormula('=HYPERLINK("' + p.imageUrl + '","🖼 View image")');
  try { sh.getRange(row, 1, 1, NCOL).setFontColor(null).setFontLine('none'); } catch (e) {}
}

function upsert_(p) {
  if (!p.timestamp) p.timestamp = new Date().toISOString();
  const sh = getSheet_();
  let row = findRow_(sh, p.timestamp);
  const isNew = !row;
  if (isNew) row = sh.getLastRow() + 1;
  writeRow_(sh, row, p, isNew);
  return { success: true, row: row, created: isNew };
}

function markDeleted_(p) {
  const sh = getSheet_();
  const row = p.timestamp ? findRow_(sh, p.timestamp) : 0;
  if (row) {
    const r = sh.getRange(row, 1, 1, NCOL);
    r.setFontColor('#999999').setFontLine('line-through');
    sh.getRange(row, 1).setNote('Deleted in Moodlog ' + new Date().toISOString());
  }
  return { success: true, found: !!row };
}

// One-time clean-up for rows written by the earlier version (v2/v3), which put data in extra columns on the right.
// It moves everything into the original layout and removes those extra columns. Make a copy of the Sheet first.
function repairSheet() {
  const sh = getSheet_();
  const EXTRA = ['_id', 'timestamp', 'type', 'text', 'transcript', 'tags', 'latitude', 'longitude', 'accuracy', 'driveUrl', 'imageUrl', 'updatedAt', 'deleted'];
  const lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lr < 1 || lc < 1) { Logger.log('Nothing to repair.'); return; }
  const head = sh.getRange(1, 1, 1, lc).getValues()[0];
  const col = {}; head.forEach((h, i) => { if (i >= NCOL - 1 && EXTRA.indexOf(h) >= 0 && col[h] === undefined) col[h] = i; });
  if (col['timestamp'] === undefined && col['_id'] === undefined) { Logger.log('No extra columns found — nothing to repair.'); return; }
  const data = lr > 1 ? sh.getRange(2, 1, lr - 1, lc).getValues() : [];
  let moved = 0;
  data.forEach((r, i) => {
    const get = n => (col[n] === undefined ? '' : r[col[n]]);
    const ts = get('timestamp'); if (!ts) return;
    const iso = (ts instanceof Date) ? ts.toISOString() : String(ts);
    const row = i + 2;
    writeRow_(sh, row, {
      timestamp: iso, type: get('type') || r[4], moodScore: r[2], moodLabel: r[3],
      text: get('text'), transcript: get('transcript'), tags: get('tags'),
      latitude: r[7], longitude: r[8], accuracy: r[9], driveUrl: get('driveUrl'), imageUrl: get('imageUrl')
    }, !r[1]);
    if (get('deleted')) { sh.getRange(row, 1, 1, NCOL).setFontColor('#999999').setFontLine('line-through'); }
    moved++;
  });
  Object.keys(col).map(k => col[k]).sort((x, y) => y - x).forEach(ci => sh.deleteColumn(ci + 1)); // right-to-left
  Logger.log('Repaired ' + moved + ' rows and removed the extra columns.');
}

// ───────────────────────── drive ─────────────────────────
function getFolder_() {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}
function upload_(p) {
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mimeType || 'application/octet-stream', p.filename || ('moodlog-file-' + Date.now()));
  const file = getFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { success: true, driveUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
}

// ───────────────────────── reminders (Google Calendar) ─────────────────────────
function removeReminderSeries_(cal) {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 8 * 86400000);
  const seen = {};
  [REMINDER_TITLE].concat(OLD_TITLES).forEach(title => cal.getEvents(from, to, { search: title }).forEach(ev => {
    if (ev.getTitle() !== title) return;
    try {
      const s = ev.getEventSeries(); const id = s.getId();
      if (seen[id]) return; seen[id] = 1; s.deleteEventSeries();
    } catch (err) { try { ev.deleteEvent(); } catch (e2) {} }
  }));
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
    const series = cal.createEventSeries(REMINDER_TITLE, start, end, CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(W[d.dow]), { description: 'Time to journal — how are you feeling? ' + (p.appUrl || '') });
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
