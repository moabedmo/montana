window.MontanaAmbient = (function () {
  /* Track: "Serene View" · Mixkit License (mixkit.co/free-stock-music) */
  var SRC = 'assets/spa-ambient.mp3';
  var VOL = 0.38;
  var FADE_MS = 1200;
  var CROSS_MS = 0.45;

  var muted = true;
  var ctx, gain, buffer, source;
  var sourceStart = 0;
  var sourceOffset = 0;
  var htmlA, htmlB, htmlActive, htmlTimer;
  var useWebAudio = true;
  var bound = false;

  function readMuted() {
    try { return localStorage.getItem('montana_ambient') !== 'on'; } catch (e) { return true; }
  }

  function isUnlocked() {
    try { return sessionStorage.getItem('montana_ambient_unlocked') === '1'; } catch (e) { return false; }
  }

  function setUnlocked() {
    try { sessionStorage.setItem('montana_ambient_unlocked', '1'); } catch (e) {}
  }

  function saveTime(t) {
    try { sessionStorage.setItem('montana_ambient_t', String(t)); } catch (e) {}
  }

  function readTime() {
    try { return parseFloat(sessionStorage.getItem('montana_ambient_t') || '0') || 0; } catch (e) { return 0; }
  }

  function resolveSrc() {
    var path = location.pathname.replace(/\\/g, '/');
    if (path.indexOf('/') === -1 || path.lastIndexOf('/') === 0) return SRC;
    return SRC;
  }

  function fadeGain(target, ms) {
    if (gain && ctx) {
      var t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(target, t + (ms || FADE_MS) / 1000);
      return;
    }
    if (htmlActive) {
      var steps = 18;
      var start = htmlActive.volume;
      var step = 0;
      clearInterval(htmlActive._fade);
      htmlActive._fade = setInterval(function () {
        step++;
        htmlActive.volume = start + (target - start) * (step / steps);
        if (step >= steps) {
          htmlActive.volume = target;
          clearInterval(htmlActive._fade);
        }
      }, Math.max(16, (ms || FADE_MS) / steps));
    }
  }

  function loadBuffer() {
    if (buffer) return Promise.resolve(true);
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { useWebAudio = false; return Promise.resolve(false); }
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    return fetch(resolveSrc())
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return ctx.decodeAudioData(ab); })
      .then(function (buf) { buffer = buf; return true; })
      .catch(function () { useWebAudio = false; return false; });
  }

  function stopWebAudio() {
    if (!source) return;
    try { source.stop(); } catch (e) {}
    source.disconnect();
    source = null;
  }

  function startWebAudio(offset) {
    if (!buffer || !ctx) return false;
    stopWebAudio();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    var startAt = offset % buffer.duration;
    sourceOffset = startAt;
    sourceStart = ctx.currentTime;
    source.start(0, startAt);
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tickSaveWebAudio() {
    clearInterval(htmlTimer);
    if (!source || !buffer || !ctx) return;
    htmlTimer = setInterval(function () {
      if (muted || !ctx || ctx.state !== 'running') return;
      var elapsed = (sourceOffset + (ctx.currentTime - sourceStart)) % buffer.duration;
      saveTime(elapsed);
    }, 800);
  }

  function ensureHtmlPair() {
    if (htmlA) return;
    htmlA = new Audio(resolveSrc());
    htmlB = new Audio(resolveSrc());
    htmlA.preload = 'auto';
    htmlB.preload = 'auto';
    htmlA.volume = 0;
    htmlB.volume = 0;
    wireHtmlCrossfade(htmlA, htmlB);
    wireHtmlCrossfade(htmlB, htmlA);
    htmlActive = htmlA;
  }

  function wireHtmlCrossfade(el, partner) {
    el.addEventListener('timeupdate', function () {
      if (muted || el !== htmlActive || el._swap) return;
      var d = el.duration;
      if (!d || isNaN(d)) return;
      if (el.currentTime < d - CROSS_MS) return;
      el._swap = true;
      partner.currentTime = 0;
      partner.volume = 0;
      partner.play().then(function () {
        htmlActive = partner;
        var steps = 14;
        var step = 0;
        var a0 = el.volume;
        clearInterval(el._xf);
        el._xf = setInterval(function () {
          step++;
          var p = step / steps;
          partner.volume = VOL * p;
          el.volume = a0 * (1 - p);
          if (step >= steps) {
            el.pause();
            el.volume = 0;
            el._swap = false;
            partner.volume = VOL;
            clearInterval(el._xf);
          }
        }, (CROSS_MS * 1000) / steps);
      }).catch(function () { el._swap = false; });
    });
    el.addEventListener('timeupdate', function () {
      if (el === htmlActive && !muted) saveTime(el.currentTime);
    });
  }

  function startHtml(offset) {
    ensureHtmlPair();
    htmlActive = htmlA;
    htmlA.currentTime = offset || 0;
    htmlB.pause();
    htmlB.volume = 0;
    return htmlA.play().then(function () {
      htmlA.volume = VOL;
      return true;
    });
  }

  function stopHtml() {
    clearInterval(htmlTimer);
    if (htmlA) { htmlA.pause(); htmlA.volume = 0; }
    if (htmlB) { htmlB.pause(); htmlB.volume = 0; }
  }

  function play(resume) {
    var offset = resume ? readTime() : readTime();
    return loadBuffer().then(function (ok) {
      if (ok && useWebAudio) {
        startWebAudio(offset);
        fadeGain(VOL, resume ? 400 : FADE_MS);
        tickSaveWebAudio();
        return true;
      }
      return startHtml(offset);
    }).catch(function () {
      return startHtml(offset);
    });
  }

  function pause() {
    saveTime(readTime());
    fadeGain(0, 700);
    setTimeout(function () {
      if (!muted) return;
      stopWebAudio();
      stopHtml();
    }, 720);
  }

  function currentTime() {
    if (source && buffer && ctx) return (sourceOffset + (ctx.currentTime - sourceStart)) % buffer.duration;
    if (htmlActive) return htmlActive.currentTime || 0;
    return readTime();
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('montana_ambient', muted ? 'off' : 'on'); } catch (e) {}
    if (muted) {
      saveTime(currentTime());
      pause();
    }
    updateBtn();
  }

  function label() {
    var ar = document.documentElement.lang === 'ar';
    if (muted) return ar ? 'تشغيل الموسيقى' : 'Play music';
    return ar ? 'إيقاف الموسيقى' : 'Mute music';
  }

  function showHint(failed) {
    var el = document.getElementById('nav-toast') || document.getElementById('toast');
    if (!el) return;
    var ar = document.documentElement.lang === 'ar';
    el.textContent = failed
      ? (ar ? 'المتصفح منع الصوت — جرّبي تاني' : 'Browser blocked audio — try again')
      : (ar ? 'الموسيقى شغّالة ♪' : 'Music on ♪');
    el.classList.add('show');
    clearTimeout(el._amb);
    el._amb = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function updateBtn() {
    var btn = document.getElementById('ambient-btn');
    if (!btn) return;
    btn.classList.toggle('on', !muted);
    btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
    btn.title = label();
    btn.setAttribute('aria-label', label());
  }

  function tryResume() {
    if (muted || !isUnlocked()) return;
    play(true).catch(function () {});
  }

  function bind() {
    if (bound) {
      updateBtn();
      tryResume();
      return;
    }
    bound = true;
    muted = readMuted();

    var btn = document.getElementById('ambient-btn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (!muted) {
          setMuted(true);
          return;
        }
        setUnlocked();
        setMuted(false);
        play(false).then(function (ok) {
          if (ok) showHint(false);
          else {
            setMuted(true);
            showHint(true);
          }
        });
      });
    }

    window.addEventListener('beforeunload', function () {
      if (!muted) saveTime(currentTime());
    });

    window.addEventListener('pageshow', function (e) {
      if (e.persisted) tryResume();
    });

    updateBtn();
    if (!muted && isUnlocked()) {
      play(true).then(function (ok) {
        if (!ok) setMuted(true);
      });
    }
  }

  function onLangChange() {
    updateBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  return { bind: bind, setMuted: setMuted, onLangChange: onLangChange };
})();
