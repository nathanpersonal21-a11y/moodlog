/* Moodlog — mood check-in (multiple per day, with label, tags and note) */
(function () {
  const ML = window.ML, $ = ML.$, S = ML.S;
  const QUICK = ['Calm', 'Happy', 'Grateful', 'Content', 'Excited', 'Tired', 'Anxious', 'Stressed', 'Sad', 'Angry', 'Lonely', 'Overwhelmed'];
  let editId = null, returnTo = 'smain', tags = new Set(), inited = false;

  function renderQuick() {
    const box = $('#ci-quick'); box.innerHTML = '';
    const cur = $('#ci-label').value.trim().toLowerCase();
    QUICK.forEach(q => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip sm' + (cur === q.toLowerCase() ? ' on' : ''); b.textContent = q;
      b.onclick = () => { $('#ci-label').value = (cur === q.toLowerCase()) ? '' : q; ML.haptic('tick'); renderQuick(); };
      box.appendChild(b);
    });
  }

  function init() {
    if (inited) return; inited = true;
    ML.dial.init();
    $('#ci-label').addEventListener('input', renderQuick);
    $('#ci-save').addEventListener('click', save);
    $('#ci-skip').addEventListener('click', () => ML.ss(returnTo));
    $('#ci-del').addEventListener('click', async () => {
      if (!editId) return;
      if (await ML.confirm('Delete check-in?', 'This removes the check-in from your journal.', 'Delete', true)) {
        ML.data.deleteCheckin(editId); ML.refreshHome(); ML.toast('Deleted'); ML.ss(returnTo);
      }
    });
  }

  function save() {
    const label = $('#ci-label').value.trim().slice(0, 40), note = $('#ci-note').value.trim(), mood = ML.dial.get();
    if (editId) ML.data.updateCheckin(editId, { mood, label, note, tags: [...tags] });
    else ML.data.addCheckin({ id: ML.uid(), ts: Date.now(), updatedAt: Date.now(), mood, label, note, tags: [...tags], synced: false });
    ML.refreshHome(); ML.toast(editId ? 'Check-in updated' : 'Check-in saved'); ML.ss(returnTo);
  }

  // opts: {editId, returnTo}
  ML.openCheckin = (opts = {}) => {
    init();
    editId = opts.editId || null; returnTo = opts.returnTo || 'smain';
    const rec = editId ? S.checkins.find(c => c.id === editId) : null;
    const last = ML.data.latestCheckin();
    const startMood = rec ? rec.mood : (last && ML.dayKey(last.ts) === ML.todayKey() ? last.mood : 50);
    ML.dial.set(startMood);
    $('#ci-label').value = rec ? rec.label || '' : '';
    $('#ci-note').value = rec ? rec.note || '' : '';
    $('#ci-date').textContent = ML.fmtLong(rec ? rec.ts : Date.now()) + ' · ' + ML.fmtTime(rec ? rec.ts : Date.now());
    $('#ci-title').innerHTML = editId ? 'Edit check-in' : 'How are you feeling<br>right now?';
    $('#ci-del').classList.toggle('hidden', !editId);
    $('#ci-skip').textContent = editId ? 'Cancel' : (returnTo === 'smain' ? 'Skip for now' : 'Cancel');
    tags = new Set(rec ? rec.tags || [] : []);
    ML.tagPicker($('#ci-tags'), tags);
    renderQuick();
    ML.ss('scheckin');
  };
})();
