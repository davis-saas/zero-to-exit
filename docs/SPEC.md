# Zero to Exit — v0.1 Spec & Code Contract

A cartoony, phone-first idle/incremental business game that teaches business-growth principles
(offers, lead generation, sales, Cash Combos, scaling stages). v0.1 covers **Levels 1–3**.

This file is the single source of truth. Every builder must follow the names, file layout,
state shape, content schema and engine API below **exactly**. If something is missing, choose the
simplest option consistent with this doc and leave a `// SPEC-GAP:` comment.

---

## 0. Hard rules

1. **No real-person branding.** Never write a real author's or company's name, book titles,
   trademarked framework names or any quoted sentence from the source material — in code,
   comments, UI text or content. `tools/validate-content.js` enforces a banned-term list.
   Use the in-game glossary (§2). All explanations are written in our own words.
2. **Principles must stay faithful** to the source ideas (source texts are available as plain text,
   see §10). Realistic economics matter more than flashy numbers: the player uses this game to
   learn real decisions.
3. **Plain HTML + CSS + JavaScript.** No build step, no npm packages, no frameworks, no ES modules
   (the game must run by double-clicking `index.html`, i.e. from `file://`). Every JS file is a
   classic script using the global namespace `ZTE` (see §3).
4. Engine and content files must also load in **Node** (for the balance simulator). So: no DOM,
   `window` or `localStorage` access in `engine.js` or any `content/*.js` file.
5. Phone-first: designed for 360–430px wide portrait; on desktop it renders as a centered
   phone-sized column (max-width 480px). No horizontal scroll. Touch-friendly (44px targets).
6. Tone: friendly, playful, encouraging, short sentences. Fun > serious. Dopamine: pops, confetti,
   streaks, satisfying numbers.

---

## 1. Game overview

You start broke with an idea. Each in-game **day** you get **100 Energy** (the Daily Grind). Energy
is spent on outreach, sales calls, posting content and delivering to customers. Leads flow through
a funnel (leads → booked calls → shows → closes) into customers and cash. You tune your offer, pick
lead channels, buy upgrades, and answer **choice cards** whose consequences are shown on a
**ghost timeline** (your path vs the road not taken).

- Time runs automatically (idle). 1 day = 6 s at 1×; speeds: pause, 1×, 2×, 4×. Choice cards and
  modals pause time.
- **Tapping** the big "Reach out!" button spends 1 Energy immediately on the selected outreach
  channel with a combo bonus (more fun, slightly better). Energy left at the end of the day is
  spent automatically by **Autopilot** according to the daily plan, at 80% effectiveness.
- Living costs drain cash daily. Cash below $0 for 7 days in a row = game over ("Back to the 9-to-5"),
  with **Rewind** to any earlier choice card or restart.

### Levels (based on the 10-stage scaling path; v0.1 ships 1–3, shows 4–10 locked)

| # | key | Name | Your role | Constraint (boss) | Goal to graduate |
|---|-----|------|-----------|-------------------|------------------|
| 1 | garage | Garage | Researcher | Nobody knows you | Get 5 people to try it free + collect 3 testimonials |
| 2 | hustle | Hustle | Starter | You make no money | Make $5,000 in total sales |
| 3 | megaphone | Megaphone | Doer | New customers come in unevenly | $15,000 in sales over the last 30 days ($22,000 for agency, via `targetByFlavor`) |
| 4 | crew | Crew | Trainer | Too much for one person | (locked — "coming soon") |
| 5 | focus | Focus | Manager | Trying to serve everyone | locked |
| 6 | productline | Product Line | Director | Too little money per customer | locked |
| 7 | tuneup | Tune-Up | Leader | Everything is inefficient | locked |
| 8 | orgchart | Org Chart | Executive | Every system is overwhelmed | locked |
| 9 | specialists | Specialists | President | Nobody can know everything | locked |
| 10 | empire | Empire | Chairman | Growth stalls — make a big bet & exit at The Summit | locked |

