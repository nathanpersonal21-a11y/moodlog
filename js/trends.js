/* Moodlog — trends: weekly / monthly / 3-month / yearly mood, patterns, tag impact, habits */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  let range = 30;
  const RANGES = [[7, 'Week'], [30, 'Month'], [90, '3 mo'], [365, 'Year']];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const r1 = n => Math.round(n);

  function daily(pts) { const m = {}; pts.forEach(p => { const k = ML.dayKey(p.ts); (m[k] = m[k] || []).push(p.mood); }); return m; }
  function weekStart(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; }

  function lineChart(pts, days, weekly) {
    const W = 340, H = 170, pl = 26, pr = 8, pt = 10, pb = 22, cw = W - pl - pr, ch = H - pt - pb;
    const end = new Date(); end.setHours(23, 59, 59, 999); const t1 = end.getTime(), t0 = ML.addDays(end, -(days - 1)).setHours(0, 0, 0, 0);
    const X = t => pl + ((t - t0) / (t1 - t0)) * cw, Y = v => pt + (1 - v / 100) * ch;
    let series = [];
    if (weekly) {
      const g = {}; pts.forEach(p => { const ws = weekStart(new Date(p.ts)); const k = ws.getTime(); (g[k] = g[k] || []).push(p.mood); });
      series = Object.keys(g).map(k => ({ t: Math.max(t0, +k) + 3.5 * 864e5 > t1 ? t1 - 864e5 : Math.max(t0, +k) + 3.5 * 864e5, v: avg(g[k]), label: 'Week of ' + ML.fmtShort(+k), n: g[k].length }));
    } else {
      const d = daily(pts); series = Object.keys(d).map(k => { const dt = ML.parseDay(k); return { t: dt.getTime() + 12 * 36e5, v: avg(d[k]), label: ML.fmtShort(dt), n: d[k].length }; });
    }
    series.sort((a, b) => a.t - b.t);
    let svg = '<svg class="chart" id="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mood over time">';
    [0, 25, 50, 75, 100].forEach(v => { svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--border2)" stroke-width="1"' + (v === 50 ? ' stroke-dasharray="3 3"' : '') + '/><text x="' + (pl - 5) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + '</text>'; });
    const gap = (weekly ? 24 : 3.5) * 864e5; let d = '';
    series.forEach((p, i) => { d += (i === 0 || p.t - series[i - 1].t > gap ? 'M' : 'L') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1) + ' '; });
    if (series.length > 1) svg += '<path d="' + d + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>';
    series.forEach(p => { svg += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (days > 90 ? 2.6 : 3.4) + '" fill="' + ML.moodColor(p.v) + '" stroke="var(--bg2)" stroke-width="1.2"/>'; });
    [0, 0.5, 1].forEach(f => { const t = t0 + (t1 - t0) * f; svg += '<text x="' + X(t) + '" y="' + (H - 6) + '" text-anchor="' + (f === 0 ? 'start' : f === 1 ? 'end' : 'middle') + '">' + ML.fmtShort(t) + '</text>'; });
    svg += '<circle id="trend-hi" r="6" fill="none" stroke="var(--text)" stroke-width="1.6" style="display:none"/></svg>';
    return { svg, series, X, Y };
  }

  const bar = (label, pct, color, val) => '<div class="bar-row"><div class="lbl">' + esc(label) + '</div><div class="track"><div class="fill" style="width:' + Math.max(2, pct) + '%;background:' + color + '"></div></div><div class="val">' + val + '</div></div>';

  function render() {
    const body = $('#trends-body'); if (!body) return;
    const now = new Date(), startK = ML.dayKey(ML.addDays(now, -(range - 1))), prevStartK = ML.dayKey(ML.addDays(now, -(range * 2 - 1)));
    const pts = S.entries.filter(c => ML.dayKey(c.ts) >= startK);
    const prev = S.entries.filter(c => { const k = ML.dayKey(c.ts); return k >= prevStartK && k < startK; });
    let html = '<div class="seg" id="t-seg">' + RANGES.map(([d, l]) => '<button data-d="' + d + '" class="' + (d === range ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
    if (!pts.length) {
      html += '<div class="empty-state"><div class="empty-icon">📈</div><p>No entries in this period yet. Add a few entries with your mood and your trends show up here.</p></div><button class="btn-primary" id="t-ci">Write an entry</button>';
      body.innerHTML = html; wire(body); return;
    }
    const all = pts.map(p => p.mood), mean = avg(all), pm = prev.length ? avg(prev.map(p => p.mood)) : null;
    const dm = daily(pts), keys = Object.keys(dm), dAvg = keys.map(k => ({ k, v: avg(dm[k]) }));
    const best = dAvg.reduce((a, b) => b.v > a.v ? b : a), low = dAvg.reduce((a, b) => b.v < a.v ? b : a);
    let streak = 0; for (let i = 0; i < 400; i++) { const k = ML.dayKey(ML.addDays(now, -i)); if (dm[k] || S.entries.some(c => ML.dayKey(c.ts) === k)) streak++; else if (i > 0) break; else continue; }
    const delta = pm == null ? null : mean - pm;

    // chart
    const lc = lineChart(pts, range, range >= 90);
    html += '<div class="card"><div class="chart-title">Mood over time' + (range >= 90 ? ' · weekly average' : '') + '</div><div class="chart-read" id="t-read">Touch the chart to see a day</div>' + lc.svg + '</div>';

    // stats
    html += '<div class="stat-grid">'
      + '<div class="stat"><div class="k">Average</div><div class="v" style="color:' + ML.moodColor(mean) + '">' + r1(mean) + '</div><div class="s ' + (delta == null ? '' : delta >= 0 ? 'up' : 'down') + '">' + (delta == null ? ML.moodWord(mean) : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(r1(delta)) + ' vs previous') + '</div></div>'
      + '<div class="stat"><div class="k">Entries</div><div class="v">' + pts.length + '</div><div class="s">' + keys.length + ' of ' + range + ' days · ' + streak + ' day streak</div></div>'
      + '<div class="stat"><div class="k">Best day</div><div class="v" style="color:' + ML.moodColor(best.v) + '">' + r1(best.v) + '</div><div class="s">' + ML.fmtShort(ML.parseDay(best.k)) + '</div></div>'
      + '<div class="stat"><div class="k">Lowest day</div><div class="v" style="color:' + ML.moodColor(low.v) + '">' + r1(low.v) + '</div><div class="s">' + ML.fmtShort(ML.parseDay(low.k)) + '</div></div></div>';

    // weekday pattern
    const wd = Array.from({ length: 7 }, () => []); pts.forEach(p => wd[new Date(p.ts).getDay()].push(p.mood));
    const wdAvg = wd.map(a => avg(a));
    if (range >= 30 && wdAvg.filter(v => v != null).length >= 3) {
      const ok = wdAvg.map((v, i) => ({ v, i })).filter(x => x.v != null), hi = ok.reduce((a, b) => b.v > a.v ? b : a), lo = ok.reduce((a, b) => b.v < a.v ? b : a);
      html += '<div class="card"><div class="chart-title">By day of week</div><div class="bars">' + [1, 2, 3, 4, 5, 6, 0].map(i => wdAvg[i] == null ? bar(WD[i], 0, 'var(--bg3)', '–') : bar(WD[i], wdAvg[i], ML.moodColor(wdAvg[i]), r1(wdAvg[i]))).join('') + '</div>'
        + (hi.i !== lo.i ? '<div class="insight" style="margin-top:.8rem">You tend to feel best on <b>' + WD[hi.i] + 's</b> (' + r1(hi.v) + ') and lowest on <b>' + WD[lo.i] + 's</b> (' + r1(lo.v) + ').</div>' : '') + '</div>';
    }
    // time of day
    const tod = { Morning: [], Afternoon: [], Evening: [], Night: [] };
    pts.forEach(p => { const h = new Date(p.ts).getHours(); tod[h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : h >= 17 && h < 22 ? 'Evening' : 'Night'].push(p.mood); });
    if (Object.values(tod).filter(a => a.length).length >= 2 && pts.length >= 6) html += '<div class="card"><div class="chart-title">By time of day</div><div class="bars">' + Object.keys(tod).map(k => tod[k].length ? bar(k, avg(tod[k]), ML.moodColor(avg(tod[k])), r1(avg(tod[k]))) : bar(k, 0, 'var(--bg3)', '–')).join('') + '</div></div>';

    // calendar heatmap
    if (range >= 30) {
      const first = ML.addDays(now, -(range - 1)), off = first.getDay(), weeks = Math.ceil((range + off) / 7), cs = 12, g = 3;
      let hm = '<svg class="chart" viewBox="0 0 ' + (weeks * (cs + g)) + ' ' + (7 * (cs + g)) + '" role="img" aria-label="Mood calendar">';
      for (let i = 0; i < range; i++) { const d = ML.addDays(first, i), k = ML.dayKey(d), col = Math.floor((i + off) / 7), row = d.getDay(); hm += '<rect x="' + col * (cs + g) + '" y="' + row * (cs + g) + '" width="' + cs + '" height="' + cs + '" rx="3" fill="' + (dm[k] ? ML.moodColor(avg(dm[k])) : 'var(--bg3)') + '"/>'; }
      html += '<div class="card"><div class="chart-title">Mood calendar</div>' + hm + '</svg><div class="hint" style="margin-top:.4rem">Each square is a day, colored by your average mood. Rows are Sun → Sat.</div></div>';
    }

    // tag impact
    const rows = [];
    S.tags.forEach(t => { const m = pts.filter(p => (p.tags || []).includes(t.id)).map(p => p.mood); if (m.length >= 2) rows.push({ t, n: m.length, d: avg(m) - mean }); });
    if (rows.length) {
      rows.sort((a, b) => b.d - a.d); const mx = Math.max(10, ...rows.map(r => Math.abs(r.d)));
      html += '<div class="card"><div class="chart-title">What shifts your mood</div><div class="bars">' + rows.slice(0, 8).map(r => '<div class="bar-row"><div class="lbl">' + esc((r.t.emoji ? r.t.emoji + ' ' : '') + r.t.name) + '</div><div class="delta-track"><i style="' + (r.d >= 0 ? 'left:50%;width:' + (r.d / mx * 50) + '%;background:var(--success)' : 'right:50%;width:' + (-r.d / mx * 50) + '%;background:var(--danger)') + '"></i></div><div class="val ' + (r.d >= 0 ? 'up' : 'down') + '">' + (r.d >= 0 ? '+' : '') + r1(r.d) + '</div></div>').join('') + '</div><div class="hint" style="margin-top:.6rem">Average mood at check-ins tagged with each activity, compared to your overall average. Needs 2+ tagged check-ins.</div></div>';
    } else if (S.tags.length === 0) html += '<div class="card"><div class="chart-title">What shifts your mood</div><div class="insight">Add tags like Exercise or Friends when you write an entry, and Moodlog will show which activities lift or lower your mood.</div></div>';

    // top feelings
    const lab = {}; pts.forEach(p => { const l = (p.moodLabel || '').trim(); if (l) { const k = l.toLowerCase(); lab[k] = (lab[k] || 0) + 1; } });
    const top = Object.entries(lab).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length) html += '<div class="card"><div class="chart-title">Most common feelings</div><div class="chips">' + top.map(([l, n]) => '<span class="chip static">' + esc(l) + ' · ' + n + '</span>').join('') + '</div></div>';

    // habits
    if (S.habits.length) {
      const hr = S.habits.map(h => ({ h, r: ML.data.rate(h, range) })).filter(x => x.r != null);
      let ins = '';
      const full = [], notFull = [];
      Object.keys(dm).forEach(k => { const d = ML.parseDay(k), due = S.habits.filter(h => ML.data.scheduled(h, d)); if (!due.length) return; (due.every(h => ML.data.habitDone(h.id, k)) ? full : notFull).push(avg(dm[k])); });
      if (full.length >= 3 && notFull.length >= 3) { const a = avg(full), b = avg(notFull); ins = '<div class="insight" style="margin-top:.8rem">On days you finish every habit your mood averages <b>' + r1(a) + '</b>, versus <b>' + r1(b) + '</b> on other days.</div>'; }
      if (hr.length) html += '<div class="card"><div class="chart-title">Habit completion</div><div class="bars">' + hr.map(x => bar((x.h.emoji || '') + ' ' + x.h.name, x.r * 100, x.r >= .7 ? 'var(--success)' : 'var(--gold)', Math.round(x.r * 100) + '%')).join('') + '</div>' + ins + '</div>';
    }

    body.innerHTML = html; wire(body);
    // chart touch readout
    const svg = $('#trend-svg', body);
    if (svg) {
      const show = e => {
        const rc = svg.getBoundingClientRect(), x = (e.clientX - rc.left) * (340 / rc.width);
        let b = null, bd = 1e9; lc.series.forEach(s => { const dd = Math.abs(lc.X(s.t) - x); if (dd < bd) { bd = dd; b = s; } });
        if (!b) return; const hi = $('#trend-hi', svg); hi.setAttribute('cx', lc.X(b.t)); hi.setAttribute('cy', lc.Y(b.v)); hi.style.display = '';
        const w = $('#t-read', body); w.innerHTML = esc(b.label) + ' · <b style="color:' + ML.moodColor(b.v) + '">' + r1(b.v) + '</b> · ' + ML.moodWord(b.v) + ' · ' + b.n + ' entr' + (b.n > 1 ? 'ies' : 'y') + (false ? 's' : '');
      };
      svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') show(e); });
    }
  }

  function wire(body) {
    body.querySelectorAll('#t-seg button').forEach(b => b.onclick = () => { range = +b.dataset.d; render(); });
    const ci = $('#t-ci', body); if (ci) ci.onclick = () => ML.openCompose();
  }
  ML.renderTrends = render;
})();
