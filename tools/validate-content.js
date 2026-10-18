#!/usr/bin/env node
/* Zero to Exit — content validator (SPEC §8 + SPEC-LATE §8).
 * Loads content + engine + engine-late the same way the game does (index.html order), then checks every
 * reference the game relies on. Exit code 1 when anything is wrong (each problem is printed with where it lives).
 *
 * Usage: node game/tools/validate-content.js [--sources DIR] [--no-sources] [--quiet]
 *   --sources DIR  plain-text source extracts for the "no copied sentences" check
 *                  (default: the folder named in SPEC §10, skipped when it does not exist)
 *   --no-sources   skip that check
 *   --quiet        only print problems and the summary
 *
 * Checks (spec §8 / SPEC-LATE §8, plus the contract details content depends on):
 *  - the file list matches index.html's script order; all content keys exist (incl. the late keys roles,
 *    premiumDefaults, projects, departments, fireTypes, bets, perks); ids are unique in every collection,
 *    card/event ids are unique across all card files; card option ids unique per card
 *  - the §6 / SPEC-LATE engine API exists, and every Engine function / Engine.late extra that ui.js calls exists
 *  - glossary, level, channel and combo names match the spec tables (no renaming)
 *  - the notebook holds exactly the 28 + 25 fixed ids (53, late ids at their SPEC-LATE level); every notebook
 *    reference (level onEnter, upgrade/card/project `notebook`, any `notebook` effect, engine literals in
 *    engine.js and engine-late.js) is in the fixed list AND defined; every lesson can actually be unlocked
 *  - every effect uses a §5.2 op with the right fields; add/mul/set paths are §5.3 + SPEC-LATE §2 paths (and
 *    Engine.isAllowedPath agrees); mod/buff stats are mods keys (Engine.MOD_KEYS agrees); unlock targets are
 *    channel:<id> / combo:<id>; the real engine applies each list (at its level) without warnings
 *  - every `requires` id exists (no self-reference, no cycles)
 *  - every level 1–10 has a goal; item paths (incl. `lte` and `targetByFlavor` items) resolve to numbers on a
 *    state forced to that level (state paths, or metrics.* from Engine.computeMetrics incl. system metrics),
 *    Engine.getGoal agrees, and levels 4–10 match the SPEC-LATE §1 goal table
 *  - every cond uses only §5.1 forms, values of the right type and paths that resolve (a metric that only exists
 *    from Level N must be guarded with minLevel ≥ N); `chance` only in card triggers / event conds; flags that
 *    conds read are set somewhere (content effects, engine.js or engine-late.js)
 *  - cards have 2–3 options with exactly one 'best'; quiz answer index is in range
 *  - roles / premiumDefaults / projects / departments / fireTypes / bets / perks have the fields the engines read,
 *    and each is exercised through the real engine (hire, build, startProject, upgradeDept, fires, startBet,
 *    createState with perks); any engine warning is an error. Player-visible role names never say "closer".
 *  - banned words from §0.1 appear nowhere in the project (whole files: content, engine, UI, HTML, CSS, tools,
 *    docs; case-insensitive except the sales acronym, which is matched in ALL CAPS only so the ordinary English
 *    word can be a code id). Only the spec's own rule list is exempt, marked in SPEC.md with
 *    <!-- banned-words-allowed:start --> ... <!-- banned-words-allowed:end -->
 *  - (when source texts are available) no 8-word run in any game text is copied from them
 */
'use strict';
var path = require('path');
var fs = require('fs');

var args = process.argv.slice(2);
function arg(name, dflt) {
  var i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  var v = args[i + 1];
  return (v === undefined || v.indexOf('--') === 0) ? true : v;
}
var QUIET = !!arg('quiet', false);
var NO_SOURCES = !!arg('no-sources', false);
var ROOT = path.join(__dirname, '..');
var JS = path.join(ROOT, 'js');

