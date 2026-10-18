#!/usr/bin/env node
/* Zero to Exit — balance simulator (spec §8, SPEC-LATE §8).
 * Runs bots (smart / naive / naiveLate / casual / mixed / idle) × seeds × flavors through the engine and prints a pacing report:
 * Levels 1–3 (judged on the first 200 days, as in v0.1) and the late game, Levels 4–10 up to the sale
 * at The Summit (judged on the whole run, default 600 days).
 * Usage: node game/tools/balance-sim.js [--days 600] [--seeds 5] [--flavor fitness] [--bot smart]
 *                                       [--verbose] [--partial] [--early] [--set T.opexShare=0.2,LT.effStart=60]
 *   --partial  run even if some content files are missing (engine must exist).
 *   --early    stop every run at Level 4 (the v0.1 report only; fast).
 *   --set      override TUNING (T.) / engine-late LT (LT.) values for this run only. */
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
var MAX_DAYS = parseInt(arg('days', 600), 10);
var EARLY_DAYS = 200;                 // Levels 1–3 are judged on the first 200 days (v0.1 report)
var EARLY_ONLY = !!arg('early', false);
var SEEDS = parseInt(arg('seeds', 5), 10);
var ONLY_FLAVOR = arg('flavor', null);
var ONLY_BOT = arg('bot', null);
var VERBOSE = !!arg('verbose', false);
var PARTIAL = !!arg('partial', false);

// ---------------------------------------------------------------------------
// load content + engine in spec order
// ---------------------------------------------------------------------------
var JS = path.join(__dirname, '..', 'js');
// index.html order (validate-content checks that order)
var FILES = ['content/base.js', 'content/upgrades.js', 'content/upgrades-late.js', 'content/cards.js', 'content/cards-late-a.js',
  'content/cards-late-b.js', 'content/notebook.js', 'content/notebook-late.js', 'content/systems.js', 'engine.js', 'engine-late.js'];
var missing = FILES.filter(function (f) { return !fs.existsSync(path.join(JS, f)); });
if (missing.length && (!PARTIAL || missing.indexOf('engine.js') >= 0 || missing.indexOf('content/base.js') >= 0)) {
  console.error('balance-sim: missing file(s): ' + missing.map(function (f) { return 'js/' + f; }).join(', '));
  console.error('Write them first (or pass --partial to run with what exists; base.js and engine.js are always required).');
  process.exit(1);
}
FILES.forEach(function (f) {
  if (missing.indexOf(f) >= 0) return;
  try { require(path.join(JS, f)); } catch (e) {
    console.error('balance-sim: failed to load js/' + f + ': ' + e.message);
    process.exit(1);
  }
});
var ZTE = globalThis.ZTE;
if (!ZTE || !ZTE.Engine || !ZTE.Content) { console.error('balance-sim: ZTE.Engine / ZTE.Content not found after loading.'); process.exit(1); }
var E = ZTE.Engine, C = ZTE.Content;
if (missing.length) console.log('(partial run — missing: ' + missing.join(', ') + ')');
E.TUNING.ghostBudgetMs = 0;   // tools: always the full number of ghost runs (repeatable results)
// --set T.key=value,LT.key=value : try TUNING (engine.js) / LT (engine-late.js) values without editing the files
(function () {
  var spec = arg('set', null);
  if (!spec || spec === true) return;
  String(spec).split(',').forEach(function (kv) {
    var m = kv.match(/^(T|LT)\.([A-Za-z0-9_]+)=(.+)$/);
    if (!m) { console.error('balance-sim: bad --set item ' + kv); process.exit(1); }
    var tgt = m[1] === 'T' ? E.TUNING : (E.late && E.late.LT);
    if (!tgt || !(m[2] in tgt)) { console.error('balance-sim: unknown ' + m[1] + '.' + m[2]); process.exit(1); }
    tgt[m[2]] = isNaN(Number(m[3])) ? m[3] : Number(m[3]);
    console.log('(override ' + m[1] + '.' + m[2] + ' = ' + tgt[m[2]] + ')');
  });
})();

// collect engine warnings instead of spamming
var warnings = {};
function collectWarnings() {
  console.warn = function () {
    var msg = Array.prototype.join.call(arguments, ' ');
    warnings[msg] = (warnings[msg] || 0) + 1;
  };
}

// ---------------------------------------------------------------------------
// bots
// ---------------------------------------------------------------------------
function pickOption(card, quality) {
  var opts = card.options || [];
  if (quality === 'first') return opts[0];
  for (var i = 0; i < opts.length; i++) if (opts[i].quality === quality) return opts[i];
  return opts[0];
}

function tapSome(s, n) {
  for (var i = 0; i < n && s.energy.current >= 1; i++) {
    var ch = s.network.available >= 1 ? 'warm' : (s.channels.cold.unlocked ? 'cold' : null);
    if (!ch) break;
    E.tap(s, C, ch, i);
  }
}

// Upgrade priority by level constraint (spec §1): L1 "nobody knows you" → attention skills + lead gear;
// L2 "you make no money" → offer value first, then selling skill; L3 "customers come in unevenly" →
// lead-flow gear + nurture.
var CAT_WEIGHT = {
  1: { skill: 3, megaphone: 3, offer: 2, nurture: 1 },
  2: { offer: 4, skill: 3, nurture: 2, megaphone: 1 },
  3: { megaphone: 4, nurture: 3, skill: 2, offer: 2 },
  // Level 4+: Playbooks and team gear first (the company is the constraint now), then the offer
  4: { systems: 5, team: 5, offer: 4, nurture: 3, skill: 3, megaphone: 2 }
};

// Smart pricing (spec §8): start at the flavor's suggested price, then review once a week and step
// toward the price that earns the most per sales call at the offer's current value (so the price
// rises as value grows): at most +15% up or -10% down per week, never below 60% of suggested.
function bestPriceFor(s) {
  var v = E.offerValueOf(s, C), best = s.offer.price, bestR = -1;
  for (var k = 0; k <= 30; k++) {
    var p = Math.max(10, Math.round(v * (0.15 + k * 0.03) / 10) * 10), r = p * E.closeRateAt(s, C, p);
    if (r > bestR) { bestR = r; best = p; }
  }
  return best;
}
function smartPrice(s) {
  if (s.level < 2) return;
  var fl = E.getFlavor(s, C), sp = fl.suggestedPrice || 500;
  if (!(s.offer.price > 0)) { E.setPrice(s, C, sp); s._botPriceDay = s.day; return; }
  if (s.day - (s._botPriceDay || 0) < 7) return;
  s._botPriceDay = s.day;
  var p = s.offer.price, target = bestPriceFor(s), np = p;
  if (target > p * 1.03) np = Math.min(target, p * 1.15);
  else if (target < p * 0.97) np = Math.max(target, p * 0.9);
  E.setPrice(s, C, Math.max(Math.round(sp * 0.6 / 10) * 10, Math.round(np / 10) * 10));
}

function smartPlan(s) {
  var m = E.computeMetrics(s, C), free = Math.max(1, s.energy.current);
  var eff = E.TUNING.autopilotEff, ce = E.TUNING.callEnergy;
  var expShows = (s.leads + 3) * m.bookRate * (s._leadQ || 1) * m.showRate;
  var salesE = Math.min(free * 0.7, expShows * ce / eff + 5);
  var rest = Math.max(0, free - salesE);
  var content = s.channels.content.unlocked ? rest * 0.25 : 0;
  rest -= content;
  var warm = Math.min(rest, s.network.available / eff);
  var cold = s.channels.cold.unlocked ? rest - warm : 0;
  if (!s.channels.cold.unlocked) warm = rest;
  E.setPlan(s, { warm: warm, cold: cold, content: content, sales: salesE });
}

function smartBuy(s) {
  var reserve = s.livingCost * 15 + (s.channels.ads.dailyBudget || 0) * 7;
  if (s.level >= 4) reserve = lateReserve(s, E.computeMetrics(s, C, true));
  var list = E.availableUpgrades(s, C).filter(function (a) {
    var cc = (a.upgrade.cost && a.upgrade.cost.cash) || 0, ce = (a.upgrade.cost && a.upgrade.cost.energy) || 0;
    return !a.owned && !a.locked && a.affordable && s.cash - cc >= reserve && s.energy.current - ce >= 25;
  });
  var w = CAT_WEIGHT[Math.min(4, s.level)] || CAT_WEIGHT[3];
  list.sort(function (a, b) {
    var wa = w[a.upgrade.category] || 1, wb = w[b.upgrade.category] || 1;
    if (wa !== wb) return wb - wa;
    return ((a.upgrade.cost && a.upgrade.cost.cash) || 0) - ((b.upgrade.cost && b.upgrade.cost.cash) || 0);
  });
  if (list.length) E.buyUpgrade(s, C, list[0].upgrade.id);   // one purchase per day
}

