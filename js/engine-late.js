/* Zero to Exit — engine-late.js (Levels 7–10 systems, SPEC-LATE §4)
 * Classic script, loaded after engine.js. No DOM: also loads in Node.
 * Registers systems through ZTE.Engine.registerSystem and attaches the actions
 * startProject, handleFire, upgradeDept, startBet, getValuation, sellCompany onto ZTE.Engine.
 * All randomness goes through api.rand / api.chance (deterministic, ghost-safe).
 */
(function (root) {
  'use strict';
  var ZTE = root.ZTE = root.ZTE || {};
  if (typeof module !== 'undefined' && module.exports) module.exports = ZTE;
  var E = ZTE.Engine;
  if (!E) { if (typeof console !== 'undefined') console.warn('[engine-late] ZTE.Engine missing: load engine.js first'); return; }

  // ---------------------------------------------------------------------------
  // tuning (late game). Content can override per item; these are the engine's own knobs.
  // ---------------------------------------------------------------------------
  var LT = {
    // efficiency (L7+)
    effStart: 60,                // efficiency when Level 7 starts (state default 80 minus 20)
    betKeepDays: 3,              // the Big Bet needs 3 days of running costs left in the bank after paying for it
    bloatFreeHeadcount: 20,      // no bloat up to this many people
    bloatPer10: 0.25,            // efficiency lost per day per 10 people above 20 ...
    bloatSoftCap: 8,             // ... with diminishing growth past ~100 people (units / (1 + units / 8))
    bloatSopCut: 0.15,           // −15% bloat per average Playbook rank (0..3)
    bloatTechSpecCut: 0.15,      // −15% bloat per tech specialist level
    effFullBonus: 8,             // project on the weakest metric: full effects + 8 efficiency
    effHalfBonus: 3,             // any other project: half effects + 3 efficiency
    projectRepeatCost: 0.5,      // each repeat of a project costs +50%
    projectRepeatEffect: 0.5,    // ... and has half the effect of the run before it
    bench: { bookRate: 0.55, showRate: 0.70, closeRate: 0.30, churn: 0.06, deliveryEfficiency: 1.0, cplShare: 0.8 },   // deliveryEfficiency = 1 ÷ delivery multiplier
    // departments (L8+)
    deptDecayPer50: 0.15,        // health lost per day per 50 people
    deptRecover: 0.12,           // health regained per day when the department has no open fire (toward deptRecoverTo) ...
    deptRecoverGap: 0.02,        // ... plus 2% of the gap to deptRecoverTo, so a badly hurt department climbs back even at 50+ people
    deptRecoverTo: 85,
    deptNeutral: 70,             // health where a department neither helps nor hurts
    deptSpecDecayCut: 0.2,       // −20% decay per specialist level
    fireBase: 0.15, firePerHead: 1 / 600, fireMax: 0.9, maxOpenFires: 6,
    fireHandleHealth: 3,         // handling a fire: +3 department health
    fireBurnHealth: 6,           // a fire that burns: −impact × 6 health ...
    fireNoiseBurnHealth: 1,      // ... except small noise (impact 1): it mostly blows over, −1 health
    fireSmoulder: 0.1,           // open fire: −0.1 × impact health per day (noise does not smoulder or block recovery)
    specAutoResolve: 0.2,        // L9+: specialist teams put out a fire in their department: 0.2 × spec chance per day
    attentionWeek: 7,
    // specialists (L9+)
    specMax: 3, specHealth: 15, specDeptsLevel: 2,
    // saturation & bet (L10)
    satRevenue: 1500000,         // market size floor: adCpl × (1 + revenue30 ÷ market)
    satEntryMult: 2,             // market = max(satRevenue, 2 × revenue30 when Level 10 starts)
    satLeadShrink: 0.4,          // lead volume ÷ (1 + 0.4 × revenue30 ÷ market)
    satAfterWin: 0.25,           // a won bet keeps only 25% of the saturation
    betChanceCap: 0.9,
    // valuation
    multBase: 3, multRecurring: 3, multGrowth: 2, multOwner: 2, multDept: 1, multDiversity: 1, multCap: 14,
    premiumRecurringShare: 0.5,  // half of premium revenue counts as recurring (sold on a plan)
    wisdomPer: 10000000, wisdomMax: 10
  };

  var DEPT_IDS = ['marketing', 'sales', 'delivery', 'people', 'finance', 'tech'];
  var METRIC_IDS = ['bookRate', 'showRate', 'closeRate', 'churn', 'deliveryEfficiency', 'cpl'];
  var METRIC_NAMES = { bookRate: 'Book rate', showRate: 'Show rate', closeRate: 'Close rate', churn: 'Churn',
    deliveryEfficiency: 'Delivery efficiency', cpl: 'Cost per lead' };
  var ROLE_IDS = ['coach', 'closer', 'setter', 'manager'];

  // ---------------------------------------------------------------------------
  // fallback content (used only when ZTE.Content lacks the keys; written in our own words)
  // ---------------------------------------------------------------------------
  var FALLBACK = {
    projects: [
      { id: 'nurture_flow', name: 'Nurture Flow', emoji: '💌', metric: 'bookRate', cost: 9000, days: 10,
        effects: [{ op: 'mod', stat: 'bookRate', mult: 1.12 }], desc: 'Follow up with every lead until they book.', notebook: 'better_not_more' },
      { id: 'reminder_robot', name: 'Reminder Robot', emoji: '⏰', metric: 'showRate', cost: 8000, days: 8,
        effects: [{ op: 'mod', stat: 'showRate', mult: 1.12 }], desc: 'Texts and calls before every booked call.', notebook: 'measure_it' },
      { id: 'script_tuneup', name: 'Script Tune-Up', emoji: '🎤', metric: 'closeRate', cost: 12000, days: 10,
        effects: [{ op: 'mod', stat: 'closeRate', mult: 1.1 }], desc: 'Record calls, find where yes turns into maybe.', notebook: 'measure_it' },
      { id: 'onboarding_fix', name: 'Onboarding Fix', emoji: '🤝', metric: 'churn', cost: 10000, days: 12,
        effects: [{ op: 'mod', stat: 'churn', mult: 0.85 }], desc: 'Give new customers a quick win in week one.', notebook: 'better_not_more' },
      { id: 'delivery_checklist', name: 'Delivery Checklist', emoji: '✅', metric: 'deliveryEfficiency', cost: 11000, days: 12,
        effects: [{ op: 'mod', stat: 'deliveryEnergy', mult: 0.88 }], desc: 'Same result for customers, fewer steps for the team.', notebook: 'bloat' },
      { id: 'ad_lab', name: 'Ad Lab', emoji: '🧪', metric: 'cpl', cost: 14000, days: 10,
        effects: [{ op: 'mod', stat: 'adCpl', mult: 0.88 }], desc: 'Test ten hooks, keep the winner.', notebook: 'measure_it' },
      { id: 'kpi_board', name: 'KPI Board', emoji: '📊', metric: 'general', cost: 7000, days: 7,
        effects: [{ op: 'add', path: 'ops.efficiency', value: 6 }], desc: 'One screen, the numbers that matter, every morning.', notebook: 'measure_it' },
      { id: 'meeting_purge', name: 'Meeting Purge', emoji: '🧹', metric: 'general', cost: 5000, days: 6,
        effects: [{ op: 'add', path: 'ops.efficiency', value: 4 }, { op: 'add', path: 'team.morale', value: 5 }], desc: 'Cancel every meeting with no owner and no outcome.', notebook: 'bloat' }
    ],
    departments: [
      { id: 'marketing', name: 'Marketing', emoji: '📣', specCost: 24000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'adCpl', mult: 0.88 }, { stat: 'leadVolume', mult: 1.1 }], desc: 'Gets the leads.' },
      { id: 'sales', name: 'Sales', emoji: '🤝', specCost: 24000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'closeRate', mult: 1.06 }], desc: 'Turns leads into customers.' },
      { id: 'delivery', name: 'Delivery', emoji: '📦', specCost: 27000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'churn', mult: 0.85 }], desc: 'Keeps the promise.' },
      { id: 'people', name: 'People', emoji: '🧑‍🤝‍🧑', specCost: 18000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'hireRamp', mult: 1.3 }], desc: 'Hires, trains and keeps the team.' },
      { id: 'finance', name: 'Finance', emoji: '💰', specCost: 18000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'salaryCost', mult: 0.95 }], desc: 'Knows where every dollar goes.' },
      { id: 'tech', name: 'Tech', emoji: '🖥️', specCost: 30000, specHeadcount: 5, specSalary: 800,
        specEffects: [{ stat: 'teamOutput', mult: 1.06 }], desc: 'Tools that make everyone faster.' }
    ],
    fireTypes: [
      { id: 'ad_account_down', dept: 'marketing', title: 'Ad account frozen', emoji: '🧊', impact: 3, urgency: 3, days: 2,
        failEffects: [{ op: 'buff', stat: 'adCpl', mult: 1.4, days: 7, label: 'Ad account frozen' }], desc: 'No ads until someone sorts it out.' },
      { id: 'logo_debate', dept: 'marketing', title: 'Logo color debate', emoji: '🎨', impact: 1, urgency: 3, days: 2,
        failEffects: [], desc: 'Loud, urgent, and it does not matter.' },
      { id: 'top_closer_quits', dept: 'sales', title: 'Top sales rep wants to quit', emoji: '🚪', impact: 3, urgency: 2, days: 4,
        failEffects: [{ op: 'buff', stat: 'closeRate', mult: 0.8, days: 14, label: 'Lost the top sales rep' }], desc: 'Talk to them before they walk.' },
      { id: 'crm_typo', dept: 'sales', title: 'CRM field renamed', emoji: '🗂️', impact: 1, urgency: 2, days: 4, failEffects: [], desc: 'Annoying, not deadly.' },
      { id: 'angry_client_post', dept: 'delivery', title: 'Angry client goes public', emoji: '📢', impact: 2, urgency: 3, days: 2,
        failEffects: [{ op: 'buff', stat: 'refundRate', mult: 1.3, days: 10, label: 'Bad review spreading' }], desc: 'Make it right fast.' },
      { id: 'delivery_backlog', dept: 'delivery', title: 'Delivery backlog', emoji: '📦', impact: 3, urgency: 1, days: 6,
        failEffects: [{ op: 'buff', stat: 'churn', mult: 1.35, days: 14, label: 'Delivery backlog' }], desc: 'Customers are waiting too long.' },
      { id: 'office_snacks', dept: 'people', title: 'Snack drawer empty', emoji: '🍪', impact: 1, urgency: 3, days: 1, failEffects: [], desc: 'Everyone noticed. Nobody will remember.' },
      { id: 'manager_burnout', dept: 'people', title: 'Manager burning out', emoji: '🥵', impact: 2, urgency: 2, days: 4,
        failEffects: [{ op: 'add', path: 'team.morale', value: -8 }], desc: 'A tired manager makes a tired team.' },
      { id: 'payroll_error', dept: 'finance', title: 'Payroll error', emoji: '🧾', impact: 3, urgency: 3, days: 2,
        failEffects: [{ op: 'add', path: 'team.morale', value: -12 }], desc: 'People did not get paid right. Fix it today.' },
      { id: 'expense_form', dept: 'finance', title: 'New expense form drama', emoji: '📝', impact: 1, urgency: 1, days: 6, failEffects: [], desc: 'It will sort itself out.' },
      { id: 'site_down', dept: 'tech', title: 'Website down', emoji: '🔥', impact: 3, urgency: 3, days: 1,
        failEffects: [{ op: 'buff', stat: 'bookRate', mult: 0.7, days: 5, label: 'Site was down' }], desc: 'No site, no bookings.' },
      { id: 'laptop_upgrade', dept: 'tech', title: 'Everyone wants new laptops', emoji: '💻', impact: 1, urgency: 2, days: 4, failEffects: [], desc: 'Nice to have.' }
    ],
    bets: [
      { id: 'acquire_rival', name: 'Buy a Rival', emoji: '🦈', cost: 250000, days: 24, baseChance: 0.5,
        prep: [{ metric: 'deptHealthMin', gte: 70, bonus: 0.15 }, { metric: 'efficiency', gte: 75, bonus: 0.1 }],
        success: [{ op: 'mod', stat: 'adCpl', mult: 0.85 }, { op: 'mod', stat: 'referralRate', mult: 1.3 }],
        fail: [{ op: 'add', path: 'team.morale', value: -10 }], desc: 'Fold a competitor into your company.' },
      { id: 'new_market', name: 'New Market', emoji: '🌍', cost: 175000, days: 28, baseChance: 0.55,
        prep: [{ metric: 'profitMargin30', gte: 0.2, bonus: 0.1 }, { metric: 'specialistDepts', gte: 4, bonus: 0.15 }],
        success: [{ op: 'mod', stat: 'adCpl', mult: 0.8 }], fail: [{ op: 'buff', stat: 'adCpl', mult: 1.2, days: 20, label: 'Market flop' }],
        desc: 'Take what works to a fresh crowd.' },
      { id: 'new_category', name: 'New Product Category', emoji: '🚀', cost: 150000, days: 24, baseChance: 0.5,
        prep: [{ metric: 'premiumShare30', gte: 0.25, bonus: 0.15 }, { metric: 'efficiency', gte: 75, bonus: 0.1 }],
        success: [{ op: 'mod', stat: 'perceivedValue', mult: 1.15 }, { op: 'mod', stat: 'premiumTake', mult: 1.3 }],
        fail: [{ op: 'buff', stat: 'teamOutput', mult: 0.85, days: 20, label: 'Product flop' }], desc: 'Sell something new to the people who already love you.' },
      { id: 'own_platform', name: 'Own Software Platform', emoji: '🛠️', cost: 350000, days: 36, baseChance: 0.4,
        prep: [{ metric: 'deptHealth.tech', gte: 75, bonus: 0.2 }, { metric: 'efficiency', gte: 80, bonus: 0.15 }],
        success: [{ op: 'mod', stat: 'teamOutput', mult: 1.2 }, { op: 'mod', stat: 'churn', mult: 0.8 }],
        fail: [{ op: 'add', path: 'ops.efficiency', value: -10 }], desc: 'Big build, big moat, big risk.' }
    ]
  };

  var DEFAULT_SPEC_EFFECTS = {};
  FALLBACK.departments.forEach(function (d) { DEFAULT_SPEC_EFFECTS[d.id] = d.specEffects; });

  // ---------------------------------------------------------------------------
  // small utils
  // ---------------------------------------------------------------------------
  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : d; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r1(x) { return Math.round(num(x, 0) * 10) / 10; }
  function pct(x) { var v = num(x, 0) * 100; return (Math.abs(v) < 10 ? r1(v) : Math.round(v)) + '%'; }
  function money(x) {
    x = num(x, 0); var neg = x < 0; x = Math.abs(x);
    if (x >= 1e6) return (neg ? '-$' : '$') + (Math.round(x / 1e5) / 10) + 'M';
    var s = String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s;
  }
  function findById(list, id) {
    list = arr(list);
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function getPath(obj, path) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur === null || cur === undefined) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function C(content) { return content || ZTE.Content || {}; }
  function list(content, key) {
    var l = arr(C(content)[key]);
    return l.length ? l : FALLBACK[key];
  }
  function deptDefs(content) {
    var l = arr(C(content).departments), out = [];
    DEPT_IDS.forEach(function (id) { out.push(findById(l, id) || findById(FALLBACK.departments, id)); });
    return out;
  }
  function deptDef(content, id) { return findById(deptDefs(content), id); }
  function deptName(content, id) { var d = deptDef(content, id); return (d && d.name) || id; }

  // ---------------------------------------------------------------------------
  // api: captured from the core on the first system call; fallback built from ZTE.Engine exports
  // ---------------------------------------------------------------------------
  var API = null;
  function fallbackApi() {
    return {
      TUNING: E.TUNING || {},
      rand: E.rand || function () { return 0.5; },
      chance: function (s, p) { return (E.rand ? E.rand(s) : 0.5) < p; },
      binom: function (s, n, p) { var k = 0; for (var i = 0; i < n; i++) if ((E.rand ? E.rand(s) : 0.5) < p) k++; return k; },
      stochRound: function (s, x) { var f = Math.floor(x); return f + ((E.rand ? E.rand(s) : 0.5) < x - f ? 1 : 0); },
      addLeads: function (s, n) { s.leads = num(s.leads, 0) + n; },
      earn: function (s, a) { s.cash += a; },
      spend: function (s, a) { s.cash -= a; },
      pushLog: function (s, type, text) { if (s.log) s.log.push({ day: s.day, type: type, text: String(text) }); },
      applyEffects: E.applyEffects || function () { return []; },
      unlockNotebook: function (s, c, id) {
        var ev = E.applyEffects ? E.applyEffects(s, c, [{ op: 'notebook', id: id }]) : [];
        return ev[0] || null;
      },
      m: function (s, stat) {
        var v = num(s.mods && s.mods[stat], 1), b = arr(s.buffs);
        for (var i = 0; i < b.length; i++) if (b[i] && b[i].stat === stat) v *= num(b[i].mult, 1);
        return v * num(s._sysMods && s._sysMods[stat], 1);
      },
      getFlavor: E.getFlavor || function () { return {}; },
      computeMetrics: E.computeMetrics,
      last30: null,
      money: money
    };
  }
  function A(api) { if (api) API = api; return API || fallbackApi(); }

  // ---------------------------------------------------------------------------
  // state guards (idempotent; old saves and partial core state stay safe)
  // ---------------------------------------------------------------------------
  function ensure(state) {
    if (!state.ops || typeof state.ops !== 'object') state.ops = { efficiency: 80, project: null, done: [] };
    state.ops.efficiency = clamp(num(state.ops.efficiency, 80), 0, 100);
    if (!Array.isArray(state.ops.done)) state.ops.done = [];
    if (!state.depts || typeof state.depts !== 'object') state.depts = {};
    DEPT_IDS.forEach(function (id) {
      var d = state.depts[id];
      if (!d || typeof d !== 'object') d = state.depts[id] = { health: 80, spec: 0 };
      d.health = clamp(num(d.health, 80), 0, 100); d.spec = clamp(Math.round(num(d.spec, 0)), 0, LT.specMax);
    });
    if (!Array.isArray(state.fires)) state.fires = [];
    if (!state.attention || typeof state.attention !== 'object') state.attention = { max: 3, left: 3 };
    state.attention.max = clamp(Math.round(num(state.attention.max, 3)), 1, 10);
    state.attention.left = clamp(num(state.attention.left, state.attention.max), 0, state.attention.max);
    state.calmDays = Math.max(0, num(state.calmDays, 0));
    if (state.bet === undefined) state.bet = null;
    if (!state.exit || typeof state.exit !== 'object') state.exit = { sold: false, valuation: 0, score: 0, wisdom: 0 };
    if (!state.flags) state.flags = {};
    if (!state._sysMods || typeof state._sysMods !== 'object') state._sysMods = {};
    if (!state.team || typeof state.team !== 'object') state.team = { coach: 0, closer: 0, setter: 0, manager: 0, ramp: [], morale: 80 };
  }
  function sm(state, key, mult) {
    if (!(mult > 0) || !isFinite(mult)) return;
    state._sysMods[key] = num(state._sysMods[key], 1) * mult;
  }

  // ---------------------------------------------------------------------------
  // shared numbers
  // ---------------------------------------------------------------------------
  function coreStaff(state) {
    var t = state.team || {}, n = 0;
    ROLE_IDS.forEach(function (r) { n += Math.max(0, num(t[r], 0)); });
    return n;
  }
  // per-level value: a number (same every level) or an array [lvl1, lvl2, lvl3] (same rule as the core)
  function perLevel(x, lvl, dflt) {
    if (Array.isArray(x)) { var s = 0; for (var i = 0; i < lvl; i++) s += num(x[Math.min(i, x.length - 1)], dflt); return s; }
    return num(x, dflt) * lvl;
  }
  function levelValue(x, lvl, dflt) { return Array.isArray(x) ? num(x[Math.min(lvl - 1, x.length - 1)], dflt) : num(x, dflt); }
  // payroll here is raw (before salaryCost); headcount/payroll come from the core when it offers them so both agree
  function specInfo(state, content) {
    var hc = 0, pay = 0, depts = 0;
    deptDefs(content).forEach(function (d) {
      var s = clamp(Math.floor(num(state.depts && state.depts[d.id] && state.depts[d.id].spec, 0)), 0, LT.specMax);
      hc += perLevel(d.specHeadcount, s, 5); pay += perLevel(d.specSalary, s, 800);
      if (s >= LT.specDeptsLevel) depts++;
    });
    var api = A();
    if (typeof api.specialistInfo === 'function') {
      try {
        var ci = api.specialistInfo(state, C(content));
        if (ci && typeof ci.headcount === 'number') hc = ci.headcount;
        if (ci && typeof ci.payroll === 'number') pay = ci.payroll / Math.max(0.05, api.m(state, 'salaryCost'));
      } catch (e) { /* keep own numbers */ }
    }
    return { headcount: Math.round(hc), payroll: pay, depts: depts };
  }
  function headcount(state, content) { return 1 + coreStaff(state) + specInfo(state, content).headcount; }

  // revenue / profit over a window of daily stats: offset 0 = last 30 days, 30 = the 30 before that
  function windowSums(state, offset) {
    var d = arr(state.stats && state.stats.daily), o = { revenue: 0, profit: 0, hasProfit: false, days: 0, premium: 0 };
    var end = d.length - offset, start = Math.max(0, end - 30);
    for (var i = start; i < end; i++) {
      var x = d[i] || {};
      o.revenue += num(x.revenue, 0); o.premium += num(x.premiumRevenue, 0); o.days++;
      if (typeof x.profit === 'number') { o.profit += x.profit; o.hasProfit = true; }
      else o.profit += num(x.revenue, 0) - num(x.adSpend, 0) - num(x.toolSpend, 0) - num(x.payroll, 0) - num(state.livingCost, 0);
    }
    return o;
  }
  function revenue30(state) { return windowSums(state, 0).revenue; }

  // ---------------------------------------------------------------------------
  // effects with strength scaling + late paths handled here (robust if core's allow-list lags)
  // ---------------------------------------------------------------------------
  var LATE_PATHS = { 'ops.efficiency': [0, 100], 'calmDays': [0, 9999], 'attention.max': [1, 10], 'team.morale': [0, 100], 'focus': [0, 100] };
  function latePathRange(p) {
    if (LATE_PATHS[p]) return LATE_PATHS[p];
    if (/^depts\.(marketing|sales|delivery|people|finance|tech)\.health$/.test(p)) return [0, 100];
    return null;
  }
  function scaleEffect(e, s) {
    if (s === 1 || !e) return e;
    var c = {}; for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k];
    if ((c.op === 'mod' || c.op === 'buff') && typeof c.mult === 'number') c.mult = 1 + (c.mult - 1) * s;
    else if (c.op === 'add' && typeof c.value === 'number') c.value = c.value * s;
    else if (c.op === 'mul' && typeof c.value === 'number') c.value = 1 + (c.value - 1) * s;
    return c;
  }
  function applyFx(state, content, api, effects, strength) {
    var rest = [], events = [];
    strength = num(strength, 1);
    arr(effects).forEach(function (e0) {
      var e = scaleEffect(e0, strength);
      if (!e || typeof e !== 'object') return;
      var rng = (e.op === 'add' || e.op === 'set' || e.op === 'mul') ? latePathRange(e.path) : null;
      if (rng) {
        var cur = num(getPath(state, e.path), 0), v = cur;
        if (e.op === 'add') v = cur + num(e.value, 0); else if (e.op === 'mul') v = cur * num(e.value, 1); else v = num(e.value, cur);
        v = clamp(v, rng[0], rng[1]);
        if (e.path === 'attention.max') { v = Math.round(v); state.attention.left = clamp(state.attention.left + (v - state.attention.max), 0, v); }
        var parts = e.path.split('.'), o = state;
        for (var i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
        o[parts[parts.length - 1]] = v;
      } else rest.push(e);
    });
    if (rest.length) {
      var ev = api.applyEffects(state, C(content), rest);
      if (Array.isArray(ev)) events = events.concat(ev);
    }
    return events;
  }
  function nb(state, content, api, id, events) {
    if (!id || arr(state.notebook).indexOf(id) >= 0) return;
    var ev = api.unlockNotebook(state, C(content), id);
    if (ev && events) events.push(ev);
  }
  function refresh(state, content) {
    // re-run every system's recompute after an action (same as the core does at the start of a day)
    var api = A();
    if (typeof api.recompute === 'function') { api.recompute(state, C(content)); return; }
    if (typeof E.recomputeSystems === 'function') { E.recomputeSystems(state, content); return; }
    state._sysMods = {};
    arr(E.systems).forEach(function (s) {
      if (!s || typeof s.recompute !== 'function' || num(s.minLevel, 1) > state.level) return;
      try { s.recompute(state, C(content), api); } catch (err) { if (typeof console !== 'undefined') console.warn('[engine-late] recompute ' + s.id + ': ' + err.message); }
    });
  }

  // ---------------------------------------------------------------------------
  // 4.1 efficiency & weakest metric & projects
  // ---------------------------------------------------------------------------
  function bloatInfo(state, content) {
    var hc = headcount(state, content);
    var units = Math.max(0, hc - LT.bloatFreeHeadcount) / 10;
    var raw = LT.bloatPer10 * units / (1 + units / LT.bloatSoftCap);
    var s = state.sops || {};
    var sopAvg = (num(s.delivery, 0) + num(s.sales, 0) + num(s.marketing, 0) + num(s.hiring, 0)) / 4;
    var sopF = Math.max(0.4, 1 - LT.bloatSopCut * sopAvg);
    var t = state.team || {}, staff = coreStaff(state);   // specialist teams come with their own department heads
    var span = 6 + num(s.hiring, 0);
    var covered = staff > 0 ? Math.min(1, (4 + num(t.manager, 0) * span) / staff) : 1;
    var mgrF = 1.25 - 0.45 * covered;
    var tech = state.depts && state.depts.tech ? state.depts.tech : { health: 80, spec: 0 };
    var techF = (1.4 - 0.8 * num(tech.health, 80) / 100) * Math.max(0.4, 1 - LT.bloatTechSpecCut * num(tech.spec, 0));
    return { headcount: hc, raw: raw, sopF: sopF, mgrF: mgrF, techF: techF, coverage: covered, perDay: raw * sopF * mgrF * techF };
  }

  // score = how healthy a metric is vs its benchmark (1 = healthy, lower = weaker); cost-like metrics are inverted
  function weakest(state, content, metrics) {
    var api = A(), b = LT.bench, mt = metrics || {}, scores = {}, vals = {}, benches = {};
    function put(id, val, bench, inverted) {
      if (!(val > 0) || !(bench > 0)) return;
      vals[id] = val; benches[id] = bench;
      scores[id] = clamp(inverted ? bench / val : val / bench, 0, 2);
    }
    // the share of leads that really books (after lead quality and the cap), so a booking project can move it
    put('bookRate', mt.bookedRate !== undefined ? num(mt.bookedRate, 0) : num(mt.bookRate, 0) * num(mt.leadQuality, 1), b.bookRate);
    put('showRate', num(mt.showRate, 0), b.showRate);
    put('closeRate', num(mt.closeRate, 0), b.closeRate);
    var mb = state.combos && state.combos.membership;
    if ((mb && mb.on) || num(state.customers && state.customers.members, 0) > 0) put('churn', num(mt.churnMonthly, 0), b.churn, true);
    // the delivery multiplier the simulation really uses (after the Level 4 floor). Overload is a hiring signal
    // (more coaches), not something a project fixes, so it does not count here.
    var dE = 1 / Math.max(0.05, api.deliveryMod ? api.deliveryMod(state) : api.m(state, 'deliveryEnergy'));
    put('deliveryEfficiency', dE, b.deliveryEfficiency);
    var ads = state.channels && state.channels.ads;
    if (ads && ads.unlocked && (num(ads.dailyBudget, 0) > 0 || num(mt.adSpend30, 0) > 0)) {
      var fl = api.getFlavor(state, C(content)) || {};
      put('cpl', num(mt.cpl, 0), num(fl.adCplBase, 30) * b.cplShare, true);
    }
    // a number already at its best possible value cannot be the weakest link: no project can move it
    var T = api.TUNING || {}, maxed = {};
    if (vals.bookRate >= num(T.bookMax, 9) - 1e-6) maxed.bookRate = true;
    if (vals.showRate >= num(T.showMax, 9) - 1e-6) maxed.showRate = true;
    if (vals.closeRate >= num(T.closeMax, 9) - 1e-6) maxed.closeRate = true;
    if (vals.churn !== undefined && vals.churn <= num(T.churnMin, -1) + 1e-6) maxed.churn = true;
    if (vals.deliveryEfficiency !== undefined && vals.deliveryEfficiency >= 1 / Math.max(0.05, num(T.deliveryEnergyLateMin, 0.01)) - 1e-6) maxed.deliveryEfficiency = true;
    var best = null, any = null;
    METRIC_IDS.forEach(function (id) {
      if (scores[id] === undefined) return;
      if (any === null || scores[id] < scores[any]) any = id;
      if (!maxed[id] && (best === null || scores[id] < scores[best])) best = id;
    });
    return { id: best || any || 'closeRate', scores: scores, values: vals, benches: benches, maxed: maxed };
  }

  function projectDefs(content) { return list(content, 'projects'); }
  function projectCost(state, content, id) {
    var p = findById(projectDefs(content), id); if (!p) return 0;
    var times = 0; arr(state.ops && state.ops.done).forEach(function (d) { if (d === id) times++; });
    return Math.round(num(p.cost, 10000) * (1 + LT.projectRepeatCost * times));
  }

  function startProject(state, content, id) {
    content = C(content); ensure(state);
    var api = A(), p = findById(projectDefs(content), id);
    if (!p) return { ok: false, reason: 'Unknown project.' };
    if (state.level < 7) return { ok: false, reason: 'Projects open at Level 7.' };
    if (state.exit.sold) return { ok: false, reason: 'You already sold the company.' };
    if (state.ops.project) return { ok: false, reason: 'One project at a time. Finish the current one first.' };
    var cost = projectCost(state, content, id);
    if (state.cash < cost) return { ok: false, reason: 'Need ' + money(cost) + ' for this project.' };
    var wk = null;
    try { var mt = api.computeMetrics ? api.computeMetrics(state, content) : null; wk = mt && mt.weakestMetric; } catch (e) { wk = null; }
    api.spend(state, cost, 'project');
    state.ops.project = { id: id, daysLeft: Math.max(1, Math.round(num(p.days, 10))), weakAtStart: wk || null, cost: cost };
    var events = [];
    api.pushLog(state, 'info', 'Project started: ' + (p.name || id));
    nb(state, content, api, 'measure_it', events);
    refresh(state, content);
    return { ok: true, events: events, cost: cost };
  }

  function finishProject(state, content, api, events) {
    var pr = state.ops.project, p = findById(projectDefs(content), pr.id);
    state.ops.project = null;
    if (!p) return;
    var times = 0; arr(state.ops.done).forEach(function (d) { if (d === p.id) times++; });
    state.ops.done.push(p.id);
    var general = !p.metric || p.metric === 'general';
    // a repeat finds less to fix: each earlier run of the same project halves the effect (efficiency bonus stays)
    var repeatF = Math.pow(LT.projectRepeatEffect, times);
    var wkNow = null;
    try { var mt = api.computeMetrics ? api.computeMetrics(state, content) : null; wkNow = mt && mt.weakestMetric; } catch (e) { wkNow = null; }
    // SPEC-GAP: counts as "the weakest" if it was the weakest when started OR when finished (luck can shift it mid-project)
    var full = general || p.metric === wkNow || p.metric === pr.weakAtStart;
    var ev = applyFx(state, content, api, p.effects, (full ? 1 : 0.5) * repeatF);
    var bonus = general ? 0 : full ? LT.effFullBonus : LT.effHalfBonus;
    state.ops.efficiency = clamp(state.ops.efficiency + bonus, 0, 100);
    var nm = (p.emoji ? p.emoji + ' ' : '') + (p.name || p.id);
    var text = general ? nm + ' done! Efficiency now ' + Math.round(state.ops.efficiency) + '.'
      : full ? nm + ' fixed your weakest link! Full effect + ' + bonus + ' efficiency.'
        : nm + ' done, but ' + (METRIC_NAMES[p.metric] || p.metric) + ' was not the weakest link. Half effect + ' + bonus + ' efficiency.';
    if (times > 0) text += ' (Repeat #' + (times + 1) + ': the effect is ' + Math.round(repeatF * 100) + '% of the first run.)';
    api.pushLog(state, 'info', text);
    events.push({ type: 'info', kind: 'project', id: p.id, full: !!full, text: text });
    if (full && !general) nb(state, content, api, 'better_not_more', events);
    if (p.notebook) nb(state, content, api, p.notebook, events);   // `teaches` is the lesson text, `notebook` the lesson id
    events.push.apply(events, ev);
  }

  var sysEfficiency = {
    id: 'efficiency', minLevel: 7,
    // the first honest measurement at Level 7: the growth so far left the company at LT.effStart (cards played
    // earlier keep their +/- on top), so the first projects matter
    init: function (state, content, api) {
      A(api); ensure(state);
      state.ops.efficiency = clamp(state.ops.efficiency - (80 - LT.effStart), 0, 100);
      // say it out loud: the drop is the first honest measurement, not a punishment for something just done
      if (api && api.pushLog) api.pushLog(state, 'info', 'First honest measurement: efficiency ' + Math.round(state.ops.efficiency) +
        '/100. Growth added meetings, handoffs and mix-ups, so everyone got a bit slower. Run an improvement project before you hire again.');
    },
    recompute: function (state, content, api) {
      A(api); ensure(state);
      var eff = state.ops.efficiency;
      sm(state, 'teamOutput', 0.6 + 0.4 * eff / 100);
      sm(state, 'salaryCost', 1 + (80 - eff) / 400);
    },
    onDay: function (state, content, api, events) {
      A(api); ensure(state); content = C(content);
      if (state.exit.sold) return;
      var b = bloatInfo(state, content);
      state.ops.efficiency = clamp(state.ops.efficiency - b.perDay, 0, 100);
      if (state.ops.project) {
        state.ops.project.daysLeft = num(state.ops.project.daysLeft, 1) - 1;
        if (state.ops.project.daysLeft <= 0) finishProject(state, content, api, events);
      }
      if (state.ops.efficiency < 72) nb(state, content, api, 'bloat', events);
    },
    onMetrics: function (state, content, metrics, api) {
      A(api); ensure(state); content = C(content);
      var why = companyWhy(metrics);
      var eff = state.ops.efficiency, b = bloatInfo(state, content), wk = weakest(state, content, metrics);
      metrics.efficiency = Math.round(eff * 10) / 10;
      metrics.weakestMetric = wk.id;
      metrics.weakestScores = wk.scores;
      metrics.projectDaysLeft = state.ops.project ? Math.max(0, num(state.ops.project.daysLeft, 0)) : 0;
      metrics.projectId = state.ops.project ? state.ops.project.id : null;
      metrics.bloatPerDay = Math.round(b.perDay * 100) / 100;
      why.push('Efficiency ' + Math.round(eff) + '/100 → team output ×' + (0.6 + 0.4 * eff / 100).toFixed(2) +
        ', salaries ×' + (1 + (80 - eff) / 400).toFixed(2));
      if (b.raw > 0) why.push('Bloat: ' + Math.round(b.headcount) + ' people (' + Math.round(b.headcount - LT.bloatFreeHeadcount) + ' above ' + LT.bloatFreeHeadcount + ') → −' +
        b.raw.toFixed(2) + '/day × Playbooks ' + b.sopF.toFixed(2) + ' × managers ' + b.mgrF.toFixed(2) + ' (' + pct(b.coverage) + ' covered) × tech ' +
        b.techF.toFixed(2) + ' = −' + b.perDay.toFixed(2) + ' efficiency/day');
      else why.push('No bloat yet: ' + Math.round(b.headcount) + ' people (bloat starts above ' + LT.bloatFreeHeadcount + ')');
      if (wk.values[wk.id] !== undefined) {
        var v = wk.values[wk.id], bn = wk.benches[wk.id];
        var show = (wk.id === 'cpl') ? money(v) + ' vs healthy ' + money(bn) : (wk.id === 'deliveryEfficiency') ? v.toFixed(2) + ' vs healthy ' + bn.toFixed(2) : pct(v) + ' vs healthy ' + pct(bn);
        why.push('Weakest link: ' + METRIC_NAMES[wk.id] + ' ' + show + ' (score ' + wk.scores[wk.id].toFixed(2) + '). A project on it gives full effect + ' + LT.effFullBonus + ' efficiency; others half + ' + LT.effHalfBonus);
      }
      if (state.ops.project) {
        var p = findById(projectDefs(content), state.ops.project.id);
        why.push('Project ' + ((p && p.name) || state.ops.project.id) + ': ' + metrics.projectDaysLeft + ' day' + (metrics.projectDaysLeft === 1 ? '' : 's') + ' left');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 4.2 departments, fires, attention, calm days
  // ---------------------------------------------------------------------------
  function healthDelta(h) { return (num(h, 80) - LT.deptNeutral) / 100; }   // −0.7 .. +0.3
  function deptMods(state) {
    var d = state.depts, o = {};
    var mk = healthDelta(d.marketing.health), sa = healthDelta(d.sales.health), de = healthDelta(d.delivery.health);
    var pe = healthDelta(d.people.health), fi = healthDelta(d.finance.health), te = healthDelta(d.tech.health);
    o.adCpl = 1 - 0.5 * mk;            // health 0 → ×1.35, 100 → ×0.85
    o.closeRate = 1 + 0.4 * sa;        // 0 → ×0.72, 100 → ×1.12
    o.churn = 1 - 0.6 * de;            // 0 → ×1.42, 100 → ×0.82
    o.refundRate = 1 - 0.5 * de;
    o.hireRamp = Math.max(0.3, 1 + 0.6 * pe);
    o.salaryCost = 1 - 0.2 * fi;       // 0 → ×1.14
    o.teamOutput = 1 + 0.1 * te;
    return o;
  }
  function deptHealthMin(state) {
    var mn = 100, who = DEPT_IDS[0];
    DEPT_IDS.forEach(function (id) { if (state.depts[id].health < mn) { mn = state.depts[id].health; who = id; } });
    return { value: mn, id: who };
  }
  function fireTypes(content) { return list(content, 'fireTypes'); }
  function fireDays(t) { return Math.max(1, Math.round(num(t.days, [6, 6, 4, 2][clamp(Math.round(num(t.urgency, 2)), 1, 3)]))); }

  function spawnFire(state, content, api, events) {
    var types = fireTypes(content), open = {}, cands = [], total = 0;
    state.fires.forEach(function (f) { open[f.typeId] = true; });
    types.forEach(function (t) {
      if (!t || !t.id || open[t.id]) return;
      var dp = state.depts[t.dept] || { health: 80, spec: 0 };
      // the content's spawn weight (big fires are rarer), and weak departments catch a few more fires
      var w = Math.max(0, num(t.weight, 1)) * Math.max(0.3, 1.1 - dp.health / 200) * Math.max(0.3, 1 - 0.15 * dp.spec);
      if (w > 0) { cands.push([t, w]); total += w; }
    });
    if (!cands.length || !(total > 0)) return;
    var r = api.rand(state) * total, pick = cands[cands.length - 1][0];
    for (var i = 0; i < cands.length; i++) { r -= cands[i][1]; if (r <= 0) { pick = cands[i][0]; break; } }
    state._fireSeq = num(state._fireSeq, 0) + 1;
    var f = { uid: 'f' + state._fireSeq, typeId: pick.id, dept: DEPT_IDS.indexOf(pick.dept) >= 0 ? pick.dept : 'people',
      impact: clamp(Math.round(num(pick.impact, 1)), 1, 3), urgency: clamp(Math.round(num(pick.urgency, 2)), 1, 3),
      daysLeft: fireDays(pick), day: state.day, title: pick.title || pick.id, emoji: pick.emoji || '🔥' };
    state.fires.push(f);
    var text = f.emoji + ' Fire in ' + deptName(content, f.dept) + ': ' + f.title + (f.impact >= 3 ? ' (big one!)' : '');
    api.pushLog(state, 'fire', text);
    events.push({ type: 'fire', id: f.uid, dept: f.dept, impact: f.impact, urgency: f.urgency, text: text });
    nb(state, content, api, 'triage', events);
  }

  function burnFire(state, content, api, f, events) {
    var t = findById(fireTypes(content), f.typeId) || {};
    var dp = state.depts[f.dept];
    var dmg = burnDamage(f);
    if (dp) dp.health = clamp(dp.health - dmg, 0, 100);
    // cash a burned fire costs is a real operating loss: book it as a cost (profit, margins, valuation), not a silent cash change
    var fx = arr(t.failEffects).filter(function (e) {
      if (e && e.op === 'add' && e.path === 'cash' && num(e.value, 0) < 0) { api.spend(state, -num(e.value, 0), 'loss'); return false; }
      return true;
    });
    var ev = applyFx(state, content, api, fx, 1);
    var what = t.failText ? ' ' + t.failText : (f.impact <= 1 ? ' blew over on its own.' : ' burned out of control.');
    var text = f.emoji + ' ' + f.title + (t.failText ? ':' : '') + what + ' ' + deptName(content, f.dept) + ' health −' + dmg + '.';
    api.pushLog(state, 'fire', text);
    events.push({ type: 'fire', burned: true, id: f.uid, dept: f.dept, impact: f.impact, text: text, teaches: t.teaches || '' });
    events.push.apply(events, ev);
  }

  function burnDamage(f) { return num(f.impact, 1) <= 1 ? LT.fireNoiseBurnHealth : num(f.impact, 1) * LT.fireBurnHealth; }
  function handleFire(state, content, uid) {
    content = C(content); ensure(state);
    var api = A();
    if (state.level < 8) return { ok: false, reason: 'Fires start at Level 8.', events: [] };
    var idx = -1;
    for (var i = 0; i < state.fires.length; i++) if (state.fires[i] && String(state.fires[i].uid) === String(uid)) { idx = i; break; }
    if (idx < 0) return { ok: false, reason: 'That fire is already out.', events: [] };
    if (state.attention.left < 1) return { ok: false, reason: 'No CEO attention left this week. Pick your fires wisely!', events: [] };
    var f = state.fires.splice(idx, 1)[0];
    state.attention.left -= 1;
    var dp = state.depts[f.dept];
    if (dp) dp.health = clamp(dp.health + LT.fireHandleHealth, 0, 100);
    var ft = findById(fireTypes(content), f.typeId) || {};
    var events = [], text = 'You handled it: ' + f.title + '. ' + (ft.fixText ? ft.fixText + ' ' : '') + deptName(content, f.dept) + ' health +' + LT.fireHandleHealth + '.';
    api.pushLog(state, 'info', text);
    events.push({ type: 'info', kind: 'fireHandled', id: f.uid, text: text, teaches: ft.teaches || '' });
    nb(state, content, api, 'ceo_attention', events);
    refresh(state, content);
    return { ok: true, events: events };
  }

  var sysDepts = {
    id: 'departments', minLevel: 8,
    init: function (state, content, api) { A(api); ensure(state); },
    recompute: function (state, content, api) {
      A(api); ensure(state);
      var o = deptMods(state);
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) sm(state, k, o[k]);
    },
    onDay: function (state, content, api, events) {
      A(api); ensure(state); content = C(content);
      if (state.exit.sold) return;
      // first L8 day: attention clock starts, departments lesson
      if (state._attnDay === undefined || state._attnDay === null) { state._attnDay = state.day; state.attention.left = state.attention.max; }
      nb(state, content, api, 'departments', events);
      if (state.day - state._attnDay >= LT.attentionWeek) { state._attnDay = state.day; state.attention.left = state.attention.max; }

      var hc = headcount(state, content), s = state.sops || {};
      var sopAvg = (num(s.delivery, 0) + num(s.sales, 0) + num(s.marketing, 0) + num(s.hiring, 0)) / 4;
      var openByDept = {};
      state.fires.forEach(function (f) { if (num(f.impact, 1) >= 2) openByDept[f.dept] = true; });
      DEPT_IDS.forEach(function (id) {
        var d = state.depts[id];
        // decay eases as health falls (people improvise), specialists keep their own department in shape
        var decay = LT.deptDecayPer50 * hc / 50 * Math.max(0.3, 1 - LT.deptSpecDecayCut * d.spec) * Math.max(0.6, 1 - 0.1 * sopAvg) *
          (0.4 + 0.6 * d.health / 100);
        var rec = (!openByDept[id] && d.health < LT.deptRecoverTo) ? LT.deptRecover * (1 + d.spec) + LT.deptRecoverGap * (LT.deptRecoverTo - d.health) : 0;
        d.health = clamp(d.health - decay + rec, 0, 100);
      });
      // people health nudges morale
      if (state.team) state.team.morale = clamp(num(state.team.morale, 80) + (state.depts.people.health - 60) * 0.01, 0, 100);

      // specialist teams (L9+) put out fires in their own department
      if (state.level >= 9) {
        for (var j = state.fires.length - 1; j >= 0; j--) {
          var ff = state.fires[j], dsp = state.depts[ff.dept] ? state.depts[ff.dept].spec : 0;
          if (dsp > 0 && api.chance(state, LT.specAutoResolve * dsp)) {
            state.fires.splice(j, 1);
            var tx = 'Your ' + deptName(content, ff.dept) + ' specialists put out "' + ff.title + '" without you.';
            api.pushLog(state, 'info', tx);
            events.push({ type: 'info', kind: 'fireHandled', id: ff.uid, auto: true, text: tx });
          }
        }
      }
      // burn down open fires
      var burnedBig = false;
      for (var i = state.fires.length - 1; i >= 0; i--) {
        var f = state.fires[i];
        if (state.depts[f.dept] && f.impact >= 2) state.depts[f.dept].health = clamp(state.depts[f.dept].health - LT.fireSmoulder * f.impact, 0, 100);
        f.daysLeft = num(f.daysLeft, 1) - 1;
        if (f.daysLeft <= 0) {
          state.fires.splice(i, 1);
          burnFire(state, content, api, f, events);
          if (f.impact >= 3) burnedBig = true;
        }
      }
      // new fire?
      var p = Math.min(LT.fireMax, LT.fireBase + hc * LT.firePerHead);
      if (state.fires.length < LT.maxOpenFires && api.chance(state, p)) spawnFire(state, content, api, events);
      // calm streak: no impact-3 fire burned today, and none left open for more than a full day
      var lingering = false;
      state.fires.forEach(function (f2) { if (f2.impact >= 3 && state.day - num(f2.day, state.day) >= 2) lingering = true; });
      state.calmDays = (burnedBig || lingering) ? 0 : state.calmDays + 1;
    },
    onMetrics: function (state, content, metrics, api) {
      A(api); ensure(state); content = C(content);
      var why = companyWhy(metrics), mn = deptHealthMin(state), crit = 0, o = deptMods(state);
      state.fires.forEach(function (f) { if (f.impact >= 3) crit++; });
      metrics.deptHealthMin = Math.round(mn.value * 10) / 10;
      metrics.weakestDept = mn.id;
      metrics.deptHealth = {};
      DEPT_IDS.forEach(function (id) { metrics.deptHealth[id] = Math.round(state.depts[id].health * 10) / 10; });
      metrics.openFires = state.fires.length;
      metrics.criticalFires = crit;
      metrics.calmDays = state.calmDays;
      metrics.attentionLeft = state.attention.left;
      metrics.attentionMax = state.attention.max;
      var since = state._attnDay === undefined || state._attnDay === null ? 0 : state.day - state._attnDay;
      metrics.attentionRefillDays = Math.max(1, LT.attentionWeek - since);
      metrics.fireChance = Math.min(LT.fireMax, LT.fireBase + headcount(state, content) * LT.firePerHead);
      why.push('Department health: ' + DEPT_IDS.map(function (id) { return deptName(content, id) + ' ' + Math.round(state.depts[id].health); }).join(' · ') +
        ' (lowest: ' + deptName(content, mn.id) + ')');
      why.push('Health effects: ads ×' + o.adCpl.toFixed(2) + ' per lead, close rate ×' + o.closeRate.toFixed(2) + ', churn ×' + o.churn.toFixed(2) +
        ', hire ramp ×' + o.hireRamp.toFixed(2) + ', salaries ×' + o.salaryCost.toFixed(2));
      why.push('Fires: ' + state.fires.length + ' open (' + crit + ' big). New fire chance ' + pct(metrics.fireChance) + '/day at ' + Math.round(headcount(state, content)) +
        ' people. CEO attention ' + state.attention.left + '/' + state.attention.max + ', refills in ' + metrics.attentionRefillDays + ' day' + (metrics.attentionRefillDays === 1 ? '' : 's'));
      why.push('Calm streak: ' + state.calmDays + ' day' + (state.calmDays === 1 ? '' : 's') + ' (a big fire left burning resets it). A burned fire costs its department impact × ' + LT.fireBurnHealth + ' health (small noise only ' + LT.fireNoiseBurnHealth + ')');
    }
  };

  // ---------------------------------------------------------------------------
  // 4.3 specialists
  // ---------------------------------------------------------------------------
  function specEffectsOf(d) {
    var se = d && d.specEffects, out = [];
    if (Array.isArray(se)) se.forEach(function (x) { if (x && x.stat && typeof x.mult === 'number') out.push({ stat: x.stat, mult: x.mult }); });
    else if (se && typeof se === 'object') for (var k in se) if (typeof se[k] === 'number') out.push({ stat: k, mult: se[k] });
    if (!out.length && d) out = arr(DEFAULT_SPEC_EFFECTS[d.id]);
    return out;
  }
  // one-time cost: specCost × the new level (specCost may also be an array of exact per-level prices)
  function specCostOf(d, next) {
    return Math.round(Array.isArray(d.specCost) ? levelValue(d.specCost, next, 40000) : num(d.specCost, 40000) * next);
  }
  function upgradeDept(state, content, deptId) {
    content = C(content); ensure(state);
    var api = A(), d = deptDef(content, deptId), st = state.depts[deptId];
    if (!d || !st) return { ok: false, reason: 'Unknown department.' };
    if (state.level < 9) return { ok: false, reason: 'Specialist teams open at Level 9.' };
    if (state.exit.sold) return { ok: false, reason: 'You already sold the company.' };
    if (st.spec >= LT.specMax) return { ok: false, reason: (d.name || deptId) + ' already has a full specialist team.' };
    var next = st.spec + 1, cost = specCostOf(d, next);
    if (state.cash < cost) return { ok: false, reason: 'Need ' + money(cost) + ' to build this team.' };
    api.spend(state, cost, 'dept');
    st.spec = next;
    st.health = clamp(st.health + LT.specHealth, 0, 100);
    var ps = typeof api.payScale === 'function' ? num(api.payScale(state, content), 1) : 1;
    var events = [], text = (d.emoji ? d.emoji + ' ' : '') + (d.name || deptId) + ' specialists level ' + next + ': +' + levelValue(d.specHeadcount, next, 5) +
      ' people, +' + money(levelValue(d.specSalary, next, 800) * ps) + '/day payroll, health +' + LT.specHealth + '.';
    api.pushLog(state, 'info', text);
    events.push({ type: 'info', kind: 'specialist', id: deptId, level: next, text: text });
    nb(state, content, api, 'specialists', events);
    if (next >= 2) nb(state, content, api, 'department_heads', events);
    if (next >= 3) nb(state, content, api, 'a_players', events);
    refresh(state, content);
    return { ok: true, events: events, cost: cost };
  }

  var sysSpecialists = {
    id: 'specialists', minLevel: 9,
    init: function (state, content, api) { A(api); ensure(state); },
    recompute: function (state, content, api) {
      A(api); ensure(state);
      deptDefs(content).forEach(function (d) {
        var s = state.depts[d.id].spec; if (!s) return;
        specEffectsOf(d).forEach(function (x) { sm(state, x.stat, Math.pow(x.mult, s)); });
      });
    },
    onDay: function (state, content, api, events) {
      A(api); ensure(state);
      if (state.exit.sold) return;
      var si = specInfo(state, content);
      if (si.payroll > 0) api.spend(state, si.payroll * api.m(state, 'salaryCost'), 'payroll');
    },
    onMetrics: function (state, content, metrics, api) {
      A(api); ensure(state); content = C(content);
      var si = specInfo(state, content), why = companyWhy(metrics), api2 = A();
      // the core may already report these (api.specialistInfo); fill only what is missing
      if (typeof metrics.specialistDepts !== 'number') metrics.specialistDepts = si.depts;
      if (typeof metrics.specialistHeadcount !== 'number') metrics.specialistHeadcount = si.headcount;
      if (typeof metrics.specialistPayroll !== 'number') metrics.specialistPayroll = Math.round(si.payroll * api2.m(state, 'salaryCost'));
      // make sure headcount includes specialist teams exactly once (whether or not the core already added them)
      var want = 1 + coreStaff(state) + si.headcount;
      if (typeof metrics.headcount !== 'number' || metrics.headcount < want - 0.5) metrics.headcount = want;
      var parts = [];
      deptDefs(content).forEach(function (d) {
        var s = state.depts[d.id].spec; if (!s) return;
        parts.push((d.name || d.id) + ' L' + s + ' (' + specEffectsOf(d).map(function (x) { return x.stat + ' ×' + Math.pow(x.mult, s).toFixed(2); }).join(', ') + ')');
      });
      why.push('Specialist teams: ' + si.depts + ' department' + (si.depts === 1 ? '' : 's') + ' at level ' + LT.specDeptsLevel + '+, ' + si.headcount + ' people, ' +
        money(metrics.specialistPayroll) + '/day' + (parts.length ? ': ' + parts.join('; ') : '. None yet: pick your weakest department first.'));
    }
  };

  // ---------------------------------------------------------------------------
  // 4.4 saturation, big bet, valuation, exit
  // ---------------------------------------------------------------------------
  // the market is about satEntryMult × the size you were when Level 10 began (never smaller than satRevenue)
  function satBase(state) { return Math.max(LT.satRevenue, num(state._satBase, 0)); }
  function satInfo(state) {
    var rev = revenue30(state), k = state.flags && state.flags.betWon ? LT.satAfterWin : 1;
    var s = rev / satBase(state) * k;
    return { revenue30: rev, k: k, base: satBase(state), adCpl: 1 + s, leadVolume: 1 / (1 + LT.satLeadShrink * s) };
  }
  function betDefs(content) { return list(content, 'bets'); }
  function betChanceFrom(state, content, bet, metrics) {
    var items = [], ch = num(bet.baseChance, 0.5);
    arr(bet.prep).forEach(function (p) {
      if (!p || !p.metric) return;
      var cur = num(getPath(metrics || {}, p.metric), num(getPath(state, p.metric), 0));
      var met = cur >= num(p.gte, 0);
      if (met) ch += num(p.bonus, 0);
      items.push({ metric: p.metric, gte: num(p.gte, 0), bonus: num(p.bonus, 0), current: cur, met: met });
    });
    return { chance: clamp(ch, 0, LT.betChanceCap), base: num(bet.baseChance, 0.5), items: items };
  }
  function betChance(state, content, betId) {
    content = C(content); ensure(state);
    var bet = findById(betDefs(content), betId); if (!bet) return null;
    var api = A(), mt = null;
    try { mt = api.computeMetrics ? api.computeMetrics(state, content) : null; } catch (e) { mt = null; }
    return betChanceFrom(state, content, bet, mt);
  }
  // cash to keep after placing the Big Bet: LT.betKeepDays of running costs (payroll, ads, living, running costs)
  function betKeep(state, content, api) {
    var mt = api && api.computeMetrics ? api.computeMetrics(state, content, true) : null;
    if (!mt) return 0;
    var daily = Math.max(0, num(mt.burnDaily, 0) + num(mt.revenue30, 0) / 30);
    return Math.round(daily * num(LT.betKeepDays, 7) / 1000) * 1000;
  }
  function startBet(state, content, betId) {
    content = C(content); ensure(state);
    var api = A(), bet = findById(betDefs(content), betId);
    if (!bet) return { ok: false, reason: 'Unknown bet.' };
    if (state.level < 10) return { ok: false, reason: 'The Big Bet opens at Level 10.' };
    if (state.exit.sold) return { ok: false, reason: 'You already sold the company.' };
    if (state.bet) return { ok: false, reason: 'Your bet is already running.' };
    if (state.flags.betDone) return { ok: false, reason: 'One Big Bet per run. You already placed yours.' };
    var cost = Math.round(num(bet.cost, 300000));
    if (state.cash < cost) return { ok: false, reason: 'Need ' + money(cost) + ' to place this bet.' };
    // the core business must survive a miss: keep a few days of running costs in the bank after paying for the bet
    var keep = betKeep(state, content, api);
    if (state.cash - cost < keep) return { ok: false, reason: 'Keep ' + num(LT.betKeepDays, 3) + ' days of running costs (about ' + money(keep) + ') in the bank after the bet. Save up to ' + money(cost + keep) + ' first.' };
    api.spend(state, cost, 'bet');
    state.bet = { id: bet.id, daysLeft: Math.max(1, Math.round(num(bet.days, 30))), day: state.day, cost: cost };
    var events = [], text = (bet.emoji ? bet.emoji + ' ' : '') + 'Big Bet placed: ' + (bet.name || bet.id) + '. Results in ' + state.bet.daysLeft + ' days.';
    api.pushLog(state, 'info', text);
    events.push({ type: 'info', kind: 'betStart', id: bet.id, text: text });
    nb(state, content, api, 'big_bet', events);
    refresh(state, content);
    return { ok: true, events: events, cost: cost };
  }
  function resolveBet(state, content, api, events) {
    var bet = findById(betDefs(content), state.bet.id) || { id: state.bet.id, name: state.bet.id, baseChance: 0.5 };
    var mt = null;
    try { mt = api.computeMetrics ? api.computeMetrics(state, content) : null; } catch (e) { mt = null; }
    var ch = betChanceFrom(state, content, bet, mt).chance;
    var won = api.rand(state) < ch;
    state.bet = null;
    state.flags.betDone = true;
    state.flags.betWon = won;
    var ev = applyFx(state, content, api, won ? bet.success : bet.fail, 1);
    var nm = (bet.emoji ? bet.emoji + ' ' : '') + (bet.name || bet.id);
    var text = won ? nm + ' paid off! Market pressure eased and growth is back. (' + pct(ch) + ' odds)'
      : nm + ' did not work out. It happens. Your core business still stands. (' + pct(ch) + ' odds)';
    api.pushLog(state, 'info', text);
    events.push({ type: 'bet', id: bet.id, won: won, chance: ch, text: text });
    events.push.apply(events, ev);
  }

  function leadSources(state) {
    var n = 0, ch = state.channels || {}, plan = state.plan || {}, sq = state.squad || {}, t = state.team || {};
    if (num(plan.warm, 0) > 0 || num(t.setter, 0) > 0) n++;
    if (ch.cold && ch.cold.unlocked && (num(plan.cold, 0) > 0 || num(t.setter, 0) > 0)) n++;
    if (ch.content && arr(ch.content.posts).length > 0) n++;
    if (ch.ads && ch.ads.unlocked && num(ch.ads.dailyBudget, 0) > 0) n++;
    if (sq.fans && sq.fans.on) n++;
    if (sq.agency && num(sq.agency.retainer, 0) > 0) n++;
    if (sq.partners && num(sq.partners.count, 0) > 0) n++;
    return n;
  }
  function valuationFrom(state, content, metrics) {
    var mt = metrics || {}, w0 = windowSums(state, 0), w1 = windowSums(state, 30);
    var rev30 = num(mt.revenue30, w0.revenue);
    var profit30 = typeof mt.profit30 === 'number' ? mt.profit30 : w0.profit;
    var annualProfit = Math.max(0, profit30 * 12);
    var mb = state.combos && state.combos.membership;
    var memberMonthly = (mb && mb.on ? num(state.customers && state.customers.members, 0) * num(mb.price, 0) : 0);
    var prem30 = num(mt.premiumRevenue30, w0.premium);
    var recurring = memberMonthly + LT.premiumRecurringShare * prem30;
    var recurringShare = rev30 > 0 ? clamp(recurring / rev30, 0, 1) : 0;
    var growthRate = w1.revenue > 0 && w1.days >= 20 ? w0.revenue / w1.revenue - 1 : 0;
    var growthF = clamp(0.5 + growthRate / 0.4, 0, 1);           // flat = 0.5, +20%/30 days = full, −20% = none
    var fd = num(mt.founderDeliveryShare, 0), fs = num(mt.founderSalesShare, 0);
    var owner = clamp(1 - Math.max(fd, fs), 0, 1);
    var dMin = typeof mt.deptHealthMin === 'number' ? mt.deptHealthMin : (state.depts ? deptHealthMin(state).value : 80);
    var src = leadSources(state), diversity = clamp((src - 1) / 4, 0, 1);
    var parts = {
      recurring: LT.multRecurring * recurringShare, growth: LT.multGrowth * growthF, owner: LT.multOwner * owner,
      dept: LT.multDept * dMin / 100, diversity: LT.multDiversity * diversity
    };
    var raw = LT.multBase + parts.recurring + parts.growth + parts.owner + parts.dept + parts.diversity;
    var multiple = Math.min(LT.multCap, raw);
    var valuation = Math.round(annualProfit * multiple);
    var factors = [
      { label: 'Annual profit', value: annualProfit, note: money(profit30) + ' profit in 30 days × 12 = ' + money(annualProfit) + (profit30 < 0 ? ' (losses count as $0)' : '') },
      { label: 'Base multiple', value: LT.multBase, note: 'Every profitable company starts at ' + LT.multBase + '×' },
      { label: 'Recurring revenue', value: r2(parts.recurring), note: pct(recurringShare) + ' of revenue repeats (members ' + money(memberMonthly) + '/mo + half of premium ' + money(prem30) + ') × ' + LT.multRecurring },
      { label: 'Growth', value: r2(parts.growth), note: 'Revenue ' + (growthRate >= 0 ? '+' : '') + pct(growthRate) + ' vs the 30 days before → ' + growthF.toFixed(2) + ' × ' + LT.multGrowth },
      { label: 'Owner independence', value: r2(parts.owner), note: 'You still do ' + pct(fd) + ' of delivery and ' + pct(fs) + ' of sales → ' + owner.toFixed(2) + ' × ' + LT.multOwner },
      { label: 'Department health', value: r2(parts.dept), note: 'Weakest department at ' + Math.round(dMin) + '/100 × ' + LT.multDept },
      { label: 'Lead source mix', value: r2(parts.diversity), note: src + ' lead source' + (src === 1 ? '' : 's') + ' in use (5+ = full) × ' + LT.multDiversity },
      { label: 'Multiple', value: r2(multiple), note: raw > LT.multCap ? 'Capped at ' + LT.multCap + '×' : r2(raw) + '× (cap ' + LT.multCap + '×)' }
    ];
    return { valuation: valuation, annualProfit: annualProfit, multiple: multiple, factors: factors, profit30: profit30,
      recurringShare: recurringShare, growthRate: growthRate, ownerIndependence: owner, leadSourceDiversity: diversity, leadSources: src };
  }
  function r2(x) { return Math.round(num(x, 0) * 100) / 100; }

  function getValuation(state, content) {
    content = C(content); ensure(state);
    var api = A(), mt = null;
    try { mt = api.computeMetrics ? api.computeMetrics(state, content) : null; } catch (e) { mt = null; }
    return valuationFrom(state, content, mt);
  }

  function sellCompany(state, content) {
    content = C(content); ensure(state);
    var api = A();
    if (state.level !== 10) return { ok: false, reason: 'You can sell at The Summit (Level 10).' };
    if (state.exit.sold) return { ok: false, reason: 'Already sold. Start a New Game+!' };
    if (state.gameOver) return { ok: false, reason: 'The run is over.' };
    var v = getValuation(state, content);
    if (!(v.valuation > 0)) return { ok: false, reason: 'No buyer pays for a company without profit. Get profitable first.' };
    var events = [];
    // one last achievement pass with the sale applied (e.g. 'summit_sold' reads exit.sold), so it counts in the score
    state.exit.sold = true;
    arr(content.achievements).forEach(function (a) {
      if (!a || !a.id || !a.cond || arr(state.achievements).indexOf(a.id) >= 0) return;
      var ok = false;
      try { ok = typeof E.checkCondition === 'function' && E.checkCondition(state, content, a.cond); } catch (e) { ok = false; }
      if (!ok) return;
      state.achievements.push(a.id);
      var atx = (a.emoji ? a.emoji + ' ' : '') + (a.name || a.id) + (a.desc ? ' \u2014 ' + a.desc : '');
      api.pushLog(state, 'achievement', atx);
      events.push({ type: 'achievement', id: a.id, text: atx });
    });
    var lessons = arr(state.notebook).length, ach = arr(state.achievements).length;
    var score = Math.max(0, Math.round(v.valuation / 1000 + lessons * 500 + ach * 300 - num(state.day, 0) * 20));
    var wisdom = Math.min(LT.wisdomMax, 1 + Math.floor(v.valuation / LT.wisdomPer));
    state.exit = { sold: true, valuation: v.valuation, score: score, wisdom: wisdom, day: state.day, multiple: r2(v.multiple), annualProfit: Math.round(v.annualProfit) };
    state.graduated = true;
    state.fires = [];
    var text = 'Sold at The Summit for ' + money(v.valuation) + '! (' + r2(v.multiple) + '× ' + money(v.annualProfit) + ' yearly profit)';
    api.pushLog(state, 'info', text);
    events.push({ type: 'exit', amount: v.valuation, score: score, wisdom: wisdom, text: text });
    nb(state, content, api, 'the_summit', events);
    return { ok: true, reason: '', valuation: v.valuation, score: score, wisdom: wisdom, multiple: v.multiple, factors: v.factors, events: events };
  }

  var sysEmpire = {
    id: 'empire', minLevel: 10,
    init: function (state, content, api) { A(api); ensure(state); if (!(num(state._satBase, 0) > 0)) state._satBase = revenue30(state) * LT.satEntryMult; },
    recompute: function (state, content, api) {
      A(api); ensure(state);
      if (state.exit.sold) return;
      var s = satInfo(state);
      sm(state, 'adCpl', s.adCpl);
      sm(state, 'leadVolume', s.leadVolume);   // SPEC-GAP: lead volume multiplier key read by the core funnel via m(state,'leadVolume')
    },
    onDay: function (state, content, api, events) {
      A(api); ensure(state); content = C(content);
      if (state.exit.sold) return;
      state._l10Days = num(state._l10Days, 0) + 1;
      nb(state, content, api, 'valuation', events);
      if (state._l10Days >= 7) nb(state, content, api, 'owner_independence', events);
      if (state.bet) {
        state.bet.daysLeft = num(state.bet.daysLeft, 1) - 1;
        if (state.bet.daysLeft <= 0) resolveBet(state, content, api, events);
      }
    },
    onMetrics: function (state, content, metrics, api) {
      A(api); ensure(state); content = C(content);
      var why = companyWhy(metrics), s = satInfo(state), v = valuationFrom(state, content, metrics);
      metrics.valuation = v.valuation;
      metrics.multiple = r2(v.multiple);
      metrics.annualProfit = Math.round(v.annualProfit);
      metrics.betDone = state.flags.betDone ? 1 : 0;
      metrics.betWon = state.flags.betWon ? 1 : 0;
      metrics.betDaysLeft = state.bet ? Math.max(0, num(state.bet.daysLeft, 0)) : 0;
      metrics.saturation = r2(s.adCpl - 1);
      metrics.ownerIndependence = r2(v.ownerIndependence);
      metrics.recurringShare = r2(v.recurringShare);
      metrics.leadSources = v.leadSources;
      why.push('Market saturation: ' + money(s.revenue30) + ' in 30 days of a ~' + money(s.base) + ' market → ads ×' + s.adCpl.toFixed(2) + ' per lead, lead volume ×' + s.leadVolume.toFixed(2) +
        (state.flags.betWon ? ' (your won bet removed most of it)' : '. Growth stalls here on purpose: a Big Bet can open new room'));
      why.push('Valuation = ' + money(v.annualProfit) + ' yearly profit × ' + r2(v.multiple) + ' multiple = ' + money(v.valuation));
      v.factors.slice(2, 7).forEach(function (f) { why.push('  +' + f.value.toFixed(2) + '× ' + f.label + ': ' + f.note); });
      if (state.bet) {
        var b = findById(betDefs(content), state.bet.id);
        why.push('Big Bet ' + ((b && b.name) || state.bet.id) + ': ' + metrics.betDaysLeft + ' days to the result');
      }
    }
  };

  function companyWhy(metrics) {
    if (!metrics.why || typeof metrics.why !== 'object') metrics.why = { leads: [], funnel: [], money: [] };
    if (!Array.isArray(metrics.why.company)) metrics.why.company = [];
    return metrics.why.company;
  }

  // ---------------------------------------------------------------------------
  // registration + exports
  // ---------------------------------------------------------------------------
  var SYSTEMS = [sysEfficiency, sysDepts, sysSpecialists, sysEmpire];
  function register() {
    if (typeof E.registerSystem === 'function') {
      var have = {};
      arr(E.systems).forEach(function (s) { if (s && s.id) have[s.id] = true; });
      SYSTEMS.forEach(function (s) { if (!have[s.id]) E.registerSystem(s); });
    } else {
      // SPEC-GAP: core without registerSystem: keep the list so a later core can pick it up
      if (!Array.isArray(E.systems)) E.systems = [];
      SYSTEMS.forEach(function (s) { if (E.systems.indexOf(s) < 0) E.systems.push(s); });
      if (typeof console !== 'undefined' && console.warn) console.warn('[engine-late] ZTE.Engine.registerSystem missing; systems parked on ZTE.Engine.systems');
    }
  }
  register();

  E.startProject = startProject;
  E.handleFire = handleFire;
  E.upgradeDept = upgradeDept;
  E.startBet = startBet;
  E.getValuation = getValuation;
  E.sellCompany = sellCompany;
  // extras for UI / bots / tools
  E.late = {
    LT: LT, DEPT_IDS: DEPT_IDS, METRIC_IDS: METRIC_IDS, METRIC_NAMES: METRIC_NAMES, FALLBACK: FALLBACK, SYSTEMS: SYSTEMS,
    projects: projectDefs, departments: deptDefs, fireTypes: fireTypes, bets: betDefs,
    projectCost: projectCost, betChance: betChance, betKeep: function (state, content) { return betKeep(state, C(content), A()); }, weakest: weakest, valuationFrom: valuationFrom,
    headcount: headcount, specInfo: specInfo, bloatInfo: bloatInfo, deptMods: deptMods, satInfo: satInfo,
    specCost: function (state, content, deptId) {
      var d = deptDef(content, deptId), st = state.depts && state.depts[deptId];
      return d && st && st.spec < LT.specMax ? specCostOf(d, num(st.spec, 0) + 1) : 0;
    },
    ensure: ensure
  };
  E.betChance = betChance;
  E.projectCost = projectCost;
})(typeof globalThis !== 'undefined' ? globalThis : this);
