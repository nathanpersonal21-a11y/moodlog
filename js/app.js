/* Moodlog — start-up and navigation */
(function () {
  const ML = window.ML, $ = ML.$, S = ML.S;

  ML.showTab = t => {
    ML.$$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
    ML.$$('.tab-panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + t));
    if (t === 'journal') ML.renderJournal(); else if (t === 'todo') ML.renderTodo(); else if (t === 'trends') ML.renderTrends(); else if (t === 'habits') { ML.resetHabitsDay(); ML.renderHabits(); } else if (t === 'settings') ML.renderSettings();
    ML.haptic('tick');
  };

  ML.refreshHome = () => {
    const last = ML.data.latestEntry();
    const today = last && ML.dayKey(last.ts) === ML.todayKey();
    $('#pillsc').textContent = today ? last.mood : '—'; $('#pillsc').style.color = today ? ML.moodColor(last.mood) : '';
    $('#pilllbl').textContent = today ? (last.moodLabel || ML.moodWord(last.mood)) : 'log mood';
    ML.renderJournal();
    const active = (ML.$('.tab-panel.active') || {}).id;
    if (active === 'tab-trends') ML.renderTrends(); else if (active === 'tab-habits') ML.renderHabits();
  };

  // iPhone: track the visible height (keyboard), stop pinch-zoom, scroll back after the keyboard closes
  function iphone() {
    // keep the app exactly as tall as what is visible (so the keyboard never covers the field you're typing in)
    const root = document.documentElement, vv = window.visualViewport;
    const set = () => {
      const h = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0;
      root.style.setProperty('--vvh', h + 'px'); root.style.setProperty('--vvt', top + 'px');
      root.classList.toggle('kb', window.innerHeight - h > 140);
    };
    set(); if (vv) { vv.addEventListener('resize', set); vv.addEventListener('scroll', set); } window.addEventListener('orientationchange', () => setTimeout(set, 250));
    document.addEventListener('focusin', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) setTimeout(() => { set(); try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320); });
    ['gesturestart', 'gesturechange'].forEach(e => document.addEventListener(e, ev => ev.preventDefault()));
    document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 60));
  }

  // mood dial right when the app opens, then straight to the journal (new entries start from this mood)
  function openMoodGate() {
    const last = ML.data.latestEntry(), gap = S.settings.checkinGapHours;
    if (last && gap > 0 && Date.now() - last.ts < gap * 3600000) return;
    const cm = ML.currentMood(), pk = ML.moodPicker($('#g-mood-picker'), { mood: cm.mood, label: cm.label, size: 250 });
    $('#g-save').onclick = () => {
      const m = pk.get(); ML.haptic('bump');
      ML.data.addEntry({ id: ML.uid(), ts: Date.now(), updatedAt: Date.now(), type: 'text', mood: m.mood, moodLabel: m.label, text: '', transcript: '', tags: [], loc: null, photoId: null, audioId: null, imageUrl: null, driveUrl: null, synced: false });
      ML.setCurrentMood(m.mood, m.label); ML.refreshHome(); ML.ss('smain'); $('#g-mood-picker').innerHTML = '';
    };
    $('#g-skip').onclick = () => { ML.ss('smain'); $('#g-mood-picker').innerHTML = ''; };
    ML.ss('smood');
  }

  async function init() {
    iphone();
    await ML.loadStore();
    if (!S.settings.gate4) { S.settings.gate4 = 1; S.settings.checkinGapHours = 0; ML.save('settings'); }
    ML.applyTheme(); ML.applyBackground(); ML.applyIcon();
    ML.lock.init(); ML.initJournal(); ML.initVoice(); ML.sync.init(); ML.initTodo();
    ML.$$('.tab').forEach(t => t.addEventListener('click', () => ML.showTab(t.dataset.tab)));
    const badge = $('#mood-badge'); badge.addEventListener('click', () => ML.openCompose());
    badge.addEventListener('keydown', e => { if (e.key === 'Enter') badge.click(); });
    ML.refreshHome();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    }

    await ML.lock.show('smain');
    ML.reminders.maybeRefresh();
    openMoodGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