// Smart L3 growth (spec §8): Cash Combos on once unlocked (they only add money per customer), and ads
// run as a small test first; they keep running (and scale) only while LTV:CAC > 1.
function smartAds(s) {
  if (!s.channels.ads.unlocked) return;
  var m = E.computeMetrics(s, C), cap = m.adCap;
  var testBudget = Math.min(cap, 25);
  if (s._botAdStart === undefined) {
    if (s.cash > 1500) { s._botAdStart = s.day; E.setAdBudget(s, C, testBudget); }
    return;
  }
  if (s._botAdStart < 0) {                       // paused after a losing test: retry a month later
    if (s.day + s._botAdStart >= 30 && s.cash > 1500) { s._botAdStart = s.day; E.setAdBudget(s, C, testBudget); }
    return;
  }
  if (s.day - s._botAdStart < 14) return;        // let the test gather data
  if (m.ltvCac > 1 && s.cash > 500) {
    // scale slowly: at most +20% a week, never more than 1/20 of the bank per day
    var cur = s.channels.ads.dailyBudget || testBudget, b = cur;
    if (s.day - (s._botAdScaleDay || 0) >= 7) { b = Math.max(cur, Math.min(cap, cur * 1.2)); s._botAdScaleDay = s.day; }
    E.setAdBudget(s, C, Math.max(0, Math.floor(Math.min(b, s.cash / 20))));
  } else if (m.ltvCac <= 1 && m.cac > 0) {
    E.setAdBudget(s, C, 0); s._botAdStart = -s.day;
  } else if (s.cash <= 500) E.setAdBudget(s, C, 0);
}

// ---------------------------------------------------------------------------
// late game bots (SPEC-LATE §8): Levels 4–10
// ---------------------------------------------------------------------------
var HC_GOAL = { 4: 3, 5: 5, 6: 10, 7: 20, 8: 50, 9: 100, 10: 250 };
function lateM(s) { return E.computeMetrics(s, C, true); }
function roleCost(id, s) { return E.roleDef(C, id, s && s.flavor).hireCost; }
function roleSalary(id, s, m) { return E.roleDef(C, id, s && s.flavor).salary * ((m && m.payLevel) || 1) * ((m && m.salaryCostMult) || 1); }
// cash the bot keeps aside before spending: two weeks of running costs
// daily running costs (payroll, living, ads, agency retainer)
function runCost(s, m) {
  return (m.payrollDaily || 0) + s.livingCost + (s.channels.ads.dailyBudget || 0) + (s.squad.agency.retainer || 0) +
    (m.revenue30 || 0) / 30 * (E.TUNING.opexShare || 0);
}
// cash kept aside before upgrades and growth hires: two weeks of running costs
function lateReserve(s, m) { return runCost(s, m) * 14; }
// the floor for the level's own goal spending (premium, projects, specialists, the Big Bet): one week
function goalFloor(s, m) { return runCost(s, m) * 7; }
function goalOf(s) { return E.getGoal(s, C); }
function founderCallCap(s) {
  var sh = E.TUNING.autopilotEff / E.TUNING.callEnergy, p = s.plan || {}, sum = (p.warm || 0) + (p.cold || 0) + (p.content || 0) + (p.sales || 0);
  return Math.max(0, (s._dayFree || 0) * (sum > 0 ? (p.sales || 0) / sum : 0.4) * sh);
}

// What are today's bottlenecks? (smart) → candidate hires, most urgent first: [{ role, critical, growth }]
function smartHireWants(s, m) {
  var staff = m.staff || 0, out = [];
  // managers before span of control overflows (Level 5+)
  if (s.level >= 5 && staff + 1 > (m.manageCapacity || 4)) out.push({ role: 'manager', critical: true });
  var need = m.deliveryTotal || 0, cap = m.teamDelivery || 0, perCoach = E.roleDef(C, 'coach').capacity;
  var pShow = (m.bookRate || 0.4) * (s._leadQ || 1) * (m.showRate || 0.6);
  var callsCap = (m.teamCalls || 0) + founderCallCap(s), waiting = s.leads * pShow;
  var inflow = ((s._yesterday && s._yesterday.leads) || 0) * pShow;
  // a pile of uncalled leads: a sales rep pays for themself within days
  var backlog = waiting > callsCap * 2 + 2;
  if (backlog) out.push({ role: 'closer', critical: true });
  // delivery: coaches when the founder still carries delivery (then nobody sells) or the team is near its limit
  if (m.founderDeliveryShare > 0.25 || need > cap + perCoach * 0.25)
    out.push({ role: 'coach', critical: m.founderDeliveryShare > 0.3 || !!s._overloaded });
  // sales: reps when shows pile up, setters when leads run short
  if (!backlog && Math.max(waiting * 0.5, inflow) > callsCap * 0.9) out.push({ role: 'closer' });
  var setterActs = (m.teamOutreach || 0), setterOk = setterActs < 3 * E.TUNING.setterSaturation;   // past that, more setters barely add leads
  if (inflow < callsCap * 0.6 && setterOk && (m.team.setter || 0) <= (m.team.closer || 0) * 3) out.push({ role: 'setter' });
  // growing toward the level's headcount goal: more leads feed everything else. At Level 9 the specialist
  // teams fill most of the headcount goal, so generalists are only hired for a real bottleneck.
  // (setters are the cheapest seats: past saturation they still add a few leads, so growth hires lean on them)
  if (!(s.level === 9 && specialistRoom(s)) && m.headcount < (HC_GOAL[s.level] || 0) + 2)
    out.push({ role: (m.team.setter || 0) <= (m.team.coach || 0) * (setterOk ? 0.6 : 1) ? 'setter' : 'coach', growth: true });
  return out;
}
// cash the level's own goal needs next (premium build, specialist teams, the Big Bet) comes before growth hires
function goalSpendWaiting(s) {
  if (s.level === 6 && !s.premium.built && !(s.premium.buildDays > 0)) return true;
  if (s.level === 9 && specialistRoom(s)) return true;
  return false;
}
function smartHire(s, m) {
  var maxHires = Math.max(1, Math.round(m.headcount / 25)), hired = 0;
  for (var i = 0; i < maxHires; i++) {
    var wants = smartHireWants(s, m), done = false;
    for (var k = 0; k < wants.length && !done; k++) {
      var w = wants[k], sal = roleSalary(w.role, s, m), cost = roleCost(w.role, s);
      var rev = (m.revenue30 || 0) / 30, prof = (m.profit30 || 0) / 30;
      // two weeks of costs stay in the bank (5 days for a critical hire), and the business stays profitable
      if (s.cash - cost < (w.critical ? ((m.payrollDaily || 0) + s.livingCost) * 3 : lateReserve(s, m) + sal * 14)) continue;
      if (!w.critical && prof - sal < rev * 0.08) continue;
      if (w.growth && goalSpendWaiting(s) && s.cash < lateReserve(s, m) * 2) continue;   // growth waits; bottlenecks do not
      if (E.hire(s, C, w.role).ok) { done = true; hired++; m = lateM(s); }
      else if (E.hireCap && E.hireCap(s, C).left <= 0) return hired;   // recruiting is full for now
    }
    if (!done) break;
  }
  return hired;
}
// money trouble (in the red, or losing money with a thin bank): let go of the role with the most slack
function smartTrim(s, m) {
  if (s.level < 4 || (m.staff || 0) <= 0) return;
  var trouble = s.cash < 0 || ((m.profit30 || 0) < 0 && s.cash < goalFloor(s, m));
  if (!trouble || s.day - (s._botTrimDay || 0) < (s.cash < 0 ? 1 : 3)) return;
  s._botTrimDay = s.day;
  var t = s.team, perCoach = E.roleDef(C, 'coach').capacity;
  var pShow = Math.min(E.TUNING.bookMax, (m.bookRate || 0.4) * (s._leadQ || 1)) * (m.showRate || 0.6);
  var shows = (((s._yesterday && s._yesterday.leads) || 0) + s.leads * 0.3) * pShow;
  var role = null;
  if (t.coach > 0 && (m.teamDelivery || 0) - (m.deliveryTotal || 0) > perCoach * 1.2) role = 'coach';
  else if (t.closer > 0 && (m.teamCalls || 0) > shows * 1.5 + 6) role = 'closer';
  else if (t.setter > 0 && s.leads * pShow > ((m.teamCalls || 0) + founderCallCap(s)) * 2) role = 'setter';
  else if (t.manager > 0 && (m.manageCapacity || 0) - (m.staff || 0) > 8) role = 'manager';
  if (role) E.fire(s, C, role);
}

