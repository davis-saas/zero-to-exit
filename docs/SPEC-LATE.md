# Zero to Exit — v0.2 Spec: Levels 4–10 (late game)

Extends `docs/SPEC.md` (read it first; every rule there still applies: banned names, classic scripts,
Node-safe engine/content, phone-first, friendly tone, own words). Levels 1–3 must keep working
exactly as they do now (their balance-sim and card-check results must not regress).

The late game turns the solo hustler into a company: you hire, niche down, add a premium product,
optimize, triage chaos, build specialist teams, place one big bet, and finally **sell the company at
The Summit**, which ends the run and grants Wisdom perks for a New Game+.

---

## 1. Levels 4–10 (grounded in the scaling stage guides, reworded)

| # | Name | Role | Headcount band | Boss | New mechanic | Goal items (fitness & tutor; agency via `targetByFlavor`) |
|---|------|------|---------------|------|--------------|-------------|
| 4 | Crew | Trainer | 1–4 | Too much for one person | **Team** (hire coach / closer / setter), **Playbooks** (SOPs), payroll, Lead Squad: Fans + Staff | `metrics.headcount ≥ 3`, `metrics.founderDeliveryShare ≤ 0.4` (use `lte`, see §5), `metrics.revenue30 ≥ 30000` (agency 45000) |
| 5 | Focus | Manager | 5–9 | Trying to serve everyone | **Niche focus** slider + managers (span of control) | `headcount ≥ 5`, `focus ≥ 60`, `metrics.profitMargin30 ≥ 0.15`, `revenue30 ≥ 60000` (agency 90000) |
| 6 | Product Line | Director | 10–19 | Too little money per customer | **Premium product** (build it, price it, sell it to existing customers) + Lead Squad: Agencies + Partners | `headcount ≥ 10`, `metrics.premiumShare30 ≥ 0.2`, `revenue30 ≥ 120000` (agency 180000) |
| 7 | Tune-Up | Leader | 20–49 | Everything is inefficient | **Efficiency + improvement projects** (fix the weakest metric first) | `headcount ≥ 20`, `metrics.efficiency ≥ 75`, `profitMargin30 ≥ 0.2`, `revenue30 ≥ 250000` (agency 350000) |
| 8 | Org Chart | Executive | 50–99 | Every system is overwhelmed | **Departments + fires + weekly CEO attention** (triage) | `headcount ≥ 50`, `metrics.deptHealthMin ≥ 60`, `metrics.calmDays ≥ 14`, `revenue30 ≥ 500000` (agency 650000) |
| 9 | Specialists | President | 100–249 | Nobody can know everything | **Specialist teams per department** | `headcount ≥ 100`, `metrics.specialistDepts ≥ 4`, `revenue30 ≥ 1000000` (agency 1300000) |
| 10 | Empire | Chairman | 250–500 | Growth stalls | **Market saturation + one Big Bet + valuation + Sell at The Summit** | `headcount ≥ 250`, `flags.betDone` (path `metrics.betDone ≥ 1`), `metrics.valuation ≥ 50000000` |

Level 10 does **not** auto-graduate. When its goal is met the UI shows **"Sell at The Summit"**
(also available earlier in L10 at a lower score). Selling ends the run (`state.exit.sold = true`,
`state.graduated = true`) and shows the finale + New Game+ perk picker. Players may also keep
playing after selling? No: selling is final for that run (they start a New Game+).

Pacing targets for the smart bot (§8): each of L4–L9 takes roughly 30–60 days, L10 roughly 40–80;
full run to the sale ≈ day 300–450. A naive bot should stall or go broke somewhere in L4–L7.

---

## 2. State additions (engine-core adds ALL of these to `defaultState`, so old saves load)

