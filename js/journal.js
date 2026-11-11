/* Moodlog — journal list, search + filters, compose/edit entry, view entry */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const F = { q: '', types: { text: true, voice: true, checkin: true }, min: 1, max: 100, from: '', to: '', tags: new Set(), tagMode: 'any', photoOnly: false };
  let shown = 60;

  const isFiltered = () => !!(F.q.trim() || !F.types.text || !F.types.voice || !F.types.checkin || F.min > 1 || F.max < 100 || F.from || F.to || F.tags.size || F.photoOnly);
  const tagNames = r => (r.tags || []).map(ML.data.tagName).join(' ');

  function matches(kind, r) {
    const type = kind === 'checkin' ? 'checkin' : r.type;
    if (!F.types[type]) return false;
    if (r.mood < F.min || r.mood > F.max) return false;
    const dk = ML.dayKey(r.ts);
    if (F.from && dk < F.from) return false;
    if (F.to && dk > F.to) return false;
    if (F.photoOnly && !(kind === 'entry' && r.photoId)) return false;
    if (F.tags.size) {
      const has = [...F.tags].map(t => (r.tags || []).includes(t));
      if (F.tagMode === 'all' ? !has.every(Boolean) : !has.some(Boolean)) return false;
    }
    const q = F.q.trim().toLowerCase();
    if (q) {
      const hay = (kind === 'checkin' ? [r.label, r.note] : [r.text, r.transcript, r.moodLabel]).join(' ').toLowerCase();
      const tn = tagNames(r).toLowerCase();
      for (const tok of q.split(/\s+/)) {
        if (tok[0] === '#') { const t = tok.slice(1); if (!t || !(r.tags || []).some(id => ML.data.tagName(id).toLowerCase().startsWith(t))) return false; }
        else if (!hay.includes(tok) && !tn.includes(tok)) return false;
      }
    }
    return true;
  }

  const tagChips = r => (r.tags || []).map(id => { const t = ML.data.tag(id); return t ? '<span class="chip sm static">' + esc((t.emoji ? t.emoji + ' ' : '') + t.name) + '</span>' : ''; }).join('');
  const moodSpan = (m, label) => '<span class="entry-mood" style="color:' + ML.moodColor(m) + '"><span class="mdot" style="background:' + ML.moodColor(m) + '"></span>' + m + (label ? ' · ' + esc(label) : '') + '</span>';

  function renderFilterChips() {
    const box = $('#filter-chips'); const parts = [];
    if (!F.types.text) parts.push(['No written', () => F.types.text = true]);
    if (!F.types.voice) parts.push(['No voice', () => F.types.voice = true]);
    if (!F.types.checkin) parts.push(['No check-ins', () => F.types.checkin = true]);
    if (F.min > 1 || F.max < 100) parts.push(['Mood ' + F.min + '–' + F.max, () => { F.min = 1; F.max = 100; }]);
    if (F.from || F.to) parts.push([(F.from || '…') + ' → ' + (F.to || '…'), () => { F.from = ''; F.to = ''; }]);
    [...F.tags].forEach(id => parts.push([ML.data.tagLabel(id) || 'tag', () => F.tags.delete(id)]));
    if (F.photoOnly) parts.push(['With photo', () => F.photoOnly = false]);
    box.innerHTML = ''; box.classList.toggle('hidden', !parts.length);
    parts.forEach(([t, fn]) => { const b = document.createElement('button'); b.className = 'chip sm on'; b.textContent = t + ' ✕'; b.onclick = () => { fn(); renderJournal(); }; box.appendChild(b); });
    $('#bfilter .badge-dot').classList.toggle('hidden', !(parts.length));
  }

  function renderOTD() {
    const banner = $('#otd-banner');
    if (isFiltered()) { banner.classList.add('hidden'); return; }
    const now = new Date(), tk = ML.todayKey();
    const m = S.entries.filter(e => { const d = new Date(e.ts); return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && ML.dayKey(e.ts) !== tk; }).sort((a, b) => b.ts - a.ts);
    if (!m.length) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');
    const body = $('#otd-body'); body.innerHTML = '';
    m.forEach(e => {
      const d = document.createElement('div'); d.className = 'otd-entry';
      d.innerHTML = '<div class="otd-year">' + new Date(e.ts).getFullYear() + ' · ' + ML.fmtDT(e.ts) + '</div><div class="otd-preview">' + esc(e.transcript || e.text || '(voice note)') + '</div>' + moodSpan(e.mood, e.moodLabel);
      d.onclick = () => viewEntry(e.id); body.appendChild(d);
    });
    $('#otd-header').onclick = () => banner.classList.toggle('open');
  }

  function renderPrompt() {
    const box = $('#ci-prompt'); const last = ML.data.latestCheckin();
    const stale = !last || Date.now() - last.ts > S.settings.checkinGapHours * 3600000;
    box.classList.toggle('hidden', isFiltered() || !stale);
    if (stale) $('#ci-prompt-sub').textContent = last ? 'Last check-in ' + ML.fmtShort(last.ts) + ' · ' + ML.fmtTime(last.ts) : 'Log your mood in a few seconds';
  }

  function renderJournal() {
    renderFilterChips(); renderOTD(); renderPrompt();
    const list = $('#entries-list'); list.innerHTML = '';
    const items = [];
    S.entries.forEach(e => { if (matches('entry', e)) items.push({ k: 'entry', r: e }); });
    S.checkins.forEach(c => { if (matches('checkin', c)) items.push({ k: 'checkin', r: c }); });
    items.sort((a, b) => b.r.ts - a.r.ts);
    const rc = $('#result-count');
    rc.classList.toggle('hidden', !isFiltered()); rc.textContent = items.length + (items.length === 1 ? ' result' : ' results');
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + (isFiltered() ? '⌕' : '✦') + '</div><p>' + (isFiltered() ? 'Nothing matches your search and filters.' : 'Your journal is empty. Tap Write or Voice below, or check in with the mood badge.') + '</p></div>';
      return;
    }
    let lastDay = '';
    items.slice(0, shown).forEach(({ k, r }) => {
      const dk = ML.dayKey(r.ts);
      if (dk !== lastDay) { lastDay = dk; const h = document.createElement('div'); h.className = 'day-hdr'; h.textContent = ML.fmtDayHdr(dk); list.appendChild(h); }
      const div = document.createElement('div');
      if (k === 'checkin') {
        div.className = 'entry-item compact';
        div.innerHTML = '<div class="entry-ico">◐</div><div class="entry-main"><div class="entry-meta"><span class="entry-time">' + ML.fmtTime(r.ts) + '</span>' + moodSpan(r.mood, r.label) + '</div>' + (r.note ? '<div class="entry-preview">' + esc(r.note) + '</div>' : '') + (r.tags && r.tags.length ? '<div class="entry-tags">' + tagChips(r) + '</div>' : '') + '</div>';
        div.onclick = () => ML.openCheckin({ editId: r.id, returnTo: 'smain' });
      } else {
        div.className = 'entry-item';
        const pending = !r.synced && S.settings.scriptUrl;
        div.innerHTML = '<div class="entry-ico">' + (r.type === 'voice' ? '🎙' : '✍') + '</div><div class="entry-main"><div class="entry-meta"><span class="entry-time">' + ML.fmtTime(r.ts) + '</span>' + moodSpan(r.mood, r.moodLabel) + '</div><div class="entry-preview">' + esc(r.transcript || r.text || (r.type === 'voice' ? '(voice note)' : '(photo)')) + '</div>' + (r.tags && r.tags.length ? '<div class="entry-tags">' + tagChips(r) + '</div>' : '') + (pending ? '<div class="entry-pending">⏳ waiting to back up</div>' : '') + '</div>' + (r.photoId ? '<img class="thumb-mini" alt="" data-p="' + esc(r.photoId) + '">' : '');
        div.onclick = () => viewEntry(r.id);
      }
      list.appendChild(div);
    });
    list.querySelectorAll('img[data-p]').forEach(async im => { const u = await ML.blob.url(im.dataset.p); if (u) im.src = u; else im.remove(); });
    if (items.length > shown) { const b = document.createElement('button'); b.className = 'btn-small more-btn'; b.textContent = 'Show more (' + (items.length - shown) + ')'; b.onclick = () => { shown += 60; renderJournal(); }; list.appendChild(b); }
  }
  ML.renderJournal = renderJournal;

  // ── filter sheet ──
  function openFilters() {
    const types = [['text', '✍ Written'], ['voice', '🎙 Voice'], ['checkin', '◐ Check-ins']];
    ML.sheet('Filter', '<div><div class="field-label">Show</div><div class="chips" id="f-types"></div></div>'
      + '<div><div class="field-label">Mood range · <span id="f-rng">' + F.min + '–' + F.max + '</span></div><div class="range-pair"><input type="range" id="f-min" min="1" max="100" value="' + F.min + '"><input type="range" id="f-max" min="1" max="100" value="' + F.max + '"></div></div>'
      + '<div><div class="field-label">Dates</div><div class="range-pair"><input type="date" class="input" id="f-from" value="' + F.from + '"><span class="muted">→</span><input type="date" class="input" id="f-to" value="' + F.to + '"></div></div>'
      + '<div><div class="field-label">Tags</div><div class="chips" id="f-tags"></div><div class="set-line" style="margin-top:.6rem"><span class="hint">Match</span><div class="chips"><button class="chip sm" id="f-any">Any</button><button class="chip sm" id="f-all">All</button></div></div></div>'
      + '<div class="set-line"><span class="l">Only entries with photos</span><label class="switch"><input type="checkbox" id="f-photo"' + (F.photoOnly ? ' checked' : '') + '><span></span></label></div>'
      + '<button class="btn-primary" id="f-done">Show results</button><button class="btn-secondary" id="f-reset">Reset filters</button>', (el, close) => {
        const apply = () => { shown = 60; renderJournal(); };
        const tb = $('#f-types', el);
        const drawTypes = () => { tb.innerHTML = ''; types.forEach(([k, l]) => { const b = document.createElement('button'); b.className = 'chip' + (F.types[k] ? ' on' : ''); b.textContent = l; b.onclick = () => { F.types[k] = !F.types[k]; drawTypes(); apply(); }; tb.appendChild(b); }); };
        drawTypes();
        const rng = () => { $('#f-rng', el).textContent = F.min + '–' + F.max; };
        $('#f-min', el).oninput = e => { F.min = Math.min(+e.target.value, F.max); e.target.value = F.min; rng(); apply(); };
        $('#f-max', el).oninput = e => { F.max = Math.max(+e.target.value, F.min); e.target.value = F.max; rng(); apply(); };
        $('#f-from', el).onchange = e => { F.from = e.target.value; apply(); };
        $('#f-to', el).onchange = e => { F.to = e.target.value; apply(); };
        const drawTags = () => {
          const tg = $('#f-tags', el); tg.innerHTML = '';
          if (!S.tags.length) tg.innerHTML = '<span class="hint">No tags yet — add some when you write or check in.</span>';
          S.tags.forEach(t => { const b = document.createElement('button'); b.className = 'chip' + (F.tags.has(t.id) ? ' on' : ''); b.textContent = (t.emoji ? t.emoji + ' ' : '') + t.name; b.onclick = () => { F.tags.has(t.id) ? F.tags.delete(t.id) : F.tags.add(t.id); drawTags(); apply(); }; tg.appendChild(b); });
          $('#f-any', el).classList.toggle('on', F.tagMode === 'any'); $('#f-all', el).classList.toggle('on', F.tagMode === 'all');
        };
        drawTags();
        $('#f-any', el).onclick = () => { F.tagMode = 'any'; drawTags(); apply(); };
        $('#f-all', el).onclick = () => { F.tagMode = 'all'; drawTags(); apply(); };
        $('#f-photo', el).onchange = e => { F.photoOnly = e.target.checked; apply(); };
        $('#f-done', el).onclick = close;
        $('#f-reset', el).onclick = () => { resetFilters(); close(); };
      });
  }
  function resetFilters() {
    F.q = ''; F.types = { text: true, voice: true, checkin: true }; F.min = 1; F.max = 100; F.from = ''; F.to = ''; F.tags = new Set(); F.tagMode = 'any'; F.photoOnly = false;
    $('#q').value = ''; $('#q-clr').classList.add('hidden'); shown = 60; renderJournal();
  }
  ML.searchTag = id => { resetFilters(); F.tags.add(id); renderJournal(); ML.showTab('journal'); };

  // ── compose / edit ──
  let cId = null, cTags = new Set(), cLoc = null, cPhotoBlob = null, cPhotoRemoved = false, cHasPhoto = false, cPhotoUrl = null;

  function drawPhotoRow() {
    const row = $('#img-row'); row.querySelectorAll('.img-wrap').forEach(x => x.remove());
    if (cPhotoUrl) {
      const w = document.createElement('div'); w.className = 'img-wrap';
      w.innerHTML = '<img class="img-thumb" src="' + cPhotoUrl + '" alt="attached photo"><button class="rm" type="button">Remove</button>';
      w.querySelector('.rm').onclick = () => { cPhotoBlob = null; cPhotoUrl = null; cPhotoRemoved = true; cHasPhoto = false; drawPhotoRow(); };
      row.appendChild(w);
    }
    $('#battach').classList.toggle('hidden', !!cPhotoUrl);
  }
  ML.refreshComposeMood = () => {
    const last = ML.data.latestCheckin(); const rec = cId && S.entries.find(e => e.id === cId);
    const m = rec ? rec.mood : last ? last.mood : null, l = rec ? rec.moodLabel : last ? last.label : '';
    $('#c-mood').innerHTML = m == null ? '<span class="muted">No mood yet — tap to check in</span>' : '<b style="color:' + ML.moodColor(m) + '">' + m + '</b><span class="muted">' + esc(l || ML.moodWord(m)) + '</span>';
    $('#c-mood-note').textContent = rec ? 'Mood when you wrote this' : 'Saved with this entry · tap to update';
  };

  async function openCompose(id) {
    cId = id || null; const rec = id ? S.entries.find(e => e.id === id) : null;
    cTags = new Set(rec ? rec.tags || [] : []); cLoc = rec ? rec.loc || null : null; cPhotoBlob = null; cPhotoRemoved = false;
    cHasPhoto = !!(rec && rec.photoId); cPhotoUrl = rec && rec.photoId ? await ML.blob.url(rec.photoId) : null;
    $('#compose-title').textContent = rec ? 'Edit entry' : 'New entry';
    $('#jtxt').value = rec ? (rec.type === 'voice' ? rec.transcript || '' : rec.text || '') : '';
    ML.tagPicker($('#c-tags'), cTags);
    const has = !!cLoc; $('#loc-status').classList.toggle('has', has);
    $('#loc-txt').textContent = has ? cLoc.lat.toFixed(4) + ', ' + cLoc.lon.toFixed(4) : 'Not attached'; $('#bgetloc').textContent = has ? 'Update' : 'Add';
    $('#ss-txt').textContent = ''; $('#ss-txt').className = 'save-status'; $('#bsavetxt').disabled = false;
    drawPhotoRow(); ML.refreshComposeMood(); ML.ss('scompose');
    if (!rec) setTimeout(() => $('#jtxt').focus(), 300);
  }
  ML.openCompose = openCompose;

  async function saveCompose() {
    const text = $('#jtxt').value.trim();
    const isVoice = !!(cId && (S.entries.find(e => e.id === cId) || {}).type === 'voice');
    if (!text && !cPhotoUrl && !isVoice) { ML.toast('Write something or add a photo first'); return; }
    const btn = $('#bsavetxt'); btn.disabled = true;
    try {
      const last = ML.data.latestCheckin();
      if (cId) {
        const rec = S.entries.find(e => e.id === cId); let photoId = rec.photoId;
        if (cPhotoBlob) { photoId = 'photo:' + cId; ML.blob.invalidate(photoId); await ML.blob.put(photoId, cPhotoBlob); }
        else if (cPhotoRemoved && photoId) { await ML.blob.del(photoId); photoId = null; }
        const patch = { tags: [...cTags], loc: cLoc, photoId }; if (rec.type === 'voice') patch.transcript = text; else patch.text = text;
        if (photoId !== rec.photoId || cPhotoBlob) patch.imageUrl = null;
        ML.data.updateEntry(cId, patch);
      } else {
        const id = ML.uid(); let photoId = null;
        if (cPhotoBlob) { photoId = 'photo:' + id; await ML.blob.put(photoId, cPhotoBlob); }
        ML.data.addEntry({ id, ts: Date.now(), updatedAt: Date.now(), type: 'text', mood: last ? last.mood : 50, moodLabel: last ? last.label || '' : '', text, transcript: '', tags: [...cTags], loc: cLoc, photoId, audioId: null, imageUrl: null, driveUrl: null, synced: false, checkinId: last ? last.id : null });
      }
      ML.refreshHome(); ML.toast(cId ? 'Entry updated' : 'Entry saved'); ML.ss('smain');
    } finally { btn.disabled = false; }
  }

  // ── view ──
  let viewId = null;
  async function viewEntry(id) {
    const e = S.entries.find(x => x.id === id); if (!e) return; viewId = id;
    $('#view-title').textContent = ML.fmtLong(e.ts);
    const body = $('#view-body'); body.innerHTML = '';
    const add = html => { const d = document.createElement('div'); d.innerHTML = html; body.appendChild(d); return d; };
    add('<div class="card view-mood"><div class="num" style="color:' + ML.moodColor(e.mood) + '">' + e.mood + '</div><div class="grow"><div style="font-weight:500">' + esc(e.moodLabel || ML.moodWord(e.mood)) + '</div><div class="hint">' + ML.fmtDT(e.ts) + '</div></div></div>');
    let pills = '<span class="pill">' + (e.type === 'voice' ? '🎙 Voice' : '✍ Written') + '</span>';
    if (e.loc) pills += '<span class="pill">📍 ' + e.loc.lat.toFixed(4) + ', ' + e.loc.lon.toFixed(4) + '</span>';
    if (S.settings.scriptUrl) pills += e.synced ? '<span class="pill" style="color:var(--success)">✓ Backed up</span>' : '<span class="pill">⏳ Not backed up yet</span>';
    add('<div class="chips">' + pills + '</div>');
    if (e.tags && e.tags.length) { const d = add('<div class="field-label">Tags</div><div class="chips"></div>'); e.tags.forEach(id => { const t = ML.data.tag(id); if (!t) return; const b = document.createElement('button'); b.className = 'chip'; b.textContent = (t.emoji ? t.emoji + ' ' : '') + t.name; b.onclick = () => ML.searchTag(id); d.querySelector('.chips').appendChild(b); }); }
    if (e.text) add('<div class="field-label">Written</div><div class="view-text">' + esc(e.text) + '</div>');
    if (e.transcript) add('<div class="field-label">Transcript</div><div class="view-text">' + esc(e.transcript) + '</div>');
    if (e.photoId) { const u = await ML.blob.url(e.photoId); if (u) add('<div class="field-label">Photo</div><img class="view-img" src="' + u + '" alt="attached photo">'); }
    else if (e.imageUrl) add('<div class="field-label">Photo</div><a class="link" target="_blank" rel="noopener" href="' + esc(e.imageUrl) + '">Open in Drive ↗</a>');
    if (e.audioId) { const u = await ML.blob.url(e.audioId); if (u) add('<div class="field-label">Recording</div><audio controls preload="metadata" src="' + u + '"></audio>'); }
    else if (e.driveUrl) add('<div class="field-label">Recording</div><a class="link" target="_blank" rel="noopener" href="' + esc(e.driveUrl) + '">Open in Drive ↗</a>');
    ML.ss('sview');
  }
  ML.viewEntry = viewEntry;

  ML.initJournal = () => {
    $('#q').addEventListener('input', ML.debounce(e => { F.q = e.target.value; $('#q-clr').classList.toggle('hidden', !F.q); shown = 60; renderJournal(); }, 150));
    $('#q-clr').onclick = () => { $('#q').value = ''; F.q = ''; $('#q-clr').classList.add('hidden'); renderJournal(); };
    $('#bfilter').onclick = openFilters;
    $('#ci-prompt').onclick = () => ML.openCheckin({ returnTo: 'smain' });
    $('#btxtentry').onclick = () => openCompose();
    $('#bcompback').onclick = () => ML.ss('smain');
    $('#bsavetxt').onclick = saveCompose;
    $('#c-mood-row').onclick = () => ML.openCheckin({ returnTo: 'scompose' });
    $('#battach').onclick = () => $('#img-input').click();
    $('#img-input').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { cPhotoBlob = await ML.imageToBlob(f, 1600, 0.8); cPhotoUrl = URL.createObjectURL(cPhotoBlob); cPhotoRemoved = false; drawPhotoRow(); }
      catch (err) { ML.toast('Could not read that image'); }
    };
    $('#bgetloc').onclick = () => {
      $('#loc-txt').textContent = 'Locating…';
      if (!navigator.geolocation) { $('#loc-txt').textContent = 'Not supported'; return; }
      navigator.geolocation.getCurrentPosition(p => {
        cLoc = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        $('#loc-status').classList.add('has'); $('#loc-txt').textContent = cLoc.lat.toFixed(4) + ', ' + cLoc.lon.toFixed(4); $('#bgetloc').textContent = 'Update';
      }, err => { $('#loc-txt').textContent = cLoc ? cLoc.lat.toFixed(4) + ', ' + cLoc.lon.toFixed(4) : 'Not attached'; ML.toast('Location: ' + err.message); }, { timeout: 10000 });
    };
    $('#bviewback').onclick = () => ML.ss('smain');
    $('#view-edit').onclick = () => openCompose(viewId);
    $('#view-del').onclick = async () => {
      if (await ML.confirm('Delete entry?', 'This removes it from this device. The row in your Google Sheet is kept and marked deleted.', 'Delete', true)) {
        await ML.data.deleteEntry(viewId); ML.refreshHome(); ML.toast('Entry deleted'); ML.ss('smain');
      }
    };
  };
  ML.journalRecordLookup = { matches };
})();