function smartPremium(s, m) {
  if (s.level < 6) return;
  var p = s.premium;
  if (!p.built && !(p.buildDays > 0)) {
    var cost = E.premiumCost(s, C);
    if (s.cash - cost >= runCost(s, m) * 3) E.buildPremium(s, C);   // the level's goal and cheap: build it first
    return;
  }
  if (!p.built) return;
  if (!p.on) E.togglePremium(s, C, true);
  // weekly: price the premium where price × take is highest
  if (s.day - (s._botPremDay || 0) < 7) return;
  s._botPremDay = s.day;
  var base = Math.max(50, s.offer.price), best = p.price, bestR = -1, keep = p.price;
  for (var k = 2; k <= 10; k += 0.5) {
    var price = Math.round(base * k / 10) * 10;
    E.setPremiumPrice(s, C, price);
    var r = price * lateM(s).premiumFit;
    if (r > bestR) { bestR = r; best = price; }
  }
  E.setPremiumPrice(s, C, best || keep);
}

function smartSquad(s, m) {
  if (!s.squad.fans.on) E.setSquad(s, C, 'fans', true);
  if (s.level >= 6 && s.squad.partners.count < 4 + 2 * (s.level - 6) && s.energy.current >= 30 &&
      s.cash - 500 >= lateReserve(s, m) && s.day % 3 === 0) E.setSquad(s, C, 'partnersRecruit');
}

function projectsByMetric(metric) { return (C.projects || []).filter(function (p) { return p.metric === metric; }); }
function smartProject(s, m) {
  if (s.level < 7 || s.ops.project) return false;
  // the weakest metric first (full effect + 8 efficiency, and the bonus does not fade on repeats); general
  // projects only when no project fits the weakest metric
  var weak = m.weakestMetric, list = projectsByMetric(weak);
  if (m.efficiency >= 88 && s.cash < lateReserve(s, m) * 2) return false;   // efficient enough: only with spare cash
  list = list.map(function (p) { return { p: p, cost: E.projectCost(s, C, p.id) }; }).sort(function (a, b) { return a.cost - b.cost; });
  if (!list.length) list = projectsByMetric('general').map(function (p) { return { p: p, cost: E.projectCost(s, C, p.id) }; }).sort(function (a, b) { return a.cost - b.cost; });
  // efficiency sliding below 65 eats everyone's output and raises pay: then a project needs only a thin cushion
  var floor = m.efficiency < 65 ? ((m.payrollDaily || 0) + s.livingCost) * 3 : goalFloor(s, m);
  for (var i = 0; i < list.length; i++) if (s.cash - list[i].cost >= floor) { E.startProject(s, C, list[i].p.id); return true; }
  return false;
}

function smartFires(s, m) {
  if (s.level < 8) return;
  var fires = (s.fires || []).slice().sort(function (a, b) { return (b.impact - a.impact) || (a.daysLeft - b.daysLeft); });
  var refillSoon = (m.attentionRefillDays || 7) <= 1;
  for (var i = 0; i < fires.length && s.attention.left >= 1; i++) {
    if (fires[i].impact < 2 && !refillSoon) break;
    E.handleFire(s, C, fires[i].uid);
  }
}

// specialist levels still worth buying at this level (L9: 4 departments to level 2; L10: everything to 3)
function specialistRoom(s) {
  var ids = E.late.DEPT_IDS, deep = ids.filter(function (id) { return s.depts[id].spec >= 2; }).length;
  if (s.level < 10) return deep < 4;
  return ids.some(function (id) { return s.depts[id].spec < 3; });
}
function smartSpecialists(s, m) {
  if (s.level < 9) return;
  var ids = E.late.DEPT_IDS, deep = ids.filter(function (id) { return s.depts[id].spec >= 2; }).length;
  var cand = ids.filter(function (id) { return s.depts[id].spec < (deep < 4 ? 2 : 3); });
  if (s.level < 10 && deep >= 4 && m.headcount >= (HC_GOAL[9] || 100)) return;   // Level 9 done with the teams it needs
  cand.sort(function (a, b) { return s.depts[a].health - s.depts[b].health; });
  for (var i = 0; i < cand.length; i++) {
    var cost = E.late.specCost(s, C, cand[i]);
    if (cost > 0 && s.cash - cost >= goalFloor(s, m)) { E.upgradeDept(s, C, cand[i]); return true; }
  }
}

// the best-prepared bet; one within 10 points of the best odds is fine if the best is out of reach;
// after 3 weeks of waiting, the best one the bank allows
function smartBet(s, m) {
  if (s.level < 10 || s.bet || s.flags.betDone) return false;
  var floor = goalFloor(s, m) * 0.5, all = (C.bets || []).map(function (b) { return { b: b, ch: E.betChance(s, C, b.id).chance }; });
  all.sort(function (a, b) { return (b.ch - a.ch) || (a.b.cost - b.b.cost); });
  if (!all.length) return false;
  if (s._botBetWait === undefined) s._botBetWait = s.day;
  var waited = s.day - s._botBetWait >= 21;
  for (var i = 0; i < all.length; i++) {
    if (!waited && all[i].ch < all[0].ch - 0.1) break;
    if (s.cash - all[i].b.cost >= floor) { E.startBet(s, C, all[i].b.id); return true; }
  }
  return false;
}

function smartSell(s) {
  if (s.level !== 10 || (s.exit && s.exit.sold)) return;
  if (goalOf(s).progress >= 1) E.sellCompany(s, C);
}

// Level 4+ ads: once a week, aim for the budget where one more dollar of ads still brings back about
// two dollars of customer value (bigger budgets cost more per lead), and move toward it gradually
function smartAdsLate(s, m) {
  if (!s.channels.ads.unlocked || !s._clientFinanced) return smartAds(s);
  if (s.day - (s._botAdLateDay || 0) < 7) return;
  s._botAdLateDay = s.day;
  var T = E.TUNING, S = T.adSaturationLate, cpl0 = Math.max(0.5, m.cpl || 30);
  var conv = Math.min(T.bookMax, (m.bookRate || 0.4)) * T.qAds * (m.showRate || 0.6) * (m.closeRate || 0.3);
  var vpl = conv * Math.max(0, m.ltv || 0) * 0.5;          // half the customer value: the rest pays for delivery and sales
  var best = 0, bestP = 0, cap = m.adCap || T.adCapLate;
  for (var b = 25; b <= cap; b *= 1.25) {
    var leads = b / (cpl0 * Math.sqrt(1 + b / S)) * (m.leadVolume || 1), p = leads * vpl - b;
    if (p > bestP) { bestP = p; best = b; }
  }
  var cur = s.channels.ads.dailyBudget || 0, nb = best > cur ? Math.min(best, Math.max(50, cur * 1.5)) : best;
  // never buy leads nobody can call: with a backlog, trim the budget until the sales team catches up
  var pShow = Math.min(T.bookMax, (m.bookRate || 0.4) * (s._leadQ || 1)) * (m.showRate || 0.6);
  var callsCap = (m.teamCalls || 0) + founderCallCap(s);
  if (s.leads * pShow > callsCap * 2) nb = Math.min(nb, cur * 0.7);
  // ...or customers nobody can serve: with delivery overloaded, trim ads until coaches catch up
  if (s._overloaded || (m.founderDeliveryShare || 0) > 0.35) nb = Math.min(nb, cur * 0.7);
  E.setAdBudget(s, C, Math.max(0, Math.floor(Math.min(nb, Math.max(0, s.cash) / 20, cap))));
}

function smartLate(s) {
  if (s.level < 4) return;
  var m = lateM(s);
  smartSquad(s, m);
  smartAdsLate(s, m);
  if (s.level >= 5 && s.focus !== 70) E.setFocus(s, C, 70);
  smartFires(s, m);
  smartTrim(s, m);
  // the level's own goal spending first (one a day): the Big Bet, the premium build, a project, a specialist team
  m = lateM(s);
  if (!smartBet(s, m)) {
    smartPremium(s, m);
    // at Level 10 the bank saves for the Big Bet first (cheapest bet + a week of costs), then projects and teams
    var saving = s.level >= 10 && !s.bet && !s.flags.betDone &&
      s.cash < Math.min.apply(null, (C.bets || [{ cost: 0 }]).map(function (b) { return b.cost; })) + goalFloor(s, m);
    if ((!saving || m.efficiency < 65) && !smartProject(s, m) && !saving) smartSpecialists(s, m);
  }
  smartHire(s, lateM(s));
  smartPremium(s, lateM(s));
  smartSell(s);
}

