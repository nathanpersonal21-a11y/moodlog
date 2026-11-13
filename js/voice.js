/* Moodlog — voice entries. Transcription is the same as before (your phone's built-in speech recognition, live).
   Extras: audio is always kept on the device until backed up, transcript can be corrected before saving,
   and when you are online with an API key set, a better cloud model can re-transcribe the recording. */
(function () {
  const ML = window.ML, $ = ML.$, S = ML.S;
  let recording = false, mr = null, chunks = [], stream = null, blob = null, stoppedP = null, recog = null;
  let timer = null, secs = 0, live = '', level = { ctx: null, raf: 0 }, wake = null;
  let vTags = new Set(), vLoc = null, saving = false, vMood = { mood: 50, label: '' };

  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const mimeType = () => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  };

  function reset() {
    recording = false; blob = null; chunks = []; live = ''; secs = 0; vLoc = null; vTags = new Set(); saving = false;
    $('#vtimer').textContent = '0:00'; $('#vstate').textContent = 'tap to record';
    $('#vorb').classList.remove('rec'); $('#vring').style.transform = 'scale(1)';
    $('#vmeter-wrap').classList.add('hidden'); $('#vlive').classList.add('hidden'); $('#vlive-txt').textContent = 'Listening…';
    $('#vreview').classList.add('hidden'); $('#vcloud').textContent = ''; $('#vss').textContent = ''; $('#vss').className = 'save-status';
    $('#vsave').disabled = false; $('#v-audio').removeAttribute('src'); picker = null; $('#v-mood-picker').innerHTML = '';
    $('#vloc-status').classList.remove('has'); $('#vloc-txt').textContent = 'No location'; $('#bvgetloc').textContent = 'Add';
  }

  function meter(s) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = new AC(), src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize); level.ctx = ctx; $('#vmeter-wrap').classList.remove('hidden');
      let quiet = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length), pct = Math.min(1, rms * 5);
        $('#vmeter').style.width = pct * 100 + '%'; $('#vmeter').style.background = pct < 0.08 ? 'var(--danger)' : 'var(--success)';
        $('#vring').style.transform = 'scale(' + (1 + pct * 0.35) + ')';
        quiet = pct < 0.04 ? quiet + 1 : 0;
        $('#vhint').textContent = quiet > 150 ? 'Too quiet — move the phone closer to your mouth' : '';
        level.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
  }
  function stopMeter() { cancelAnimationFrame(level.raf); try { level.ctx && level.ctx.close(); } catch (e) {} level.ctx = null; $('#vmeter-wrap').classList.add('hidden'); $('#vhint').textContent = ''; }

  async function start() {
    $('#vstate').textContent = 'starting…';
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { ML.toast('Microphone access denied'); $('#vstate').textContent = 'tap to record'; return; }
    chunks = []; live = ''; blob = null;
    const mt = mimeType();
    try { mr = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream); }
    catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { stream.getTracks().forEach(t => t.stop()); ML.toast('Recording is not supported on this device'); $('#vstate').textContent = 'tap to record'; return; } }
    stoppedP = new Promise(res => {
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); blob = chunks.length ? new Blob(chunks, { type: mr.mimeType || mt || 'audio/mp4' }) : null; res(); };
    });
    mr.onerror = () => { ML.toast('Recording error — try again'); stop(); };
    try { mr.start(1000); } catch (e) { stream.getTracks().forEach(t => t.stop()); ML.toast('Could not start recording'); return; }
    recording = true; $('#vorb').classList.add('rec'); $('#vstate').textContent = 'recording — tap to stop'; $('#vlive').classList.remove('hidden');
    secs = 0; clearInterval(timer); timer = setInterval(() => { secs++; $('#vtimer').textContent = fmt(secs); }, 1000);
    $('#vring').style.transform = 'scale(1.12)';
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; }).catch(() => {}); } catch (e) {}
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recog = new SR(); recog.continuous = true; recog.interimResults = true; recog.lang = 'en-US';
      let full = '';
      recog.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) full += t + ' '; else interim += t; }
        live = (full + interim).trim(); const el = $('#vlive-txt'); el.textContent = (full + interim) || 'Listening…';
      };
      recog.onerror = () => {}; recog.onend = () => { if (recording) try { recog.start(); } catch (e) {} };
      try { recog.start(); } catch (e) {}
    } else $('#vlive-txt').textContent = 'Live transcription is not available on this device — you can type the text after recording.';
  }

  async function stop() {
    if (!recording) return; recording = false; clearInterval(timer); stopMeter();
    try { wake && wake.release(); } catch (e) {} wake = null;
    const r0 = recog; if (r0) { try { r0.stop(); } catch (e) {} }
    if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch (e) {} }
    $('#vorb').classList.remove('rec'); $('#vring').style.transform = 'scale(1)'; $('#vstate').textContent = 'processing…';
    try { await stoppedP; } catch (e) {}
    await new Promise(r => setTimeout(r, 450)); recog = null; // let the last recognised words arrive
    $('#vlive').classList.add('hidden'); $('#vstate').textContent = 'recorded';
    $('#vreview').classList.remove('hidden'); $('#v-text').value = live;
    if (blob) $('#v-audio').src = URL.createObjectURL(blob);
    ML.tagPicker($('#v-tags'), vTags);
    picker = ML.moodChip($('#v-mood-picker'), vMood);
    if (canCloud()) improve(true);
  }

  const canCloud = () => S.settings.cloudProvider !== 'off' && S.settings.cloudKey && navigator.onLine && blob;
  async function cloudTranscribe(b) {
    const p = S.settings.cloudProvider;
    const cfg = p === 'groq' ? { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' } : { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' };
    const ty = b.type || ''; const ext = ty.includes('mp4') ? 'm4a' : ty.includes('ogg') ? 'ogg' : 'webm';
    const fd = new FormData(); fd.append('file', b, 'recording.' + ext); fd.append('model', cfg.model); fd.append('language', 'en'); fd.append('response_format', 'json'); fd.append('temperature', '0');
    const r = await fetch(cfg.url, { method: 'POST', headers: { Authorization: 'Bearer ' + S.settings.cloudKey }, body: fd });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return ((await r.json()).text || '').trim();
  }
  async function improve(auto) {
    if (!blob) return;
    if (!S.settings.cloudKey || S.settings.cloudProvider === 'off') { ML.toast('Add a cloud API key in Settings → Voice first'); return; }
    if (!navigator.onLine) { ML.toast('You are offline'); return; }
    const el = $('#vcloud'); el.innerHTML = '<span class="spinner"></span>Improving transcript with the cloud model…';
    try {
      const t = await cloudTranscribe(blob);
      if (t) { $('#v-text').value = t; el.textContent = '✓ Improved with cloud model — check it over, then save'; } else el.textContent = 'Cloud model returned nothing — kept the original';
    } catch (e) { el.textContent = 'Cloud transcription failed (' + e.message + ') — kept the original'; }
  }

  let picker = null;
  async function save() {
    if (saving) return; saving = true;
    const id = ML.uid(), m = picker ? picker.get() : vMood, b = blob, tags = [...vTags], loc = vLoc, tr = $('#v-text').value.trim(), ts = Date.now();
    ML.haptic('bump'); ML.toast('Voice entry saved'); ML.ss('smain'); reset(); // leave right away; the recording is stored just behind it
    try {
      let audioId = null;
      if (b) { audioId = 'audio:' + id; await ML.blob.put(audioId, b); }
      ML.data.addEntry({ id, ts, updatedAt: ts, type: 'voice', mood: m.mood, moodLabel: m.label, text: '', transcript: tr, tags, loc, photoId: null, audioId, imageUrl: null, driveUrl: null, synced: false });
      ML.refreshHome();
    } finally { saving = false; }
  }

  ML.initVoice = () => {
    $('#bvoiceentry').onclick = () => ML.askMood(m => { reset(); vMood = m; ML.ss('svoice'); });
    $('#bvoiceback').onclick = async () => {
      if (recording) { if (!(await ML.confirm('Discard recording?', 'You are still recording.', 'Discard', true))) return; recording = false; try { mr.stop(); } catch (e) {} clearInterval(timer); stopMeter(); if (recog) { try { recog.stop(); } catch (e) {} recog = null; } try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} }
      reset(); ML.ss('smain');
    };
    $('#vorb').onclick = () => { if (recording) stop(); else if ($('#vreview').classList.contains('hidden')) start(); };
    $('#vsave').onclick = save;
    $('#vdiscard').onclick = async () => { if (await ML.confirm('Discard this recording?', 'It will not be saved.', 'Discard', true)) { reset(); ML.ss('smain'); } };
    $('#vimprove').onclick = () => improve(false);
    $('#bvgetloc').onclick = () => {
      $('#vloc-txt').textContent = 'Locating…';
      if (!navigator.geolocation) { $('#vloc-txt').textContent = 'Not supported'; return; }
      navigator.geolocation.getCurrentPosition(p => {
        vLoc = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        $('#vloc-status').classList.add('has'); $('#vloc-txt').textContent = vLoc.lat.toFixed(4) + ', ' + vLoc.lon.toFixed(4); $('#bvgetloc').textContent = 'Update';
      }, err => { $('#vloc-txt').textContent = 'No location'; ML.toast('Location: ' + err.message); }, { timeout: 10000 });
    };
  };
})();