```js
team: { coach: 0, closer: 0, setter: 0, manager: 0, ramp: [], morale: 80 },
      // ramp: [{ role, n, daysLeft }] new hires work at reduced output until ramped
sops: { delivery: 0, sales: 0, marketing: 0, hiring: 0 },         // Playbook ranks 0..3
squad: { fans: { on: false, reward: 50 }, agency: { retainer: 0 }, partners: { count: 0, commission: 0.2 } },
focus: 0,                                                       // 0..100 niche focus (unlocks L5)
premium: { built: false, buildDays: 0, price: 0, on: false, name: '' },  // buildDays>0 = in progress
ops: { efficiency: 80, project: null, done: [] },               // project: { id, daysLeft }
depts: { marketing: {health:80,spec:0}, sales: {health:80,spec:0}, delivery: {health:80,spec:0},
         people: {health:80,spec:0}, finance: {health:80,spec:0}, tech: {health:80,spec:0} },
fires: [],                                                      // [{ uid, typeId, dept, impact, urgency, daysLeft }]
attention: { max: 3, left: 3 },                                 // CEO attention points per week (L8+)
calmDays: 0,                                                    // days in a row with no high-impact fire left burning
bet: null,                                                      // { id, daysLeft } while a Big Bet runs
exit: { sold: false, valuation: 0, score: 0, wisdom: 0 },
perks: [],                                                      // New Game+ perk ids applied at createState
_sysMods: {}                                                    // per-day multipliers set by systems (see §4)
```

New `mods` keys (start 1.0; add to MOD_KEYS): `teamOutput, salaryCost, premiumTake, hireRamp`.

Allowed effect paths (add to §5.3 of SPEC.md): `focus, team.morale, ops.efficiency, sops.delivery,
sops.sales, sops.marketing, sops.hiring, squad.partners.count, attention.max, premium.price,
depts.<marketing|sales|delivery|people|finance|tech>.health, calmDays`.

---

## 3. Engine-core (js/engine.js) — what it must implement

All existing API stays. Level cap is 10. `enterLevel` already applies a level's `onEnter`.

### 3.1 Team
- Roles come from `content.roles` (§6): `{ id, name, emoji, unlockLevel, salary /*$ per day*/, hireCost, capacity, desc, teaches }`.
  Built-in meaning of `capacity` per role id:
  - `coach`: +capacity delivery energy per day (default 25 after the balance pass, §9) — covers client delivery before the founder.
  - `closer`: +capacity sales calls per day (default 6) at close rate × (0.85 + 0.05 × sops.sales).
  - `setter`: +capacity outreach actions per day (default 80), split warm/cold per the plan's outreach ratio (warm only while friends remain).
  - `manager`: manages `capacity` staff (default 6, +1 per sops.hiring rank). Founder manages 4 directly.
    Staff beyond (founder 4 + managers × span) work at 60% output ("unmanaged").
- Output multiplier per hire: `eff = rampFactor × managedFactor × min(m('teamOutput'), 1.25) × (0.7 + 0.3 × morale/100)`.
  New hires ramp from 40% to 100% over `21 / m('hireRamp') × (1 − 0.15 × sops.hiring)` days (§9).
- Payroll: Σ count × salary × payScale(flavor) × payLevel × m('salaryCost') per day, paid every tick (counts as
  `payroll` in daily stats). `payLevel = 1 + 0.2 × log2(staff ÷ 8)` (≥ 1; staff = hired generalists, not
  specialist teams): bigger teams need pricier seats (§9, §10).
  Can go negative cash: from Level 4 a credit line absorbs dips and the game-over countdown only runs past it (§10).
- `hire(state, content, roleId)` → `{ ok, reason, events }`: needs `level ≥ role.unlockLevel`, cash ≥ hireCost and
  room in the recruiting cap (§9/§10: hires per 14 days ≤ max(1, ⌊0.7 + 0.2 × headcount + 0.5 × sops.hiring⌋)).
  Metrics `hireCap`, `hiresLeft`, `hiresUsed`; `ZTE.Engine.hireCap(state, content)`.
  `fire(state, content, roleId)` → `{ ok, reason }` (morale −5).
- Morale: drifts toward 80; −when overloaded (delivery need > capacity), −when burnout high, + from some upgrades/cards.
- Metrics: `headcount` (1 + all staff, incl. specialist teams from depts — see §4.3 `specialistHeadcount`),
  `payrollDaily`, `teamDelivery`, `teamCalls`, `teamOutreach`, `unmanaged`, `founderDeliveryShare`
  (share of today's delivery need covered by the founder's own energy, 0..1; 0 when no customers),
  `founderSalesShare`, `revenuePerEmployee` (annualised).