// naive: hires random roles as soon as it can pay the hiring fee (no reserve, no managers), keeps focus at 0,
// random projects, fires in arrival order, the riskiest bet
function naiveLate(s) {
  if (s.level < 4) return;
  if (E.rand(s) < 0.3) {
    var roles = ['coach', 'closer', 'setter'], r = roles[Math.floor(E.rand(s) * roles.length)];
    if (s.cash > roleCost(r, s)) E.hire(s, C, r);
  }
  if (s.level >= 6) {
    if (!s.premium.built && !(s.premium.buildDays > 0) && s.cash > E.premiumCost(s, C)) E.buildPremium(s, C);
    if (s.premium.built && !s.premium.on) E.togglePremium(s, C, true);
  }
  if (s.level >= 7 && !s.ops.project) {
    var ps = C.projects || [], p = ps[Math.floor(E.rand(s) * ps.length)];
    if (p && s.cash > E.projectCost(s, C, p.id)) E.startProject(s, C, p.id);
  }
  if (s.level >= 8) {
    var fires = (s.fires || []).slice();
    for (var i = 0; i < fires.length && s.attention.left >= 1; i++) E.handleFire(s, C, fires[i].uid);
  }
  if (s.level >= 9 && E.rand(s) < 0.2) {
    var ids = E.late.DEPT_IDS, d = ids[Math.floor(E.rand(s) * ids.length)], c = E.late.specCost(s, C, d);
    if (c > 0 && s.cash > c) E.upgradeDept(s, C, d);
  }
  if (s.level >= 10 && !s.bet && !s.flags.betDone) {
    var worst = null;
    (C.bets || []).forEach(function (b) { var ch = E.betChance(s, C, b.id).chance; if (!worst || ch < worst.ch) worst = { b: b, ch: ch }; });
    if (worst && s.cash > worst.b.cost) E.startBet(s, C, worst.b.id);
  }
  smartSell(s);
}

