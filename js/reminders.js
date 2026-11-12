/* Moodlog — phone reminders. Web apps can't push notifications without a server, so the reminder schedule is sent to
   your Apps Script, which creates repeating Google Calendar events with a popup alert. Your phone's calendar app shows them. */
(function () {
  const ML = window.ML, S = ML.S;
  const DOWN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  ML.DOWN = DOWN;

  const schedule = () => {
    const r = S.settings.reminders; if (!r.enabled) return [];
    return DOWN.map((_, i) => ({ dow: i, time: r.same ? r.time : r.days[i].time, on: r.same ? true : r.days[i].on })).filter(d => d.on);
  };

  ML.reminders = {
    schedule,
    async push() {
      if (!S.settings.scriptUrl) throw new Error('Set your Apps Script URL first (Settings → Backup)');
      const j = await ML.sync.post({ action: 'setReminders', enabled: S.settings.reminders.enabled, days: schedule(), title: 'Moodlog journal', appUrl: location.href.split('#')[0] });
      if (!j || !j.success) throw new Error((j && j.error) || 'Apps Script did not accept the reminders — update it from the README');
      S.settings.reminders.lastSync = Date.now(); ML.save('settings'); return j;
    },
    async test() {
      if (!S.settings.scriptUrl) throw new Error('Set your Apps Script URL first');
      const j = await ML.sync.post({ action: 'testReminder', appUrl: location.href.split('#')[0] });
      if (!j || !j.success) throw new Error((j && j.error) || 'Apps Script did not accept the test');
      return j;
    },
    // times can drift when clocks change, so refresh the calendar events about once a week
    maybeRefresh() {
      const r = S.settings.reminders;
      if (r.enabled && S.settings.scriptUrl && navigator.onLine && Date.now() - (r.lastSync || 0) > 7 * 864e5) ML.reminders.push().catch(() => {});
    }
  };
})();
