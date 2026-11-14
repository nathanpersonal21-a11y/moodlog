/* Moodlog — celebrations: confetti + synthesised chimes (no audio files, works offline).
   Sounds are rendered to little WAV files and played through <audio> elements: unlike Web Audio, <audio> keeps playing
   when the iPhone silent switch is on, and navigator.audioSession ("playback") is set where Safari supports it. */
(function () {
  const ML = window.ML, S = ML.S;

  const SR = 22050;
  const wave = (type, ph) => type === 'sine' ? Math.sin(ph) : type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph) + 0.3 * Math.sin(2 * ph);
  // notes: [freq, start s, length s, type, gain]
  function render(notes) {
    const total = Math.max.apply(null, notes.map(n => n[1] + n[2])) + 0.08, f = new Float32Array(Math.ceil(total * SR));
    notes.forEach(([fr, t0, d, type, g]) => {
      const a = Math.floor(t0 * SR), n = Math.floor(d * SR);
      for (let i = 0; i < n && a + i < f.length; i++) {
        const t = i / SR, env = Math.min(1, t / 0.012) * Math.exp(-4.2 * t / d) * (i > n - 200 ? (n - i) / 200 : 1);
        f[a + i] += wave(type, 2 * Math.PI * fr * t) * g * env;
      }
    });
    return f;
  }
  function toWav(f) {
    const b = new ArrayBuffer(44 + f.length * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + f.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, f.length * 2, true);
    for (let i = 0; i < f.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f[i])) * 32767, true);
    return new Blob([b], { type: 'audio/wav' });
  }
  const arp = (fs, gap, len, type, g) => fs.map((fr, i) => [fr, i * gap, len, type, g]);
  const SOUNDS = {
    ping: () => [[880, 0, 0.22, 'triangle', 0.3], [1318.5, 0.08, 0.32, 'triangle', 0.26]],
    big: () => arp([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.085, 0.55, 'triangle', 0.3).concat([[1046.5, 0.5, 1.0, 'sine', 0.24], [1568, 0.52, 0.9, 'sine', 0.14]]),
    save: () => arp([659.25, 880, 1174.7], 0.09, 0.3, 'triangle', 0.28),
    level: () => arp([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568], 0.09, 0.5, 'triangle', 0.28).concat([[2093, 0.6, 0.9, 'sine', 0.14], [1046.5, 0.55, 1.1, 'sine', 0.2]]),
    badge: () => arp([784, 988, 1175, 1568], 0.1, 0.45, 'triangle', 0.28).concat([[2349, 0.42, 0.7, 'sine', 0.12]]),
    bonus: () => arp([1568, 2093, 2637, 3136], 0.06, 0.25, 'sine', 0.2),
    good: () => [[988, 0, 0.16, 'triangle', 0.3], [1318.5, 0.09, 0.3, 'triangle', 0.28]],
    bad: () => [[330, 0, 0.22, 'sine', 0.3], [247, 0.14, 0.34, 'sine', 0.28]]
  };
  const pool = {}; let unlocked = false;
  function get(kind) {
    if (pool[kind]) return pool[kind];
    try { const a = new Audio(URL.createObjectURL(toWav(render(SOUNDS[kind]())))); a.preload = 'auto'; a.setAttribute('playsinline', ''); pool[kind] = a; return a; } catch (e) { return null; }
  }
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (unlocked) return; unlocked = true;
    Object.keys(SOUNDS).forEach(k => { const a = get(k); if (!a) return; a.muted = true; const p = a.play(); const back = () => { try { a.pause(); a.currentTime = 0; a.muted = false; } catch (e) {} }; if (p && p.then) p.then(back, () => { a.muted = false; unlocked = false; }); else back(); });
  }
  ML.sound = {
    unlock,
    play(kind) {
      if (!S.settings.sound) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      const a = get(kind === 'big' || SOUNDS[kind] ? kind : 'ping'); if (!a) return;
      try { a.muted = false; a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  };
  // the first touch anywhere unlocks audio on iPhone, so the first celebration is audible
  document.addEventListener('pointerdown', () => { if (S.settings.sound) unlock(); }, { passive: true });

  // ── confetti ──
  let cv = null, cx = null, parts = [], raf = 0, W = 0, H = 0, dpr = 1, last = 0;
  const COLORS = ['#ff5c8a', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f43', '#ffffff'];
  function ensure() {
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'confetti'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); cx = cv.getContext('2d'); }
    const vv = window.visualViewport; dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(vv ? vv.width : window.innerWidth); H = Math.round(vv ? vv.height : window.innerHeight);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv.style.display = 'block';
  }
  function burst(x, y, n, spread, power, upward) {
    for (let i = 0; i < n; i++) {
      const a = (upward ? -Math.PI / 2 : 0) + (Math.random() - 0.5) * spread, sp = power * (0.45 + Math.random() * 0.75);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.45, c: COLORS[(Math.random() * COLORS.length) | 0], life: 0, max: 1500 + Math.random() * 1100, round: Math.random() < 0.25 });
    }
  }
  function frame(t) {
    const dt = Math.min(40, t - last) / 16.67; last = t;
    cx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.life < p.max && p.y < H + 30);
    parts.forEach(p => {
      p.life += dt * 16.67; p.vy += 0.34 * dt; p.vx *= Math.pow(0.992, dt); p.vy *= Math.pow(0.994, dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, (p.max - p.life) / 500)); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
      if (p.round) { cx.beginPath(); cx.arc(0, 0, p.w / 2.2, 0, 7); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(frame); else { cx.clearRect(0, 0, W, H); cv.style.display = 'none'; raf = 0; }
  }

  // el: element the burst comes from (e.g. the check button); big: everything is finished
  ML.celebrate = (el, big, silent) => {
    if (S.settings.confetti !== false) {
      ensure();
      const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      burst(x, y, 70, 2.6, 11, true);
      if (big) { burst(0, H, 70, 1.1, 20, true); parts.slice(-70).forEach(p => { p.vx = Math.abs(p.vx) * 0.9 + 2; p.vy = -Math.abs(p.vy) - 4; }); burst(W, H, 70, 1.1, 20, true); parts.slice(-70).forEach(p => { p.vx = -Math.abs(p.vx) * 0.9 - 2; p.vy = -Math.abs(p.vy) - 4; }); for (let i = 0; i < 70; i++) burst(Math.random() * W, -10 - Math.random() * 120, 1, 0.8, 2, false); }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    if (!silent) ML.sound.play(big ? 'big' : 'ping');
  };
})();
