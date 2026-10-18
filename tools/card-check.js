#!/usr/bin/env node
/* Zero to Exit — choice-card teaching check (spec §5.6: the 'best' option should win over the ghost
 * timeline, though not always on day 1).
 *
 * For every card × flavor it builds a plausible state at the moment the card would appear (the smart
 * bot from balance-sim.js plays until the card's trigger fires; if it never fires in a few seeds, the
 * smart bot plays until the card's level and the card is forced pending), then runs
 * Engine.ghostCompare and reports each option's cash and 30-day revenue at the end of ghostDays.
 *
 * Each card × flavor is checked from up to --states (5) different game states (one per seed where the
 * trigger fires, out of --seeds (10)); option results are averaged over those states. (3 states was too
 * few: a weak-but-real edge could average out to a tie by luck of which states were drawn.)
 *
 * A card that never triggers in honest play is a content bug: it is reported as WARN, and when even the
 * forced state fails the card's trigger the row is 'n/a' (not counted as a pass).
 *
 * Levels 1–3 cards use the v0.1 runs (stopped at Level 4 / day 200). Level 4+ cards (SPEC-LATE §8) take their
 * states from full smart games (one game per seed collects every late card it meets) and ghost-compare at
 * the engine's late-game run count (TUNING.ghostRunsLate, time budget off for repeatable results).
 *
 * Usage: node game/tools/card-check.js [--card id] [--flavor id] [--states 5] [--seeds 10] [--runs N] [--late-runs N] [--verbose] [--strict]
 *                                      [--early | --late | --min-level N --max-level N]
 * Exit code 1 if any card's 'best' option does not finish with the most cash on average
 * (--strict: also if any card × flavor is 'n/a'). */
'use strict';
var path = require('path');

var args = process.argv.slice(2);
function arg(name, dflt) {
  var i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  var v = args[i + 1];
  return (v === undefined || v.indexOf('--') === 0) ? true : v;
}
var ONLY_CARD = arg('card', null), ONLY_FLAVOR = arg('flavor', null);
var MIN_LEVEL = parseInt(arg('min-level', 1), 10), MAX_LEVEL = parseInt(arg('max-level', 99), 10);
if (arg('late', false)) MIN_LEVEL = 4;
if (arg('early', false)) MAX_LEVEL = 3;
var STATES = parseInt(arg('states', 5), 10), MAX_SEEDS = parseInt(arg('seeds', 10), 10), VERBOSE = !!arg('verbose', false);
var STRICT = !!arg('strict', false);

var B = require(path.join(__dirname, 'balance-sim.js'));
var E = B.E, C = B.C;
if (arg('runs', null)) E.TUNING.ghostRuns = parseInt(arg('runs'), 10);
// --late-runs N: ghost Level 4+ cards at N runs (e.g. --late-runs 3 = TUNING.ghostMinRuns, what a slow phone gets)
if (arg('late-runs', null)) E.TUNING.ghostRunsLate = parseInt(arg('late-runs'), 10);
var warnings = {};
console.warn = function () { var m = Array.prototype.join.call(arguments, ' '); warnings[m] = (warnings[m] || 0) + 1; };

function copy(s) { return E.deserialize(E.serialize(s)); }
function stripChance(c) {
  if (Array.isArray(c)) return c.map(stripChance);
  if (!c || typeof c !== 'object') return c;
  var o = {};
  Object.keys(c).forEach(function (k) { if (k !== 'chance') o[k] = (k === 'all' || k === 'any' || k === 'not') ? stripChance(c[k]) : c[k]; });
  return o;
}

// Levels 1–3 cards keep the v0.1 runs (stop at Level 4 / day 200) so their results stay identical.
var EARLY_HOOKS = { maxLevel: 3, maxDays: B.EARLY_DAYS || 200 };
function early(card) { return (card.level || 1) <= 3; }
function hooksFor(card, h) { var o = {}; if (early(card)) { o.maxLevel = EARLY_HOOKS.maxLevel; o.maxDays = EARLY_HOOKS.maxDays; } for (var k in h) o[k] = h[k]; return o; }

