/* Moodlog — rewards: XP & levels, streak (with a weekly freeze), daily goal ring, surprise 2x bonuses, task combos,
   badges, mood heatmap, weekly recap, insights, save celebration. Every piece can be switched off in Settings (ML.fx). */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const G = () => S.game;
  const TITLES = ['Newcomer', 'Sprout', 'Wanderer', 'Explorer', 'Dreamer', 'Trailblazer', 'Luminary', 'Starlight', 'Legend', 'Mythic'];
  const xpFor = l => 50 * l * (l - 1), levelOf = xp => Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  const words = t => (String(t || '').trim().match(/\S+/g) || []).length;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function info() {
    const xp = G().xp || 0, l = levelOf(xp), a = xpFor(l), b = xpFor(l + 1);
    return { xp, level: l, into: xp - a, need: b - a, frac: (xp - a) / (b - a), title: TITLES[Math.min(l - 1, TITLES.length - 1)] };
  }

  // ── stats ──
  function dayMap() { // day key -> [moods]
    const m = {}; S.entries.forEach(e => { (m[ML.dayKey(e.ts)] = m[ML.dayKey(e.ts)] || []).push(e.mood); }); return m;
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

  function streak() {
    const days = new Set(S.entries.map(e => ML.dayKey(e.ts)));
    let d = new Date(); if (!days.has(ML.dayKey(d))) d = ML.addDays(d, -1);
    let n = 0, i = 0, lastSkip = -99, frozen = false;
    for (; i < 4000; i++) {
      const k = ML.dayKey(d);
      if (days.has(k)) n++;
      else if (i - lastSkip >= 7 && days.has(ML.dayKey(ML.addDays(d, -1)))) { lastSkip = i; frozen = true; } // one missed day per week is forgiven
      else break;
      d = ML.addDays(d, -1);
    }
    return { n, frozen, doneToday: days.has(ML.todayKey()) };
  }
  function bestStreak() {
    const keys = [...new Set(S.entries.map(e => ML.dayKey(e.ts)))].sort(); let best = 0, run = 0, prev = null;
    keys.forEach(k => { run = prev && ML.dayKey(ML.addDays(ML.parseDay(prev), 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return Math.max(best, streak().n);
  }
  function goodRun() {
    const m = dayMap(), keys = Object.keys(m).filter(k => avg(m[k]) >= 70).sort(); let best = 0, run = 0, prev = null;
    keys.forEach(k => { run = prev && ML.dayKey(ML.addDays(ML.parseDay(prev), 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  }
  function stats() {
    return {
      entries: S.entries.length, voice: S.entries.filter(e => e.type === 'voice').length, photos: S.entries.filter(e => e.photoId).length,
      best: bestStreak(), tasksDone: S.todos.filter(t => t.done).length, habitsDone: Object.values(S.habitLog).reduce((n, a) => n + a.length, 0),
      ringDays: Object.keys(G().ringDays).length, level: levelOf(G().xp || 0), goodRun: goodRun(), comboBest: G().comboBest || 0,
      played: G().trivia.played, perfect: G().trivia.perfect
    };
  }
  const BADGES = [
    ['first', '📝', 'First Words', 'Write your first entry', s => s.entries >= 1],
    ['s3', '🔥', 'Three-peat', '3 days in a row', s => s.best >= 3],
    ['s7', '⚡', 'Week Warrior', '7 days in a row', s => s.best >= 7],
    ['s30', '🏆', 'Month Master', '30 days in a row', s => s.best >= 30],
    ['e10', '📚', 'Ten Down', '10 entries', s => s.entries >= 10],
    ['e50', '📖', 'Half Century', '50 entries', s => s.entries >= 50],
    ['e100', '💯', 'Centurion', '100 entries', s => s.entries >= 100],
    ['voice', '🎙', 'Say It Out Loud', 'Record a voice entry', s => s.voice >= 1],
    ['photo', '📷', 'Picture This', 'Add a photo to an entry', s => s.photos >= 1],
    ['t10', '✅', 'Task Slayer', 'Finish 10 tasks', s => s.tasksDone >= 10],
    ['t50', '🗡', 'Task Legend', 'Finish 50 tasks', s => s.tasksDone >= 50],
    ['h25', '💪', 'Habit Hero', 'Check off 25 habits', s => s.habitsDone >= 25],
    ['ring1', '🎯', 'Ring Closer', 'Close your daily ring', s => s.ringDays >= 1],
    ['ring7', '🌟', 'Ring Master', 'Close the ring 7 days', s => s.ringDays >= 7],
    ['sunny', '🌈', 'Sunny Streak', '3 good days (mood 70+) in a row', s => s.goodRun >= 3],
    ['combo', '🚀', 'Combo King', 'Hit a x5 task combo', s => s.comboBest >= 5],
    ['l5', '⭐', 'Level 5', 'Reach level 5', s => s.level >= 5],
    ['l10', '👑', 'Level 10', 'Reach level 10', s => s.level >= 10],
    ['swift', '🎤', 'Swiftie', 'Play the trivia game', s => s.played >= 1],
    ['perfect', '💎', 'Perfect Score', 'Ace a trivia round', s => s.perfect >= 1]
  ];
  ML.BADGES = BADGES;
  function checkBadges(silent) {
    if (!ML.fx('badges')) return [];
    const st = stats(), won = [];
    BADGES.forEach(b => { if (!G().badges[b[0]] && b[4](st)) { G().badges[b[0]] = Date.now(); won.push(b); } });
    if (won.length) ML.save('game');
    return silent ? [] : won;
  }

  // ── daily ring ──
  function ringParts() {
    const t = ML.todayKey(), parts = [];
    parts.push({ done: S.entries.some(e => ML.dayKey(e.ts) === t), label: 'Write an entry' });
    const td = S.todos.filter(x => x.date === t); if (td.length) parts.push({ done: td.every(x => x.done), label: 'Finish today’s tasks (' + td.filter(x => x.done).length + '/' + td.length + ')' });
    const due = S.habits.filter(h => ML.data.scheduled(h, new Date())); if (due.length) parts.push({ done: due.every(h => ML.data.habitDone(h.id, t)), label: 'Do today’s habits (' + due.filter(h => ML.data.habitDone(h.id, t)).length + '/' + due.length + ')' });
    return parts;
  }
  const ringFrac = () => { const p = ringParts(); return p.filter(x => x.done).length / p.length; };
  function checkRing() {
    if (!ML.fx('ring')) return null;
    const t = ML.todayKey(); if (G().ringDays[t] || ringFrac() < 1) return null;
    G().ringDays[t] = 1; ML.save('game');
    return { pts: 30 };
  }

  // ── xp ──
  function award(pts) {
    if (!ML.fx('xp') || !pts) return { pts: 0, bonus: false, levelUp: 0 };
    let bonus = false; if (ML.fx('bonus') && Math.random() < 0.15) { pts *= 2; bonus = true; }
    const before = levelOf(G().xp || 0), day = ML.todayKey();
    G().xp = (G().xp || 0) + pts; G().dayXp[day] = (G().dayXp[day] || 0) + pts; ML.save('game');
    const after = levelOf(G().xp);
    return { pts, bonus, levelUp: after > before ? after : 0 };
  }

  // ── insights ──
  const AFFIRM = ['Showing up counts more than showing perfect.', 'Noticing how you feel is a skill, and you just practiced it.', 'Small check-ins add up to big self-knowledge.', 'Future you will be glad you wrote this down.', 'You made time for yourself today. That matters.', 'Every entry is a little gift to your future self.', 'Feelings pass; your record of them stays.', 'Good days and hard days both belong here.'];
  function insight(e) {
    if (!ML.fx('insights')) return '';
    const c = [], all = S.entries;
    (e.tags || []).forEach(id => {
      const w = all.filter(x => (x.tags || []).includes(id)), wo = all.filter(x => !(x.tags || []).includes(id));
      if (w.length >= 3 && wo.length >= 3) { const d = Math.round(avg(w.map(x => x.mood)) - avg(wo.map(x => x.mood))); const nm = ML.data.tagName(id); if (d >= 5) c.push('You tend to feel ' + d + ' points better when you log ' + nm + '.'); else if (d <= -5) c.push('Entries tagged ' + nm + ' run ' + Math.abs(d) + ' points lower, so notice what is behind that.'); }
    });
    const dow = new Date(e.ts).getDay(), same = all.filter(x => new Date(x.ts).getDay() === dow);
    if (same.length >= 4 && all.length >= 10) { const d = Math.round(avg(same.map(x => x.mood)) - avg(all.map(x => x.mood))); if (Math.abs(d) >= 5) c.push((d > 0 ? DOWL[dow] + 's are your brighter days (+' + d + ').' : DOWL[dow] + 's run a bit lower for you (' + d + ').')); }
    const week = all.filter(x => x.ts > Date.now() - 7 * 864e5 && x.id !== e.id);
    if (week.length >= 3) { const d = Math.round(e.mood - avg(week.map(x => x.mood))); if (d >= 8) c.push('That is ' + d + ' above your week so far.'); else if (d <= -8) c.push('A tougher moment than your week so far, and writing it down helps.'); }
    return c.length ? c[(Math.random() * c.length) | 0] : AFFIRM[(Math.random() * AFFIRM.length) | 0];
  }

  // ── popup ──
  const ARC = () => { const cols = ['#ff5c8a', '#ff9f43', '#ffd166', '#06d6a0', '#4cc9f0', '#7b8cff', '#b388ff']; return '<svg class="rw-arc" viewBox="0 0 220 112" aria-hidden="true">' + cols.map((c, i) => { const r = 104 - i * 9; return '<path d="M' + (110 - r) + ' 110 A' + r + ' ' + r + ' 0 0 1 ' + (110 + r) + ' 110" fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round" opacity=".92"/>'; }).join('') + '</svg>'; };
  let popEl = null, popT = 0;
  function pop(o) {
    if (popEl) popEl.remove(); clearTimeout(popT);
    const bar = o.xp ? info() : null;
    const el = document.createElement('div'); el.className = 'rw-pop' + (ML.fx('anim') ? ' anim' : '');
    el.innerHTML = '<div class="rw-card">' + (ML.fx('rainbow') ? ARC() : '') + '<div class="rw-body">'
      + (ML.fx('buddy') ? '<img class="rw-buddy" src="img/buddy-sq.jpg" alt="">' : '') + '<div class="rw-title">' + esc(o.title) + '</div>'
      + (o.xp ? '<div class="rw-xp">+<b data-to="' + o.xp + '">' + o.xp + '</b> XP' + (o.bonus ? ' <span class="rw-lucky">✨ Lucky 2x!</span>' : '') + '</div><div class="rw-bar"><i style="width:' + Math.round(bar.frac * 100) + '%"></i></div><div class="rw-lv">Level ' + bar.level + ' · ' + esc(bar.title) + '</div>' : '')
      + (o.lines || []).map(l => '<div class="rw-line">' + l + '</div>').join('')
      + ((o.badges || []).length ? '<div class="rw-badges">' + o.badges.map(b => '<div class="rw-b"><span>' + b[1] + '</span>' + esc(b[2]) + '</div>').join('') + '</div>' : '') + '</div></div>';
    document.body.appendChild(el); popEl = el;
    const num = el.querySelector('.rw-xp b');
    if (num && ML.fx('anim') && !matchMedia('(prefers-reduced-motion: reduce)').matches) { const to = +num.dataset.to, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / 700); num.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); }; num.textContent = 0; requestAnimationFrame(f); }
    requestAnimationFrame(() => el.classList.add('show'));
    const close = () => { el.classList.remove('show'); setTimeout(() => { if (popEl === el) popEl = null; el.remove(); }, 260); };
    el.onclick = close; popT = setTimeout(close, (o.badges && o.badges.length) || o.levelUp ? 5200 : 3600);
  }
  ML.rewards = { pop };

  function floatXP(el, text) {
    if (!el || !el.getBoundingClientRect) return; const r = el.getBoundingClientRect();
    const d = document.createElement('div'); d.className = 'rw-float'; d.textContent = text; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = r.top + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
  }

  // finish an award: badges, ring, level-up, sound, popup. extra: {title, lines, big, snd, el, forcePop, silentConfetti}
  function finish(a, extra) {
    const lines = (extra.lines || []).slice(), ring = checkRing(); let pts = a.pts, bonusAll = a.bonus, lvl = a.levelUp;
    if (ring) { const r2 = award(ring.pts); pts += r2.pts; bonusAll = bonusAll || r2.bonus; lvl = lvl || r2.levelUp; lines.push('🎯 Daily ring closed! +' + r2.pts + ' XP'); }
    const badges = checkBadges(false); const st = lvl ? info() : null;
    if (lvl) lines.unshift('⬆️ <b>Level ' + lvl + '</b> — ' + esc(st.title));
    const special = !!(lvl || badges.length || ring);
    const big = !!(extra.big || special);
    if (extra.confetti !== false) ML.celebrate(extra.el || null, big, true);
    ML.sound.play(lvl ? 'level' : badges.length ? 'badge' : ring ? 'big' : bonusAll ? 'bonus' : (extra.snd || 'ping'));
    ML.haptic('bump'); if (big) setTimeout(() => ML.haptic('bump'), 140);
    if (extra.pop || special) pop({ title: lvl ? 'Level up!' : badges.length ? 'New badge!' : ring ? 'Ring closed!' : extra.title, xp: pts, bonus: bonusAll, lines, badges, levelUp: lvl });
    else if (pts && extra.el) floatXP(extra.el, '+' + pts + ' XP' + (bonusAll ? ' ✨2x' : '') + (extra.tag ? ' · ' + extra.tag : ''));
    ML.rewards.renderStrip();
    const sc = $('#srewards.active'); if (sc) ML.rewards.renderScreen();
  }
  ML.rewards.award = award; ML.rewards.finish = finish;

  // ── events from the rest of the app ──
  ML.rewards.onEntry = function (e) {
    const w = words(e.text || e.transcript);
    let pts = 20; if (w >= 100) pts += 20; else if (w >= 30) pts += 10;
    if (e.type === 'voice') pts += 10; if (e.photoId) pts += 5; if (e.tags && e.tags.length) pts += 5;
    const first = S.entries.filter(x => ML.dayKey(x.ts) === ML.todayKey()).length <= 1; if (first) pts += 10;
    const a = award(pts), lines = [], st = streak();
    if (ML.fx('streak') && first && st.n >= 2) lines.push('🔥 <b>' + st.n + '-day streak</b>' + (st.frozen ? ' 🧊' : ''));
    const ins = insight(e); if (ins) lines.push('💡 ' + esc(ins));
    if (!ML.fx('save') && !a.pts) { finish(a, { confetti: false, title: '' }); return; }
    finish(a, { title: first ? 'Entry saved — first one today!' : 'Entry saved', lines, big: first && ML.fx('save'), snd: 'save', pop: ML.fx('save') || a.pts > 0, confetti: ML.fx('save') });
  };

  let combo = 0, lastTask = 0;
  ML.rewards.onTask = function (el, task, allDone) {
    if (task.paid) { ML.celebrate(el, false); return; }
    task.paid = true; ML.save('todos');
    const now = Date.now(); combo = now - lastTask < 120000 ? combo + 1 : 1; lastTask = now;
    if (combo > (G().comboBest || 0)) { G().comboBest = combo; ML.save('game'); }
    let pts = 5, tag = '', lines = [];
    const n = S.todos.filter(x => x.date === task.date).length, clear = allDone && n >= 2 && ML.fx('combo');
    if (ML.fx('combo') && combo >= 2) { pts += Math.min(combo, 6) * 2; tag = '🔥 x' + combo; }
    if (clear) { pts += 20; lines.push('🧹 <b>Cleared the day</b> +20 XP'); }
    const a = award(pts);
    finish(a, { el, big: allDone && n >= 2, tag, lines, title: clear ? 'Day cleared!' : 'Task done', pop: clear, snd: allDone ? 'big' : 'ping' });
  };
  ML.rewards.onHabit = function (el, h, day) {
    const key = h.id + '|' + day; if (G().paid[key]) { ML.celebrate(el, false); return; }
    G().paid[key] = 1; ML.save('game');
    finish(award(5), { el, snd: 'ping' });
  };

  // ── top strip on the journal ──
  function ringSvg(f, size) { const r = size / 2 - 4, c = 2 * Math.PI * r; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--bg3)" stroke-width="5"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (f >= 1 ? 'var(--success)' : 'var(--gold)') + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - f) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>'; }
  ML.rewards.renderStrip = function () {
    const el = $('#rw-strip'); if (!el) return;
    const showRing = ML.fx('ring'), showStreak = ML.fx('streak'), showXp = ML.fx('xp');
    if (!showRing && !showStreak && !showXp) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const st = streak(), inf = info(), f = ringFrac();
    el.innerHTML = (showRing ? '<div class="rw-s ring">' + ringSvg(f, 42) + '<span>' + Math.round(f * 100) + '%</span></div>' : '')
      + (showStreak ? '<div class="rw-s"><span class="fl' + (st.doneToday ? ' lit' : '') + '">🔥</span><b>' + st.n + '</b><small>day' + (st.n === 1 ? '' : 's') + (st.frozen ? ' 🧊' : '') + '</small></div>' : '')
      + (showXp ? '<div class="rw-s lv grow"><div class="lvl"><b>Lv ' + inf.level + '</b> <small>' + esc(inf.title) + '</small></div><div class="rw-bar"><i style="width:' + Math.round(inf.frac * 100) + '%"></i></div></div>' : '')
      + '<span class="rw-chev">›</span>';
  };

  // ── rewards screen ──
  function weekStats(offset) {
    const end = ML.addDays(new Date(), -7 * offset), start = ML.addDays(end, -6), a = ML.dayKey(start), b = ML.dayKey(end);
    const es = S.entries.filter(e => { const k = ML.dayKey(e.ts); return k >= a && k <= b; });
    const dm = {}; es.forEach(e => { (dm[ML.dayKey(e.ts)] = dm[ML.dayKey(e.ts)] || []).push(e.mood); });
    let best = null; Object.keys(dm).forEach(k => { const v = avg(dm[k]); if (!best || v > best.v) best = { k, v }; });
    const tasks = S.todos.filter(t => t.done && t.doneAt && ML.dayKey(t.doneAt) >= a && ML.dayKey(t.doneAt) <= b).length;
    const habits = Object.keys(S.habitLog).filter(k => k >= a && k <= b).reduce((n, k) => n + S.habitLog[k].length, 0);
    let xp = 0; Object.keys(G().dayXp).forEach(k => { if (k >= a && k <= b) xp += G().dayXp[k]; });
    return { entries: es.length, mood: es.length ? Math.round(avg(es.map(e => e.mood))) : null, best, tasks, habits, xp, days: Object.keys(dm).length };
  }
  function recapHtml() {
    const w = weekStats(0), p = weekStats(1); if (!w.entries && !w.tasks && !w.habits) return '<div class="card rw-card2"><div class="field-label">This week</div><div class="hint">Nothing logged yet this week. Your recap appears as you go.</div></div>';
    const d = w.mood != null && p.mood != null ? w.mood - p.mood : null;
    return '<div class="card rw-card2"><div class="row"><div class="field-label grow">This week</div><button class="btn-small" id="rw-share">Share</button></div><div class="rw-stats">'
      + '<div><b>' + w.entries + '</b><small>entries</small></div><div><b style="color:' + (w.mood != null ? ML.moodColor(w.mood) : '') + '">' + (w.mood != null ? w.mood : '—') + '</b><small>avg mood' + (d ? ' (' + (d > 0 ? '+' : '') + d + ')' : '') + '</small></div><div><b>' + w.tasks + '</b><small>tasks</small></div><div><b>' + w.habits + '</b><small>habits</small></div></div>'
      + '<div class="hint" style="margin-top:.5rem">' + (w.best ? '☀️ Best day: <b>' + ML.parseDay(w.best.k).toLocaleDateString('en-US', { weekday: 'long' }) + '</b> (mood ' + Math.round(w.best.v) + ')' : '') + (w.xp ? ' · ' + w.xp + ' XP earned' : '') + '</div></div>';
  }
  function recapText() {
    const w = weekStats(0), s = streak();
    return 'My Moodlog week: ' + w.entries + ' entries, avg mood ' + (w.mood != null ? w.mood : '—') + ', ' + w.tasks + ' tasks done, ' + w.habits + ' habits' + (s.n > 1 ? ', ' + s.n + '-day streak 🔥' : '') + (w.best ? ', best day ' + ML.parseDay(w.best.k).toLocaleDateString('en-US', { weekday: 'long' }) : '') + '.';
  }
  function heatHtml() {
    const dm = dayMap(), now = new Date(), W = 18, start = ML.addDays(ML.addDays(now, -now.getDay()), -7 * (W - 1)), cs = 15, gap = 4, today = ML.todayKey();
    let svg = '<svg viewBox="0 0 ' + (W * (cs + gap)) + ' ' + (7 * (cs + gap)) + '" width="100%" role="img" aria-label="Mood heatmap">';
    for (let c = 0; c < W; c++) for (let r = 0; r < 7; r++) {
      const d = ML.addDays(start, c * 7 + r), k = ML.dayKey(d); if (k > today) continue;
      const m = dm[k], fill = m ? ML.moodColor(Math.round(avg(m))) : 'var(--bg3)';
      svg += '<rect x="' + c * (cs + gap) + '" y="' + r * (cs + gap) + '" width="' + cs + '" height="' + cs + '" rx="4" fill="' + fill + '"' + (k === today ? ' stroke="var(--gold)" stroke-width="2"' : '') + ' opacity="' + (m ? 1 : .6) + '"><title>' + k + (m ? ' · mood ' + Math.round(avg(m)) : '') + '</title></rect>';
    }
    return '<div class="card rw-card2"><div class="field-label">Your mood, day by day</div>' + svg + '</svg><div class="hint" style="margin-top:.4rem">Each square is a day. Colour = average mood. Fill the gaps. 🌈</div></div>';
  }
  function badgesHtml() {
    const got = Object.keys(G().badges).length;
    return '<div class="card rw-card2"><div class="field-label">Badges · ' + got + '/' + BADGES.length + '</div><div class="rw-grid">' + BADGES.map(b => { const on = !!G().badges[b[0]]; return '<button class="rw-tile' + (on ? ' on' : '') + '" data-d="' + esc(b[3]) + '"><span>' + (on ? b[1] : '🔒') + '</span><small>' + esc(b[2]) + '</small></button>'; }).join('') + '</div></div>';
  }
  ML.rewards.renderScreen = function () {
    const body = $('#rw-body'); if (!body) return;
    const inf = info(), st = streak(), parts = ringParts(), f = ringFrac(), t = G().trivia;
    let h = '';
    h += '<div class="rw-hero' + (ML.fx('rainbow') ? ' img' : '') + '"><div class="rw-hero-in"><div class="rw-hero-lv">Level ' + inf.level + '</div><div class="rw-hero-t">' + esc(inf.title) + '</div></div></div>';
    if (ML.fx('xp')) h += '<div class="card rw-card2"><div class="row"><div class="field-label grow">Experience</div><div class="hint">' + inf.xp + ' XP total</div></div><div class="rw-bar big"><i style="width:' + Math.round(inf.frac * 100) + '%"></i></div><div class="hint" style="margin-top:.4rem">' + inf.into + ' / ' + inf.need + ' XP to Level ' + (inf.level + 1) + ' · entries +20, tasks +5, habits +5, plus bonuses</div></div>';
    if (ML.fx('streak')) h += '<div class="card rw-card2 rw-row"><div class="rw-big">🔥 ' + st.n + '</div><div class="grow"><div class="rw-t">' + st.n + '-day streak</div><div class="hint">Best ever: ' + bestStreak() + ' days' + (st.frozen ? ' · 🧊 a freeze is saving your streak' : ' · one missed day a week is forgiven') + '</div></div></div>';
    if (ML.fx('ring')) h += '<div class="card rw-card2"><div class="row"><div class="field-label grow">Today’s ring</div>' + ringSvg(f, 46) + '</div>' + parts.map(p => '<div class="rw-chk' + (p.done ? ' done' : '') + '"><span>' + (p.done ? '✓' : '') + '</span>' + esc(p.label) + '</div>').join('') + '<div class="hint">Close it for a +30 XP bonus and a big celebration.</div></div>';
    if (ML.fx('recap')) h += recapHtml();
    if (ML.fx('heatmap')) h += heatHtml();
    if (ML.fx('badges')) h += badgesHtml();
    if (ML.fx('trivia')) h += '<div class="card rw-card2"><div class="field-label">Game</div><div class="rw-row"><div class="rw-big">🎤</div><div class="grow"><div class="rw-t">Swiftie Trivia</div><div class="hint">5 questions about Taylor Swift’s songs, albums and eras. Played ' + t.played + ' · best ' + t.best + '/5</div></div></div><button class="btn-primary" id="rw-trivia" style="margin-top:.7rem">Play a round</button></div>';
    h += '<div class="hint" style="text-align:center;padding:.4rem 0 1rem">Turn any of these on or off in Settings → Rewards & fun.</div>';
    body.innerHTML = h;
    const sh = $('#rw-share', body); if (sh) sh.onclick = async () => { const tx = recapText(); try { if (navigator.share) await navigator.share({ text: tx }); else { await navigator.clipboard.writeText(tx); ML.toast('Recap copied'); } } catch (e) {} };
    body.querySelectorAll('.rw-tile').forEach(b => b.onclick = () => { ML.haptic('tick'); ML.toast(b.classList.contains('on') ? '✓ ' + b.dataset.d : '🔒 ' + b.dataset.d); });
    const tb = $('#rw-trivia', body); if (tb) tb.onclick = () => ML.trivia && ML.trivia.open();
  };
  ML.rewards.openScreen = function () { ML.rewards.renderScreen(); ML.ss('srewards'); };

  ML.initRewards = function () {
    const strip = $('#rw-strip'); if (strip) strip.onclick = () => { ML.haptic('tick'); ML.rewards.openScreen(); };
    const back = $('#rw-back'); if (back) back.onclick = () => ML.ss('smain');
    // anything already earned before this feature existed is granted quietly, no popups
    if (!G().badgeInit) { checkBadges(true); G().badgeInit = 1; ML.save('game'); }
    const cut = ML.dayKey(ML.addDays(new Date(), -90)); Object.keys(G().paid).forEach(k => { if ((k.split('|')[1] || '') < cut) delete G().paid[k]; });
    document.documentElement.classList.toggle('noanim', !ML.fx('anim'));
    ML.rewards.renderStrip();
  };
})();