What unlocks when:
- **L1 Garage:** Warm outreach (Friends megaphone) only. Price is locked at $0 (free trials).
  Trial users need delivery for `trialDays`; when a trial finishes it may produce a testimonial.
- **L2 Hustle:** Price slider + Offer Forge upgrades, Cold outreach megaphone, Close Kit + Skill
  Scrolls, guarantees, lead-nurture upgrades. Customers pay the price up front.
- **L3 Megaphone:** Content megaphone, Ads megaphone, Cash Combos (Hook Offer, Upsell, Downsell,
  Membership), the Numbers tab's LTV / CAC / 30-day cash panel. **Client-financed acquisition**:
  when 30-day cash per customer ≥ CAC, an achievement fires and the ad-budget cap is removed.
- Graduating L3 → celebration + "Level 4: Crew — coming soon" summary screen (score, days, cash,
  lessons learned). Player may keep playing in sandbox.

### Flavors (pick one at start; changes numbers + flavor text)
`fitness` (Fitness Coach, B2C, lower price, big warm network), `agency` (Marketing Agency, B2B,
higher price, small network, cold outreach works better), `tutor` (Online Tutor, middle).

---

## 2. Glossary (in-game names — use these, never the originals)

| Key (`content.glossary.*`) | Display name | Teaches |
|---|---|---|
| coach | Coach Flex | mentor character — a jacked cartoon owl, tough-love tips |
| summit | The Summit | where you sell your company (future prestige) |
| offerForge | Offer Forge | building an offer people feel stupid saying no to |
| noBrainerOffer | No-Brainer Offer | the finished, irresistible offer |
| valueMeter | Value-o-Meter | value = (dream outcome × likelihood) ÷ (time delay × effort) |
| megaphones | The Four Megaphones | the four ways to get leads: Friends (warm outreach), Cold Calls (cold outreach), Content (free content), Ads (paid ads) |
| leadSquad | Lead Squad | getting others to bring leads: Fans (referrals), Staff, Agencies, Partners (affiliates) — locked teaser in v0.1 |
| dailyGrind | The Daily Grind | do 100 lead actions every day, no excuses |
| cashCombos | Cash Combos | Hook Offer (attraction) → Upsell → Downsell → Membership (continuity) |
| closeKit | Close Kit | a simple sales-call process (our own step names) |
| skillScrolls | Skill Scrolls | trainable skills: Hooks, Pricing, Proof, Nurture, Retention |
| notebook | Founder's Notebook | codex of unlocked lessons + quizzes |

Close Kit steps (our own words): **Ask why now → Name the gap → Paint the dream → Clear the doubts →
Make the ask → Welcome them in.**

---

## 3. Files & load order

```
game/
  index.html            loads css + scripts in this order (classic <script> tags):
  css/styles.css
  js/content/base.js        glossary, flavors, levels, channels, combos, coach lines, achievements
  js/content/upgrades.js    shop upgrades (Offer Forge, Skill Scrolls, Nurture, Megaphone gear)
  js/content/cards.js       choice cards + random events
  js/content/notebook.js    Founder's Notebook entries + quizzes
  js/engine.js              pure simulation (no DOM)
  js/fx.js                  confetti, number pops, sound (WebAudio), haptics
  js/ui.js                  rendering, input, game loop, save/load
  tools/balance-sim.js      node: runs bot strategies through the engine, prints pacing report
  tools/validate-content.js node: checks all content references & effect paths
  tools/card-check.js       node: ghost-timeline check that every card's 'best' option wins
  docs/SPEC.md
```

Namespace pattern for **every** JS file (works in browser and Node):