// Late cards (Level 4+): one full smart game per seed collects the state at every late card it meets
// (the bot answers 'best' and plays on, so later cards see an honest company).
var lateStates = {};
function collectLate(flavor) {
  if (lateStates[flavor]) return lateStates[flavor];
  var got = lateStates[flavor] = {};
  for (var i = 0; i < MAX_SEEDS; i++) {
    B.runOne(flavor, 'smart', 1000 + i * 7919, null, {
      onCard: function (s, c) {
        if ((c.level || 1) < 4) return false;
        var l = got[c.id] || (got[c.id] = []);
        if (l.length < STATES && !l.some(function (x) { return x.seed === i; })) l.push({ state: copy(s), how: 'trigger', seed: i });
        return false;
      }
    });
  }
  return got;
}

// Up to STATES states where `card` is pending, reached by honest play when possible (one per seed).
function statesFor(card, flavor) {
  var out = [];
  if (!early(card)) out = (collectLate(flavor)[card.id] || []).slice();
  else for (var i = 0; i < MAX_SEEDS && out.length < STATES; i++) {
    var got = null;
    B.runOne(flavor, 'smart', 1000 + i * 7919, null, hooksFor(card, {
      onCard: function (s, c) { if (c.id === card.id) { got = copy(s); return true; } return false; }
    }));
    if (got) out.push({ state: got, how: 'trigger', seed: i });
  }
  if (out.length) return out;
  var one = fallbackState(card, flavor);
  return one ? [one] : [];
}
function fallbackState(card, flavor) {
  // fallback 1: the card lost the queue to other cards; keep the smart bot playing and take the first
  // day its trigger (ignoring the daily 'chance' roll) holds.
  var trig = stripChance(card.trigger), found = null;
  B.runOne(flavor, 'smart', 1000, null, hooksFor(card, {
    onDay: function (s) {
      if (found || s.cardsSeen.indexOf(card.id) >= 0) return;
      if (E.checkCondition(copy(s), C, trig)) { found = copy(s); found.pendingCard = card.id; s.gameOver = { reason: 'card-check stop', day: s.day }; }
    }
  }));
  if (found) return { state: found, how: 'trigger*', seed: 0 };
  // fallback 2: play until the card's level (+5 days to settle), then force the card
  var lv = card.level || 1, forced = null, since = null;
  B.runOne(flavor, 'smart', 1000, null, hooksFor(card, {
    onDay: function (s) {
      if (forced || s.level < lv) return;
      if (since === null) since = s.day;
      if (s.day - since >= 5 || s.level > lv) { forced = copy(s); forced.pendingCard = card.id; s.gameOver = { reason: 'card-check stop', day: s.day }; }
    }
  }));
  if (!forced) return null;
  // does the card's trigger (ignoring its daily 'chance' roll) even hold in the forced state?
  var probe = copy(forced); probe.pendingCard = null;
  return { state: forced, how: 'forced', seed: 0, triggerHolds: E.checkCondition(probe, C, trig) };
}

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function money(x) { var n = Math.round(x), neg = n < 0; n = Math.abs(n); return (neg ? '-$' : '$') + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

var cards = (C.cards || []).filter(function (c) { return (!ONLY_CARD || c.id === ONLY_CARD) && (c.level || 1) >= MIN_LEVEL && (c.level || 1) <= MAX_LEVEL; });
var flavors = (C.flavors || []).map(function (f) { return f.id; }).filter(function (f) { return !ONLY_FLAVOR || f === ONLY_FLAVOR; });
var rows = [], fails = [], lagDay1 = 0, total = 0, notNatural = [], na = [];

console.log('Zero to Exit card check — ghost timeline per option (' + E.TUNING.ghostRuns + '-run average, ' + Math.min(E.TUNING.ghostRuns, E.TUNING.ghostRunsLate) + ' from Level 4; Autopilot only)');
console.log('Cells: option(quality) cash at end / 30-day revenue at end, averaged over the states (days listed; q = queued');
console.log('behind other cards, f = forced). * = best option. Δ = best minus runner-up cash. wins = states where best had most cash.\n');

cards.forEach(function (card) {
  var days = card.ghostDays || E.TUNING.ghostDaysDefault;
  console.log(card.id + '  (L' + (card.level || '?') + ', ' + days + ' days)');
  flavors.forEach(function (fl) {
    var sts = statesFor(card, fl);
    if (!sts.length) { console.log('  ' + pad(fl, 8) + 'no state found'); fails.push(card.id + '/' + fl + ' (no state)'); return; }
    var natural = sts.some(function (st) { return st.how === 'trigger'; });
    if (!natural) notNatural.push(card.id + '/' + fl + ' (' + sts[0].how + ')');
    var isNA = sts.length === 1 && sts[0].how === 'forced' && !sts[0].triggerHolds;
    var best = (card.options || []).filter(function (o) { return o.quality === 'best'; })[0];
    var acc = {}, wins = 0;
    (card.options || []).forEach(function (o) { acc[o.id] = { id: o.id, q: o.quality, cash: 0, r30: 0, d1: 0 }; });
    sts.forEach(function (st) {
      var g = E.ghostCompare(st.state, C, card.id), top = null;
      (card.options || []).forEach(function (o) {
        var ser = g[o.id] || [], last = ser[ser.length - 1] || {}, d1 = ser[1] || {};
        acc[o.id].cash += (last.cash || 0) / sts.length; acc[o.id].r30 += (last.revenue30 || 0) / sts.length; acc[o.id].d1 += (d1.cash || 0) / sts.length;
        if (!top || last.cash > top.cash) top = { id: o.id, cash: last.cash };
      });
      if (best && top && top.id === best.id) wins++;
    });
    var res = (card.options || []).map(function (o) { return acc[o.id]; });
    var bestRes = res.filter(function (r) { return best && r.id === best.id; })[0];
    var others = res.filter(function (r) { return !best || r.id !== best.id; });
    var runner = others.reduce(function (a, r) { return !a || r.cash > a.cash ? r : a; }, null);
    var ok = bestRes && runner && bestRes.cash > runner.cash;
    var lag = bestRes && others.some(function (r) { return r.d1 > bestRes.d1; });
    if (isNA) na.push(card.id + '/' + fl);
    else { total++; if (lag) lagDay1++; if (!ok) fails.push(card.id + '/' + fl); }
    var how = sts.map(function (st) { return st.state.day + (st.how === 'forced' ? 'f' : st.how === 'trigger*' ? 'q' : ''); }).join(',');
    console.log('  ' + pad(fl, 8) + pad('day ' + how, 14) +
      res.map(function (r) { return pad((best && r.id === best.id ? '*' : ' ') + r.id + '(' + r.q + ') ' + money(r.cash) + ' / ' + money(r.r30), 44); }).join('') +
      (isNA ? 'n/a  (trigger never holds; forced state is not a real situation)' :
      (ok ? 'OK   Δ ' + money(bestRes.cash - runner.cash) : 'FAIL Δ ' + money((bestRes ? bestRes.cash : 0) - (runner ? runner.cash : 0))) +
      '  wins ' + wins + '/' + sts.length + (lag ? '  (lags day 1)' : '')) + (natural ? '' : '  WARN never triggered naturally'));
    rows.push({ card: card.id, flavor: fl, ok: ok });
  });
});

console.log('\n' + (total - fails.length) + '/' + total + ' card×flavor checks: best option finishes with the most cash.');
console.log(lagDay1 + '/' + total + ' have the best option behind on day 1 (a real trade-off).');
if (notNatural.length) console.log('WARN ' + notNatural.length + ' card×flavor never triggered naturally in ' + MAX_SEEDS + ' smart runs (q = queued behind other cards, f = forced): ' + notNatural.join(', '));
if (na.length) console.log('N/A  ' + na.length + ' card×flavor never trigger at all (content bug; not counted above): ' + na.join(', '));
if (fails.length) console.log('FAIL: ' + fails.join(', '));
var wk = Object.keys(warnings);
if (wk.length && VERBOSE) { console.log('\nEngine warnings:'); wk.forEach(function (k) { console.log('  ' + warnings[k] + '× ' + k); }); }
process.exit(fails.length || (STRICT && na.length) ? 1 : 0);
