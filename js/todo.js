/* Moodlog — daily to-do list: pick any day, add tasks for it, tick them off (confetti + optional chime). */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const DOWN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let sel = null;

  const forDay = k => S.todos.filter(t => t.date === k).sort((a, b) => (a.done - b.done) || (a.order - b.order));
  const longDay = k => ML.parseDay(k).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const ring = (f, r, w) => { const c = 2 * Math.PI * r; return '<circle cx="15" cy="15" r="' + r + '" fill="none" stroke="var(--bg3)" stroke-width="' + w + '"/>' + (f > 0 ? '<circle cx="15" cy="15" r="' + r + '" fill="none" stroke="' + (f === 1 ? 'var(--success)' : 'var(--gold)') + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - f) + '" transform="rotate(-90 15 15)"/>' : ''); };

  function renderWeek() {
    const d0 = ML.parseDay(sel), start = ML.addDays(d0, -d0.getDay()), today = ML.todayKey();
    let h = '<button class="wk-nav" id="td-prev" aria-label="Previous week">‹</button><div class="week">';
    for (let i = 0; i < 7; i++) {
      const d = ML.addDays(start, i), k = ML.dayKey(d), ts = S.todos.filter(t => t.date === k), f = ts.length ? ts.filter(t => t.done).length / ts.length : 0;
      h += '<button class="wday' + (k === sel ? ' sel' : '') + (k === today ? ' today' : '') + '" data-k="' + k + '"><span class="n">' + DOWN[d.getDay()] + '</span><svg width="30" height="30" viewBox="0 0 30 30">' + (ts.length ? ring(f, 11, 4) : '<circle cx="15" cy="15" r="11" fill="none" stroke="var(--bg3)" stroke-width="2" stroke-dasharray="2 4"/>') + '</svg><span class="d">' + d.getDate() + '</span></button>';
    }
    h += '</div><button class="wk-nav" id="td-next" aria-label="Next week">›</button>';
    const w = $('#td-week'); w.innerHTML = h;
    w.querySelectorAll('.wday').forEach(b => b.onclick = () => { sel = b.dataset.k; ML.haptic('tick'); render(); });
    $('#td-prev').onclick = () => { sel = ML.dayKey(ML.addDays(ML.parseDay(sel), -7)); render(); };
    $('#td-next').onclick = () => { sel = ML.dayKey(ML.addDays(ML.parseDay(sel), 7)); render(); };
  }

  function render() {
    if (!$('#td-list')) return;
    const today = ML.todayKey(); if (!sel) sel = today;
    renderWeek();
    const ts = forDay(sel), done = ts.filter(t => t.done).length, pct = ts.length ? Math.round(done / ts.length * 100) : 0;
    $('#td-head').innerHTML = '<div class="row"><div class="grow"><div class="serif" style="font-size:22px;line-height:1.15">' + (sel === today ? 'Today' : ML.fmtDayHdr(sel)) + '</div><div class="hint">' + longDay(sel) + '</div></div>'
      + (sel !== today ? '<button class="btn-small" id="td-today">Back to today</button>' : '') + '</div>'
      + '<div class="td-prog"><div class="progress"><i style="width:' + pct + '%;' + (pct === 100 ? 'background:var(--success)' : '') + '"></i></div><div class="hint">' + (ts.length ? (done === ts.length ? 'All done 🎉' : done + ' of ' + ts.length + ' done') : 'No tasks yet') + '</div></div>'
      + '<div class="chips"><button class="chip sm' + (S.settings.confetti !== false ? ' on' : '') + '" id="td-conf">🎉 Confetti</button><button class="chip sm' + (S.settings.sound ? ' on' : '') + '" id="td-snd">' + (S.settings.sound ? '🔔' : '🔕') + ' Celebration sound</button></div>';
    const tb = $('#td-today'); if (tb) tb.onclick = () => { sel = today; render(); };
    $('#td-conf').onclick = () => { S.settings.confetti = S.settings.confetti === false; ML.save('settings'); ML.haptic('tick'); if (S.settings.confetti) ML.celebrate($('#td-conf'), false); render(); };
    $('#td-snd').onclick = () => {
      S.settings.sound = !S.settings.sound; ML.save('settings'); ML.haptic('tick');
      if (S.settings.sound) { ML.sound.unlock(); ML.sound.play('ping'); ML.toast('Sound on — if you hear nothing, check the iPhone silent switch'); } render();
    };

    const list = $('#td-list'); list.innerHTML = '';
    if (!ts.length) list.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><div class="empty-icon">☑</div><p>Nothing planned for ' + (sel === today ? 'today' : 'this day') + '. Add a task above.</p></div>';
    ts.forEach(t => {
      const row = document.createElement('div'); row.className = 'td-row' + (t.done ? ' done' : '');
      row.innerHTML = '<button class="h-check' + (t.done ? ' done' : '') + '" aria-label="' + (t.done ? 'Mark not done' : 'Mark done') + '">' + (t.done ? '✓' : '') + '</button><div class="td-title">' + esc(t.title) + '</div><button class="td-more" aria-label="Edit task">⋯</button>';
      const chk = row.querySelector('.h-check');
      chk.onclick = () => {
        t.done = !t.done; t.doneAt = t.done ? Date.now() : null; ML.save('todos'); ML.haptic(t.done ? 'bump' : 'tick');
        row.classList.toggle('done', t.done); chk.classList.toggle('done', t.done); chk.textContent = t.done ? '✓' : ''; chk.classList.add('pop');
        if (t.done) ML.celebrate(chk, forDay(sel).every(x => x.done));
        setTimeout(render, 700);
      };
      row.querySelector('.td-title').onclick = () => edit(t); row.querySelector('.td-more').onclick = () => edit(t);
      list.appendChild(row);
    });
    const open = ts.filter(t => !t.done).length;
    if (sel < today && open) { const b = document.createElement('button'); b.className = 'btn-secondary'; b.style.marginTop = '.8rem'; b.textContent = 'Move ' + open + ' unfinished to today'; b.onclick = () => { ts.filter(t => !t.done).forEach(t => { t.date = today; }); ML.save('todos'); sel = today; ML.toast('Moved to today'); render(); }; list.appendChild(b); }
  }
  ML.renderTodo = render;

  function add() {
    const inp = $('#td-input'), title = inp.value.trim().slice(0, 120); if (!title) return;
    S.todos.push({ id: ML.uid(), date: sel || ML.todayKey(), title, done: false, doneAt: null, created: Date.now(), order: Date.now() });
    ML.save('todos'); inp.value = ''; ML.haptic('tick'); render(); inp.focus();
  }

  function edit(t) {
    ML.sheet('Edit task', '<input class="input" id="te-title" maxlength="120" value="' + esc(t.title) + '" autocapitalize="sentences"><div><div class="field-label">Day</div><input type="date" class="input" id="te-date" value="' + t.date + '"></div><button class="btn-primary" id="te-save">Save</button><button class="btn-danger" id="te-del">Delete task</button>', (el, close) => {
      $('#te-save', el).onclick = () => {
        const title = $('#te-title', el).value.trim(), date = $('#te-date', el).value;
        if (!title) { ML.toast('A task needs a name'); return; }
        t.title = title.slice(0, 120); if (date) t.date = date; ML.save('todos'); close(); if (t.date !== sel) sel = t.date; render();
      };
      $('#te-del', el).onclick = () => { S.todos = S.todos.filter(x => x.id !== t.id); ML.save('todos'); close(); render(); };
    });
  }

  ML.initTodo = () => {
    $('#td-addbtn').onclick = add;
    $('#td-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  };
})();
