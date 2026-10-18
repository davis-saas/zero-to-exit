/* Zero to Exit — FX: confetti, number pops, synthesized sound, haptics, tweens.
 * Classic script, ZTE namespace. Safe to load in Node (does nothing without a DOM). */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});

  var hasDOM = typeof document !== 'undefined' && typeof window !== 'undefined';
  var MUTE_KEY = 'zte-muted-v1';

  function storeGet(key) {
    try { return root.localStorage ? root.localStorage.getItem(key) : null; } catch (e) { return null; }
  }
  function storeSet(key, val) {
    try { if (root.localStorage) root.localStorage.setItem(key, val); } catch (e) { /* private mode */ }
  }

  var reduced = false;
  if (hasDOM && window.matchMedia) {
    try {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduced = !!mq.matches;
      var onMq = function (e) { reduced = !!e.matches; FX.reduced = reduced; };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    } catch (e) { /* ignore */ }
  }

  var raf = hasDOM && window.requestAnimationFrame
    ? function (cb) { return window.requestAnimationFrame(cb); }
    : function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); };
  var now = function () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  };

  /* ------------------------------------------------------------------ */
  /* Confetti (pooled particles on one full-screen canvas)               */
  /* ------------------------------------------------------------------ */
  var COLORS = ['#8b5cf6', '#22c55e', '#facc15', '#ff6b6b', '#38bdf8', '#fb923c', '#f472b6'];
  var POOL_SIZE = 260;
  var pool = [];
  var canvas = null, ctx2d = null, dpr = 1, running = false, lastT = 0;

  for (var p = 0; p < POOL_SIZE; p++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, w: 6, h: 10, color: '#fff', life: 0, max: 1, shape: 0 });
  }

  function ensureCanvas() {
    if (!hasDOM) return false;
    if (canvas && canvas.isConnected !== false) return true;
    canvas = document.getElementById('fx-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
    }
    ctx2d = canvas.getContext ? canvas.getContext('2d') : null;
    resize();
    window.addEventListener('resize', resize);
    return !!ctx2d;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function spawn(x, y, opts) {
    for (var i = 0; i < pool.length; i++) {
      var q = pool[i];
      if (q.alive) continue;
      var ang = (opts.angle != null ? opts.angle : -Math.PI / 2) + (Math.random() - 0.5) * (opts.spread || Math.PI * 1.2);
      var spd = (opts.power || 9) * (0.45 + Math.random() * 0.75);
      q.alive = true;
      q.x = x; q.y = y;
      q.vx = Math.cos(ang) * spd;
      q.vy = Math.sin(ang) * spd;
      q.rot = Math.random() * Math.PI * 2;
      q.vr = (Math.random() - 0.5) * 0.4;
      q.w = 5 + Math.random() * 5;
      q.h = 8 + Math.random() * 7;
      q.color = (opts.colors || COLORS)[Math.floor(Math.random() * (opts.colors || COLORS).length)];
      q.life = 0;
      q.max = 70 + Math.random() * 50;
      q.shape = Math.random() < 0.3 ? 1 : 0;
      return true;
    }
    return false;
  }

  function loop(t) {
    if (!running) return;
    var dt = lastT ? Math.min(3, (t - lastT) / 16.67) : 1;
    lastT = t;
    var alive = 0;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < pool.length; i++) {
      var q = pool[i];
      if (!q.alive) continue;
      q.life += dt;
      if (q.life >= q.max || q.y > window.innerHeight + 40) { q.alive = false; continue; }
      alive++;
      q.vy += 0.28 * dt;
      q.vx *= Math.pow(0.985, dt);
      q.vy *= Math.pow(0.985, dt);
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      var fade = q.life > q.max - 20 ? Math.max(0, (q.max - q.life) / 20) : 1;
      ctx2d.globalAlpha = fade;
      ctx2d.fillStyle = q.color;
      ctx2d.save();
      ctx2d.translate(q.x, q.y);
      ctx2d.rotate(q.rot);
      if (q.shape === 1) {
        ctx2d.beginPath();
        ctx2d.arc(0, 0, q.w / 2, 0, Math.PI * 2);
        ctx2d.fill();
      } else {
        ctx2d.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.life * 0.15)) + 1);
      }
      ctx2d.restore();
    }
    ctx2d.globalAlpha = 1;
    if (alive > 0) raf(loop);
    else { running = false; lastT = 0; ctx2d.clearRect(0, 0, canvas.width, canvas.height); }
  }

  /** Burst confetti at screen position (x,y). opts: {count, power, spread, angle, colors} */
  function confetti(x, y, opts) {
    opts = opts || {};
    if (reduced || !ensureCanvas()) return;
    if (x == null) x = window.innerWidth / 2;
    if (y == null) y = window.innerHeight / 3;
    var n = Math.min(opts.count || 40, POOL_SIZE);
    for (var i = 0; i < n; i++) { if (!spawn(x, y, opts)) break; }
    if (!running) { running = true; lastT = 0; raf(loop); }
  }

  /** Big celebration: bursts from both bottom corners plus the middle. */
  function celebrate() {
    if (!hasDOM) return;
    var w = window.innerWidth, h = window.innerHeight;
    confetti(w * 0.15, h * 0.9, { count: 60, power: 17, angle: -Math.PI / 2 + 0.35, spread: 0.8 });
    confetti(w * 0.85, h * 0.9, { count: 60, power: 17, angle: -Math.PI / 2 - 0.35, spread: 0.8 });
    setTimeout(function () { confetti(w / 2, h * 0.35, { count: 60, power: 10, spread: Math.PI * 2 }); }, 250);
  }

  /* ------------------------------------------------------------------ */
  /* Floating number pops                                                */
  /* ------------------------------------------------------------------ */
  var popLayer = null, livePops = 0;
  function ensurePopLayer() {
    if (!hasDOM) return null;
    if (popLayer && popLayer.isConnected !== false) return popLayer;
    popLayer = document.getElementById('pop-layer');
    if (!popLayer) {
      popLayer = document.createElement('div');
      popLayer.id = 'pop-layer';
      popLayer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(popLayer);
    }
    return popLayer;
  }

  /** Floating text at screen coordinates. opts: {kind:'cash'|'lead'|'bad'|'info'|'energy', big:bool} */
  function pop(text, x, y, opts) {
    opts = opts || {};
    var layer = ensurePopLayer();
    if (!layer || livePops > 24) return;
    var el = document.createElement('div');
    el.className = 'fx-pop fx-pop-' + (opts.kind || 'info') + (opts.big ? ' fx-pop-big' : '');
    el.textContent = text;
    var jitter = (Math.random() - 0.5) * 36;
    el.style.left = Math.round((x == null ? window.innerWidth / 2 : x) + jitter) + 'px';
    el.style.top = Math.round(y == null ? window.innerHeight / 2 : y) + 'px';
    layer.appendChild(el);
    livePops++;
    var done = false;
    var cleanup = function () {
      if (done) return;
      done = true;
      livePops--;
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    if (el.animate && !reduced) {
      var rise = opts.big ? 90 : 64;
      var a = el.animate([
        { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -18px) scale(1.15)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%, -' + Math.round(rise * 0.6) + 'px) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translate(-50%, -' + rise + 'px) scale(0.9)', opacity: 0 }
      ], { duration: opts.big ? 1300 : 1000, easing: 'cubic-bezier(.2,.8,.3,1)' });
      a.onfinish = cleanup;
      setTimeout(cleanup, 2000);
    } else {
      el.style.transform = 'translate(-50%, -20px)';
      setTimeout(cleanup, 900);
    }
  }

  /** Pop centred on an element. */
  function popAt(el, text, opts) {
    if (!hasDOM || !el || !el.getBoundingClientRect) return pop(text, null, null, opts);
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return pop(text, null, null, opts);
    pop(text, r.left + r.width / 2, r.top + r.height * 0.3, opts);
  }

  /* ------------------------------------------------------------------ */
  /* WebAudio synth                                                      */
  /* ------------------------------------------------------------------ */
  var audio = null, master = null;
  var muted = storeGet(MUTE_KEY) === '1';

  var gestured = false;   // fallback for browsers without navigator.userActivation

  /** Must be called from a user gesture; creates / resumes the AudioContext lazily.
   * Resumes from any non-running state (Safari also uses 'interrupted' after calls/backgrounding). */
  function unlock() {
    if (!hasDOM) return;
    gestured = true;
    try {
      if (!audio) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = new AC();
        master = audio.createGain();
        master.gain.value = 0.55;
        master.connect(audio.destination);
      }
      if (audio.state !== 'running' && audio.state !== 'closed' && audio.resume) {
        var pr = audio.resume();
        if (pr && typeof pr.catch === 'function') pr.catch(function () { /* not a gesture yet; next tap retries */ });
      }
    } catch (e) { audio = null; }
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    var o = audio.createOscillator();
    var g = audio.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.03);
  }

  var lastSound = {};
  /** sound(name, n) — names: tap, pop, coin, levelup, error, good, bad, card, toggle, whoosh */
  function sound(name, n) {
    // tones scheduled on a suspended context would all fire at once on the next resume
    if (muted || !audio || !master || (audio.state && audio.state !== 'running')) return;
    try {
      var t = audio.currentTime + 0.005;
      var nowMs = now();
      // avoid stacking the same sound dozens of times in one frame
      if (lastSound[name] && nowMs - lastSound[name] < 40) return;
      lastSound[name] = nowMs;
      switch (name) {
        case 'tap': {
          var step = Math.min(n || 0, 12);
          tone(520 + step * 38, t, 0.07, 'square', 0.06);
          break;
        }
        case 'pop':
          tone(700, t, 0.09, 'sine', 0.16, 1250);
          break;
        case 'coin':
          tone(988, t, 0.08, 'square', 0.09);
          tone(1319, t + 0.075, 0.28, 'square', 0.09);
          break;
        case 'levelup': {
          var notes = [523, 659, 784, 1047];
          for (var i = 0; i < notes.length; i++) tone(notes[i], t + i * 0.11, 0.18, 'triangle', 0.18);
          tone(523, t + 0.46, 0.6, 'triangle', 0.12);
          tone(659, t + 0.46, 0.6, 'triangle', 0.12);
          tone(784, t + 0.46, 0.6, 'triangle', 0.12);
          tone(1047, t + 0.46, 0.7, 'square', 0.05);
          break;
        }
        case 'error':
          tone(150, t, 0.18, 'sawtooth', 0.09, 110);
          tone(155, t + 0.09, 0.14, 'sawtooth', 0.07, 100);
          break;
        case 'good':
          tone(660, t, 0.1, 'triangle', 0.16);
          tone(880, t + 0.09, 0.22, 'triangle', 0.16);
          break;
        case 'bad':
          tone(392, t, 0.14, 'triangle', 0.14);
          tone(294, t + 0.12, 0.3, 'triangle', 0.14);
          break;
        case 'card':
          tone(330, t, 0.22, 'sine', 0.14, 760);
          tone(990, t + 0.2, 0.12, 'triangle', 0.08);
          break;
        case 'toggle':
          tone(880, t, 0.05, 'square', 0.05);
          break;
        case 'whoosh':
          tone(240, t, 0.25, 'sine', 0.1, 900);
          break;
        default:
          tone(600, t, 0.06, 'sine', 0.1);
      }
    } catch (e) { /* audio is optional */ }
  }

  function setMuted(m) {
    muted = !!m;
    storeSet(MUTE_KEY, muted ? '1' : '0');
  }
  function isMuted() { return muted; }

  /* ------------------------------------------------------------------ */
  /* Haptics                                                             */
  /* ------------------------------------------------------------------ */
  // Chrome blocks (and logs an error for) vibrate() before the first tap on the frame, which
  // happens when a reloaded game runs sales/cards on its own.
  function haptic(pattern) {
    try {
      if (!hasDOM || !navigator || typeof navigator.vibrate !== 'function') return;
      var ua = navigator.userActivation;
      if (ua ? !ua.hasBeenActive : !gestured) return;
      navigator.vibrate(pattern || 10);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Tweens                                                              */
  /* ------------------------------------------------------------------ */
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  /** tween({from,to,ms,onUpdate,onDone,ease}) -> cancel() */
  function tween(o) {
    var from = +o.from || 0, to = +o.to || 0, ms = o.ms == null ? 600 : o.ms;
    var ease = o.ease || easeOutCubic;
    var cancelled = false;
    if (reduced || ms <= 0 || from === to) {
      if (o.onUpdate) o.onUpdate(to);
      if (o.onDone) o.onDone();
      return function () {};
    }
    var t0 = now();
    function step() {
      if (cancelled) return;
      var k = Math.min(1, (now() - t0) / ms);
      if (o.onUpdate) o.onUpdate(from + (to - from) * ease(k));
      if (k < 1) raf(step);
      else if (o.onDone) o.onDone();
    }
    raf(step);
    return function () { cancelled = true; };
  }

  /** Count an element's number up/down to `to`, formatted with fmt(n). */
  function countUp(el, to, fmt, ms) {
    if (!el) return;
    fmt = fmt || function (n) { return String(Math.round(n)); };
    var from = typeof el._zteVal === 'number' ? el._zteVal : to;
    if (el._zteCancel) el._zteCancel();
    if (from === to && el._zteShown) return;
    el._zteShown = true;
    el._zteCancel = tween({
      from: from, to: to, ms: ms == null ? 650 : ms,
      onUpdate: function (v) { el._zteVal = v; el.textContent = fmt(v); },
      onDone: function () { el._zteVal = to; el.textContent = fmt(to); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* One-shot element animations (Web Animations, so DOM diffing can't   */
  /* strip them)                                                         */
  /* ------------------------------------------------------------------ */
  var KEYFRAMES = {
    wiggle: [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' },
      { transform: 'rotate(-4deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0deg)' }
    ],
    pop: [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
    // soft purple ring: "here it is" after a jump to a section
    flash: [
      { boxShadow: '0 0 0 0 rgba(139,92,246,0)' }, { boxShadow: '0 0 0 6px rgba(139,92,246,0.45)', offset: 0.5 },
      { boxShadow: '0 0 0 0 rgba(139,92,246,0)' }
    ],
    squash: [
      { transform: 'scale(1,1)' }, { transform: 'scale(1.08,0.9)' }, { transform: 'scale(0.96,1.05)' },
      { transform: 'scale(1,1)' }
    ],
    bounceIn: [
      { transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    shake: [
      { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }
    ]
  };
  var DURATIONS = { wiggle: 450, pop: 260, squash: 220, bounceIn: 420, shake: 320, flash: 1400 };

  function animate(el, name, ms) {
    if (!el || !el.animate || reduced || !KEYFRAMES[name]) return null;
    try {
      return el.animate(KEYFRAMES[name], { duration: ms || DURATIONS[name] || 300, easing: 'ease-out' });
    } catch (e) { return null; }
  }

  var FX = {
    confetti: confetti,
    celebrate: celebrate,
    pop: pop,
    popAt: popAt,
    unlock: unlock,
    sound: sound,
    setMuted: setMuted,
    isMuted: isMuted,
    haptic: haptic,
    tween: tween,
    countUp: countUp,
    animate: animate,
    reduced: reduced,
    isReduced: function () { return reduced; }
  };
  ZTE.FX = FX;
})(typeof globalThis !== 'undefined' ? globalThis : this);
