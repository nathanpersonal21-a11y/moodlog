/* Moodlog — themes, custom background, custom app icon */
(function () {
  const ML = window.ML, S = ML.S;
  const T = (label, bg, bg2, bg3, accent, text, light) => ({ label, bg, bg2, bg3, accent, text, light: !!light });
  ML.THEMES = {
    midnight: T('Midnight', '#0d0d0f', '#16161a', '#1e1e24', '#c8a96e', '#e8e4dc'),
    amoled: T('Black', '#000000', '#0c0c0c', '#171717', '#e8c887', '#f0ece4'),
    forest: T('Forest', '#0c1411', '#121d18', '#192923', '#7fcf9b', '#e3efe7'),
    ocean: T('Ocean', '#0a1220', '#0f1b30', '#15263f', '#6ab7ff', '#e2ecf8'),
    lavender: T('Lavender', '#14111f', '#1c1830', '#251f40', '#b39dff', '#ebe6fa'),
    rose: T('Rose', '#170d12', '#20121a', '#2a1822', '#f08fb0', '#f6e6ec'),
    sunset: T('Sunset', '#1a0f0c', '#25150f', '#311d14', '#ff9a5c', '#f8e9df'),
    daylight: T('Daylight', '#f6f3ee', '#ffffff', '#ece6db', '#9a6b1f', '#26221c', true)
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };

  ML.applyTheme = function () {
    const id = ML.THEMES[S.settings.theme] ? S.settings.theme : 'midnight', t = ML.THEMES[id];
    const r = document.documentElement, st = r.style, hasBg = !!S.settings.hasBg;
    const a = rgb(t.accent);
    st.setProperty('--gold', t.accent);
    st.setProperty('--gold-dim', mix(t.accent, t.bg, 0.45));
    st.setProperty('--on-gold', t.light ? '#ffffff' : t.bg);
    st.setProperty('--text', t.text);
    st.setProperty('--text2', mix(t.text, t.bg, 0.38));
    st.setProperty('--text3', mix(t.text, t.bg, 0.62));
    st.setProperty('--border', 'rgba(' + a.join(',') + ',.2)');
    st.setProperty('--border2', 'rgba(' + a.join(',') + ',.1)');
    st.setProperty('--bg', t.bg);
    const tr = rgb(t.bg2), t3 = rgb(t.bg3);
    st.setProperty('--bg2', hasBg ? 'rgba(' + tr.join(',') + ',.78)' : t.bg2);
    st.setProperty('--bg3', hasBg ? 'rgba(' + t3.join(',') + ',.85)' : t.bg3);
    st.setProperty('--bgblur', (S.settings.bgBlur || 0) + 'px');
    r.style.colorScheme = t.light ? 'light' : 'dark';
    r.classList.toggle('has-bg', hasBg);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', t.bg);
    const dim = document.getElementById('bg-dim');
    if (dim) dim.style.background = 'rgba(' + rgb(t.bg).join(',') + ',' + ((S.settings.bgDim || 0) / 100) + ')';
    document.body.style.background = hasBg ? 'transparent' : t.bg;
    if (ML.dial && ML.dial.redraw) ML.dial.redraw();
  };

  ML.applyBackground = async function () {
    const layer = document.getElementById('bg-layer'); if (!layer) return;
    if (S.settings.hasBg) {
      const u = await ML.blob.url('bg');
      if (u) { layer.style.backgroundImage = 'url("' + u + '")'; } else { S.settings.hasBg = false; ML.save('settings'); }
    } else layer.style.backgroundImage = '';
    ML.applyTheme();
  };

  ML.setBackground = async function (file) {
    const b = await ML.imageToBlob(file, 1600, 0.82);
    ML.blob.invalidate('bg'); await ML.blob.put('bg', b);
    S.settings.hasBg = true; ML.save('settings'); await ML.applyBackground();
  };
  ML.clearBackground = async function () { await ML.blob.del('bg'); S.settings.hasBg = false; ML.save('settings'); await ML.applyBackground(); };

  // The home-screen icon of an installed iPhone app is fixed when you add it to the Home Screen,
  // so a custom icon updates the in-app logo + tab icon now and the home-screen icon the next time you re-add the app.
  ML.applyIcon = async function () {
    const logo = document.getElementById('home-logo-img'), apple = document.getElementById('apple-icon'), fav = document.getElementById('fav-icon');
    if (S.settings.hasIcon) {
      const u = await ML.blob.url('icon');
      if (u) { if (logo) { logo.src = u; logo.style.display = ''; } if (apple) apple.href = u; if (fav) fav.href = u; return; }
      S.settings.hasIcon = false; ML.save('settings');
    }
    if (logo) logo.style.display = 'none';
    if (apple) apple.href = 'icons/icon-180.png'; if (fav) fav.href = 'icons/icon-192.png';
  };
  ML.setIcon = async function (file) {
    const b = await ML.squareIcon(file, 512);
    ML.blob.invalidate('icon'); await ML.blob.put('icon', b);
    S.settings.hasIcon = true; ML.save('settings'); await ML.applyIcon();
  };
  ML.clearIcon = async function () { await ML.blob.del('icon'); S.settings.hasIcon = false; ML.save('settings'); await ML.applyIcon(); };
})();
