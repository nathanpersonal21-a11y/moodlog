/* Moodlog — celebrations: confetti + an optional synthesised chime (no audio files, works offline).
   Both can be switched on/off in the To-do tab and in Settings. iPhone note: the silent switch mutes web audio. */
(function () {
  const ML = window.ML, S = ML.S;

  // ── sound (Web Audio) ──
  let ac = null;
  const audio = () => {
    try {
      if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  };
  function tone(freq, t0, dur, type, gain) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  ML.sound = {
    unlock() { audio(); },
    // kind: 'ping' (one task) or 'big' (everything done)
    play(kind) {
      if (!S.settings.sound) return;
      const c = audio(); if (!c) return; const t = c.currentTime + 0.02;
      if (kind === 'big') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.085, 0.55, 'triangle', 0.16));
        tone(1046.5, t + 0.5, 1.0, 'sine', 0.12); tone(1568, t + 0.52, 0.9, 'sine', 0.07);
      } else { tone(880, t, 0.22, 'triangle', 0.15); tone(1318.5, t + 0.08, 0.32, 'triangle', 0.13); }
    }
  };
  // the first touch anywhere unlocks audio on iPhone, so the first celebration is audible
  document.addEventListener('pointerdown', () => { if (S.settings.sound) ML.sound.unlock(); }, { once: false, passive: true });

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
  ML.celebrate = (el, big) => {
    if (S.settings.confetti !== false) {
      ensure();
      const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      burst(x, y, 70, 2.6, 11, true);
      if (big) { burst(0, H, 70, 1.1, 20, true); parts.slice(-70).forEach(p => { p.vx = Math.abs(p.vx) * 0.9 + 2; p.vy = -Math.abs(p.vy) - 4; }); burst(W, H, 70, 1.1, 20, true); parts.slice(-70).forEach(p => { p.vx = -Math.abs(p.vx) * 0.9 - 2; p.vy = -Math.abs(p.vy) - 4; }); for (let i = 0; i < 70; i++) burst(Math.random() * W, -10 - Math.random() * 120, 1, 0.8, 2, false); }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    ML.sound.play(big ? 'big' : 'ping');
  };
})();