// ---------------------------------------------------------------------------
// casual: a beginner on a phone who follows what the game shows them, a bit late and a bit noisily.
// Cards 60% best / 30% ok / 10% trap; taps a little; sets the price near the Offer tab's hint and checks
// its verdict every ten days; buys one of the cheapest upgrades every few days (skips it half the time
// when the "Sure?" runway warning shows); follows the owl's ad advice once a week and the Team card's
// "next hire" every other day (ignores "Sure?" half the time); taps through the crunch plan whenever the
// crunch screen opens; does what the level asks (focus to the goal, Product Lab, projects, fires on half the
// days, specialist teams, the first bet it can afford); sells when the Summit button turns green.
// Its own random stream (s._botR) keeps the engine's RNG untouched.
// ---------------------------------------------------------------------------
function crand(s) {
  var a = (s._botR = (s._botR | 0) + 0x6D2B79F5 | 0), t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function casualQuality(s) { var r = crand(s); return r < 0.6 ? 'best' : r < 0.9 ? 'ok' : 'trap'; }
function casT(s) { return s._botCas || (s._botCas = { crunch: 0, crunchOk: 0, sure: 0, hires: 0, lvStart: {}, adDay: 0, priceDay: 0, crunchDay: -99 }); }
// the "Sure?" button: when a purchase leaves under 21 days of costs, a beginner backs off half the time
function casSure(s, cost, extraDaily, m) {
  if (s.level < 4) return true;
  var left = E.runwayAfter(s, C, cost, extraDaily || 0, m);
  if (left === null || left >= 21) return true;
  casT(s).sure++;
  return crand(s) < 0.5;
}
function casualPrice(s, T, adv) {
  if (s.level < 2 || !adv.price) return;
  var pa = adv.price, p = s.offer.price;
  if (!(p > 0)) { E.setPrice(s, C, Math.round(pa.hint * (0.9 + 0.1 * crand(s)) / 10) * 10); T.priceDay = s.day; return; }
  if (s.day - T.priceDay < 10) return;
  T.priceDay = s.day;
  if (pa.verdict === 'raise') E.setPrice(s, C, Math.round(Math.min(pa.hint, Math.max(p * 1.1, p + (pa.hint - p) * 0.5)) / 10) * 10);
  else if (pa.verdict === 'lower') E.setPrice(s, C, Math.round(p * 0.9 / 10) * 10);
}
function casualAds(s, T, adv) {
  var a = adv.ads;
  if (!a || s.day - T.adDay < 7) return;
  T.adDay = s.day;
  var b = s.channels.ads.dailyBudget || 0;
  if (a.step === 'start' && s.cash > 1500 && s.day >= (T.adRetry || 0)) E.setAdBudget(s, C, 20);
  else if (a.step === 'up') E.setAdBudget(s, C, a.to);
  else if (a.step === 'down') E.setAdBudget(s, C, a.to !== undefined ? a.to : Math.floor(b * 0.7));
  else if (a.step === 'off') { E.setAdBudget(s, C, 0); T.adRetry = s.day + 30; }
}
function casualLate(s, T, m, adv) {
  var lvl = s.level, since = s.day - (T.lvStart[lvl] || s.day);
  // the crunch screen opens when cash drops below $0 while losing money, and again every 4 days while it lasts
  if (s.cash < 0 && (m.burnDaily || 0) > 0 && s.day - T.crunchDay >= 4) {
    T.crunchDay = s.day; T.crunch++;
    var r = E.cutToBreakEven(s, C);
    if (r && r.ok) T.crunchOk++;
    m = lateM(s); adv = E.advice(s, C, m);
  }
  if (!s.squad.fans.on && since >= 3) E.setSquad(s, C, 'fans', true);
  if (lvl >= 5 && s.focus < 60 && since >= 2) E.setFocus(s, C, 60);   // the hint and the slider tick say 60
  if (lvl >= 6) {
    var pc = E.premiumCost(s, C);
    if (!s.premium.built && !(s.premium.buildDays > 0) && s.cash >= pc && casSure(s, pc, 0, m)) E.buildPremium(s, C);
    if (s.premium.built && !s.premium.on) E.togglePremium(s, C, true);
    if (s.squad.partners.count === 0 && m.headcount >= 12 && s.cash > 2000 && s.energy.current >= 10) E.setSquad(s, C, 'partnersRecruit');
  }
  if (lvl >= 7 && !s.ops.project && s.day % 3 === 0 && (!adv.save || (m.efficiency || 100) < 65)) {
    var ps = projectsByMetric(m.weakestMetric);
    if (!ps.length) ps = projectsByMetric('general');
    ps = ps.map(function (p) { return { p: p, c: E.projectCost(s, C, p.id) }; }).sort(function (a, b) { return a.c - b.c; });
    if (ps.length && s.cash >= ps[0].c && casSure(s, ps[0].c, 0, m)) E.startProject(s, C, ps[0].p.id);
  }
  if (lvl >= 8 && (s.fires || []).length && crand(s) < 0.5) {
    var fs = s.fires.slice().sort(function (a, b) { return b.impact - a.impact; });
    for (var i = 0; i < fs.length && s.attention.left >= 1; i++) E.handleFire(s, C, fs[i].uid);
  }
  if (lvl >= 9 && s.day % 3 === 0 && !adv.save) {
    var ids = E.late.DEPT_IDS.filter(function (id) { return s.depts[id].spec < 3; }).sort(function (a, b) { return s.depts[a].health - s.depts[b].health; });
    for (var k = 0; k < ids.length; k++) { var c = E.late.specCost(s, C, ids[k]); if (c > 0 && s.cash >= c) { if (casSure(s, c, 0, m)) E.upgradeDept(s, C, ids[k]); break; } }
  }
  // the Big Bet: the best odds the bank allows (the card shows each bet's chance and cost)
  if (lvl >= 10 && !s.bet && !s.flags.betDone && s.day % 3 === 0) {
    var keep = E.late.betKeep ? E.late.betKeep(s, C) : 0;
    var bets = (C.bets || []).filter(function (b) { return s.cash - b.cost >= keep; })
      .map(function (b) { return { b: b, ch: E.betChance(s, C, b.id).chance }; }).sort(function (a, b) { return (b.ch - a.ch) || (a.b.cost - b.b.cost); });
    if (bets.length && casSure(s, bets[0].b.cost, 0, m)) E.startBet(s, C, bets[0].b.id);
  }
  // hiring: the Team card's "next hire", checked every other day; "+5" from Level 8 while the headcount goal is open
  if (s.day % 2 === 0 && adv.hire && adv.hire.role) {
    var batch = lvl >= 8 && (m.hiresLeft || 0) >= 5 ? 5 : 1;
    for (var h = 0; h < batch; h++) {
      var role = adv.hire.role, cost = roleCost(role, s);
      if (!role || s.cash < cost || !(E.hireCap(s, C).left > 0)) break;
      if (h === 0 && !casSure(s, cost * batch, (m.hireDaily && m.hireDaily[role] || roleSalary(role, s, m)) * batch, m)) break;
      if (!E.hire(s, C, role).ok) break;
      T.hires++;
      m = lateM(s); adv = E.advice(s, C, m);
      if (!adv.hire || !adv.hire.role) break;
    }
  }
  if (lvl === 10 && goalOf(s).progress >= 1) E.sellCompany(s, C);
}
function casualAct(s) {
  var T = casT(s), lvl = s.level;
  if (T.lvStart[lvl] === undefined) T.lvStart[lvl] = s.day;
  tapSome(s, lvl <= 2 ? 10 : lvl === 3 ? 6 : 3);
  if (lvl >= 2 && lvl <= 3 && s.burnout < 20 && crand(s) < 0.1) E.overtime(s, C);
  var m = lateM(s), adv = E.advice(s, C, m);
  casualPrice(s, T, adv);
  // Autopilot plan: the default, then what the coach lines suggest (cold slice, content slice, bigger sales slice)
  var p = { warm: 60, cold: 0, content: 0, sales: 40 };
  if (s.channels.cold.unlocked && (lvl > 2 || s.stats.salesCount >= 1 || s.network.available < 20)) p = { warm: 30, cold: 30, content: 0, sales: 40 };
  if (s.channels.content.unlocked && lvl >= 3) p = { warm: 20, cold: 25, content: 15, sales: 40 };
  if (s.leads >= 20) p.sales = 55;
  E.setPlan(s, p);
  if (s.day % 3 === 0 && !adv.save) {
    var list = E.availableUpgrades(s, C).filter(function (a) {
      var cc = (a.upgrade.cost && a.upgrade.cost.cash) || 0, ce = (a.upgrade.cost && a.upgrade.cost.energy) || 0;
      return !a.owned && !a.locked && a.affordable && cc <= Math.max(0, s.cash) * 0.5 && s.energy.current - ce >= 10;
    }).sort(function (a, b) { return ((a.upgrade.cost && a.upgrade.cost.cash) || 0) - ((b.upgrade.cost && b.upgrade.cost.cash) || 0); });
    if (list.length) {
      var u = list[Math.floor(crand(s) * Math.min(3, list.length))].upgrade;
      if (casSure(s, (u.cost && u.cost.cash) || 0, 0, m)) E.buyUpgrade(s, C, u.id);
    }
  }
  if (lvl >= 3) {
    if (s.combos.upsell.unlocked && !s.combos.upsell.on && m.revenue30 >= 3000) E.toggleCombo(s, C, 'upsell', true);
    if (s.combos.membership.unlocked && !s.combos.membership.on && s.customers.total >= 20) E.toggleCombo(s, C, 'membership', true);
    if (s.combos.hook.unlocked && !s.combos.hook.on && s.channels.ads.dailyBudget > 0) E.toggleCombo(s, C, 'hook', true);
    casualAds(s, T, adv);
  }
  if (lvl >= 4) casualLate(s, T, lateM(s), E.advice(s, C));
}

var BOTS = {
  smart: {
    quality: 'best',
    act: function (s) {
      smartBuy(s);
      smartPrice(s);
      if (s.level >= 3) {
        ['hook', 'upsell', 'downsell', 'membership'].forEach(function (id) { if (s.combos[id].unlocked && !s.combos[id].on) E.toggleCombo(s, C, id, true); });
        if (s.level < 4) smartAds(s);
      }
      if (s.level >= 2 && s.burnout <= 20 && s.energy.current < 70) E.overtime(s, C);
      smartLate(s);
      tapSome(s, 20);
      smartPlan(s);
    }
  },
  // naive: discounts (30% under the suggested price, never raised), never improves the offer on purpose, buys random
  // upgrades, picks 'trap' card options, and runs ads at the cap whenever there is cash.
  naive: {
    quality: 'trap',
    act: function (s) {
      if (s.level >= 2 && !s._naivePriced) {
        var fl = E.getFlavor(s, C);
        E.setPrice(s, C, Math.round((fl.suggestedPrice || 500) * 0.7));   // "knock 30% off" and never raise it
        s._naivePriced = true;
      }
      if (s.level >= 3 && s.channels.ads.unlocked) E.setAdBudget(s, C, s.cash > 0 ? 50 : 0);
      if (E.rand(s) < 0.5) {
        var list = E.availableUpgrades(s, C).filter(function (a) { return !a.owned && !a.locked && a.affordable; });
        if (list.length) E.buyUpgrade(s, C, list[Math.floor(E.rand(s) * list.length)].upgrade.id);
      }
      naiveLate(s);
      tapSome(s, 20);
      smartPlan(s);   // Autopilot plan is basic upkeep; naive differs in price, cards, upgrades and ads
    }
  },
  // naiveLate: plays Levels 1–3 like the smart bot, then makes the naive company decisions from Level 4 (random
  // hires, no managers, focus 0, trap cards, random projects, fires in arrival order, the riskiest bet), so the
  // late-game lessons are tested on their own
  naiveLate: {
    quality: 'best', qualityAt: function (s) { return s.level >= 4 ? 'trap' : 'best'; },
    act: function (s) {
      if (s.level < 4) return BOTS.smart.act(s);
      if (E.rand(s) < 0.5) {
        var list = E.availableUpgrades(s, C).filter(function (a) { return !a.owned && !a.locked && a.affordable; });
        if (list.length) E.buyUpgrade(s, C, list[Math.floor(E.rand(s) * list.length)].upgrade.id);
      }
      smartPrice(s);
      smartAdsLate(s, lateM(s));
      if (s.burnout <= 20 && s.energy.current < 70) E.overtime(s, C);
      naiveLate(s);
      tapSome(s, 20);
      smartPlan(s);
    }
  },
  // casual: a beginner who follows the game's hints (see casualAct); runs up to 900 days
  casual: { quality: 'best', qualityAt: casualQuality, act: casualAct, days: 900 },
  // mixed: the smart bot's decisions, but card answers 60% best / 30% ok / 10% trap (the late economy must not
  // need near-perfect card play)
  mixed: { quality: 'best', qualityAt: casualQuality, act: function (s) { BOTS.smart.act(s); } },
  idle: { quality: 'first', act: function () {} }
};

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
var GHOST = [];
// snapshot of the economics when a level is completed (or at the sale)
function snapOf(s) {
  var m = E.computeMetrics(s, C, true);
  return { day: s.day, headcount: m.headcount || 1, r30: Math.round(m.revenue30 || 0), margin: m.profitMargin30 || 0,
    payShare: m.revenue30 > 0 ? (m.payroll30 || 0) / m.revenue30 : 0, rpe: m.revenuePerEmployee || 0, cash: Math.round(s.cash),
    valuation: m.valuation || 0, prem: m.premiumShare30 || 0, price: s.offer.price };
}
// hooks (optional): onCard(state, card) runs before the bot answers a card (return true to stop the run);
// onDay(state, tickResult) runs after every tick; maxLevel stops the run once the state passes that level;
// maxDays overrides --days.
function runOne(flavor, botName, seed, ghostLog, hooks) {
  hooks = hooks || {};
  var bot = BOTS[botName];
  var maxDays = hooks.maxDays || MAX_DAYS, maxLevel = hooks.maxLevel || (EARLY_ONLY ? 3 : 99);
  var s = E.createState(C, { seed: seed, flavor: flavor });
  var r = { l2: null, l3: null, grad: null, over: null, cashGrad: null, cards: [], finalCash: 0, finalLevel: 1, revenue: 0,
    lv: {}, snap: {}, acc: {}, sold: null, valuation: null, minCash: Infinity, overLevel: null };
  var guard = 0;
  function early() {   // the end state of the v0.1 run (stopped at Level 4, day 200 or game over)
    if (r.early) return;
    var em = E.computeMetrics(s, C, true);
    r.early = { finalCash: Math.round(s.cash), finalLevel: s.level, revenue: Math.round(s.stats.revenueTotal), price: s.offer.price,
      sales: s.stats.salesCount, upgrades: s.upgrades.length, close: em.closeRate, r30: Math.round(em.revenue30), cards: r.cards.slice() };
  }
  while (s.day <= maxDays && !s.gameOver && !(s.exit && s.exit.sold)) {
    if (s.day > EARLY_DAYS) early();
    var card = E.getPendingCard(s, C);
    if (s.pendingCard && !card) s.pendingCard = null;   // dangling id: drop it
    if (card) {
      if (hooks.onCard && hooks.onCard(s, card)) { r.stopped = true; break; }
      if (ghostLog && botName === 'smart' && (card.level || 1) <= 3 && s.level <= 3) {
        var g = E.ghostCompare(s, C, card.id), bestId = null, bestCash = -Infinity, bestOpt = pickOption(card, 'best');
        Object.keys(g).forEach(function (k) { var last = g[k][g[k].length - 1]; if (last && last.cash > bestCash) { bestCash = last.cash; bestId = k; } });
        ghostLog.push({ flavor: flavor, card: card.id, day: s.day, ok: !!bestOpt && bestId === bestOpt.id, winner: bestId, best: bestOpt && bestOpt.id,
          finals: Object.keys(g).map(function (k) { return k + ' $' + g[k][g[k].length - 1].cash; }).join(', ') });
      }
      var opt = pickOption(card, bot.qualityAt ? bot.qualityAt(s) : bot.quality);
      if (opt) { E.chooseCardOption(s, C, opt.id); r.cards.push(card.id + ':' + (opt.quality || '?')); }
      else s.pendingCard = null;
    }
    bot.act(s);
    if (s.exit && s.exit.sold) { r.sold = s.day; r.valuation = s.exit.valuation; r.snap.sale = snapOf(s); r.snap.sale.valuation = s.exit.valuation; break; }
    var dayBefore = s.day, lvBefore = s.level;
    var res = E.tick(s, C);
    if (hooks.onDay) hooks.onDay(s, res);
    if (s.level >= 4 && s.cash < r.minCash) r.minCash = s.cash;
    if (lvBefore >= 4) {   // economics over the whole level (a level-up snapshot catches the hiring burst mid-way)
      var dd = s.stats.daily[s.stats.daily.length - 1] || {}, ac = r.acc[lvBefore] || (r.acc[lvBefore] = { days: 0, revenue: 0, payroll: 0, profit: 0, ads: 0, opex: 0, heads: 0 });
      ac.days++; ac.revenue += dd.revenue || 0; ac.payroll += dd.payroll || 0; ac.profit += dd.profit || 0; ac.ads += (dd.adSpend || 0) + (dd.squadSpend || 0);
      ac.opex += dd.opex || 0; ac.heads += dd.headcount || 1;
    }
    if (s.level !== lvBefore) {
      if (s.level >= 2 && r.l2 === null) r.l2 = dayBefore;
      if (s.level >= 3 && r.l3 === null) r.l3 = dayBefore;
      if (s.level >= 4 && r.grad === null) { r.grad = dayBefore; r.cashGrad = Math.round(s.cash); }
      if (s.level >= 4 && r.lv[s.level] === undefined) { r.lv[s.level] = dayBefore; r.snap[lvBefore] = snapOf(s); }
    }
    if (res.events.some(function (e) { return e.type === 'graduated'; }) && r.grad === null) { r.grad = dayBefore; r.cashGrad = Math.round(s.cash); }
    if (r.grad !== null || s.gameOver) early();
    if (s.level > maxLevel || (s.graduated && r.grad !== null)) break;
    if (++guard > maxDays + 5) break;
  }
  early();
  if (s.gameOver) { r.over = s.gameOver.day; r.overLevel = s.level; }
  r.finalCash = Math.round(s.cash); r.finalLevel = s.level; r.revenue = Math.round(s.stats.revenueTotal);
  r.price = s.offer.price; r.sales = s.stats.salesCount; r.upgrades = s.upgrades.length;
  var m = E.computeMetrics(s, C); r.close = m.closeRate; r.r30 = Math.round(m.revenue30);
  r.end = snapOf(s);
  r.state = s;
  return r;
}

function stat(vals) {
  var v = vals.filter(function (x) { return x !== null; });
  if (!v.length) return { n: 0, avg: null, min: null, max: null };
  var sum = v.reduce(function (a, b) { return a + b; }, 0);
  return { n: v.length, avg: sum / v.length, min: Math.min.apply(null, v), max: Math.max.apply(null, v) };
}
function cell(st, total) {
  if (!st.n) return pad('—', 18);
  return pad(Math.round(st.avg) + ' (' + st.min + '-' + st.max + ') ' + st.n + '/' + total, 18);
}
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

function main() {
collectWarnings();
var flavors = (C.flavors || []).map(function (f) { return f.id; }).filter(function (id) { return !ONLY_FLAVOR || id === ONLY_FLAVOR; });
var bots = Object.keys(BOTS).filter(function (b) { return !ONLY_BOT || b === ONLY_BOT; });
if (!flavors.length) { console.error('balance-sim: no flavors found in content.'); process.exit(1); }

// v0.1 pacing: L1 ~2 min, L2 ~3–4 min, L3 ~2–4 min at 1× (6 s per day)
var TARGET = { l2: [8, 18], l3: [28, 55], grad: [45, 100] };
// SPEC-LATE §1 pacing for the smart bot: each of L4–L9 30–60 days, L10 40–80, the sale ≈ day 300–450
var LATE_TARGET = { lvl: [30, 60], l10: [40, 80], sale: [300, 450] };
var EARLY_DAYS_CAP = EARLY_DAYS;
function earlyVal(v) { return v !== null && v <= EARLY_DAYS_CAP ? v : null; }
console.log('Zero to Exit balance sim — ' + SEEDS + ' seeds × ' + MAX_DAYS + ' days max' + (EARLY_ONLY ? ' (early levels only)' : ''));
console.log('\n=== Levels 1–3 (first ' + EARLY_DAYS + ' days) ===');
console.log('Targets (smart): L1 done day ' + TARGET.l2.join('–') + ', L2 done day ' + TARGET.l3.join('–') + ', L3 done day ' + TARGET.grad.join('–'));
console.log('Cells: avg day (min-max) reached/runs\n');
console.log(pad('flavor', 9) + pad('bot', 7) + pad('L1 done', 18) + pad('L2 done', 18) + pad('L3 done', 18) + pad('broke', 7) + pad('cash@grad', 11) + 'end state (avg)');

var verdict = [], results = {};
flavors.forEach(function (fl) {
  results[fl] = {};
  bots.forEach(function (b) {
    var runs = [];
    for (var i = 0; i < SEEDS; i++) runs.push(runOne(fl, b, 1000 + i * 7919, i === 0 && (b === 'smart' || b === 'naive' || b === 'idle') ? GHOST : null,
      BOTS[b].days ? { maxDays: Math.max(MAX_DAYS, BOTS[b].days) } : null));
    results[fl][b] = runs;
    if (b === 'naiveLate') return;   // same as smart in Levels 1–3: shown in the late-game table only
    var l2 = stat(runs.map(function (r) { return earlyVal(r.l2); })), l3 = stat(runs.map(function (r) { return earlyVal(r.l3); }));
    var gr = stat(runs.map(function (r) { return earlyVal(r.grad); })), cg = stat(runs.map(function (r) { return earlyVal(r.grad) !== null ? r.cashGrad : null; }));
    var broke = runs.filter(function (r) { var g = earlyVal(r.grad); return r.over !== null && r.over <= EARLY_DAYS_CAP && !(g !== null && g < r.over); }).length;
    var avg = function (k) { return Math.round(runs.reduce(function (a, r) { return a + (r.early[k] || 0); }, 0) / runs.length); };
    var endState = 'L' + (runs.reduce(function (a, r) { return a + r.early.finalLevel; }, 0) / runs.length).toFixed(1) +
      ' $' + avg('finalCash') + ' rev $' + avg('revenue') + ' price $' + avg('price') + ' sales ' + avg('sales') + ' upg ' + avg('upgrades');
    console.log(pad(fl, 9) + pad(b, 7) + cell(l2, SEEDS) + cell(l3, SEEDS) + cell(gr, SEEDS) + pad(broke + '/' + SEEDS, 7) +
      pad(cg.n ? '$' + Math.round(cg.avg) : '—', 11) + endState);
    if (VERBOSE) runs.forEach(function (r, i) {
      console.log('    seed' + i + ' l2=' + earlyVal(r.l2) + ' l3=' + earlyVal(r.l3) + ' grad=' + earlyVal(r.grad) + ' over=' + (r.over !== null && r.over <= EARLY_DAYS_CAP ? r.over : null) +
        ' cash=' + r.early.finalCash + ' r30=' + r.early.r30 + ' close=' + (r.early.close * 100).toFixed(0) + '% cards=' + r.early.cards.join(','));
    });
    function inRange(st, rg) { return st.n === SEEDS && st.avg >= rg[0] && st.avg <= rg[1]; }
    if (b === 'smart') {
      verdict.push((inRange(l2, TARGET.l2) ? 'OK  ' : 'MISS') + ' ' + fl + ' smart L1 avg ' + (l2.avg === null ? 'never' : Math.round(l2.avg)) + ' (target ' + TARGET.l2.join('–') + ')');
      verdict.push((inRange(l3, TARGET.l3) ? 'OK  ' : 'MISS') + ' ' + fl + ' smart L2 avg ' + (l3.avg === null ? 'never' : Math.round(l3.avg)) + ' (target ' + TARGET.l3.join('–') + ')');
      verdict.push((inRange(gr, TARGET.grad) ? 'OK  ' : 'MISS') + ' ' + fl + ' smart L3 avg ' + (gr.avg === null ? 'never' : Math.round(gr.avg)) + ' (target ' + TARGET.grad.join('–') + ')');
      if (broke) verdict.push('MISS ' + fl + ' smart went broke ' + broke + '/' + SEEDS);
    }
  });
  var sm = results[fl].smart, nv = results[fl].naive, id = results[fl].idle;
  if (sm && nv) {
    var sg = stat(sm.map(function (r) { return earlyVal(r.grad); })), ng = stat(nv.map(function (r) { return earlyVal(r.grad); }));
    var slower = ng.n < sg.n || (ng.n && sg.n && ng.avg > sg.avg * 1.15);
    verdict.push((slower ? 'OK  ' : 'MISS') + ' ' + fl + ' naive clearly slower than smart (smart ' + (sg.n ? Math.round(sg.avg) : 'never') + ', naive ' + (ng.n ? Math.round(ng.avg) + ' ' + ng.n + '/' + SEEDS : 'never') + ')');
  }
  if (id) {
    var stalled = id.every(function (r) { return earlyVal(r.l3) === null; });
    verdict.push((stalled ? 'OK  ' : 'MISS') + ' ' + fl + ' idle stalls before L3 (reached L3: ' + id.filter(function (r) { return earlyVal(r.l3) !== null; }).length + '/' + SEEDS + ')');
  }
});

if (GHOST.length) {
  var bad = GHOST.filter(function (g) { return !g.ok; });
  console.log('\nGhost timeline check (smart bot, seed 0, Level 1–3 cards; late cards: tools/card-check.js): the "best" option should end with the most cash.');
  console.log('  ' + (GHOST.length - bad.length) + '/' + GHOST.length + ' cards OK');
  bad.forEach(function (g) { console.log('  WARN ' + g.flavor + ' day ' + g.day + ' ' + g.card + ': best=' + g.best + ' but ' + g.winner + ' wins (' + g.finals + ')'); });
}

var lateVerdict = [];
if (!EARLY_ONLY) {
  console.log('\n=== Levels 4–10 and the sale (up to day ' + MAX_DAYS + ') ===');
  console.log('Targets (smart): each of L4–L9 ' + LATE_TARGET.lvl.join('–') + ' days, L10 ' + LATE_TARGET.l10.join('–') + ' days, sale day ' + LATE_TARGET.sale.join('–') +
    ', never broke; naive stalls or goes broke in L4–L7; idle stalls.');
  console.log('Level cells: avg days spent in the level (min-max) completed/runs. "stuck" = level where unfinished runs ended (b = broke).\n');
  console.log(pad('flavor', 9) + pad('bot', 10) + [4, 5, 6, 7, 8, 9, 10].map(function (l) { return pad('L' + l, 14); }).join('') + pad('sale day', 16) + pad('broke', 7) + 'stuck');
  flavors.forEach(function (fl) {
    bots.forEach(function (b) {
      var runs = results[fl][b], cells = [], durs = {};
      [4, 5, 6, 7, 8, 9, 10].forEach(function (l) {
        var d = runs.map(function (r) {
          var start = l === 4 ? r.grad : r.lv[l], end = l === 10 ? r.sold : r.lv[l + 1];
          return start !== null && start !== undefined && end !== null && end !== undefined ? end - start : null;
        });
        durs[l] = stat(d);
        var st = durs[l];
        cells.push(pad(st.n ? Math.round(st.avg) + ' (' + st.min + '-' + st.max + ') ' + st.n + '/' + SEEDS : '—', 14));
      });
      var sale = stat(runs.map(function (r) { return r.sold; }));
      var broke = runs.filter(function (r) { return r.over !== null && r.overLevel >= 4; });
      var stuck = runs.filter(function (r) { return r.sold === null; }).map(function (r) { return 'L' + r.finalLevel + (r.over !== null ? 'b' : ''); });
      console.log(pad(fl, 9) + pad(b, 10) + cells.join('') + pad(sale.n ? Math.round(sale.avg) + ' (' + sale.min + '-' + sale.max + ') ' + sale.n + '/' + SEEDS : '—', 16) +
        pad(broke.length + '/' + SEEDS, 7) + stuck.join(','));
      if (b === 'smart') {
        var lvOk = [4, 5, 6, 7, 8, 9].every(function (l) { return durs[l].n === SEEDS && durs[l].avg >= LATE_TARGET.lvl[0] && durs[l].avg <= LATE_TARGET.lvl[1]; });
        var off = [4, 5, 6, 7, 8, 9].filter(function (l) { return !(durs[l].n === SEEDS && durs[l].avg >= LATE_TARGET.lvl[0] && durs[l].avg <= LATE_TARGET.lvl[1]); })
          .map(function (l) { return 'L' + l + ' ' + (durs[l].n ? Math.round(durs[l].avg) + 'd' : 'never') + (durs[l].n < SEEDS ? ' ' + durs[l].n + '/' + SEEDS : ''); });
        lateVerdict.push((lvOk ? 'OK  ' : 'MISS') + ' ' + fl + ' smart L4–L9 each ' + LATE_TARGET.lvl.join('–') + ' days' + (off.length ? ' (off: ' + off.join(', ') + ')' : ''));
        var l10 = durs[10];
        lateVerdict.push((l10.n === SEEDS && l10.avg >= LATE_TARGET.l10[0] && l10.avg <= LATE_TARGET.l10[1] ? 'OK  ' : 'MISS') + ' ' + fl + ' smart L10 avg ' + (l10.n ? Math.round(l10.avg) + ' ' + l10.n + '/' + SEEDS : 'never') + ' (target ' + LATE_TARGET.l10.join('–') + ')');
        lateVerdict.push((sale.n === SEEDS && sale.avg >= LATE_TARGET.sale[0] && sale.avg <= LATE_TARGET.sale[1] ? 'OK  ' : 'MISS') + ' ' + fl + ' smart sale day avg ' + (sale.n ? Math.round(sale.avg) + ' ' + sale.n + '/' + SEEDS : 'never') + ' (target ' + LATE_TARGET.sale.join('–') + ')');
        if (broke.length) lateVerdict.push('MISS ' + fl + ' smart went broke in the late game ' + broke.length + '/' + SEEDS);
      }
      if (b === 'naive' || b === 'naiveLate') {
        var bad = runs.filter(function (r) { return r.grad !== null && (r.over !== null || (r.finalLevel >= 4 && r.finalLevel <= 7 && r.sold === null)); }).length;
        var reached = runs.filter(function (r) { return r.grad !== null; }).length;
        var sOk = !reached || bad >= Math.ceil(reached * 0.6);
        lateVerdict.push((sOk ? 'OK  ' : 'MISS') + ' ' + fl + ' ' + b + ' stalls or goes broke in L4–L7 (' + bad + '/' + reached + ' of the runs that reached L4' +
          (b === 'naive' && !reached ? '; the naive bot never gets past Level 3' : '') + ')');
      }
      if (b === 'idle') {
        var moved = runs.filter(function (r) { return r.lv[5] !== undefined; }).length;
        lateVerdict.push((moved === 0 ? 'OK  ' : 'MISS') + ' ' + fl + ' idle stalls (passed L4: ' + moved + '/' + SEEDS + ')');
      }
    });
  });

  // beginner checks (casual, mixed): pooled over every flavor and seed
  ['casual', 'mixed'].forEach(function (b) {
    var all = [];
    flavors.forEach(function (fl) { if (results[fl][b]) all = all.concat(results[fl][b]); });
    if (!all.length) return;
    var sold = all.filter(function (r) { return r.sold !== null; }), broke = all.filter(function (r) { return r.over !== null; });
    var sd = stat(sold.map(function (r) { return r.sold; }));
    if (b === 'casual') {
      var T = all.map(function (r) { return r.state._botCas || {}; }), sum = function (k) { return T.reduce(function (a, t) { return a + (t[k] || 0); }, 0); };
      console.log('\n  casual: sold ' + sold.length + '/' + all.length + ', broke ' + broke.length + ' (' + broke.map(function (r) { return r.state.flavor + ' L' + r.overLevel + '@' + r.over; }).join(', ') + ')' +
        ', crunch screens ' + sum('crunch') + ' (cuts made ' + sum('crunchOk') + '), "Sure?" warnings ' + sum('sure') + ', hires ' + sum('hires'));
      lateVerdict.push((sold.length >= Math.ceil(all.length * 0.8) ? 'OK  ' : 'MISS') + ' casual sells in at least 80% of runs (' + sold.length + '/' + all.length + ')');
      lateVerdict.push((broke.length <= Math.floor(all.length * 0.1) ? 'OK  ' : 'MISS') + ' casual goes broke in at most 10% of runs (' + broke.length + '/' + all.length + ')');
      lateVerdict.push((sd.n && sd.avg >= 400 && sd.avg <= 650 ? 'OK  ' : 'MISS') + ' casual sale day avg ' + (sd.n ? Math.round(sd.avg) + ' (' + sd.min + '-' + sd.max + ')' : 'never') + ' (target 400–650)');
    } else {
      lateVerdict.push((sold.length >= Math.ceil(all.length * 0.7) ? 'OK  ' : 'MISS') + ' mixed (smart play, 60/30/10 cards) sells in at least 70% of runs (' + sold.length + '/' + all.length + ', sale day avg ' + (sd.n ? Math.round(sd.avg) : '—') + ')');
    }
  });

  // economics over each level and at the sale (smart bot): plausibility bands. Level rows add up every day spent in
  // the level (a level-up snapshot would catch a hiring burst half-way); the sale row is the last 30 days.
  console.log('\nSmart bot economics (avg over runs): each level = all days spent in it; sale = the 30 days before the sale.');
  console.log(pad('flavor', 9) + pad('level', 7) + pad('days', 6) + pad('headcount', 11) + pad('sales/day', 12) + pad('margin', 8) + pad('payroll', 9) + pad('running', 9) + pad('ads+squad', 11) + pad('rev/person/yr', 15) + 'valuation');
  flavors.forEach(function (fl) {
    var runs = results[fl].smart; if (!runs) return;
    [4, 5, 6, 7, 8, 9, 10, 'sale'].forEach(function (l) {
      var rows = runs.map(function (r) {
        if (l === 'sale') { var q = r.snap.sale; return q ? { days: 30, heads: q.headcount * 30, revenue: q.r30, payroll: q.payShare * q.r30, profit: q.margin * q.r30, ads: null, opex: null, valuation: q.valuation } : null; }
        return r.acc[l] && r.acc[l].revenue > 0 ? r.acc[l] : null;
      }).filter(Boolean);
      if (!rows.length) return;
      var sum = function (k) { return rows.reduce(function (x, q) { return x + (q[k] || 0); }, 0); };
      var rev = sum('revenue'), days = sum('days'), margin = sum('profit') / rev, pay = sum('payroll') / rev, rpe = rev / sum('heads') * 365;
      var opexS = l === 'sale' ? null : sum('opex') / rev, adsS = l === 'sale' ? null : sum('ads') / rev;
      console.log(pad(fl, 9) + pad(l === 'sale' ? 'sale' : 'L' + l, 7) + pad(Math.round(days / rows.length), 6) + pad(Math.round(sum('heads') / days), 11) +
        pad('$' + Math.round(rev / days).toLocaleString('en-US'), 12) + pad((margin * 100).toFixed(0) + '%', 8) + pad((pay * 100).toFixed(0) + '%', 9) +
        pad(opexS === null ? '' : (opexS * 100).toFixed(0) + '%', 9) + pad(adsS === null ? '' : (adsS * 100).toFixed(0) + '%', 11) + pad('$' + Math.round(rpe / 1000) + 'k', 15) +
        (l === 'sale' ? '$' + (sum('valuation') / rows.length / 1e6).toFixed(1) + 'M' : ''));
      if (l === 'sale' || l >= 8) {
        var okE = rpe >= 80000 && rpe <= 250000 && pay >= 0.30 && pay <= 0.55 && margin >= 0.10 && margin <= 0.30;
        var near = rpe >= 70000 && rpe <= 275000 && pay >= 0.27 && pay <= 0.58 && margin >= 0.08 && margin <= 0.35;
        lateVerdict.push((okE ? 'OK  ' : near ? 'NEAR' : 'MISS') + ' ' + fl + ' economics ' + (l === 'sale' ? 'at the sale' : 'over L' + l) + ': $' + Math.round(rpe / 1000) + 'k/person/yr (80–250k), payroll ' +
          (pay * 100).toFixed(0) + '% (30–55%), margin ' + (margin * 100).toFixed(0) + '% (10–30%)');
      }
    });
  });
  flavors.forEach(function (fl) {
    var runs = results[fl].smart; if (!runs) return;
    var mc = stat(runs.map(function (r) { return isFinite(r.minCash) ? Math.round(r.minCash) : null; }));
    if (mc.n) console.log('  ' + fl + ' smart lowest cash after Level 4: avg $' + Math.round(mc.avg).toLocaleString('en-US') + ' (worst $' + mc.min.toLocaleString('en-US') + ')');
  });
  if (VERBOSE) flavors.forEach(function (fl) {
    bots.forEach(function (b) {
      results[fl][b].forEach(function (r, i) {
        console.log('    ' + fl + ' ' + b + ' seed' + i + ' L4@' + r.grad + ' ' + [5, 6, 7, 8, 9, 10].map(function (l) { return 'L' + l + '@' + (r.lv[l] === undefined ? '-' : r.lv[l]); }).join(' ') +
          ' sold@' + r.sold + (r.valuation ? ' $' + (r.valuation / 1e6).toFixed(1) + 'M' : '') + ' over=' + r.over + ' end L' + r.finalLevel + ' hc ' + r.end.headcount + ' r30 $' + r.end.r30 +
          ' margin ' + (r.end.margin * 100).toFixed(0) + '% cash $' + r.end.cash);
      });
    });
  });
}

console.log('\nVerdict:');
verdict.forEach(function (v) { console.log('  ' + v); });
if (lateVerdict.length) { console.log('  -- late game --'); lateVerdict.forEach(function (v) { console.log('  ' + v); }); }
var keys = Object.keys(warnings);
if (keys.length) {
  console.log('\nEngine warnings (content issues):');
  keys.slice(0, 20).forEach(function (k) { console.log('  ' + warnings[k] + '× ' + k); });
}
var misses = verdict.filter(function (v) { return v.indexOf('MISS') === 0; }).length;
var lateMisses = lateVerdict.filter(function (v) { return v.indexOf('MISS') === 0; }).length;
var lateNear = lateVerdict.filter(function (v) { return v.indexOf('NEAR') === 0; }).length;
console.log('\n' + (misses ? misses + ' Level 1–3 target(s) missed — tune TUNING in js/engine.js or content numbers.' : 'All Level 1–3 pacing targets met.'));
if (!EARLY_ONLY) console.log((lateMisses ? lateMisses + ' late-game target(s) missed — tune TUNING (engine.js), LT (engine-late.js) or content numbers.' : 'All late-game targets met' + (lateNear ? '' : '.')) +
  (lateNear ? (lateMisses ? ' ' : ' except ') + lateNear + ' economics band(s) only near (within a few points).' : ''));
}

if (require.main === module) main();
else module.exports = { E: E, C: C, BOTS: BOTS, runOne: runOne, pickOption: pickOption, MAX_DAYS: MAX_DAYS, EARLY_DAYS: EARLY_DAYS, smartLate: smartLate, lateReserve: lateReserve };
