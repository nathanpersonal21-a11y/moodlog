/* Moodlog — Google Sheets / Drive backup via your Apps Script. Offline-safe queue; photos and audio are kept until uploaded. */
(function () {
  const ML = window.ML, S = ML.S;
  let running = false, legacy = false, warned = false;

  const url = () => S.settings.scriptUrl;
  async function post(payload) {
    const body = JSON.stringify(Object.assign({}, payload, S.settings.scriptToken ? { token: S.settings.scriptToken } : {}));
    const r = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
    return r.json();
  }
  ML.sync = { post };

  ML.sync.enqueue = (op, kind, id) => {
    S.queue = S.queue.filter(q => !(q.kind === kind && q.id === id));
    S.queue.push({ op, kind, id }); ML.save('queue'); ML.sync.kick();
  };
  ML.sync.kick = () => { if (url() && navigator.onLine) setTimeout(ML.sync.flush, 400); };
  ML.sync.pending = () => S.queue.length;

  async function upload(blob, name) {
    try {
      const j = await post({ action: 'uploadAudio', filename: name, mimeType: blob.type || 'application/octet-stream', data: await ML.blobToB64(blob) });
      return j && j.driveUrl ? j.driveUrl : null;
    } catch (e) { return null; }
  }

  const payload = (kind, r) => {
    const names = (r.tags || []).map(ML.data.tagName).filter(Boolean).join(', ');
    return {
      _id: r.id, kind, type: r.type, moodScore: r.mood, moodLabel: r.moodLabel || '',
      text: r.text || '', transcript: r.transcript || '', tags: names,
      timestamp: new Date(r.ts).toISOString(), updatedAt: new Date(r.updatedAt || r.ts).toISOString(),
      latitude: r.loc ? r.loc.lat : '', longitude: r.loc ? r.loc.lon : '', accuracy: r.loc ? r.loc.acc : '',
      driveUrl: r.driveUrl || '', imageUrl: r.imageUrl || '', deleted: false
    };
  };

  async function one(q) {
    if (q.op === 'delete') {
      if (legacy) return 'drop';
      const j = await post({ action: 'deleteEntry', _id: q.id });
      return j && j.success ? 'ok' : (/unknown/i.test((j && j.error) || '') ? 'drop' : 'retry');
    }
    const r = S.entries.find(x => x.id === q.id);
    if (!r) return 'drop';
    let missing = false;
    {
      if (r.photoId && !r.imageUrl) { const b = await ML.blob.get(r.photoId); if (b) { const u = await upload(b, 'moodlog-photo-' + r.id + '.jpg'); if (u) { r.imageUrl = u; ML.save('entries'); } else missing = true; } }
      if (r.audioId && !r.driveUrl) { const b = await ML.blob.get(r.audioId); if (b) { const ext = (b.type || '').includes('mp4') ? 'm4a' : 'webm'; const u = await upload(b, 'moodlog-' + r.id + '.' + ext); if (u) { r.driveUrl = u; ML.save('entries'); } else missing = true; } }
    }
    let j = await post(Object.assign({ action: legacy ? 'addEntry' : 'upsertEntry' }, payload(q.kind, r)));
    if (j && !j.success && /unknown/i.test(j.error || '') && !legacy) {
      legacy = true; if (!warned) { warned = true; ML.toast('Your Apps Script is the old version — see README to update it'); }
      j = await post(Object.assign({ action: 'addEntry' }, payload(q.kind, r)));
    }
    if (!(j && j.success)) return 'retry';
    r.synced = !missing; ML.save('entries');
    return missing ? 'retry' : 'ok';
  }

  ML.sync.flush = async () => {
    if (running || !url() || !navigator.onLine || !S.queue.length) return;
    running = true;
    try {
      for (const q of [...S.queue]) {
        let res; try { res = await one(q); } catch (e) { break; } // network problem: stop, try again later
        if (res === 'ok' || res === 'drop') { S.queue = S.queue.filter(x => !(x.kind === q.kind && x.id === q.id && x.op === q.op)); ML.save('queue'); }
      }
    } finally { running = false; ML.renderJournal && ML.renderJournal(); ML.updateSyncStatus && ML.updateSyncStatus(); }
  };

  // queue everything not yet backed up (used after setting the script URL for the first time)
  ML.sync.queueAll = () => {
    S.entries.forEach(e => { if (!S.queue.some(q => q.kind === 'entry' && q.id === e.id)) S.queue.push({ op: 'upsert', kind: 'entry', id: e.id }); });
    ML.save('queue');
  };

  ML.sync.ping = async () => { const j = await post({ action: 'ping' }); return j; };
  ML.sync.init = () => {
    window.addEventListener('online', () => { ML.toast('Back online — backing up…'); ML.sync.flush(); });
    setInterval(() => ML.sync.flush(), 5 * 60 * 1000);
    ML.sync.kick();
  };
})();