// default source folder = the path SPEC §10 names (read from the spec so it is not repeated here)
function specSourcesDir() {
  try {
    var m = /`(\/[^`\s]*texts)\/?`/.exec(fs.readFileSync(path.join(ROOT, 'docs', 'SPEC.md'), 'utf8'));
    return m ? m[1] : '';
  } catch (e) { return ''; }
}
var SOURCES = arg('sources', specSourcesDir());

// ---------------------------------------------------------------------------
// reporting
// ---------------------------------------------------------------------------
var errors = [], warnings = [], sections = [];
function err(where, msg) { var s = where + ': ' + msg; if (errors.indexOf(s) < 0) errors.push(s); }
function warnc(where, msg) { warnings.push(where + ': ' + msg); }
function section(name, fn) {
  var before = errors.length, wBefore = warnings.length;
  try { fn(); } catch (e) { err(name, 'validator crashed: ' + (e && e.stack || e)); }
  sections.push({ name: name, errors: errors.length - before, warnings: warnings.length - wBefore });
}

// ---------------------------------------------------------------------------
// load content + engine in spec order (§3)
// ---------------------------------------------------------------------------
var CONTENT_FILES = ['content/base.js', 'content/upgrades.js', 'content/upgrades-late.js', 'content/cards.js',
  'content/cards-late-a.js', 'content/cards-late-b.js', 'content/notebook.js', 'content/notebook-late.js',
  'content/systems.js'];
var CARD_FILES = ['content/cards.js', 'content/cards-late-a.js', 'content/cards-late-b.js'];
var FILES = CONTENT_FILES.concat(['engine.js', 'engine-late.js']);
var missing = FILES.filter(function (f) { return !fs.existsSync(path.join(JS, f)); });
if (missing.length) {
  console.error('validate-content: missing file(s): ' + missing.map(function (f) { return 'js/' + f; }).join(', '));
  process.exit(1);
}
FILES.forEach(function (f) {
  try { require(path.join(JS, f)); } catch (e) {
    console.error('validate-content: failed to load js/' + f + ': ' + e.message);
    process.exit(1);
  }
});
var ZTE = globalThis.ZTE;
if (!ZTE || !ZTE.Engine || !ZTE.Content) { console.error('validate-content: ZTE.Engine / ZTE.Content not found after loading.'); process.exit(1); }
var E = ZTE.Engine, C = ZTE.Content;
var ENGINE_CORE_SRC = fs.readFileSync(path.join(JS, 'engine.js'), 'utf8');
var ENGINE_LATE_SRC = fs.readFileSync(path.join(JS, 'engine-late.js'), 'utf8');
var ENGINE_SRC = ENGINE_CORE_SRC + '\n' + ENGINE_LATE_SRC;
var UI_SRC = fs.existsSync(path.join(JS, 'ui.js')) ? fs.readFileSync(path.join(JS, 'ui.js'), 'utf8') : '';
var LATE = (E.late && typeof E.late === 'object') ? E.late : {};

// engine warnings are captured and attributed to whatever the validator was doing at the time
var engineWarnings = [];
console.warn = function () { engineWarnings.push(Array.prototype.join.call(arguments, ' ')); };
function withWarnings(where, fn) {
  engineWarnings = [];
  var out;
  try { out = fn(); } catch (e) { err(where, 'engine threw: ' + (e && e.message || e)); }
  engineWarnings.forEach(function (w) { err(where, 'engine warning: ' + w); });
  engineWarnings = [];
  return out;
}

// ---------------------------------------------------------------------------
// spec constants (independent of the engine, so the engine is checked too)
// ---------------------------------------------------------------------------
var SPEC_PATHS = ['cash', 'livingCost', 'energy.max', 'burnout', 'network.size', 'network.available',
  'audience', 'reputation.testimonials', 'reputation.caseStudies', 'leads', 'offer.dream',
  'offer.likelihood', 'offer.speed', 'offer.ease', 'offer.price', 'offer.guarantee', 'offer.name',
  'skills.closing', 'skills.hooks', 'skills.pricing', 'skills.proof', 'skills.nurture', 'skills.retention',
  // SPEC-LATE §2
  'focus', 'team.morale', 'ops.efficiency', 'sops.delivery', 'sops.sales', 'sops.marketing', 'sops.hiring',
  'squad.partners.count', 'attention.max', 'premium.price', 'calmDays'];
var DEPT_IDS = ['marketing', 'sales', 'delivery', 'people', 'finance', 'tech'];
var ROLE_IDS = ['coach', 'closer', 'setter', 'manager'];
var SOP_IDS = ['delivery', 'sales', 'marketing', 'hiring'];
var CHANNEL_IDS = ['warm', 'cold', 'content', 'ads'];
var COMBO_IDS = ['hook', 'upsell', 'downsell', 'membership'];
var SPEC_PATH_RE = [new RegExp('^combos\\.(' + COMBO_IDS.join('|') + ')\\.price$'),
  new RegExp('^channels\\.(' + CHANNEL_IDS.join('|') + ')\\.level$'),
  new RegExp('^depts\\.(' + DEPT_IDS.join('|') + ')\\.health$')];
function specPath(p) {
  if (SPEC_PATHS.indexOf(p) >= 0) return true;
  return SPEC_PATH_RE.some(function (re) { return re.test(p); });
}
var MOD_KEYS = ['warmReply', 'coldReply', 'contentReach', 'adCpl', 'bookRate', 'showRate', 'closeRate',
  'churn', 'refundRate', 'upsellTake', 'downsellTake', 'testimonialChance', 'deliveryEnergy',
  'referralRate', 'perceivedValue', 'leadDecay',
  'teamOutput', 'salaryCost', 'premiumTake', 'hireRamp'];   // SPEC-LATE §2
var SYS_ONLY_STATS = ['leadVolume'];   // _sysMods-only multiplier (specEffects may use it; content effects may not)
var GUARANTEES = ['none', 'conditional', 'unconditional'];
var NOTEBOOK_IDS = ['start_free', 'warm_outreach', 'testimonials', 'daily_grind', 'value_meter',
  'no_brainer_offer', 'pricing_up', 'guarantees', 'close_kit', 'cold_outreach', 'hooks', 'speed_to_lead',
  'show_rate', 'bonuses', 'niche', 'content', 'paid_ads', 'ltv_cac', 'client_financed', 'hook_offer',
  'upsell', 'downsell', 'membership', 'churn', 'constraint', 'volume_then_quality', 'proof_checklist',
  'scaling_path'];
var LATE_NOTEBOOK = { hire_help: 4, playbooks: 4, first_hire: 4, lead_squad: 4, payroll_math: 4,
  ideal_customer: 5, saying_no: 5, span_of_control: 5, profit_margin: 5,
  second_product: 6, ascension: 6, partners: 6,
  better_not_more: 7, measure_it: 7, bloat: 7,
  triage: 8, departments: 8, ceo_attention: 8,
  specialists: 9, a_players: 9, department_heads: 9,
  big_bet: 10, valuation: 10, owner_independence: 10, the_summit: 10 };   // SPEC-LATE §6
var EARLY_NOTEBOOK_COUNT = NOTEBOOK_IDS.length;   // 28
NOTEBOOK_IDS = NOTEBOOK_IDS.concat(Object.keys(LATE_NOTEBOOK));     // 53
var GLOSSARY = { coach: 'Coach Flex', summit: 'The Summit', offerForge: 'Offer Forge',
  noBrainerOffer: 'No-Brainer Offer', valueMeter: 'Value-o-Meter', megaphones: 'The Four Megaphones',
  leadSquad: 'Lead Squad', dailyGrind: 'The Daily Grind', cashCombos: 'Cash Combos', closeKit: 'Close Kit',
  skillScrolls: 'Skill Scrolls', notebook: "Founder's Notebook" };
var LEVELS = [[1, 'garage', 'Garage'], [2, 'hustle', 'Hustle'], [3, 'megaphone', 'Megaphone'], [4, 'crew', 'Crew'],
  [5, 'focus', 'Focus'], [6, 'productline', 'Product Line'], [7, 'tuneup', 'Tune-Up'], [8, 'orgchart', 'Org Chart'],
  [9, 'specialists', 'Specialists'], [10, 'empire', 'Empire']];
var CHANNEL_NAMES = { warm: 'Friends', cold: 'Cold Calls', content: 'Content', ads: 'Ads' };
var COMBO_NAMES = { hook: 'Hook Offer', upsell: 'Upsell', downsell: 'Downsell', membership: 'Membership' };
var FLAVOR_IDS = ['fitness', 'agency', 'tutor'];
var CATEGORIES = ['offer', 'skill', 'nurture', 'megaphone', 'team', 'systems'];
var QUALITIES = ['best', 'ok', 'trap'];
var COND_KEYS = ['all', 'any', 'not', 'path', 'gte', 'lte', 'gt', 'lt', 'eq', 'level', 'minLevel', 'maxLevel',
  'minDay', 'maxDay', 'flag', 'notFlag', 'upgrade', 'notUpgrade', 'chance'];
var COMPARATORS = ['gte', 'lte', 'gt', 'lt', 'eq'];
var OP_KEYS = {
  add: ['path', 'value'], mul: ['path', 'value'], set: ['path', 'value'],
  mod: ['stat', 'mult'], buff: ['stat', 'mult', 'days', 'label'], flag: ['name', 'value'],
  unlock: ['what'], notebook: ['id'], coach: ['text'], log: ['text']
};
var ENGINE_API = ['createState', 'tick', 'tap', 'setPlan', 'setPrice', 'setAdBudget', 'postContent',
  'toggleCombo', 'overtime', 'buyUpgrade', 'availableUpgrades', 'getPendingCard', 'ghostCompare',
  'chooseCardOption', 'rewind', 'simulateForward', 'computeMetrics', 'getGoal', 'checkCondition',
  'applyEffects', 'answerQuiz', 'serialize', 'deserialize',
  // SPEC-LATE §3 (engine.js) and §4 (engine-late.js)
  'hire', 'fire', 'setSquad', 'setFocus', 'buildPremium', 'setPremiumPrice', 'togglePremium', 'registerSystem',
  'startProject', 'handleFire', 'upgradeDept', 'startBet', 'getValuation', 'sellCompany'];
// SPEC-LATE §1 goal table: [path, target, agencyTarget?, lte?]
var SPEC_GOALS = {
  4: [['metrics.headcount', 3], ['metrics.founderDeliveryShare', 0.4, null, true], ['metrics.revenue30', 30000, 45000]],
  5: [['metrics.headcount', 5], ['focus', 60], ['metrics.profitMargin30', 0.15], ['metrics.revenue30', 60000, 90000]],
  6: [['metrics.headcount', 10], ['metrics.premiumShare30', 0.2], ['metrics.revenue30', 120000, 180000]],
  7: [['metrics.headcount', 20], ['metrics.efficiency', 75], ['metrics.profitMargin30', 0.2], ['metrics.revenue30', 250000, 350000]],
  8: [['metrics.headcount', 50], ['metrics.deptHealthMin', 60], ['metrics.calmDays', 14], ['metrics.revenue30', 500000, 650000]],
  9: [['metrics.headcount', 100], ['metrics.specialistDepts', 4], ['metrics.revenue30', 1000000, 1300000]],
  10: [['metrics.headcount', 250], ['metrics.betDone', 1], ['metrics.valuation', 50000000]]
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function arr(x) { return Array.isArray(x) ? x : []; }
function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function isStr(x) { return typeof x === 'string' && x.trim().length > 0; }
function isNum(x) { return typeof x === 'number' && isFinite(x); }
function isInt(x) { return isNum(x) && Math.floor(x) === x; }
function getPath(obj, p) {
  var parts = String(p).split('.'), cur = obj;
  for (var i = 0; i < parts.length; i++) { if (cur === null || cur === undefined) return undefined; cur = cur[parts[i]]; }
  return cur;
}
function byId(list, id) { list = arr(list); for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i]; return null; }
function uniqueIds(list, where) {
  var seen = {};
  arr(list).forEach(function (x, i) {
    if (!x || x.id === undefined || x.id === null || x.id === '') { err(where + '[' + i + ']', 'missing id'); return; }
    if (seen[x.id] !== undefined) err(where + '[' + i + ']', 'duplicate id "' + x.id + '" (also at [' + seen[x.id] + '])');
    else seen[x.id] = i;
  });
}
function needStr(obj, key, where) { if (!isStr(obj && obj[key])) err(where, 'needs a non-empty string "' + key + '"'); }

// fresh states (one per flavor) — the reference for "resolvable" paths
var FRESH = {}, METRICS = {};
withWarnings('Engine.createState', function () {
  arr(C.flavors).forEach(function (f) {
    if (!f || !f.id) return;
    FRESH[f.id] = E.createState(C, { seed: 4242, flavor: f.id });
    METRICS[f.id] = E.computeMetrics(FRESH[f.id], C);
  });
});
var FLAVOR_KEYS = Object.keys(FRESH);
var REF_STATE = FRESH[FLAVOR_KEYS[0]], REF_METRICS = METRICS[FLAVOR_KEYS[0]];
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// states forced to each level 1–10 (onEnter of every level on the way applied, systems recomputed), per flavor
var LEVEL_STATE = {}, LEVEL_METRICS = {};
function forceLevel(base, L) {
  var s = clone(base);
  for (var l = 2; l <= L; l++) { s.level = l; if (typeof E.enterLevel === 'function') E.enterLevel(s, C, l); }
  if (typeof E.recomputeSystems === 'function') E.recomputeSystems(s, C);
  return s;
}
FLAVOR_KEYS.forEach(function (f) {
  LEVEL_STATE[f] = {}; LEVEL_METRICS[f] = {};
  for (var L = 1; L <= 10; L++) {
    withWarnings('forced Level ' + L + ' state (' + f + ')', function () {
      LEVEL_STATE[f][L] = L === 1 ? FRESH[f] : forceLevel(FRESH[f], L);
      LEVEL_METRICS[f][L] = E.computeMetrics(LEVEL_STATE[f][L], C);
    });
  }
});
function levelState(f, L) { return (LEVEL_STATE[f] && LEVEL_STATE[f][L]) || FRESH[f]; }
function levelMetrics(f, L) { return (LEVEL_METRICS[f] && LEVEL_METRICS[f][L]) || METRICS[f]; }

function resolveValue(p) {
  // returns { ok, value, level } using the engine's own rules (metrics.* → computeMetrics, arrays → length);
  // level = the first level whose forced state has the value (system metrics only exist from their minLevel)
  if (!REF_STATE) return { ok: false };
  var f = FLAVOR_KEYS[0], v, L;
  if (String(p).indexOf('metrics.') === 0) {
    if (String(p) === 'metrics.why' || String(p).indexOf('metrics.why.') === 0) return { ok: false };
    for (L = 1; L <= 10; L++) { v = getPath(levelMetrics(f, L), String(p).slice(8)); if (v !== undefined) break; }
  } else {
    if (/(^|\.)_/.test(p)) return { ok: false, privateField: true };
    for (L = 1; L <= 10; L++) { v = getPath(levelState(f, L), p); if (v !== undefined) break; }
  }
  if (v === undefined) return { ok: false };
  if (Array.isArray(v)) v = v.length;
  return { ok: true, value: v, level: L };
}

// collected along the way
var notebookRefs = [];        // {id, where}
var notebookUnlockers = {};   // id -> [{where, level}]
var flagsSet = {};            // name -> where
var flagsRead = [];           // {name, where}
var effectLists = [];         // {where, list}
function addUnlocker(id, where, level) { (notebookUnlockers[id] = notebookUnlockers[id] || []).push({ where: where, level: level }); }

// ---------------------------------------------------------------------------
// validators
// ---------------------------------------------------------------------------
function checkNotebookRef(id, where) {
  notebookRefs.push({ id: id, where: where });
  if (!isStr(id)) { err(where, 'notebook id must be a non-empty string'); return; }
  if (NOTEBOOK_IDS.indexOf(id) < 0) err(where, 'notebook id "' + id + '" is not in the fixed §5.7 list');
  else if (!byId(C.notebook, id)) err(where, 'notebook id "' + id + '" is not defined in notebook.js');
}

function checkEffects(list, where, level) {
  if (list === undefined) return;
  if (!Array.isArray(list)) { err(where, 'effects must be an array'); return; }
  effectLists.push({ where: where, list: list, level: level });
  list.forEach(function (e, i) {
    var w = where + '[' + i + ']';
    if (!isObj(e)) { err(w, 'effect must be an object'); return; }
    var keys = OP_KEYS[e.op];
    if (!keys) { err(w, 'unknown op "' + e.op + '" (allowed: ' + Object.keys(OP_KEYS).join(', ') + ')'); return; }
    Object.keys(e).forEach(function (k) { if (k !== 'op' && keys.indexOf(k) < 0) err(w, 'op "' + e.op + '" has unknown field "' + k + '"'); });
    if (e.op === 'add' || e.op === 'mul' || e.op === 'set') {
      if (!specPath(e.path)) { err(w, 'path "' + e.path + '" is not in §5.3 / SPEC-LATE §2'); return; }
      if (typeof E.isAllowedPath === 'function' && !E.isAllowedPath(e.path)) err(w, 'path "' + e.path + '" is rejected by Engine.isAllowedPath');
      var cur = REF_STATE ? getPath(REF_STATE, e.path) : undefined;
      if (e.op === 'set' && e.path === 'offer.guarantee') {
        if (GUARANTEES.indexOf(e.value) < 0) err(w, 'offer.guarantee must be one of ' + GUARANTEES.join(' / '));
      } else if (e.op === 'set' && e.path === 'offer.name') {
        if (!isStr(e.value)) err(w, 'offer.name needs a non-empty string value');
      } else {
        if (REF_STATE && typeof cur !== 'number') err(w, e.op + ' on non-numeric path "' + e.path + '"');
        if (!isNum(e.value)) err(w, e.op + ' needs a finite number value');
        if (e.op === 'mul' && isNum(e.value) && e.value < 0) err(w, 'mul by a negative number');
      }
    } else if (e.op === 'mod' || e.op === 'buff') {
      if (MOD_KEYS.indexOf(e.stat) < 0) err(w, e.op + ' stat "' + e.stat + '" is not a mods key (§4 / SPEC-LATE §2)');
      else if (Array.isArray(E.MOD_KEYS) && E.MOD_KEYS.indexOf(e.stat) < 0) err(w, e.op + ' stat "' + e.stat + '" is not in Engine.MOD_KEYS');
      if (!isNum(e.mult) || e.mult <= 0) err(w, e.op + ' needs a positive number "mult"');
      if (e.op === 'buff') {
        if (!isInt(e.days) || e.days < 1) err(w, 'buff needs whole "days" >= 1');
        if (e.label !== undefined && typeof e.label !== 'string') err(w, 'buff label must be a string');
      }
    } else if (e.op === 'flag') {
      if (!isStr(e.name)) err(w, 'flag needs a "name"');
      else if (!flagsSet[e.name]) flagsSet[e.name] = w;
    } else if (e.op === 'unlock') {
      var parts = String(e.what || '').split(':');
      var ok = parts.length === 2 && ((parts[0] === 'channel' && CHANNEL_IDS.indexOf(parts[1]) >= 0) ||
        (parts[0] === 'combo' && COMBO_IDS.indexOf(parts[1]) >= 0));
      if (!ok) err(w, 'unlock target "' + e.what + '" must be channel:<' + CHANNEL_IDS.join('|') + '> or combo:<' + COMBO_IDS.join('|') + '>');
    } else if (e.op === 'notebook') {
      checkNotebookRef(e.id, w);
      addUnlocker(e.id, w, level);
    } else if (e.op === 'coach' || e.op === 'log') {
      if (!isStr(e.text)) err(w, e.op + ' needs non-empty "text"');
    }
  });
}

// ctxMin = the lowest level at which this cond can be true, from minLevel / level guards on it or on its
// `all` siblings (and ancestors); used to accept metrics that only exist from a system's minLevel
function guardLevel(c) {
  if (!isObj(c)) return 1;
  return Math.max(isInt(c.minLevel) ? c.minLevel : 1, isInt(c.level) ? c.level : 1);
}
function checkCond(cond, where, allowChance, ctxMin) {
  if (cond === undefined) return;
  if (!isObj(cond)) { err(where, 'cond must be an object (§5.1)'); return; }
  var keys = Object.keys(cond);
  if (!keys.length) { err(where, 'empty cond'); return; }
  keys.forEach(function (k) { if (COND_KEYS.indexOf(k) < 0) err(where, 'unknown cond key "' + k + '" (not a §5.1 form)'); });
  var local = Math.max(ctxMin || 1, guardLevel(cond));
  if (Array.isArray(cond.all)) cond.all.forEach(function (c) { local = Math.max(local, guardLevel(c)); });
  ['all', 'any'].forEach(function (k) {
    if (cond[k] === undefined) return;
    if (!Array.isArray(cond[k]) || !cond[k].length) { err(where, '"' + k + '" needs a non-empty array'); return; }
    cond[k].forEach(function (c, i) { checkCond(c, where + '.' + k + '[' + i + ']', allowChance, local); });
  });
  if (cond.not !== undefined) checkCond(cond.not, where + '.not', allowChance, local);
  var comps = COMPARATORS.filter(function (k) { return cond[k] !== undefined; });
  if (cond.path !== undefined) {
    if (!isStr(cond.path)) err(where, 'path must be a string');
    else {
      if (!comps.length) err(where, 'path "' + cond.path + '" has no comparator (gte/lte/gt/lt/eq)');
      var r = resolveValue(cond.path);
      if (r.privateField) err(where, 'path "' + cond.path + '" reads a private engine field');
      else if (!r.ok) err(where, 'path "' + cond.path + '" does not resolve on any level 1–10 state / computeMetrics()');
      else if (r.level > local) err(where, 'path "' + cond.path + '" only exists from Level ' + r.level + '; guard the cond with { minLevel: ' + r.level + ' }');
      else {
        ['gte', 'lte', 'gt', 'lt'].forEach(function (k) {
          if (cond[k] === undefined) return;
          if (!isNum(cond[k])) err(where, k + ' needs a number');
          // null = a metric that is not measurable yet (e.g. metrics.ltvCac with no spend); comparisons then fail
          if (typeof r.value !== 'number' && r.value !== null) err(where, k + ' used on non-numeric path "' + cond.path + '" (' + typeof r.value + ')');
        });
        if (cond.eq !== undefined) {
          if (typeof cond.eq !== typeof r.value) err(where, 'eq ' + JSON.stringify(cond.eq) + ' compares a ' + typeof cond.eq + ' with "' + cond.path + '", which is a ' + typeof r.value);
          if (cond.path === 'offer.guarantee' && GUARANTEES.indexOf(cond.eq) < 0) err(where, 'offer.guarantee eq must be one of ' + GUARANTEES.join(' / '));
          if (cond.path === 'flavor' && FLAVOR_KEYS.indexOf(cond.eq) < 0) err(where, 'flavor eq "' + cond.eq + '" is not a flavor id');
        }
      }
    }
  } else if (comps.length) err(where, 'comparator ' + comps.join('/') + ' without a path');
  ['level', 'minLevel', 'maxLevel'].forEach(function (k) {
    if (cond[k] !== undefined && !(isInt(cond[k]) && cond[k] >= 1 && cond[k] <= 10)) err(where, k + ' must be a whole number 1–10');
  });
  ['minDay', 'maxDay'].forEach(function (k) {
    if (cond[k] !== undefined && !(isInt(cond[k]) && cond[k] >= 1)) err(where, k + ' must be a whole number >= 1');
  });
  ['flag', 'notFlag'].forEach(function (k) {
    if (cond[k] === undefined) return;
    if (!isStr(cond[k])) err(where, k + ' needs a flag name');
    else flagsRead.push({ name: cond[k], where: where });
  });
  ['upgrade', 'notUpgrade'].forEach(function (k) {
    if (cond[k] !== undefined && !byId(C.upgrades, cond[k])) err(where, k + ' "' + cond[k] + '" is not an upgrade id');
  });
  if (cond.chance !== undefined) {
    if (!allowChance) err(where, '"chance" is only meaningful in card triggers and event conds');
    if (!(isNum(cond.chance) && cond.chance > 0 && cond.chance <= 1)) err(where, 'chance must be in (0, 1]');
  }
}

function runCond(cond, where) {
  if (cond === undefined) return;
  withWarnings(where, function () {
    FLAVOR_KEYS.forEach(function (f) {
      [1, 4, 7, 10].forEach(function (L) {
        var s = clone(levelState(f, L));
        var v = E.checkCondition(s, C, cond);
        if (typeof v !== 'boolean') throw new Error('checkCondition returned ' + typeof v + ' at Level ' + L);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// 1. structure + engine contract
// ---------------------------------------------------------------------------
section('Content keys & engine contract', function () {
  ['meta', 'glossary', 'channels', 'combos', 'premiumDefaults'].forEach(function (k) { if (!isObj(C[k])) err('Content.' + k, 'missing or not an object'); });
  ['flavors', 'levels', 'coach', 'achievements', 'upgrades', 'cards', 'events', 'notebook',
   'roles', 'projects', 'departments', 'fireTypes', 'bets', 'perks'].forEach(function (k) {
    if (!Array.isArray(C[k]) || !C[k].length) err('Content.' + k, 'missing or empty array');
  });
  if (isObj(C.meta)) { needStr(C.meta, 'title', 'meta'); needStr(C.meta, 'version', 'meta'); needStr(C.meta, 'tagline', 'meta'); }
  ENGINE_API.forEach(function (fn) { if (typeof E[fn] !== 'function') err('Engine.' + fn, 'missing (§6 API)'); });
  if (!isObj(E.TUNING)) err('Engine.TUNING', 'missing');
  if (typeof E.isAllowedPath === 'function') {
    SPEC_PATHS.concat(['combos.hook.price', 'combos.membership.price', 'channels.ads.level', 'channels.warm.level'],
      DEPT_IDS.map(function (d) { return 'depts.' + d + '.health'; })).forEach(function (p) {
      if (!E.isAllowedPath(p)) err('Engine.isAllowedPath', 'rejects allowed path "' + p + '"');
    });
    ['energy.current', 'combos.hook.on', 'combos.foo.price', 'channels.warm.unlocked', 'stats.salesCount', 'mods.closeRate',
     'team.coach', 'depts.sales.spec', 'depts.legal.health', 'premium.on', 'exit.sold', 'flags.betDone', 'ops.done'].forEach(function (p) {
      if (E.isAllowedPath(p)) err('Engine.isAllowedPath', 'accepts non-allowed path "' + p + '"');
    });
  } else err('Engine.isAllowedPath', 'missing');
  if (Array.isArray(E.ALLOWED_PATHS)) {
    E.ALLOWED_PATHS.forEach(function (p) { if (!specPath(p)) err('Engine.ALLOWED_PATHS', '"' + p + '" is not a §5.3 / SPEC-LATE §2 path'); });
  }
  if (Array.isArray(E.ROLE_IDS) && E.ROLE_IDS.slice().sort().join(',') !== ROLE_IDS.slice().sort().join(',')) err('Engine.ROLE_IDS', 'differs from SPEC-LATE §2 team roles');
  if (Array.isArray(E.DEPT_IDS) && E.DEPT_IDS.slice().sort().join(',') !== DEPT_IDS.slice().sort().join(',')) err('Engine.DEPT_IDS', 'differs from SPEC-LATE §2 departments');
  if (Array.isArray(LATE.DEPT_IDS) && LATE.DEPT_IDS.slice().sort().join(',') !== DEPT_IDS.slice().sort().join(',')) err('Engine.late.DEPT_IDS', 'differs from SPEC-LATE §2 departments');
  if (!Array.isArray(E.systems) || E.systems.length < 4) err('Engine.systems', 'engine-late should register 4 systems (efficiency, departments, specialists, empire)');
  // the scripts index.html loads must be exactly the files this validator checks (plus fx/ui), in this order
  var htmlFile = path.join(ROOT, 'index.html');
  if (fs.existsSync(htmlFile)) {
    var srcs = [], re2 = /<script[^>]*\bsrc="js\/([^"]+)"/g, mm2, html = fs.readFileSync(htmlFile, 'utf8');
    while ((mm2 = re2.exec(html))) srcs.push(mm2[1]);
    var want = FILES.concat(['fx.js', 'ui.js']);
    if (srcs.join(',') !== want.join(',')) err('index.html', 'script order ' + JSON.stringify(srcs) + ' should be ' + JSON.stringify(want));
  }
  // every Engine function / extra the UI calls must exist
  if (UI_SRC) {
    var called = {}, extras = {}, mm3;
    [/\beng\(\s*'([A-Za-z_]\w*)'/g, /\bhasEng\(\s*'([A-Za-z_]\w*)'/g, /\bcompanyAct\(\s*[^,()]+,\s*'([A-Za-z_]\w*)'/g,
     /\bZTE\.Engine\.([A-Za-z_]\w*)\s*\(/g].forEach(function (r) { while ((mm3 = r.exec(UI_SRC))) called[mm3[1]] = true; });
    // names picked at runtime, e.g. kind === 'focus' ? 'setFocus' : 'setPremiumPrice'
    var dyn = /var api = [^;]*;/g;
    while ((mm3 = dyn.exec(UI_SRC))) { var lit = /'([A-Za-z_]\w*)'/g, m4; while ((m4 = lit.exec(mm3[0]))) if (/^set[A-Z]/.test(m4[1])) called[m4[1]] = true; }
    Object.keys(called).forEach(function (fn) { if (typeof E[fn] !== 'function') err('ui.js', 'calls Engine.' + fn + ', which the engine does not export'); });
    var re5 = /\bZTE\.Engine\.([A-Za-z_]\w*)\b(?!\s*\()/g;
    while ((mm3 = re5.exec(UI_SRC))) if (E[mm3[1]] === undefined) err('ui.js', 'reads Engine.' + mm3[1] + ', which the engine does not export');
    var re6 = /\blateX\(\)\.([A-Za-z_]\w*)/g;
    while ((mm3 = re6.exec(UI_SRC))) extras[mm3[1]] = true;
    Object.keys(extras).forEach(function (k) { if (LATE[k] === undefined) err('ui.js', 'reads Engine.late.' + k + ', which engine-late does not export'); });
  }
  if (Array.isArray(E.MOD_KEYS)) {
    var a = E.MOD_KEYS.slice().sort().join(','), b = MOD_KEYS.slice().sort().join(',');
    if (a !== b) err('Engine.MOD_KEYS', 'differs from the §4 mods keys');
  }
  if (REF_STATE) {
    MOD_KEYS.forEach(function (k) { if (REF_STATE.mods[k] !== 1) err('createState().mods', '"' + k + '" should start at 1'); });
  }
});

// ---------------------------------------------------------------------------
// 2. unique ids
// ---------------------------------------------------------------------------
section('Unique ids', function () {
  ['flavors', 'levels', 'coach', 'achievements', 'upgrades', 'cards', 'events', 'notebook',
   'roles', 'projects', 'departments', 'fireTypes', 'bets', 'perks'].forEach(function (k) { uniqueIds(C[k], k); });
  arr(C.cards).forEach(function (c, i) { uniqueIds(c && c.options, 'cards[' + i + '](' + (c && c.id) + ').options'); });
});

// ---------------------------------------------------------------------------
// 3. glossary, flavors, levels, channels, combos (base.js)
// ---------------------------------------------------------------------------
section('Glossary & names (§2, §1)', function () {
  var g = C.glossary || {};
  Object.keys(GLOSSARY).forEach(function (k) {
    if (g[k] === undefined) err('glossary.' + k, 'missing');
    else if (g[k] !== GLOSSARY[k]) err('glossary.' + k, '"' + g[k] + '" should be "' + GLOSSARY[k] + '" (§2)');
  });
  Object.keys(g).forEach(function (k) { if (!GLOSSARY[k]) err('glossary.' + k, 'not a §2 key'); });
  var ch = C.channels || {};
  CHANNEL_IDS.forEach(function (id) {
    var c = ch[id], w = 'channels.' + id;
    if (!isObj(c)) { err(w, 'missing'); return; }
    if (c.name !== CHANNEL_NAMES[id]) err(w, 'name "' + c.name + '" should be "' + CHANNEL_NAMES[id] + '"');
    ['emoji', 'verb', 'desc'].forEach(function (k) { needStr(c, k, w); });
    if (!(isInt(c.unlockLevel) && c.unlockLevel >= 1 && c.unlockLevel <= 3)) err(w, 'unlockLevel must be 1–3');
    if (c.notebook !== undefined) checkNotebookRef(c.notebook, w + '.notebook');
  });
  Object.keys(ch).forEach(function (id) { if (CHANNEL_IDS.indexOf(id) < 0) err('channels.' + id, 'unknown channel id'); });
  var cb = C.combos || {};
  COMBO_IDS.forEach(function (id) {
    var c = cb[id], w = 'combos.' + id;
    if (!isObj(c)) { err(w, 'missing'); return; }
    if (c.name !== COMBO_NAMES[id]) err(w, 'name "' + c.name + '" should be "' + COMBO_NAMES[id] + '"');
    ['emoji', 'desc'].forEach(function (k) { needStr(c, k, w); });
    if (c.unlockLevel !== undefined && !(isInt(c.unlockLevel) && c.unlockLevel >= 1 && c.unlockLevel <= 3)) err(w, 'unlockLevel must be 1–3');
    if (c.notebook !== undefined) checkNotebookRef(c.notebook, w + '.notebook');
  });
  Object.keys(cb).forEach(function (id) { if (COMBO_IDS.indexOf(id) < 0) err('combos.' + id, 'unknown combo id'); });
});

section('Flavors (§5.4)', function () {
  var ids = arr(C.flavors).map(function (f) { return f && f.id; });
  FLAVOR_IDS.forEach(function (id) { if (ids.indexOf(id) < 0) err('flavors', 'missing flavor "' + id + '"'); });
  arr(C.flavors).forEach(function (f, i) {
    var w = 'flavors[' + i + '](' + (f && f.id) + ')';
    if (!isObj(f)) { err(w, 'not an object'); return; }
    if (FLAVOR_IDS.indexOf(f.id) < 0) err(w, 'unknown flavor id');
    ['name', 'emoji', 'pitch', 'offerName'].forEach(function (k) { needStr(f, k, w); });
    var st = f.start;
    if (!isObj(st)) err(w, 'needs "start"');
    else {
      ['cash', 'livingCost', 'networkSize'].forEach(function (k) { if (!(isNum(st[k]) && st[k] > 0)) err(w + '.start', '"' + k + '" must be a positive number'); });
      if (!isObj(st.dials)) err(w + '.start', 'needs "dials"');
      else ['dream', 'likelihood', 'speed', 'ease'].forEach(function (k) {
        if (!(isNum(st.dials[k]) && st.dials[k] >= 1 && st.dials[k] <= 10)) err(w + '.start.dials', '"' + k + '" must be 1–10');
      });
    }
    ['suggestedPrice', 'marketValue', 'adCplBase', 'deliveryEnergyPerCustomer', 'deliveryDays', 'trialDays'].forEach(function (k) {
      if (!(isNum(f[k]) && f[k] > 0)) err(w, '"' + k + '" must be a positive number');
    });
    ['warmReplyBase', 'coldReplyBase'].forEach(function (k) {
      if (!(isNum(f[k]) && f[k] > 0 && f[k] < 1)) err(w, '"' + k + '" must be a fraction between 0 and 1');
    });
  });
});

section('Levels & goals (§1, §5.4, SPEC-LATE §1, §5)', function () {
  var lv = arr(C.levels);
  if (lv.length !== 10) err('levels', 'expected 10 entries, found ' + lv.length);
  LEVELS.forEach(function (row, i) {
    var L = lv[i], w = 'levels[' + i + ']', N = row[0];
    if (!isObj(L)) { err(w, 'missing'); return; }
    if (L.id !== N) err(w, 'id should be ' + N + ' (table order)');
    if (L.key !== row[1]) err(w, 'key "' + L.key + '" should be "' + row[1] + '"');
    if (L.name !== row[2]) err(w, 'name "' + L.name + '" should be "' + row[2] + '"');
    ['role', 'emoji', 'constraint', 'bottomLine'].forEach(function (k) { needStr(L, k, w); });
    if (L.locked) err(w, 'every level 1–10 is playable now (no locked: true)');
    if (!Array.isArray(L.intro) || !L.intro.length || !L.intro.every(isStr)) err(w, 'needs intro: [coach lines]');
    needStr(L, 'outro', w);
    checkEffects(L.onEnter, w + '.onEnter', N);
    var g = L.goal;
    if (!isObj(g)) { err(w, 'needs a goal'); return; }
    needStr(g, 'text', w + '.goal');
    if (!Array.isArray(g.items) || !g.items.length) { err(w + '.goal', 'needs items'); return; }
    g.items.forEach(function (it, j) {
      var wi = w + '.goal.items[' + j + ']';
      if (!isObj(it)) { err(wi, 'not an object'); return; }
      needStr(it, 'label', wi);
      if (!(isNum(it.target) && it.target > 0)) err(wi, 'target must be a positive number');
      if (it.lte !== undefined && typeof it.lte !== 'boolean') err(wi, 'lte must be true/false');
      if (it.format !== undefined && ['money', 'percent'].indexOf(it.format) < 0) err(wi, 'format must be money / percent');
      if (it.targetByFlavor !== undefined) {
        if (!isObj(it.targetByFlavor)) err(wi, 'targetByFlavor must be an object');
        else Object.keys(it.targetByFlavor).forEach(function (fk) {
          if (FLAVOR_KEYS.indexOf(fk) < 0) err(wi, 'targetByFlavor: unknown flavor ' + fk);
          if (!(isNum(it.targetByFlavor[fk]) && it.targetByFlavor[fk] > 0)) err(wi, 'targetByFlavor.' + fk + ' must be a positive number');
        });
      }
      if (!isStr(it.path)) { err(wi, 'needs a path'); return; }
      if (/(^|\.)_/.test(it.path)) err(wi, 'path "' + it.path + '" reads a private engine field');
      FLAVOR_KEYS.forEach(function (f) {
        var isM = String(it.path).indexOf('metrics.') === 0;
        var v = isM ? getPath(levelMetrics(f, N), it.path.slice(8)) : getPath(levelState(f, N), it.path);
        if (Array.isArray(v)) v = v.length;
        if (typeof v !== 'number' || !isFinite(v)) err(wi, 'path "' + it.path + '" does not resolve to a number on a Level ' + N + ' ' + f + ' state' + (isM ? ' (computeMetrics)' : ''));
      });
    });
    // SPEC-LATE §1 table for levels 4–10
    if (SPEC_GOALS[N]) {
      var spec = SPEC_GOALS[N], bare = function (p) { return String(p).replace(/^metrics\./, ''); };
      if (g.items.length !== spec.length) err(w + '.goal', 'has ' + g.items.length + ' items, SPEC-LATE §1 lists ' + spec.length);
      spec.forEach(function (row2, j) {
        var it = g.items[j], wi = w + '.goal.items[' + j + ']';
        if (!isObj(it)) return;
        if (bare(it.path) !== bare(row2[0])) err(wi, 'path "' + it.path + '" should be "' + row2[0] + '" (SPEC-LATE §1)');
        if (it.target !== row2[1]) err(wi, 'target ' + it.target + ' should be ' + row2[1] + ' (SPEC-LATE §1)');
        var ag = it.targetByFlavor && it.targetByFlavor.agency;
        if (row2[2] && ag !== row2[2]) err(wi, 'agency target ' + ag + ' should be ' + row2[2] + ' (targetByFlavor, SPEC-LATE §1)');
        if (!row2[2] && ag !== undefined) err(wi, 'SPEC-LATE §1 has no agency target for this item');
        if (!!row2[3] !== !!it.lte) err(wi, row2[3] ? 'needs lte: true (SPEC-LATE §5)' : 'should not be an lte item');
      });
    }
    // the engine reads the same goal, per flavor, on a state at this level
    FLAVOR_KEYS.forEach(function (f) {
      withWarnings(w + '.goal (Engine.getGoal, ' + f + ')', function () {
        var s = clone(levelState(f, N)); s.level = N;
        var gg = E.getGoal(s, C);
        if (!gg || !Array.isArray(gg.items) || gg.items.length !== g.items.length) throw new Error('getGoal returned ' + (gg && gg.items ? gg.items.length : 'no') + ' items, content has ' + g.items.length);
        gg.items.forEach(function (x, j) {
          var it = g.items[j];
          if (!isNum(x.current)) throw new Error('getGoal item "' + x.label + '" has non-numeric current');
          var want = (it.targetByFlavor && isNum(it.targetByFlavor[f])) ? it.targetByFlavor[f] : it.target;
          if (x.target !== want) throw new Error('getGoal item "' + x.label + '" target ' + x.target + ', content says ' + want + ' for ' + f);
          if (!!x.lte !== !!it.lte) throw new Error('getGoal item "' + x.label + '" lost its lte flag');
        });
        if (!isNum(gg.progress) || gg.progress < 0 || gg.progress > 1) throw new Error('progress should be in [0, 1], got ' + gg.progress);
        if (N <= 3 && gg.progress >= 1) throw new Error('a fresh state should start with progress < 1, got ' + gg.progress);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 4. coach + achievements
// ---------------------------------------------------------------------------
section('Coach lines & achievements', function () {
  arr(C.coach).forEach(function (c, i) {
    var w = 'coach[' + i + '](' + (c && c.id) + ')';
    if (!isObj(c)) { err(w, 'not an object'); return; }
    needStr(c, 'text', w);
    if (c.cond === undefined) err(w, 'needs a cond');
    checkCond(c.cond, w + '.cond', false); runCond(c.cond, w + '.cond');
  });
  arr(C.achievements).forEach(function (a, i) {
    var w = 'achievements[' + i + '](' + (a && a.id) + ')';
    if (!isObj(a)) { err(w, 'not an object'); return; }
    ['name', 'emoji', 'desc'].forEach(function (k) { needStr(a, k, w); });
    if (a.cond === undefined) err(w, 'needs a cond');
    checkCond(a.cond, w + '.cond', false); runCond(a.cond, w + '.cond');
  });
});

// ---------------------------------------------------------------------------
// 5. upgrades
// ---------------------------------------------------------------------------
section('Upgrades (§5.5)', function () {
  var ups = arr(C.upgrades);
  ups.forEach(function (u, i) {
    var w = 'upgrades[' + i + '](' + (u && u.id) + ')';
    if (!isObj(u)) { err(w, 'not an object'); return; }
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(u, k, w); });
    if (CATEGORIES.indexOf(u.category) < 0) err(w, 'category must be one of ' + CATEGORIES.join(' / '));
    if (!(isInt(u.minLevel) && u.minLevel >= 1 && u.minLevel <= 10)) err(w, 'minLevel must be 1–10');
    if (u.sop !== undefined && SOP_IDS.indexOf(u.sop) < 0) err(w, 'sop must be one of ' + SOP_IDS.join(' / '));
    if (u.rank !== undefined && !(isInt(u.rank) && u.rank >= 1 && u.rank <= 3)) err(w, 'rank must be 1–3');
    if (u.group !== undefined && !isStr(u.group)) err(w, 'group must be a non-empty string');
    if (!isObj(u.cost) || !isNum(u.cost.cash) || u.cost.cash < 0 || !isNum(u.cost.energy) || u.cost.energy < 0) err(w, 'cost needs {cash >= 0, energy >= 0}');
    if (u.requires !== undefined) {
      if (!Array.isArray(u.requires)) err(w, 'requires must be an array');
      arr(u.requires).forEach(function (r) {
        if (r === u.id) err(w, 'requires itself');
        else if (!byId(ups, r)) err(w, 'requires unknown upgrade "' + r + '"');
        else if (isInt(u.minLevel) && byId(ups, r).minLevel > u.minLevel) warnc(w, 'requires "' + r + '", which only unlocks at Level ' + byId(ups, r).minLevel);
      });
    }
    checkCond(u.cond, w + '.cond', false, u.minLevel); runCond(u.cond, w + '.cond');
    if (!Array.isArray(u.effects) || !u.effects.length) err(w, 'needs effects');
    checkEffects(u.effects, w + '.effects', u.minLevel);
    if (u.notebook !== undefined) { checkNotebookRef(u.notebook, w + '.notebook'); addUnlocker(u.notebook, w + '.notebook', u.minLevel); }
  });
  // requires cycles
  var state = {};
  function visit(id, stack) {
    if (state[id] === 2) return;
    if (state[id] === 1) { err('upgrades', 'requires cycle: ' + stack.concat(id).join(' → ')); return; }
    state[id] = 1;
    var u = byId(ups, id);
    arr(u && u.requires).forEach(function (r) { if (byId(ups, r)) visit(r, stack.concat(id)); });
    state[id] = 2;
  }
  ups.forEach(function (u) { if (u && u.id) visit(u.id, []); });
});

// ---------------------------------------------------------------------------
// 6. cards + events
// ---------------------------------------------------------------------------
section('Choice cards & events (§5.6)', function () {
  var perLevel = {};
  arr(C.cards).forEach(function (c, i) {
    var w = 'cards[' + i + '](' + (c && c.id) + ')';
    if (!isObj(c)) { err(w, 'not an object'); return; }
    ['emoji', 'title', 'text'].forEach(function (k) { needStr(c, k, w); });
    if (!(isInt(c.level) && c.level >= 1 && c.level <= 10)) err(w, 'level must be 1–10');
    else perLevel[c.level] = (perLevel[c.level] || 0) + 1;
    if (!isNum(c.priority)) err(w, 'priority must be a number');
    if (c.ghostDays !== undefined && !(isInt(c.ghostDays) && c.ghostDays >= 1 && c.ghostDays <= 365)) err(w, 'ghostDays must be a whole number 1–365');
    if (c.trigger === undefined) err(w, 'needs a trigger');
    checkCond(c.trigger, w + '.trigger', true, c.level); runCond(c.trigger, w + '.trigger');
    if (isObj(c.trigger) && isInt(c.level) && c.level >= 4 && guardLevel(c.trigger) < c.level &&
        !arr(c.trigger.all).some(function (x) { return guardLevel(x) >= c.level; })) {
      warnc(w, 'level ' + c.level + ' card trigger has no minLevel/level guard (it could fire early)');
    }
    var opts = c.options;
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > 3) err(w, 'needs 2–3 options (has ' + (Array.isArray(opts) ? opts.length : 'none') + ')');
    var best = 0;
    arr(opts).forEach(function (o, j) {
      var wo = w + '.options[' + j + '](' + (o && o.id) + ')';
      if (!isObj(o)) { err(wo, 'not an object'); return; }
      ['label', 'outcome', 'lesson'].forEach(function (k) { needStr(o, k, wo); });
      if (QUALITIES.indexOf(o.quality) < 0) err(wo, 'quality must be best / ok / trap');
      if (o.quality === 'best') best++;
      if (!Array.isArray(o.effects)) err(wo, 'needs an effects array');
      checkEffects(o.effects, wo + '.effects', c.level);
    });
    if (best !== 1) err(w, 'needs exactly one "best" option (has ' + best + ')');
    if (c.notebook !== undefined) { checkNotebookRef(c.notebook, w + '.notebook'); addUnlocker(c.notebook, w + '.notebook', c.level); }
  });
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (l) { if ((perLevel[l] || 0) !== 6) warnc('cards', 'level ' + l + ' has ' + (perLevel[l] || 0) + ' cards (target 6)'); });
  // ids must be unique across the card files (each file is loaded on its own to see what it adds)
  var vm = require('vm'), owner = {};
  CARD_FILES.forEach(function (rel) {
    var ctx = { console: { log: function () {}, warn: function () {}, error: function () {} } };
    ctx.globalThis = ctx; ctx.ZTE = { Content: { cards: [], events: [] } };
    try { vm.runInNewContext(fs.readFileSync(path.join(JS, rel), 'utf8'), ctx, { filename: rel }); }
    catch (e) { err('js/' + rel, 'could not be loaded on its own: ' + e.message); return; }
    ['cards', 'events'].forEach(function (k) {
      arr(ctx.ZTE.Content[k]).forEach(function (x) {
        if (!x || !x.id) return;
        var key = k + ':' + x.id;
        if (owner[key] && owner[key] !== rel) err('js/' + rel, k.slice(0, -1) + ' id "' + x.id + '" is also defined in js/' + owner[key]);
        else if (owner[key] === rel) err('js/' + rel, 'defines ' + k.slice(0, -1) + ' id "' + x.id + '" twice');
        owner[key] = rel;
      });
    });
  });
  arr(C.cards).forEach(function (c) { if (c && c.id && byId(C.events, c.id)) err('cards', 'id "' + c.id + '" is used by both a card and an event'); });
  arr(C.events).forEach(function (ev, i) {
    var w = 'events[' + i + '](' + (ev && ev.id) + ')';
    if (!isObj(ev)) { err(w, 'not an object'); return; }
    ['emoji', 'text'].forEach(function (k) { needStr(ev, k, w); });
    if (!(isNum(ev.chancePerDay) && ev.chancePerDay > 0 && ev.chancePerDay <= 1)) err(w, 'chancePerDay must be in (0, 1]');
    if (ev.once !== undefined && typeof ev.once !== 'boolean') err(w, 'once must be true/false');
    checkCond(ev.cond, w + '.cond', true, 1); runCond(ev.cond, w + '.cond');
    if (!Array.isArray(ev.effects)) err(w, 'needs an effects array');
    checkEffects(ev.effects, w + '.effects', isObj(ev.cond) ? Math.max(guardLevel(ev.cond), Math.max.apply(null, [1].concat(arr(ev.cond.all).map(guardLevel)))) : undefined);
  });
});

// ---------------------------------------------------------------------------
// 6b. late-game systems content (systems.js) — fields the engines read, run through the real engine
// ---------------------------------------------------------------------------
var VISIBLE_ROLE_BAN = /\bclosers?\b/i;   // player-visible text says "Sales Rep" (the role id may stay 'closer')
function finiteState(s) {
  var bad = [];
  (function walk(o, p) {
    if (typeof o === 'number' && !isFinite(o)) bad.push(p);
    else if (o && typeof o === 'object') for (var k in o) walk(o[k], p ? p + '.' + k : k);
  })(s, '');
  if (bad.length) throw new Error('state has non-finite numbers: ' + bad.slice(0, 6).join(', '));
}
function runDays(s, n) { for (var i = 0; i < n; i++) { var r = E.tick(s, C); if (!r || !Array.isArray(r.events)) throw new Error('tick did not return { events }'); } }
function numOrLevels(x, where, key) {
  if (isNum(x)) { if (!(x > 0)) err(where, key + ' must be > 0'); return; }
  if (Array.isArray(x)) { if (x.length !== 3 || !x.every(function (v) { return isNum(v) && v > 0; })) err(where, key + ' as a list needs 3 positive numbers (one per level)'); return; }
  err(where, key + ' must be a positive number or a list of 3 (one per specialist level)');
}
function okRes(r, what) { if (!r || r.ok !== true) throw new Error(what + ' refused: ' + (r && r.reason)); return r; }
function nbClean(s, what) {
  arr(s.notebook).forEach(function (id) { if (NOTEBOOK_IDS.indexOf(id) < 0) throw new Error(what + ' put an unknown id into state.notebook: ' + JSON.stringify(String(id).slice(0, 60))); });
}

section('Team roles & premium product (SPEC-LATE §3.1, §3.4)', function () {
  var roles = arr(C.roles), ids = roles.map(function (r) { return r && r.id; });
  ROLE_IDS.forEach(function (id) { if (ids.indexOf(id) < 0) err('roles', 'missing role "' + id + '"'); });
  roles.forEach(function (r, i) {
    var w = 'roles[' + i + '](' + (r && r.id) + ')';
    if (!isObj(r)) { err(w, 'not an object'); return; }
    if (ROLE_IDS.indexOf(r.id) < 0) err(w, 'unknown role id (the engine only knows ' + ROLE_IDS.join(', ') + ')');
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(r, k, w); });
    if (!(isInt(r.unlockLevel) && r.unlockLevel >= 4 && r.unlockLevel <= 10)) err(w, 'unlockLevel must be 4–10');
    ['salary', 'hireCost', 'capacity'].forEach(function (k) { if (!(isNum(r[k]) && r[k] > 0)) err(w, '"' + k + '" must be a positive number'); });
    if (r.nameByFlavor !== undefined) {
      if (!isObj(r.nameByFlavor)) err(w, 'nameByFlavor must be an object');
      else Object.keys(r.nameByFlavor).forEach(function (fk) {
        if (FLAVOR_KEYS.indexOf(fk) < 0) err(w, 'nameByFlavor: unknown flavor ' + fk);
        if (!isStr(r.nameByFlavor[fk])) err(w, 'nameByFlavor.' + fk + ' must be a non-empty string');
      });
    }
  });
  // what the player sees for each role (content name, per-flavor name, engine fallback roles)
  ROLE_IDS.forEach(function (id) {
    FLAVOR_KEYS.forEach(function (f) {
      var d = typeof E.roleDef === 'function' ? E.roleDef(C, id, f) : null;
      if (d && VISIBLE_ROLE_BAN.test(String(d.name))) err('roles.' + id, 'player-visible name for ' + f + ' is "' + d.name + '"; call it "Sales Rep" (or similar)');
    });
  });
  arr(E.DEFAULT_ROLES).forEach(function (r) { if (r && VISIBLE_ROLE_BAN.test(String(r.name))) err('Engine.DEFAULT_ROLES', 'fallback role name "' + r.name + '" is player-visible; call it "Sales Rep"'); });
  // hire every role, run a few days, let one go (the UI's call shapes)
  FLAVOR_KEYS.forEach(function (f) {
    withWarnings('roles (Engine.hire / fire, ' + f + ')', function () {
      var s = clone(levelState(f, 5)); s.cash = 1e6;
      // (the recruiting cap is cleared between test hires; it is checked on its own below)
      ROLE_IDS.forEach(function (id) { if (s.team) s.team.hires = []; okRes(E.hire(s, C, id), 'hire ' + id); });
      runDays(s, 3);
      okRes(E.fire(s, C, 'setter'), 'fire setter');
      okRes(E.setSquad(s, C, 'fans', true), "setSquad('fans')");
      okRes(E.setFocus(s, C, 70), 'setFocus');
      runDays(s, 2);
      var mt = E.computeMetrics(s, C);
      if (!(mt.headcount >= 1 + ROLE_IDS.length - 1)) throw new Error('metrics.headcount ' + mt.headcount + ' after hiring ' + ROLE_IDS.length + ' and letting 1 go');
      finiteState(s); nbClean(s, 'hiring');
      // recruiting cap (Engine.hireCap): a one-person company gets one hire per window, then hire() refuses
      if (typeof E.hireCap === 'function') {
        var s2 = clone(levelState(f, 4)); s2.cash = 1e6;
        okRes(E.hire(s2, C, 'coach'), 'first hire');
        var hc = E.hireCap(s2, C);
        if (!(hc && hc.left === 0)) throw new Error('hireCap after one hire at headcount 2 should leave 0, got ' + JSON.stringify(hc));
        if (E.hire(s2, C, 'coach').ok) throw new Error('the recruiting cap did not stop a second hire in the same window');
      }
    });
  });

  var pd = C.premiumDefaults, w = 'premiumDefaults';
  if (isObj(pd)) {
    var KNOWN = ['emoji', 'unlockLevel', 'buildCost', 'buildDays', 'priceMult', 'valueMult', 'finisherTake', 'activeTakePerDay',
      'focusBoost', 'deliveryEnergyMult', 'nameByFlavor', 'name', 'desc', 'teaches'];
    Object.keys(pd).forEach(function (k) { if (KNOWN.indexOf(k) < 0) err(w, 'unknown key "' + k + '" (nothing reads it)'); });
    ['buildCost', 'valueMult', 'deliveryEnergyMult'].forEach(function (k) { if (pd[k] !== undefined && !(isNum(pd[k]) && pd[k] > 0)) err(w, k + ' must be a positive number'); });
    if (pd.buildDays !== undefined && !(isInt(pd.buildDays) && pd.buildDays >= 1)) err(w, 'buildDays must be a whole number >= 1');
    if (pd.priceMult !== undefined && !(isNum(pd.priceMult) && pd.priceMult >= 1)) err(w, 'priceMult must be >= 1');
    ['finisherTake', 'activeTakePerDay'].forEach(function (k) { if (pd[k] !== undefined && !(isNum(pd[k]) && pd[k] >= 0 && pd[k] <= 1)) err(w, k + ' must be a fraction 0–1'); });
    if (pd.focusBoost !== undefined && !(isNum(pd.focusBoost) && pd.focusBoost >= 0)) err(w, 'focusBoost must be >= 0');
    if (pd.unlockLevel !== undefined && pd.unlockLevel !== 6) err(w, 'unlockLevel should be 6 (SPEC-LATE §1: Product Line)');
    if (pd.nameByFlavor !== undefined) {
      if (!isObj(pd.nameByFlavor)) err(w, 'nameByFlavor must be an object');
      else FLAVOR_KEYS.forEach(function (fk) { if (!isStr(pd.nameByFlavor[fk])) err(w, 'nameByFlavor.' + fk + ' missing'); });
    }
  }
  FLAVOR_KEYS.forEach(function (f) {
    withWarnings('premiumDefaults (Engine.buildPremium, ' + f + ')', function () {
      var s = clone(levelState(f, 6)); s.cash = 1e6;
      okRes(E.buildPremium(s, C), 'buildPremium');
      runDays(s, num(pd && pd.buildDays, 21) + 1);
      if (!s.premium.built) throw new Error('premium not built after buildDays');
      okRes(E.setPremiumPrice(s, C, Math.max(100, s.premium.price || 1000)), 'setPremiumPrice');
      okRes(E.togglePremium(s, C, true), 'togglePremium');
      runDays(s, 3);
      finiteState(s); nbClean(s, 'premium');
    });
  });
});
function num(x, d) { return isNum(x) ? x : d; }

section('Projects (SPEC-LATE §4.1)', function () {
  var metricIds = arr(LATE.METRIC_IDS).length ? LATE.METRIC_IDS : ['bookRate', 'showRate', 'closeRate', 'churn', 'deliveryEfficiency', 'cpl'];
  var seen = {};
  arr(C.projects).forEach(function (p, i) {
    var w = 'projects[' + i + '](' + (p && p.id) + ')';
    if (!isObj(p)) { err(w, 'not an object'); return; }
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(p, k, w); });
    if (metricIds.indexOf(p.metric) < 0 && p.metric !== 'general') err(w, 'metric "' + p.metric + '" must be one of ' + metricIds.join(' / ') + ' / general');
    else seen[p.metric] = true;
    if (!(isNum(p.cost) && p.cost > 0)) err(w, 'cost must be a positive number');
    if (!(isInt(p.days) && p.days >= 1)) err(w, 'days must be a whole number >= 1');
    if (!Array.isArray(p.effects) || !p.effects.length) err(w, 'needs effects');
    checkEffects(p.effects, w + '.effects', 7);
    if (p.notebook !== undefined) { checkNotebookRef(p.notebook, w + '.notebook'); addUnlocker(p.notebook, w + '.notebook', 7); }
    if (isStr(p.teaches) && NOTEBOOK_IDS.indexOf(p.teaches) >= 0) err(w, '`teaches` is the lesson text; put the lesson id in `notebook`');
  });
  metricIds.forEach(function (m) { if (!seen[m]) err('projects', 'no project fixes weakest metric "' + m + '" (SPEC-LATE §6: one per weakest-metric id)'); });
  // start and finish every project for real
  arr(C.projects).forEach(function (p) {
    if (!p || !p.id) return;
    withWarnings('projects.' + p.id + ' (Engine.startProject)', function () {
      var f = FLAVOR_KEYS[0], s = clone(levelState(f, 7)); s.cash = 1e7;
      okRes(E.startProject(s, C, p.id), 'startProject');
      runDays(s, num(p.days, 10) + 1);
      if (s.ops.project) throw new Error('project still running after its days');
      finiteState(s); nbClean(s, 'project ' + p.id);
      if (p.notebook && s.notebook.indexOf(p.notebook) < 0) throw new Error('finishing it did not unlock its notebook "' + p.notebook + '"');
    });
  });
});

section('Departments, fires & specialists (SPEC-LATE §4.2, §4.3)', function () {
  var deps = arr(C.departments), ids = deps.map(function (d) { return d && d.id; });
  DEPT_IDS.forEach(function (id) { if (ids.indexOf(id) < 0) err('departments', 'missing department "' + id + '"'); });
  deps.forEach(function (d, i) {
    var w = 'departments[' + i + '](' + (d && d.id) + ')';
    if (!isObj(d)) { err(w, 'not an object'); return; }
    if (DEPT_IDS.indexOf(d.id) < 0) err(w, 'unknown department id');
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(d, k, w); });
    numOrLevels(d.specCost, w, 'specCost'); numOrLevels(d.specHeadcount, w, 'specHeadcount'); numOrLevels(d.specSalary, w, 'specSalary');
    if (!Array.isArray(d.specEffects) || !d.specEffects.length) err(w, 'needs specEffects');
    arr(d.specEffects).forEach(function (e, j) {
      var we = w + '.specEffects[' + j + ']';
      if (!isObj(e)) { err(we, 'not an object'); return; }
      if (e.op !== undefined && e.op !== 'mod') err(we, 'specEffects are per-level multipliers: use { op: "mod", stat, mult }');
      Object.keys(e).forEach(function (k) { if (['op', 'stat', 'mult'].indexOf(k) < 0) err(we, 'unknown field "' + k + '"'); });
      if (MOD_KEYS.indexOf(e.stat) < 0 && SYS_ONLY_STATS.indexOf(e.stat) < 0) err(we, 'stat "' + e.stat + '" is not a mods key');
      if (!(isNum(e.mult) && e.mult > 0)) err(we, 'needs a positive number "mult"');
    });
    if (d.specTeams !== undefined && !(Array.isArray(d.specTeams) && d.specTeams.length === 3 && d.specTeams.every(isStr))) err(w, 'specTeams must list 3 names (one per level)');
  });
  var fts = arr(C.fireTypes), perDept = {};
  fts.forEach(function (t, i) {
    var w = 'fireTypes[' + i + '](' + (t && t.id) + ')';
    if (!isObj(t)) { err(w, 'not an object'); return; }
    ['title', 'emoji', 'desc'].forEach(function (k) { needStr(t, k, w); });
    if (DEPT_IDS.indexOf(t.dept) < 0) err(w, 'dept "' + t.dept + '" must be one of ' + DEPT_IDS.join(' / '));
    else perDept[t.dept] = (perDept[t.dept] || 0) + 1;
    ['impact', 'urgency'].forEach(function (k) { if (!(isInt(t[k]) && t[k] >= 1 && t[k] <= 3)) err(w, k + ' must be 1–3'); });
    if (t.days !== undefined && !(isInt(t.days) && t.days >= 1)) err(w, 'days must be a whole number >= 1');
    if (t.weight !== undefined && !(isNum(t.weight) && t.weight > 0)) err(w, 'weight must be a positive number');
    if (!Array.isArray(t.failEffects)) err(w, 'needs a failEffects array');
    checkEffects(t.failEffects, w + '.failEffects', 8);
  });
  DEPT_IDS.forEach(function (d) { if (!perDept[d]) err('fireTypes', 'no fire type for department "' + d + '"'); });
  if (!fts.some(function (t) { return t && t.impact === 1; }) || !fts.some(function (t) { return t && t.impact === 3; })) err('fireTypes', 'mix noise (impact 1) and real emergencies (impact 3)');
  // 90 days of Level 8 with fires spawning; handle one per week with the UI's call shape (uid as a string)
  FLAVOR_KEYS.forEach(function (f) {
    withWarnings('fireTypes (90 days at Level 8, ' + f + ')', function () {
      var s = clone(levelState(f, 8)); s.cash = 1e8;
      var spawned = {};
      for (var day = 0; day < 90; day++) {
        var r = E.tick(s, C);
        arr(r && r.events).forEach(function (ev) { if (ev && ev.type === 'fire' && !ev.burned) spawned[ev.id] = true; });
        arr(s.fires).forEach(function (fi) { if (fi && !byId(fts, fi.typeId)) throw new Error('spawned unknown fire type "' + fi.typeId + '" (content fireTypes not used)'); });
        if (s.fires.length && s.attention.left > 0) okRes(E.handleFire(s, C, String(s.fires[0].uid)), 'handleFire');
      }
      if (!Object.keys(spawned).length && !arr(s.fires).length) throw new Error('no fire spawned in 90 days');
      finiteState(s); nbClean(s, 'fires');
    });
  });
  // buy every specialist level in every department
  FLAVOR_KEYS.forEach(function (f) {
    withWarnings('departments (Engine.upgradeDept, ' + f + ')', function () {
      var s = clone(levelState(f, 9)); s.cash = 1e9;
      var hc0 = E.computeMetrics(s, C).headcount, add = 0;
      DEPT_IDS.forEach(function (id) {
        var d = byId(deps, id) || {};
        for (var l = 1; l <= 3; l++) {
          okRes(E.upgradeDept(s, C, id), 'upgradeDept ' + id + ' level ' + l);
          add += Array.isArray(d.specHeadcount) ? d.specHeadcount[l - 1] : num(d.specHeadcount, 0);
        }
      });
      var mt = E.computeMetrics(s, C);
      if (Math.round(mt.headcount - hc0) !== Math.round(add)) throw new Error('headcount grew by ' + (mt.headcount - hc0) + ', content specHeadcount adds ' + add);
      if (mt.specialistDepts !== DEPT_IDS.length) throw new Error('metrics.specialistDepts ' + mt.specialistDepts + ' with every department at level 3');
      runDays(s, 5);
      finiteState(s); nbClean(s, 'specialists');
    });
  });
});

section('Big Bets, perks (SPEC-LATE §4.4, §3.7)', function () {
  var bets = arr(C.bets);
  if (bets.length < 2) err('bets', 'needs several bets to choose from (SPEC-LATE §6 asks for 4)');
  bets.forEach(function (b, i) {
    var w = 'bets[' + i + '](' + (b && b.id) + ')';
    if (!isObj(b)) { err(w, 'not an object'); return; }
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(b, k, w); });
    if (!(isNum(b.cost) && b.cost > 0)) err(w, 'cost must be a positive number');
    if (!(isInt(b.days) && b.days >= 1)) err(w, 'days must be a whole number >= 1');
    if (!(isNum(b.baseChance) && b.baseChance > 0 && b.baseChance <= 1)) err(w, 'baseChance must be in (0, 1]');
    if (!Array.isArray(b.prep)) err(w, 'needs a prep array');
    var maxChance = num(b.baseChance, 0);
    arr(b.prep).forEach(function (pr, j) {
      var wp = w + '.prep[' + j + ']';
      if (!isObj(pr)) { err(wp, 'not an object'); return; }
      Object.keys(pr).forEach(function (k) { if (['metric', 'gte', 'bonus', 'label'].indexOf(k) < 0) err(wp, 'unknown field "' + k + '"'); });
      if (!isStr(pr.metric)) err(wp, 'needs a metric (a computeMetrics key)');
      else FLAVOR_KEYS.forEach(function (f) {
        var v = getPath(levelMetrics(f, 10), pr.metric);
        if (typeof v !== 'number' && v !== null) err(wp, 'metric "' + pr.metric + '" is not a number in Level 10 computeMetrics (' + f + ')');
      });
      if (!isNum(pr.gte)) err(wp, 'gte must be a number');
      if (!(isNum(pr.bonus) && pr.bonus > 0 && pr.bonus <= 1)) err(wp, 'bonus must be in (0, 1]');
      else maxChance += pr.bonus;
      if (pr.label !== undefined && !isStr(pr.label)) err(wp, 'label must be a non-empty string');
    });
    if (maxChance > 0.9 + 1e-9) warnc(w, 'baseChance + all prep bonuses = ' + maxChance.toFixed(2) + ' (the engine caps at 0.9)');
    if (!Array.isArray(b.success) || !b.success.length) err(w, 'needs success effects');
    if (!Array.isArray(b.fail) || !b.fail.length) err(w, 'needs fail effects');
    checkEffects(b.success, w + '.success', 10); checkEffects(b.fail, w + '.fail', 10);
  });
  bets.forEach(function (b) {
    if (!b || !b.id) return;
    FLAVOR_KEYS.forEach(function (f) {
      withWarnings('bets.' + b.id + ' (Engine.startBet, ' + f + ')', function () {
        var s = clone(levelState(f, 10)); s.cash = 1e9;
        if (typeof E.betChance === 'function') { var bc = E.betChance(s, C, b.id); if (!bc || !isNum(bc.chance)) throw new Error('betChance returned no chance'); }
        okRes(E.startBet(s, C, b.id), 'startBet');
        runDays(s, num(b.days, 30) + 1);
        if (s.bet || !s.flags.betDone || typeof s.flags.betWon !== 'boolean') throw new Error('bet did not resolve after its days');
        if (E.computeMetrics(s, C).betDone !== 1) throw new Error('metrics.betDone should be 1 after the bet');
        finiteState(s); nbClean(s, 'bet');
      });
    });
  });
  arr(C.perks).forEach(function (pk, i) {
    var w = 'perks[' + i + '](' + (pk && pk.id) + ')';
    if (!isObj(pk)) { err(w, 'not an object'); return; }
    ['name', 'emoji', 'desc', 'teaches'].forEach(function (k) { needStr(pk, k, w); });
    if (!(isInt(pk.cost) && pk.cost >= 1 && pk.cost <= 10)) err(w, 'cost (Wisdom) must be a whole number 1–10');
    if (!Array.isArray(pk.effects) || !pk.effects.length) err(w, 'needs effects');
    checkEffects(pk.effects, w + '.effects', 1);
    FLAVOR_KEYS.forEach(function (f) {
      withWarnings(w + ' (Engine.createState with perks, ' + f + ')', function () {
        var s = E.createState(C, { seed: 4242, flavor: f, perks: [pk.id] });
        if (arr(s.perks).indexOf(pk.id) < 0) throw new Error('createState did not apply the perk');
        finiteState(s);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 7. notebook
// ---------------------------------------------------------------------------
section("Founder's Notebook (§5.7)", function () {
  var nb = arr(C.notebook), ids = nb.map(function (e) { return e && e.id; });
  NOTEBOOK_IDS.forEach(function (id) { if (ids.indexOf(id) < 0) err('notebook', 'missing entry "' + id + '"'); });
  ids.forEach(function (id, i) { if (NOTEBOOK_IDS.indexOf(id) < 0) err('notebook[' + i + ']', 'id "' + id + '" is not in the fixed list'); });
  if (nb.length !== NOTEBOOK_IDS.length) err('notebook', 'has ' + nb.length + ' entries, expected exactly ' + NOTEBOOK_IDS.length + ' (' + EARLY_NOTEBOOK_COUNT + ' + ' + Object.keys(LATE_NOTEBOOK).length + ')');
  nb.forEach(function (e, i) {
    var w = 'notebook[' + i + '](' + (e && e.id) + ')';
    if (!isObj(e)) { err(w, 'not an object'); return; }
    ['term', 'emoji', 'title', 'summary', 'tip'].forEach(function (k) { needStr(e, k, w); });
    if (e.formula !== undefined && !isStr(e.formula)) err(w, 'formula, when present, must be a non-empty string');
    if (!(isInt(e.level) && e.level >= 1 && e.level <= 10)) err(w, 'level must be 1–10');
    else if (LATE_NOTEBOOK[e.id] !== undefined && e.level !== LATE_NOTEBOOK[e.id]) err(w, 'level ' + e.level + ' should be ' + LATE_NOTEBOOK[e.id] + ' (SPEC-LATE §6)');
    else if (LATE_NOTEBOOK[e.id] === undefined && e.level > 3) err(w, 'the 28 early lessons belong to levels 1–3');
    var q = e.quiz;
    if (!isObj(q)) { err(w, 'needs a quiz'); return; }
    needStr(q, 'q', w + '.quiz'); needStr(q, 'explain', w + '.quiz');
    if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isStr)) err(w + '.quiz', 'needs 2+ non-empty options');
    else if (!(isInt(q.answer) && q.answer >= 0 && q.answer < q.options.length)) err(w + '.quiz', 'answer index ' + q.answer + ' is out of range 0–' + (q.options.length - 1));
    withWarnings(w + '.quiz (Engine.answerQuiz)', function () {
      var s = JSON.parse(JSON.stringify(REF_STATE));
      if (!E.answerQuiz(s, C, e.id, q.answer).correct) throw new Error('the marked answer is not accepted as correct');
    });
  });
  // engine-hard-coded unlocks (e.g. client-financed acquisition)
  var re = /unlockNotebook\(\s*state\s*,\s*content\s*,\s*'([a-z_]+)'\s*\)/g, mm;
  while ((mm = re.exec(ENGINE_CORE_SRC))) { checkNotebookRef(mm[1], 'engine.js'); addUnlocker(mm[1], 'engine.js', LATE_NOTEBOOK[mm[1]] || 3); }
  var reL = /\bnb\(\s*state\s*,\s*content\s*,\s*api\s*,\s*'([a-z_]+)'/g;
  while ((mm = reL.exec(ENGINE_LATE_SRC))) { checkNotebookRef(mm[1], 'engine-late.js'); addUnlocker(mm[1], 'engine-late.js', LATE_NOTEBOOK[mm[1]] || 10); }
  // every lesson must be reachable, otherwise "x / 53 lessons" can never complete
  NOTEBOOK_IDS.forEach(function (id) {
    var u = notebookUnlockers[id], e = byId(nb, id);
    if (!u || !u.length) { err('notebook.' + id, 'nothing unlocks this lesson (no level onEnter, upgrade, card, project, effect or engine unlock)'); return; }
    var lvls = u.map(function (x) { return x.level; }).filter(isNum);
    if (e && isNum(e.level) && lvls.length && Math.min.apply(null, lvls) > e.level) {
      warnc('notebook.' + id, 'marked level ' + e.level + ' but first unlockable at level ' + Math.min.apply(null, lvls) + ' (' + u.map(function (x) { return x.where; }).join(', ') + ')');
    }
  });
});

// ---------------------------------------------------------------------------
// 8. cross-references gathered above
// ---------------------------------------------------------------------------
section('Flags, engine literals & effects (engine run)', function () {
  var engineFlags = {}, re = /flags\.([A-Za-z_]\w*)\s*=(?!=)/g, mm;
  while ((mm = re.exec(ENGINE_SRC))) engineFlags[mm[1]] = true;
  // ids the engine hard-codes must exist in content
  [[/findById\(\s*(?:C\(content\)|content)\.achievements\s*,\s*'([^']+)'/g, 'achievements'],
   [/achievements\.(?:push|indexOf)\(\s*'([^']+)'/g, 'achievements'],
   [/findById\(\s*(?:C\(content\)|content)\.(upgrades|cards|events|coach|flavors)\s*,\s*'([^']+)'/g, null]].forEach(function (pair) {
    var r = pair[0], m2;
    while ((m2 = r.exec(ENGINE_SRC))) {
      var coll = pair[1] || m2[1], id = pair[1] ? m2[1] : m2[2];
      if (!byId(C[coll], id)) err('engine.js', 'uses ' + coll + ' id "' + id + '" which content does not define');
    }
  });
  flagsRead.forEach(function (f) {
    if (!flagsSet[f.name] && !engineFlags[f.name]) err(f.where, 'reads flag "' + f.name + '" but no effect or engine code ever sets it');
  });
  // apply every effect list with the real engine on a copy of a state at its level (at least 3; lists with no
  // level at 3 and 10); any warning is a content bug
  effectLists.forEach(function (x) {
    withWarnings(x.where + ' (Engine.applyEffects)', function () {
      var lvls = isInt(x.level) ? [Math.max(3, Math.min(10, x.level))] : [3, 10];
      FLAVOR_KEYS.forEach(function (f) { lvls.forEach(function (L) {
        var s = clone(levelState(f, L)); s.level = L;
        var evs = E.applyEffects(s, C, x.list);
        if (!Array.isArray(evs)) throw new Error('applyEffects did not return an array');
        var bad = [];
        (function walk(o, p) {
          if (typeof o === 'number' && !isFinite(o)) bad.push(p);
          else if (o && typeof o === 'object') for (var k in o) walk(o[k], p ? p + '.' + k : k);
        })(s, '');
        if (bad.length) throw new Error('state has non-finite numbers after effects: ' + bad.join(', '));
      }); });
    });
  });
});

// ---------------------------------------------------------------------------
// 9. banned words (§0.1) across every project file
// ---------------------------------------------------------------------------
// Patterns are assembled from pieces so this file never contains the words it bans.
function re(src) { return new RegExp(src, 'i'); }
var BANNED = [
  { label: 'author name', re: re('hor' + 'mozi') },
  { label: 'company domain', re: re('acqui' + 'sition\\s*\\.\\s*com') },
  { label: 'big-number brand / book titles', re: re('(?<![0-9a-z.,])\\$?\\s?1' + '00\\s?m(?![a-z0-9])') },
  { label: 'offer framework name', re: re('gr' + 'and[\\s-]*sl' + 'am') },
  { label: 'lead framework name', re: re('\\bco' + 're\\s+fo' + 'ur\\b') },
  { label: 'lead framework name', re: re('\\ble' + 'ad\\s+get' + 'ters?\\b') },
  // the sales-framework acronym is matched in ALL CAPS only: the ordinary English word is fine as a code id
  // (team role 'closer'); player-visible role names are checked separately (they must say "Sales Rep")
  { label: 'sales acronym', re: new RegExp('\\bCLO' + 'SERS?\\b') },
  { label: 'outreach rule name', re: re('\\bru' + 'le\\s+of\\s+1' + '00\\b') },
  { label: 'book title', re: re('\\bmon' + 'ey\\s+mod' + 'els?\\b') },
  { label: 'playbook title', re: re('\\b(?:branding|closing|fast\\s+cash|goated\\s+ads|hooks|lead\\s+nurture|lifetime\\s+value|price\\s+raise|pricing|proof\\s+checklist|retention)\\s+play' + 'book\\b') },
  { label: 'playbook title', re: re('\\bproof\\s+check' + 'list\\b') },
  { label: 'roadmap title', re: re('\\bscaling\\s+road' + 'map\\b') },
  { label: 'book title', re: re('\\b(?:marketing\\s+mach' + 'ine|affiliate\\s+black' + 'book|lost\\s+chap' + 'ters?|gym\\s+lau' + 'nch)\\b') },
  { label: 'branded practice name', re: re('\\bgame\\s+ta' + 'pe\\b') }
];
var TEXT_EXT = ['.js', '.html', '.htm', '.css', '.md', '.json', '.txt', '.svg'];
function listFiles(dir) {
  var out = [];
  fs.readdirSync(dir).forEach(function (name) {
    if (name[0] === '.' || name === 'node_modules') return;
    var p = path.join(dir, name), st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(listFiles(p));
    else if (TEXT_EXT.indexOf(path.extname(name).toLowerCase()) >= 0) out.push(p);
  });
  return out;
}
var ALLOW_START = '<!-- banned-words-allowed:start -->', ALLOW_END = '<!-- banned-words-allowed:end -->';
var scannedFiles = 0;
section('Banned words (§0.1) in all project files', function () {
  listFiles(ROOT).forEach(function (file) {
    scannedFiles++;
    var rel = path.relative(ROOT, file), lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    var isSpec = rel === path.join('docs', 'SPEC.md'), allowed = false, opened = 0;
    lines.forEach(function (line, i) {
      if (isSpec && line.indexOf(ALLOW_START) >= 0) { allowed = true; opened++; return; }
      if (isSpec && line.indexOf(ALLOW_END) >= 0) { allowed = false; return; }
      if (allowed) return;
      BANNED.forEach(function (b) {
        var m = b.re.exec(line);
        if (m) err(rel + ':' + (i + 1), 'banned term (' + b.label + '): "' + m[0].trim() + '"');
      });
    });
    if (isSpec && allowed) err(rel, 'unclosed ' + ALLOW_START + ' block');
    // the spec's rule lists no longer spell out banned terms, so allow-markers are optional
  });
});

// ---------------------------------------------------------------------------
// 10. no copied sentences (§0.1) — 8-word runs shared with the source texts
// ---------------------------------------------------------------------------
var SHINGLE = 8, sourceNote = '';
section('No copied source sentences (§0.1)', function () {
  if (NO_SOURCES) { sourceNote = 'skipped (--no-sources)'; return; }
  if (!fs.existsSync(SOURCES) || !fs.statSync(SOURCES).isDirectory()) { sourceNote = 'skipped (no source texts at ' + SOURCES + ')'; return; }
  function words(s) { return String(s).toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9$]+/g, ' ').trim().split(/\s+/).filter(Boolean); }
  var set = new Set(), nFiles = 0;
  fs.readdirSync(SOURCES).forEach(function (f) {
    if (path.extname(f).toLowerCase() !== '.txt') return;
    nFiles++;
    var w = words(fs.readFileSync(path.join(SOURCES, f), 'utf8').replace(/=== PAGE \d+ ===/g, ' '));
    for (var i = 0; i + SHINGLE <= w.length; i++) set.add(w.slice(i, i + SHINGLE).join(' '));
  });
  // game text: every string in ZTE.Content, plus string literals in engine/ui/fx and the HTML
  var texts = [];
  (function walk(o, p) {
    if (typeof o === 'string') texts.push({ where: p, text: o });
    else if (o && typeof o === 'object') for (var k in o) walk(o[k], p + (Array.isArray(o) ? '[' + k + ']' : '.' + k));
  })(C, 'Content');
  ['js/engine.js', 'js/engine-late.js', 'js/ui.js', 'js/fx.js', 'index.html'].forEach(function (rel) {
    var file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return;
    var src = fs.readFileSync(file, 'utf8');
    if (/\.html$/.test(rel)) { texts.push({ where: rel, text: src.replace(/<[^>]+>/g, ' ') }); return; }
    var lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g, mm;
    while ((mm = lit.exec(src))) texts.push({ where: rel, text: mm[1] !== undefined ? mm[1] : mm[2] });
  });
  var hits = 0;
  texts.forEach(function (t) {
    var w = words(t.text);
    for (var i = 0; i + SHINGLE <= w.length; i++) {
      var g = w.slice(i, i + SHINGLE).join(' ');
      if (set.has(g)) { hits++; err(t.where, 'copies ' + SHINGLE + '+ words from the source texts: "' + g + '…"'); break; }
    }
  });
  sourceNote = texts.length + ' text strings vs ' + nFiles + ' source files (' + set.size + ' ' + SHINGLE + '-word runs)';
});

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
var counts = {
  flavors: arr(C.flavors).length, levels: arr(C.levels).length, coach: arr(C.coach).length,
  achievements: arr(C.achievements).length, upgrades: arr(C.upgrades).length, cards: arr(C.cards).length,
  events: arr(C.events).length, notebook: arr(C.notebook).length, roles: arr(C.roles).length,
  projects: arr(C.projects).length, departments: arr(C.departments).length, fireTypes: arr(C.fireTypes).length,
  bets: arr(C.bets).length, perks: arr(C.perks).length
};
if (!QUIET) {
  console.log('Zero to Exit — content validator');
  console.log('Content: ' + Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', '));
  console.log('Notebook references checked: ' + notebookRefs.length + '; effect lists run through the engine: ' + effectLists.length +
    '; project files scanned for banned words: ' + scannedFiles);
  if (sourceNote) console.log('Source-copy check: ' + sourceNote);
  sections.forEach(function (s) {
    console.log((s.errors ? '  FAIL ' : '  ok   ') + s.name + (s.errors ? ' (' + s.errors + ' error' + (s.errors === 1 ? '' : 's') + ')' : '') +
      (s.warnings ? ' [' + s.warnings + ' warning' + (s.warnings === 1 ? '' : 's') + ']' : ''));
  });
}
if (warnings.length) {
  console.log('\nWarnings (' + warnings.length + '):');
  warnings.forEach(function (w) { console.log('  - ' + w); });
}
if (errors.length) {
  console.log('\nErrors (' + errors.length + '):');
  errors.forEach(function (e) { console.log('  x ' + e); });
  console.log('\nvalidate-content: FAILED with ' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + '.');
  process.exit(1);
}
console.log('\nvalidate-content: all checks passed' + (warnings.length ? ' (' + warnings.length + ' warning' + (warnings.length === 1 ? '' : 's') + ')' : '') + '.');
