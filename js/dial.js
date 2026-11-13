/* Moodlog — mood picker: tactile dial (hi-DPI canvas, tick marks, gradient arc, growing knob, haptic ticks,
   fine-tune buttons) plus feeling chips. It lives inside the entry screens — there is no separate check-in. */
(function () {
  const ML = window.ML;
  const SIZE = 260, C = SIZE / 2, R = 98, START = (3 / 4) * Math.PI, SWEEP = (3 / 2) * Math.PI;
  const QUICK = ['Calm', 'Happy', 'Grateful', 'Content', 'Excited', 'Tired', 'Anxious', 'Stressed', 'Sad', 'Angry', 'Lonely', 'Overwhelmed'];
  const angle = v => START + SWEEP * (v / 100);

  const TEMPLATE = '<div class="card mood-card">'
    + '<div class="field-label" style="margin-bottom:.2rem">How are you feeling?</div>'
    + '<div class="dial-wrap"><canvas class="dial-canvas" tabindex="0" role="slider" aria-label="Mood" aria-valuemin="1" aria-valuemax="100"></canvas>'
    + '<div class="dial-center"><div class="dial-val">50</div><div class="dial-word">Okay</div></div></div>'
    + '<div class="dial-fine"><button type="button" class="dial-minus" aria-label="Lower">−</button><span>DRAG · TAP · HOLD</span><button type="button" class="dial-plus" aria-label="Raise">+</button></div>'
    + '<div class="mp-label"><input class="pill-input mp-input" maxlength="40" placeholder="Name the feeling (optional)" autocomplete="off" autocapitalize="sentences"><div class="chips mp-quick"></div></div>'
    + '</div>';

  // container: element to fill. init: {mood, label, size}. Returns {get(), set(), redraw()}.
  ML.moodPicker = function (container, init) {
    init = init || {};
    container.innerHTML = TEMPLATE;
    const root = container.firstElementChild, q = s => root.querySelector(s);
    const cv = q('.dial-canvas'), ctx = cv.getContext('2d'), valEl = q('.dial-val'), wordEl = q('.dial-word'), input = q('.mp-input'), quick = q('.mp-quick');
    const size = init.size || 232;
    q('.dial-wrap').style.setProperty('--ds', size + 'px');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(size * dpr);
    const k = (size * dpr) / SIZE;
    let value = Math.max(1, Math.min(100, Math.round(init.mood || 50))), lastTick = value, dragging = false, knob = 0, knobT = 0, raf = 0;

    function draw() {
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, SIZE, SIZE);
      const track = 'rgba(128,128,128,.18)';
      for (let v = 0; v <= 100; v += 5) {
        const a = angle(v), major = v % 25 === 0, lit = v <= value, r1 = R + 16, r2 = R + (major ? 27 : 22);
        ctx.beginPath(); ctx.moveTo(C + r1 * Math.cos(a), C + r1 * Math.sin(a)); ctx.lineTo(C + r2 * Math.cos(a), C + r2 * Math.sin(a));
        ctx.lineWidth = major ? 2.6 : 1.7; ctx.lineCap = 'round'; ctx.strokeStyle = lit ? ML.moodColor(Math.max(1, v)) : track; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(C, C, R, START, START + SWEEP); ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.strokeStyle = track; ctx.stroke();
      for (let v = 1; v <= value; v++) { ctx.beginPath(); ctx.arc(C, C, R, angle(v - 1) - 0.004, angle(v) + 0.004); ctx.lineWidth = 18; ctx.lineCap = 'butt'; ctx.strokeStyle = ML.moodColor(v); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(C + R * Math.cos(START), C + R * Math.sin(START), 9, 0, 7); ctx.fillStyle = ML.moodColor(1); ctx.fill();
      const ea = angle(value), col = ML.moodColor(value), kx = C + R * Math.cos(ea), ky = C + R * Math.sin(ea), kr = 13 + knob * 7;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8 + knob * 10; ctx.shadowOffsetY = 2 + knob * 3;
      ctx.beginPath(); ctx.arc(kx, ky, kr, 0, 7); ctx.fillStyle = '#f7f4ee'; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(kx, ky, kr - 4, 0, 7); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(kx, ky, 3, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    }
    function animate() {
      cancelAnimationFrame(raf);
      const step = () => { knob += (knobT - knob) * 0.28; if (Math.abs(knobT - knob) < 0.01) knob = knobT; draw(); if (knob !== knobT) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    function setValue(v, fromUser) {
      v = Math.max(1, Math.min(100, Math.round(v)));
      if (v === value && fromUser) return;
      const prev = value; value = v;
      valEl.textContent = v; valEl.style.color = ML.moodColor(v); wordEl.textContent = ML.moodWord(v); cv.setAttribute('aria-valuenow', v);
      if (fromUser) {
        if (v === 1 || v === 100) { if (prev !== v) ML.haptic('bump'); }
        else if (Math.floor(v / 5) !== Math.floor(lastTick / 5)) ML.haptic('tick');
        lastTick = v;
      }
      draw();
    }
    function fromPoint(e) {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (SIZE / r.width) - C, y = (e.clientY - r.top) * (SIZE / r.height) - C;
      const deg = (Math.atan2(y, x) * 180) / Math.PI;
      let rel = (((deg - 135) % 360) + 360) % 360;
      if (rel > 270) rel = value > 50 ? 270 : 0; // in the gap: stick to the nearest end, no wrap-around jumps
      return (rel / 270) * 100;
    }
    cv.addEventListener('pointerdown', e => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} knobT = 1; animate(); setValue(fromPoint(e), true); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (dragging) setValue(fromPoint(e), true); });
    const up = () => { if (!dragging) return; dragging = false; knobT = 0; animate(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(value + 1, true); else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(value - 1, true);
    });
    [['.dial-minus', -1], ['.dial-plus', 1]].forEach(([sel, d]) => { // tap = ±1, hold = repeat
      const b = q(sel); let t, iv, held = false;
      const stop = () => { clearTimeout(t); clearInterval(iv); };
      b.addEventListener('click', () => { if (held) { held = false; return; } setValue(value + d, true); });
      b.addEventListener('pointerdown', () => { held = false; t = setTimeout(() => { held = true; iv = setInterval(() => setValue(value + d, true), 70); }, 350); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    });

    const drawQuick = () => {
      const cur = input.value.trim().toLowerCase(); quick.innerHTML = '';
      QUICK.forEach(w => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip sm' + (cur === w.toLowerCase() ? ' on' : ''); b.textContent = w;
        b.onclick = () => { input.value = cur === w.toLowerCase() ? '' : w; ML.haptic('tick'); drawQuick(); };
        quick.appendChild(b);
      });
    };
    input.addEventListener('input', drawQuick);
    input.value = init.label || '';
    drawQuick(); setValue(value, false); lastTick = value;

    return {
      get: () => ({ mood: value, label: input.value.trim().slice(0, 40) }),
      set(m, label) { setValue(m, false); lastTick = value; input.value = label || ''; drawQuick(); },
      redraw: draw
    };
  };

  // the mood you set most recently (today) — new entries start from it
  ML.currentMood = () => {
    const c = ML.S.settings.curMood;
    return c && ML.dayKey(c.ts) === ML.todayKey() ? { mood: c.mood, label: c.label || '' } : { mood: 50, label: '' };
  };
  ML.defaultMood = () => ML.currentMood().mood;
  ML.setCurrentMood = (mood, label) => { ML.S.settings.curMood = { ts: Date.now(), mood, label: label || '' }; ML.save('settings'); };

  // compact mood row for entry screens (no scrolling): tap to open the dial in a sheet
  ML.moodChip = function (container, init) {
    let st = { mood: init.mood || 50, label: init.label || '' };
    const paint = () => {
      container.innerHTML = '<button type="button" class="card mood-chip"><b style="color:' + ML.moodColor(st.mood) + '">' + st.mood + '</b><span class="grow" style="text-align:left"><span style="display:block;font-size:15px">' + ML.esc(st.label || ML.moodWord(st.mood)) + '</span><span class="hint">Tap to change mood</span></span><span class="muted">›</span></button>';
      container.firstElementChild.onclick = () => ML.sheet('How are you feeling?', '<div id="sp-mp"></div><button class="btn-primary" id="sp-ok">Done</button>', (el, close) => {
        const pk = ML.moodPicker(el.querySelector('#sp-mp'), { mood: st.mood, label: st.label, size: 210 });
        el.querySelector('#sp-ok').onclick = () => { st = pk.get(); close(); paint(); };
      });
    };
    paint();
    return { get: () => ({ mood: st.mood, label: st.label }), set(m, l) { st = { mood: m, label: l || '' }; paint(); } };
  };
})();
