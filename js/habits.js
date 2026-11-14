/* Moodlog — habits: progress ring, week strip (tap a day to backfill), cards with streaks, editable schedule */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const EMOJI = ['💧', '🏃', '📖', '🧘', '😴', '🥗', '💊', '📝', '🎸', '🚶', '☀️', '🧹', '💪', '🦷', '📵', '✨'];
  const SUGGEST = [['💧', 'Drink water'], ['🏃', 'Exercise'], ['📖', 'Read'], ['🧘', 'Meditate'], ['😴', 'Sleep on time'], ['📝', 'Journal']];
  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DOWN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let sel = null; // selected day key

  const ringSvg = (frac, color) => { const r = 40, c = 2 * Math.PI * r; return '<svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="' + r + '" fill="none" stroke="var(--bg3)" stroke-width="9"/><circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - frac) + '" style="transition:stroke-dashoffset .4s"/></svg>'; };

  function render() {
    const body = $('#habits-body'); if (!body) return;
    const todayK = ML.todayKey(); if (!sel) sel = todayK;
    const selDate = ML.parseDay(sel), now = new Date();
    const due = S.habits.filter(h => ML.data.scheduled(h, selDate)), rest = S.habits.filter(h => !ML.data.scheduled(h, selDate));
    const done = due.filter(h => ML.data.habitDone(h.id, sel)).length, frac = due.length ? done / due.length : 0;
    let html = '<div class="card h-top"><div class="ring">' + ringSvg(frac, done === due.length && due.length ? 'var(--success)' : 'var(--gold)') + '<div class="in"><div class="big">' + done + '/' + due.length + '</div><div class="small">done</div></div></div><div class="grow"><div class="serif" style="font-size:20px">' + (sel === todayK ? 'Today' : ML.fmtDayHdr(sel)) + '</div><div class="hint" style="margin-top:.2rem">' + (!due.length ? 'Nothing scheduled.' : done === due.length ? 'All done — nice work 🎉' : (due.length - done) + ' to go') + '</div></div></div>';
    // week strip: the last 7 days ending today
    html += '<div class="week">';
    for (let i = 6; i >= 0; i--) {
      const d = ML.addDays(now, -i), k = ML.dayKey(d), dd = S.habits.filter(h => ML.data.scheduled(h, d)), dn = dd.filter(h => ML.data.habitDone(h.id, k)).length, f = dd.length ? dn / dd.length : 0;
      html += '<button class="wday' + (k === sel ? ' sel' : '') + (k === todayK ? ' today' : '') + '" data-k="' + k + '"><span class="n">' + DOWN[d.getDay()] + '</span><svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="var(--bg3)" stroke-width="4"/>' + (f > 0 ? '<circle cx="15" cy="15" r="12" fill="none" stroke="' + (f === 1 ? 'var(--success)' : 'var(--gold)') + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + 75.4 + '" stroke-dashoffset="' + 75.4 * (1 - f) + '" transform="rotate(-90 15 15)"/>' : '') + '</svg><span class="d">' + d.getDate() + '</span></button>';
    }
    html += '</div>';
    if (!S.habits.length) {
      html += '<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">🔥</div><p>Build streaks with small daily habits. Start with a suggestion or make your own.</p></div><div class="chips" id="h-suggest" style="justify-content:center">' + SUGGEST.map((s, i) => '<button class="chip" data-i="' + i + '">' + s[0] + ' ' + s[1] + '</button>').join('') + '</div>';
    } else {
      html += '<div id="h-due"></div>' + (rest.length ? '<div class="field-label" style="margin-top:.4rem">Not scheduled this day</div><div id="h-rest"></div>' : '');
    }
    html += '<button class="btn-secondary" id="h-add">＋ New habit</button>';
    body.innerHTML = html;
    body.querySelectorAll('.wday').forEach(b => b.onclick = () => { sel = b.dataset.k; ML.haptic('tick'); render(); });
    const card = (h, off) => {
      const d = document.createElement('div'); d.className = 'habit-card' + (off ? ' off' : '');
      const isDone = ML.data.habitDone(h.id, sel), st = ML.data.streak(h), r30 = ML.data.rate(h, 30);
      let dots = ''; for (let i = 6; i >= 0; i--) { const dt = ML.addDays(now, -i); dots += '<i class="' + (!ML.data.scheduled(h, dt) ? 'na' : ML.data.habitDone(h.id, ML.dayKey(dt)) ? 'on' : '') + '"></i>'; }
      d.innerHTML = '<div class="h-emoji">' + esc(h.emoji || '✨') + '</div><div class="h-info"><div class="h-name">' + esc(h.name) + '</div><div class="h-meta">🔥 ' + st + ' day streak' + (r30 != null ? ' · ' + Math.round(r30 * 100) + '% (30d)' : '') + '</div><div class="h-dots">' + dots + '</div></div><button class="h-check' + (isDone ? ' done' : '') + '" aria-label="toggle">' + (isDone ? '✓' : '') + '</button>';
      d.querySelector('.h-info').onclick = () => editSheet(h);
      d.querySelector('.h-emoji').onclick = () => editSheet(h);
      const chk = d.querySelector('.h-check');
      chk.onclick = () => { const nowDone = ML.data.toggleHabit(h.id, sel); ML.haptic(nowDone ? 'bump' : 'tick'); if (nowDone) ML.rewards.onHabit(chk, h, sel); else ML.rewards.renderStrip(); chk.classList.add('pop'); setTimeout(render, 160); };
      return d;
    };
    const dueBox = $('#h-due', body); if (dueBox) due.forEach(h => dueBox.appendChild(card(h, false)));
    const restBox = $('#h-rest', body); if (restBox) rest.forEach(h => restBox.appendChild(card(h, true)));
    body.querySelectorAll('#h-suggest .chip').forEach(b => b.onclick = () => { const s = SUGGEST[+b.dataset.i]; addHabit(s[1], s[0], []); });
    $('#h-add', body).onclick = () => editSheet(null);
  }
  ML.renderHabits = render;

  function addHabit(name, emoji, days) {
    S.habits.push({ id: ML.uid(), name, emoji, days, created: Date.now() }); ML.save('habits'); render();
  }

  function editSheet(h) {
    let emoji = h ? h.emoji || '✨' : '✨', days = h ? [...(h.days || [])] : [];
    ML.sheet(h ? 'Edit habit' : 'New habit',
      '<div class="row"><div class="h-emoji" id="e-cur">' + esc(emoji) + '</div><input class="input grow" id="e-name" maxlength="40" placeholder="e.g. Drink water" value="' + esc(h ? h.name : '') + '" autocapitalize="sentences"></div>'
      + '<div><div class="field-label">Icon</div><div class="emoji-grid" id="e-grid"></div></div>'
      + '<div><div class="field-label">Repeat</div><div class="dow" id="e-dow"></div><div class="hint" id="e-dow-h" style="margin-top:.4rem"></div></div>'
      + '<button class="btn-primary" id="e-save">' + (h ? 'Save' : 'Add habit') + '</button>' + (h ? '<button class="btn-danger" id="e-del">Delete habit</button>' : ''), (el, close) => {
        const grid = $('#e-grid', el);
        const drawE = () => { grid.innerHTML = ''; EMOJI.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.className = e === emoji ? 'on' : ''; b.onclick = () => { emoji = e; $('#e-cur', el).textContent = e; drawE(); }; grid.appendChild(b); }); };
        drawE();
        const dw = $('#e-dow', el);
        const drawD = () => { dw.innerHTML = ''; DOW.forEach((l, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.className = (!days.length || days.includes(i)) ? 'on' : ''; b.onclick = () => { const set = new Set(days.length ? days : [0, 1, 2, 3, 4, 5, 6]); if (set.has(i)) set.delete(i); else set.add(i); if (!set.size) { ML.toast('Pick at least one day'); return; } days = set.size === 7 ? [] : [...set].sort(); drawD(); }; dw.appendChild(b); }); $('#e-dow-h', el).textContent = days.length ? 'Only on the highlighted days' : 'Every day'; };
        drawD();
        $('#e-save', el).onclick = () => {
          const name = $('#e-name', el).value.trim(); if (!name) { ML.toast('Give the habit a name'); return; }
          if (h) { h.name = name; h.emoji = emoji; h.days = days; ML.save('habits'); render(); } else addHabit(name, emoji, days);
          close();
        };
        const del = $('#e-del', el);
        if (del) del.onclick = async () => {
          close();
          if (await ML.confirm('Delete habit?', 'This removes "' + h.name + '" and its history.', 'Delete', true)) {
            S.habits = S.habits.filter(x => x.id !== h.id); Object.keys(S.habitLog).forEach(k => { S.habitLog[k] = S.habitLog[k].filter(x => x !== h.id); if (!S.habitLog[k].length) delete S.habitLog[k]; });
            ML.save('habits'); ML.save('habitLog'); render();
          }
        };
      });
  }
  ML.resetHabitsDay = () => { sel = null; };
})();