```js
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};
  ZTE.Content.cards = [ /* ... */ ];      // content files assign their own keys only
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

`engine.js` assigns `ZTE.Engine = { ... }`. `fx.js` assigns `ZTE.FX`. `ui.js` assigns `ZTE.UI` and
boots on `DOMContentLoaded`. Node tools load files with `require(path)` in the order above, then
read `globalThis.ZTE`.

Content files own these keys of `ZTE.Content`:
- base.js → `meta, glossary, flavors, levels, channels, combos, coach, achievements`
- upgrades.js → `upgrades`
- cards.js → `cards, events`
- notebook.js → `notebook`

---

## 4. State shape (engine-owned; content effects may only target the paths in §5.3)

```js
state = {
  version: 1,
  seed: 12345, rng: 12345,          // mulberry32 state; all randomness goes through it
  flavor: 'fitness',
  day: 1,
  level: 1,                          // 1..3 playable; 4 = graduated v0.1
  speed: 1,                          // UI hint only
  cash: 3000,
  livingCost: 40,                    // $ per day
  energy: { max: 100, current: 100, overtimeToday: false },
  burnout: 0,                        // 0..100; overtime adds, decays daily; 100 = forced 3-day rest
  network: { size: 120, available: 120 },   // warm contacts; contacted ones refill slowly
  audience: 0,                       // followers (content)
  reputation: { testimonials: 0, caseStudies: 0 },
  leads: 0,                          // interested leads waiting (decay if ignored)
  offer: {
    dream: 4, likelihood: 3, speed: 3, ease: 3,   // Value-o-Meter dials, 1..10 (higher = better)
    price: 0,                        // $ one-time; locked to 0 in level 1
    guarantee: 'none',               // 'none' | 'conditional' | 'unconditional'
    name: 'My Offer'
  },
  combos: {                          // Cash Combos (unlocked in L3)
    hook:       { unlocked: false, on: false, price: 47 },
    upsell:     { unlocked: false, on: false, price: 300 },
    downsell:   { unlocked: false, on: false, price: 0 },     // price computed (e.g. 40% of main)
    membership: { unlocked: false, on: false, price: 99 }     // monthly
  },
  channels: {
    warm:    { unlocked: true,  level: 0 },
    cold:    { unlocked: false, level: 0 },
    content: { unlocked: false, level: 0, posts: [] },        // posts: [{day, reach}]
    ads:     { unlocked: false, level: 0, dailyBudget: 0 }
  },
  plan: { warm: 60, cold: 0, content: 0, sales: 40 },  // Autopilot % of leftover energy; sums to 100
  skills: { closing: 0, hooks: 0, pricing: 0, proof: 0, nurture: 0, retention: 0 },  // 0..5
  mods: {                            // permanent multipliers (start 1.0)
    warmReply: 1, coldReply: 1, contentReach: 1, adCpl: 1, bookRate: 1, showRate: 1,
    closeRate: 1, churn: 1, refundRate: 1, upsellTake: 1, downsellTake: 1, testimonialChance: 1,
    deliveryEnergy: 1, referralRate: 1, perceivedValue: 1, leadDecay: 1
  },
  buffs: [],                         // temporary: [{stat, mult, daysLeft, label}] — stat is a mods key
  customers: { trials: 0, active: 0, members: 0, total: 0 },   // engine keeps internal cohorts too
  stats: {
    trialsStarted: 0, trialsCompleted: 0, salesCount: 0, revenueTotal: 0, refunds: 0,
    adSpendTotal: 0, outreachTotal: 0, tapsTotal: 0, callsTotal: 0, leadsTotal: 0,
    daily: []                        // last 120 days: [{day, cash, revenue, leads, sales, adSpend}]
  },
  upgrades: [],                      // purchased upgrade ids
  flags: {},
  notebook: [],                      // unlocked notebook ids (in unlock order)
  quizzes: {},                       // notebookId -> true when answered correctly
  achievements: [],
  cardsSeen: [], pendingCard: null,  // pendingCard = card id waiting for the player
  history: [],                       // [{day, cardId, optionId, snapshot}] — last 10 decisions
  coachSeen: [],
  streak: { grindDays: 0 },
  log: [],                           // last 60: [{day, type, text}]
  gameOver: null,                    // null | {reason, day}
  graduated: false
}
```

Engine may add private fields prefixed with `_` (e.g. `_cohorts`, `_negCashDays`).

---

## 5. Content schema

### 5.1 Conditions (`cond`)
```js
{ all: [cond, ...] } | { any: [cond, ...] } | { not: cond }
{ path: 'reputation.testimonials', gte: 3 }     // also lte, gt, lt, eq
{ path: 'metrics.revenue30', gte: 10000 }        // 'metrics.*' reads Engine.computeMetrics()
{ level: 2 }  { minLevel: 2 }  { maxLevel: 3 }
{ minDay: 10 } { maxDay: 40 }
{ flag: 'triedDiscount' }  { notFlag: 'triedDiscount' }
{ upgrade: 'guarantee_conditional' } { notUpgrade: '...' }
{ chance: 0.15 }                                  // per-day roll (only meaningful in triggers)
```

### 5.2 Effects (array of ops, applied in order)
```js
{ op: 'add',  path: 'cash', value: -500 }            // numeric add (dials clamp 1..10, skills 0..5)
{ op: 'mul',  path: 'offer.price', value: 0.8 }
{ op: 'set',  path: 'offer.guarantee', value: 'conditional' }
{ op: 'mod',  stat: 'closeRate', mult: 1.15 }        // permanent: mods[stat] *= mult
{ op: 'buff', stat: 'contentReach', mult: 0.8, days: 7, label: 'Algorithm change' }
{ op: 'flag', name: 'niched', value: true }
{ op: 'unlock', what: 'channel:cold' }               // 'channel:<id>' | 'combo:<id>'
{ op: 'notebook', id: 'value_meter' }                // unlocks a Founder's Notebook entry
{ op: 'coach', text: 'Nice. Proof sells.' }          // shows a Coach Flex bubble
{ op: 'log', text: 'Your cousin signed up!' }
```

### 5.3 Paths effects may target (anything else is a content bug)
`cash, livingCost, energy.max, burnout, network.size, network.available, audience,
reputation.testimonials, reputation.caseStudies, leads, offer.dream, offer.likelihood, offer.speed,
offer.ease, offer.price, offer.guarantee, offer.name, skills.closing, skills.hooks, skills.pricing,
skills.proof, skills.nurture, skills.retention, combos.<id>.price, channels.<id>.level`

### 5.4 `base.js`
```js
meta: { title: 'Zero to Exit', version: '0.1.0', tagline: '...' }
glossary: { coach: 'Coach Flex', ... }                 // all keys from §2 → display strings
flavors: [{
  id: 'fitness', name: 'Fitness Coach', emoji: '💪', pitch: 'Help busy people get in shape',
  offerName: '6-Week Body Reboot',
  start: { cash: 3000, livingCost: 40, networkSize: 150,
           dials: { dream: 4, likelihood: 3, speed: 3, ease: 3 } },
  suggestedPrice: 500,          // shown as a hint at L2
  marketValue: 1500,            // perceived $ value when the Value-o-Meter score is "average"
  warmReplyBase: 0.12, coldReplyBase: 0.02, adCplBase: 25,
  deliveryEnergyPerCustomer: 1.0, deliveryDays: 42, trialDays: 14
}]
levels: [{
  id: 1, key: 'garage', name: 'Garage', role: 'Researcher', emoji: '🔧',
  constraint: 'Nobody knows you', bottomLine: 'Get people to try your stuff for free',
  goal: { text: 'Get 5 free trials and 3 testimonials',
          items: [{ label: 'Free trials', path: 'stats.trialsStarted', target: 5 },
                  { label: 'Testimonials', path: 'reputation.testimonials', target: 3 }] },
  onEnter: [effects],           // e.g. unlocks + notebook + coach
  intro: ['coach line', ...],   // shown as sequential Coach Flex bubbles when the level starts
  outro: 'celebration line', locked: false
}, ... 10 entries; 4..10 have locked: true and no goal]
channels: { warm: { name: 'Friends', emoji: '👋', verb: 'Message a friend', desc: '...', unlockLevel: 1 },
            cold: {...name:'Cold Calls'}, content: {...name:'Content'}, ads: {...name:'Ads'} }
