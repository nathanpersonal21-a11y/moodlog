/* Moodlog — settings tab */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const pick = (accept, cb) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); };
  const sw = (id, on) => '<label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span></span></label>';

  function render() {
    const body = $('#settings-body'); if (!body) return;
    const st = S.settings, rm = st.reminders;
    let h = '';
    // Appearance
    h += '<div class="set-sec"><div class="set-h">Appearance</div><div class="themes" id="s-themes">' + Object.entries(ML.THEMES).map(([id, t]) => '<button class="theme-sw' + (st.theme === id ? ' on' : '') + '" data-t="' + id + '"><div class="sw" style="background:' + t.bg + '"><i style="background:' + t.accent + '"></i><i style="background:' + t.bg3 + '"></i></div><div class="nm">' + t.label + '</div></button>').join('') + '</div>'
      + '<div class="card" style="display:flex;flex-direction:column;gap:.8rem"><div class="set-line"><div><div class="l">Background picture</div><div class="d">Shown behind the whole app.</div></div><div class="chips"><button class="chip sm" id="s-bg">Choose</button>' + (st.hasBg ? '<button class="chip sm" id="s-bg-rm">Remove</button>' : '') + '</div></div>'
      + (st.hasBg ? '<div><div class="field-label">Dim · ' + st.bgDim + '%</div><input type="range" id="s-dim" min="0" max="90" value="' + st.bgDim + '"></div><div><div class="field-label">Blur cards · ' + st.bgBlur + 'px</div><input type="range" id="s-blur" min="0" max="20" value="' + st.bgBlur + '"></div>' : '')
      + '</div><div class="card"><div class="set-line"><div class="row"><img class="icon-prev" id="s-icon-prev" alt="" src="icons/icon-192.png"><div><div class="l">App icon</div><div class="d">Changes the logo inside the app now. iPhone fixes the Home Screen icon when you add the app, so remove and re-add it to see a new one.</div></div></div></div><div class="chips" style="margin-top:.7rem"><button class="chip sm" id="s-icon">Choose picture</button>' + (st.hasIcon ? '<button class="chip sm" id="s-icon-rm">Reset</button>' : '') + '</div></div></div>';
    // Reminders
    h += '<div class="set-sec"><div class="set-h">Reminders</div><div class="card" style="display:flex;flex-direction:column;gap:.9rem"><div class="set-line"><div><div class="l">Daily journal reminder</div><div class="d">Arrives as a notification from your phone’s calendar app (set up in Backup below).</div></div>' + sw('s-rem', rm.enabled) + '</div>';
    if (rm.enabled) {
      h += '<div class="set-line"><span class="l">Same time every day</span>' + sw('s-same', rm.same) + '</div>';
      if (rm.same) h += '<div class="set-line"><span class="l">Time</span><input type="time" class="input" id="s-time" value="' + rm.time + '" style="width:auto"></div>';
      else h += ML.DOWN.map((d, i) => '<div class="set-line"><div class="row"><label class="switch"><input type="checkbox" class="s-dayon" data-i="' + i + '"' + (rm.days[i].on ? ' checked' : '') + '><span></span></label><span class="l">' + d + '</span></div><input type="time" class="input s-daytime" data-i="' + i + '" value="' + rm.days[i].time + '" style="width:auto"></div>').join('');
      h += '<button class="btn-primary" id="s-rem-save">Save reminders to my calendar</button><button class="btn-secondary" id="s-rem-test">Send a test reminder</button><div class="hint" id="s-rem-msg">' + (rm.lastSync ? 'Last saved ' + ML.fmtDT(rm.lastSync) : 'Not saved to your calendar yet.') + '</div>';
    }
    h += '</div></div>';
    // Backup
    h += '<div class="set-sec"><div class="set-h">Backup to Google Sheets</div><div class="card" style="display:flex;flex-direction:column;gap:.8rem"><div><div class="field-label">Apps Script web app URL</div><input type="url" class="input mono" id="s-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(st.scriptUrl) + '" style="font-size:12.5px"></div><div><div class="field-label">Secret (optional)</div><input type="text" class="input mono" id="s-token" placeholder="only if you set SECRET in the script" value="' + esc(st.scriptToken) + '" style="font-size:12.5px"></div><button class="btn-primary" id="s-url-save">Save &amp; test connection</button><div class="set-line"><div class="hint" id="s-sync-msg"></div><button class="btn-small" id="s-sync-now">Back up now</button></div></div></div>';
    // Tags
    h += '<div class="set-sec"><div class="set-h">Tags</div><div class="card"><div id="s-tags"></div><button class="btn-small" id="s-tag-add" style="margin-top:.4rem">＋ New tag</button></div></div>';
    // Voice
    h += '<div class="set-sec"><div class="set-h">Voice transcription</div><div class="card" style="display:flex;flex-direction:column;gap:.8rem"><div class="hint">By default voice notes use your phone’s built-in speech recognition. When you’re online you can also let a better cloud model re-transcribe each recording (nothing to download). It needs your own API key — Groq has a free tier. The key stays on this device.</div><select class="select" id="s-cloud"><option value="off"' + (st.cloudProvider === 'off' ? ' selected' : '') + '>Phone speech recognition only</option><option value="groq"' + (st.cloudProvider === 'groq' ? ' selected' : '') + '>Cloud model — Groq (free tier)</option><option value="openai"' + (st.cloudProvider === 'openai' ? ' selected' : '') + '>Cloud model — OpenAI (paid)</option></select>' + (st.cloudProvider !== 'off' ? '<input type="password" class="input mono" id="s-cloudkey" placeholder="API key" value="' + esc(st.cloudKey) + '" autocomplete="off" style="font-size:12.5px">' : '') + '</div></div>';
    // Lock & feel
    h += '<div class="set-sec"><div class="set-h">Lock &amp; feel</div><div class="card" style="display:flex;flex-direction:column;gap:.9rem"><div class="set-line"><div><div class="l">Lock again after being away</div><div class="d">Passcode screen when you come back to the app.</div></div><select class="select" id="s-lock" style="width:auto"><option value="0">Immediately</option><option value="1">1 minute</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option><option value="-1">Only on app start</option></select></div><div class="set-line"><div><div class="l">Haptic feedback</div><div class="d">Little taps on the dial and buttons.</div></div>' + sw('s-hap', st.haptics) + '</div><div class="set-line"><div><div class="l">Ask my mood when I open the app</div><div class="d">Shows the mood dial at start unless you logged within this long.</div></div><select class="select" id="s-gap" style="width:auto"><option value="0">Every time</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24">1 day</option></select></div></div></div>';
    h += '<div class="set-sec"><div class="set-h">Celebrations</div><div class="card" style="display:flex;flex-direction:column;gap:.9rem"><div class="set-line"><div><div class="l">Confetti</div><div class="d">When you tick off a to-do or a habit.</div></div>' + sw('s-conf', st.confetti !== false) + '</div><div class="set-line"><div><div class="l">Celebration sound</div><div class="d">A little chime with the confetti. The iPhone silent switch mutes it.</div></div>' + sw('s-snd', !!st.sound) + '</div><button class="btn-secondary" id="s-celeb">🎉 Try it</button></div></div>';
    // Data
    h += '<div class="set-sec"><div class="set-h">Your data</div><div class="card" style="display:flex;flex-direction:column;gap:.7rem"><div class="hint" id="s-storage">Calculating storage…</div><button class="btn-secondary" id="s-export">Export backup (JSON)</button><button class="btn-secondary" id="s-import">Import backup</button></div><div class="hint" style="text-align:center">Moodlog v2 · everything is stored on this device' + (st.scriptUrl ? ' and backed up to your sheet' : '') + '</div></div>';
    body.innerHTML = h; wire(body); fillDynamic(body);
  }

  function fillDynamic(body) {
    $('#s-lock', body).value = String(S.settings.lockAfter); $('#s-gap', body).value = String(S.settings.checkinGapHours);
    ML.blob.url('icon').then(u => { if (u && S.settings.hasIcon) $('#s-icon-prev', body).src = u; });
    renderTags(body); ML.updateSyncStatus();
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { const el = $('#s-storage', body); if (el) el.textContent = 'Storage used: ' + (e.usage / 1048576).toFixed(1) + ' MB' + (e.quota ? ' of ' + Math.round(e.quota / 1048576) + ' MB available' : '') + ' · ' + S.entries.length + ' entries, ' + S.todos.length + ' tasks'; });
    else $('#s-storage', body).textContent = S.entries.length + ' entries, ' + S.todos.length + ' tasks';
  }

  ML.updateSyncStatus = () => {
    const el = $('#s-sync-msg'); if (!el) return;
    el.textContent = !S.settings.scriptUrl ? 'Backup is off — paste your script URL to turn it on.' : (S.queue.length ? S.queue.length + ' item' + (S.queue.length > 1 ? 's' : '') + ' waiting to back up' : '✓ Everything is backed up');
  };

  function renderTags(body) {
    const box = $('#s-tags', body); box.innerHTML = '';
    if (!S.tags.length) { box.innerHTML = '<div class="hint">No tags yet.</div>'; return; }
    S.tags.forEach(t => {
      const row = document.createElement('div'); row.className = 'tag-row';
      row.innerHTML = '<input class="input" value="' + esc(t.emoji) + '" maxlength="4" style="width:58px;text-align:center" aria-label="emoji"><input class="input grow" value="' + esc(t.name) + '" maxlength="24" aria-label="name"><button class="btn-icon" style="width:36px;height:36px" title="Search this tag">⌕</button><button class="btn-icon" style="width:36px;height:36px;color:var(--danger)" title="Delete">✕</button>';
      const [em, nm, sr, dl] = row.children;
      const save = () => ML.data.renameTag(t.id, nm.value, em.value);
      em.onchange = save; nm.onchange = save;
      sr.onclick = () => ML.searchTag(t.id);
      dl.onclick = async () => { if (await ML.confirm('Delete tag?', 'Removes "' + t.name + '" from every entry.', 'Delete', true)) { ML.data.deleteTag(t.id); renderTags(body); ML.renderJournal(); } };
      box.appendChild(row);
    });
  }

  function wire(body) {
    body.querySelectorAll('.theme-sw').forEach(b => b.onclick = () => { S.settings.theme = b.dataset.t; ML.save('settings'); ML.applyTheme(); ML.haptic('tick'); render(); });
    $('#s-bg', body).onclick = () => pick('image/*', async f => { try { await ML.setBackground(f); render(); } catch (e) { ML.toast('Could not use that picture'); } });
    const rb = $('#s-bg-rm', body); if (rb) rb.onclick = async () => { await ML.clearBackground(); render(); };
    const dim = $('#s-dim', body); if (dim) dim.oninput = e => { S.settings.bgDim = +e.target.value; ML.save('settings'); ML.applyTheme(); e.target.previousElementSibling.textContent = 'Dim · ' + e.target.value + '%'; };
    const bl = $('#s-blur', body); if (bl) bl.oninput = e => { S.settings.bgBlur = +e.target.value; ML.save('settings'); ML.applyTheme(); e.target.previousElementSibling.textContent = 'Blur cards · ' + e.target.value + 'px'; };
    $('#s-icon', body).onclick = () => pick('image/*', async f => { try { await ML.setIcon(f); render(); ML.toast('Icon updated'); } catch (e) { ML.toast('Could not use that picture'); } });
    const ri = $('#s-icon-rm', body); if (ri) ri.onclick = async () => { await ML.clearIcon(); render(); };

    const rm = S.settings.reminders;
    $('#s-rem', body).onchange = async e => { rm.enabled = e.target.checked; ML.save('settings'); render(); if (!rm.enabled && S.settings.scriptUrl) { try { await ML.reminders.push(); ML.toast('Reminders turned off'); } catch (x) {} } };
    const same = $('#s-same', body); if (same) same.onchange = e => { rm.same = e.target.checked; ML.save('settings'); render(); };
    const tm = $('#s-time', body); if (tm) tm.onchange = e => { rm.time = e.target.value || '20:00'; ML.save('settings'); };
    body.querySelectorAll('.s-dayon').forEach(i => i.onchange = e => { rm.days[+i.dataset.i].on = e.target.checked; ML.save('settings'); });
    body.querySelectorAll('.s-daytime').forEach(i => i.onchange = e => { rm.days[+i.dataset.i].time = e.target.value || '20:00'; ML.save('settings'); });
    const rs = $('#s-rem-save', body), msg = () => $('#s-rem-msg', body);
    if (rs) rs.onclick = async () => { rs.disabled = true; msg().textContent = 'Saving to your calendar…'; try { await ML.reminders.push(); msg().textContent = '✓ Saved. You’ll get a notification at the times above.'; } catch (e) { msg().textContent = '⚠ ' + e.message; } rs.disabled = false; };
    const rt = $('#s-rem-test', body);
    if (rt) rt.onclick = async () => { rt.disabled = true; msg().textContent = 'Sending…'; try { await ML.reminders.test(); msg().textContent = '✓ A test reminder will pop up on your phone in about a minute.'; } catch (e) { msg().textContent = '⚠ ' + e.message; } rt.disabled = false; };

    $('#s-url-save', body).onclick = async () => {
      const first = !S.settings.scriptUrl;
      S.settings.scriptUrl = $('#s-url', body).value.trim(); S.settings.scriptToken = $('#s-token', body).value.trim(); ML.save('settings');
      const m = $('#s-sync-msg', body);
      if (!S.settings.scriptUrl) { ML.updateSyncStatus(); ML.toast('Backup turned off'); return; }
      m.textContent = 'Testing…';
      try { const j = await ML.sync.ping(); if (j && j.success) { m.textContent = '✓ Connected' + (j.version ? ' (script v' + j.version + ')' : ''); if (first || !S.entries.some(e => e.synced)) ML.sync.queueAll(); ML.sync.flush(); } else m.textContent = '⚠ ' + ((j && j.error) || 'Unexpected reply — is the script deployed for “Anyone”?'); }
      catch (e) { m.textContent = '⚠ Could not reach the script. Check the URL and that access is set to “Anyone”.'; }
    };
    $('#s-sync-now', body).onclick = () => { if (!S.settings.scriptUrl) return ML.toast('Add your script URL first'); ML.sync.queueAll(); ML.sync.flush(); ML.toast('Backing up…'); };

    $('#s-tag-add', body).onclick = () => ML.newTagSheet(() => renderTags(body));
    $('#s-cloud', body).onchange = e => { S.settings.cloudProvider = e.target.value; ML.save('settings'); render(); };
    const ck = $('#s-cloudkey', body); if (ck) ck.onchange = e => { S.settings.cloudKey = e.target.value.trim(); ML.save('settings'); };
    $('#s-lock', body).onchange = e => { S.settings.lockAfter = +e.target.value; ML.save('settings'); };
    $('#s-gap', body).onchange = e => { S.settings.checkinGapHours = +e.target.value; ML.save('settings'); ML.renderJournal(); };
    $('#s-conf', body).onchange = e => { S.settings.confetti = e.target.checked; ML.save('settings'); };
    $('#s-snd', body).onchange = e => { S.settings.sound = e.target.checked; ML.save('settings'); if (e.target.checked) { ML.sound.unlock(); ML.sound.play('ping'); } };
    $('#s-celeb', body).onclick = () => ML.celebrate($('#s-celeb', body), true);
    $('#s-hap', body).onchange = e => { S.settings.haptics = e.target.checked; ML.save('settings'); if (e.target.checked) ML.haptic('bump'); };

    $('#s-export', body).onclick = async () => {
      const set = Object.assign({}, S.settings); delete set.cloudKey; delete set.scriptToken;
      const data = JSON.stringify({ app: 'moodlog', version: 2, exportedAt: new Date().toISOString(), settings: set, entries: S.entries, todos: S.todos, habits: S.habits, habitLog: S.habitLog, tags: S.tags }, null, 1);
      const file = new File([data], 'moodlog-backup-' + ML.todayKey() + '.json', { type: 'application/json' });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Moodlog backup' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    $('#s-import', body).onclick = () => pick('application/json,.json', async f => {
      try {
        const d = JSON.parse(await f.text()); if (d.app !== 'moodlog') throw new Error('not a Moodlog backup');
        let n = 0; const has = (arr, id) => arr.some(x => x.id === id);
        (d.tags || []).forEach(t => { if (!has(S.tags, t.id)) S.tags.push(t); });
        (d.entries || []).forEach(e => { if (!has(S.entries, e.id)) { e.photoId = null; e.audioId = null; e.synced = false; S.entries.push(e); n++; } });
        (d.checkins || []).forEach(c => { if (!c.legacy && !has(S.entries, c.id)) { S.entries.push({ id: c.id, ts: c.ts, updatedAt: c.updatedAt || c.ts, type: 'text', mood: c.mood, moodLabel: c.label || '', text: c.note || '', transcript: '', tags: c.tags || [], loc: null, photoId: null, audioId: null, imageUrl: null, driveUrl: null, synced: false }); n++; } });
        (d.todos || []).forEach(t => { if (!has(S.todos, t.id)) { S.todos.push(t); n++; } });
        (d.habits || []).forEach(h => { if (!has(S.habits, h.id)) S.habits.push(h); });
        Object.keys(d.habitLog || {}).forEach(k => { const a = S.habitLog[k] || []; S.habitLog[k] = [...new Set([...a, ...d.habitLog[k]])]; });
        ['tags', 'entries', 'todos', 'habits', 'habitLog'].forEach(ML.save); ML.refreshHome(); ML.toast('Imported ' + n + ' new items'); render();
      } catch (e) { ML.toast('That file isn’t a Moodlog backup'); }
    });
  }
  ML.renderSettings = render;
})();
