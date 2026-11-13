/* Moodlog — data layer: localStorage for records, IndexedDB for photos/audio/images, migration from v1 */
(function () {
  const ML = window.ML;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { console.error('save failed', e); ML.toast && ML.toast('Storage is full — export a backup in Settings'); return false; }
    }
  };
  ML.LS = LS;

  const defaultSettings = () => ({
    theme: 'midnight', bgDim: 55, bgBlur: 6, hasBg: false, hasIcon: false,
    scriptUrl: '', scriptToken: '', haptics: true, lockAfter: 5, checkinGapHours: 4, confetti: true, sound: false,
    cloudProvider: 'off', cloudKey: '',
    reminders: { enabled: false, same: true, time: '20:00', days: Array.from({ length: 7 }, () => ({ on: true, time: '20:00' })), lastSync: 0 }
  });

  const S = (ML.S = { settings: defaultSettings(), checkins: [], entries: [], habits: [], habitLog: {}, tags: [], todos: [], queue: [] });
  const KEYS = { settings: 'ml2_settings', checkins: 'ml2_checkins', entries: 'ml2_entries', habits: 'ml2_habits', habitLog: 'ml2_habitlog', tags: 'ml2_tags', todos: 'ml2_todos', queue: 'ml2_queue' };
  ML.save = k => LS.set(KEYS[k], S[k]);

  // ── IndexedDB blobs ──
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const r = indexedDB.open('moodlog', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction('blobs', mode), st = t.objectStore('blobs'), req = fn(st);
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  };
  const urlCache = new Map();
  ML.blob = {
    put: (k, b) => tx('readwrite', s => s.put(b, k)).catch(e => { console.error(e); ML.toast('Could not store file on this device'); }),
    get: k => tx('readonly', s => s.get(k)).catch(() => undefined),
    del: k => { if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); } return tx('readwrite', s => s.delete(k)).catch(() => {}); },
    async url(k) {
      if (!k) return null;
      if (urlCache.has(k)) return urlCache.get(k);
      const b = await ML.blob.get(k); if (!b) return null;
      const u = URL.createObjectURL(b); urlCache.set(k, u); return u;
    },
    invalidate(k) { if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); } }
  };

  // ── records ──
  const kick = () => { ML.sync && ML.sync.kick && ML.sync.kick(); };
  const enqueue = (op, kind, id, ts) => { ML.sync && ML.sync.enqueue(op, kind, id, ts); };

  ML.data = {
    addEntry(e) { S.entries.push(e); ML.save('entries'); enqueue('upsert', 'entry', e.id); return e; },
    updateEntry(id, patch) {
      const e = S.entries.find(x => x.id === id); if (!e) return null;
      Object.assign(e, patch, { updatedAt: Date.now(), synced: false }); ML.save('entries'); enqueue('upsert', 'entry', id); return e;
    },
    async deleteEntry(id) {
      const e = S.entries.find(x => x.id === id); if (!e) return;
      S.entries = S.entries.filter(x => x.id !== id); ML.save('entries');
      if (e.photoId) await ML.blob.del(e.photoId);
      if (e.audioId) await ML.blob.del(e.audioId);
      enqueue('delete', 'entry', id, e.ts);
    },
    latestEntry() { return S.entries.reduce((a, c) => (!a || c.ts > a.ts ? c : a), null); },

    // tags
    tag: id => S.tags.find(t => t.id === id),
    tagName: id => { const t = S.tags.find(x => x.id === id); return t ? t.name : ''; },
    addTag(name, emoji) {
      name = String(name || '').trim().slice(0, 24); if (!name) return null;
      const ex = S.tags.find(t => t.name.toLowerCase() === name.toLowerCase()); if (ex) return ex;
      const t = { id: ML.uid(), name, emoji: (emoji || '').trim().slice(0, 4) }; S.tags.push(t); ML.save('tags'); return t;
    },
    renameTag(id, name, emoji) { const t = S.tags.find(x => x.id === id); if (!t) return; t.name = String(name).trim().slice(0, 24) || t.name; t.emoji = (emoji || '').trim().slice(0, 4); ML.save('tags'); },
    deleteTag(id) {
      S.tags = S.tags.filter(t => t.id !== id); ML.save('tags');
      let ce = false;
      S.entries.forEach(e => { if ((e.tags || []).includes(id)) { e.tags = e.tags.filter(x => x !== id); e.synced = false; enqueue('upsert', 'entry', e.id); ce = true; } });
      if (ce) ML.save('entries');
    },
    tagLabel(id) { const t = S.tags.find(x => x.id === id); return t ? ((t.emoji ? t.emoji + ' ' : '') + t.name) : ''; },

    // habits
    scheduled(h, date) { return !h.days || h.days.length === 0 || h.days.includes(date.getDay()); },
    habitDone(id, key) { return (S.habitLog[key] || []).includes(id); },
    toggleHabit(id, key) {
      const arr = S.habitLog[key] || (S.habitLog[key] = []), i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      if (!arr.length) delete S.habitLog[key];
      ML.save('habitLog'); return i < 0;
    },
    streak(h) {
      let n = 0; const now = new Date();
      for (let i = 0; i < 730; i++) {
        const d = ML.addDays(now, -i);
        if (!ML.data.scheduled(h, d)) continue;
        if (ML.data.habitDone(h.id, ML.dayKey(d))) n++; else if (i > 0) break;
      }
      return n;
    },
    rate(h, days) {
      let sched = 0, done = 0; const now = new Date();
      for (let i = 0; i < days; i++) {
        const d = ML.addDays(now, -i); if (!ML.data.scheduled(h, d)) continue;
        if (h.created && ML.dayKey(d) < ML.dayKey(h.created)) continue;
        sched++; if (ML.data.habitDone(h.id, ML.dayKey(d))) done++;
      }
      return sched ? done / sched : null;
    }
  };

  // ── load + migrate ──
  ML.loadStore = async function () {
    const st = LS.get(KEYS.settings, null);
    if (st) { const d = defaultSettings(); S.settings = Object.assign(d, st, { reminders: Object.assign(d.reminders, st.reminders || {}) }); }
    S.checkins = LS.get(KEYS.checkins, []); S.entries = LS.get(KEYS.entries, []); S.habits = LS.get(KEYS.habits, []);
    S.habitLog = LS.get(KEYS.habitLog, {}); S.tags = LS.get(KEYS.tags, []); S.todos = LS.get(KEYS.todos, []); S.queue = LS.get(KEYS.queue, []);
    foldCheckinsIntoEntries();
    if (!localStorage.getItem('ml2_migrated')) {
      try { await migrate(); } catch (e) { console.error('migration failed', e); }
      try { localStorage.setItem('ml2_migrated', '1'); } catch (e) {}
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  };

  // Check-ins used to be a separate record. Mood now lives on the entry itself, so any old check-in becomes a mood-only entry.
  function foldCheckinsIntoEntries() {
    const old = LS.get(KEYS.checkins, []);
    let changed = false;
    old.forEach(c => {
      if (c.legacy) return; // these only duplicated moods that old entries already carry
      if (S.entries.some(e => e.id === c.id)) return;
      const e = { id: c.id, ts: c.ts, updatedAt: c.updatedAt || c.ts, type: 'text', mood: c.mood, moodLabel: c.label || '', text: c.note || '', transcript: '', tags: c.tags || [], loc: null, photoId: null, audioId: null, imageUrl: null, driveUrl: null, synced: !!c.synced };
      S.entries.push(e); changed = true;
      if (!e.synced) S.queue.push({ op: 'upsert', kind: 'entry', id: e.id });
    });
    let qChanged = false;
    S.queue.forEach(q => { if (q.kind === 'checkin') { q.kind = 'entry'; qChanged = true; } });
    if (old.length || localStorage.getItem(KEYS.checkins) !== null) { try { localStorage.removeItem(KEYS.checkins); } catch (e) {} }
    S.checkins = [];
    if (changed) ML.save('entries'); if (changed || qChanged) ML.save('queue');
  }

  async function migrate() {
    const oldEntries = LS.get('ml_entries', null), oldHabits = LS.get('ml_habits', null);
    if (oldEntries === null && oldHabits === null) return;
    const url = localStorage.getItem('ml_script_url'); if (url && !S.settings.scriptUrl) S.settings.scriptUrl = url;
    for (const o of (oldEntries || [])) {
      const id = String(o.id);
      if (S.entries.some(e => e.id === id)) continue;
      const e = { id, ts: o.ts, updatedAt: o.ts, type: o.type === 'voice' ? 'voice' : 'text', mood: o.mood || 50, moodLabel: o.moodLabel || '', text: o.text || '', transcript: o.transcript || '', tags: [], loc: o.loc || null, photoId: null, audioId: null, imageUrl: o.imageUrl || null, driveUrl: o.driveUrl || null, synced: !!o.synced };
      if (o.imgB64) {
        try { const r = await fetch(o.imgB64); const b = await r.blob(); e.photoId = 'photo:' + id; await ML.blob.put(e.photoId, b); } catch (err) {}
      }
      S.entries.push(e);
    }
    S.queue = S.entries.filter(e => !e.synced).map(e => ({ op: 'upsert', kind: 'entry', id: e.id }));
    for (const h of (oldHabits || [])) S.habits.push({ id: String(h.id), name: h.name, emoji: '✨', days: [], created: Number(h.id) || Date.now() });
    const log = LS.get('ml_habit_log', {});
    Object.keys(log).forEach(k => { const d = new Date(k); if (isNaN(d)) return; const key = ML.dayKey(d); S.habitLog[key] = (log[k] || []).map(String); });
    ['entries', 'habits', 'habitLog', 'queue', 'settings'].forEach(ML.save);
  }
})();
