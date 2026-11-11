/* Moodlog — tactile mood dial: hi-DPI canvas, tick marks, gradient arc, growing knob, haptic ticks, fine-tune buttons */
(function () {
  const ML = window.ML, $ = ML.$;
  const SIZE = 260, C = SIZE / 2, R = 98, START = (3 / 4) * Math.PI, SWEEP = (3 / 2) * Math.PI;
  let cv, ctx, value = 50, dragging = false, knob = 0, knobTarget = 0, raf = 0, onChange = null, lastTick = 50;

  const angle = v => START + SWEEP * (v / 100);
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const track = 'rgba(128,128,128,.16)';
    // ticks
    for (let v = 0; v <= 100; v += 5) {
      const a = angle(v), major = v % 25 === 0, lit = v <= value;
      const r1 = R + 16, r2 = R + (major ? 27 : 22);
      ctx.beginPath(); ctx.moveTo(C + r1 * Math.cos(a), C + r1 * Math.sin(a)); ctx.lineTo(C + r2 * Math.cos(a), C + r2 * Math.sin(a));
      ctx.lineWidth = major ? 2.5 : 1.6; ctx.lineCap = 'round';
      ctx.strokeStyle = lit ? ML.moodColor(Math.max(1, v)) : track; ctx.stroke();
    }
    // track
    ctx.beginPath(); ctx.arc(C, C, R, START, START + SWEEP); ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.strokeStyle = track; ctx.stroke();
    // coloured progress, one tiny segment per point so the colour shifts along the arc
    for (let v = 1; v <= value; v++) {
      ctx.beginPath(); ctx.arc(C, C, R, angle(v - 1) - 0.004, angle(v) + 0.004);
      ctx.lineWidth = 18; ctx.lineCap = 'butt'; ctx.strokeStyle = ML.moodColor(v); ctx.stroke();
    }
    // end caps
    const ea = angle(value), col = ML.moodColor(value);
    ctx.beginPath(); ctx.arc(C + R * Math.cos(START), C + R * Math.sin(START), 9, 0, 7); ctx.fillStyle = ML.moodColor(1); ctx.fill();
    // knob
    const kx = C + R * Math.cos(ea), ky = C + R * Math.sin(ea), kr = 13 + knob * 7;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8 + knob * 10; ctx.shadowOffsetY = 2 + knob * 3;
    ctx.beginPath(); ctx.arc(kx, ky, kr, 0, 7); ctx.fillStyle = '#f7f4ee'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(kx, ky, kr - 4, 0, 7); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(kx, ky, 3, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
  }

  function animate() {
    cancelAnimationFrame(raf);
    const step = () => {
      knob += (knobTarget - knob) * 0.28;
      if (Math.abs(knobTarget - knob) < 0.01) knob = knobTarget;
      draw();
      if (knob !== knobTarget) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function setValue(v, fromUser) {
    v = Math.max(1, Math.min(100, Math.round(v)));
    if (v === value && fromUser) return;
    const prev = value; value = v;
    $('#dialval').textContent = v; $('#dialval').style.color = ML.moodColor(v); $('#dialword').textContent = ML.moodWord(v);
    if (fromUser) {
      if (v === 1 || v === 100) { if (prev !== v) ML.haptic('bump'); }
      else if (Math.floor(v / 5) !== Math.floor(lastTick / 5)) ML.haptic('tick');
      lastTick = v;
      if (onChange) onChange(v);
    }
    draw();
  }

  function fromPoint(e) {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * (SIZE / r.width) - C, y = (e.clientY - r.top) * (SIZE / r.height) - C;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    let rel = (((deg - 135) % 360) + 360) % 360; // 0..360 measured from the start of the arc
    if (rel > 270) rel = value > 50 ? 270 : 0; // in the gap: stick to the nearest end, no wrap-around jumps
    return (rel / 270) * 100;
  }

  ML.dial = {
    init(onChg) {
      cv = $('#dialcanvas'); onChange = onChg;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = SIZE * dpr; cv.height = SIZE * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.addEventListener('pointerdown', e => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} knobTarget = 1; animate(); setValue(fromPoint(e), true); e.preventDefault(); });
      cv.addEventListener('pointermove', e => { if (dragging) setValue(fromPoint(e), true); });
      const up = () => { if (!dragging) return; dragging = false; knobTarget = 0; animate(); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(value + 1, true);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(value - 1, true);
      });
      $('#dial-minus').addEventListener('click', () => setValue(value - 1, true));
      $('#dial-plus').addEventListener('click', () => setValue(value + 1, true));
      [['#dial-minus', -1], ['#dial-plus', 1]].forEach(([sel, d]) => { // hold to repeat
        const b = $(sel); let t, iv;
        const stop = () => { clearTimeout(t); clearInterval(iv); };
        b.addEventListener('pointerdown', () => { t = setTimeout(() => { iv = setInterval(() => setValue(value + d, true), 70); }, 350); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
      });
    },
    set(v) { lastTick = v; setValue(v, false); },
    get: () => value,
    redraw: draw
  };
})();