### 3.2 Lead Squad (L4+ fans & staff via setters; L6+ agency & partners)
- Fans: `squad.fans.on` → referral rate × 2; each referral sale costs `reward` (paid at sale).
- Agency: `squad.agency.retainer` $/day → leads/day = retainer / (adCpl × 1.4), lead quality 0.5.
- Partners: `count` partners each send ~0.4 leads/day (quality 0.8); each sale from partner leads pays `commission` × price.
- Setters are the "Staff" squad member (above); their cold messages saturate: reply rate ÷ √(1 + cold actions ÷ 400) (§9).
  API: `setSquad(state, content, key, value)` for
  `'fans'` (bool), `'agency'` ($/day, capped by cash rules like ads), `'partnersRecruit'` (+1 partner, costs $500 + 10 energy).

### 3.3 Focus (L5+)
`setFocus(state, content, v)` (0..100). With f = focus/100: lead volume from all sources ×(1 − 0.45f),
close rate ×(1 + 0.2f), perceived value ×(1 + 0.15f), churn ×(1 − 0.35f), refunds ×(1 − 0.3f),
delivery energy per customer ×(1 − 0.2f). (Net effect: fewer leads, more money — teach that. Numbers from the
balance pass, §9; the first draft had 0.35 / 0.4 / 0.3.)

### 3.4 Premium product (L6+)
- `buildPremium(state, content)` costs `content.premiumDefaults.buildCost` (default $15,000) and takes
  `buildDays` (default 21). When done: `premium.built = true`, price defaults to 4 × core price.
- `setPremiumPrice`, `togglePremium`. While on: each day, a share of active customers and of customers
  finishing delivery buy it: take ≈ 6% of finishers + 0.12%/day of active (§9), × min(m('premiumTake'), 1.75) × value fit
  (premium price vs 3 × perceived value curve) × (1 + 0.5 × focus/100). Each premium sale adds a
  delivery cohort at 1.5 × delivery energy for `deliveryDays`. Revenue tagged `premiumRevenue`.
- Metrics: `premiumRevenue30`, `premiumShare30` (premium ÷ total revenue30).

### 3.5 Scale & performance
- The funnel must use aggregate (binomial) maths when leads or calls are large — no per-lead loops
  above ~60 leads/day. A late-game day must tick in < 2 ms; `ghostCompare` < 400 ms at L9
  (reduce runs adaptively if needed).
- Ad cap after client-financed acquisition becomes $60,000/day.
- Daily stats add `payroll`, `premiumRevenue`, `profit` (revenue − payroll − ads − tools − living − squad costs).
- Metrics: `profit30`, `profitMargin30` (profit30 ÷ revenue30, 0 if no revenue), `cost30`.

### 3.6 Systems hook (engine-late plugs in here)
```js
ZTE.Engine.registerSystem({ id, minLevel, init(state, content, api),
  recompute(state, content, api),          // set state._sysMods[...] (called at start of every day + after actions)
  onDay(state, content, api, events),      // called once per tick after cohorts/members, before goals
  onMetrics(state, content, metrics, api) // add fields to metrics (+ metrics.why.company lines)
});
```
- Core keeps `ZTE.Engine.systems = []`. Systems with `minLevel > state.level` are skipped.
- Core resets `state._sysMods = {}` then calls every system's `recompute` at the start of each day.
- `m(state, stat)` = `mods[stat] × Π buffs × (state._sysMods[stat] ?? 1)` for every stat lookup.
- `api` = `{ TUNING, rand, chance, binom, stochRound, addLeads(state,n,q,fromAds), earn(state,amount,tag),
  spend(state, amount, tag) /* tag: 'tools'|'payroll'|'project'|'dept'|'bet'|'squad' */, pushLog,
  applyEffects, unlockNotebook, m, getFlavor, computeMetrics, last30, money }`.