combos: { hook: { name: 'Hook Offer', emoji: '🪝', desc: '...' }, upsell: {...}, downsell: {...},
          membership: {...} }
coach: [{ id: 'first_lead', cond: {...}, text: '...' }]     // each shown once when cond becomes true
achievements: [{ id: 'first_sale', name: 'Cha-ching!', emoji: '💰', desc: '...', cond: {...} }]
```

### 5.5 `upgrades.js`
```js
upgrades: [{
  id: 'testimonial_wall', name: 'Testimonial Wall', emoji: '🧱',
  category: 'offer' | 'skill' | 'nurture' | 'megaphone',
  minLevel: 2, cost: { cash: 200, energy: 0 },
  requires: ['other_id'],        // optional
  cond: {...},                   // optional extra availability condition
  desc: 'one-line what it does', teaches: 'one-line why it works',
  effects: [ ...ops ],
  notebook: 'proof'              // optional notebook id unlocked on purchase
}]
```
Target ~28 upgrades: ~10 offer (Value-o-Meter dials, guarantees, bonuses, naming, niche), ~8 skill
(Close Kit ranks, Hooks, Pricing, Proof, Retention), ~5 nurture (speed-to-lead, reminders,
follow-up sequence, CRM), ~5 megaphone gear (lead lists, personalization, camera, ad creative).

### 5.6 `cards.js`
```js
cards: [{
  id: 'discount_or_bonus', level: 2, emoji: '🏷️', title: 'The price objection',
  trigger: { all: [{ minLevel: 2 }, { path: 'stats.callsTotal', gte: 5 }] },   // checked daily
  priority: 5,                    // higher shows first when several trigger
  text: 'situation, 1–3 short sentences',
  ghostDays: 60,                  // days to simulate for the ghost timeline (default 60)
  options: [{
    id: 'discount', label: 'Knock 30% off', quality: 'trap',     // 'best' | 'ok' | 'trap'
    effects: [ ...ops ],
    outcome: 'what happened (1–2 sentences)',
    lesson: 'the principle in one punchy sentence'
  }, ...2–3 options],
  notebook: 'value_meter'         // unlocked after answering
}]
events: [{ id, cond, chancePerDay: 0.03, once: true, emoji, text, effects }]   // no choice; toast
```
Target: 6 cards per level (18 total) + ~10 random events. Choices should be real trade-offs; the
"best" option should win over 60 days in the ghost timeline, but not always on day 1.

### 5.7 `notebook.js`
```js
notebook: [{
  id: 'value_meter', term: 'Value-o-Meter', emoji: '📈', level: 2,
  title: 'Make value obvious',
  summary: '2–4 sentences in our own words',
  formula: 'Value = (Dream × Likelihood) ÷ (Time Delay × Effort)',   // optional
  tip: 'Coach Flex one-liner',
  quiz: { q: '...', options: ['a','b','c'], answer: 1, explain: '...' }
}]
```

**Notebook ids (fixed list — every content file uses only these):**
`start_free, warm_outreach, testimonials, daily_grind, value_meter, no_brainer_offer, pricing_up,
guarantees, close_kit, cold_outreach, hooks, speed_to_lead, show_rate, bonuses, niche, content,
paid_ads, ltv_cac, client_financed, hook_offer, upsell, downsell, membership, churn, constraint,
volume_then_quality, proof_checklist, scaling_path`

---

## 6. Engine API (`ZTE.Engine`)

All functions are pure-ish: they mutate the `state` passed in and return results; no DOM.
`content` is `ZTE.Content`.

```js
createState(content, { seed, flavor })          -> state   (applies level 1 onEnter)
tick(state, content)                            -> { events: [Event] }   // advance one day
tap(state, content, channelId, combo)           -> { ok, events }        // combo: int >= 0
setPlan(state, plan)                            -> void   // normalizes to sum 100
setPrice(state, content, price)                 -> { ok, reason }        // L1 locked to 0
setAdBudget(state, content, dollarsPerDay)      -> { ok, reason }
postContent(state, content)                     -> { ok, events, reason } // costs energy
toggleCombo(state, content, id, on)             -> { ok, reason }
overtime(state, content)                        -> { ok, reason }         // +30 energy today, +burnout
buyUpgrade(state, content, upgradeId)           -> { ok, reason, events }
availableUpgrades(state, content)               -> [{ upgrade, affordable, owned, locked, reason }]
getPendingCard(state, content)                  -> card | null
ghostCompare(state, content, cardId)            -> { [optionId]: [{ day, cash, revenue30, customers }] }
chooseCardOption(state, content, optionId)      -> { events }   // pushes snapshot to history first
rewind(state, historyIndex)                     -> newState    // restores snapshot (before that choice)
simulateForward(state, content, days)           -> series      // clone, autopilot, cards disabled
                                                  // optional 4th arg (internal): common-random-numbers seed
