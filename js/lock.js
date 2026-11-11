/* Moodlog — passcode lock (convenience lock: the code is stored as a hash, not plain text) */
(function () {
  const ML = window.ML, $ = ML.$;
  const HASH = '688de4b907c516810f0d99632134b74da38300194c4c61e3a5cef7890914bc7b';
  const sha = async s => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  };
  let input = '', busy = false, onUnlock = null, returnTo = 'smain', hiddenAt = 0, locked = true;

  const dots = () => { for (let i = 0; i < 6; i++) $('#ld' + i).classList.toggle('filled', i < input.length); };

  async function key(k) {
    if (busy) return;
    const err = $('#lock-error'); err.textContent = '';
    if (k === 'clr') { input = ''; return dots(); }
    if (k === 'del') { input = input.slice(0, -1); return dots(); }
    if (input.length >= 6) return;
    input += k; dots(); ML.haptic('tick');
    if (input.length === 6) {
      busy = true;
      const ok = (await sha('moodlog:' + input)) === HASH;
      setTimeout(() => {
        if (ok) { input = ''; dots(); locked = false; busy = false; const cb = onUnlock; onUnlock = null; cb && cb(); }
        else {
          ML.haptic('bump');
          document.querySelectorAll('.lock-dot').forEach(d => d.classList.add('err'));
          setTimeout(() => { document.querySelectorAll('.lock-dot').forEach(d => d.classList.remove('err', 'filled')); input = ''; err.textContent = 'Incorrect passcode'; busy = false; }, 550);
        }
      }, 120);
    }
  }

  ML.lock = {
    isLocked: () => locked,
    // resolves when the correct passcode is entered
    show(back) {
      locked = true; input = ''; dots(); $('#lock-error').textContent = '';
      returnTo = back || 'smain';
      ML.ss('slock');
      return new Promise(res => { onUnlock = () => { ML.ss(returnTo); res(); }; });
    },
    init() {
      $('#lock-pad').addEventListener('click', e => { const k = e.target.closest('.lock-key'); if (k) key(k.dataset.k); });
      document.addEventListener('keydown', e => {
        if (!$('#slock').classList.contains('active')) return;
        if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('del');
      });
      // lock again after being away for a while
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); return; }
        const mins = ML.S.settings.lockAfter;
        if (!locked && hiddenAt && mins >= 0 && Date.now() - hiddenAt >= mins * 60000) {
          const cur = ML.currentScreen && ML.currentScreen() !== 'slock' ? ML.currentScreen() : 'smain';
          const safe = ['svoice', 'scheckin'].includes(cur) ? 'smain' : cur;
          ML.lock.show(safe);
        }
      });
    }
  };
})();
