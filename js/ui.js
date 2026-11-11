/* Moodlog — screens, bottom sheets, confirm dialog, tag picker */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc;

  let cur = 'slock';
  ML.ss = id => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id); if (el) { el.classList.add('active'); cur = id; }
    const sc = el && el.querySelector('.scroll'); if (sc && id !== 'smain') sc.scrollTop = 0;
  };
  ML.currentScreen = () => cur;

  // generic bottom sheet. content: html string. mount(el, close) wires it up.
  let closeFn = null;
  ML.sheet = (title, html, mount) => {
    const wrap = $('#sheet-wrap'); if (closeFn) closeFn();
    wrap.innerHTML = '<div class="sheet" role="dialog"><div class="sheet-handle"></div>' + (title ? '<div class="sheet-title">' + esc(title) + '</div>' : '') + '<div class="sheet-content">' + html + '</div></div>';
    wrap.classList.add('open');
    const close = () => { wrap.classList.remove('open'); wrap.innerHTML = ''; closeFn = null; };
    closeFn = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    if (mount) mount($('.sheet-content', wrap), close);
    return close;
  };
  ML.closeSheet = () => { if (closeFn) closeFn(); };

  ML.confirm = (title, msg, okLabel, danger) => new Promise(res => {
    ML.sheet(title, '<p class="hint" style="font-size:14px">' + esc(msg) + '</p><button class="' + (danger ? 'btn-danger' : 'btn-primary') + '" id="c-ok">' + esc(okLabel || 'OK') + '</button><button class="btn-secondary" id="c-no">Cancel</button>', (el, close) => {
      $('#c-ok', el).onclick = () => { close(); res(true); };
      $('#c-no', el).onclick = () => { close(); res(false); };
    });
  });

  // ── tags: chip picker + "new tag" sheet ──
  ML.newTagSheet = cb => {
    ML.sheet('New tag', '<div class="hint">Tags are activities or themes you can search and see trends for — e.g. Exercise, Work, Friends.</div><div class="row"><input class="input" id="nt-emoji" placeholder="😀" maxlength="4" style="width:70px;text-align:center"><input class="input grow" id="nt-name" placeholder="Tag name" maxlength="24" autocapitalize="sentences"></div><button class="btn-primary" id="nt-save">Add tag</button>', (el, close) => {
      setTimeout(() => $('#nt-name', el).focus(), 200);
      const go = () => {
        const t = ML.data.addTag($('#nt-name', el).value, $('#nt-emoji', el).value);
        if (!t) { ML.toast('Enter a tag name'); return; }
        close(); cb && cb(t);
      };
      $('#nt-save', el).onclick = go;
      $('#nt-name', el).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  };

  ML.tagPicker = (container, selected, onChange) => {
    const render = () => {
      container.innerHTML = '';
      ML.S.tags.forEach(t => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (selected.has(t.id) ? ' on' : '');
        b.textContent = (t.emoji ? t.emoji + ' ' : '') + t.name;
        b.onclick = () => { selected.has(t.id) ? selected.delete(t.id) : selected.add(t.id); ML.haptic('tick'); render(); onChange && onChange(selected); };
        container.appendChild(b);
      });
      const add = document.createElement('button'); add.type = 'button'; add.className = 'chip add'; add.textContent = '＋ New tag';
      add.onclick = () => ML.newTagSheet(t => { selected.add(t.id); render(); onChange && onChange(selected); });
      container.appendChild(add);
    };
    render();
    return render;
  };
})();
