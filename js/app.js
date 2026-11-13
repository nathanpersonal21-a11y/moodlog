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
      const kb = window.innerHeight - h > 140; root.classList.toggle('kb', kb);
      if (kb) { root.style.setProperty('--vvh', h + 'px'); root.style.setProperty('--vvt', top + 'px'); } else { root.style.removeProperty('--vvh'); root.style.removeProperty('--vvt'); }
    };
    set(); if (vv) { vv.addEventListener('resize', set); vv.addEventListener('scroll', set); } window.addEventListener('orientationchange', () => setTimeout(set, 250));
    document.addEventListener('focusin', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) setTimeout(() => { set(); try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320); });
    ['gesturestart', 'gesturechange'].forEach(e => document.addEventListener(e, ev => ev.preventDefault()));
    document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 60));
  }

  // step 1 of a new entry: pick the mood, then carry on to writing / recording (it all saves as ONE entry)
  ML.askMood = function (cb) {
    const cm = ML.currentMood(), pk = ML.moodPicker($('#g-mood-picker'), { mood: cm.mood, label: cm.label, size: 250 });
    const done = () => { $('#g-mood-picker').innerHTML = ''; };
    $('#g-save').onclick = () => { const m = pk.get(); ML.haptic('bump'); done(); cb(m); };
    $('#g-skip').onclick = () => { done(); ML.ss('smain'); };
    ML.ss('smood');
  };

  async function init() {
    iphone();
    await ML.loadStore();
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
