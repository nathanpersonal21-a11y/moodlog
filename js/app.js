/* Moodlog — start-up and navigation */
(function () {
  const ML = window.ML, $ = ML.$, S = ML.S;

  ML.showTab = t => {
    ML.$$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
    ML.$$('.tab-panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + t));
    if (t === 'journal') ML.renderJournal(); else if (t === 'trends') ML.renderTrends(); else if (t === 'habits') { ML.resetHabitsDay(); ML.renderHabits(); } else if (t === 'settings') ML.renderSettings();
    ML.haptic('tick');
  };

  ML.refreshHome = () => {
    const last = ML.data.latestCheckin();
    const today = last && ML.dayKey(last.ts) === ML.todayKey();
    $('#pillsc').textContent = today ? last.mood : '—'; $('#pillsc').style.color = today ? ML.moodColor(last.mood) : '';
    $('#pilllbl').textContent = today ? (last.label || ML.moodWord(last.mood)) : 'check in';
    ML.renderJournal(); ML.refreshComposeMood && ML.refreshComposeMood();
    const active = (ML.$('.tab-panel.active') || {}).id;
    if (active === 'tab-trends') ML.renderTrends(); else if (active === 'tab-habits') ML.renderHabits();
  };

  async function init() {
    await ML.loadStore();
    ML.applyTheme(); ML.applyBackground(); ML.applyIcon();
    ML.lock.init(); ML.initJournal(); ML.initVoice(); ML.sync.init();
    ML.$$('.tab').forEach(t => t.addEventListener('click', () => ML.showTab(t.dataset.tab)));
    const badge = $('#mood-badge'); badge.addEventListener('click', () => ML.openCheckin({ returnTo: 'smain' }));
    badge.addEventListener('keydown', e => { if (e.key === 'Enter') badge.click(); });
    ML.refreshHome();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    }

    await ML.lock.show('smain');
    ML.reminders.maybeRefresh();
    // like the old mood gate: ask once per day on first open, skippable
    const last = ML.data.latestCheckin();
    if (!last || ML.dayKey(last.ts) !== ML.todayKey()) ML.openCheckin({ returnTo: 'smain' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
