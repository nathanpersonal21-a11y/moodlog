/* Moodlog — Swiftie Trivia: 5-question rounds about Taylor Swift's albums, songs and eras (titles and facts only).
   Earns XP, plays the celebration sounds, and can be switched off in Settings. */
(function () {
  const ML = window.ML, $ = ML.$, esc = ML.esc, S = ML.S;
  const ALBUMS = [['Taylor Swift', 2006], ['Fearless', 2008], ['Speak Now', 2010], ['Red', 2012], ['1989', 2014], ['reputation', 2017], ['Lover', 2019], ['folklore', 2020], ['evermore', 2020], ['Midnights', 2022], ['The Tortured Poets Department', 2024]];
  const SONGS = {
    'Taylor Swift': ['Tim McGraw', 'Teardrops on My Guitar', 'Our Song', 'Picture to Burn', 'Should’ve Said No'],
    'Fearless': ['Love Story', 'You Belong with Me', 'Fifteen', 'White Horse', 'Hey Stephen'],
    'Speak Now': ['Mean', 'Mine', 'Back to December', 'Enchanted', 'Sparks Fly', 'Dear John', 'Long Live'],
    'Red': ['All Too Well', 'I Knew You Were Trouble', 'We Are Never Ever Getting Back Together', '22', 'Begin Again', 'State of Grace'],
    '1989': ['Shake It Off', 'Blank Space', 'Style', 'Bad Blood', 'Wildest Dreams', 'Out of the Woods', 'Welcome to New York', 'Clean'],
    'reputation': ['Look What You Made Me Do', 'Delicate', 'Getaway Car', 'Don’t Blame Me', 'End Game', 'New Year’s Day', 'Gorgeous'],
    'Lover': ['Cruel Summer', 'Lover', 'The Man', 'You Need to Calm Down', 'Paper Rings', 'Cornelia Street', 'Death by a Thousand Cuts'],
    'folklore': ['cardigan', 'exile', 'betty', 'august', 'the 1', 'my tears ricochet', 'mirrorball', 'seven'],
    'evermore': ['willow', 'champagne problems', 'gold rush', 'tolerate it', 'no body, no crime', 'marjorie', 'cowboy like me'],
    'Midnights': ['Anti-Hero', 'Lavender Haze', 'Karma', 'Bejeweled', 'Midnight Rain', 'Maroon', 'Snow on the Beach'],
    'The Tortured Poets Department': ['Fortnight', 'Down Bad', 'So Long, London', 'But Daddy I Love Him', 'The Smallest Man Who Ever Lived', 'The Alchemy']
  };
  const FACTS = [
    ['Which US state is Taylor Swift from?', 'Pennsylvania', ['Tennessee', 'New York', 'California']],
    ['Her 1989 album is named after…', 'Her birth year', ['The year she moved to Nashville', 'A favourite film', 'Her first tour']],
    ['Which number is famously her lucky number?', '13', ['7', '22', '5']],
    ['What was her debut single?', 'Tim McGraw', ['Love Story', 'Our Song', 'Picture to Burn']],
    ['Which of these is the name of one of her cats?', 'Olivia Benson', ['Mr. Whiskers', 'Luna Moon', 'Oliver Twist']],
    ['Which of her albums was the first to win Album of the Year at the Grammys?', 'Fearless', ['Red', 'Speak Now', 'reputation']],
    ['Where did the Eras Tour begin in March 2023?', 'Glendale, Arizona', ['Las Vegas, Nevada', 'Nashville, Tennessee', 'Chicago, Illinois']],
    ['Which two albums were surprise-released in 2020?', 'folklore and evermore', ['Lover and folklore', 'evermore and Midnights', 'Red and 1989']],
    ['Which song got a famous ten-minute version?', 'All Too Well', ['Love Story', 'Blank Space', 'Cruel Summer']],
    ['What kind of farm did she grow up on?', 'A Christmas tree farm', ['A horse ranch', 'A peach orchard', 'A dairy farm']],
    ['Which of these is NOT a Taylor Swift album?', 'Golden Hour', ['Lover', 'Midnights', 'Red']],
    ['Which re-recorded album came out first?', 'Fearless (Taylor’s Version)', ['Red (Taylor’s Version)', '1989 (Taylor’s Version)', 'Speak Now (Taylor’s Version)']]
  ];
  const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => sh(a).slice(0, n);
  const allSongs = () => Object.keys(SONGS).flatMap(a => SONGS[a].map(s => [s, a]));

  function makeQ() {
    const t = Math.random();
    if (t < 0.34) { const [s, a] = pick(allSongs(), 1)[0]; return { q: 'Which album is “' + s + '” on?', a, opts: sh([a].concat(pick(ALBUMS.map(x => x[0]).filter(x => x !== a), 3))) }; }
    if (t < 0.52) { const [a, y] = pick(ALBUMS, 1)[0]; const ys = [...new Set(ALBUMS.map(x => x[1]))].filter(v => v !== y); return { q: 'What year was “' + a + '” released?', a: String(y), opts: sh([String(y)].concat(pick(ys, 3).map(String))) }; }
    if (t < 0.68) { const a = pick(Object.keys(SONGS), 1)[0], s = pick(SONGS[a], 1)[0], others = pick(allSongs().filter(x => x[1] !== a), 3).map(x => x[0]); return { q: 'Which of these songs is on “' + a + '”?', a: s, opts: sh([s].concat(others)) }; }
    if (t < 0.76) { const four = pick(ALBUMS.filter((x, i, arr) => arr.findIndex(y => y[1] === x[1]) === i), 4), first = four.slice().sort((x, y) => x[1] - y[1])[0]; return { q: 'Which of these albums came out first?', a: first[0], opts: sh(four.map(x => x[0])) }; }
    const f = pick(FACTS, 1)[0]; return { q: f[0], a: f[1], opts: sh([f[1]].concat(f[2])) };
  }
  function round() { const qs = [], seen = new Set(); while (qs.length < 5) { const q = makeQ(); if (!seen.has(q.q)) { seen.add(q.q); qs.push(q); } } return qs; }

  ML.trivia = {
    open() {
      const qs = round(); let i = 0, score = 0, streak = 0;
      ML.sheet('🎤 Swiftie Trivia', '<div id="tv"></div>', (el, close) => {
        const box = $('#tv', el);
        const ask = () => {
          const q = qs[i];
          box.innerHTML = '<div class="tv-top"><span>Question ' + (i + 1) + '/5</span><span>' + (streak > 1 ? '🔥 ' + streak + ' in a row · ' : '') + score + ' correct</span></div><div class="tv-q">' + esc(q.q) + '</div>' + q.opts.map((o, k) => '<button class="tv-opt" data-k="' + k + '">' + esc(o) + '</button>').join('');
          box.querySelectorAll('.tv-opt').forEach(b => b.onclick = () => {
            if (box.classList.contains('lock')) return; box.classList.add('lock');
            const ok = q.opts[+b.dataset.k] === q.a;
            box.querySelectorAll('.tv-opt').forEach(x => { if (q.opts[+x.dataset.k] === q.a) x.classList.add('right'); });
            if (ok) { score++; streak++; b.classList.add('right'); ML.sound.play('good'); ML.haptic('bump'); ML.celebrate(b, false, true); } else { streak = 0; b.classList.add('wrong'); ML.sound.play('bad'); ML.haptic('tick'); }
            setTimeout(() => { box.classList.remove('lock'); i++; i < 5 ? ask() : end(); }, ok ? 1000 : 1500);
          });
        };
        const end = () => {
          const g = S.game.trivia; g.played++; g.correct += score; g.best = Math.max(g.best, score); if (score === 5) g.perfect++; ML.save('game');
          const pts = score * 4 + (score === 5 ? 15 : 0), a = ML.rewards.award(pts);
          const msg = score === 5 ? 'Perfect! You are a true Swiftie.' : score >= 3 ? 'Nice one — you know your eras.' : 'Good try! Play again to learn more.';
          box.innerHTML = '<div class="tv-end">' + (ML.fx('buddy') ? '<img class="rw-buddy lg" src="img/buddy-sq.jpg" alt="">' : '') + '<div class="rw-big">' + score + '/5</div><div class="rw-t">' + msg + '</div><div class="hint">+' + a.pts + ' XP' + (a.bonus ? ' ✨ lucky 2x' : '') + '</div></div><button class="btn-primary" id="tv-again">Play again</button><button class="btn-secondary" id="tv-done">Done</button>';
          ML.rewards.finish(a, { big: score >= 4, snd: score === 5 ? 'big' : 'good', confetti: score >= 4, title: '' });
          $('#tv-again', box).onclick = () => { close(); setTimeout(ML.trivia.open, 120); };
          $('#tv-done', box).onclick = close;
        };
        ask();
      });
    }
  };
})();