computeMetrics(state, content)                  -> Metrics
getGoal(state, content)                         -> { text, items: [{label, current, target}], progress }
checkCondition(state, content, cond)            -> bool
applyEffects(state, content, effects)           -> [Event]
answerQuiz(state, content, notebookId, index)   -> { correct, explain }
serialize(state) -> string;  deserialize(str) -> state
TUNING                                          // exported constants object
```

**Metrics**
```js
{ offerScore, offerValue, closeRate, bookRate, showRate, warmReply, coldReply, cpl,
  ltv, cac, ltvCac, cash30PerCustomer, revenue30, revenueToday, leadsToday, salesToday,
  customersActive, deliveryEnergy, freeEnergy, runwayDays,
  why: { leads: [str], funnel: [str], money: [str] } }   // human-readable formula lines with real numbers
```

**Events** (UI turns these into pops/toasts/modals)
```js
{ type: 'lead'|'reply'|'call'|'sale'|'trial'|'testimonial'|'refund'|'churn'|'levelUp'|'card'|
        'notebook'|'coach'|'event'|'achievement'|'gameOver'|'burnout'|'graduated'|'info',
  text, amount?, id?, level? }
```

### Simulation model (engine owns the numbers; tune with `tools/balance-sim.js`)
- **Value-o-Meter:** `offerScore = (dream × likelihood) / ((11 − speed) × (11 − ease))`, then a
  smooth mapping to perceived value: `offerValue = marketValue × f(offerScore) × mods.perceivedValue`
  plus proof bonus from testimonials/case studies, guarantee bonus.
- **Close rate** depends on `offerValue / price` (a saturating curve), Close Kit skill, proof, buffs.
  Realistic band 10–45%. Raising price without raising value lowers close rate; discounting raises
  it a bit but cuts margin (and attracts worse customers → more refunds/churn).
- **Funnel per day:** outreach actions → replies (warm/cold reply rates; warm contacts are finite and
  refill slowly) → leads; content posts → audience growth + leads that decay over ~14 days; ads:
  `leads = budget / cpl`. Leads → booked calls (`bookRate`) → shows (`showRate`) → closes.
  Each held call costs 5 Energy; calls are limited by energy given to `sales` in the plan.
  Unworked leads decay.
- **Delivery:** each trial/active customer costs `deliveryEnergyPerCustomer × mods.deliveryEnergy`
  Energy per day for `deliveryDays` (trials: `trialDays`), taken first from the day's energy.
- **Cash Combos:** Hook Offer raises book rate and front-end cash (and lowers effective CAC);
  Upsell adds `takeRate × price` per sale; Downsell recovers a share of no's at a lower price;
  Membership adds monthly revenue with monthly churn.
- **LTV / CAC:** LTV = front-end + upsell + membership/churn; CAC = (ad spend + tools) / new
  customers over last 30 days. `cash30PerCustomer` = average cash collected in a customer's first
  30 days.
- **Constraint focus:** upgrades whose category doesn't match the current level's constraint still
  work but the coach nudges the player toward the bottleneck.
- **Ghost timeline:** `ghostCompare` averages `TUNING.ghostRuns` (20) Autopilot runs per option with
  common random numbers (same luck per day and per phase for every option), so the gap shows the decision.
- Targets for a "smart" bot (see §8): L1 ≈ day 8–18, L2 ≈ day 28–55, L3 (graduation) ≈ day 45–100 (v0.1 keeps runs short: roughly 10 minutes at 1×). A naive bot
  (discounts, ignores offer, picks 'trap' options) should be clearly slower and may go broke in L3.
  An idle bot (never touches anything) should stall at L2.

---

## 7. UI

Five bottom tabs: **Hustle** (home), **Offer**, **Growth**, **Numbers**, **Notebook**.

- **Top bar:** Day, level badge (emoji + name), Cash (animated count-up, green/red), Energy bar,
  speed controls (⏸ 1× 2× 4×), sound toggle.
- **Goal strip:** current level goal with progress bar; Coach Flex owl avatar (inline SVG) whose
  speech bubble shows coach lines / tips. Tap the owl for a contextual hint.
- **Hustle tab:** giant chunky "Reach out!" button with channel switch (Friends / Cold Calls);
  combo counter + streak flame; floating "+1 lead" / "+$500" pops; animated funnel (Leads → Calls
  → Customers) with today's numbers; Daily Grind meter (energy used today /100); "Why?" button that
  opens the formula breakdown (`metrics.why`); Overtime button; recent activity feed.
- **Offer tab (Offer Forge):** four Value-o-Meter gauges, perceived value vs price bar, price slider
  (locked in L1 with a padlock explanation), projected close rate, guarantee status, offer upgrades
  as collectible cards.
- **Growth tab:** Four Megaphones cards (warm/cold/content/ads; locked ones show unlock level),
  Autopilot plan sliders, Post Content button, ad budget slider, Cash Combos toggles (L3), Skill
  Scrolls + nurture upgrades, Lead Squad locked teaser.
- **Numbers tab:** revenue / cash line chart (canvas or SVG, last 60–120 days), KPI tiles (revenue30,
  close rate, CPL, LTV, CAC, LTV:CAC, 30-day cash per customer, runway), funnel table, the 10-level
  path map (1–3 active, 4–10 locked).
- **Notebook tab:** grid of lesson cards (locked silhouettes for not-yet-unlocked), tap to read +
  quiz; progress "x / 28 lessons".
- **Modals:** choice card (big emoji, title, text, 2–3 option buttons) → after choosing, a result
  screen with outcome + lesson + **ghost timeline** chart (your choice vs the other options, cash
  over `ghostDays`) + "Got it"; level-up celebration (confetti + coach); game over with Rewind list
  and Restart; flavor picker on first start; "Why?" breakdown; settings (reset save).
- **Juice:** confetti on sales/level-up/achievements, coin sound on sale, soft pop on tap, haptic
  `navigator.vibrate(10)` where available, number tweening, button squash on press, streak flame.
- **Game loop:** `requestAnimationFrame` accumulator; call `Engine.tick` once per day
  (6000 ms / speed). Pause while any modal is open or a card is pending.
- **Save:** `localStorage['zte-save-v1']` every tick + on visibility change. On load, offline
  progress: simulate up to 5 missed days (stop early if a card triggers), then show "While you were
  away…" summary.
- **Style:** bright cartoony, chunky rounded cards with thick bottom borders/shadows, Google Font
  "Fredoka" (fallback `system-ui`), palette defined as CSS variables (cash green, energy yellow,
  primary purple, danger coral, sky background). Light theme only for v0.1.

---

## 8. Tools

- `node game/tools/balance-sim.js` — loads content + engine; runs bots `smart`, `naive`, `idle`
  (× 5 seeds each, all three flavors) for up to 200 days; prints days-to-each-level, cash at
  graduation, game-overs, and a short verdict vs the §6 targets. Bots choose card options by
  `quality` (smart → best, naive → trap, idle → first option) and buy upgrades greedily (smart:
  prioritise the current level's constraint; naive: random affordable). Smart starts at the flavor's
  suggested price and steps it weekly (max +15% / −10%) toward the best price for the offer's current
  value; it turns Cash Combos on in L3, tests ads small and keeps/scales them (+20%/week) only while
  LTV:CAC > 1. Naive prices 30% under suggested and never raises it, and runs ads at the cap. The module
  also exports its bots (`require('./balance-sim.js')`) for other tools. (Since the late game: runs go
  on to Level 10 and the sale, 600 days; the Levels 1–3 table and verdicts still use the first 200
  days. Late-game bots and report: SPEC-LATE §8–§9.)
- `node game/tools/card-check.js` — for every card × flavor, plays the smart bot until the card's
  trigger fires (up to 3 states from different seeds; falls back to a forced card at its level), runs
  `ghostCompare` and prints each option's cash and 30-day revenue at the end of `ghostDays`. Exit code 1
  if a card's 'best' option does not finish with the most cash (averaged over its states). Level 4+
  cards: SPEC-LATE §8.
- `node game/tools/validate-content.js` — checks: unique ids; every `notebook` reference is in the
  fixed list and defined; every effect path is in §5.3; every `mods`/buff stat exists; every
  `requires` id exists; each level 1–3 has a goal; cards have 2–3 options with exactly one 'best';
  no banned words from §0.1 anywhere in the project (case-insensitive, except the sales-framework
  acronym, which is matched in ALL CAPS only so the plain English word may appear in code ids such as
  the team role id; player-visible role names must never use that word — call the role "Sales Rep").
  SPEC-LATE §8 extends it to the late game. Exit code 1 on failure.
  It also checks: §2 glossary / §1 level / channel / combo names unchanged; notebook.js has exactly
  the 28 ids and every lesson has something that unlocks it; effect fields per op (and the real
  engine applies every effect list without warnings); goal item paths resolve on a fresh
  `createState` (or are `computeMetrics` keys); conds use only §5.1 forms with resolvable,
  correctly typed paths (`chance` only in card triggers / event conds) and read only flags that
  something sets; quiz answers in range; ids the engine hard-codes exist in content. The banned-word
  scan covers every project file (code, comments, HTML, CSS, tools, docs); only this spec's own rule
  lists, wrapped in `<!-- banned-words-allowed:start/end -->`, are exempt. When the §10 source texts
  exist, any 8-word run copied from them into game text fails too.

---

## 9. Done means
- Opening `index.html` from disk plays the game start-to-finish through L3 with no console errors.
- `node game/tools/validate-content.js` passes; `node game/tools/balance-sim.js` meets targets.
- Text is friendly, short, and written in our own words.

## 10. Source material (for grounding numbers and principles)
The principles were grounded in a private library of business books and course notes, extracted
to plain text (one `.txt` per document). That library is not part of this repository. To run the
validator's copy check against it, point the tool at the folder:
`node tools/validate-content.js --sources <folder-of-txt-files>`.
Never copy sentences from the sources into game text.