- Systems run inside ghost/forward sims too (deterministic via the RNG). Their events are ignored there.
- `getGoal` must resolve every `metrics.*` path (including ones added by systems' `onMetrics`).

### 3.7 New Game+ perks
`createState(content, { seed, flavor, perks: [ids] })` applies each `content.perks[i].effects` after
level 1 starts and stores ids in `state.perks`.

### 3.8 Content needed by core (with fallbacks)
`content.roles`, `content.premiumDefaults`, levels 4–10 `goal` / `onEnter`, `targetByFlavor`.

---

## 4. Engine-late (js/engine-late.js, loaded after engine.js) — systems + actions

Classic script; registers systems via `ZTE.Engine.registerSystem` and adds actions onto `ZTE.Engine`.
Must also load in Node after engine.js. Reads `content.projects`, `content.departments`,
`content.fireTypes`, `content.bets` (§6).

### 4.1 Efficiency & projects (minLevel 7)
- `ops.efficiency` (0–100) drifts down as headcount grows (bloat ≈ −0.25/day per 10 people above 20,
  slowed by sops ranks, managers coverage and tech dept health), and up from finished projects.
  recompute: `_sysMods.teamOutput *= 0.6 + 0.4 × efficiency/100`; `_sysMods.salaryCost *= 1 + (80 − efficiency)/400`.
- Projects (`content.projects`: `{ id, name, emoji, metric, cost, days, effects, desc, teaches, notebook? }`;
  `teaches` is the lesson text, `notebook` the lesson id unlocked when it finishes), one at a time:
  `startProject(state, content, id)` → `{ ok, reason }`. When done: apply effects; if the project's
  `metric` is the current weakest one (`metrics.weakestMetric`, chosen among bookRate, showRate,
  closeRate, churn, deliveryEfficiency, cpl relative to healthy benchmarks) its effects apply at
  full strength + `ops.efficiency += 8`; otherwise half strength + 3 (teaches: fix the constraint).
  A repeat of the same project costs +50% per earlier run and has half the effect of the run before it.
  The first Level 7 day takes the first honest measurement: efficiency drops by 80 − `LT.effStart` (56).
- Metrics: `efficiency`, `weakestMetric` (string id), `projectDaysLeft`.

### 4.2 Departments, fires, attention (minLevel 8)
- Each `depts[d].health` drifts down with growth (≈ −0.15/day per 50 people) and up with specialists (§4.3).
  recompute maps health → `_sysMods`: marketing→`adCpl` (low health = pricier), sales→`closeRate`,
  delivery→`churn` & `refundRate`, people→`hireRamp` & morale drift, finance→`salaryCost`, tech→efficiency drift.
- Fires: each day, chance ≈ 0.15 + headcount/600 to spawn one from `content.fireTypes`
  (`{ id, dept, title, emoji, impact 1–3, urgency 1–3, days, failEffects, desc }`). Low-impact high-urgency
  fires are noise; high-impact ones matter. `handleFire(state, content, uid)` spends 1 attention:
  resolves it (+3 dept health). Unhandled at `daysLeft` 0 → applies `failEffects` and dept health −impact×6.
- Attention resets to `max` every 7 days. `calmDays` = days in a row with no impact-3 fire past its
  first day; resets when one burns.
- Metrics: `deptHealthMin`, `openFires`, `criticalFires`, `calmDays`, `attentionLeft`.

### 4.3 Specialists (minLevel 9)
- `upgradeDept(state, content, deptId)` → spec+1 (max 3): one-time cost `dept.specCost × spec`,
  adds `dept.specHeadcount` people and `dept.specSalary` $/day per level. Each spec level: health +15,
  slower health decay, and a department-specific multiplier (from `content.departments[i].specEffects`,
  applied in recompute, e.g. marketing adCpl ×0.88 & lead volume ×1.1; sales closeRate ×1.06; delivery
  churn ×0.85; people hireRamp ×1.3; finance salaryCost ×0.95; tech teamOutput ×1.06).
- Metrics: `specialistDepts` (depts with spec ≥ 2), `specialistHeadcount`, `specialistPayroll`.

### 4.4 Saturation, Big Bet, valuation, exit (minLevel 10)
- Saturation: recompute adds `adCpl ×(1 + revenue30/market)` and lead volume ÷ (1 + 0.4 × revenue30/market), where
  market = max($1.5M, 2 × revenue30 on the first Level 10 day) (`state._satBase`) — growth stalls on purpose
  (the boss) whatever size you arrive at. A successful bet removes most of it.
- `startBet(state, content, betId)` (`content.bets`: `{ id, name, emoji, cost, days, baseChance,
  prep: [{ metric, gte, bonus }], success: effects, fail: effects, desc, teaches }`). Only one bet per run.
  When it resolves: roll success with chance = baseChance + Σ prep bonuses (capped 0.9); set
  `flags.betDone = true`, `flags.betWon` true/false; apply effects; event `{ type: 'bet', won, text }`.
- `getValuation(state, content)` → `{ valuation, annualProfit, multiple, factors: [{ label, value, note }] }`:
  annualProfit = profit30 × 12 (≥ 0); multiple = 3 + 3 × recurringShare (memberships + premium-on-plan)
  + 2 × growthRate factor + 2 × ownerIndependence (1 − max(founderDeliveryShare, founderSalesShare))
  + 1 × (deptHealthMin/100) + 1 × leadSourceDiversity, capped 14. Metrics: `valuation`, `multiple`, `betDone` (0/1).
- `sellCompany(state, content)` → `{ ok, reason, valuation, score, wisdom }`: only at level 10.
  Sets `exit = { sold: true, valuation, score, wisdom }`, `graduated = true`, event `{ type: 'exit', amount: valuation }`.
  `wisdom = 1 + floor(valuation / 10M)` (max 10). score is a single number (valuation/1000 + lessons × 500 + achievements × 300 − days × 20, ≥ 0).

---

## 5. Conditions
Goal items support `lte` in addition to `target` (≥). Format: `{ label, path, target, lte: true }`
means "current ≤ target counts as done". `getGoal` progress for `lte` items = 1 when met, else
`clamp(target / current)`.

---

## 6. New content (all in our own words, glossary names)

Files and ownership (each file only touches its own keys; arrays are **appended**, never replaced):
- `js/content/base.js` — replace the locked teasers for levels 4–10 with full level defs (goal, onEnter,
  intro, outro, `locked: false`), keep their names/roles/constraints; append coach lines + achievements.
- `js/content/systems.js` → `ZTE.Content.roles, premiumDefaults, projects, departments, fireTypes, bets, perks`.
- `js/content/upgrades-late.js` → `ZTE.Content.upgrades = (ZTE.Content.upgrades || []).concat([...])`
  (~22 upgrades: Playbooks for delivery/sales/marketing/hiring ranks 1–3 (set `sops.*`), recruiting
  tools, manager training (span), morale/culture perks, KPI dashboard, security & insurance, automation,
  premium-product helpers; categories `'team'` and `'systems'` plus existing ones; minLevel 4–10).
- `js/content/cards-late.js` → appends to `ZTE.Content.cards` (6 per level, 42) and `ZTE.Content.events` (~12).
- `js/content/notebook-late.js` → appends to `ZTE.Content.notebook` exactly the 25 ids below.

Load order in index.html: base, upgrades, upgrades-late, cards, cards-late, notebook, notebook-late,
systems, engine, engine-late, fx, ui.

**New notebook ids (fixed list):**
L4: `hire_help, playbooks, first_hire, lead_squad, payroll_math` ·
L5: `ideal_customer, saying_no, span_of_control, profit_margin` ·
L6: `second_product, ascension, partners` ·
L7: `better_not_more, measure_it, bloat` ·
L8: `triage, departments, ceo_attention` ·
L9: `specialists, a_players, department_heads` ·
L10: `big_bet, valuation, owner_independence, the_summit`

Role id `closer` is a code id only: every player-visible name for it says "Sales Rep" (or a per-flavor
equivalent via `nameByFlavor`), never the id word.
Defaults in `systems.js` (after the balance pass, §9): roles coach ($156/day, hire $1,500, 25 energy), closer ($192/day,
hire $2,000, 6 calls), setter ($108/day, hire $1,000, 80 actions), manager ($264/day, hire $3,000, span 6);
~8 projects (one per weakest-metric id + 2 general); 6 departments with specCost / specHeadcount
(4–6 senior people per level, ≈ $160/day each) / specSalary / specEffects; ~14 fire types across all departments mixing
noise and real emergencies; 4 bets (acquire a competitor, open a new market, launch a new product
category, build your own software platform) with different risk/return and prep bonuses; 6 perks
(e.g. +$2,000 starting cash, +1 Hooks rank, +10% close rate, +20 friends, faster hires, 1 free Playbook).

---

## 7. UI (js/ui.js + css/styles.css + index.html)
- New **Company** tab (🏢) between Growth and Numbers, visible from Level 4: sections appear as their
  level unlocks — Team roster & Hire buttons (with salary, output, ramp, managed/unmanaged warning),
  Playbooks, Lead Squad (fans toggle, agency retainer slider, recruit partner), Niche focus slider with a
  live "fewer leads / more money" preview, Product Lab (build progress, price slider, on/off), Efficiency
  & Projects (weakest metric highlighted), Departments with health bars + Fires list with "Handle (1 ⚡CEO)"
  buttons and attention dots, Specialist upgrades per department, Big Bet picker + progress, and a
  Valuation card (multiple factors) with **Sell at The Summit**.
- Top bar: add **8×** speed from Level 4. Headcount chip in the goal strip from Level 4.
- Numbers tab: profit chart line, payroll/profit/margin/headcount KPIs, the 10-level path map shows all
  levels as real (current/done/upcoming), no more "coming soon".
- Modals: level-up for 4–10 (with new unlock notes), bet result, **Summit finale** (valuation breakdown,
  score, days, lessons, achievements, confetti) → **New Game+** perk picker (spend Wisdom; store
  `localStorage['zte-wisdom-v1'] = { points, owned: [ids] }`, wrapped in try/catch) → flavor picker →
  `createState(..., { perks })`. The old L3 "graduated / coming soon" modal is replaced by normal level-up.
- Fires: toast when a high-impact fire starts; Company tab badge while fires are open.
- Keep every existing behaviour (tap guards, morph rendering, storage fallbacks).

## 8. Tools (integration phase)
`validate-content.js` (new keys, new notebook list → 53 ids total, new paths/mods; loads every file in
index.html order; goals for all 10 levels checked on states forced to each level and against the §1 table;
conds reading a system metric must be guarded with that system's `minLevel`; roles, premiumDefaults, projects,
departments, fire types, bets and perks exercised through the real engine; Engine calls in ui.js must exist),
`balance-sim.js`
(late-game bot behaviour: hire for the bottleneck, managers before span overflows, focus ~70 in L5,
premium in L6, projects on the weakest metric, handle high-impact fires first, specialists on the
weakest departments, pick the best-prepared bet, sell when valuation ≥ target), `card-check.js`
(late cards), headless smoke test through Level 10 and the sale + New Game+.

Built: `balance-sim.js` plays all 10 levels (600 days; Levels 1–3 still judged on the first 200 days with the
v0.1 targets) with bots `smart`, `naive`, `naiveLate` (smart in L1–3, naive company decisions from L4) and
`idle`, prints days per level, sale day, broke rate, economics per level (margin, payroll, running costs,
ads, sales per person) and valuation at the sale; `--set T.key=v,LT.key=v` tries tuning values without
editing files. `card-check.js` checks all 60 cards (`--early` / `--late`); late-card states come from full
smart games, and a late card that never triggers there is reported.

---

## 9. Integration balance pass (late-game economy)

The first draft let the smart bot reach 70–95% margins and a $1–3B sale by day ~200. These rules and numbers
make the late game cost what it earns (smart bot: sale ≈ day 320–370, margins ≈ 25–35%, payroll ≈ 35–45%,
$150–270k sales per person per year; see the balance-sim report):
- **Recruiting cap** (core): hires per 14 days ≤ max(1, ⌊0.7 + 0.33 × headcount + 0.5 × Hiring Playbook rank⌋).
  The level headcount goals (×2 per level) therefore set the pace: good people take time to find.
- **Pay**: staff salaries × `payLevel = max(1, 1 + 0.45 × log2(staff ÷ 8))` (×1.9 at 32 staff, ×2.8 at 128; tied to your own
  team size, so a level-up never changes pay by itself) and × the flavor's optional `payScale`
  (base.js; agency 1.15, which also scales hiring fees and specialist pay). `roleDef(content, id, flavor)` returns
  salary and hireCost with the pay scale; metrics `payLevel`, `salaryCostMult`.
- **Running costs**: from Level 4, 25% of each day's sales (software, rent, card fees, contractors) are charged as
  `opex` (daily stat, `last30().opex`, `metrics.opex30`) and count against profit.
- **Saturation**: setters' cold messages ÷ √(1 + actions ÷ 400); ads keep the Level 1–3 budget curve
  (`adSaturationLate` 150); optional `TUNING.marketDepth` (off) for market depth by customers won.
- **Caps on stacked boosts** (Level 4+): team output ≤ ×1.25, delivery-energy multiplier ≥ ×1.0, premium take ≤ ×1.75.
  Playbooks give +5% coach/setter output per rank (was +10%).
- **Content**: every late card mod is the square root of the first draft (1.10 → 1.049); late card cash scaled to
  the company (L7/L8 ≈ 0.3×, L9 ≈ 0.2×, L10 ≈ 0.15× of the first draft, then tuned per card so the best option
  wins its ghost timeline); premium `activeTakePerDay` 0.0012; specialists 4–6 people per level (90 at max);
  bets cost half (≈ $150k–1M) and run 28–48 days.
- **Ghost timelines** (forward sims) from Level 8 spend CEO attention on the biggest open fire (impact 2+), as a
  player would, so a timeline that levels into Level 8 is not punished for fires nobody could touch.

---

## 10. Beginner pass (forgiving late game)

A casual-player bot (balance-sim `casual`: 60/30/10 card answers, cheap random upgrades, follows the game's
hints a few days late, ignores "Sure?" half the time) went broke in 23 of 24 runs; the smart bot only survived
because it picked the best card answer ~90% of the time. These rules keep the economics plausible and make
neutral play survivable; §9 numbers above are superseded where they differ:
- **Economy room**: running costs stay 25% of sales; `payGrowth` 0.2 (×1.4 at 32 staff, ×1.8 at 128);
  coach capacity 35 delivery energy; recruiting 0.7 + 20% of headcount per 14 days; Level 7 starts at efficiency
  60 (`LT.effStart`) and the drop is announced in the feed. Late best/trap card mods took one more square root
  (a dozen best options that no longer won their ghost timeline keep the old strength).
- **Credit line** (Level 4+): cash may go below $0 down to −max($2,500, 10 days of average sales)
  (`creditLineDays`, `creditLineMin`); ads keep running on it; the negative balance costs 0.05% a day
  (`creditInterest`, daily stat `interest`, counts against profit). The game-over countdown runs only past the
  line: 14 days, or 28 when the last 30 days were profitable (`gameOverDaysLateProfit`), fixed for the whole dip.
  Metrics `creditLine`, `graceDays`, `negCashDays`.
- **Advice** (`Engine.advice(state, content, metrics?)`): one source for the owl hints, the Offer tab and the
  Company tab. `price` {hint, verdict raise/fair/lower/set, serveCost, busy}: the price that earns the most per
  sales call, never below serveCost ÷ 0.35 from Level 4 (`serveShareMax`); before Level 4 a founder whose clients
  eat 40%+ of the day is told to raise 15–25%. `ads` {step start/up/hold/down/off, to}: from Level 4 trims above
  ~22% of sales or when leads go stale, holds while the margin is under 12% (unless ad customers pay back within
  30 days), steps up to at most 15% of sales (`adShareMax`). `hire` {role | hold + wait, reason}: the bottleneck
  role (manager when 3+ coast unmanaged, coach while the founder still delivers, rep for stale calls, ...), held
  while the run-rate margin after the hire is under 12% or cash would last < 21 days (critical hires: < 14), and
  at Level 7+ while efficiency < 65 with no project running. `save`: the Level 6 Product Lab and the Level 10
  Big Bet come before growth hires, specialist teams and projects. `Engine.runwayAfter(state, content, cost,
  extraDaily)` = days of cash left after a purchase; `metrics.serveCost` = what the team spends to deliver one
  customer.
- **Purchases**: every Level 4+ cash button (upgrades, Product Lab, projects, specialist teams, partners, hires)
  asks "Sure?" when it leaves under 21 days of costs (bets: 30). The Product Lab costs max($6,000, 3 days of
  sales) (`Engine.premiumCost`). A Big Bet needs `LT.betKeepDays` (3) days of running costs left after paying
  (`Engine.late.betKeep`).
- **Crunch screen**: opens when cash drops below $0 while losing money, and again every 4 days while that lasts;
  the strip and the runway tile show credit-line use and, past the line, the countdown.
- **Tools**: balance-sim bots `casual` (900 days) and `mixed` (smart play, 60/30/10 cards) with checks: casual
  sells in ≥ 80% of runs, goes broke in ≤ 10%, average sale day 400–650; mixed sells in ≥ 70%.

