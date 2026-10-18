/* Zero to Exit — UI: rendering, input, game loop, save/load.
 * Classic script, ZTE namespace. Talks to the simulation only through ZTE.Engine (SPEC §6)
 * and reads ZTE.Content defensively (SPEC §5). Boots on DOMContentLoaded. */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  if (typeof document === 'undefined') { ZTE.UI = ZTE.UI || {}; return; }

  /* ================================================================== */
  /* Constants                                                           */
  /* ================================================================== */
  var SAVE_KEY = 'zte-save-v1';
  // SPEC-GAP: the save timestamp + UI-only bits (seen lessons) live in a separate key so the
  // engine-owned state stays untouched.
  var UI_KEY = 'zte-ui-v1';
  var DAY_MS = 6000;
  var COMBO_WINDOW = 1200;
  var MAX_OFFLINE_DAYS = 5;
  var SPEEDS = [0, 1, 2, 4, 8];
  var FAST_LEVEL = 4;          // 8x speed unlocks with the Company (SPEC-LATE §7)
  var COMPANY_LEVEL = 4;       // Company tab appears from Level 4
  var MODAL_TAP_GUARD = 600;   // ms after a modal opens during which a mashed tap can't pick anything
  var BUY_TAP_GUARD = 400;     // ms after a purchase during which a second tap can't buy again
  var ARM_MS = 3000;           // "tap again to confirm" window for risky Company buttons
  var IMPORTANT_OFFLINE = ['levelUp', 'graduated', 'gameOver', 'achievement', 'notebook', 'bet', 'exit'];
  // New Game+ meta progress (SPEC-LATE §7): { points, owned: [perkIds], claimed: [runKeys] }
  var WISDOM_KEY = 'zte-wisdom-v1';

  var LOG_EMOJI = {
    sale: '💰', lead: '🙋', reply: '💬', call: '📞', trial: '🎁', testimonial: '⭐', refund: '↩️',
    churn: '👋', levelUp: '🚀', card: '🃏', notebook: '📓', coach: '🦉', event: '⚡',
    achievement: '🏆', gameOver: '💀', burnout: '🥵', graduated: '🎓', info: '💡',
    fire: '🔥', bet: '🎲', exit: '🏔️'
  };

  var DIALS = [
    { key: 'dream', name: 'Dream result', tip: 'How big is the win?', color: '#8b5cf6' },
    { key: 'likelihood', name: 'Odds it works', tip: 'How sure do they feel?', color: '#22c55e' },
    { key: 'speed', name: 'Speed', tip: 'How fast do results show?', color: '#38bdf8' },
    { key: 'ease', name: 'Ease', tip: 'How little work for them?', color: '#fb923c' }
  ];

  var GUARANTEES = {
    none: { emoji: '🫥', name: 'No guarantee', desc: 'Buyers carry all the risk, so more of them hesitate.' },
    conditional: { emoji: '🛡️', name: 'Do-the-work guarantee', desc: 'Do the key steps and still miss? You keep helping them, free, until they get there.' },
    unconditional: { emoji: '🏰', name: 'Money-back guarantee', desc: 'Any reason, full refund. Closes more, refunds a few more.' }
  };

  var SKILLS = [
    { key: 'closing', emoji: '🤝', name: null },
    { key: 'hooks', emoji: '🪝', name: 'Hooks' },
    { key: 'pricing', emoji: '🏷️', name: 'Pricing' },
    { key: 'proof', emoji: '🧾', name: 'Proof' },
    { key: 'nurture', emoji: '🌱', name: 'Nurture' },
    { key: 'retention', emoji: '🔁', name: 'Retention' }
  ];

  var PLAN_KEYS = [
    { key: 'warm', emoji: '👋', fallback: 'Friends', cls: '', color: '#fb923c' },
    { key: 'cold', emoji: '📞', fallback: 'Cold Calls', cls: 'blue', color: '#38bdf8' },
    { key: 'content', emoji: '🎬', fallback: 'Content', cls: 'orange', color: '#f472b6' },
    { key: 'sales', emoji: '🤝', fallback: 'Sales calls', cls: 'green', color: '#22c55e' }
  ];

  var CH_FALLBACK = {
    warm: { name: 'Friends', emoji: '👋', verb: 'Message a friend', unlockLevel: 1 },
    cold: { name: 'Cold Calls', emoji: '📞', verb: 'Call a stranger', unlockLevel: 2 },
    content: { name: 'Content', emoji: '🎬', verb: 'Post something useful', unlockLevel: 3 },
    ads: { name: 'Ads', emoji: '📺', verb: 'Pay for attention', unlockLevel: 3 }
  };

  var COMBO_FALLBACK = {
    hook: { name: 'Hook Offer', emoji: '🪝', desc: 'A small, easy first buy that brings people in.' },
    upsell: { name: 'Upsell', emoji: '⬆️', desc: 'Offer the next thing right after they say yes.' },
    downsell: { name: 'Downsell', emoji: '⬇️', desc: 'A lighter option for people who said no.' },
    membership: { name: 'Membership', emoji: '🔁', desc: 'A monthly plan that keeps paying.' }
  };

  /* ================================================================== */
  /* UI state                                                            */
  /* ================================================================== */
  var S = {
    state: null,
    metrics: null,
    cache: {},
    tab: 'hustle',
    channel: 'warm',
    combo: 0,
    lastTap: 0,
    comboTimer: null,
    modal: null,
    queue: [],
    bubbleQueue: [],
    bubbleTimer: null,
    bubbleShowing: false,
    bubbleCur: null,
    pressAt: 0,          // last real finger/mouse press (trusted pointerdown, sliders excluded)
    modalShownAt: 0,
    lastBuyAt: 0,
    storageOk: true,
    acc: 0,
    lastFrame: 0,
    tickErrors: 0,
    chartRange: 60,
    hintIdx: 0,
    lastToastAt: {},
    errAt: {},
    ui: { savedAt: 0, seen: {}, best: {} },
    newLessons: false,
    gradShown: false,
    dragEl: null,
    needsRefresh: false,
    hiddenAt: 0,
    today: { day: -1, leads: 0, calls: 0, sales: 0 },
    enterTimer: null,
    summitShown: false,  // Summit finale already shown for this run (re-shown after a reload)
    armed: null,         // { key, at } a risky Company button waiting for its confirming second tap
    wisdom: null,        // in-memory copy of the New Game+ store (works when storage is blocked)
    els: {}
  };

  /* ================================================================== */
  /* Small helpers                                                       */
  /* ================================================================== */
  function FXo() { return ZTE.FX || null; }
  function fx(name) {
    var F = FXo();
    if (!F || typeof F[name] !== 'function') return;
    try { return F[name].apply(F, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* juice is optional */ }
  }
  function C() { return ZTE.Content || {}; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function obj(x) { return x && typeof x === 'object' ? x : {}; }
  function num(x, d) { x = +x; return isFinite(x) ? x : (d == null ? 0 : d); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function get(o, path, d) {
    var parts = String(path).split('.');
    var cur = o;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return d;
      cur = cur[parts[i]];
    }
    return cur === undefined ? d : cur;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function find(list, pred) {
    list = arr(list);
    for (var i = 0; i < list.length; i++) if (list[i] && pred(list[i])) return list[i];
    return null;
  }
  function has(list, v) { return arr(list).indexOf(v) >= 0; }

  function money(n) {
    n = num(n);
    var neg = n < 0, a = Math.abs(n), s;
    if (a >= 1e9) s = (a / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.?0+$/, '') + 'B';
    else if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    else if (a >= 1e5) s = Math.round(a / 1e3) + 'k';
    else if (a >= 1e4) s = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    else s = Math.round(a).toLocaleString('en-US');
    return (neg ? '-' : '') + '$' + s;
  }
  function moneyFull(n) {
    n = Math.round(num(n));
    return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
  }
  function int(n) { return Math.round(num(n)).toLocaleString('en-US'); }
  // SPEC-GAP: rates are assumed to be fractions (0.25 = 25%). Values above 1.5 are treated as
  // already-in-percent so a different engine convention still displays sensibly.
  function pct(x) {
    x = num(x);
    if (Math.abs(x) <= 1.5) x *= 100;
    var dp = Math.abs(x) < 10 ? 1 : 0;
    return x.toFixed(dp).replace(/\.0$/, '') + '%';
  }
  function plural(n, one, many) { return Math.round(n) === 1 ? one : (many || one + 's'); }

  function gl(key, fb) {
    var g = obj(C().glossary)[key];
    return typeof g === 'string' && g ? g : fb;
  }
  function levelDef(id) { return find(C().levels, function (l) { return l.id === id; }); }
  function flavorDef(id) { return find(C().flavors, function (f) { return f.id === id; }); }
  function chDef(id) {
    var c = obj(obj(C().channels)[id]);
    var fb = CH_FALLBACK[id] || {};
    return {
      name: c.name || fb.name || id, emoji: c.emoji || fb.emoji || '📣', verb: c.verb || fb.verb || 'Reach out',
      desc: c.desc || '', unlockLevel: num(c.unlockLevel, num(fb.unlockLevel, 1))
    };
  }
  function comboDef(id) {
    var c = obj(obj(C().combos)[id]);
    var fb = COMBO_FALLBACK[id] || {};
    return { name: c.name || fb.name || id, emoji: c.emoji || fb.emoji || '✨', desc: c.desc || fb.desc || '' };
  }
  function nbDef(id) { return find(C().notebook, function (n) { return n.id === id; }); }
  function achDef(id) { return find(C().achievements, function (a) { return a.id === id; }); }
  function upgDef(id) { return find(C().upgrades, function (u) { return u.id === id; }); }
  function cardDef(id) { return find(C().cards, function (c) { return c.id === id; }); }
  function tuning(keys, d) {
    var T = obj(ZTE.Engine && ZTE.Engine.TUNING);
    for (var i = 0; i < keys.length; i++) if (isFinite(+T[keys[i]]) && T[keys[i]] !== null) return +T[keys[i]];
    return d;
  }
  function overtimeEnergy() { return tuning(['overtimeEnergy', 'OVERTIME_ENERGY'], 30); }
  function rectOf(el) {
    if (!el || !el.getBoundingClientRect) return { x: window.innerWidth / 2, y: window.innerHeight / 2, ok: false };
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return { x: window.innerWidth / 2, y: window.innerHeight / 2, ok: false };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: true };
  }

  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- late game helpers (SPEC-LATE: APIs are written in parallel, so always guard) ---------- */
  function hasEng(name) { return !!(ZTE.Engine && typeof ZTE.Engine[name] === 'function'); }
  function lateX() { return obj(ZTE.Engine && ZTE.Engine.late); }   // engine-late extras (optional)
  function lvlNow() { return num(get(S.state, 'level'), 1); }
  function isSold() { return !!get(S.state, 'exit.sold'); }
  function roleList() {
    var list = arr(C().roles).filter(function (r) { return r && r.id; });
    if (!list.length) list = arr(ZTE.Engine && ZTE.Engine.DEFAULT_ROLES).filter(function (r) { return r && r.id; });
    return list;
  }
  function roleName(r) { return (r && r.nameByFlavor && r.nameByFlavor[get(S.state, 'flavor')]) || (r && r.name) || (r && r.id) || 'Hire'; }
  function pluralWord(w) { return /(s|sh|ch|x)$/i.test(w) ? w + 'es' : w + 's'; }   // same rule as the engine's plural()
  /** Flavor job title for a role id ('coach' → 'Campaign Pro' in an agency run); many=true gives the plural. */
  function roleNameOf(id, many) {
    var nm = roleName(find(roleList(), function (r) { return r.id === id; }) || { id: id });
    return many ? pluralWord(nm) : nm;
  }
  function deptList() {
    var list = arr(C().departments).filter(function (d) { return d && d.id; });
    if (list.length) return list;
    var L = lateX();
    if (typeof L.departments === 'function') { try { list = arr(L.departments(C())); } catch (e) { list = []; } }
    if (list.length) return list;
    return [['marketing', 'Marketing', '📣'], ['sales', 'Sales', '💼'], ['delivery', 'Delivery', '📦'], ['people', 'People', '🧑‍🤝‍🧑'], ['finance', 'Finance', '🧮'], ['tech', 'Tech', '💻']]
      .map(function (x) { return { id: x[0], name: x[1], emoji: x[2] }; });
  }
  function deptDef(id) { return find(deptList(), function (d) { return d.id === id; }) || { id: id, name: id, emoji: '🏢' }; }
  function lateList(key) {
    var list = arr(C()[key]).filter(function (x) { return x && x.id; });
    if (list.length) return list;
    var L = lateX();
    if (typeof L[key] === 'function') { try { return arr(L[key](C())).filter(function (x) { return x && x.id; }); } catch (e) { return []; } }
    return [];
  }
  function metricName(id) {
    var names = obj(lateX().METRIC_NAMES);
    return names[id] || { bookRate: 'Book rate', showRate: 'Show rate', closeRate: 'Close rate', churn: 'Churn', deliveryEfficiency: 'Delivery efficiency', cpl: 'Cost per lead', general: 'Whole company' }[id] || id || '—';
  }
  function lateTuning(key, d) { var LT = obj(lateX().LT); return isFinite(+LT[key]) && LT[key] !== null ? +LT[key] : d; }

  /* ---------- New Game+ Wisdom store (localStorage 'zte-wisdom-v1', every access in try/catch) ---------- */
  function wisdomGet() {
    if (S.wisdom) return S.wisdom;
    var w = { points: 0, owned: [], claimed: [] };
    try {
      var raw = lsGet(WISDOM_KEY);
      var p = raw ? JSON.parse(raw) : null;
      if (p && typeof p === 'object') {
        w.points = Math.max(0, Math.floor(num(p.points)));
        w.owned = arr(p.owned).filter(function (x) { return typeof x === 'string'; });
        w.claimed = arr(p.claimed).filter(function (x) { return typeof x === 'string'; }).slice(-30);
      }
    } catch (e) { /* corrupt store: start clean */ }
    S.wisdom = w;
    return w;
  }
  function wisdomSave() {
    try { lsSet(WISDOM_KEY, JSON.stringify(wisdomGet())); } catch (e) { /* storage blocked: in-memory only */ }
  }
  function perkList() { return arr(C().perks).filter(function (p) { return p && p.id; }); }
  function perkDef(id) { return find(perkList(), function (p) { return p.id === id; }); }
  function ownedPerks() { return wisdomGet().owned.filter(function (id) { return !!perkDef(id); }); }
  function perkCost(p) { return Math.max(0, Math.round(num(p && p.cost, 1))); }
  /** Adds the Wisdom from a sale once per run (the run is keyed by seed + sale day + price). */
  function claimWisdom() {
    var ex = obj(get(S.state, 'exit'));
    if (!ex.sold) return 0;
    var key = [get(S.state, 'seed', 0), ex.day != null ? ex.day : get(S.state, 'day', 0), Math.round(num(ex.valuation))].join(':');
    var w = wisdomGet();
    if (has(w.claimed, key)) return 0;
    var pts = Math.max(0, Math.round(num(ex.wisdom, 1)));
    w.points += pts;
    w.claimed.push(key);
    if (w.claimed.length > 30) w.claimed = w.claimed.slice(-30);
    wisdomSave();
    return pts;
  }

  /** Calls ZTE.Engine[name](...args) safely; shows a toast (throttled) on failure. */
  function eng(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    var E = ZTE.Engine;
    try {
      if (!E || typeof E[name] !== 'function') throw new Error('Engine.' + name + ' is missing');
      return E[name].apply(E, args);
    } catch (err) {
      if (root.console && console.error) console.error('[ZTE] Engine.' + name + ' failed:', err);
      var t = Date.now();
      if (!S.errAt[name] || t - S.errAt[name] > 8000) {
        S.errAt[name] = t;
        toast('Oops, something glitched (' + name + ').', 'error', '🛠️');
      }
      return null;
    }
  }

  /* ================================================================== */
  /* Coach Flex — original cartoon owl (inline SVG)                      */
  /* ================================================================== */
  function owlSVG(mood) {
    var brows = mood === 'happy'
      ? '<path d="M35 42 Q46 36 56 42" stroke="#3a2618" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M64 42 Q74 36 85 42" stroke="#3a2618" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<path d="M34 41 L56 46" stroke="#3a2618" stroke-width="3.8" stroke-linecap="round"/>' +
        '<path d="M64 44 L86 37" stroke="#3a2618" stroke-width="3.8" stroke-linecap="round"/>';
    var mouth = mood === 'wow'
      ? '<ellipse cx="60" cy="73" rx="4" ry="4.5" fill="#3a2618"/>'
      : '<path d="M63 71.5 q6 3.2 10.5 -2.2" stroke="#3a2618" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    var arm =
      '<path d="M31 76 Q17 79 12 66 L10.5 47" fill="none" stroke="#8a5530" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<ellipse cx="18.5" cy="70" rx="8.5" ry="6.5" fill="#b27a4a" transform="rotate(-25 18.5 70)"/>' +
      '<path d="M14 67.5 q4 -3 8 0" stroke="#d29a66" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<rect x="4.5" y="48" width="12" height="4.5" rx="2.2" fill="#ff5a5f"/>' +
      '<circle cx="10.5" cy="42" r="7.5" fill="#7a4a2a"/>' +
      '<path d="M7 39.5 h7 M7 43 h7" stroke="#5e3820" stroke-width="1.4" stroke-linecap="round"/>';
    return '' +
      '<svg class="owl-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(gl('coach', 'Coach Flex')) + '">' +
      '<g class="owl-bob">' +
      // ear tufts
      '<path d="M31 32 L23 8 L48 23 Z" fill="#7a4a2a"/>' +
      '<path d="M89 32 L97 8 L72 23 Z" fill="#7a4a2a"/>' +
      // body
      '<path d="M60 16 C89 16 101 37 101 63 C101 93 85 111 60 111 C35 111 19 93 19 63 C19 37 31 16 60 16 Z" fill="#a0673c"/>' +
      // belly
      '<ellipse cx="60" cy="88" rx="25" ry="20" fill="#f6dfb6"/>' +
      '<path d="M49 82 q4 4 8 0 M63 82 q4 4 8 0 M56 92 q4 4 8 0" stroke="#d9b98a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      // face mask
      '<path d="M60 35 C77 31 93 39 93 55 C93 69 80 76 60 74 C40 76 27 69 27 55 C27 39 43 31 60 35 Z" fill="#c98a55"/>' +
      // sweatband
      '<path d="M26 34 C44 24 76 24 94 34 L93 43 C76 35 44 35 27 43 Z" fill="#ff5a5f"/>' +
      '<path d="M27 38.6 C44 29.5 76 29.5 93 38.6" stroke="#fff" stroke-width="2.4" fill="none"/>' +
      '<path d="M93 35 L105 30 L101 40 Z" fill="#ff5a5f"/>' +
      '<path d="M94 38 L106 40 L98 45 Z" fill="#e94a50"/>' +
      // eyes
      '<circle cx="46" cy="56" r="13" fill="#fff" stroke="#3a2618" stroke-width="2"/>' +
      '<circle cx="74" cy="56" r="13" fill="#fff" stroke="#3a2618" stroke-width="2"/>' +
      '<circle cx="48.5" cy="57" r="6.6" fill="#2b2350"/><circle cx="50.8" cy="54.5" r="2.3" fill="#fff"/>' +
      '<circle cx="76.5" cy="57" r="6.6" fill="#2b2350"/><circle cx="78.8" cy="54.5" r="2.3" fill="#fff"/>' +
      '<ellipse class="owl-lid" cx="46" cy="56" rx="13.6" ry="13.6" fill="#c98a55"/>' +
      '<ellipse class="owl-lid" cx="74" cy="56" rx="13.6" ry="13.6" fill="#c98a55"/>' +
      brows +
      // beak + smirk
      '<path d="M55 64.5 L65 64.5 L60 73 Z" fill="#ffb02e" stroke="#e08a00" stroke-width="1.5" stroke-linejoin="round"/>' +
      mouth +
      // buff arms (flexing)
      '<g class="owl-arm-l">' + arm + '</g>' +
      '<g class="owl-arm-r"><g transform="translate(120 0) scale(-1 1)">' + arm + '</g></g>' +
      // feet
      '<path d="M47 108 l-4 7 M51 109 v7 M55 108 l4 7 M65 108 l-4 7 M69 109 v7 M73 108 l4 7" stroke="#ffb02e" stroke-width="3.6" stroke-linecap="round"/>' +
      '</g></svg>';
  }

  /* ================================================================== */
  /* Tiny DOM morph (keeps pressed buttons / dragged sliders alive)      */
  /* ================================================================== */
  function morph(fromEl, html) {
    var tpl = document.createElement('div');
    tpl.innerHTML = html;
    morphChildren(fromEl, tpl);
  }
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1) {
      if ((a.getAttribute('data-key') || '') !== (b.getAttribute('data-key') || '')) return false;
      if (a.nodeName === 'INPUT' && (a.getAttribute('type') || '') !== (b.getAttribute('type') || '')) return false;
    }
    return true;
  }
  function keyOf(n) { return n && n.nodeType === 1 ? (n.getAttribute('data-key') || '') : ''; }
  function patchNode(f, t) {
    if (f.nodeType === 3 || f.nodeType === 8) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; }
    else morphEl(f, t);
  }
  // Children are matched by position, except that nodes with a data-key keep their identity when
  // a keyed sibling appears or disappears before them: the survivors are patched in place instead
  // of being swapped for new nodes (a slider mid-drag or a button mid-tap stays the same element).
  function morphChildren(from, to) {
    var tc = Array.prototype.slice.call(to.childNodes);
    var want = {};
    for (var k = 0; k < tc.length; k++) { var k0 = keyOf(tc[k]); if (k0) want[k0] = true; }
    var cur = from.firstChild, gone, m;
    for (var i = 0; i < tc.length; i++) {
      var t = tc[i];
      while (cur && keyOf(cur) && !want[keyOf(cur)]) { gone = cur; cur = cur.nextSibling; from.removeChild(gone); }
      var f = cur;
      if (!f) { from.appendChild(t); continue; }
      if (sameNode(f, t)) { patchNode(f, t); cur = f.nextSibling; continue; }
      var tk = keyOf(t), fk = keyOf(f);
      if (fk && want[fk]) {
        // f is still wanted further down: find t's old node, or insert t as new, and keep f
        m = null;
        if (tk) { m = f.nextSibling; while (m && !(keyOf(m) === tk && sameNode(m, t))) m = m.nextSibling; }
        if (m && m === f.nextSibling) {           // only f moved down: park it at the end, it is matched later
          from.appendChild(f);
          patchNode(m, t); cur = m.nextSibling;
        } else if (m) {                           // t's node moved up: bring just that one node
          from.insertBefore(m, f);
          patchNode(m, t);
        } else from.insertBefore(t, f);
        continue;
      }
      from.replaceChild(t, f);
      cur = t.nextSibling;
    }
    while (cur) { gone = cur; cur = cur.nextSibling; from.removeChild(gone); }
  }
  function morphEl(f, t) {
    if (f.hasAttribute && f.hasAttribute('data-nomorph')) return;
    var i, a;
    var fa = Array.prototype.slice.call(f.attributes);
    for (i = 0; i < fa.length; i++) {
      if (!t.hasAttribute(fa[i].name)) f.removeAttribute(fa[i].name);
    }
    var ta = t.attributes;
    for (i = 0; i < ta.length; i++) {
      a = ta[i];
      if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
    }
    if (f.nodeName === 'INPUT') {
      if (f !== S.dragEl) {
        var v = t.getAttribute('value');
        if (v != null && f.value !== v) f.value = v;
      }
      return;
    }
    morphChildren(f, t);
  }

  /* ================================================================== */
  /* Toasts + coach bubble                                               */
  /* ================================================================== */
  // Toasts never take taps (pointer-events: none) so they can't swallow a button underneath.
  function toast(text, kind, emoji, ms) {
    if (!text || !S.els.toasts) return;
    var key = (kind || '') + '|' + text;
    var t = Date.now();
    if (S.lastToastAt[key] && t - S.lastToastAt[key] < 2500) return;
    S.lastToastAt[key] = t;
    var rootEl = S.els.toasts;
    while (rootEl.children.length >= 3) rootEl.removeChild(rootEl.firstChild);
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = (emoji ? '<span class="t-emoji">' + esc(emoji) + '</span>' : '') + '<span>' + esc(text) + '</span>';
    var remove = function () {
      if (el._gone) return;
      el._gone = true;
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    };
    rootEl.appendChild(el);
    setTimeout(remove, ms || (kind === 'achv' ? 3600 : 2700));
  }

  /* Coach bubble queue: entries are {text, day, hint}. Lines wait while a modal is open (so they
   * are never read behind the dim layer), stale engine lines are skipped, and display time
   * shrinks a little at 2x/4x so advice doesn't arrive days late. */
  function curDay() { return num(get(S.state, 'day'), 0); }
  function showBubble(text) {
    if (!text) return;
    if (S.bubbleQueue.length > 4) S.bubbleQueue.shift();
    S.bubbleQueue.push({ text: String(text), day: curDay() });
    if (!S.bubbleShowing) nextBubble();
    else bubbleFooter();
  }
  function bubbleFooter() {
    var more = S.els.bubble && S.els.bubble.querySelector('.more');
    if (more) more.textContent = S.bubbleQueue.length ? 'tap for more ›' : 'tap to close';
  }
  function hideBubble() {
    clearTimeout(S.bubbleTimer);
    S.bubbleShowing = false;
    S.bubbleCur = null;
    if (S.els.bubble) S.els.bubble.hidden = true;
    placeToasts();
  }
  // a modal opened: put the line being shown back at the front so it plays after the modal
  function holdBubble() {
    if (!S.bubbleShowing) return;
    if (S.bubbleCur) S.bubbleQueue.unshift(S.bubbleCur);
    hideBubble();
  }
  function nextBubble() {
    clearTimeout(S.bubbleTimer);
    var el = S.els.bubble;
    if (!el) return;
    if (S.modal || S.queue.length) { holdBubble(); return; }
    // drop engine lines that are more than 2 days old (always keep the newest one)
    var day = curDay();
    while (S.bubbleQueue.length > 1 && !S.bubbleQueue[0].hint && S.bubbleQueue[0].day < day - 2) S.bubbleQueue.shift();
    if (!S.bubbleQueue.length) { hideBubble(); return; }
    var item = S.bubbleQueue.shift();
    var text = item.text;
    S.bubbleCur = item;
    S.bubbleShowing = true;
    if (!S.owlMini) S.owlMini = owlSVG('');
    el.innerHTML = '<span class="b-owl">' + S.owlMini + '</span><span class="b-text"><span class="who">' + esc(gl('coach', 'Coach Flex')) + '</span>' + esc(text) +
      '<span class="more"></span></span>';
    bubbleFooter();
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    placeBubble();
    fx('animate', S.els.owl, 'wiggle');
    var sp = Math.max(1, num(get(S.state, 'speed'), 1));
    S.bubbleTimer = setTimeout(nextBubble, Math.max(2500, clamp(text.length * 75, 4200, 9500) / Math.sqrt(sp)));
  }
  // The bubble sits just under the top bar (over the goal strip, next to the owl), never over the
  // Reach out button. Toasts stack below it while it is up.
  function placeBubble() {
    var el = S.els.bubble, tb = document.getElementById('topbar');
    if (!el || !tb || !tb.getBoundingClientRect) return;
    var r = tb.getBoundingClientRect();
    var top = Math.max(8, Math.round(r.bottom + 4));
    if (r.height) el.style.top = top + 'px';
    placeToasts();
  }
  function placeToasts() {
    var t = S.els.toasts, el = S.els.bubble;
    if (!t) return;
    // offset* ignore the bubble's pop-in scale animation
    var top = el && !el.hidden ? parseFloat(el.style.top) : NaN;
    t.style.top = isFinite(top) && el.offsetHeight ? Math.round(top + el.offsetHeight + 8) + 'px' : '';
  }

  /* ================================================================== */
  /* Modals                                                              */
  /* ================================================================== */
  var UNIQUE_MODALS = { card: 1, gameOver: 1, graduated: 1, flavor: 1, away: 1, settings: 1, why: 1, summit: 1, perks: 1, sell: 1, crunch: 1 };
  var SOFT_MODALS = { why: 1, settings: 1, lesson: 1, sell: 1 };   // may be dropped when something urgent arrives

  function modalQueued(kind, test) {
    var all = (S.modal ? [S.modal] : []).concat(S.queue);
    for (var i = 0; i < all.length; i++) {
      if (all[i].kind === kind && (!test || test(all[i].data))) return true;
    }
    return false;
  }

  function openModal(kind, data, o) {
    o = o || {};
    if (UNIQUE_MODALS[kind] && modalQueued(kind)) return;
    var m = { kind: kind, data: data || {} };
    if (o.front) {
      S.queue.unshift(m);
      if (S.modal && SOFT_MODALS[S.modal.kind]) { S.modal = null; }
    } else {
      S.queue.push(m);
    }
    showNextModal();
  }

  function showNextModal() {
    if (S.modal || !S.queue.length) return;
    S.modal = S.queue.shift();
    S.modalShownAt = Date.now();
    holdBubble();
    renderModal(true);
    var k = S.modal.kind;
    if (k === 'card') scheduleGhost(S.modal);
    if (k === 'levelUp' || k === 'graduated' || k === 'summit' || (k === 'bet' && S.modal.data.won)) { fx('sound', 'levelup'); fx('celebrate'); fx('haptic', [20, 40, 20, 40, 30]); }
    else if (k === 'bet') { fx('sound', 'bad'); fx('haptic', [40, 40]); }
    else if (k === 'card') { fx('sound', 'card'); fx('haptic', 15); }
    else if (k === 'gameOver') { fx('sound', 'bad'); fx('haptic', [60, 50, 60]); }
    else if (k === 'coach') { fx('sound', 'pop'); }
  }

  function closeModal() {
    S.modal = null;
    var r = S.els.modal;
    if (r) { r.hidden = true; r.innerHTML = ''; }
    document.body.classList.remove('modal-open');
    showNextModal();
    if (!S.modal) {
      scheduleRefresh();
      if (S.bubbleQueue.length && !S.bubbleShowing) nextBubble();
    }
  }

  /** True when a tap on a just-opened modal is most likely a leftover from mashing the screen
   * behind it (a real press within 1.5 s before the modal and the tap within MODAL_TAP_GUARD). */
  function modalTapTooSoon() {
    if (!S.modal || !S.pressAt || !S.modalShownAt) return false;
    return Date.now() - S.modalShownAt < MODAL_TAP_GUARD && S.pressAt > S.modalShownAt - 1500;
  }

  function renderModal(first, toTop) {
    var r = S.els.modal;
    if (!r || !S.modal) return;
    var def = MODALS[S.modal.kind];
    if (!def) { S.modal = null; r.hidden = true; return; }
    var inner = '';
    try { inner = def.render(S.modal.data || {}); } catch (e) {
      if (root.console) console.error('[ZTE] modal render failed', e);
      inner = '<h2>Hmm…</h2><p class="lead-text">This screen hit a snag.</p><div class="actions"><button class="btn" data-action="close-modal">Close</button></div>';
    }
    var closable = typeof def.closable === 'function' ? def.closable(S.modal.data) : !!def.closable;
    // keep the reader's place when the same modal re-renders (quiz answers, coach lines)
    var oldBox = !first && r.firstChild && r.firstChild.classList && r.firstChild.classList.contains('modal') ? r.firstChild : null;
    var keepScroll = oldBox ? oldBox.scrollTop : 0;
    r.innerHTML = '<div class="modal ' + (def.cls || '') + (first ? '' : ' static') + '" role="dialog" aria-modal="true">' +
      (closable ? '<button class="modal-x" data-action="close-modal" aria-label="Close">✕</button>' : '') +
      inner + '</div>';
    r.hidden = false;
    document.body.classList.add('modal-open');
    var box = r.firstChild;
    if (box) box.scrollTop = first || toTop ? 0 : keepScroll;
  }

  function modalClosable() {
    if (!S.modal) return false;
    var def = MODALS[S.modal.kind];
    if (!def) return true;
    return typeof def.closable === 'function' ? def.closable(S.modal.data) : !!def.closable;
  }

  /* ------------------------------ modal builders ------------------------------ */
  var MODALS = {};

  MODALS.flavor = {
    // the New Game+ picker can be backed out of (the sold run is still there); the first start can't
    closable: function (d) { return !!(d && d.ngplus) && !!S.state; },
    render: function (d) {
      d = obj(d);
      var meta = obj(C().meta);
      var list = arr(C().flavors);
      var cards = list.map(function (f) {
        var st = obj(f.start);
        return '<button class="flavor-card" data-action="flavor" data-id="' + esc(f.id) + '">' +
          '<span class="f-emoji">' + esc(f.emoji || '🚀') + '</span>' +
          '<span><span class="f-name">' + esc(f.name || f.id) + '</span><br>' +
          '<span class="f-pitch">' + esc(f.pitch || '') + '</span>' +
          '<span class="f-chips">' +
          (st.cash != null ? '<span class="chip green">💵 ' + money(st.cash) + ' saved</span>' : '') +
          (st.networkSize != null ? '<span class="chip">👋 ' + int(st.networkSize) + ' contacts</span>' : '') +
          (f.suggestedPrice ? '<span class="chip yellow">🏷️ ~' + money(f.suggestedPrice) + ' offer</span>' : '') +
          '</span></span></button>';
      }).join('');
      if (!cards) {
        cards = '<button class="btn block" data-action="flavor" data-id="fitness">Start my business</button>';
      }
      var perks = ownedPerks();
      var perkLine = perks.length
        ? '<div class="perk-strip"><span class="small muted">🦉 ' + (d.ngplus ? 'New Game+ perks:' : 'Your Wisdom perks come along:') + '</span>' +
          perks.map(function (id) { var p = obj(perkDef(id)); return '<span class="chip yellow">' + esc((p.emoji || '✨') + ' ' + (p.name || id)) + '</span>'; }).join('') + '</div>'
        : '';
      return '<div class="owl-big" style="width:120px;height:120px;margin:0 auto">' + owlSVG('happy') + '</div>' +
        (d.ngplus ? '<div class="eyebrow">New Game+</div>' : '') +
        '<h2>' + esc(d.ngplus ? 'Round two. Smarter this time.' : (meta.title || 'Zero to Exit')) + '</h2>' +
        '<p class="lead-text">' + esc(d.ngplus ? 'Same climb, but you know the way now. Pick your next business.' : (meta.tagline || 'Start broke. Build a business. Learn how growth really works.')) + '</p>' +
        perkLine +
        '<div class="modal-section"><h4>Pick your business</h4><div class="actions" style="margin-top:6px">' + cards + '</div></div>' +
        (S.storageOk ? '' : '<p class="small muted center" style="margin-top:10px">💾 ' + esc(NO_SAVE_TEXT) + '</p>');
    }
  };

  MODALS.coach = {
    cls: 'coach-modal',
    closable: false,
    render: function (d) {
      var lines = arr(d.lines);
      var i = clamp(num(d.i), 0, Math.max(0, lines.length - 1));
      var dots = lines.length > 1 ? '<div class="dots">' + lines.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' : '';
      return '<div data-action="coach-next" style="cursor:pointer">' +
        '<div class="owl-big">' + owlSVG(d.mood || (i === 0 ? 'happy' : '')) + '</div>' +
        '<div class="speech"><span class="who">' + esc(gl('coach', 'Coach Flex')) + '</span>' + esc(lines[i] || '') + '</div>' +
        dots +
        '<div class="tap-hint">' + (i < lines.length - 1 ? 'Tap to continue ›' : 'Tap to get to work 💪') + '</div></div>';
    }
  };

  MODALS.card = {
    cls: 'card-modal',
    closable: false,
    render: function (d) {
      var card = obj(d.card);
      var opts = arr(card.options);
      if (d.phase !== 'result') {
        var keys = ['A', 'B', 'C', 'D'];
        return '<div class="big-emoji">' + esc(card.emoji || '🃏') + '</div>' +
          '<div class="eyebrow">Decision time · Day ' + int(get(S.state, 'day', 1)) + '</div>' +
          '<h2>' + esc(card.title || 'A choice') + '</h2>' +
          '<p class="lead-text">' + esc(card.text || '') + '</p>' +
          '<div class="actions">' + opts.map(function (o, k) {
            var color = ['', 'blue', 'orange', 'green'][k % 4];
            return '<button class="btn option-btn ' + color + '" data-action="card-option" data-id="' + esc(o.id) + '"' + (d.busy ? ' disabled' : '') + '>' +
              '<span class="o-key">' + keys[k] + '</span><span>' + esc(o.label || o.id) + '</span></button>';
          }).join('') + '</div>' +
          '<p class="tap-hint center">⏸ Time is paused. Take your pick.</p>';
      }
      var chosen = find(opts, function (o) { return o.id === d.optionId; }) || {};
      var q = chosen.quality || 'ok';
      var qText = q === 'best' ? 'Great call! 🎯' : q === 'trap' ? 'Ouch, that was a trap 🪤' : 'Not bad 👍';
      return '<div class="big-emoji">' + esc(card.emoji || '🃏') + '</div>' +
        '<div class="quality ' + esc(q) + '">' + qText + '</div>' +
        '<p class="you-chose">You chose: <b>' + esc(chosen.label || '') + '</b></p>' +
        (chosen.outcome ? '<p class="lead-text">' + esc(chosen.outcome) + '</p>' : '') +
        (chosen.lesson ? '<div class="lesson-box"><span class="mini-owl">' + owlSVG(q === 'trap' ? 'wow' : 'happy') + '</span><p>💡 ' + esc(chosen.lesson) + '</p></div>' : '') +
        ghostChart(d.ghost, d.optionId, opts, num(card.ghostDays, 60)) +
        '<div class="actions"><button class="btn green block" data-action="card-done">Got it!</button></div>';
    }
  };

  MODALS.levelUp = {
    closable: false,
    render: function (d) {
      var lvl = num(d.level, get(S.state, 'level', 1));
      var def = obj(levelDef(lvl));
      var prev = obj(levelDef(lvl - 1));
      var unlocks = unlockNotes(lvl);
      return '<div class="big-emoji">' + esc(def.emoji || '🚀') + '</div>' +
        '<div class="eyebrow">Level up!</div>' +
        '<h2>Level ' + lvl + ': ' + esc(def.name || '') + '</h2>' +
        (prev.outro ? '<p class="lead-text">' + esc(prev.outro) + '</p>' : '') +
        '<div class="stat-grid">' +
        '<div><span>Your role</span><b style="font-size:18px">' + esc(def.role || '—') + '</b></div>' +
        '<div><span>Next boss</span><b style="font-size:15px">' + esc(def.constraint || '—') + '</b></div>' +
        '</div>' +
        (def.bottomLine ? '<p class="lead-text"><b>Focus:</b> ' + esc(def.bottomLine) + '</p>' : '') +
        (unlocks.length ? '<ul class="unlock-list">' + unlocks.map(function (u) { return '<li>🔓 ' + esc(u) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="actions"><button class="btn green block" data-action="close-modal">Let\'s go! 🚀</button></div>';
    }
  };

  // Fallback only: the engine graduates a run when the next level isn't playable (content missing).
  // The real ending is the Summit sale (MODALS.summit).
  MODALS.graduated = {
    closable: false,
    render: function () {
      var st = S.state || {};
      var lessons = arr(st.notebook).length;
      var total = arr(C().notebook).length || 53;
      return '<div class="big-emoji">🎓</div>' +
        '<div class="eyebrow">Level ' + int(Math.max(1, num(st.level, 1) - 1)) + ' beaten!</div>' +
        '<h2>Your business is a real machine now</h2>' +
        '<p class="lead-text">That was every level this build can load. Keep growing in sandbox mode.</p>' +
        '<div class="stat-grid">' +
        '<div><b>' + int(graduationScore()) + '</b><span>Score</span></div>' +
        '<div><b>' + int(st.day) + '</b><span>Days played</span></div>' +
        '<div><b>' + money(st.cash) + '</b><span>Cash in the bank</span></div>' +
        '<div><b>' + lessons + ' / ' + total + '</b><span>Lessons unlocked</span></div>' +
        '</div>' +
        '<div class="actions"><button class="btn block" data-action="close-modal">Keep playing</button></div>';
    }
  };

  /* ---------- Summit finale (after sellCompany) ---------- */
  MODALS.summit = {
    cls: 'summit-modal',
    closable: false,
    render: function (d) {
      var st = S.state || {};
      var ex = obj(st.exit);
      var val = num(ex.valuation, num(d.valuation));
      var factors = arr(d.factors);
      if (!factors.length) {
        var v = valuationNow();
        factors = arr(v && v.factors);
      }
      var lessons = arr(st.notebook).length;
      var total = arr(C().notebook).length || 53;
      var rows = factors.filter(function (f) { return f && f.label; }).map(function (f) {
        var isMoney = f.label === 'Annual profit';
        var isMult = f.label === 'Multiple';
        var v = isMoney ? money(f.value) : (isMult ? num(f.value).toFixed(1) + '×' : '+' + num(f.value).toFixed(2) + '×');
        return '<div class="factor-row' + (isMult ? ' total' : '') + '"><div><b>' + esc(f.label) + '</b><span>' + esc(f.note || '') + '</span></div><em>' + v + '</em></div>';
      }).join('');
      var w = wisdomGet();
      return '<div class="summit-art" aria-hidden="true"><span class="peak">🏔️</span><span class="flag">🚩</span></div>' +
        '<div class="eyebrow">' + esc(gl('summit', 'The Summit')) + ' · Day ' + int(num(ex.day, st.day)) + '</div>' +
        '<h2>Sold for ' + moneyFull(val) + '!</h2>' +
        '<p class="lead-text">From a broke idea to a company someone paid real money for. Breathe it in.</p>' +
        '<div class="stat-grid">' +
        '<div class="hl"><b>' + money(val) + '</b><span>Sale price</span></div>' +
        '<div><b>' + (num(ex.multiple) ? num(ex.multiple).toFixed(1) + '×' : '—') + '</b><span>Profit multiple</span></div>' +
        '<div><b>' + int(num(ex.score, d.score)) + '</b><span>Score</span></div>' +
        '<div><b>' + int(num(ex.day, st.day)) + '</b><span>Days to exit</span></div>' +
        '<div><b>' + lessons + ' / ' + total + '</b><span>Lessons</span></div>' +
        '<div><b>' + arr(st.achievements).length + '</b><span>Achievements</span></div>' +
        '</div>' +
        (rows ? '<div class="modal-section"><h4>💰 How buyers priced it</h4><div class="factor-list">' + rows + '</div></div>' : '') +
        '<div class="wisdom-earned"><span class="wz">🦉</span><div><b>+' + int(num(ex.wisdom, 1)) + ' Wisdom</b><span>You now have ' + int(w.points) + ' to spend on New Game+ perks.</span></div></div>' +
        '<div class="actions"><button class="btn green block" data-action="ngplus">🌟 New Game+</button>' +
        '<button class="btn white block" data-action="close-modal">Enjoy the view first</button></div>';
    }
  };

  /* ---------- New Game+ perk picker ---------- */
  MODALS.perks = {
    closable: true,
    render: function () {
      var w = wisdomGet();
      var list = perkList();
      var cards = list.map(function (p) {
        var own = has(w.owned, p.id), cost = perkCost(p), can = w.points >= cost;
        return '<div class="perk-card' + (own ? ' owned' : '') + '" data-key="perk-' + esc(p.id) + '">' +
          '<span class="pk-emoji">' + esc(p.emoji || '✨') + '</span>' +
          '<div class="pk-body"><b>' + esc(p.name || p.id) + '</b><span>' + esc(p.desc || '') + '</span>' +
          (p.teaches ? '<i>' + esc(p.teaches) + '</i>' : '') + '</div>' +
          (own ? '<span class="stamp">OWNED ✓</span>'
            : '<button class="btn small ' + (can ? 'yellow' : 'white') + '" data-action="perk-buy" data-id="' + esc(p.id) + '"' + (can ? '' : ' disabled') + '>🦉 ' + cost + '</button>') +
          '</div>';
      }).join('');
      return '<div class="big-emoji" style="font-size:56px">🦉</div>' +
        '<div class="eyebrow">New Game+</div>' +
        '<h2>Spend your Wisdom</h2>' +
        '<p class="lead-text small">Perks you unlock stay forever and kick in at the start of every new run.</p>' +
        '<div class="wisdom-pill">🦉 <b>' + int(w.points) + '</b> Wisdom to spend</div>' +
        (cards ? '<div class="perk-list">' + cards + '</div>' : '<p class="empty-note">No perks in this build yet.</p>') +
        '<div class="actions"><button class="btn green block" data-action="ngplus-start">Pick my next business →</button></div>';
    }
  };

  /* ---------- Sell at The Summit (confirm) ---------- */
  MODALS.sell = {
    closable: true,
    render: function () {
      var v = valuationNow() || {};
      var val = num(v.valuation, num(get(S.metrics, 'valuation')));
      var goal = lvlNow() >= 10 ? eng('getGoal', S.state, C()) : null;
      var met = goal && num(goal.progress) >= 0.9999;
      var wz = Math.min(lateTuning('wisdomMax', 10), 1 + Math.floor(val / lateTuning('wisdomPer', 10000000)));
      var canSell = val > 0 && hasEng('sellCompany');
      return '<div class="big-emoji">🏔️</div>' +
        '<div class="eyebrow">' + esc(gl('summit', 'The Summit')) + '</div>' +
        '<h2>Sell the company?</h2>' +
        '<p class="lead-text">A buyer offers <b>' + moneyFull(val) + '</b>: ' + money(v.annualProfit) + ' yearly profit × ' + num(v.multiple).toFixed(1) + '.</p>' +
        (met ? '<p class="lead-text small" style="color:var(--cash-dark);font-weight:700">✅ Level 10 goal reached. This is a great time to sell.</p>'
          : '<p class="lead-text small">The Level 10 goal isn\'t met yet, so a higher price may be out there. Selling now is allowed, just less impressive.</p>') +
        '<div class="wisdom-earned"><span class="wz">🦉</span><div><b>+' + wz + ' Wisdom</b><span>for New Game+ perks (1 + 1 per $10M of sale price)</span></div></div>' +
        '<p class="small muted center" style="margin-top:10px">Selling ends this run for good.</p>' +
        '<div class="actions">' +
        '<button class="btn green block" data-action="sell-confirm"' + (canSell ? '' : ' disabled') + '>' + (val > 0 ? '🤝 Sell for ' + money(val) : 'No profit, no buyer yet') + '</button>' +
        '<button class="btn white block" data-action="close-modal">Keep growing</button></div>';
    }
  };

  /* ---------- Big Bet result ---------- */
  MODALS.bet = {
    closable: false,
    render: function (d) {
      var b = obj(find(lateList('bets'), function (x) { return x.id === d.id; }));
      var won = !!d.won;
      var text = won ? (b.successText || d.text) : (b.failText || d.text);
      return '<div class="big-emoji">' + (won ? '🎉' : '😬') + '</div>' +
        '<div class="eyebrow">Big Bet result · ' + esc((b.emoji ? b.emoji + ' ' : '') + (b.name || d.id || 'Your bet')) + '</div>' +
        '<h2>' + (won ? 'It paid off!' : 'This one missed') + '</h2>' +
        (text ? '<p class="lead-text">' + esc(text) + '</p>' : '') +
        (d.chance != null ? '<p class="small muted center" style="margin-top:6px">Your odds were ' + pct(d.chance) + '. ' + (won ? 'Prep pays.' : 'Even good odds lose sometimes.') + '</p>' : '') +
        (b.teaches ? '<div class="lesson-box"><span class="mini-owl">' + owlSVG(won ? 'happy' : 'wow') + '</span><p>💡 ' + esc(b.teaches) + '</p></div>' : '') +
        '<div class="actions"><button class="btn ' + (won ? 'green' : '') + ' block" data-action="close-modal">' + (won ? 'Onward! 🚀' : 'Dust off, keep going') + '</button></div>';
    }
  };

  MODALS.gameOver = {
    closable: false,
    render: function () {
      var st = S.state || {};
      var go = obj(st.gameOver);
      var hist = arr(st.history);
      var items = [];
      for (var i = hist.length - 1; i >= 0; i--) {
        var h = obj(hist[i]);
        var card = obj(cardDef(h.cardId));
        var opt = find(card.options, function (o) { return o.id === h.optionId; }) || {};
        items.push('<button class="btn white block rewind-btn" data-action="rewind" data-idx="' + i + '">' +
          '<span>' + esc(card.emoji || '⏪') + ' ' + esc(card.title || h.cardId || 'Decision') +
          '<small>Day ' + int(h.day) + ' · you picked "' + esc(opt.label || h.optionId || '?') + '"</small></span><span>⏪</span></button>');
      }
      return '<div class="big-emoji">💼</div>' +
        '<h2>Back to the 9-to-5</h2>' +
        '<p class="lead-text">' + esc(go.reason || 'The cash ran dry for too long.') + '</p>' +
        '<p class="lead-text small">Every founder trips. Rewind to a past decision and try another path, or start fresh.</p>' +
        (items.length ? '<div class="modal-section"><h4>⏪ Rewind to a decision</h4><div class="rewind-list">' + items.join('') + '</div></div>' : '') +
        '<div class="actions"><button class="btn red block" data-action="restart">Start over</button></div>';
    }
  };

  // Level 4+ safety net: shown once each time cash drops below $0 while the business loses money
  // (S.crunchOpen resets when cash recovers). Steps: intro → plan (a dry run on a copy) → done.
  function crunchLeft() { var m = obj(S.metrics); return Math.max(0, num(m.graceDays, 14) - num(m.negCashDays)); }
  // Level 4+: below $0 the business runs on its credit line; the countdown only runs past the line
  function creditInfo() {
    var m = obj(S.metrics), cash = num(get(S.state, 'cash')), line = num(m.creditLine);
    return { neg: cash < 0, used: Math.max(0, -cash), line: line, past: line > 0 ? cash < -line : cash < 0,
      interest: Math.max(0, -cash) * tuning(['creditInterest'], 0.0005), left: crunchLeft() };
  }
  function creditLineTxt(ci) {
    return ci.past ? 'past your ' + money(ci.line) + ' credit line: ' + int(ci.left) + ' ' + plural(ci.left, 'day') + ' to get back inside it'
      : 'using ' + money(ci.used) + ' of your ' + money(ci.line) + ' credit line (about ' + money(ci.interest) + ' a day in interest)';
  }
  function cloneState(st) { try { return JSON.parse(JSON.stringify(st)); } catch (e) { return null; } }
  /** What cutToBreakEven did (or would do): `pre` is the state before, `post` after. */
  function crunchSummary(pre, post, res) {
    res = obj(res);
    if (!pre || !post || res.ok !== true) return { ok: false, reason: res.reason || 'Nothing to cut right now.' };
    var ma = obj(eng('computeMetrics', pre, C())), mb = obj(eng('computeMetrics', post, C()));
    var fired = obj(res.fired), people = 0, lines = [];
    ['setter', 'closer', 'manager', 'coach'].forEach(function (id) {
      var n = Math.floor(num(fired[id]));
      if (!n) return;
      people += n;
      var had = Math.floor(num(get(pre, 'team.' + id)));
      lines.push({ cls: 'bad', text: '👋 Let ' + (n >= had ? (n === 1 ? 'your only ' : 'all ' + n + ' ') : n + ' of ' + had + ' ') + roleNameOf(id, n !== 1) + ' go' });
    });
    return {
      ok: true, people: people, lines: lines, paused: arr(res.paused),
      before: num(res.before), after: num(res.after), sales: num(res.avgRevenue),
      moraleA: Math.round(num(ma.morale, num(get(pre, 'team.morale'), 80))), moraleB: Math.round(num(mb.morale, num(get(post, 'team.morale'), 80))),
      unmanaged: Math.floor(num(mb.unmanaged))
    };
  }
  function crunchPlanList(p) {
    var li = function (cls, t) { return '<li class="' + cls + '">' + esc(t) + '</li>'; };
    return '<ul class="crunch-plan">' +
      (p.paused.length ? li('', '⏸️ Pause ' + p.paused.join(' and ')) : '') +
      p.lines.map(function (x) { return li(x.cls, x.text); }).join('') +
      li('good', '💸 Daily costs ' + money(p.before) + ' → ' + money(p.after) + ' (sales ≈ ' + money(p.sales) + ' a day)') +
      (p.people ? li(p.moraleB < p.moraleA - 10 ? 'bad' : '', '😟 Team morale ' + p.moraleA + ' → ' + p.moraleB) : '') +
      (p.unmanaged > 0 ? li('bad', '⚠️ ' + int(p.unmanaged) + ' ' + plural(p.unmanaged, 'person', 'people') + ' left with no manager (they work at 60%)') : '') +
      '</ul>';
  }
  MODALS.crunch = {
    closable: true,
    render: function (d) {
      var st = S.state || {}, m = obj(S.metrics);
      var left = crunchLeft(), loss = num(m.burnDaily), neg = num(st.cash) < 0, ci = creditInfo();
      var head = '<div class="big-emoji">' + (d.step === 'done' ? '✂️' : '🚨') + '</div><div class="eyebrow">Cash crunch</div>';
      var mine = '<button class="btn white block" data-action="close-modal">I\'ll fix it myself</button>';
      if (d.step === 'plan' || d.step === 'done') {
        var p = obj(d.plan);
        if (!p.ok) return head + '<h2>Nothing to cut</h2><p class="lead-text">' + esc(p.reason || '') + '</p>' +
          '<div class="actions"><button class="btn block" data-action="close-modal">Got it</button></div>';
        if (d.step === 'done') return head + '<h2>Costs now fit inside sales</h2>' + crunchPlanList(p) +
          '<p class="small muted center" style="margin-top:8px">' + (neg ? 'You are ' + esc(creditLineTxt(ci)) + '. ' : '') + 'Rebuild slowly: hire again once the work is waiting and the money is coming in.</p>' +
          '<div class="actions"><button class="btn green block" data-action="close-modal">Got it</button></div>';
        var cutTxt = p.people ? '✂️ Yes, let ' + p.people + ' ' + plural(p.people, 'person', 'people') + ' go' : '⏸️ Yes, pause ' + p.paused.join(' and ');
        return head + '<h2>The break-even plan</h2>' +
          '<p class="lead-text">This is what the cut would do. Nothing has happened yet.</p>' + crunchPlanList(p) +
          '<div class="actions"><button class="btn red block" data-action="crunch-cut">' + esc(cutTxt) + '</button>' +
          '<button class="btn white block" data-action="crunch-back">Back</button></div>' +
          '<p class="small muted center" style="margin-top:8px">Newest kinds of staff go first: ' + esc(['setter', 'closer', 'manager', 'coach'].map(function (id) { return roleNameOf(id, true); }).join(', ')) + '.</p>';
      }
      var profitable = loss <= 0;
      return head +
        '<h2>' + (profitable ? 'A slow stretch dipped you below $0' : 'You\'re spending more than you make') + '</h2>' +
        '<p class="lead-text">Cash is <b>' + money(st.cash) + '</b>' +
        (profitable ? '. On average you still make about <b>' + money(-loss) + '</b> a day, so cash should climb back.' : (loss > 0 ? ' and you lose about <b>' + money(loss) + '</b> a day.' : '.')) +
        (neg ? ' You are ' + esc(creditLineTxt(ci)) + '.' : '') + '</p>' +
        (neg ? '<p class="small muted">Your ads keep running on the credit line. ' + (ci.past ? 'Past the line the bank starts counting: get back inside it in time or the run ends.' : 'The bank only starts counting days if you go past the line.') + '</p>' : '') +
        '<div class="actions">' +
        (profitable ? '<button class="btn green block" data-action="close-modal">Got it</button><button class="btn white block" data-action="crunch-cut">✂️ Show me a break-even plan</button>'
          : '<button class="btn red block" data-action="crunch-cut">✂️ Show me a break-even plan</button>' + mine) + '</div>' +
        '<p class="small muted center" style="margin-top:8px">The plan shows who would go and what it costs you before anything happens.</p>' +
        '<div class="lesson-box"><span class="mini-owl">' + owlSVG('wow') + '</span><p>💡 Cash is oxygen. Hire when the work is already waiting and the money is already coming in.</p></div>';
    }
  };

  MODALS.away = {
    closable: true,
    render: function (d) {
      var cd = num(d.cashDelta);
      return '<div class="big-emoji">🌙</div>' +
        '<h2>While you were away…</h2>' +
        '<p class="lead-text">Autopilot kept things running for <b>' + int(d.days) + ' ' + plural(d.days, 'day') + '</b>.</p>' +
        '<div class="stat-grid">' +
        '<div><b style="color:' + (cd >= 0 ? 'var(--cash-dark)' : 'var(--danger-dark)') + '">' + (cd >= 0 ? '+' : '') + money(cd) + '</b><span>Cash change</span></div>' +
        '<div><b>' + money(d.revenue) + '</b><span>Sales made</span></div>' +
        '<div><b>' + int(d.leads) + '</b><span>New leads</span></div>' +
        '<div><b>' + int(d.sales) + '</b><span>New customers</span></div>' +
        '</div>' +
        (d.lessons > 0 ? '<p class="lead-text">📓 ' + d.lessons + ' new ' + plural(d.lessons, 'lesson') + ' in your notebook!</p>' : '') +
        (d.stoppedForCard ? '<p class="lead-text">🃏 A decision is waiting for you.</p>' : '') +
        '<div class="actions"><button class="btn green block" data-action="close-modal">Nice! Back to it</button></div>';
    }
  };

  MODALS.why = {
    closable: true,
    render: function () {
      var m = obj(S.metrics);
      var why = obj(m.why);
      var sec = function (title, lines) {
        lines = arr(lines);
        return '<div class="modal-section"><h4>' + title + '</h4>' +
          (lines.length ? '<ul class="why-list">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>'
            : '<p class="empty-note">No numbers here yet. Play a day or two.</p>') + '</div>';
      };
      return '<div class="big-emoji" style="font-size:52px">🤔</div>' +
        '<h2>Why these numbers?</h2>' +
        '<p class="lead-text small">The real math behind your day.</p>' +
        sec('🙋 Leads', why.leads) + sec('🔻 Funnel', why.funnel) + sec('💵 Money', why.money) +
        (arr(why.company).length ? sec('🏢 Company', why.company) : '') +
        '<div class="actions"><button class="btn block" data-action="close-modal">Makes sense</button></div>';
    }
  };

  MODALS.settings = {
    closable: true,
    render: function (d) {
      var meta = obj(C().meta);
      var fl = obj(flavorDef(get(S.state, 'flavor')));
      var muted = !!fx('isMuted');
      return '<h2>⚙️ Settings</h2>' +
        '<div class="modal-section">' +
        '<div class="settings-row"><div><b>Sound</b><span>Blips, coins and fanfares</span></div>' +
        '<button class="toggle ' + (muted ? '' : 'on') + '" data-action="sound" aria-label="Toggle sound"></button></div>' +
        (S.state ? '<div class="settings-row"><div><b>Your business</b><span>' + esc((fl.emoji || '') + ' ' + (fl.name || get(S.state, 'flavor', ''))) + ' · Day ' + int(S.state.day) + '</span></div></div>' : '') +
        (S.storageOk
          ? '<div class="settings-row"><div><b>Reset save</b><span>Wipe progress and start over</span></div>' +
            (d.confirm
              ? '<button class="btn red small" data-action="reset">Yes, wipe it</button>'
              : '<button class="btn white small" data-action="reset-ask">Reset…</button>') +
            '</div>' +
            (d.confirm ? '<p class="small center" style="color:var(--danger-dark);margin-top:6px">This can\'t be undone. Tap again to confirm.</p>' : '')
          : '<div class="settings-row"><div><b>💾 Saving is off</b><span>This browser blocks storage, so progress resets when you close the page.</span></div></div>') +
        (wisdomGet().points > 0 || ownedPerks().length
          ? '<div class="settings-row"><div><b>🦉 Wisdom</b><span>' + int(wisdomGet().points) + ' to spend · ' + ownedPerks().length + ' New Game+ ' + plural(ownedPerks().length, 'perk') + ' (kept when you reset)</span></div></div>' : '') +
        '</div>' +
        '<p class="small muted center" style="margin-top:12px">' + esc(meta.title || 'Zero to Exit') + ' v' + esc(meta.version || '0.1.0') + '</p>' +
        '<div class="actions"><button class="btn block" data-action="close-modal">Done</button></div>';
    }
  };

  MODALS.lesson = {
    closable: true,
    render: function (d) {
      var n = obj(nbDef(d.id));
      var quiz = n.quiz && typeof n.quiz === 'object' ? n.quiz : null;
      var answered = !!obj(get(S.state, 'quizzes'))[d.id];
      var qhtml = '';
      if (quiz && arr(quiz.options).length) {
        var a = d.answer;
        qhtml = '<div class="quiz"><h4>Quick quiz ' + (answered ? '✅' : '') + '</h4><p class="q">' + esc(quiz.q || '') + '</p><div class="opts">' +
          arr(quiz.options).map(function (o, i) {
            var cls = 'white';
            if (a) {
              if (a.correct && i === a.idx) cls = 'green';
              else if (!a.correct && i === a.idx) cls = 'red';
            }
            return '<button class="btn ' + cls + ' block" data-action="quiz" data-idx="' + i + '"' + (a && a.correct ? ' disabled' : '') + '>' + esc(o) + '</button>';
          }).join('') + '</div>' +
          (a ? '<div class="explain ' + (a.correct ? 'ok' : 'no') + '">' + (a.correct ? '🎉 Correct! ' : '🙈 Not quite. ') + esc(a.explain || '') + '</div>' : '') +
          '</div>';
      }
      return '<div class="big-emoji" style="font-size:54px">' + esc(n.emoji || '📓') + '</div>' +
        '<div class="eyebrow">' + esc(n.term || gl('notebook', "Founder's Notebook")) + '</div>' +
        '<h2>' + esc(n.title || n.term || 'Lesson') + '</h2>' +
        '<p class="lesson-summary">' + esc(n.summary || '') + '</p>' +
        (n.formula ? '<div class="formula">' + esc(n.formula) + '</div>' : '') +
        (n.tip ? '<div class="tip-row"><span class="mini-owl">' + owlSVG('') + '</span><div class="tip">' + esc(n.tip) + '</div></div>' : '') +
        qhtml +
        '<div class="actions"><button class="btn block" data-action="close-modal">Close</button></div>';
    }
  };

  function unlockNotes(lvl) {
    var notes = [];
    ['warm', 'cold', 'content', 'ads'].forEach(function (id) {
      var c = chDef(id);
      if (c.unlockLevel === lvl) notes.push(c.emoji + ' ' + c.name + ' megaphone');
    });
    if (lvl === 2) {
      notes.push('🏷️ Set your own price');
      notes.push('⚒️ ' + gl('offerForge', 'Offer Forge') + ' upgrades + guarantees');
      notes.push('📜 ' + gl('closeKit', 'Close Kit') + ' and ' + gl('skillScrolls', 'Skill Scrolls'));
    } else if (lvl === 3) {
      notes.push('💸 ' + gl('cashCombos', 'Cash Combos'));
      notes.push('📊 LTV, CAC and 30-day cash numbers');
    } else if (lvl >= 4) {
      var roles = roleList().filter(function (r) { return num(r.unlockLevel, 4) === lvl; }).map(function (r) { return pluralWord(roleName(r)); });
      if (lvl === 4) {
        notes.push('🏢 New Company tab: hire ' + (roles.length ? roles.join(', ') : 'your first team'));
        notes.push('📘 Playbooks: write it down once, every hire follows it');
        notes.push('🫂 ' + gl('leadSquad', 'Lead Squad') + ': Fans + Staff bring leads for you');
        notes.push('⏩ 8× speed');
      } else if (lvl === 5) {
        if (roles.length) notes.push('📋 ' + roles.join(', ') + ' keep your team on track');
        notes.push('🎯 Niche focus: fewer leads, more money');
      } else if (lvl === 6) {
        notes.push('💎 Product Lab: build a premium product for your best customers');
        notes.push('🏢 ' + gl('leadSquad', 'Lead Squad') + ': Agencies + Partners');
      } else if (lvl === 7) {
        notes.push('⚙️ Efficiency score + improvement projects');
        notes.push('🎯 Fix the weakest number first for full effect');
      } else if (lvl === 8) {
        notes.push('🗂️ Six departments with health bars');
        notes.push('🔥 Fires + weekly CEO attention: handle what matters');
      } else if (lvl === 9) {
        notes.push('🔬 Specialist teams for every department');
      } else if (lvl === 10) {
        notes.push('🎲 One Big Bet per run');
        notes.push('💰 Company valuation');
        notes.push('🏔️ Sell at ' + gl('summit', 'The Summit'));
      }
    }
    return notes;
  }

  // SPEC-GAP: no engine score exists; this is a UI-only score for the graduation screen.
  function graduationScore() {
    var st = S.state || {};
    return Math.max(0, Math.round(
      num(get(st, 'stats.revenueTotal')) / 10 +
      arr(st.notebook).length * 150 +
      arr(st.achievements).length * 100 +
      Math.max(0, 160 - num(st.day)) * 25 +
      Math.max(0, num(st.cash)) / 20
    ));
  }

  /* ================================================================== */
  /* Charts (SVG)                                                        */
  /* ================================================================== */
  function shortMoney(v) {
    var a = Math.abs(v);
    var s = a >= 1e9 ? (a / 1e9).toFixed(1).replace(/\.0$/, '') + 'B' : a >= 1e6 ? (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(a));
    return (v < 0 ? '-$' : '$') + s;
  }

  function lineChart(points, opt) {
    opt = opt || {};
    var W = 320, H = opt.h || 130, padL = 44, padR = 10, padT = 12, padB = 20;
    var ys = points.map(function (p) { return num(p.y); });
    if (points.length < 2) return '<p class="empty-note">Play a few days to draw this chart. 📈</p>';
    var minY = Math.min(0, Math.min.apply(null, ys));
    var maxY = Math.max.apply(null, ys);
    if (maxY <= minY) maxY = minY + 1;
    var span = maxY - minY;
    maxY += span * 0.08;
    if (minY < 0) minY -= span * 0.05;
    var n = points.length;
    var X = function (i) { return padL + (i / (n - 1)) * (W - padL - padR); };
    var Y = function (v) { return padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB); };
    var d = '';
    for (var i = 0; i < n; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(ys[i]).toFixed(1);
    var base = Y(Math.max(minY, 0));
    var area = d + 'L' + X(n - 1).toFixed(1) + ' ' + base.toFixed(1) + 'L' + X(0).toFixed(1) + ' ' + base.toFixed(1) + 'Z';
    var grid = '', seenLabels = {};
    [minY, (minY + maxY) / 2, maxY].forEach(function (v) {
      var y = Y(v).toFixed(1), label = shortMoney(v);
      grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="#ece7f8" stroke-width="1"/>';
      // tiny ranges round to the same label ("$1, $1"); only print each label once
      if (seenLabels[label]) return;
      seenLabels[label] = true;
      grid += '<text x="' + (padL - 6) + '" y="' + (+y + 4) + '" text-anchor="end" font-size="10" fill="#8f89aa">' + label + '</text>';
    });
    if (minY < 0) {
      grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + base.toFixed(1) + '" y2="' + base.toFixed(1) + '" stroke="#ff6b6b" stroke-width="1.5" stroke-dasharray="4 3"/>';
    }
    var color = opt.color || '#22c55e';
    var lastX = X(n - 1), lastY = Y(ys[n - 1]);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label || 'chart') + '">' +
      grid +
      '<path d="' + area + '" fill="' + color + '" opacity="0.14"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="5" fill="#fff" stroke="' + color + '" stroke-width="3"/>' +
      '<text x="' + padL + '" y="' + (H - 4) + '" font-size="10" fill="#8f89aa">Day ' + int(points[0].x) + '</text>' +
      '<text x="' + (W - padR) + '" y="' + (H - 4) + '" font-size="10" fill="#8f89aa" text-anchor="end">Day ' + int(points[n - 1].x) + '</text>' +
      '</svg>';
  }

  function ghostChart(ghost, chosenId, options, days) {
    ghost = obj(ghost);
    var series = arr(options).map(function (o) {
      return { id: o.id, label: o.label || o.id, pts: arr(ghost[o.id]).map(function (p) { return num(obj(p).cash); }) };
    }).filter(function (s) { return s.pts.length >= 2; });
    if (!series.length) return '';
    var all = [];
    series.forEach(function (s) { all = all.concat(s.pts); });
    var minY = Math.min.apply(null, all), maxY = Math.max.apply(null, all);
    if (maxY <= minY) maxY = minY + 1;
    var span = maxY - minY;
    minY -= span * 0.06; maxY += span * 0.1;
    var W = 320, H = 160, padL = 44, padR = 12, padT = 12, padB = 20;
    var maxLen = Math.max.apply(null, series.map(function (s) { return s.pts.length; }));
    var X = function (i) { return padL + (i / Math.max(1, maxLen - 1)) * (W - padL - padR); };
    var Y = function (v) { return padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB); };
    var others = ['#ff6b6b', '#94a3b8', '#fb923c'];
    var oi = 0;
    var paths = '', top = '', legend = [];
    var chosen = null;
    series.forEach(function (s) {
      var d = '';
      for (var i = 0; i < s.pts.length; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(s.pts[i]).toFixed(1);
      var last = s.pts[s.pts.length - 1];
      var ex = X(s.pts.length - 1).toFixed(1), ey = Y(last).toFixed(1);
      if (s.id === chosenId) {
        chosen = s;
        top = '<path d="' + d + '" fill="none" stroke="#8b5cf6" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>' +
          '<circle cx="' + ex + '" cy="' + ey + '" r="5.5" fill="#fff" stroke="#8b5cf6" stroke-width="3"/>';
        legend.unshift('<div class="lg"><span class="sw"></span><span><b>Your path</b> · ' + esc(s.label) + '</span><span class="lv">' + money(last) + '</span></div>');
      } else {
        var c = others[oi++ % others.length];
        paths += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" opacity="0.9"/>' +
          '<circle cx="' + ex + '" cy="' + ey + '" r="3.5" fill="' + c + '"/>';
        legend.push('<div class="lg"><span class="sw dash" style="border-top-color:' + c + '"></span><span>Road not taken · ' + esc(s.label) + '</span><span class="lv">' + money(last) + '</span></div>');
      }
    });
    var grid = '';
    [minY, (minY + maxY) / 2, maxY].forEach(function (v) {
      var y = Y(v).toFixed(1);
      grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="#ece7f8"/>' +
        '<text x="' + (padL - 6) + '" y="' + (+y + 4) + '" text-anchor="end" font-size="10" fill="#8f89aa">' + shortMoney(v) + '</text>';
    });
    if (minY < 0 && maxY > 0) {
      grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#ff6b6b" stroke-width="1.2" stroke-dasharray="3 3"/>';
    }
    var verdict = '';
    if (chosen) {
      var mine = chosen.pts[chosen.pts.length - 1];
      var best = -Infinity;
      series.forEach(function (s) { if (s !== chosen) best = Math.max(best, s.pts[s.pts.length - 1]); });
      if (best !== -Infinity) {
        verdict = mine >= best
          ? '<p class="small center" style="margin-top:6px;font-weight:600;color:var(--cash-dark)">Your path ends on top. 💪</p>'
          : '<p class="small center" style="margin-top:6px;font-weight:600;color:var(--danger-dark)">The road not taken ends ' + money(best - mine) + ' richer. Noted! 📝</p>';
      }
    }
    return '<div class="ghost-wrap"><div class="ghost-title">👻 Ghost timeline: cash over ' + int(days || maxLen) + ' days</div>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ghost timeline">' + grid + paths + top +
      '<text x="' + padL + '" y="' + (H - 4) + '" font-size="10" fill="#8f89aa">Today</text>' +
      '<text x="' + (W - padR) + '" y="' + (H - 4) + '" font-size="10" fill="#8f89aa" text-anchor="end">+' + int(maxLen - 1) + ' days</text>' +
      '</svg><div class="ghost-legend">' + legend.join('') + '</div>' + verdict + '</div>';
  }

  function gauge(value, color) {
    var v = clamp(num(value), 0, 10);
    var p = (v / 10 * 100).toFixed(1);
    return '<svg viewBox="0 0 100 62" aria-hidden="true">' +
      '<path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="#ece7f8" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" pathLength="100" stroke-dasharray="' + p + ' 100"/>' +
      '<text x="50" y="52" text-anchor="middle" font-size="24" font-weight="700" fill="#2b2350" font-family="Fredoka, system-ui, sans-serif">' + Math.round(v) + '</text>' +
      '<text x="50" y="61" text-anchor="middle" font-size="7.5" fill="#8f89aa" font-family="Fredoka, system-ui, sans-serif">of 10</text>' +
      '</svg>';
  }

  /* ================================================================== */
  /* Upgrades helpers                                                    */
  /* ================================================================== */
  function upgradeList() {
    if (S.cache.upg) return S.cache.upg;
    var list = S.state ? eng('availableUpgrades', S.state, C()) : null;
    if (!Array.isArray(list)) {
      var owned = arr(get(S.state, 'upgrades'));
      list = arr(C().upgrades).map(function (u) {
        var lock = num(u.minLevel, 1) > num(get(S.state, 'level', 1));
        return { upgrade: u, owned: has(owned, u.id), locked: lock, affordable: num(get(S.state, 'cash')) >= num(get(u, 'cost.cash')), reason: lock ? 'Unlocks at Level ' + u.minLevel : '' };
      });
    }
    S.cache.upg = list.filter(function (x) { return x && x.upgrade && x.upgrade.id; });
    return S.cache.upg;
  }
  // Stable order (content order, locked ones last). Affordability and ownership show through
  // styling only, so a card never slides under the player's finger when cash ticks or after a buy.
  function upgradesFor(cats) {
    var lvl = num(get(S.state, 'level'), 1);
    var rank = function (x) { return !x.owned && num(x.upgrade.minLevel, 1) > lvl ? 1 : 0; };
    return upgradeList().filter(function (x) { return has(cats, x.upgrade.category); })
      .slice().sort(function (a, b) { return rank(a) - rank(b); });
  }
  function upgCard(x) {
    var u = x.upgrade, cost = obj(u.cost);
    var cc = num(cost.cash), ce = num(cost.energy);
    var cls = x.owned ? 'owned' : x.locked ? 'locked' : '';
    var chips = (cc ? '<span class="chip green">' + money(cc) + '</span>' : '') + (ce ? '<span class="chip yellow">⚡' + int(ce) + '</span>' : '');
    if (!chips) chips = '<span class="chip">Free</span>';
    var foot;
    if (x.owned) foot = '<span class="stamp">OWNED ✓</span>';
    else if (x.locked) foot = '<div class="lock-reason">🔒 ' + esc(x.reason || ('Unlocks at Level ' + num(u.minLevel, 2))) + '</div>';
    else foot = '<button class="btn small ' + (x.affordable ? 'green' : 'white') + '" data-action="buy" data-id="' + esc(u.id) + '"' + (x.affordable ? '' : ' disabled') + '>' +
      (x.affordable ? 'Get it!' : esc(x.reason || 'Need more cash')) + '</button>';
    return '<div class="upg ' + cls + '" data-key="u-' + esc(u.id) + '">' +
      '<div class="u-emoji">' + esc(u.emoji || '✨') + '</div>' +
      '<div class="u-name">' + esc(u.name || u.id) + '</div>' +
      '<div class="u-desc">' + esc(u.desc || '') + '</div>' +
      (u.teaches && !x.locked ? '<div class="u-why">💡 ' + esc(u.teaches) + '</div>' : '') +
      (x.owned ? '' : '<div class="u-cost">' + chips + '</div>') +
      foot + '</div>';
  }
  function upgSection(title, sub, cats, emptyText) {
    var list = upgradesFor(cats);
    var owned = list.filter(function (x) { return x.owned; }).length;
    return '<section class="card"><div class="card-title"><h3>' + title + '</h3><span class="sub">' + owned + ' / ' + list.length + ' collected</span></div>' +
      (sub ? '<p class="small muted" style="margin:-4px 0 10px">' + sub + '</p>' : '') +
      (list.length ? '<div class="upgrade-grid">' + list.map(upgCard).join('') + '</div>'
        : '<p class="empty-note">' + (emptyText || 'Nothing here yet.') + '</p>') + '</section>';
  }

  /* ================================================================== */
  /* Tabs                                                                */
  /* ================================================================== */
  var TABS = {};

  function comboCount() {
    if (Date.now() - S.lastTap > COMBO_WINDOW) return 0;
    return S.combo + 1;
  }

  function friendsLeft() { return Math.floor(num(get(S.state, 'network.available'))); }
  function friendsOutSub(coldOn) { return coldOn ? 'More free up tomorrow · switch to ' + esc(chDef('cold').name) : 'More free up tomorrow · ' + esc(chDef('cold').name) + ' unlock at Level ' + chDef('cold').unlockLevel; }
  // nobody to reach at all today: friends used up and Cold Calls still locked
  function friendsOutAll() { return friendsLeft() < 1 && !get(S.state, 'channels.cold.unlocked'); }
  function grindTarget() { return Math.max(1, tuning(['grindEnergy'], 60)); }

  /** Lead energy the engine will count for today's streak: what's done so far plus a projection
   * of tonight's Autopilot (same split as Engine.computeMetrics' "why" lines). */
  function grindProjected() {
    var st = S.state, m = obj(S.metrics);
    var done = num(get(st, '_today.leadEnergy'));
    var left = Math.max(0, num(get(st, 'energy.current')));
    if (left <= 0) return done;
    var ch = obj(st.channels), plan = obj(st.plan);
    var sh = { warm: 0, cold: 0, content: 0, sales: Math.max(0, num(plan.sales)) }, spill = 0;
    ['warm', 'cold', 'content'].forEach(function (k) {
      if (get(ch, k + '.unlocked')) sh[k] = Math.max(0, num(plan[k])); else spill += Math.max(0, num(plan[k]));
    });
    if (spill > 0) {
      var outs = ['warm', 'cold', 'content'].filter(function (k) { return get(ch, k + '.unlocked') && sh[k] > 0; });
      if (outs.length) outs.forEach(function (k) { sh[k] += spill / outs.length; });
      else if (get(ch, 'cold.unlocked')) sh.cold += spill; else sh.warm += spill;
    }
    var sum = sh.warm + sh.cold + sh.content + sh.sales;
    if (sum <= 0) { sh = { warm: 0.6, cold: 0, content: 0, sales: 0.4 }; sum = 1; }
    var eff = tuning(['autopilotEff'], 0.8), callE = tuning(['callEnergy'], 5);
    var coldOn = !!get(ch, 'cold.unlocked');
    var friends = friendsLeft();
    var warmA = left * sh.warm / sum * eff;
    var warmUsed = coldOn ? warmA : Math.min(warmA, friends);
    friends -= Math.min(warmA, friends);
    var salesE = left * sh.sales / sum;
    var held = Math.floor(num(st.leads)) * num(m.bookRate) * num(m.leadQuality, 1) * num(m.showRate);
    var funnelE = Math.min(salesE, held * callE / eff);
    var spillA = (salesE - funnelE) * eff;
    var spillUsed = coldOn ? spillA : Math.min(spillA, Math.max(0, friends));
    return done + warmUsed / eff + left * (sh.cold + sh.content) / sum + funnelE + spillUsed / eff;
  }

  TABS.hustle = function () {
    var st = S.state, m = obj(S.metrics);
    var coldOn = !!get(st, 'channels.cold.unlocked');
    if (S.channel === 'cold' && !coldOn) S.channel = 'warm';
    var warm = chDef('warm'), cold = chDef('cold');
    var cd = S.channel === 'cold' ? cold : warm;
    var cur = num(get(st, 'energy.current'));
    var ot = !!get(st, 'energy.overtimeToday');
    var streak = num(get(st, 'streak.grindDays'));
    var saleStreak = num(get(st, 'streak.saleDays'));
    var cc = comboCount();
    var burnout = clamp(num(st.burnout), 0, 100);
    var lvl = num(st.level, 1);
    var friendsOut = S.channel === 'warm' && friendsLeft() < 1;
    var empty = cur < 1 || friendsOut;
    var reachLabel = cur < 1 ? 'Out of juice' : friendsOut ? 'Friends all messaged' : 'Reach out!';
    var reachSub = friendsOut && cur >= 1 ? friendsOutSub(coldOn) : esc(cd.verb) + ' · −1 ⚡';
    // The Daily Grind shows what the engine counts for the streak: lead work today (taps +
    // what Autopilot will spend tonight), against TUNING.grindEnergy.
    var gT = grindTarget(), gUsed = grindProjected();
    var grindDone = gUsed >= gT;
    var grindNote = grindDone ? 'Grind done! Your streak grows tonight. 🔥'
      : friendsOutAll() ? 'Nobody left to reach today, so the streak pauses. More friends free up tomorrow.'
      : 'Taps + Autopilot outreach and calls count. Hit ' + gT + ' to keep your streak.';

    var leadsWaiting = num(st.leads);
    var leadsToday = m.leadsToday != null ? num(m.leadsToday) : S.today.leads;
    var callsToday = m.callsToday != null ? num(m.callsToday) : S.today.calls;
    var salesToday = m.salesToday != null ? num(m.salesToday) : S.today.sales;
    var custs = m.customersActive != null ? num(m.customersActive) : num(get(st, 'customers.active')) + num(get(st, 'customers.trials'));
    var custLabel = lvl <= 1 ? 'Trial users' : 'Customers';

    var feed = arr(st.log).slice(-8).reverse();

    return '' +
      '<section class="card hero-card">' +
      '<div class="seg-switch" role="tablist" aria-label="Outreach channel">' +
      '<button class="seg ' + (S.channel === 'warm' ? 'on' : '') + '" data-action="channel" data-id="warm">' + esc(warm.emoji) + ' ' + esc(warm.name) + '</button>' +
      '<button class="seg ' + (S.channel === 'cold' ? 'on' : '') + (coldOn ? '' : ' locked') + '" data-action="channel" data-id="cold">' + (coldOn ? esc(cold.emoji) : '🔒') + ' ' + esc(cold.name) + '</button>' +
      '</div>' +
      '<div class="reach-wrap">' +
      '<div class="combo-badge' + (cc >= 8 ? ' hot' : '') + '"' + (cc >= 3 ? '' : ' hidden') + '>x' + cc + ' combo!</div>' +
      '<button id="reach-btn" class="reach-btn' + (S.channel === 'cold' ? ' cold' : '') + (empty ? ' empty' : '') + '" data-action="reach" aria-label="Reach out">' +
      '<span class="reach-emoji">' + esc(cd.emoji) + '</span>' +
      '<span class="reach-label">' + reachLabel + '</span>' +
      '<span class="reach-sub">' + reachSub + '</span>' +
      '</button>' +
      '<div class="combo-bar" data-nomorph><i id="combo-fill"></i></div>' +
      '</div>' +
      '<div class="reach-stats">' +
      '<span class="flame' + (streak > 0 ? '' : ' cold-streak') + '"><span class="f">🔥</span>' + streak + ' day streak</span>' +
      (lvl >= 3 ? '<span class="flame sale-streak' + (saleStreak > 0 ? '' : ' cold-streak') + '"><span class="f">💰</span>' + saleStreak + '-day sale streak</span>' : '') +
      '<span>⚡ ' + int(Math.floor(cur)) + ' left today</span>' +
      '</div>' +
      '</section>' +

      '<section class="card" id="funnel-card">' +
      '<div class="card-title"><h3>🔻 Today\'s funnel</h3><button class="btn white small" data-action="why">🤔 Why?</button></div>' +
      '<div class="funnel">' +
      '<div class="funnel-stage s1"><div class="ico">🙋</div><div class="num">' + int(leadsWaiting) + '</div><div class="lbl">Leads waiting</div><div class="sub">+' + int(leadsToday) + ' today</div></div>' +
      '<div class="pipe' + (leadsWaiting > 0 || leadsToday > 0 ? '' : ' idle') + '"><i class="dot"></i><i class="dot"></i></div>' +
      '<div class="funnel-stage s2"><div class="ico">📞</div><div class="num">' + int(callsToday) + '</div><div class="lbl">Calls</div><div class="sub">today</div></div>' +
      '<div class="pipe' + (callsToday > 0 ? '' : ' idle') + '"><i class="dot" style="background:var(--cash)"></i><i class="dot" style="background:var(--cash)"></i></div>' +
      '<div class="funnel-stage s3"><div class="ico">' + (lvl <= 1 ? '🎁' : '😊') + '</div><div class="num">' + int(custs) + '</div><div class="lbl">' + custLabel + '</div><div class="sub">+' + int(salesToday) + ' today</div></div>' +
      '</div>' +
      '</section>' +

      '<section class="card">' +
      '<div class="meter-label"><span>💪 ' + esc(gl('dailyGrind', 'The Daily Grind')) + '</span><span>Lead work <b>' + int(Math.min(gUsed, 999)) + '</b> / ' + gT + '</span></div>' +
      '<div class="meter"><i style="width:' + clamp(gUsed / gT * 100, 0, 100).toFixed(1) + '%"></i></div>' +
      '<p class="small muted" style="margin-top:6px">' + grindNote + '</p>' +
      '<div class="grind-row">' +
      '<div class="grow"><div class="meter-label"><span>🥵 Burnout</span><span><b>' + Math.round(burnout) + '</b>%</span></div>' +
      '<div class="meter red"><i style="width:' + burnout.toFixed(1) + '%"></i></div></div>' +
      '<button class="btn orange small" data-action="overtime"' + (ot ? ' disabled' : '') + '>' + (ot ? '😮‍💨 Done today' : '😤 Overtime +' + overtimeEnergy() + '⚡') + '</button>' +
      '</div>' +
      '</section>' +

      '<section class="card">' +
      '<div class="card-title"><h3>📰 What\'s happening</h3></div>' +
      (feed.length ? '<ul class="feed">' + feed.map(function (e) {
        e = obj(e);
        return '<li class="t-' + esc(e.type || 'info') + '"><span class="fe">' + (LOG_EMOJI[e.type] || '•') + '</span><span class="ft">' + esc(e.text || '') + '</span><span class="fd">D' + int(e.day) + '</span></li>';
      }).join('') + '</ul>' : '<p class="empty-note">Nothing yet. Tap Reach out! to get the ball rolling. 👋</p>') +
      '</section>';
  };

  TABS.offer = function () {
    var st = S.state, m = obj(S.metrics), o = obj(st.offer);
    var lvl = num(st.level, 1);
    var locked = lvl < 2;
    var fl = obj(flavorDef(st.flavor));
    var value = num(m.offerValue), price = num(o.price);

    var gauges = DIALS.map(function (dl) {
      return '<div class="gauge">' + gauge(o[dl.key], dl.color) + '<div class="g-name">' + dl.name + '</div><div class="g-tip">' + dl.tip + '</div></div>';
    }).join('');

    var ratio = price > 0 ? value / price : Infinity;
    // a slashed price is not a No-Brainer: same threshold the engine uses for "cheap" buyers
    var underpriced = price > 0 && num(fl.suggestedPrice) > 0 && price < tuning(['cheapRatio'], 0.6) * num(fl.suggestedPrice);
    var verdict, pa = obj(adviceNow().price), hint = num(pa.hint);
    if (price <= 0) verdict = '🎁 Free trial: all value, no price';
    else if (underpriced) verdict = '💸 Underpriced. Cheap isn\'t a No-Brainer: add value, then charge for it';
    else if (pa.verdict === 'raise') verdict = '💰 Leaving money on the table: try about ' + money(hint) + (pa.busy ? ' (you have more yeses than time)' : '');
    else if (pa.verdict === 'lower' && ratio < 1.6) verdict = '😬 Too pricey for what they get right now: try about ' + money(hint) + ', or add value';
    else if (ratio >= 3) verdict = '🤩 ' + gl('noBrainerOffer', 'No-Brainer Offer') + '!';
    else if (ratio >= 1.6) verdict = '😀 Good deal';
    else if (ratio >= 1) verdict = '😐 Meh. Worth about what it costs';
    else verdict = '😬 Overpriced for what they get';
    var top = Math.max(value, price, 1);

    // fixed range (not tied to the current price) so the slider doesn't jump while dragging
    var maxPrice = Math.max(1000, num(fl.marketValue) * 3, num(fl.suggestedPrice) * 4);
    if (price > maxPrice) maxPrice = price * 1.25;
    maxPrice = Math.ceil(maxPrice / 100) * 100;
    var step = maxPrice > 3000 ? 25 : 10;

    var priceBlock = locked
      ? '<div class="lock-panel"><span class="padlock">🔒</span><div><b>Price locked at $0</b><span>Level 1 is about free trials. Get people results and stories first. You can charge from Level 2.</span></div></div>'
      : '<div class="slider-box"><div class="price-big">' + moneyFull(price) + '</div>' +
        '<input type="range" data-slider="price" min="0" max="' + maxPrice + '" step="' + step + '" value="' + Math.round(price) + '" aria-label="Price">' +
        '<div class="range-ends"><span>$0</span>' + (hint > 0 ? '<span>Hint: about ' + money(hint) + ' for this value</span>' : (fl.suggestedPrice ? '<span>Hint: start near ' + money(fl.suggestedPrice) + '</span>' : '')) + '<span>' + money(maxPrice) + '</span></div>' +
        (num(pa.serveCost) > 0 && price > 0 ? '<p class="small muted" style="margin:6px 0 0">🧑‍🏫 Serving one customer costs your team about <b>' + money(pa.serveCost) + '</b> (' + pct(pa.serveCost / price) + ' of the price). Keep it under about a third.</p>' : '') +
        '</div>';

    var g = GUARANTEES[o.guarantee] || GUARANTEES.none;

    return '' +
      '<section class="card tinted-purple">' +
      '<div class="card-title"><h3>⚒️ ' + esc(gl('offerForge', 'Offer Forge')) + '</h3><span class="chip">' + esc(fl.emoji || '') + ' ' + esc(o.name || fl.offerName || 'My Offer') + '</span></div>' +
      '<p class="small" style="margin:-4px 0 10px">Make your offer so good people feel silly saying no. Turn the dials up with upgrades below.</p>' +
      '<div class="gauges">' + gauges + '</div>' +
      '<p class="formula-line">' + esc(gl('valueMeter', 'Value-o-Meter')) + ': <b>Value = (Dream × Odds) ÷ (Wait × Effort)</b></p>' +
      (m.offerScore != null ? '<p class="formula-line">Score right now: <b>' + num(m.offerScore).toFixed(2) + '</b></p>' : '') +
      '</section>' +

      '<section class="card">' +
      '<div class="card-title"><h3>⚖️ Value vs price</h3></div>' +
      '<div class="vp-bars">' +
      '<div class="vp-row worth"><span>Feels worth</span><div class="bar"><i style="width:' + (value / top * 100).toFixed(1) + '%"></i></div><span class="val">' + money(value) + '</span></div>' +
      '<div class="vp-row price"><span>Price</span><div class="bar"><i style="width:' + (price / top * 100).toFixed(1) + '%"></i></div><span class="val">' + money(price) + '</span></div>' +
      '</div>' +
      '<div class="verdict">' + esc(verdict) + '</div>' +
      (price > 0 && isFinite(ratio) ? '<p class="small muted center">Worth ' + ratio.toFixed(1) + '× the price. Aim for 3× or more by raising value with the dials and boosts, not by cutting the price.' +
        (underpriced ? ' Bargain prices pull in flaky buyers: more refunds, more quitting.' : '') + '</p>' : '') +
      '</section>' +

      '<section class="card">' +
      '<div class="card-title"><h3>🏷️ Your price</h3>' + (locked ? '<span class="chip grey">🔒 Level 2</span>' : '') + '</div>' +
      priceBlock +
      '</section>' +

      '<section class="card">' +
      '<div class="card-title"><h3>🎯 Projected close rate</h3></div>' +
      '<div class="big-stat"><span class="n">' + pct(m.closeRate) + '</span><span class="u">of calls say yes</span></div>' +
      '<p class="small muted center">Higher value or more proof → more yeses. Higher price without more value → fewer.</p>' +
      '<div style="height:12px"></div>' +
      '<div class="guarantee"><span class="shield">' + g.emoji + '</span><div><b>' + esc(g.name) + '</b><span>' + esc(g.desc) + '</span></div></div>' +
      '</section>' +

      upgSection('🃏 Offer upgrades', 'Collect them all. Each one teaches a real trick.', ['offer'], locked ? 'Offer upgrades unlock at Level 2.' : 'No offer upgrades yet.');
  };

  TABS.growth = function () {
    var st = S.state, m = obj(S.metrics);
    var lvl = num(st.level, 1);
    var chans = obj(st.channels);

    var megaStat = function (id) {
      if (id === 'warm') return '👥 ' + int(get(st, 'network.available')) + ' / ' + int(get(st, 'network.size')) + ' friends left · ' + pct(m.warmReply) + ' reply';
      if (id === 'cold') return '📈 ' + pct(m.coldReply) + ' reply rate';
      if (id === 'content') return '👀 ' + int(st.audience) + ' followers';
      if (id === 'ads') return '💸 ' + money(get(st, 'channels.ads.dailyBudget')) + '/day · ' + money(m.cpl) + ' per lead';
      return '';
    };
    var megas = ['warm', 'cold', 'content', 'ads'].map(function (id) {
      var c = chDef(id), on = !!get(chans, id + '.unlocked');
      var lv = num(get(chans, id + '.level'));
      return '<div class="mega ' + id + (on ? '' : ' locked') + '">' +
        '<div class="m-top"><span class="m-emoji">' + esc(c.emoji) + '</span>' + (on ? (lv ? '<span class="chip">Gear ' + lv + '</span>' : '') : '<span class="chip grey">🔒 Lv ' + c.unlockLevel + '</span>') + '</div>' +
        '<div class="m-name">' + esc(c.name) + '</div>' +
        '<div class="m-stat">' + (on ? esc(megaStat(id)) : 'Unlocks at Level ' + c.unlockLevel) + '</div>' +
        (c.desc ? '<div class="m-desc">' + esc(c.desc) + '</div>' : '') +
        '</div>';
    }).join('');

    var plan = obj(st.plan);
    var vis = visiblePlanKeys();
    var planBar = vis.map(function (pk) {
      return '<i style="width:' + clamp(num(plan[pk.key]), 0, 100) + '%;background:' + pk.color + '"></i>';
    }).join('');
    var planRows = vis.map(function (pk) {
      var label = pk.key === 'sales' ? 'Sales calls' : chDef(pk.key).name;
      return '<div class="plan-row"><span class="p-name">' + pk.emoji + ' ' + esc(label) + '</span>' +
        '<input type="range" class="' + pk.cls + '" data-slider="plan" data-key="' + pk.key + '" min="0" max="100" step="1" value="' + Math.round(num(plan[pk.key])) + '" aria-label="' + esc(label) + ' share">' +
        '<span class="p-val">' + Math.round(num(plan[pk.key])) + '%</span></div>';
    }).join('');

    var contentOn = !!get(chans, 'content.unlocked');
    var adsOn = !!get(chans, 'ads.unlocked');
    var postCost = tuning(['contentPostEnergy', 'postEnergy', 'POST_ENERGY'], null);
    var contentCard = contentOn
      ? '<section class="card"><div class="card-title"><h3>🎬 Post content</h3><span class="sub">' + int(st.audience) + ' followers</span></div>' +
        '<p class="small muted" style="margin-bottom:10px">Give away something useful. Posts keep bringing leads for about two weeks.</p>' +
        '<button class="btn block" data-action="post" style="background:var(--pink);border-bottom-color:#d14d96">📲 Post something' + (postCost ? ' (−' + postCost + '⚡)' : '') + '</button></section>'
      : '';

    var budget = num(get(chans, 'ads.dailyBudget'));
    var adCap = adBudgetCap();
    // Level 4+: the slider reaches a few steps past today's budget (and half a day of sales), not the $60k cap,
    // so one drag can't put a small business in the red
    if (lvl >= COMPANY_LEVEL) adCap = Math.min(adCap, Math.ceil(Math.max(500, budget * 3, num(m.revenue30) / 30 * 0.5) / 100) * 100);
    var aa = obj(adviceNow().ads), rw = num(m.runwayDays, 999);
    var adsCard = adsOn
      ? '<section class="card"><div class="card-title"><h3>📺 Ad budget</h3><span class="chip green">' + money(budget) + '/day</span></div>' +
        '<input type="range" class="green" data-slider="adBudget" min="0" max="' + adCap + '" step="' + (adCap > 10000 ? 100 : 5) + '" value="' + Math.round(Math.min(budget, adCap)) + '" aria-label="Ad budget per day">' +
        '<div class="range-ends"><span>$0</span><span>' + money(adCap) + '/day</span></div>' +
        '<p class="small muted" style="margin-top:6px">≈ ' + (num(m.cpl) > 0 ? (budget / num(m.cpl)).toFixed(1) : '0') + ' leads/day at ' + money(m.cpl) + ' each. Keep CAC below your 30-day cash per customer.</p>' +
        (lvl >= COMPANY_LEVEL && budget > 0 ? '<p class="small muted" style="margin-top:4px">💵 ' + (rw >= 999 ? 'Sales cover your costs at this budget.' : 'About <b>' + int(rw) + ' ' + plural(rw, 'day') + '</b> of cash at this budget and today\'s costs.') + (num(m.revenue30) > 0 ? ' Ads are ' + pct(budget / (num(m.revenue30) / 30)) + ' of sales.' : '') + '</p>' : '') +
        (aa.reason && aa.step !== 'start' ? '<div class="advice-box ' + (aa.step === 'up' ? '' : aa.step === 'hold' ? 'hold' : 'hold') + '" style="margin:8px 0 0">' + (aa.step === 'up' ? '👉 ' : aa.step === 'hold' ? '✋ ' : '⬇️ ') + esc(aa.reason) + '</div>' : '') +
        '</section>'
      : '';

    var combosUnlocked = ['hook', 'upsell', 'downsell', 'membership'].some(function (id) { return !!get(st, 'combos.' + id + '.unlocked'); });
    var comboRows = ['hook', 'upsell', 'downsell', 'membership'].map(function (id) {
      var c = comboDef(id), sc = obj(get(st, 'combos.' + id));
      var un = !!sc.unlocked;
      var priceLbl = id === 'downsell' ? '' : (sc.price ? ' · ' + money(sc.price) + (id === 'membership' ? '/mo' : '') : '');
      return '<div class="combo-card' + (un ? '' : ' locked') + '"><span class="c-emoji">' + esc(c.emoji) + '</span>' +
        '<div class="c-body"><div class="c-name">' + esc(c.name) + esc(priceLbl) + '</div><div class="c-desc">' + esc(un ? c.desc : '🔒 Unlocks at Level 3') + '</div></div>' +
        '<button class="toggle ' + (sc.on ? 'on' : '') + '" data-action="combo" data-id="' + id + '"' + (un ? '' : ' disabled') + ' aria-label="Toggle ' + esc(c.name) + '"></button></div>';
    }).join('');
    var combosCard = '<section class="card"><div class="card-title"><h3>💸 ' + esc(gl('cashCombos', 'Cash Combos')) + '</h3>' + (combosUnlocked || lvl >= 3 ? '' : '<span class="chip grey">🔒 Level 3</span>') + '</div>' +
      '<p class="small muted" style="margin:-4px 0 10px">Stack offers so each customer is worth more: hook them, offer more, catch the no\'s, keep them monthly.</p>' +
      comboRows + '</section>';

    var skills = obj(st.skills);
    var skillTiles = SKILLS.map(function (s) {
      var v = clamp(num(skills[s.key]), 0, 5);
      var pips = '';
      for (var i = 0; i < 5; i++) pips += '<i class="' + (i < v ? 'on' : '') + '"></i>';
      return '<div class="skill"><div class="s-emoji">' + s.emoji + '</div><div class="s-name">' + esc(s.name || gl('closeKit', 'Close Kit')) + '</div><div class="pips">' + pips + '</div></div>';
    }).join('');

    var squadLv = { Fans: 4, Staff: 4, Agencies: 6, Partners: 6 };
    var squad = [['🙌', 'Fans'], ['🧑‍💼', 'Staff'], ['🏢', 'Agencies'], ['🤝', 'Partners']].map(function (x) {
      return '<div class="' + (lvl >= squadLv[x[1]] ? 'on' : '') + '"><span>' + x[0] + '</span>' + x[1] + '</div>';
    }).join('');
    var squadCard = lvl >= COMPANY_LEVEL
      ? '<section class="card"><div class="card-title"><h3>🫂 ' + esc(gl('leadSquad', 'Lead Squad')) + '</h3><span class="sub">' + squadActive() + ' / 4 working</span></div>' +
        '<p class="small muted" style="margin:-4px 0 10px">Other people now bring leads for you. Run them from the Company tab.</p>' +
        '<div class="squad">' + squad + '</div>' +
        '<button class="btn white block" style="margin-top:10px" data-action="tab" data-tab="company">🏢 Open the Company tab</button></section>'
      : '<section class="card"><div class="card-title"><h3>🫂 ' + esc(gl('leadSquad', 'Lead Squad')) + '</h3><span class="chip grey">🔒 Level 4+</span></div>' +
        '<p class="small muted" style="margin:-4px 0 10px">Later, other people bring leads for you. It opens at Level 4.</p>' +
        '<div class="squad">' + squad + '</div></section>';

    return '' +
      '<section class="card"><div class="card-title"><h3>📣 ' + esc(gl('megaphones', 'The Four Megaphones')) + '</h3></div>' +
      '<div class="mega-grid">' + megas + '</div></section>' +

      '<section class="card tinted-yellow"><div class="card-title"><h3>🤖 Autopilot plan</h3><span class="sub">leftover energy</span></div>' +
      '<p class="small" style="margin:-4px 0 6px">Energy you don\'t tap away gets spent like this each night (at 80% power).</p>' +
      '<div class="plan-total">' + planBar + '</div>' + planRows + '</section>' +

      contentCard + adsCard + combosCard +

      '<section class="card"><div class="card-title"><h3>📜 ' + esc(gl('skillScrolls', 'Skill Scrolls')) + '</h3></div>' +
      '<div class="skills">' + skillTiles + '</div>' +
      '<p class="small muted">' + esc(gl('closeKit', 'Close Kit')) + ' steps: Ask why now → Name the gap → Paint the dream → Clear the doubts → Make the ask → Welcome them in.</p>' +
      '</section>' +
      upgSection('🎓 Skill upgrades', '', ['skill'], lvl < 2 ? 'Skills unlock at Level 2.' : 'No skills to learn right now.') +
      upgSection('🌱 Lead nurture', 'Treat leads well so more show up and buy.', ['nurture'], lvl < 2 ? 'Nurture upgrades unlock at Level 2.' : 'Nothing to add right now.') +
      upgSection('🧰 Megaphone gear', '', ['megaphone'], 'No gear available yet.') +

      squadCard;
  };

  TABS.numbers = function () {
    var st = S.state, m = obj(S.metrics);
    var lvl = num(st.level, 1);
    var daily = arr(get(st, 'stats.daily')).slice(-S.chartRange);
    var cashPts = daily.map(function (d) { return { x: num(d.day), y: num(d.cash) }; });
    var revPts = daily.map(function (d) { return { x: num(d.day), y: num(d.revenue) }; });
    var l3 = lvl >= 3;
    var kpi = function (label, val, sub, tone, lockLvl) {
      if (lockLvl && lvl < lockLvl) return '<div class="kpi locked"><div class="k-lbl">' + label + '</div><div class="k-val">🔒 Lv ' + lockLvl + '</div></div>';
      return '<div class="kpi ' + (tone || '') + '"><div class="k-lbl">' + label + '</div><div class="k-val">' + val + '</div>' + (sub ? '<div class="k-sub">' + sub + '</div>' : '') + '</div>';
    };
    var ltvCac = num(m.ltvCac);
    var runway = m.runwayDays;
    var runwayTxt = runway == null || !isFinite(+runway) || +runway >= 999 ? '∞' : int(runway) + ' days';
    var runwaySub = runwayTxt === '∞' ? 'profitable on average' : 'before cash runs out';
    if (num(st.cash) < 0 && lvl >= COMPANY_LEVEL) {
      var ci0 = creditInfo();
      if (ci0.past) { runwayTxt = 'Past the line'; runwaySub = int(ci0.left) + ' ' + plural(ci0.left, 'day') + ' to get back inside it'; }
      else { runwayTxt = 'On credit'; runwaySub = money(ci0.used) + ' of ' + money(ci0.line) + ' used'; }
    }
    var stats = obj(st.stats);

    // all ten levels are real now: done / current / upcoming (a level missing from content shows locked)
    var sold = isSold();
    var levels = [];
    for (var i = 1; i <= 10; i++) {
      var d = obj(levelDef(i));
      var state;
      if (sold || i < lvl || (st.graduated && i <= lvl)) state = 'done';
      else if (i === lvl) state = 'current';
      else state = (!levelDef(i) || d.locked) ? 'locked' : '';
      levels.push('<div class="pnode ' + state + '"><span class="pn-dot">' + (state === 'done' ? '✅' : esc(d.emoji || (state === 'locked' ? '🔒' : '⭐'))) + '</span>' +
        '<div><div class="pn-name">' + i + '. ' + esc(d.name || 'Level ' + i) + '</div>' +
        '<div class="pn-sub">' + esc(d.role ? d.role + ' · ' : '') + esc(state === 'locked' ? 'Not in this build' : (d.constraint || '')) + '</div></div></div>');
    }
    var ex = obj(st.exit);
    levels.push('<div class="pnode summit ' + (sold ? 'done' : '') + '"><span class="pn-dot">🏔️</span>' +
      '<div><div class="pn-name">' + esc(gl('summit', 'The Summit')) + '</div>' +
      '<div class="pn-sub">' + (sold ? 'Sold for ' + money(ex.valuation) + ' on day ' + int(ex.day != null ? ex.day : st.day) : 'Sell the company. The end of the climb.') + '</div></div></div>');

    var late = lvl >= COMPANY_LEVEL;
    var profitPts = daily.filter(function (d) { return d && d.profit != null; }).map(function (d) { return { x: num(d.day), y: num(d.profit) }; });
    var margin = num(m.profitMargin30);
    var lateKpis = late
      ? kpi('Profit, last 30 days', money(m.profit30), 'sales − all costs', num(m.profit30) > 0 ? 'good' : (num(m.profit30) < 0 ? 'bad' : '')) +
        kpi('Profit margin', pct(margin), 'kept from each $1', margin >= 0.15 ? 'good' : (margin < 0 ? 'bad' : '')) +
        kpi('Payroll / day', money(m.payrollDaily), 'paid every day') +
        kpi('Headcount', int(m.headcount != null ? m.headcount : 1), 'you included') +
        (m.revenuePerEmployee != null ? kpi('Sales per person', money(m.revenuePerEmployee), 'per year') : '') +
        (m.valuation != null ? kpi('Company value', money(m.valuation), num(m.multiple) ? num(m.multiple).toFixed(1) + '× yearly profit' : '', num(m.valuation) > 0 ? 'good' : '') : '')
      : '';

    var rangeBtns = [30, 60, 120].map(function (r) {
      return '<button class="' + (S.chartRange === r ? 'on' : '') + '" data-action="chart-range" data-range="' + r + '">' + r + 'd</button>';
    }).join('');

    return '' +
      '<section class="card"><div class="card-title"><h3>📈 Cash</h3><div class="chart-tabs">' + rangeBtns + '</div></div>' +
      lineChart(cashPts, { color: '#22c55e', label: 'Cash over time' }) +
      '<div class="chart-cap" style="margin-top:10px"><span>💵 Daily revenue</span><span>' + money(m.revenueToday) + ' today</span></div>' +
      lineChart(revPts, { color: '#8b5cf6', h: 110, label: 'Daily revenue' }) +
      (late && profitPts.length ? '<div class="chart-cap" style="margin-top:10px"><span>📈 Daily profit</span><span>' + money(m.profitYesterday != null ? m.profitYesterday : profitPts[profitPts.length - 1].y) + ' yesterday</span></div>' +
        lineChart(profitPts, { color: '#f59e0b', h: 110, label: 'Daily profit' }) : '') +
      '</section>' +

      '<section class="card"><div class="card-title"><h3>🧮 Key numbers</h3><button class="btn white small" data-action="why">🤔 Why?</button></div>' +
      '<div class="kpis">' +
      kpi('Sales, last 30 days', money(m.revenue30), '', num(m.revenue30) > 0 ? 'good' : '') +
      kpi('Close rate', pct(m.closeRate), 'calls that buy') +
      kpi('Cost per lead', num(m.cpl) > 0 ? money(m.cpl) : '—', 'from ads', '', 3) +
      kpi('Lifetime value', money(m.ltv), 'per customer', '', 3) +
      kpi('Cost to get one', num(m.cac) > 0 ? money(m.cac) : '—', 'CAC', '', 3) +
      kpi('LTV : CAC', ltvCac > 0 ? ltvCac.toFixed(1) + '×' : '—', 'aim for 3× or more', ltvCac >= 3 ? 'good' : (ltvCac > 0 && ltvCac < 1 ? 'bad' : ''), 3) +
      kpi('30-day cash / customer', money(m.cash30PerCustomer), num(m.cac) > 0 ? (num(m.cash30PerCustomer) >= num(m.cac) ? 'pays for itself ✅' : 'below CAC') : '', num(m.cac) > 0 && num(m.cash30PerCustomer) >= num(m.cac) ? 'good' : '', 3) +
      kpi('Runway', runwayTxt, runwaySub, runwayTxt !== '∞' && num(runway) < 10 ? 'bad' : '') +
      lateKpis +
      '</div>' +
      (l3 ? '' : '<p class="small muted center" style="margin-top:8px">The full money panel opens at Level 3.</p>') +
      '</section>' +

      '<section class="card"><div class="card-title"><h3>🔻 Funnel</h3></div>' +
      '<table class="ftable"><tbody>' +
      '<tr><td>👋 Friends who reply</td><td>' + pct(m.warmReply) + '</td></tr>' +
      (get(st, 'channels.cold.unlocked') ? '<tr><td>📞 Strangers who reply</td><td>' + pct(m.coldReply) + '</td></tr>' : '') +
      '<tr><td>📅 Leads who book a call</td><td>' + pct(m.bookRate) + '</td></tr>' +
      '<tr><td>🚪 Booked calls that show</td><td>' + pct(m.showRate) + '</td></tr>' +
      '<tr><td>🤝 Calls that buy</td><td>' + pct(m.closeRate) + '</td></tr>' +
      '<tr><td>📨 Total outreach</td><td>' + int(stats.outreachTotal) + '</td></tr>' +
      '<tr><td>🙋 Total leads</td><td>' + int(stats.leadsTotal) + '</td></tr>' +
      '<tr><td>📞 Total calls</td><td>' + int(stats.callsTotal) + '</td></tr>' +
      '<tr><td>💰 Total sales</td><td>' + int(stats.salesCount) + ' · ' + money(stats.revenueTotal) + '</td></tr>' +
      (num(stats.refunds) ? '<tr><td>↩️ Refunds</td><td>' + int(stats.refunds) + '</td></tr>' : '') +
      (num(stats.adSpendTotal) ? '<tr><td>📺 Ad spend</td><td>' + money(stats.adSpendTotal) + '</td></tr>' : '') +
      '</tbody></table></section>' +

      '<section class="card"><div class="card-title"><h3>🗺️ The road to ' + esc(gl('summit', 'The Summit')) + '</h3></div>' +
      '<div class="path">' + levels.join('') + '</div></section>';
  };

  TABS.notebook = function () {
    var st = S.state;
    var list = arr(C().notebook);
    var unlocked = arr(st.notebook);
    var quizzes = obj(st.quizzes);
    var total = list.length || 28;
    var count = list.filter(function (n) { return has(unlocked, n.id); }).length;
    var aced = list.filter(function (n) { return quizzes[n.id]; }).length;
    var cards = list.map(function (n) {
      if (!has(unlocked, n.id)) {
        return '<div class="lesson locked" data-key="nb-' + esc(n.id) + '" aria-label="Locked lesson"><span class="l-emoji">' + esc(n.emoji || '📓') + '</span><span class="l-term">???</span>' +
          (n.level ? '<span class="small" style="color:var(--locked)">Lv ' + int(n.level) + '</span>' : '') + '</div>';
      }
      return '<button class="lesson" data-key="nb-' + esc(n.id) + '" data-action="lesson" data-id="' + esc(n.id) + '">' +
        (!S.ui.seen[n.id] ? '<span class="l-new">NEW</span>' : '') +
        (quizzes[n.id] ? '<span class="l-star">⭐</span>' : '') +
        '<span class="l-emoji">' + esc(n.emoji || '📓') + '</span><span class="l-term">' + esc(n.term || n.title || n.id) + '</span></button>';
    }).join('');
    return '' +
      '<section class="card tinted-purple"><div class="card-title"><h3>📓 ' + esc(gl('notebook', "Founder's Notebook")) + '</h3><span class="sub">⭐ ' + aced + ' quizzes aced</span></div>' +
      '<div class="nb-progress"><div class="meter purple"><i style="width:' + (count / total * 100).toFixed(1) + '%"></i></div><b>' + count + ' / ' + total + ' lessons</b></div>' +
      '<p class="small" style="margin-top:8px">Every big decision teaches you something. Tap a lesson to read it and take the quiz.</p></section>' +
      '<section class="card">' + (cards ? '<div class="nb-grid">' + cards + '</div>' : '<p class="empty-note">Lessons are on their way.</p>') + '</section>';
  };

  /* ================================================================== */
  /* Company tab (SPEC-LATE §7) — each section appears from its level    */
  /* ================================================================== */
  var SOPS = [
    { key: 'delivery', emoji: '📘', name: 'Delivery', what: function () { return roleNameOf('coach', true) + ' cover more clients'; } },
    { key: 'sales', emoji: '📗', name: 'Sales', what: function () { return roleNameOf('closer', true) + ' close more of their calls'; } },
    { key: 'marketing', emoji: '📙', name: 'Marketing', what: function () { return roleNameOf('setter', true) + ' reach more people'; } },
    { key: 'hiring', emoji: '📕', name: 'Hiring', what: function () { return 'Faster ramp-up, ' + roleNameOf('manager', true) + ' lead +1'; } }
  ];
  // where each late upgrade group is shown (anything else lands in "More company upgrades")
  var UPG_HOME = { team: 'team', squad: 'squad', product: 'product', ops: 'ops', protect: 'depts', playbooks: 'playbooks' };

  function lateUpg(u) { return u && (u.category === 'team' || u.category === 'systems'); }
  function upgradesWhere(pred) {
    var lvl = lvlNow();
    var rank = function (x) { return !x.owned && num(x.upgrade.minLevel, 1) > lvl ? 1 : 0; };
    return upgradeList().filter(function (x) { return pred(x.upgrade); }).slice().sort(function (a, b) { return rank(a) - rank(b); });
  }
  var HOME_LEVEL = { product: 6, ops: 7, depts: 8 };   // level each home section first draws
  function upgHomeOf(u) {
    if (u.sop || u.group === 'playbooks' || /^playbook_/.test(u.id || '')) return 'playbooks';
    var home = UPG_HOME[u.group] || (u.category === 'team' ? 'team' : 'more');
    // e.g. insurance (Level 5) before Departments open (Level 8): show it once it can be bought
    if (lvlNow() < num(HOME_LEVEL[home], 0)) return num(u.minLevel, 1) <= lvlNow() ? 'more' : 'hidden';
    return home;
  }
  function upgGroup(home, title) {
    var list = upgradesWhere(function (u) { return lateUpg(u) && upgHomeOf(u) === home; });
    if (!list.length) return '';
    var owned = list.filter(function (x) { return x.owned; }).length;
    return (title ? '<div class="co-sub"><span>' + title + '</span><span class="muted">' + owned + ' / ' + list.length + '</span></div>' : '') +
      '<div class="upgrade-grid">' + list.map(upgCard).join('') + '</div>';
  }
  function hireRunwayAfter(roleId, n) {
    var st = S.state, m = obj(S.metrics);
    if (!st || m.burnDaily == null) return null;
    n = Math.max(1, n || 1);
    var r = find(roleList(), function (x) { return x.id === roleId; }) || {};
    var rd = (ZTE.Engine && typeof ZTE.Engine.roleDef === 'function') ? obj(ZTE.Engine.roleDef(C(), roleId, get(st, 'flavor'))) : r;
    var salary = num(rd.salary != null ? rd.salary : r.salary) * num(m.payLevel, 1) * num(m.salaryCostMult, 1);
    var burn = num(m.burnDaily) + salary * n;
    if (burn <= 0) return null;
    return Math.max(0, num(st.cash) - n * num(rd.hireCost != null ? rd.hireCost : r.hireCost)) / burn;
  }
  // recruiting cap (engine: hires in the last hireWindow days): days until the next slot opens, 0 = open now
  function nextHireIn() {
    var st = S.state, m = obj(S.metrics);
    if (!st || m.hiresLeft == null || num(m.hiresLeft) > 0) return 0;
    var win = tuning(['hireWindow'], 14), day = num(st.day);
    var recent = arr(get(st, 'team.hires')).map(Number).filter(function (d) { return d > day - win; }).sort(function (a, b) { return a - b; });
    var first = recent[Math.max(0, recent.length - Math.max(1, num(m.hireCap, 1)))];
    return first == null ? 1 : Math.max(1, Math.ceil(first + win - day));
  }
  function isArmed(key) { return !!(S.armed && S.armed.key === key && Date.now() - S.armed.at < ARM_MS); }
  function coCard(id, title, sub, body, cls) {
    return '<section class="card co-card ' + (cls || '') + '" data-key="co-' + id + '" id="co-' + id + '">' +
      '<div class="card-title"><h3>' + title + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>' + body + '</section>';
  }
  function pipRow(n, max, cls) {
    var h = '';
    for (var i = 0; i < max; i++) h += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return '<span class="pips ' + (cls || '') + '">' + h + '</span>';
  }
  function tone(h) { return h >= 70 ? 'green' : h >= 50 ? '' : 'red'; }
  function lvVal(x, n, d) {
    if (Array.isArray(x)) return num(x[Math.max(0, Math.min(n - 1, x.length - 1))], d);
    return num(x, d);
  }
  function miniStat(emoji, val, label, cls) {
    return '<div class="co-stat ' + (cls || '') + '"><span class="cs-e">' + emoji + '</span><b>' + val + '</b><span>' + label + '</span></div>';
  }
  function lockedNote(text) { return '<div class="lock-panel slim"><span class="padlock">🔒</span><div><span>' + esc(text) + '</span></div></div>'; }

  function valuationNow() {
    if (!S.state) return null;
    var L = lateX();
    if (typeof L.valuationFrom === 'function' && S.metrics) {
      try { var v = L.valuationFrom(S.state, C(), S.metrics); if (v && typeof v === 'object') return v; } catch (e) { /* fall through */ }
    }
    if (!hasEng('getValuation')) return null;
    var r = eng('getValuation', S.state, C());
    return r && typeof r === 'object' ? r : null;
  }

  /* ---- summary ---- */
  function coSummary() {
    var m = obj(S.metrics), st = S.state;
    var margin = num(m.profitMargin30);
    var sold = isSold();
    var soldBox = sold
      ? '<div class="sold-box"><span class="sb-e">🏔️</span><div><b>Sold for ' + money(get(st, 'exit.valuation')) + '</b><span>This run is complete. Your Wisdom is waiting.</span></div></div>' +
        '<div class="row" style="margin-top:10px"><button class="btn green" style="flex:1" data-action="ngplus">🌟 New Game+</button><button class="btn white" data-action="summit-show">🎉 Finale</button></div>'
      : '';
    return coCard('summary', '🏢 Your company', esc(obj(levelDef(lvlNow())).role || ''),
      soldBox +
      '<div class="co-stats"' + (sold ? ' style="margin-top:12px"' : '') + '>' +
      miniStat('👥', int(m.headcount != null ? m.headcount : 1), 'people') +
      miniStat('💸', money(m.payrollDaily), 'payroll / day') +
      miniStat('📈', money(m.profit30), 'profit, 30 days', num(m.profit30) > 0 ? 'good' : (num(m.profit30) < 0 ? 'bad' : '')) +
      miniStat('🧮', pct(margin), 'margin', margin >= 0.15 ? 'good' : (margin < 0 ? 'bad' : '')) +
      '</div>', sold ? 'tinted-green' : 'tinted-purple');
  }

  /* ---- Team (L4) ---- */
  function coTeam() {
    var st = S.state, m = obj(S.metrics), lvl = lvlNow(), cash = num(st.cash);
    var team = obj(st.team), ramp = arr(team.ramp), sops = obj(st.sops);
    var waitDays = nextHireIn(), hiresLeft = Math.floor(num(m.hiresLeft));
    var sold = isSold();
    // today's output per role (the engine fixes what each role id produces; the sales role is the rest)
    var nowOf = function (id) { return id === 'coach' ? m.teamDelivery : id === 'setter' ? m.teamOutreach : id === 'manager' ? null : m.teamCalls; };
    var rows = roleList().map(function (r) {
      var id = r.id, n = Math.max(0, Math.floor(num(team[id]))), unlock = num(r.unlockLevel, 4);
      var locked = lvl < unlock;
      var rampN = 0;
      ramp.forEach(function (e) { if (e && e.role === id) rampN += Math.max(0, num(e.n)); });
      // salary and hiring fee as the engine charges them (flavor pay scale included)
      var rd = (ZTE.Engine && typeof ZTE.Engine.roleDef === 'function') ? obj(ZTE.Engine.roleDef(C(), id, get(st, 'flavor'))) : r;
      var hireCost = num(rd.hireCost != null ? rd.hireCost : r.hireCost), afford = cash >= hireCost && !waitDays && !sold;
      var five = afford && lvl >= 8 && hiresLeft >= 5 && cash >= 5 * hireCost;
      var out;
      if (id === 'manager') out = 'leads ' + int(num(r.capacity, 6) + clamp(num(sops.hiring), 0, 3)) + ' people each';
      else if (n && nowOf(id) != null) out = '≈' + int(nowOf(id)) + ' ' + (r.unit || '') + ' now';
      else out = int(r.capacity) + ' ' + (r.unit || '') + ' each';
      var nm = roleName(r);
      return '<div class="role-row' + (locked ? ' locked' : '') + '" data-key="role-' + esc(id) + '">' +
        '<span class="role-emoji">' + esc(r.emoji || '🧑') + (n ? '<b class="role-n">' + n + '</b>' : '') + '</span>' +
        '<div class="role-body"><div class="role-name">' + esc(nm) + (rampN ? ' <span class="chip yellow">🐣 ' + int(rampN) + ' new</span>' : '') + '</div>' +
        '<div class="role-meta">' + money(num(rd.salary != null ? rd.salary : r.salary) * num(m.payLevel, 1) * num(m.salaryCostMult, 1)) + '/day · ' + esc(out) + '</div>' +
        (r.desc && !n ? '<div class="role-desc">' + esc(r.desc) + '</div>' : '') + '</div>' +
        '<div class="role-actions">' +
        (locked ? '<span class="chip grey">🔒 Lv ' + unlock + '</span>'
          : (n ? '<button class="btn white small sq' + (isArmed('fire-' + id) ? ' armed' : '') + '" data-action="fire-staff" data-id="' + esc(id) + '"' + (sold ? ' disabled' : '') + ' aria-label="Let one ' + esc(nm) + ' go">' + (isArmed('fire-' + id) ? 'Sure?' : '−') + '</button>' : '') +
            (five ? '<button class="btn small ' + (isArmed('hire-' + id + '-5') ? 'orange armed' : 'white') + '" data-action="hire" data-id="' + esc(id) + '" data-n="5" aria-label="Hire 5 ' + esc(pluralWord(nm)) + '">' + (isArmed('hire-' + id + '-5') ? 'Sure?' : '+5') + '<small>' + money(5 * hireCost) + '</small></button>' : '') +
            // recruiting cap: say when the next slot opens; the button stays tappable so the engine explains
            (waitDays && !sold ? '<button class="btn small hire-btn white" data-action="hire" data-id="' + esc(id) + '" aria-label="Recruiting is full for ' + waitDays + ' ' + plural(waitDays, 'day') + '">⏳ ' + waitDays + ' ' + plural(waitDays, 'day') + '<small>next hire</small></button>'
              : '<button class="btn small hire-btn ' + (afford ? (isArmed('hire-' + id) ? 'orange armed' : 'green') : 'white') + '" data-action="hire" data-id="' + esc(id) + '"' + (afford ? '' : ' disabled') + ' aria-label="Hire a ' + esc(nm) + '">' + (isArmed('hire-' + id) ? 'Sure?' : '+ Hire') + '<small>' + money(hireCost) + '</small></button>')) +
        '</div></div>';
    }).join('');
    var unmanaged = num(m.unmanaged);
    var ha = obj(adviceNow().hire);
    var nextBox = ha.reason && !sold ? '<div class="advice-box ' + (ha.role ? '' : ha.hold ? 'hold' : 'calm') + '" data-key="next-hire">' + (ha.role ? '👉 ' : ha.hold ? '✋ ' : '✅ ') + esc(ha.reason) + '</div>' : '';
    var morale = clamp(num(m.morale, num(team.morale, 80)), 0, 100);
    var fds = clamp(num(m.founderDeliveryShare), 0, 1), fss = clamp(num(m.founderSalesShare, 1), 0, 1);
    var anyStaff = num(m.staff) > 0;
    var warn = unmanaged > 0
      ? '<div class="warn-box">⚠️ <b>' + int(unmanaged) + ' ' + plural(unmanaged, 'person', 'people') + ' with no manager</b> work at 60%. ' +
        (lvl >= 5 ? (ha.role === 'manager' ? 'Hire a ' + esc(roleName(find(roleList(), function (r) { return r.id === 'manager'; }) || { name: 'Manager' })) + '.'
          : unmanaged < 2 ? 'One person coasting is fine for now. Add a manager when it is two or more.' : 'Add a manager once your margin is back above 12%, or keep the team smaller for now.')
          : 'You can lead ' + int(num(m.manageCapacity, 4)) + ' yourself; managers arrive at Level 5.') + '</div>'
      : (anyStaff ? '<p class="small muted" style="margin-top:8px">🧭 Everyone has a boss: you can lead ' + int(num(m.manageCapacity, 4)) + ' people right now.</p>' : '');
    var meters =
      '<div class="meter-label" style="margin-top:12px"><span>🧑‍🏫 Delivery you still do</span><span><b>' + pct(fds) + '</b></span></div>' +
      '<div class="meter ' + (fds <= 0.4 ? 'green' : 'red') + '"><i style="width:' + (fds * 100).toFixed(1) + '%"></i><span class="tick" style="left:40%"></span></div>' +
      '<div class="meter-label" style="margin-top:8px"><span>📞 Sales calls you take</span><span><b>' + pct(fss) + '</b></span></div>' +
      '<div class="meter purple"><i style="width:' + (fss * 100).toFixed(1) + '%"></i></div>' +
      (anyStaff ? '<div class="meter-label" style="margin-top:8px"><span>😊 Team morale</span><span><b>' + Math.round(morale) + '</b> / 100</span></div>' +
        '<div class="meter ' + tone(morale) + '"><i style="width:' + morale.toFixed(1) + '%"></i></div>' : '');
    return coCard('team', '👥 Team', int(num(m.staff)) + ' on payroll',
      '<p class="small muted" style="margin:-4px 0 8px">Hire for your bottleneck. New people start at 40% and ramp up. Payroll is paid every day.</p>' +
      (m.hireCap != null ? '<p class="small muted" style="margin:0 0 8px" data-key="hire-cap">🧲 Recruiting: <b>' + int(num(m.hiresLeft)) + '</b> of ' + int(num(m.hireCap)) + ' hires left for now' + (waitDays ? ', next opening in <b>' + waitDays + ' ' + plural(waitDays, 'day') + '</b>' : '') + ' (recruiting takes time: about a fifth of your team every two weeks)</p>' : '') +
      nextBox + '<div class="role-list">' + rows + '</div>' + warn + meters + upgGroup('team', '🙌 Team upgrades'));
  }

  /* ---- Playbooks (L4) ---- */
  function coPlaybooks() {
    var st = S.state, sops = obj(st.sops);
    var all = upgradesWhere(function (u) { return lateUpg(u) && upgHomeOf(u) === 'playbooks'; });
    var rows = SOPS.map(function (sp) {
      var rank = clamp(Math.floor(num(sops[sp.key])), 0, 3);
      var next = find(all, function (x) { return x.upgrade.sop === sp.key && num(x.upgrade.rank) === rank + 1 && !x.owned; });
      var right;
      if (rank >= 3) right = '<span class="chip green">Maxed ✓</span>';
      else if (!next) right = '<span class="chip grey">—</span>';
      else if (next.locked) right = '<span class="chip grey">🔒 ' + esc(next.reason || ('Lv ' + num(next.upgrade.minLevel, 4))) + '</span>';
      else {
        var cost = obj(next.upgrade.cost);
        right = '<button class="btn small ' + (next.affordable ? 'green' : 'white') + '" data-action="buy" data-id="' + esc(next.upgrade.id) + '"' + (next.affordable ? '' : ' disabled') + '>' +
          'Rank ' + (rank + 1) + '<small>' + money(num(cost.cash)) + (num(cost.energy) ? ' · ⚡' + int(cost.energy) : '') + '</small></button>';
      }
      return '<div class="sop-row" data-key="sop-' + sp.key + '"><span class="sop-e">' + sp.emoji + '</span>' +
        '<div class="sop-body"><b>' + sp.name + ' Playbook</b>' + pipRow(rank, 3) + '<span>' + esc(next && !next.locked && next.upgrade.desc ? next.upgrade.desc : sp.what()) + '</span></div>' + right + '</div>';
    }).join('');
    return coCard('playbooks', '📘 Playbooks', 'written steps your team follows',
      '<p class="small muted" style="margin:-4px 0 8px">Write it down once. Every hire after that learns it faster and does it the same way.</p>' + rows);
  }

  /* ---- Lead Squad (L4 fans + staff, L6 agencies + partners) ---- */
  function coSquad() {
    var st = S.state, m = obj(S.metrics), lvl = lvlNow();
    var sq = obj(st.squad), fans = obj(sq.fans), ag = obj(sq.agency), pa = obj(sq.partners);
    var agLv = tuning(['squadAgencyLevel'], 6), paLv = tuning(['squadPartnersLevel'], 6);
    var setters = Math.floor(num(get(st, 'team.setter')));
    var cap = adBudgetCap();
    var ret = Math.min(num(ag.retainer), cap);
    var pCost = tuning(['partnerCost'], 500), pEn = tuning(['partnerEnergy'], 10);
    var tile = function (cls, emoji, name, stat, ctrl, desc) {
      return '<div class="squad-tile ' + cls + '"><div class="st-top"><span class="st-e">' + emoji + '</span><b>' + name + '</b>' + (ctrl.toggle || '') + '</div>' +
        '<div class="st-stat">' + stat + '</div>' + (desc ? '<div class="st-desc">' + desc + '</div>' : '') + (ctrl.body || '') + '</div>';
    };
    var fanTile = tile(fans.on ? 'on' : '', '🙌', 'Fans',
      fans.on ? 'Referrals ×' + num(m.fanReferralMult, 2).toFixed(1) + ' · ' + money(fans.reward) + ' per referral sale' : 'Off. Happy customers could be sending friends.',
      { toggle: '<button class="toggle ' + (fans.on ? 'on' : '') + '" data-action="squad-fans" aria-label="Toggle fan referrals"></button>' },
      'Reward customers who bring friends. You pay only when a referral buys.');
    var staffTile = tile(setters > 0 ? 'on' : '', '🧑‍💼', 'Staff',
      setters > 0 ? int(setters) + ' ' + roleNameOf('setter', setters !== 1) + ' · ≈' + int(m.teamOutreach) + ' outreach/day' : 'No ' + roleNameOf('setter', true) + ' yet. Hire them in Team.',
      {}, 'People you pay to reach out for you, every single day.');
    var agTile = lvl >= agLv
      ? tile(ret > 0 ? 'on' : '', '🏢', 'Agency', money(ret) + '/day → ≈' + num(m.agencyLeads).toFixed(1) + ' leads/day',
        { body: '<input type="range" class="green" data-slider="agency" min="0" max="' + cap + '" step="' + (cap > 10000 ? 100 : 10) + '" value="' + Math.round(ret) + '" aria-label="Agency retainer per day">' +
          '<div class="range-ends"><span>$0</span><span>' + money(cap) + '/day</span></div>' },
        'Outside marketers on a daily retainer. Lots of leads, but colder ones (half the quality).')
      : tile('locked', '🏢', 'Agency', '🔒 Joins at Level ' + agLv, {}, '');
    var paTile = lvl >= paLv
      ? tile(num(pa.count) > 0 ? 'on' : '', '🤝', 'Partners', int(pa.count) + ' ' + plural(num(pa.count), 'partner') + ' → ≈' + num(m.partnerLeads).toFixed(1) + ' leads/day · ' + pct(num(pa.commission, 0.2)) + ' cut',
        { body: '<button class="btn small blue block" data-action="squad-partner"' + (num(st.cash) >= pCost ? '' : ' disabled') + '>🤝 Sign a partner<small>' + money(pCost) + ' · ⚡' + pEn + '</small></button>' },
        'Other businesses that already serve your buyers. Warm leads for a share of each sale.')
      : tile('locked', '🤝', 'Partners', '🔒 Join at Level ' + paLv, {}, '');
    return coCard('squad', '🫂 ' + esc(gl('leadSquad', 'Lead Squad')), squadActive() + ' / 4 working',
      '<p class="small muted" style="margin:-4px 0 8px">Your own hands only reach so far. These four bring leads while you run the company.</p>' +
      '<div class="squad-grid">' + fanTile + staffTile + agTile + paTile + '</div>' + upgGroup('squad', '🧰 Squad upgrades'));
  }

  /* ---- Niche focus (L5) ---- */
  function coFocus() {
    var st = S.state;
    var fv = clamp(num(st.focus), 0, 100), f = fv / 100;
    var leads = 1 - tuning(['focusLeadCut'], 0.45) * f, close = 1 + tuning(['focusClose'], 0.2) * f;
    var value = 1 + tuning(['focusValue'], 0.15) * f, churn = 1 - tuning(['focusChurnCut'], 0.35) * f;
    var deliv = 1 - tuning(['focusDeliveryCut'], 0.2) * f;
    var chip = function (emoji, label, x, goodUp) {
      var up = x >= 1;
      var good = goodUp ? up : !up;
      var cls = Math.abs(x - 1) < 0.005 ? '' : (good ? 'good' : 'bad');
      return '<div class="fp ' + cls + '"><span>' + emoji + ' ' + label + '</span><b>×' + x.toFixed(2) + (Math.abs(x - 1) < 0.005 ? '' : (up ? ' ▲' : ' ▼')) + '</b></div>';
    };
    var verdict = fv < 25 ? '🌍 Serving everyone: lots of leads, thin wallets, tired team.'
      : fv < 55 ? '🎯 Getting picky. Fewer leads, but they fit better.'
      : fv < 85 ? '🔥 Real niche: fewer leads, much more money per customer.'
      : '🔬 Laser niche. Watch that lead flow doesn\'t dry up.';
    return coCard('focus', '🎯 Niche focus', fv + '%',
      '<p class="small muted" style="margin:-4px 0 6px">Say no to customers who aren\'t a great fit. It feels scary, and it pays.</p>' +
      '<input type="range" class="orange" data-slider="focus" min="0" max="100" step="5" value="' + Math.round(fv) + '" aria-label="Niche focus">' +
      // Level 5's goal needs focus 60: mark it on the slider like the 40% tick on the delivery meter
      (lvlNow() === 5 ? '<div class="range-tick-row"><span class="tick-mark" style="left:60%">▲ goal 60</span></div>' : '') +
      '<div class="range-ends"><span>Everyone</span><span>One ideal customer</span></div>' +
      '<div class="focus-preview">' +
      chip('🙋', 'Leads', leads, true) + chip('🤝', 'Close rate', close, true) + chip('💎', 'Value', value, true) +
      chip('👋', 'Churn', churn, false) + chip('⚡', 'Delivery work', deliv, false) +
      '</div><div class="verdict small-verdict">' + verdict + '</div>');
  }

  /* ---- Product Lab (L6) ---- */
  function coProduct() {
    var st = S.state, m = obj(S.metrics), p = obj(st.premium), lvl = lvlNow();
    var pdC = obj(C().premiumDefaults);
    var pd = hasEng('premiumDefaults') ? obj(eng('premiumDefaults', C())) : {};
    var cost = hasEng('premiumCost') ? num(eng('premiumCost', st, C())) : num(pd.buildCost, num(pdC.buildCost, 6000)), days = num(pd.buildDays, num(pdC.buildDays, 21));
    var name = p.name || obj(pdC.nameByFlavor)[st.flavor] || pd.name || 'Premium product';
    var body;
    if (!p.built && !(num(p.buildDays) > 0)) {
      var afford = num(st.cash) >= cost;
      body = '<div class="lab-hero"><span class="lab-e">' + esc(pdC.emoji || '💎') + '</span><div><b>' + esc(name) + '</b><span>' + esc(pdC.desc || 'A bigger product for customers who already love you.') + '</span></div></div>' +
        '<button class="btn block ' + (afford ? '' : 'white') + '" data-action="premium-build"' + (afford ? '' : ' disabled') + '>🛠️ Build it · ' + money(cost) + ' · ' + int(days) + ' days</button>' +
        (!afford ? '<p class="small muted" style="margin-top:6px">💰 ' + money(Math.max(0, cost - num(st.cash))) + ' to go. Pause growth hires and big upgrades until it is built: it is your goal now.</p>' : '');
    } else if (!p.built) {
      var left = num(p.buildDays), done = clamp((days - left) / Math.max(1, days), 0, 1);
      body = '<div class="lab-hero"><span class="lab-e building">🛠️</span><div><b>Building ' + esc(name) + '</b><span>Ready in ' + int(left) + ' ' + plural(left, 'day') + '. Your team is on it.</span></div></div>' +
        '<div class="meter purple"><i style="width:' + (done * 100).toFixed(1) + '%"></i></div>';
    } else {
      var core = num(get(st, 'offer.price'));
      var worth = tuning(['premiumValueMult'], 3) * num(m.offerValue);
      var price = num(p.price);
      var max = Math.max(core * 10, worth * 2, 2000);
      if (price > max) max = price * 1.25;
      max = Math.ceil(max / 100) * 100;
      var fit = num(m.premiumFit, 1);
      var fitTxt = price <= 0 ? '🎁 Free? That\'s not a product, that\'s a gift.'
        : fit >= 1.25 ? '🤩 Bargain: lots will grab it (you may be leaving money on the table)'
        : fit >= 0.8 ? '😀 Fair price for what they get'
        : fit >= 0.4 ? '😐 Pricey: only a few will buy'
        : '😬 Way too pricey for its value';
      body = '<div class="lab-hero"><span class="lab-e">' + esc(pdC.emoji || '💎') + '</span><div><b>' + esc(name) + '</b><span>' + (p.on ? 'On sale to your customers' : 'Built, but switched off') + '</span></div>' +
        '<button class="toggle ' + (p.on ? 'on' : '') + '" data-action="premium-toggle" aria-label="Sell the premium product"></button></div>' +
        '<div class="price-big" style="font-size:28px">' + moneyFull(price) + '</div>' +
        '<input type="range" data-slider="premiumPrice" min="0" max="' + max + '" step="' + (max > 20000 ? 100 : 25) + '" value="' + Math.round(price) + '" aria-label="Premium price">' +
        '<div class="range-ends"><span>$0</span><span>Feels worth ~' + money(worth) + '</span><span>' + money(max) + '</span></div>' +
        '<div class="verdict small-verdict">' + fitTxt + '</div>' +
        '<div class="meter-label" style="margin-top:10px"><span>💎 Premium share of 30-day sales</span><span><b>' + pct(m.premiumShare30) + '</b></span></div>' +
        '<div class="meter purple"><i style="width:' + clamp(num(m.premiumShare30) * 100, 0, 100).toFixed(1) + '%"></i><span class="tick" style="left:20%"></span></div>';
    }
    return coCard('product', '💎 Product Lab', p.built ? money(m.premiumRevenue30) + ' in 30 days' : '',
      '<p class="small muted" style="margin:-4px 0 8px">' + esc(pdC.teaches || 'Your best next customer is one you already have.') + '</p>' + body + upgGroup('product', '🚀 Product upgrades'));
  }

  /* ---- Efficiency & projects (L7) ---- */
  function coOps() {
    var st = S.state, m = obj(S.metrics), cash = num(st.cash);
    var ops = obj(st.ops);
    var eff = clamp(num(m.efficiency, num(ops.efficiency, 80)), 0, 100);
    var weak = m.weakestMetric || null;
    var projects = lateList('projects');
    var run = ops.project && ops.project.id ? ops.project : null;
    var runDef = run ? find(projects, function (p) { return p.id === run.id; }) : null;
    var done = arr(ops.done);
    var runBox = '';
    if (run) {
      var tot = Math.max(1, num(obj(runDef).days, 10)), left = num(run.daysLeft);
      runBox = '<div class="run-box"><span class="rb-e">' + esc(obj(runDef).emoji || '🛠️') + '</span><div style="flex:1;min-width:0"><b>' + esc(obj(runDef).name || run.id) + '</b>' +
        '<span>' + int(left) + ' ' + plural(left, 'day') + ' left' + (runDef && runDef.metric && runDef.metric !== 'general' ? ' · fixes ' + esc(metricName(runDef.metric)) : '') + '</span>' +
        '<div class="meter purple" style="height:12px;margin-top:4px"><i style="width:' + (clamp((tot - left) / tot, 0, 1) * 100).toFixed(1) + '%"></i></div></div></div>';
    }
    var rows = projects.map(function (p) {
      var cost = hasEng('projectCost') ? num(eng('projectCost', st, C(), p.id), num(p.cost)) : num(p.cost, 10000);
      var general = !p.metric || p.metric === 'general';
      var isWeak = !general && p.metric === weak;
      var times = done.filter(function (d) { return d === p.id; }).length;
      var can = !run && cash >= cost;
      return '<div class="proj' + (isWeak ? ' weakest' : '') + (run && run.id === p.id ? ' running' : '') + '" data-key="proj-' + esc(p.id) + '">' +
        '<span class="pj-e">' + esc(p.emoji || '🛠️') + '</span>' +
        '<div class="pj-body"><b>' + esc(p.name || p.id) + '</b>' +
        '<div class="pj-chips">' + (general ? '<span class="chip">🏢 Any time</span>' : '<span class="chip ' + (isWeak ? 'red' : 'grey') + '">' + (isWeak ? '🎯 Weakest: ' : '') + esc(metricName(p.metric)) + '</span>') +
        '<span class="chip yellow">⏱ ' + int(p.days) + 'd</span>' + (times ? '<span class="chip green">✓ ×' + times + '</span>' : '') + '</div>' +
        (p.desc ? '<span class="pj-desc">' + esc(p.desc) + '</span>' : '') + '</div>' +
        '<button class="btn small ' + (can ? (isWeak ? 'green' : '') : 'white') + '" data-action="project" data-id="' + esc(p.id) + '"' + (can ? '' : ' disabled') + '>Start<small>' + money(cost) + '</small></button></div>';
    }).join('');
    // the project that fixes the weakest number, one tap away (the list below stays in its fixed order)
    var wp = weak && !run ? find(projects, function (p) { return p.metric === weak; }) : null, weakBtn = '';
    if (wp) {
      var wCost = hasEng('projectCost') ? num(eng('projectCost', st, C(), wp.id), num(wp.cost)) : num(wp.cost, 10000);
      weakBtn = '<button class="btn small block ' + (cash >= wCost ? 'green' : 'white') + '" data-action="project" data-id="' + esc(wp.id) + '"' + (cash >= wCost ? '' : ' disabled') + '>' +
        esc((wp.emoji ? wp.emoji + ' ' : '') + 'Start ' + (wp.name || wp.id)) + '<small>' + money(wCost) + '</small></button>';
    }
    return coCard('ops', '⚙️ Efficiency & projects', 'score ' + Math.round(eff),
      '<div class="meter-label"><span>⚙️ Efficiency</span><span><b>' + Math.round(eff) + '</b> / 100' + (num(m.bloatPerDay) > 0 ? ' · −' + num(m.bloatPerDay).toFixed(2) + '/day bloat' : '') + '</span></div>' +
      '<div class="meter ' + tone(eff) + '"><i style="width:' + eff.toFixed(1) + '%"></i><span class="tick" style="left:75%"></span></div>' +
      '<p class="small muted" style="margin-top:6px">More people means more bloat. Fix the <b>weakest</b> number first: full effect + 8 efficiency. Anything else only works half as well.</p>' +
      (weak ? '<div class="weak-pill">🎯 Weakest link right now: <b>' + esc(metricName(weak)) + '</b>' + weakBtn + '</div>' : '') +
      runBox +
      (rows ? '<div class="proj-list">' + rows + '</div>' : '<p class="empty-note">No projects in this build yet.</p>') +
      upgGroup('ops', '🤖 Systems upgrades'));
  }

  /* ---- Departments, fires, CEO attention (L8) ---- */
  function fireList() {
    var st = S.state;
    var types = lateList('fireTypes');
    return arr(st.fires).filter(function (f) { return f && f.uid; }).map(function (f) {
      var t = find(types, function (x) { return x.id === f.typeId; }) || {};
      return { f: f, t: t };
    });
  }
  function coDepts() {
    var st = S.state, m = obj(S.metrics), lvl = lvlNow();
    var depts = obj(st.depts), dh = obj(m.deptHealth);
    var left = Math.max(0, Math.floor(num(m.attentionLeft, num(get(st, 'attention.left'), 3))));
    var max = Math.max(1, Math.floor(num(m.attentionMax, num(get(st, 'attention.max'), 3))));
    var dots = '';
    for (var i = 0; i < max; i++) dots += '<i class="' + (i < left ? 'on' : '') + '">⚡</i>';
    var fires = fireList();
    var fireRows = fires.map(function (x) {
      var f = x.f, t = x.t, d = deptDef(f.dept);
      var imp = clamp(Math.round(num(f.impact, 1)), 1, 3);
      var flames = '';
      for (var k = 0; k < 3; k++) flames += '<i class="' + (k < imp ? 'on' : '') + '">🔥</i>';
      var daysLeft = num(f.daysLeft);
      return '<div class="fire-row imp' + imp + '" data-key="fire-' + esc(f.uid) + '">' +
        '<span class="fr-e">' + esc(f.emoji || t.emoji || '🔥') + '</span>' +
        '<div class="fr-body"><b>' + esc(f.title || t.title || 'Fire!') + '</b>' +
        '<div class="fr-chips"><span class="chip grey">' + esc((d.emoji || '') + ' ' + (d.name || f.dept)) + '</span><span class="flames" aria-label="Impact ' + imp + ' of 3">' + flames + '</span>' +
        '<span class="chip ' + (daysLeft <= 1 ? 'red' : 'yellow') + '">⏰ ' + int(daysLeft) + 'd</span></div>' +
        (t.desc ? '<span class="fr-desc">' + esc(t.desc) + '</span>' : '') + '</div>' +
        '<button class="btn small ' + (left > 0 ? (imp >= 3 ? 'red' : 'orange') : 'white') + '" data-action="handle-fire" data-id="' + esc(f.uid) + '"' + (left > 0 ? '' : ' disabled') + '>Handle<small>1 ⚡CEO</small></button></div>';
    }).join('');
    var spec = lvl >= 9;
    var bars = deptList().map(function (d) {
      var h = clamp(num(dh[d.id], num(get(depts, d.id + '.health'), 80)), 0, 100);
      var sp = Math.floor(num(get(depts, d.id + '.spec')));
      return '<div class="dept-row" data-key="dept-' + esc(d.id) + '"><span class="dr-name">' + esc((d.emoji || '') + ' ' + (d.name || d.id)) + (spec && sp ? ' ' + pipRow(sp, 3, 'mini') : '') + '</span>' +
        '<div class="meter ' + tone(h) + '"><i style="width:' + h.toFixed(1) + '%"></i></div><b>' + Math.round(h) + '</b></div>';
    }).join('');
    var crit = fires.filter(function (x) { return num(x.f.impact) >= 3; }).length;
    return coCard('depts', '🗂️ Departments & fires', fires.length ? '🔥 ' + fires.length + ' open' : '🧘 ' + int(num(m.calmDays, get(st, 'calmDays'))) + ' calm days',
      '<div class="attn"><div><b>CEO attention</b><span>Refills in ' + int(num(m.attentionRefillDays, 7)) + ' ' + plural(num(m.attentionRefillDays, 7), 'day') + '. Spend it on what matters.</span></div><div class="attn-dots" aria-label="' + left + ' of ' + max + ' attention left">' + dots + '</div></div>' +
      '<div class="fire-zone" data-key="fire-zone">' + (fires.length
        ? '<p class="small muted" style="margin:8px 0 6px">Big flames first. Loud isn\'t the same as important: small fires often burn out alone.' + (crit ? ' <b style="color:var(--danger-dark)">' + crit + ' big ' + plural(crit, 'one') + '!</b>' : '') + '</p>' +
          '<div class="fire-list">' + fireRows + '</div>'
        : '<div class="calm-box">🧘 No fires right now. ' + int(num(m.calmDays, get(st, 'calmDays'))) + ' calm ' + plural(num(m.calmDays, get(st, 'calmDays')), 'day') + ' in a row.</div>') + '</div>' +
      '<div class="co-sub"><span>❤️ Department health</span><span class="muted">lowest ' + Math.round(num(m.deptHealthMin, 80)) + '</span></div>' +
      '<div class="dept-list">' + bars + '</div>' + upgGroup('depts', '🛡️ Protection upgrades'), fires.length && crit ? 'on-fire' : '');
  }

  /* ---- Specialists (L9) ---- */
  function coSpecialists() {
    var st = S.state, m = obj(S.metrics), cash = num(st.cash), L = lateX();
    // specialist pay as the engine charges it: flavor pay scale × salary-cost boosts
    var payF = num(m.salaryCostMult, 1) * ((ZTE.Engine && typeof ZTE.Engine.payScale === 'function') ? num(ZTE.Engine.payScale(st, C()), 1) : 1);
    var rows = deptList().map(function (d) {
      var sp = clamp(Math.floor(num(get(st, 'depts.' + d.id + '.spec'))), 0, 3), next = sp + 1;
      var cost = 0;
      if (sp < 3) {
        if (typeof L.specCost === 'function') { try { cost = num(L.specCost(st, C(), d.id)); } catch (e) { cost = 0; } }
        if (!cost) cost = Array.isArray(d.specCost) ? lvVal(d.specCost, next, 40000) : num(d.specCost, 40000) * next;
      }
      var teamName = arr(d.specTeams)[sp] || ('Level ' + next + ' team');
      var can = sp < 3 && cash >= cost;
      var right = sp >= 3 ? '<span class="chip green">Full team ✓</span>'
        : '<button class="btn small ' + (can ? 'green' : 'white') + '" data-action="spec" data-id="' + esc(d.id) + '"' + (can ? '' : ' disabled') + '>Build<small>' + money(cost) + '</small></button>';
      return '<div class="spec-row" data-key="spec-' + esc(d.id) + '"><span class="sp-e">' + esc(d.emoji || '🏢') + '</span>' +
        '<div class="sp-body"><b>' + esc(d.name || d.id) + '</b>' + pipRow(sp, 3) +
        '<span>' + (sp >= 3 ? 'All three specialist teams in place.' : 'Next: ' + esc(teamName) + ' · +' + int(lvVal(d.specHeadcount, next, 5)) + ' people · +' + money(lvVal(d.specSalary, next, 800) * payF) + '/day') + '</span></div>' + right + '</div>';
    }).join('');
    return coCard('specialists', '🔬 Specialist teams', int(num(m.specialistDepts)) + ' / 6 departments at level 2+',
      '<p class="small muted" style="margin:-4px 0 8px">Nobody can know everything now. Give each department a team that does one thing very well.</p>' + rows);
  }

  /* ---- Big Bet (L10) ---- */
  function betOdds(b) {
    var m = obj(S.metrics), st = S.state;
    var ch = num(b.baseChance, 0.5);
    var items = arr(b.prep).filter(function (p) { return p && p.metric; }).map(function (p) {
      var cur = get(m, p.metric);
      if (cur == null) cur = get(st, p.metric);
      var met = num(cur) >= num(p.gte);
      if (met) ch += num(p.bonus);
      return { p: p, met: met };
    });
    return { chance: clamp(ch, 0, lateTuning('betChanceCap', 0.9)), items: items };
  }
  function coBet() {
    var st = S.state, cash = num(st.cash);
    var bets = lateList('bets');
    var flags = obj(st.flags);
    var body;
    if (st.bet && st.bet.id) {
      var b = obj(find(bets, function (x) { return x.id === st.bet.id; }));
      var tot = Math.max(1, num(b.days, 30)), left = num(st.bet.daysLeft);
      var o = betOdds(b);
      body = '<div class="run-box bet"><span class="rb-e">' + esc(b.emoji || '🎲') + '</span><div style="flex:1;min-width:0"><b>' + esc(b.name || st.bet.id) + '</b>' +
        '<span>Result in ' + int(left) + ' ' + plural(left, 'day') + ' · odds now ' + pct(o.chance) + '</span>' +
        '<div class="meter orange-m" style="height:12px;margin-top:4px"><i style="width:' + (clamp((tot - left) / tot, 0, 1) * 100).toFixed(1) + '%"></i></div></div></div>' +
        '<p class="small muted" style="margin-top:8px">Keep your prep numbers up until it lands: they still count.</p>';
    } else if (flags.betDone) {
      body = '<div class="calm-box ' + (flags.betWon ? 'won' : 'lost') + '">' + (flags.betWon ? '🎉 Your Big Bet paid off. Growth room is back.' : '😬 Your Big Bet missed. The core business still stands.') + '</div>';
    } else {
      var L = obj(ZTE.Engine && ZTE.Engine.late), keep = 0;
      if (typeof L.betKeep === 'function') { try { keep = num(L.betKeep(st, C())); } catch (e) { keep = 0; } }
      body = '<p class="small muted" style="margin:-4px 0 8px">One bet per run. Better prep, better odds. Pick the one your company is ready for.' +
        (keep > 0 ? ' Keep about ' + money(keep) + ' (a few days of costs) in the bank after paying for it, so a miss can\'t sink the core business.' : '') + '</p>' +
        '<div class="bet-list">' + bets.map(function (b) {
          var o = betOdds(b), cost = num(b.cost, 300000), can = cash >= cost + keep, armed = isArmed('bet-' + b.id);
          var prep = o.items.map(function (x) {
            return '<li class="' + (x.met ? 'met' : '') + '">' + (x.met ? '✅' : '⬜') + ' ' + esc(x.p.label || (x.p.metric + ' ≥ ' + x.p.gte)) + ' <em>+' + Math.round(num(x.p.bonus) * 100) + '%</em></li>';
          }).join('');
          return '<div class="bet-card" data-key="bet-' + esc(b.id) + '"><div class="bc-top"><span class="bc-e">' + esc(b.emoji || '🎲') + '</span>' +
            '<div style="flex:1;min-width:0"><b>' + esc(b.name || b.id) + '</b><span>' + money(cost) + ' · ' + int(b.days) + ' days</span></div>' +
            '<div class="odds"><b>' + pct(o.chance) + '</b><span>odds</span></div></div>' +
            (b.desc ? '<p class="small" style="margin-top:6px">' + esc(b.desc) + '</p>' : '') +
            (prep ? '<ul class="prep-list">' + prep + '</ul>' : '') +
            '<button class="btn block small ' + (can ? (armed ? 'red' : 'orange') : 'white') + '" data-action="bet" data-id="' + esc(b.id) + '"' + (can ? '' : ' disabled') + '>' +
            (armed ? 'Tap again to bet ' + money(cost) : (can ? '🎲 Place this bet' : 'Need ' + money(cost + keep) + ' in the bank')) + '</button></div>';
        }).join('') + '</div>';
      if (!bets.length) body = '<p class="empty-note">No bets in this build yet.</p>';
    }
    return coCard('bet', '🎲 The Big Bet', flags.betDone ? (flags.betWon ? 'won' : 'lost') : (st.bet ? 'running' : 'one per run'), body);
  }

  /* ---- Valuation + Sell at The Summit (L10) ---- */
  function coValuation() {
    var v = valuationNow() || {};
    var m = obj(S.metrics);
    var val = num(v.valuation, num(m.valuation));
    var target = 50000000;
    var gi = find(arr(get(levelDef(10), 'goal.items')), function (it) { return it && it.path === 'metrics.valuation'; });
    if (gi) target = num(gi.target, target);
    var goal = eng('getGoal', S.state, C());
    var met = goal && num(goal.progress) >= 0.9999;
    var rows = arr(v.factors).filter(function (f) { return f && f.label && f.label !== 'Annual profit' && f.label !== 'Multiple'; }).map(function (f) {
      return '<div class="factor-row"><div><b>' + esc(f.label) + '</b><span>' + esc(f.note || '') + '</span></div><em>+' + num(f.value).toFixed(2) + '×</em></div>';
    }).join('');
    var sold = isSold();
    return coCard('valuation', '💰 Company value', num(v.multiple) ? num(v.multiple).toFixed(1) + '× profit' : '',
      '<div class="val-big">' + moneyFull(val) + '</div>' +
      '<p class="small muted center">' + money(v.annualProfit) + ' yearly profit × ' + num(v.multiple).toFixed(2) + ' multiple</p>' +
      '<div class="meter green" style="margin-top:8px"><i style="width:' + clamp(val / target * 100, 0, 100).toFixed(1) + '%"></i></div>' +
      '<div class="range-ends" style="margin-top:2px"><span>$0</span><span>Goal ' + money(target) + '</span></div>' +
      (rows ? '<div class="co-sub"><span>📐 What raises the multiple</span></div><div class="factor-list">' + rows + '</div>' : '') +
      (sold ? '' : '<button class="btn block summit-btn ' + (met ? 'green pulse' : '') + '" data-action="sell"' + (val > 0 ? '' : ' disabled') + '>🏔️ Sell at ' + esc(gl('summit', 'The Summit')) + (val > 0 ? ' · ' + money(val) : '') + '</button>' +
        '<p class="small muted center" style="margin-top:6px">' + (val > 0 ? (met ? 'Goal reached. Sell now or keep pushing the price up.' : 'You can sell any time in Level 10. Hit the goal first for a better ending.') : 'No profit, no buyer. Get profitable first.') + '</p>'),
      met && !sold ? 'tinted-green' : '');
  }

  /* ---- what unlocks next ---- */
  function coNext() {
    var lvl = lvlNow();
    if (lvl >= 10 || isSold()) return '';
    var notes = unlockNotes(lvl + 1);
    var d = obj(levelDef(lvl + 1));
    if (!notes.length) return '';
    return '<section class="card co-next" data-key="co-next"><div class="card-title"><h3>🔒 Level ' + (lvl + 1) + ': ' + esc(d.name || '') + '</h3><span class="sub">coming up</span></div>' +
      '<ul class="unlock-list soon">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section>';
  }

  // the system each level adds; it sits right under the summary while that level is current
  var CO_NEWEST = { 5: 'focus', 6: 'product', 7: 'ops', 8: 'depts', 9: 'specialists' };
  TABS.company = function () {
    var lvl = lvlNow();
    if (lvl < COMPANY_LEVEL) return '<section class="card"><p class="empty-note">The Company opens at Level ' + COMPANY_LEVEL + '. Keep hustling! 💪</p></section>';
    var nFires = lvl >= 8 ? arr(get(S.state, 'fires')).length : 0;
    // The order only changes on level-up, never mid-level: a section that jumps while the player
    // drags a slider or taps a button would swap the nodes under their finger.
    var secs = [];
    if (lvl >= 10) { secs.push({ id: 'valuation', html: coValuation(), chip: '💰 Value' }); secs.push({ id: 'bet', html: coBet(), chip: '🎲 Bet' }); }
    secs.push({ id: 'team', html: coTeam(), chip: '👥 Team' });
    secs.push({ id: 'playbooks', html: coPlaybooks(), chip: '📘 Playbooks' });
    secs.push({ id: 'squad', html: coSquad(), chip: '🫂 Squad' });
    if (lvl >= 5) secs.push({ id: 'focus', html: coFocus(), chip: '🎯 Focus' });
    if (lvl >= 6) secs.push({ id: 'product', html: coProduct(), chip: '💎 Product' });
    if (lvl >= 7) secs.push({ id: 'ops', html: coOps(), chip: '⚙️ Ops' });
    if (lvl >= 8) secs.push({ id: 'depts', html: coDepts(), chip: nFires ? '🔥 ' + nFires + ' ' + plural(nFires, 'fire') : '🗂️ Depts', hot: nFires > 0 });
    if (lvl >= 9) secs.push({ id: 'specialists', html: coSpecialists(), chip: '🔬 Specialists' });
    var newest = CO_NEWEST[lvl];
    var ni = -1;
    for (var i = 0; i < secs.length; i++) if (secs[i].id === newest) ni = i;
    if (ni > 0) { var nw = secs.splice(ni, 1)[0]; nw.chip += ' ✨'; secs.unshift(nw); }
    secs = secs.filter(function (x) { return x.html; });
    var nav = secs.length > 2 ? '<nav class="co-nav" data-key="co-nav" aria-label="Jump to a section">' + secs.map(function (x) {
      return '<button class="chip' + (x.hot ? ' red' : '') + '" data-action="co-jump" data-id="' + x.id + '" data-key="nav-' + x.id + '">' + esc(x.chip) + '</button>';
    }).join('') + '</nav>' : '';
    var parts = [coSummary(), nav].concat(secs.map(function (x) { return x.html; }));
    var more = upgGroup('more', '');
    if (more) parts.push('<section class="card" data-key="co-more"><div class="card-title"><h3>🧰 More company upgrades</h3></div>' + more + '</section>');
    parts.push(coNext());
    return parts.join('');
  };

  function squadActive() {
    var st = S.state;
    return (get(st, 'squad.fans.on') ? 1 : 0) + (num(get(st, 'team.setter')) > 0 ? 1 : 0) +
      (num(get(st, 'squad.agency.retainer')) > 0 && lvlNow() >= 6 ? 1 : 0) + (num(get(st, 'squad.partners.count')) > 0 ? 1 : 0);
  }

  function visiblePlanKeys() {
    var st = S.state;
    return PLAN_KEYS.filter(function (pk) {
      if (pk.key === 'sales' || pk.key === 'warm') return true;
      return !!get(st, 'channels.' + pk.key + '.unlocked');
    });
  }

  // Ad slider max: metrics.adCap from the engine when present (it lifts after client-financed
  // acquisition); otherwise TUNING, otherwise $50/day before and $2,000/day after.
  function adBudgetCap() {
    var st = S.state, m = obj(S.metrics);
    var cap = num(m.adCap, 0);
    // SPEC-LATE §3.5: from Level 4 the client-financed cap rises to $60,000/day
    if (cap > 0) return Math.min(cap, lvlNow() >= COMPANY_LEVEL ? 60000 : 5000);
    var free = !!m.clientFinanced || !!get(st, 'flags.clientFinanced');
    if (free) return Math.min(5000, tuning(['adCapAfterCF', 'adBudgetMax'], 2000));
    return tuning(['adCapBeforeCF', 'adBudgetCap'], 50);
  }

  /* ================================================================== */
  /* Rendering                                                           */
  /* ================================================================== */
  function cacheEls() {
    var id = function (x) { return document.getElementById(x); };
    S.els = {
      day: id('tb-day'), dayProg: id('tb-dayprog'), levelEmoji: id('tb-level-emoji'), levelName: id('tb-level-name'),
      cash: id('tb-cash'), cashWrap: id('tb-cash-wrap'), energyFill: id('tb-energy-fill'), energyText: id('tb-energy-text'),
      sound: id('tb-sound'), owl: id('owl-btn'), goalText: id('goal-text'), goalPct: id('goal-pct'), goalFill: id('goal-fill'),
      goalItems: id('goal-items'), bubble: id('coach-bubble'), main: id('main'), tabRoot: id('tab-root'),
      tabbar: id('tabbar'), nbBadge: id('nb-badge'), toasts: id('toast-root'), modal: id('modal-root'),
      coTab: document.querySelector('.tab-btn[data-tab="company"]'), coBadge: id('co-badge'), hc: id('goal-hc'), crunch: id('goal-crunch'),
      speed8: document.querySelector('.speed-btn[data-speed="8"]'), speedCycle: id('speed-cycle')
    };
  }

  function scheduleRefresh() { S.needsRefresh = true; }

  function refresh(freshTab) {
    S.needsRefresh = false;
    S.cache = {};
    var st = S.state;
    S.metrics = st ? eng('computeMetrics', st, C()) : null;
    syncToday();
    updateTop();
    updateGoal();
    renderTab(!!freshTab);
    updateTabbar();
  }

  /** The engine's advice for this refresh (price hint, ad step, next hire, what to save for); cached per refresh. */
  function adviceNow() {
    if (!S.state || !hasEng('advice')) return {};
    if (!S.cache) S.cache = {};
    if (!S.cache.adv) S.cache.adv = eng('advice', S.state, C(), S.metrics) || {};
    return obj(S.cache.adv);
  }
  function syncToday() {
    var d = num(get(S.state, 'day'), -1);
    if (S.today.day !== d) S.today = { day: d, leads: 0, calls: 0, sales: 0 };
  }

  function updateTop() {
    var st = S.state, E = S.els;
    if (!st || !E.day) return;
    E.day.textContent = int(st.day);
    var lvl = num(st.level, 1);
    var def = levelDef(lvl);
    if (isSold()) {
      E.levelEmoji.textContent = '🏔️';
      E.levelName.textContent = 'Sold!';
    } else if (st.graduated || !def) {
      E.levelEmoji.textContent = '🎓';
      E.levelName.textContent = 'Graduate';
    } else {
      E.levelEmoji.textContent = def.emoji || '⭐';
      E.levelName.textContent = def.name || ('Level ' + lvl);
    }
    var fast = lvl >= FAST_LEVEL;
    if (document.body) document.body.classList.toggle('late', fast);
    if (!fast && num(st.speed) > 4) st.speed = 4;   // e.g. rewound below Level 4
    var cash = num(st.cash);
    if (ZTE.FX && ZTE.FX.countUp) ZTE.FX.countUp(E.cash, cash, money, 650);
    else E.cash.textContent = money(cash);
    E.cashWrap.classList.toggle('neg', cash < 0);
    // Level 4+ grace period: keep the countdown on screen while cash is below $0
    if (E.crunch) {
      var showCr = cash < 0 && num(st.level, 1) >= COMPANY_LEVEL && !st.gameOver && !isSold();
      E.crunch.hidden = !showCr;
      if (showCr) {
        var ci1 = creditInfo();
        var crHtml = ci1.past ? '⚠️ Past your credit line: <b>' + int(ci1.left) + ' ' + plural(ci1.left, 'day') + '</b> to get back inside it. Tap for help.'
          : '💳 On credit: <b>' + money(ci1.used) + '</b> of ' + money(ci1.line) + ' used. Tap for help.';
        if (E.crunch._html !== crHtml) { E.crunch.innerHTML = crHtml; E.crunch._html = crHtml; }
      }
    }
    var mx = num(get(st, 'energy.max'), 100), cur = num(get(st, 'energy.current'));
    var cap = mx + (get(st, 'energy.overtimeToday') ? overtimeEnergy() : 0);
    E.energyFill.style.width = clamp(cur / Math.max(1, cap) * 100, 0, 100).toFixed(1) + '%';
    E.energyText.textContent = int(Math.floor(cur)) + '/' + int(mx);
    var sp = num(st.speed, 1);
    var btns = document.querySelectorAll('.speed-btn');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].hasAttribute('data-speed')) btns[i].classList.toggle('on', num(btns[i].getAttribute('data-speed')) === sp);
    }
    if (E.speed8) E.speed8.hidden = !fast;
    if (E.speedCycle) {
      E.speedCycle.textContent = sp > 0 ? sp + '×' : '▶';
      E.speedCycle.classList.toggle('on', sp > 0);
      E.speedCycle.setAttribute('aria-label', sp > 0 ? 'Speed ' + sp + '×, tap to change' : 'Play');
    }
    E.sound.textContent = fx('isMuted') ? '🔇' : '🔊';
  }

  function goalFmt(it, v) {
    var f = it.format;
    var tgt = num(it.target);
    if (f === 'percent') return pct(v);
    if (f === 'money' || (!f && tgt >= 1000)) return money(v);
    return int(v);
  }

  function updateGoal() {
    var st = S.state, E = S.els;
    if (!E.goalText) return;
    var lvlH = num(get(st, 'level'), 1);
    if (E.hc) {
      var showHc = !!st && lvlH >= COMPANY_LEVEL;
      E.hc.hidden = !showHc;
      if (showHc) {
        var hc = '👥 ' + int(get(S.metrics, 'headcount') != null ? get(S.metrics, 'headcount') : 1);
        if (E.hc.textContent !== hc) E.hc.textContent = hc;
      }
    }
    if (!st) { E.goalText.textContent = 'Pick a business to start!'; E.goalPct.textContent = ''; E.goalFill.style.width = '0%'; E.goalItems.innerHTML = ''; E.goalItems._html = ''; return; }
    if (isSold()) {
      E.goalText.textContent = 'Sold at ' + gl('summit', 'The Summit') + ' for ' + money(get(st, 'exit.valuation')) + '!';
      E.goalPct.textContent = '🏔️';
      E.goalFill.style.width = '100%';
      var sh = '<button class="goal-cta" data-action="ngplus">🌟 Start New Game+</button>';
      if (E.goalItems._html !== sh) { E.goalItems.innerHTML = sh; E.goalItems._html = sh; }
      var gb = document.getElementById('goal-best'); if (gb) gb.hidden = true;
      return;
    }
    var g = !st.graduated ? eng('getGoal', st, C()) : null;
    if (!g || typeof g !== 'object' || !arr(g.items).length) {
      var done = !!st.graduated;
      E.goalText.textContent = done ? 'Every level in this build: beaten!' : 'Keep hustling!';
      E.goalPct.textContent = done ? '🎓' : '';
      E.goalFill.style.width = done ? '100%' : '0%';
      var dh = done ? '<span>Sandbox mode: keep growing!</span>' : '';
      if (E.goalItems._html !== dh) { E.goalItems.innerHTML = dh; E.goalItems._html = dh; }
      return;
    }
    var p = num(g.progress);
    if (p > 1.0001) p /= 100;   // SPEC-GAP: progress assumed 0..1; tolerate 0..100
    p = clamp(p, 0, 1);
    E.goalText.textContent = String(g.text || 'Goal');
    E.goalPct.textContent = Math.round(p * 100) + '%';
    E.goalFill.style.width = (p * 100).toFixed(1) + '%';
    // rolling goals (sales over the last 30 days) can drop as old days leave the window
    var lvl = num(st.level, 1);
    var defItems = arr(get(levelDef(lvl), 'goal.items')).filter(function (x) { return x && x.path; });
    var rolling = false, rollHint = '';
    var html = arr(g.items).map(function (it, idx) {
      it = obj(it);
      var cur = num(it.current), tgt = num(it.target);
      var ok, val;
      if (it.lte) {
        // "at most" goals (SPEC-LATE §5): done when current ≤ target
        ok = cur <= tgt;
        val = goalFmt(it, cur) + ' / ≤' + goalFmt(it, tgt);
      } else {
        ok = tgt > 0 && cur >= tgt;
        val = goalFmt(it, Math.min(cur, tgt)) + ' / ' + goalFmt(it, tgt);
      }
      if (obj(defItems[idx]).path === 'metrics.revenue30') {
        rolling = true;
        var off = rollOff(3);
        if (!ok && off >= Math.max(1, tgt * 0.04)) rollHint = '<span class="roll-hint">−' + money(off) + ' rolls off by Day ' + int(num(st.day) + 3) + ', keep sales coming</span>';
      }
      return '<span class="' + (ok ? 'done' : '') + '">' + (ok ? '✅ ' : '') + esc(it.label || '') + ' <b>' + val + '</b></span>';
    }).join('') + rollHint;
    // Level 10 never auto-levels: selling at The Summit is the finish line (open any time in L10)
    if (lvl >= 10 && hasEng('sellCompany')) html += '<button class="goal-cta' + (p >= 0.9999 ? ' ready' : '') + '" data-action="sell">🏔️ ' + (p >= 0.9999 ? 'Sell at ' + esc(gl('summit', 'The Summit')) + '!' : 'Sell early') + '</button>';
    if (E.goalItems._html !== html) { E.goalItems.innerHTML = html; E.goalItems._html = html; }
    // best-so-far marker, so a dip reads as "below your best" rather than "broken"
    var bestEl = document.getElementById('goal-best');
    if (bestEl) {
      var best = 0;
      if (rolling) {
        S.ui.best = obj(S.ui.best);
        best = Math.max(num(S.ui.best[lvl]), p);
        if (best > num(S.ui.best[lvl]) + 0.005) S.ui.best[lvl] = Math.round(best * 1000) / 1000;
      }
      var showBest = rolling && best > p + 0.02;
      bestEl.hidden = !showBest;
      if (showBest) { bestEl.style.left = (best * 100).toFixed(1) + '%'; bestEl.title = 'Your best: ' + Math.round(best * 100) + '%'; }
    }
  }

  /** Revenue in the days that leave the 30-day window over the next `k` days. */
  function rollOff(k) {
    var d = arr(get(S.state, 'stats.daily')), n = d.length, sum = 0;
    for (var i = Math.max(0, n - 30); i <= n - 31 + k; i++) sum += num(obj(d[i]).revenue);
    return sum;
  }

  function renderTab(fresh) {
    var rootEl = S.els.tabRoot;
    if (!rootEl) return;
    if (!S.state) { rootEl.innerHTML = ''; return; }
    if (S.tab === 'company' && lvlNow() < COMPANY_LEVEL) { S.tab = 'hustle'; fresh = true; updateTabbar(); }
    var fn = TABS[S.tab] || TABS.hustle;
    var html = '';
    try { html = fn(); } catch (e) {
      if (root.console) console.error('[ZTE] tab render failed', e);
      html = '<section class="card"><p class="empty-note">This tab hit a snag. Try another one. 🛠️</p></section>';
    }
    if (isSold()) html = lockSold(html);
    if (fresh) {
      rootEl.innerHTML = html;
      rootEl.classList.remove('tab-enter');
      void rootEl.offsetWidth;
      rootEl.classList.add('tab-enter');
      clearTimeout(S.enterTimer);
      S.enterTimer = setTimeout(function () { rootEl.classList.remove('tab-enter'); }, 700);
    } else {
      morph(rootEl, html);
    }
  }

  function updateTabbar() {
    var btns = S.els.tabbar ? S.els.tabbar.querySelectorAll('.tab-btn') : [];
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-tab') === S.tab;
      btns[i].classList.toggle('on', on);
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (S.els.nbBadge) S.els.nbBadge.hidden = !S.newLessons;
    // Company tab (Level 4+) + fire badge while fires are open
    var coOn = !!S.state && lvlNow() >= COMPANY_LEVEL;
    if (S.els.coTab) S.els.coTab.hidden = !coOn;
    if (S.els.tabbar) S.els.tabbar.classList.toggle('six', coOn);
    if (S.els.coBadge) {
      var nf = coOn ? arr(get(S.state, 'fires')).length : 0;
      S.els.coBadge.hidden = nf < 1;
      var bt = '🔥' + (nf > 1 ? nf : '');
      if (nf && S.els.coBadge.textContent !== bt) S.els.coBadge.textContent = bt;
    }
  }

  function setTab(t) {
    if (!TABS[t]) return;
    if (t === 'company' && (!S.state || lvlNow() < COMPANY_LEVEL)) t = 'hustle';
    var same = S.tab === t;
    S.tab = t;
    if (t === 'notebook') S.newLessons = false;
    if (!same && S.els.main) window.scrollTo(0, 0);
    S.cache = {};
    updateTabbar();
    renderTab(!same);
  }

  /* ================================================================== */
  /* Events from the engine → juice                                      */
  /* ================================================================== */
  function handleEvents(events, opts) {
    opts = opts || {};
    events = arr(events);
    if (!events.length) return;
    var quiet = !!opts.quiet;
    var leads = 0, replies = 0, cash = 0, sales = 0, trials = 0, refunds = 0, calls = 0;
    syncToday();
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || !ev.type) continue;
      switch (ev.type) {
        case 'lead': leads += Math.max(1, Math.round(num(ev.amount, 1))); break;
        case 'reply': replies += 1; break;
        case 'call': calls += Math.max(1, Math.round(num(ev.amount, 1))); break;
        case 'sale': sales += 1; cash += num(ev.amount); break;
        case 'trial': trials += 1; break;
        case 'testimonial': if (!quiet) toast(ev.text || 'New testimonial!', 'good', '⭐'); break;
        case 'refund': refunds += Math.abs(num(ev.amount)); break;
        case 'churn': break;
        case 'levelUp': onLevelUp(ev); break;
        case 'graduated': if (!isSold()) openGraduated(); break;   // a Summit sale shows its own finale
        case 'fire': onFire(ev, quiet); break;
        case 'bet': onBet(ev); break;
        case 'exit': onExit(ev); break;
        case 'gameOver': openModal('gameOver', {}, { front: true }); break;
        case 'achievement': onAchievement(ev, quiet); break;
        case 'notebook': onNotebook(ev, quiet); break;
        case 'coach': if (!quiet && ev.text) showBubble(ev.text); break;
        case 'event': if (!quiet) onRandomEvent(ev); break;
        case 'burnout': if (!quiet) toast(ev.text || 'Burnout! You need rest.', 'warn', '🥵'); break;
        case 'info': if (!quiet && ev.text) toast(ev.text, '', '💡'); break;
        default: break;
      }
    }
    S.today.leads += leads;
    S.today.calls += calls;
    S.today.sales += sales + trials;
    if (quiet) return;

    var anchorEl = opts.anchor || document.getElementById('funnel-card') || S.els.main;
    var a = rectOf(anchorEl);
    if (sales > 0) {
      fx('sound', 'coin');
      fx('haptic', [12, 40, 12]);
      var cr = rectOf(S.els.cashWrap);
      fx('confetti', a.x, a.y, { count: Math.min(24 + sales * 8, 80), power: 10 });
      if (cash > 0) fx('pop', '+' + money(cash), cr.x, cr.y + 18, { kind: 'cash', big: cash >= 1000 });
      fx('pop', sales > 1 ? '+' + sales + ' sales! 💰' : (cash > 0 ? 'Sale! 💰' : '+1 customer 😊'), a.x, a.y - 20, { kind: 'cash', big: true });
      fx('animate', S.els.cashWrap, 'pop');
    }
    if (trials > 0) {
      fx('pop', '+' + trials + ' free ' + plural(trials, 'trial') + ' 🎁', a.x, a.y, { kind: 'lead' });
      if (!sales) fx('sound', 'good');
    }
    if (leads > 0) {
      fx('pop', '+' + leads + ' ' + plural(leads, 'lead') + ' 🙋', a.x, a.y + 10, { kind: 'lead' });
      if (!sales && !trials) fx('sound', 'pop');
    } else if (replies > 0) {
      fx('pop', '💬 reply!', a.x, a.y + 10, { kind: 'lead' });
      if (!sales && !trials) fx('sound', 'pop');
    }
    if (refunds > 0) {
      var rr = rectOf(S.els.cashWrap);
      fx('pop', '-' + money(refunds) + ' refund', rr.x, rr.y + 18, { kind: 'bad' });
    }
  }

  function onLevelUp(ev) {
    var lvl = num(ev.level, num(get(S.state, 'level'), 1));
    // a level the content can't load is handled by the engine's 'graduated' event
    if (!levelDef(lvl) || obj(levelDef(lvl)).locked) return;
    if (modalQueued('levelUp', function (d) { return d.level === lvl; })) return;
    openModal('levelUp', { level: lvl });
    var def = levelDef(lvl);
    if (def && arr(def.intro).length) openModal('coach', { lines: def.intro.slice(), i: 0 });
  }

  /* fires (L8+): toast only for the big ones; the Company tab badge shows every open fire */
  function onFire(ev, quiet) {
    updateTabbar();
    if (quiet) return;
    var imp = num(ev.impact, 1);
    if (ev.burned) {
      if (imp >= 2) { toast(ev.text || 'A fire burned out of control.', 'error', '', 3600); fx('sound', 'bad'); }
      return;
    }
    var badge = S.els.coBadge;
    if (badge && !badge.hidden) fx('animate', badge, 'pop');
    if (imp >= 3) {
      toast((ev.text || 'A big fire just started!') + ' Handle it on the Company tab.', 'error', '', 4200);
      fx('sound', 'bad');
      fx('haptic', [40, 30, 40]);
    }
  }

  function onBet(ev) {
    if (modalQueued('bet', function (d) { return d.id === ev.id; })) return;
    openModal('bet', { id: ev.id, won: !!ev.won, chance: ev.chance, text: ev.text || '' });
  }

  function onExit(ev) {
    claimWisdom();
    if (S.summitShown || modalQueued('summit')) return;
    S.summitShown = true;
    openModal('summit', { valuation: num(ev.amount), score: ev.score, factors: ev.factors || null }, { front: true });
  }

  function openGraduated() {
    if (S.gradShown) return;
    S.gradShown = true;
    openModal('graduated', {});
  }

  function onAchievement(ev, quiet) {
    var d = obj(achDef(ev.id));
    if (quiet) return;
    toast((d.name || ev.text || 'Achievement unlocked!') + (d.desc ? ' · ' + d.desc : ''), 'achv', d.emoji || '🏆');
    fx('sound', 'good');
    var r = rectOf(S.els.toasts);
    fx('confetti', r.x, r.y + 20, { count: 30, power: 8, spread: Math.PI * 2 });
  }

  // Engine event text already starts with the event emoji; prefer the content def so the toast
  // shows the emoji once (in the badge) instead of twice.
  function onRandomEvent(ev) {
    var d = find(C().events, function (x) { return x.id === ev.id; });
    if (d && d.text) toast(d.text, '', d.emoji || '⚡');
    else toast(ev.text, '', ev.emoji || '⚡');
  }

  function onNotebook(ev, quiet) {
    S.newLessons = S.tab !== 'notebook';
    updateTabbar();
    if (quiet) return;
    var n = obj(nbDef(ev.id));
    toast('New lesson: ' + (n.term || n.title || ev.text || 'check your notebook'), 'lesson', n.emoji || '📓');
    var badge = S.els.nbBadge;
    if (badge && !badge.hidden) fx('animate', badge, 'pop');
  }

  /* ================================================================== */
  /* Actions                                                             */
  /* ================================================================== */
  function doReach(btn) {
    var st = S.state;
    if (!st || st.gameOver) return;
    if (S.channel === 'warm' && friendsLeft() < 1 && num(get(st, 'energy.current')) >= 1) {
      // explain the empty friends list instead of the engine's generic refusal
      var coldOn = !!get(st, 'channels.cold.unlocked');
      S.combo = 0;
      S.lastTap = 0;
      fx('sound', 'error');
      fx('animate', btn, 'shake');
      toast(coldOn ? 'Every friend has heard from you today. Switch to ' + chDef('cold').name + ' up top!'
        : 'Every friend has heard from you today. More free up tomorrow, and ' + chDef('cold').name + ' unlock at Level ' + chDef('cold').unlockLevel + '.', 'warn', '👋');
      scheduleRefresh();
      return;
    }
    var t = Date.now();
    S.combo = (t - S.lastTap <= COMBO_WINDOW) ? S.combo + 1 : 0;
    S.lastTap = t;
    var res = eng('tap', st, C(), S.channel, S.combo);
    if (!res) return;
    if (!res.ok) {
      S.combo = 0;
      S.lastTap = 0;
      fx('sound', 'error');
      fx('haptic', [30, 30, 30]);
      fx('animate', btn, 'shake');
      toast(res.reason || 'Out of energy! Wait for tomorrow or try Overtime.', 'warn', '😮‍💨');
      scheduleRefresh();
      return;
    }
    fx('sound', 'tap', S.combo);
    fx('haptic', 10);
    var evs = arr(res.events);
    var hasJuice = evs.some(function (e) { return e && (e.type === 'lead' || e.type === 'reply' || e.type === 'sale' || e.type === 'trial'); });
    var r = rectOf(btn);
    if (!hasJuice) fx('pop', chDef(S.channel).emoji, r.x, r.y - 30, { kind: 'info' });
    var cc = S.combo + 1;
    if (cc >= 3 && cc % 5 === 0) fx('pop', 'x' + cc + '!', r.x + 60, r.y - 60, { kind: 'energy', big: cc >= 10 });
    handleEvents(evs, { anchor: btn });
    var fill = document.getElementById('combo-fill');
    if (fill && fill.animate) {
      try { fill.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: COMBO_WINDOW, easing: 'linear', fill: 'forwards' }); } catch (e) { /* ignore */ }
    }
    clearTimeout(S.comboTimer);
    S.comboTimer = setTimeout(function () { if (S.tab === 'hustle') scheduleRefresh(); }, COMBO_WINDOW + 40);
    refresh(false);
  }

  function doOvertime(btn) {
    var res = eng('overtime', S.state, C());
    if (!res) return;
    if (res.ok) {
      fx('sound', 'good');
      fx('haptic', 20);
      fx('popAt', document.querySelector('.energy-bar'), '+' + overtimeEnergy() + '⚡', { kind: 'energy', big: true });
      toast('Extra energy today. Watch that burnout!', 'warn', '😤');
    } else {
      fx('sound', 'error');
      fx('animate', btn, 'shake');
      toast(res.reason || 'Not today.', 'warn', '🙅');
    }
    refresh(false);
  }

  function doPost(btn) {
    var res = eng('postContent', S.state, C());
    if (!res) return;
    if (res.ok) {
      fx('sound', 'whoosh');
      fx('popAt', btn, 'Posted! 📲', { kind: 'lead' });
      handleEvents(res.events, { anchor: btn });
    } else {
      fx('sound', 'error');
      fx('animate', btn, 'shake');
      toast(res.reason || 'Can\'t post right now.', 'warn', '🙅');
    }
    refresh(false);
  }

  function doBuy(btn, id) {
    if (!S.state || isSold()) return;
    // second tap of a double tap: whatever card is under the finger now was not the one aimed at
    if (S.lastBuyAt && S.pressAt > S.lastBuyAt && S.pressAt - S.lastBuyAt < BUY_TAP_GUARD) return;
    var ucost = num(get(upgDef(id), 'cost.cash'));
    if (ucost > 0 && num(get(S.state, 'cash')) >= ucost && !cashSure('buy-' + id, ucost, 0, 'this upgrade')) return;
    var res = eng('buyUpgrade', S.state, C(), id);
    if (!res) return;
    if (res.ok) {
      S.lastBuyAt = Date.now();
      var u = obj(upgDef(id));
      fx('sound', 'coin');
      fx('haptic', [10, 30, 10]);
      var r = rectOf(btn);
      fx('confetti', r.x, r.y, { count: 36, power: 8 });
      toast('Got ' + (u.name || 'it') + '!', 'good', u.emoji || '✨');
      handleEvents(res.events, { anchor: btn });
    } else {
      fx('sound', 'error');
      fx('animate', btn, 'shake');
      toast(res.reason || 'Can\'t buy that yet.', 'warn', '🙅');
    }
    save();
    refresh(false);
  }

  function doCombo(btn, id) {
    var on = !!get(S.state, 'combos.' + id + '.on');
    var res = eng('toggleCombo', S.state, C(), id, !on);
    if (!res) return;
    if (res.ok) { fx('sound', 'toggle'); fx('haptic', 8); }
    else { fx('sound', 'error'); fx('animate', btn, 'shake'); toast(res.reason || 'Not available yet.', 'warn', '🔒'); }
    refresh(false);
  }

  function doChannel(btn, id) {
    var c = chDef(id);
    if (!get(S.state, 'channels.' + id + '.unlocked')) {
      fx('sound', 'error');
      fx('animate', btn, 'wiggle');
      toast(c.name + ' unlock at Level ' + c.unlockLevel + '.', '', '🔒');
      return;
    }
    S.channel = id;
    S.combo = 0;
    S.lastTap = 0;
    fx('sound', 'toggle');
    refresh(false);
  }

  /* ---------- Company actions (Engine API from SPEC-LATE, always guarded) ---------- */
  function tapGuarded() { return !!(S.lastBuyAt && S.pressAt > S.lastBuyAt && S.pressAt - S.lastBuyAt < BUY_TAP_GUARD); }
  /** Calls ZTE.Engine[name](state, content, ...args) and turns the result into juice + toasts. */
  function companyAct(btn, name, args, o) {
    o = o || {};
    if (!S.state || isSold() && !o.afterSale) return null;
    if (o.guard && tapGuarded()) return null;
    if (!hasEng(name)) {
      fx('sound', 'error');
      toast('That part of the company is still being built.', 'warn', '🛠️');
      return null;
    }
    var res = eng.apply(null, [name, S.state, C()].concat(args || []));
    if (!res || typeof res !== 'object') { scheduleRefresh(); return null; }
    if (res.ok === false) {
      fx('sound', 'error');
      fx('haptic', [30, 30, 30]);
      if (btn) fx('animate', btn, 'shake');
      toast(res.reason || 'Not right now.', 'warn', o.emoji || '🙅');
    } else {
      if (o.guard) S.lastBuyAt = Date.now();
      fx('sound', o.sound || 'good');
      fx('haptic', 12);
      if (o.confetti && btn) { var r = rectOf(btn); fx('confetti', r.x, r.y, { count: 30, power: 8 }); }
      var evs = arr(res.events);
      if (evs.length) handleEvents(evs, { anchor: btn });
      else if (o.okText) toast(o.okText, 'good', o.emoji || '✅');
    }
    save();
    refresh(false);
    return res;
  }
  /** First tap arms a risky button ("Sure?"), a second tap within ARM_MS confirms. */
  function armOrGo(key) {
    if (isArmed(key)) { S.armed = null; return true; }
    S.armed = { key: key, at: Date.now() };
    fx('sound', 'toggle');
    setTimeout(function () { if (S.armed && S.armed.key === key && Date.now() - S.armed.at >= ARM_MS) { S.armed = null; scheduleRefresh(); } }, ARM_MS + 60);
    refresh(false);
    return false;
  }
  /** Level 4+: a purchase that would leave under `minDays` (21) days of running costs asks "Sure?" first:
   * the first tap arms the button and says how many days of cash are left, a second tap within ARM_MS buys. */
  function cashSure(key, cost, extraDaily, what, minDays) {
    if (!S.state || lvlNow() < COMPANY_LEVEL || !hasEng('runwayAfter')) return true;
    var left = eng('runwayAfter', S.state, C(), num(cost), num(extraDaily), S.metrics);
    if (left == null || left >= (minDays || 21) || num(cost) <= 0) return true;
    if (isArmed(key)) { S.armed = null; return true; }
    armOrGo(key);
    toast('Careful: ' + what + ' leaves about ' + int(left) + ' ' + plural(left, 'day') + ' of cash. Tap again to go ahead.', 'warn', '🧯', 3400);
    return false;
  }
  function doSellConfirm(btn) {
    if (!S.state || isSold()) { closeModal(); return; }
    var res = companyAct(btn, 'sellCompany', [], { sound: 'levelup', emoji: '🏔️' });
    if (!res || res.ok === false) return;
    // the exit event opened the finale; close the confirm screen underneath it
    if (S.modal && S.modal.kind === 'sell') closeModal();
    if (!S.summitShown) onExit({ amount: res.valuation, score: res.score, factors: res.factors });
    claimWisdom();
  }
  function openNgPlus() {
    claimWisdom();
    if (S.modal && (S.modal.kind === 'summit' || S.modal.kind === 'sell')) closeModal();
    if (!perkList().length) { openModal('flavor', { ngplus: true }, { front: true }); return; }
    openModal('perks', {}, { front: true });
  }
  function buyPerk(btn, id) {
    var p = perkDef(id), w = wisdomGet();
    if (!p || has(w.owned, id)) return;
    var cost = perkCost(p);
    if (w.points < cost) { fx('sound', 'error'); fx('animate', btn, 'shake'); toast('Not enough Wisdom yet. Sell a bigger company!', 'warn', '🦉'); return; }
    w.points -= cost;
    w.owned.push(id);
    wisdomSave();
    fx('sound', 'coin');
    var r = rectOf(btn);
    fx('confetti', r.x, r.y, { count: 36, power: 8 });
    toast((p.name || 'Perk') + ' unlocked for every new run!', 'good', p.emoji || '🦉');
    renderModal(false);
  }

  function setSpeed(sp) {
    if (!S.state) return;
    sp = num(sp, 1);
    if (SPEEDS.indexOf(sp) < 0) sp = 1;
    if (sp > 4 && lvlNow() < FAST_LEVEL) sp = 4;
    S.state.speed = sp;
    fx('sound', 'toggle');
    updateTop();
    save();
  }

  function toggleSound() {
    var F = ZTE.FX;
    if (!F) return;
    F.setMuted(!F.isMuted());
    if (!F.isMuted()) F.sound('toggle');
    updateTop();
    if (S.modal && S.modal.kind === 'settings') renderModal(false);
  }

  function coachHint() {
    var st = S.state;
    if (!st) return;
    var m = obj(S.metrics);
    var lvl = num(st.level, 1);
    var cur = num(get(st, 'energy.current'));
    var plan = obj(st.plan);
    var hints = [];
    if (st.pendingCard) hints.push('A decision is waiting. Think long-term, not just today.');
    if (m.runwayDays != null && num(m.runwayDays) < 10 && num(m.runwayDays) >= 0 && lvl >= 2) hints.push('Cash is getting tight. Fix money first: a better offer, a fair price, more sales calls.');
    if (cur >= 50) hints.push('You still have ' + int(cur) + ' energy. Tap Reach out! Volume beats talent early on.');
    if (num(st.leads) >= 6 && num(plan.sales) < 30) hints.push('Leads are piling up! Give sales calls more Autopilot time before they go cold.');
    if (lvl === 1 && num(get(st, 'reputation.testimonials')) < 3) hints.push('Free trials turn into happy stories. Deliver well and the testimonials come.');
    if (lvl === 2 && num(get(st, 'offer.price')) <= 0) hints.push('You can charge now! Head to the Offer tab and set a price.');
    if (lvl === 2 && m.closeRate != null && num(m.closeRate) < 0.15) hints.push('Low close rate? Make the offer better before you shout louder.');
    if (lvl >= 2 && get(st, 'channels.cold.unlocked') && num(plan.cold) === 0) hints.push('Friends run out. Give Cold Calls a slice of your Autopilot plan.');
    if (lvl >= 3) {
      var anyOn = ['hook', 'upsell', 'downsell', 'membership'].some(function (id) { return get(st, 'combos.' + id + '.on'); });
      if (!anyOn) hints.push('Turn on a Cash Combo. More money per customer means you can afford more customers.');
      var eMax = num(get(st, 'energy.max'), 100);
      var pr = num(get(st, 'offer.price'));
      if (num(m.deliveryEnergy) >= 0.4 * eMax && pr > 0 && num(m.offerValue) >= 2 * pr) hints.push('Clients eat ' + int(m.deliveryEnergy) + ' of your ' + int(eMax) + ' energy, so you can\'t fit many more calls. Make each client worth more: nudge your price up on the Offer tab and watch the close rate.');
      var adv = adviceNow(), aa = obj(adv.ads);
      if (aa.step === 'start') hints.push('Try a small ad budget. Watch cost per customer against 30-day cash.');
      else if (aa.step === 'up') hints.push(aa.reason + ' (Growth tab: about ' + money(aa.to) + ' a day; LTV is ' + num(m.adLtvCac).toFixed(1) + '× what an ad customer costs.)');
      else if (aa.step === 'down' || aa.step === 'off') hints.unshift(aa.reason + ' (Growth tab' + (aa.to != null ? ': about ' + money(aa.to) + ' a day' : '') + '.)');
      else if (aa.step === 'hold' && lvl >= COMPANY_LEVEL && aa.reason && /thin|waiting|full|take/.test(aa.reason)) hints.push(aa.reason);
    }
    if (lvl >= 2) {
      var pa = obj(adviceNow().price);
      if (pa.verdict === 'raise' && num(st.offer && st.offer.price) > 0) hints.push((pa.busy ? 'You have more yeses than time. ' : 'Leaving money on the table: ') + 'try about ' + money(pa.hint) + ' on the Offer tab and watch the close rate.');
    }
    if (lvl >= COMPANY_LEVEL && !isSold()) lateHints(st, m, lvl, hints);
    var def = obj(levelDef(lvl));
    if (def.bottomLine) hints.push('Right now, one job: ' + def.bottomLine.charAt(0).toLowerCase() + def.bottomLine.slice(1) + '.');
    hints.push('Small reps every day beat one big push. Keep grinding!');
    var h = hints[S.hintIdx % hints.length];
    S.hintIdx++;
    // answer the owl tap right away; the engine line that was showing (and any waiting) plays after
    S.bubbleQueue = S.bubbleQueue.filter(function (b) { return !b.hint; });
    if (S.bubbleShowing && S.bubbleCur && !S.bubbleCur.hint) S.bubbleQueue.unshift(S.bubbleCur);
    S.bubbleQueue.unshift({ text: h, day: curDay(), hint: true });
    while (S.bubbleQueue.length > 5) S.bubbleQueue.pop();
    nextBubble();
  }

  function lateHints(st, m, lvl, hints) {
    if (lvl >= 8) {
      var big = arr(st.fires).filter(function (f) { return f && num(f.impact) >= 3; }).length;
      if (big) hints.unshift('A big fire is burning! Spend CEO attention on the biggest flames first. Small ones often burn out alone.');
    }
    var adv = adviceNow(), ha = obj(adv.hire);
    if (adv.save && adv.save.reason) hints.unshift(adv.save.reason);
    if (num(m.profit30) < 0 && num(m.payrollDaily) > 0) hints.push('Payroll is eating the profit. Every hire should pay for itself: hire for the bottleneck, not for comfort.');
    // the Team card's "next hire" (or why to hold): one source with the engine's advice
    if (ha.reason && (ha.role || ha.hold)) hints.unshift(ha.reason + (ha.role ? ' (Company tab.)' : ''));
    else if (num(m.unmanaged) > 0 && lvl < 5) hints.push(int(m.unmanaged) + ' people have no manager and slack off to 60%. Keep the team small until managers arrive at Level 5.');
    if (lvl >= 4 && !get(st, 'squad.fans.on')) hints.push('Turn on Fans in the Lead Squad. Happy customers bring friends, and you only pay when one buys.');
    if (lvl >= 5 && num(st.focus) < 60) hints.push('Trying to serve everyone? Slide Niche focus up' + (lvl === 5 ? ' to 60: your goal needs 60' : '') + '. Fewer leads, but each one is worth way more.');
    if (lvl >= 6 && !get(st, 'premium.built') && !(num(get(st, 'premium.buildDays')) > 0)) hints.push('Build a premium product in the Product Lab. Your easiest next sale is to someone who already bought.');
    if (lvl >= 6 && get(st, 'premium.built') && !get(st, 'premium.on')) hints.push('Your premium product is built but switched off. Flip it on!');
    if (lvl >= 7 && m.weakestMetric && !get(st, 'ops.project') && (!adv.save || num(m.efficiency, 100) < 65)) hints.push('Your weakest number is ' + metricName(m.weakestMetric) + '. Start the project that fixes it for the full effect.');
    if (lvl >= 9 && num(m.specialistDepts) < 4) hints.push('Build specialist teams in your weakest departments. Experts beat generalists at this size.');
    if (lvl >= 10 && !get(st, 'flags.betDone') && !st.bet) hints.push('Growth is stalling on purpose. Prep a Big Bet: check which one your numbers already support.');
    if (lvl >= 10 && num(m.valuation) > 0) hints.push('Buyers pay for profit that keeps coming without you. Recurring revenue and healthy departments raise your multiple.');
  }

  function chooseOption(optId) {
    var m = S.modal;
    if (!m || m.kind !== 'card' || m.data.phase === 'result' || m.data.busy) return;
    var card = obj(m.data.card);
    m.data.busy = true;
    // ghost timeline must be computed BEFORE the choice is applied; usually it was already
    // worked out in the background while the player read the card (scheduleGhost)
    clearTimeout(S.ghostTimer);
    var ghost = m.data.ghostFor === card.id && m.data.ghostPre ? m.data.ghostPre : eng('ghostCompare', S.state, C(), card.id);
    var res = eng('chooseCardOption', S.state, C(), optId);
    if (!res) { m.data.busy = false; renderModal(false); return; }
    m.data.busy = false;
    m.data.phase = 'result';
    m.data.optionId = optId;
    m.data.ghost = ghost && typeof ghost === 'object' ? ghost : null;
    var opt = find(card.options, function (o) { return o.id === optId; }) || {};
    if (opt.quality === 'best') { fx('sound', 'good'); fx('confetti', window.innerWidth / 2, window.innerHeight * 0.3, { count: 40, power: 9, spread: Math.PI * 2 }); }
    else if (opt.quality === 'trap') fx('sound', 'bad');
    else fx('sound', 'pop');
    renderModal(false, true);
    handleEvents(res.events, {});
    save();
  }

  /** The ghost timeline is heavy (options × runs × days of simulation). Time is frozen while a
   * card is open, so work it out shortly after the card has painted instead of on the tap. */
  function scheduleGhost(m) {
    clearTimeout(S.ghostTimer);
    S.ghostTimer = setTimeout(function () {
      if (S.modal !== m || m.data.phase === 'result' || m.data.ghostPre) return;
      var id = obj(m.data.card).id;
      if (!id || get(S.state, 'pendingCard') !== id) return;
      var g = eng('ghostCompare', S.state, C(), id);
      if (S.modal === m && m.data.phase !== 'result' && g && typeof g === 'object') { m.data.ghostPre = g; m.data.ghostFor = id; }
    }, 450);
  }

  function maybeOpenCard() {
    var st = S.state;
    if (!st || !st.pendingCard || st.gameOver || isSold()) return;
    if (S.modal || S.queue.length) return;
    // wait for a short lull while the player is mashing Reach out (time is paused meanwhile),
    // so the card doesn't pop up under a finger that is already coming down
    if (S.pressAt && Date.now() - S.pressAt < 350) return;
    var card = eng('getPendingCard', st, C()) || cardDef(st.pendingCard);
    if (!card) {
      // SPEC-GAP: a pending card id that no longer exists would freeze time forever; drop it.
      if (root.console) console.warn('[ZTE] pending card not found:', st.pendingCard);
      st.pendingCard = null;
      return;
    }
    openModal('card', { card: card, phase: 'choose' });
  }

  function doRewind(idx) {
    var ns = eng('rewind', S.state, num(idx));
    if (!ns || typeof ns !== 'object') return;
    var speed = num(get(S.state, 'speed'), 1) || 1;
    S.state = ns;
    if (ns.speed == null) ns.speed = speed;
    S.queue = [];
    S.modal = null;
    if (S.els.modal) { S.els.modal.hidden = true; S.els.modal.innerHTML = ''; document.body.classList.remove('modal-open'); }
    S.bubbleQueue = [];
    hideBubble();
    S.acc = 0;
    S.gradShown = !!ns.graduated;
    fx('sound', 'whoosh');
    toast('Rewound to day ' + int(ns.day) + '. Choose wisely!', 'good', '⏪');
    save();
    refresh(true);
  }

  function newGame(flavorId) {
    var seed = ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9)) >>> 0;
    seed = (seed % 2147483646) + 1;
    var perks = ownedPerks();
    var st = eng('createState', C(), { seed: seed, flavor: flavorId, perks: perks });
    if (!st || typeof st !== 'object') return;
    if (st.speed == null) st.speed = 1;
    S.state = st;
    S.acc = 0;
    S.tab = 'hustle';
    S.channel = 'warm';
    S.combo = 0;
    S.gradShown = false;
    S.summitShown = false;
    S.armed = null;
    S.newLessons = false;
    S.ui.seen = {};
    S.ui.best = {};
    S.bubbleQueue = [];
    hideBubble();
    S.queue = [];
    S.modal = null;
    if (S.els.modal) { S.els.modal.hidden = true; S.els.modal.innerHTML = ''; document.body.classList.remove('modal-open'); }
    fx('sound', 'levelup');
    var def = levelDef(num(st.level, 1));
    var intro = def ? arr(def.intro) : [];
    if (intro.length) openModal('coach', { lines: intro.slice(), i: 0 });
    // level-1 onEnter events (first lessons) are kept by createState; light the Notebook badge
    handleEvents(st._startEvents, { quiet: true });
    if (perks.length) {
      toast('New Game+ perks active: ' + perks.map(function (id) { var p = obj(perkDef(id)); return (p.emoji || '') + ' ' + (p.name || id); }).join(', '), 'good', '🦉', 4500);
    }
    save();
    refresh(true);
  }

  function resetSave() {
    lsDel(SAVE_KEY);
    S.state = null;
    S.metrics = null;
    S.queue = [];
    S.modal = null;
    if (S.els.modal) { S.els.modal.hidden = true; S.els.modal.innerHTML = ''; document.body.classList.remove('modal-open'); }
    S.ui = { savedAt: 0, seen: {}, best: {} };
    S.summitShown = false;
    S.armed = null;
    S.bubbleQueue = [];
    hideBubble();
    saveUi();
    refresh(true);
    openModal('flavor', {});
  }

  /* ================================================================== */
  /* Input binding                                                       */
  /* ================================================================== */
  var ACTIONS = {
    reach: function (el) { doReach(el); },
    channel: function (el) { doChannel(el, el.getAttribute('data-id')); },
    tab: function (el) { fx('sound', 'toggle'); setTab(el.getAttribute('data-tab')); },
    speed: function (el) { setSpeed(el.getAttribute('data-speed')); },
    sound: function () { toggleSound(); },
    settings: function () { openModal('settings', { confirm: false }); },
    owl: function () { fx('sound', 'pop'); fx('animate', S.els.owl, 'squash'); coachHint(); },
    'bubble-next': function () { nextBubble(); },
    why: function () { S.metrics = S.state ? eng('computeMetrics', S.state, C()) : S.metrics; openModal('why', {}); },
    overtime: function (el) { doOvertime(el); },
    post: function (el) { doPost(el); },
    buy: function (el) { doBuy(el, el.getAttribute('data-id')); },
    combo: function (el) { doCombo(el, el.getAttribute('data-id')); },
    'chart-range': function (el) { S.chartRange = num(el.getAttribute('data-range'), 60); renderTab(false); },
    lesson: function (el) {
      var id = el.getAttribute('data-id');
      S.ui.seen[id] = 1;
      saveUi();
      fx('sound', 'pop');
      openModal('lesson', { id: id, answer: null });
      renderTab(false);
    },
    quiz: function (el) {
      var m = S.modal;
      if (!m || m.kind !== 'lesson') return;
      var idx = num(el.getAttribute('data-idx'));
      var res = eng('answerQuiz', S.state, C(), m.data.id, idx);
      if (!res) return;
      var n = obj(nbDef(m.data.id));
      m.data.answer = { idx: idx, correct: !!res.correct, explain: res.explain || get(n, 'quiz.explain', '') };
      if (res.correct) {
        fx('sound', 'good');
        var r = rectOf(el);
        fx('confetti', r.x, r.y, { count: 40, power: 9 });
      } else {
        fx('sound', 'bad');
        fx('animate', el, 'shake');
      }
      renderModal(false);
      var ex = S.els.modal && S.els.modal.querySelector('.quiz .explain');
      if (ex && ex.scrollIntoView) { try { ex.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { ex.scrollIntoView(false); } }
      save();
      scheduleRefresh();
    },
    'close-modal': function () { closeModal(); },
    'card-option': function (el) { chooseOption(el.getAttribute('data-id')); },
    'card-done': function () { closeModal(); },
    'coach-next': function () {
      var m = S.modal;
      if (!m || m.kind !== 'coach') return;
      var lines = arr(m.data.lines);
      if (num(m.data.i) < lines.length - 1) { m.data.i = num(m.data.i) + 1; fx('sound', 'pop'); renderModal(false); }
      else closeModal();
    },
    flavor: function (el) { newGame(el.getAttribute('data-id')); },
    rewind: function (el) { doRewind(el.getAttribute('data-idx')); },
    restart: function () { resetSave(); },
    'reset-ask': function () { if (S.modal) { S.modal.data.confirm = true; renderModal(false); } },
    reset: function () { resetSave(); },

    // ---- late game (SPEC-LATE §7) ----
    'co-jump': function (el) {
      var sec = document.getElementById('co-' + el.getAttribute('data-id'));
      if (!sec) return;
      var top = 0, bar = document.getElementById('topbar');
      if (bar && root.getComputedStyle && root.getComputedStyle(bar).position === 'sticky') top = bar.getBoundingClientRect().height;
      var y = sec.getBoundingClientRect().top + (root.pageYOffset || 0) - top - 8;
      try { root.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); } catch (e) { root.scrollTo(0, Math.max(0, y)); }
      fx('sound', 'tap');
      fx('animate', sec, 'flash');
    },
    'speed-cycle': function () {
      var sp = num(get(S.state, 'speed'), 1);
      var order = lvlNow() >= FAST_LEVEL ? [1, 2, 4, 8] : [1, 2, 4];
      var i = order.indexOf(sp);
      setSpeed(sp <= 0 ? 1 : order[(i + 1) % order.length]);
    },
    hire: function (el) {
      var id = el.getAttribute('data-id'), n = Math.max(1, Math.floor(num(el.getAttribute('data-n'), 1)));
      // recruiting full: let the engine say why instead of a silent grey button
      if (nextHireIn()) { companyAct(el, 'hire', [id], { emoji: '⏳' }); return; }
      var key = 'hire-' + id + (n > 1 ? '-' + n : '');
      var tight = hireRunwayAfter(id, n);
      if (tight != null && tight < 21 && !isArmed(key)) {
        armOrGo(key);
        toast('Careful: ' + (n > 1 ? 'these ' + n + ' hires leave' : 'this hire leaves') + ' about ' + int(tight) + ' ' + plural(tight, 'day') + ' of cash. Tap again to hire anyway.', 'warn', '🧯', 3200);
        return;
      }
      if (isArmed(key)) S.armed = null;
      // no double-tap guard: the hire button never moves, so quick repeat taps are real hires
      if (n === 1 || !S.state || isSold()) { companyAct(el, 'hire', [id], { sound: 'coin', confetti: true, emoji: '🧑‍💼' }); return; }
      var got = 0, res = null, evs = [];
      for (var i = 0; i < n; i++) {
        res = eng('hire', S.state, C(), id);
        if (!res || res.ok === false) break;
        got++;
        evs = evs.concat(arr(res.events).filter(function (ev) { return !(ev && /^hire_/.test(ev.id || '')); }));
      }
      if (got) {
        fx('sound', 'coin'); fx('haptic', 12);
        var r = rectOf(el); fx('confetti', r.x, r.y, { count: 40, power: 9 });
        toast('Hired ' + got + ' ' + roleNameOf(id, got !== 1) + '! They ramp up over the next few weeks.' + (got < n && res && res.reason ? ' ' + res.reason : ''), 'good', '🧑‍💼');
        if (evs.length) handleEvents(evs, { anchor: el });
      } else {
        fx('sound', 'error'); fx('animate', el, 'shake');
        toast((res && res.reason) || 'Not right now.', 'warn', '🧑‍💼');
      }
      save();
      refresh(false);
    },
    'crunch-open': function () { S.crunchOpen = true; openModal('crunch', {}); },
    'crunch-back': function () { if (S.modal && S.modal.kind === 'crunch') { S.modal.data.step = null; renderModal(false, true); } },
    'crunch-cut': function () {
      var md = S.modal && S.modal.kind === 'crunch' ? S.modal.data : null;
      if (!md || !S.state) return;
      if (md.step !== 'plan') {
        // first tap: a dry run on a copy, so the player sees who goes before anything happens
        var copy = cloneState(S.state);
        md.plan = copy ? crunchSummary(S.state, copy, eng('cutToBreakEven', copy, C())) : { ok: false, reason: 'Could not work out a plan.' };
        md.step = 'plan';
        fx('sound', 'toggle');
        renderModal(false, true);
        return;
      }
      if (!md.plan || !md.plan.ok) return;
      var pre = cloneState(S.state);
      var res = eng('cutToBreakEven', S.state, C());
      if (!res || res.ok === false) { md.plan = { ok: false, reason: (res && res.reason) || 'Nothing to cut right now.' }; fx('sound', 'error'); }
      else { md.plan = crunchSummary(pre, S.state, res); fx('sound', 'whoosh'); fx('haptic', 12); }
      md.step = 'done';
      save();
      refresh(false);
      renderModal(false, true);
    },
    'fire-staff': function (el) {
      var id = el.getAttribute('data-id');
      if (!armOrGo('fire-' + id)) return;
      var r = obj(find(roleList(), function (x) { return x.id === id; }));
      companyAct(el, 'fire', [id], { sound: 'whoosh', okText: 'You let a ' + roleName(r) + ' go. Morale dips a little.', emoji: '👋' });
    },
    'squad-fans': function (el) {
      var on = !!get(S.state, 'squad.fans.on');
      companyAct(el, 'setSquad', ['fans', !on], { sound: 'toggle', okText: on ? 'Fan referrals paused.' : 'Fans are on! Happy customers now send friends your way.', emoji: '🙌' });
    },
    'squad-partner': function (el) {
      if (!cashSure('partner', tuning(['partnerCost'], 500), 0, 'a new partner')) return;
      companyAct(el, 'setSquad', ['partnersRecruit', true], { guard: true, sound: 'coin', confetti: true, emoji: '🤝' });
    },
    'premium-build': function (el) {
      var pc = hasEng('premiumCost') ? num(eng('premiumCost', S.state, C())) : num(get(C(), 'premiumDefaults.buildCost'), 6000);
      if (!cashSure('premium-build', pc, 0, 'building it now')) return;
      companyAct(el, 'buildPremium', [], { guard: true, sound: 'coin', confetti: true, emoji: '🛠️' });
    },
    'premium-toggle': function (el) {
      var on = !!get(S.state, 'premium.on');
      companyAct(el, 'togglePremium', [!on], { sound: 'toggle', okText: on ? 'Premium product paused.' : 'Premium product is on sale!', emoji: '💎' });
    },
    project: function (el) {
      var pid = el.getAttribute('data-id');
      if (!cashSure('project-' + pid, hasEng('projectCost') ? num(eng('projectCost', S.state, C(), pid)) : 0, 0, 'this project')) return;
      companyAct(el, 'startProject', [pid], { guard: true, sound: 'coin', okText: 'Project started!', emoji: '🛠️' });
    },
    'handle-fire': function (el) { companyAct(el, 'handleFire', [el.getAttribute('data-id')], { guard: true, sound: 'whoosh', okText: 'Fire handled.', emoji: '🧯' }); },
    spec: function (el) {
      var did = el.getAttribute('data-id'), L = obj(ZTE.Engine && ZTE.Engine.late), sc = 0;
      if (typeof L.specCost === 'function') { try { sc = num(L.specCost(S.state, C(), did)); } catch (e) { sc = 0; } }
      if (!cashSure('spec-' + did, sc, 0, 'this specialist team')) return;
      companyAct(el, 'upgradeDept', [did], { guard: true, sound: 'coin', confetti: true, emoji: '🔬' });
    },
    bet: function (el) {
      var id = el.getAttribute('data-id'), bd = obj(find(arr(C().bets), function (b) { return b.id === id; }));
      var bleft = hasEng('runwayAfter') ? eng('runwayAfter', S.state, C(), num(bd.cost), 0, S.metrics) : null;
      if (!isArmed('bet-' + id) && bleft != null && bleft < 30) {
        armOrGo('bet-' + id);
        toast('Careful: this bet leaves about ' + int(bleft) + ' ' + plural(bleft, 'day') + ' of cash. If it misses, the core business has to carry you. Tap again to bet anyway.', 'warn', '🎲', 3600);
        return;
      }
      if (!armOrGo('bet-' + id)) return;
      companyAct(el, 'startBet', [id], { guard: true, sound: 'whoosh', okText: 'The Big Bet is placed. Fingers crossed!', emoji: '🎲' });
    },
    sell: function () {
      if (!S.state || isSold()) return;
      if (lvlNow() < 10) { toast('You can sell at ' + gl('summit', 'The Summit') + ' (Level 10).', 'warn', '🏔️'); return; }
      S.metrics = eng('computeMetrics', S.state, C()) || S.metrics;
      openModal('sell', {});
    },
    'sell-confirm': function (el) { doSellConfirm(el); },
    'summit-show': function () { if (isSold()) { S.summitShown = true; openModal('summit', {}); } },
    ngplus: function () { openNgPlus(); },
    'perk-buy': function (el) { buyPerk(el, el.getAttribute('data-id')); },
    'ngplus-start': function () { if (S.modal && S.modal.kind === 'perks') closeModal(); openModal('flavor', { ngplus: true }, { front: true }); }
  };

  // After a Summit sale the run is over: controls that change the business stop working and draw disabled.
  var SOLD_LOCKED = { reach: 1, post: 1, overtime: 1, buy: 1, combo: 1, hire: 1, 'fire-staff': 1, project: 1, spec: 1, 'squad-partner': 1, 'squad-fans': 1,
    'premium-toggle': 1, 'premium-build': 1, 'handle-fire': 1, bet: 1, 'crunch-cut': 1 };
  var SOLD_TEXT = 'This run is complete. Tap 🌟 New Game+ to start the next one.';
  function lockSold(html) {
    return html.replace(/(<(?:button|input)\b[^>]*?\bdata-(?:action="([a-z-]+)"|slider="[a-zA-Z]+"))/g, function (all, head, act) {
      return act && !SOLD_LOCKED[act] ? all : head + ' disabled';
    });
  }

  function onClick(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    // a tap that lands on a modal that just popped up under the finger doesn't count
    if (S.modal && S.els.modal && (e.target === S.els.modal || (el && S.els.modal.contains(el))) && modalTapTooSoon()) return;
    if (!el) {
      if (e.target === S.els.modal) {
        if (S.modal && S.modal.kind === 'coach') ACTIONS['coach-next']();
        else if (modalClosable()) closeModal();
      }
      return;
    }
    if (el.disabled) return;
    var name = el.getAttribute('data-action');
    var fn = ACTIONS[name];
    if (!fn) return;
    if (SOLD_LOCKED[name] && isSold()) { toast(SOLD_TEXT, '', '🏔️'); return; }
    try { fn(el, e); } catch (err) {
      if (root.console) console.error('[ZTE] action failed:', name, err);
      toast('Oops, that button glitched.', 'error', '🛠️');
    }
  }

  function onSlider(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var kind = el.getAttribute('data-slider');
    if (!kind || !S.state) return;
    if (isSold()) { scheduleRefresh(); return; }   // run complete: the next draw puts the value back
    var v = num(el.value);
    var res;
    if (kind === 'price') {
      res = eng('setPrice', S.state, C(), v);
      if (res && !res.ok && res.reason) toast(res.reason, 'warn', '🏷️');
    } else if (kind === 'plan') {
      var plan = rebalancePlan(el.getAttribute('data-key'), v);
      eng('setPlan', S.state, plan);
    } else if (kind === 'adBudget') {
      res = eng('setAdBudget', S.state, C(), v);
      if (res && !res.ok && res.reason) toast(res.reason, 'warn', '📺');
    } else if (kind === 'agency' || kind === 'focus' || kind === 'premiumPrice') {
      var api = kind === 'agency' ? 'setSquad' : kind === 'focus' ? 'setFocus' : 'setPremiumPrice';
      if (!hasEng(api)) { if (e.type === 'change') toast('That control is still being built.', 'warn', '🛠️'); }
      else {
        res = kind === 'agency' ? eng(api, S.state, C(), 'agency', v) : eng(api, S.state, C(), v);
        if (res && res.ok === false && res.reason && e.type === 'change') toast(res.reason, 'warn', kind === 'focus' ? '🎯' : kind === 'agency' ? '🏢' : '💎');
      }
    }
    if (e.type === 'change') { save(); if (kind !== 'plan') fx('sound', 'toggle'); }
    scheduleRefresh();
  }

  /** Move one plan slider and spread the difference across the other visible sliders so the total stays 100. */
  function rebalancePlan(key, val) {
    var plan = {};
    var cur = obj(get(S.state, 'plan'));
    PLAN_KEYS.forEach(function (pk) { plan[pk.key] = Math.max(0, num(cur[pk.key])); });
    var visKeys = visiblePlanKeys().map(function (pk) { return pk.key; });
    var hidden = PLAN_KEYS.filter(function (pk) { return visKeys.indexOf(pk.key) < 0; });
    var hiddenSum = 0;
    hidden.forEach(function (pk) { hiddenSum += plan[pk.key]; });
    var budget = Math.max(0, 100 - hiddenSum);
    val = clamp(Math.round(num(val)), 0, budget);
    var others = visKeys.filter(function (k) { return k !== key; });
    var otherSum = 0;
    others.forEach(function (k) { otherSum += plan[k]; });
    var remaining = budget - val;
    var raw = {};
    others.forEach(function (k) { raw[k] = otherSum > 0 ? plan[k] * remaining / otherSum : remaining / Math.max(1, others.length); });
    // integer rounding with largest remainder so the sum is exact
    var floorSum = 0;
    others.forEach(function (k) { plan[k] = Math.floor(raw[k]); floorSum += plan[k]; });
    var left = remaining - floorSum;
    others.slice().sort(function (a, b) { return (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])); })
      .forEach(function (k) { if (left > 0) { plan[k] += 1; left--; } });
    plan[key] = val;
    return plan;
  }

  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', onSlider);
    document.addEventListener('change', onSlider);
    document.addEventListener('pointerdown', function (e) {
      fx('unlock');
      var t = e.target;
      if (t && t.tagName === 'INPUT' && t.type === 'range') S.dragEl = t;
      else if (e.isTrusted) S.pressAt = Date.now();
    }, true);
    var endDrag = function () {
      if (S.dragEl) { S.dragEl = null; scheduleRefresh(); }
    };
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
    document.addEventListener('touchstart', function () { fx('unlock'); }, { passive: true, capture: true });
    // Touch pointerdown/touchstart don't count as user activation for audio (iOS/Chrome want
    // pointerup, touchend or click), so unlock on those too.
    var unlockAudio = function () { fx('unlock'); };
    document.addEventListener('pointerup', unlockAudio, true);
    document.addEventListener('touchend', unlockAudio, { passive: true, capture: true });
    document.addEventListener('click', unlockAudio, true);
    window.addEventListener('resize', function () { if (S.bubbleShowing) placeBubble(); });
    document.addEventListener('keydown', function (e) {
      fx('unlock');
      if (e.key === 'Escape' && modalClosable()) closeModal();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        S.hiddenAt = Date.now();
        save();
      } else {
        var away = S.hiddenAt ? Date.now() - S.hiddenAt : 0;
        S.hiddenAt = 0;
        S.lastFrame = 0;
        if (away > DAY_MS) runOffline(away);
      }
    });
    window.addEventListener('pagehide', save);
  }

  /* ================================================================== */
  /* Save / load / offline progress                                      */
  /* ================================================================== */
  // Saving needs localStorage, which can be blocked (private windows, sandboxed frames).
  function probeStorage() {
    var k = 'zte-probe';
    var ok = lsSet(k, '1') && lsGet(k) === '1';
    lsDel(k);
    return ok;
  }
  var NO_SAVE_TEXT = 'Saving is off in this browser: progress resets when you close the page.';

  function loadUi() {
    var raw = lsGet(UI_KEY);
    if (!raw) return;
    try {
      var u = JSON.parse(raw);
      if (u && typeof u === 'object') {
        S.ui.savedAt = num(u.savedAt);
        S.ui.seen = obj(u.seen);
        S.ui.best = obj(u.best);
      }
    } catch (e) { /* ignore */ }
  }
  function saveUi() { lsSet(UI_KEY, JSON.stringify({ savedAt: S.ui.savedAt, seen: S.ui.seen, best: obj(S.ui.best) })); }

  function save() {
    if (!S.state || !ZTE.Engine || typeof ZTE.Engine.serialize !== 'function') return;
    try {
      var str = ZTE.Engine.serialize(S.state);
      if (typeof str !== 'string') return;
      if (lsSet(SAVE_KEY, str)) {
        S.ui.savedAt = Date.now();
        saveUi();
      } else if (S.storageOk) {
        // storage worked at boot but this write failed (full, or blocked mid-session)
        var tf = Date.now();
        if (!S.errAt.save || tf - S.errAt.save > 30000) { S.errAt.save = tf; toast('Couldn\'t save your game. Progress may reset when you close the page.', 'error', '💾', 4500); }
      }
    } catch (e) {
      if (root.console) console.error('[ZTE] save failed', e);
      var t = Date.now();
      if (!S.errAt.save || t - S.errAt.save > 30000) { S.errAt.save = t; toast('Couldn\'t save your game.', 'error', '💾'); }
    }
  }

  function loadGame() {
    var raw = lsGet(SAVE_KEY);
    if (!raw) return false;
    var st = null;
    try { st = ZTE.Engine.deserialize(raw); } catch (e) {
      if (root.console) console.warn('[ZTE] save could not be loaded; starting fresh', e);
      st = null;
    }
    if (!st || typeof st !== 'object') return false;
    if (st.speed == null) st.speed = 1;
    S.state = st;
    S.gradShown = !!st.graduated;
    // Seed "seen" so old lessons don't all show NEW after an update of the UI key
    if (!Object.keys(S.ui.seen).length) arr(st.notebook).forEach(function (id) { S.ui.seen[id] = 1; });
    if (S.ui.savedAt && !isSold()) runOffline(Date.now() - S.ui.savedAt);
    return true;
  }

  // SPEC-GAP: offline days are counted at 1× speed (6 s per day) and skipped entirely if the
  // player left the game paused.
  function runOffline(elapsedMs) {
    var st = S.state;
    if (!st || st.gameOver || !num(st.speed) || S.modal || S.queue.length) return;
    var days = Math.min(MAX_OFFLINE_DAYS, Math.floor(num(elapsedMs) / DAY_MS));
    if (days < 1 || st.pendingCard) return;
    var before = {
      cash: num(st.cash), revenue: num(get(st, 'stats.revenueTotal')), sales: num(get(st, 'stats.salesCount')),
      trials: num(get(st, 'stats.trialsStarted')), leads: num(get(st, 'stats.leadsTotal')), lessons: arr(st.notebook).length
    };
    var important = [];
    var ran = 0;
    for (var i = 0; i < days; i++) {
      if (S.state.pendingCard || S.state.gameOver) break;
      var res = eng('tick', S.state, C());
      if (!res) break;
      ran++;
      arr(res.events).forEach(function (ev) { if (ev && IMPORTANT_OFFLINE.indexOf(ev.type) >= 0) important.push(ev); });
    }
    if (!ran) return;
    st = S.state;
    openModal('away', {
      days: ran,
      cashDelta: num(st.cash) - before.cash,
      revenue: num(get(st, 'stats.revenueTotal')) - before.revenue,
      sales: (num(get(st, 'stats.salesCount')) - before.sales) + (num(get(st, 'stats.trialsStarted')) - before.trials),
      leads: num(get(st, 'stats.leadsTotal')) - before.leads,
      lessons: arr(st.notebook).length - before.lessons,
      stoppedForCard: !!st.pendingCard
    });
    handleEvents(important, { quiet: true });
    save();
    scheduleRefresh();
  }

  /* ================================================================== */
  /* Game loop                                                           */
  /* ================================================================== */
  function isPaused() {
    var st = S.state;
    return !st || !num(st.speed) || !!S.modal || S.queue.length > 0 || !!st.pendingCard || !!st.gameOver || isSold();
  }

  function doTick() {
    var saleBefore = num(get(S.state, 'streak.saleDays'));
    var res = eng('tick', S.state, C());
    if (!res) {
      S.tickErrors++;
      if (S.tickErrors >= 3 && S.state) { S.state.speed = 0; toast('Paused: the simulation keeps erroring.', 'error', '⏸'); }
      refresh(false);
      return;
    }
    S.tickErrors = 0;
    S.today = { day: num(get(S.state, 'day'), -1), leads: 0, calls: 0, sales: 0 };
    handleEvents(res.events, {});
    var stc = S.state;
    if (stc && !stc.gameOver && !stc.graduated && num(stc.level, 1) >= 4 && num(stc.cash) < 0) {
      // the crunch screen opens when cash drops below $0 while the business loses money, and again every
      // 4 days while that lasts (a profitable dip only gets a toast: it climbs back on its own)
      var dnow = num(stc.day);
      if (!S.crunchOpen || (S.crunchDay != null && dnow - S.crunchDay >= 4 && !S.modal)) {
        var firstDip = !S.crunchOpen;
        S.crunchOpen = true; S.crunchDay = dnow;
        S.metrics = eng('computeMetrics', stc, C()) || S.metrics;
        if (num(get(S.metrics, 'burnDaily')) > 0) openModal('crunch', {});
        else if (firstDip) toast('A slow stretch dipped cash below $0, so you are running on your credit line. You\'re still profitable on average, so it should climb back.', 'warn', '💳', 4200);
      }
    } else if (stc && num(stc.cash) >= 0) { S.crunchOpen = false; S.crunchDay = null; }
    var saleNow = num(get(S.state, 'streak.saleDays'));
    if (num(get(S.state, 'level'), 1) >= 3 && saleNow > saleBefore && (saleNow === 3 || saleNow === 5 || saleNow === 7)) {
      toast(saleNow + ' days in a row with a new customer. Steady beats spiky!', 'achv', '💰');
      var tr = rectOf(S.els.toasts);
      fx('confetti', tr.x, tr.y + 20, { count: 24, power: 7, spread: Math.PI * 2 });
    }
    save();
    refresh(false);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    var dt = S.lastFrame ? t - S.lastFrame : 0;
    S.lastFrame = t;
    dt = clamp(dt, 0, 250);

    if (!S.modal && S.queue.length) showNextModal();
    // a saved game-over (e.g. reloaded after losing) must still show the Rewind / Restart screen
    if (!S.modal && S.state && S.state.gameOver) openModal('gameOver', {}, { front: true });
    // a sold run (e.g. reloaded after the sale) shows its Summit finale once per page load
    if (!S.modal && S.state && isSold() && !S.summitShown) { claimWisdom(); S.summitShown = true; openModal('summit', {}); }
    if (!S.modal) maybeOpenCard();

    if (S.needsRefresh) refresh(false);

    var st = S.state;
    var msPerDay = DAY_MS / Math.max(1, num(st && st.speed, 1));
    if (!isPaused()) {
      S.acc += dt;
      if (S.acc >= msPerDay) {
        S.acc -= msPerDay;
        if (S.acc > msPerDay) S.acc = 0;
        doTick();
      }
    }
    if (S.els.dayProg) {
      var k = st ? clamp(S.acc / msPerDay, 0, 1) : 0;
      S.els.dayProg.style.transform = 'scaleX(' + k.toFixed(3) + ')';
    }
  }

  /* ================================================================== */
  /* Boot                                                                */
  /* ================================================================== */
  function showBootError(msg) {
    var tabRoot = document.getElementById('tab-root');
    var html = '<div class="boot-error"><div style="font-size:48px">🛠️</div><h2>The game couldn\'t start</h2>' +
      '<p class="muted" style="margin-top:8px">' + esc(msg || 'Some game files are missing.') + '</p></div>';
    if (tabRoot) tabRoot.innerHTML = html;
    else document.body.insertAdjacentHTML('beforeend', html);
  }

  function boot() {
    cacheEls();
    if (S.els.owl) S.els.owl.innerHTML = owlSVG('');
    if (!ZTE.Engine) { showBootError('The game engine (js/engine.js) did not load.'); return; }
    if (!ZTE.Content || !arr(ZTE.Content.levels).length) { showBootError('The game content (js/content/*.js) did not load.'); return; }
    S.storageOk = probeStorage();
    loadUi();
    bindEvents();
    var ok = false;
    try { ok = loadGame(); } catch (e) { if (root.console) console.error('[ZTE] load failed', e); ok = false; }
    if (!ok) { S.state = null; openModal('flavor', {}); }
    refresh(true);
    if (!S.storageOk) toast(NO_SAVE_TEXT, 'warn', '💾', 6000);
    requestAnimationFrame(frame);
  }

  ZTE.UI = {
    boot: boot,
    refresh: function () { refresh(false); },
    toast: toast,
    coach: showBubble,
    getState: function () { return S.state; },
    save: save,
    // debug hooks (console / automated checks)
    _ui: S,
    _debug: { tick: function () { doTick(); }, setTab: setTab, openModal: openModal, closeModal: closeModal, refresh: refresh }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
