/* Moodlog — shared helpers */
(function () {
  const ML = (window.ML = window.ML || {});
  ML.$ = (s, r = document) => r.querySelector(s);
  ML.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  ML.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  ML.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  ML.dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  ML.parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  ML.addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  ML.todayKey = () => ML.dayKey(Date.now());
  ML.fmtTime = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  ML.fmtDT = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  ML.fmtShort = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  ML.fmtLong = ts => new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  ML.fmtDayHdr = key => {
    const t = ML.todayKey(), y = ML.dayKey(ML.addDays(new Date(), -1));
    if (key === t) return 'Today';
    if (key === y) return 'Yesterday';
    return ML.parseDay(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  ML.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ── mood colours (continuous) ──
  const PAL = ['#5c6bc0', '#7986cb', '#4db6ac', '#81c784', '#aed581', '#dce775', '#fff176', '#ffb74d', '#ff8a65', '#c8a96e'];
  const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  ML.moodColor = s => {
    s = Math.max(1, Math.min(100, +s || 1));
    const t = Math.max(0, Math.min(9, (s - 5) / 10)), i = Math.min(8, Math.floor(t)), f = t - i;
    const a = rgb(PAL[i]), b = rgb(PAL[i + 1]);
    return 'rgb(' + a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',') + ')';
  };
  ML.moodWord = s => s <= 10 ? 'Awful' : s <= 20 ? 'Very low' : s <= 30 ? 'Low' : s <= 40 ? 'Meh' : s <= 50 ? 'Okay' : s <= 60 ? 'Fine' : s <= 70 ? 'Good' : s <= 80 ? 'Great' : s <= 90 ? 'Excellent' : 'Amazing';

  // ── toast ──
  ML.toast = (msg, dur = 2800) => {
    const el = ML.$('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(ML.toast._t); ML.toast._t = setTimeout(() => el.classList.remove('show'), dur);
  };

  // ── haptics (Android: vibrate; iPhone: Safari 17.4+ switch-checkbox trick) ──
  let iosEl = null;
  ML.haptic = kind => {
    if (ML.S && ML.S.settings && ML.S.settings.haptics === false) return;
    try {
      if (navigator.vibrate) { navigator.vibrate(kind === 'bump' ? 18 : 7); return; }
      if (!iosEl) {
        iosEl = document.createElement('label');
        iosEl.style.cssText = 'position:fixed;left:-200px;top:-200px;opacity:0;pointer-events:none';
        const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', '');
        iosEl.appendChild(i); document.body.appendChild(iosEl);
      }
      iosEl.click();
    } catch (e) {}
  };

  // ── image helpers ──
  ML.imageToBlob = (file, max, quality) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => b ? res(b) : rej(new Error('encode failed')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
  ML.squareIcon = (file, size) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
      c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, size, size);
      c.toBlob(b => b ? res(b) : rej(new Error('encode failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
  ML.blobToB64 = blob => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob);
  });
})();
