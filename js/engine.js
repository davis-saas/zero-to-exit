/* Zero to Exit — pure simulation engine (no DOM). See docs/SPEC.md §4–§6.
 * Loads in the browser (classic script) and in Node (require). */
/* SPEC-GAP decisions (simplest option consistent with the spec):
 * - At L2+ with price $0, closes still become free trials (no revenue). Price is never auto-set
 *   by the engine (the idle bot therefore stalls at L2), except inside forward/ghost sims.
 * - Leads are one pool with a running quality score (_leadQ); colder sources book less often.
 * - Held calls are paid from the sales share of the plan, taken from the day's whole free energy
 *   (state._dayFree), so taps and posts cannot starve calls; unused sales energy spills into outreach.
 *   Friend messages with no friend left go to Cold Calls once unlocked (wasted in L1).
 * - Cards: one pending at a time, highest priority first (ties: lower card.level first), only
 *   when state.level >= card.level. tick() keeps working while a card is pending. Triggered cards
 *   wait in state._cardQueue (checked before the level-up, so a level-up cannot wipe out a card) and
 *   open only from day 2, never on a level-up day, and at least TUNING.cardGapDays apart.
 * - Membership billed daily (price / 30 per member); members cost a little delivery energy.
 * - Combos default-unlock at TUNING.comboUnlockLevel unless content.combos[id].unlockLevel says
 *   otherwise; channels use content.channels[id].unlockLevel (fallback warm1/cold2/content3/ads3).
 * - Client-financed check needs TUNING.cfMinAdDays days of real ad spend (>= cfAdDayShare of the
 *   starting cap), cfMinAdSpend in 30 days, cfMinCustomers new customers, and 30-day cash per customer
 *   >= paid CAC (ad spend ÷ customers attributed to ad leads via the pool's _adShare). It sets
 *   flags.clientFinanced (content achievements/coach lines read it), lifts the ad cap and unlocks
 *   notebook 'client_financed'; it is re-checked daily and the cap returns after cfLoseDays failing days.
 * - metrics.ltvCac is null when there was no ad/tool spend in 30 days (numeric conds on null fail).
 *   Extras: metrics.adCac / adLtvCac / adCustomers30 measure ads alone.
 * - Refund chance is fixed at sale time (stored on the cohort); only the delivery overload is live.
 * - Ghost timelines average TUNING.ghostRuns seeded runs per option (same seeds for every option).
 * - Level 4 = graduated: no onEnter applied for locked levels; getGoal returns 'Coming soon'.
 * - Entering Level 2 turns happy trial users (one per testimonial, TUNING.trialFanLeads) into warm leads.
 * - Ghost timelines use common random numbers: forward sims re-seed the RNG per day and per phase of the
 *   day, so options differ by their effects, not by one lucky sale (simulateForward's optional 4th arg).
 * - Upgrades locked by a simple count cond (sales, sales calls, testimonials...) explain what they need.
 * Late game (docs/SPEC-LATE.md, Levels 4–10):
 * - A level whose def is missing or `locked: true` still graduates the run (v0.1 behaviour). An
 *   unlocked level 4–10 without goal items falls back to the SPEC-LATE §1 goals (FALLBACK_GOALS).
 *   Old saves that graduated at "Level 4 coming soon" resume at their level once it is unlocked.
 * - Level 10 never auto-levels: a one-time 'info' event (id 'summit_ready') fires when its goal is met;
 *   tick() stops once state.exit.sold is true (sellCompany lives in engine-late).
 * - Profit = revenue − payroll − ads − tools − living − squad costs (agency retainer, fan rewards,
 *   partner commissions, partner recruiting). One-off investments (hire fees, premium build, and
 *   api.spend tags 'project' | 'dept' | 'bet') are tracked as `invest` and are not in profit/cost30.
 * - Core charges staff payroll only. Specialist salaries (content.departments specSalary × spec) are
 *   charged by engine-late through api.spend(state, x, 'payroll'); core still counts specialists in
 *   metrics.headcount / specialistHeadcount / specialistPayroll / payrollDaily (api.specialistInfo).
 * - Sales reps take calls first, the founder fills the rest (so founderSalesShare falls as you hire).
 * - Playbooks: sops.delivery +5% coach output per rank, sops.marketing +5% setter output per rank,
 *   sops.sales sales-rep close-rate factor, sops.hiring faster ramp and +1 manager span per rank.
 * - Systems can also set state._sysMods.leadVolume (multiplies every lead source, like focus does).
 * - Ad cap after client-financed acquisition is $5,000/day in Level 3 (v0.1 balance) and $60,000/day
 *   from Level 4 (adSaturationLate keeps the same budget curve as Levels 1–3).
 * - Integration balance pass (late game): setters' cold messages saturate (setterSaturation), recruiting
 *   is capped per week (hireWeekBase/Pct/Sop → metrics.hireCap/hiresLeft), stacked team-output,
 *   delivery-energy and premium-take boosts are capped (teamOutputMax, deliveryEnergyMin, premiumTakeMax),
 *   and flavors may set payScale (salary and hiring fee multiplier).
 * - Agency retainer saturates like ads but more gently (agencySaturation); partner commission (extra
 *   setSquad key 'partnersCommission') scales leads per partner by √(commission ÷ 0.2); the fan
 *   reward (extra key 'fansReward') scales the referral boost (×2 at the default $50 reward).
 * - Premium finishes on sale (on = true) at 4× the core price. Premium buyers are existing customers:
 *   their delivery cohorts (kind 'premium') cost energy but do not count as new or active customers.
 * - Big funnels (Level 4+, sales reps on staff or > TUNING.aggLeadMin leads waiting) use aggregate
 *   binomial maths; Levels 1–3 keep the exact per-lead loop (same RNG stream as v0.1).
 * - Ghost timelines from Level 4 run TUNING.ghostRunsLate runs per option, interleaved across options, and stop
 *   early (never below TUNING.ghostMinRuns) when the next round would exceed the TUNING.ghostBudgetMs budget. */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});

  // ---------------------------------------------------------------------------
  // TUNING — every number the simulation uses. Benchmarks come from the source
  // texts (warm ~1 in 5 engage, cold ~3% engaged, 50% schedule / 50% show as a
  // starting baseline, ~25% close, refunds ~5% rising to ~10% with a strong
  // guarantee, 5–15% monthly churn, ~1 in 5 upsell take).
  // ---------------------------------------------------------------------------
  var TUNING = {
    // --- day / energy ---
    overtimeEnergy: 30,          // extra energy from one overtime push
    overtimeBurnout: 25,         // burnout added per overtime
    burnoutDecay: 6,             // burnout recovered per normal day
    overloadBurnout: 4,          // burnout added per day when delivery needs more energy than you have
    burnoutRestDays: 3,          // forced rest days at 100 burnout
    burnoutAfterRest: 40,        // burnout level after the forced rest
    autopilotEff: 0.8,           // Autopilot does 80% of what hands-on effort does
    callEnergy: 5,               // energy per held sales call
    postEnergy: 10,              // energy per content post
    minEnergyMax: 50,            // energy.max floor
    grindEnergy: 60,             // raw energy on lead actions in a day to count as a Daily Grind day
    // --- tapping ---
    comboStep: 0.02,             // +2% reply chance per combo step while tapping
    comboCap: 0.20,              // combo bonus capped at +20%
    // --- warm outreach ---
    warmReplyDefault: 0.15,      // fallback warm reply rate (source: roughly 1 in 5 friends engage)
    warmReplyMult: 1.0,          // global multiplier on flavor warmReplyBase
    networkRefill: 0.015,         // share of already-contacted friends that become messageable again per day
    networkRefillL1: 0.05,       // ...faster in Level 1 (Cold Calls is still locked, so friends are the only lead source)
    warmLevelBonus: 0.10,        // +10% warm reply per warm channel level
    warmReplyMax: 0.25,          // realistic ceiling for friends who reply with real interest (band 5–25%)
    // --- cold outreach ---
    coldReplyDefault: 0.03,      // fallback cold engaged-lead rate (source: about 3% of a list engages)
    coldReplyMult: 0.6,          // global multiplier on flavor coldReplyBase
    coldLevelBonus: 0.15,        // +15% cold reply per cold channel level
    coldReplyMax: 0.05,          // realistic ceiling for cold outreach that turns into a lead (band 1–5%)
    hooksReplyBonus: 0.08,       // +8% reply / reach per Hooks skill rank
    // --- content ---
    postBaseReach: 12,           // people a brand-new account reaches per post
    postAudienceReach: 3,        // extra reach = 3 × √followers (big audiences grow reach, but with diminishing returns)
    audienceDecay: 0.005,        // share of followers who drift away each day
    contentLevelBonus: 0.20,     // +20% reach per content channel level
    contentLeadRate: 0.003,      // leads per reached person on day 0 of a post
    contentDecayDays: 5,         // e-folding time of a post's lead flow
    contentLifeDays: 14,         // a post stops producing after this many days
    audiencePerReach: 0.08,      // followers gained per reached person
    // --- ads ---
    adCplDefault: 30,            // fallback cost per lead ($)
    adLevelBonus: 0.12,          // CPL divided by (1 + 0.12 × ads level)
    hooksCplBonus: 0.05,         // CPL −5% per Hooks rank
    adCapBeforeCF: 50,           // $/day ad cap until acquisition pays for itself in 30 days
    adSaturation: 150,           // bigger budgets reach pricier people: CPL × √(1 + budget ÷ 150)
    adCapAfterCF: 5000,          // $/day ad cap afterwards
    cfMinCustomers: 3,           // new customers in 30 days needed before the client-financed check counts
    cfMinAdDays: 10,             // days with real ad spend (last 30) needed before the client-financed check counts
    cfAdDayShare: 0.5,           // a day counts as an ad day only when spend >= 50% of adCapBeforeCF
    cfMinAdSpend: 300,           // ...and at least this much ad spend in the last 30 days
    cfLoseDays: 14,              // the cap comes back after this many days in a row of ads not paying back
    // --- lead quality (multiplies book rate) ---
    qWarm: 1.0, qReferral: 1.0, qCold: 0.8, qContent: 0.7, qAds: 0.35,
    leadDecay: 0.08,             // share of waiting leads that go cold each day
    nurtureDecayCut: 0.10,       // −10% decay per Nurture rank
    // --- funnel ---
    bookRate: 0.45,              // leads who book a call (source baseline ~50%; realistic band 30–70%; room left for Nurture gear)
    showRate: 0.60,              // booked calls that show up (source: ~50% unnurtured, good teams 75%+)
    nurtureBook: 0.05,           // +5% book rate per Nurture rank
    nurtureShow: 0.07,           // +7% show rate per Nurture rank
    noShowRecover: 0.25,         // share of no-shows that drop back into the lead pool
    freeBookBonus: 1.35,         // free trials are an easy yes to book
    freeShowBonus: 1.35,         // ...and to show up for
    trialNetworkGain: 2,         // each new trial introduces you to ~2 new people you can message
    trialReferralRate: 0.06,     // referral leads per active trial user per day (happy friends talk)
    trialClose: 0.55,            // base chance a shown lead accepts a free trial
    trialFanLeads: 1.0,          // warm leads per happy trial user (testimonial) when Level 2 opens
    // --- value-o-meter / close curve ---
    valueExponent: 0.30,         // offer part of value = offerScore^0.3 (smooth, diminishing returns)
    boostStack: 0.4,             // proof × guarantee × bonuses stack at reduced strength: boost = 1 + (product − 1) × 0.4
    bookMax: 0.70, showMax: 0.80, // best-case booking and show-up rates (realistic bands: book 30–70%, show 50–80%)
    marketValueDefault: 1500,    // fallback perceived value at an average offer
    proofPerTestimonial: 0.03,   // +3% perceived value per testimonial
    proofTestimonialCap: 0.25,   // ...capped at +25%
    proofPerCaseStudy: 0.05,     // +5% per case study
    proofCaseStudyCap: 0.15,     // ...capped at +15%
    proofSkillBonus: 0.10,       // proof bonus × (1 + 0.10 × Proof rank)
    guaranteeValue: { none: 0, conditional: 0.12, unconditional: 0.25 }, // perceived value boost
    closeLo: 0.0,                // close rate floor of the curve (0 so that endlessly raising price stops paying off)
    closeHi: 0.50,               // close rate ceiling of the curve (very underpriced)
    closeMid: 4.0,               // value ÷ price ratio at the middle of the curve (best revenue lands near value ≈ 3× price)
    closeSteep: 1.6,             // steepness of the curve in log space
    closingSkill: 0.07,          // +7% close rate per Close Kit rank
    pricingSkillShift: 0.06,     // each Pricing rank lets you hold the same close rate at a ~6% higher price
    closeMin: 0.01, closeMax: 0.45, // hard clamp (realistic band ~10–45%; above ~50% means the price is too low)
    maxPrice: 50000,
    // --- refunds ---
    refundBase: { none: 0.03, conditional: 0.05, unconditional: 0.10 }, // source: ~5% → ~10% with a strong guarantee
    refundWindow: 7,             // days after a sale when a refund can happen
    cheapRatio: 0.6,             // price below 60% of the suggested price attracts weaker buyers
    cheapRefundMult: 1.5, cheapChurnMult: 1.3,
    oversoldRefundMult: 1.5,     // when value ÷ price < 1
    overloadMult: 1.5,           // refund/churn multiplier when you cannot keep up with delivery
    retentionRefundCut: 0.06,    // −6% refunds per Retention rank
    refundMax: 0.40,
    // --- delivery & testimonials ---
    deliveryEnergyDefault: 1.0,
    deliveryDaysDefault: 42,
    trialDaysDefault: 14,
    memberEnergy: 0.15,          // energy per member per day
    downsellEnergy: 0.5,         // downsell customers need half the delivery
    testimonialBase: 0.55,       // chance a finished trial gives a testimonial
    testimonialLikelihood: 0.04, // +4% per likelihood dial point above 3
    testimonialEase: 0.03,       // +3% per ease dial point above 3
    testimonialProof: 0.06,      // +6% per Proof rank
    paidTestimonialMult: 0.5,    // paying customers are busier: half the chance
    caseStudyChance: 0.08,       // chance a finished paying customer becomes a case study
    overloadTestimonialMult: 0.6,
    // --- referrals ---
    referralRate: 0.006,         // leads per active customer/member per day
    referralProofBonus: 0.02,    // +2% referrals per testimonial (cap +40%)
    // --- cash combos ---
    hookTake: 0.20,              // booked leads who buy the small hook offer
    hookBookMult: 1.25,          // a cheap first step makes booking easier
    hookShowMult: 1.10,          // people who paid something show up more
    upsellTake: 0.20,            // source: about one in five takes a well-placed upsell
    downsellShare: 0.40,         // downsell price as share of the main price (when not set)
    downsellTake: 0.12,          // share of no's who take the downsell
    memberTake: 0.25,            // new customers who join the membership
    retentionMemberTake: 0.05,   // +5% membership take per Retention rank
    churnMonthly: 0.10,          // monthly membership churn (source range 5–15%)
    retentionChurnCut: 0.10,     // −10% churn per Retention rank
    churnMin: 0.02, churnMax: 0.5,
    comboUnlockLevel: 3,         // fallback level that unlocks Cash Combos
    // --- money / misc ---
    gameOverDays: 7,             // days below $0 in a row before game over
    gameOverDaysLate: 14,        // Level 4+: payroll swings are bigger, so the founder gets two weeks to fix a cash crunch
    gameOverDaysLateProfit: 28,  // ...and four weeks while the last 30 days were still profitable (a dip from one-off spending, not a broken business)
    creditLineDays: 10, creditLineMin: 2500,   // Level 4+: a business credit line of 10 days of average sales (at least $2,500): cash may dip
                                 // below $0 that far (ads keep running); the game-over countdown only runs below the line
    creditInterest: 0.0005,      // ...and the part in use costs 0.05% a day (about 18% a year)
    serveShareMax: 0.35,         // price advice (Level 4+): what serving a customer costs the team should stay under 35% of the price
    adShareMax: 0.15,            // ad advice (Level 4+): hold the budget at 15% of sales, trim it above 22%
    premiumCostDays: 3,          // Level 6 premium build: the listed cost or 3 days of average sales, whichever is more
    toolCategories: ['megaphone', 'nurture'], // upgrade categories counted as acquisition tools in CAC
    dailyKeep: 120, logKeep: 60, historyKeep: 10,
    ghostDaysDefault: 60,
    ghostRuns: 20,               // ghost timeline = average of this many seeded runs per option (less luck, clearer lesson; ~100 ms)
    eventCooldown: 10,           // days before a repeatable random event can fire again
    cardFirstDay: 2,             // no choice card before this day (the intro needs room to breathe)
    cardGapDays: 2,              // at least this many days between choice cards; never on a level-up day
    // --- late game (Levels 4–10) ---
    maxLevel: 10,
    adCapLate: 60000,            // $/day ad cap after client-financed acquisition from Level 4
    marketDepth: 0,              // Level 4+: ad/cold cost per lead × √(1 + customers won since Level 4 ÷ this); 0 = off
    setterSaturation: 400,       // setters' cold messages per day where the reply rate has dropped to 1/√2 (a list only has so many good prospects)
    opexShare: 0.25,             // Level 4+: running costs (software, rent, card fees, contractors, insurance) = 25% of each day's sales
    adSaturationLate: 150,       // Level 4+: same budget curve as before (bigger budgets reach pricier people); ads stay worth it, not free money
    aggLeadMin: 60,              // above this many waiting leads (Level 4+) the funnel uses aggregate maths
    teamOutputMax: 1.25,         // stacked team-output boosts top out at ×1.25 (people are not machines)
    deliveryEnergyMin: 1.0,      // Level 4+: delivery-energy savings stacked before Level 4 bottom out at ×1.0 (a customer always needs real work)
    deliveryEnergyLateMin: 0.85, // Level 4+: savings added from Level 4 on can take that down to ×0.85, no further
    premiumTakeMax: 1.75,        // stacked premium-take boosts top out at ×1.75
    payGrowth: 0.2, payGrowthFrom: 8,   // staff salaries × (1 + 0.2 per doubling of staff above 8): ×1.4 at 32 staff, ×1.8 at 128
    hireWindow: 14, hireWeekBase: 0.7, hireWeekPct: 0.2, hireWeekSop: 0.5, // recruiting: hires per 14 days = 0.7 + 20% of headcount + 0.5 per Hiring Playbook rank (rounded down, at least 1)
    founderSpan: 4,              // people the founder can manage directly
    unmanagedOutput: 0.6,        // staff beyond everyone's span work at 60%
    rampStart: 0.4,              // a new hire starts at 40% output...
    rampDays: 21,                // ...and reaches 100% after this many days (÷ hireRamp)
    rampSopCut: 0.15,            // −15% ramp time per hiring Playbook rank
    moraleBase: 80, moraleDrift: 0.05, moraleOverload: 2, moraleBurnout: 1, moraleBroke: 2,
    moraleUnmanaged: 1.5, moraleFire: 5,
    crunchDays: 45, crunchSteps: 14, crunchMinGain: 300, crunchBudgetMs: 1500,   // cash-crunch planner: sim horizon, max greedy cuts, smallest gain worth a cut, time cap
    closerBase: 0.85, closerSop: 0.05,   // sales reps close at close rate × (0.85 + 0.05 × sales Playbook rank)
    sopDeliveryBonus: 0.05, sopMarketingBonus: 0.05,   // +5% coach / setter output per Playbook rank
    fanReferralMult: 2, fanRewardDefault: 50,
    agencyCplMult: 1.4, agencyQuality: 0.5, agencySaturation: 2000,
    partnerLeads: 0.4, partnerQuality: 0.8, partnerCost: 500, partnerEnergy: 10, partnerCommission: 0.2,
    squadFansLevel: 4, squadAgencyLevel: 6, squadPartnersLevel: 6,
    focusUnlockLevel: 5,
    focusLeadCut: 0.45, focusClose: 0.2, focusValue: 0.15, focusChurnCut: 0.35, focusRefundCut: 0.3, focusDeliveryCut: 0.2,
    premiumUnlockLevel: 6, premiumBuildCost: 15000, premiumBuildDays: 21, premiumPriceMult: 4,
    premiumFinisherTake: 0.06,   // share of customers finishing delivery who buy the premium product
    premiumActiveTake: 0.0012,    // share of active customers who buy it on any given day
    premiumValueMult: 3,         // premium perceived value = 3 × core perceived value
    premiumRefRatio: 2.25,       // premium value ÷ price where the take rates apply as written (fit 1 = the default 4× price on a core offer priced at value ÷ 3)
    premiumEnergy: 1.5, premiumFocusBonus: 0.5,
    ghostRunsLate: 10,           // ghost runs per option from Level 4 (days are heavier)
    ghostBudgetMs: 350,          // ...and fewer when the rounds so far show this budget would be exceeded ...
    ghostMinRuns: 3              // ... but never fewer than this many runs per option
  };

  // Default roles (content.roles overrides any field). capacity: coach = delivery energy/day,
  // sales rep (id 'closer') = sales calls/day, setter = outreach actions/day, manager = span of control.
  var DEFAULT_ROLES = [
    { id: 'coach', name: 'Coach', emoji: '🧑‍🏫', unlockLevel: 4, salary: 156, hireCost: 1500, capacity: 35 },
    { id: 'closer', name: 'Sales Rep', emoji: '🤝', unlockLevel: 4, salary: 192, hireCost: 2000, capacity: 6 },
    { id: 'setter', name: 'Setter', emoji: '📞', unlockLevel: 4, salary: 108, hireCost: 1000, capacity: 80 },
    { id: 'manager', name: 'Manager', emoji: '📋', unlockLevel: 5, salary: 264, hireCost: 3000, capacity: 6 }
  ];
  var ROLE_IDS = ['coach', 'closer', 'setter', 'manager'];
  var DEPT_IDS = ['marketing', 'sales', 'delivery', 'people', 'finance', 'tech'];
  // SPEC-LATE §1 goals, used only when an unlocked level 4–10 has no goal items in content
  var FALLBACK_GOALS = {
    4: { text: 'Build a crew so the work stops depending on you', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 3 },
      { label: 'Your share of delivery', path: 'metrics.founderDeliveryShare', target: 0.4, lte: true },
      { label: '30-day sales', path: 'metrics.revenue30', target: 30000, targetByFlavor: { agency: 45000 } }] },
    5: { text: 'Pick your people and make real profit', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 5 },
      { label: 'Niche focus', path: 'focus', target: 60 },
      { label: 'Profit margin', path: 'metrics.profitMargin30', target: 0.15 },
      { label: '30-day sales', path: 'metrics.revenue30', target: 60000, targetByFlavor: { agency: 90000 } }] },
    6: { text: 'Sell more to the customers you already have', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 10 },
      { label: 'Premium share', path: 'metrics.premiumShare30', target: 0.2 },
      { label: '30-day sales', path: 'metrics.revenue30', target: 120000, targetByFlavor: { agency: 180000 } }] },
    7: { text: 'Get better, not just bigger', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 20 },
      { label: 'Efficiency', path: 'metrics.efficiency', target: 75 },
      { label: 'Profit margin', path: 'metrics.profitMargin30', target: 0.2 },
      { label: '30-day sales', path: 'metrics.revenue30', target: 250000, targetByFlavor: { agency: 350000 } }] },
    8: { text: 'Keep every department healthy and the fires small', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 50 },
      { label: 'Weakest department', path: 'metrics.deptHealthMin', target: 60 },
      { label: 'Calm days', path: 'metrics.calmDays', target: 14 },
      { label: '30-day sales', path: 'metrics.revenue30', target: 500000, targetByFlavor: { agency: 650000 } }] },
    9: { text: 'Build teams of specialists', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 100 },
      { label: 'Specialist departments', path: 'metrics.specialistDepts', target: 4 },
      { label: '30-day sales', path: 'metrics.revenue30', target: 1000000, targetByFlavor: { agency: 1300000 } }] },
    10: { text: 'Place your big bet and get ready for The Summit', items: [
      { label: 'Team size', path: 'metrics.headcount', target: 250 },
      { label: 'Big Bet placed', path: 'metrics.betDone', target: 1 },
      { label: 'Valuation', path: 'metrics.valuation', target: 50000000 }] }
  };

  var MOD_KEYS = ['warmReply', 'coldReply', 'contentReach', 'adCpl', 'bookRate', 'showRate',
    'closeRate', 'churn', 'refundRate', 'upsellTake', 'downsellTake', 'testimonialChance',
    'deliveryEnergy', 'referralRate', 'perceivedValue', 'leadDecay',
    'teamOutput', 'salaryCost', 'premiumTake', 'hireRamp'];
  var CHANNEL_IDS = ['warm', 'cold', 'content', 'ads'];
  var COMBO_IDS = ['hook', 'upsell', 'downsell', 'membership'];
  var SKILL_IDS = ['closing', 'hooks', 'pricing', 'proof', 'nurture', 'retention'];
  var DIALS = ['dream', 'likelihood', 'speed', 'ease'];
  var GUARANTEES = ['none', 'conditional', 'unconditional'];
  var DEFAULT_CHANNEL_LEVEL = { warm: 1, cold: 2, content: 3, ads: 3 };

  var ALLOWED_PATHS = ['cash', 'livingCost', 'energy.max', 'burnout', 'network.size',
    'network.available', 'audience', 'reputation.testimonials', 'reputation.caseStudies', 'leads',
    'offer.dream', 'offer.likelihood', 'offer.speed', 'offer.ease', 'offer.price',
    'offer.guarantee', 'offer.name', 'skills.closing', 'skills.hooks', 'skills.pricing',
    'skills.proof', 'skills.nurture', 'skills.retention',
    'focus', 'team.morale', 'ops.efficiency', 'sops.delivery', 'sops.sales', 'sops.marketing',
    'sops.hiring', 'squad.partners.count', 'attention.max', 'premium.price', 'calmDays'];
  var ALLOWED_RE = [/^combos\.(hook|upsell|downsell|membership)\.price$/,
    /^channels\.(warm|cold|content|ads)\.level$/,
    /^depts\.(marketing|sales|delivery|people|finance|tech)\.health$/];

  function isAllowedPath(p) {
    if (ALLOWED_PATHS.indexOf(p) >= 0) return true;
    for (var i = 0; i < ALLOWED_RE.length; i++) if (ALLOWED_RE[i].test(p)) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // small utils
  // ---------------------------------------------------------------------------
  function warn(msg) { if (typeof console !== 'undefined' && console.warn) console.warn('[ZTE.Engine] ' + msg); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : d; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(num(x, 0) * 100) / 100; }
  function pct(x) { var v = x * 100; return (v < 10 ? round1(v) : Math.round(v)) + '%'; }
  function money(x) {
    var neg = x < 0; x = Math.abs(Math.round(x));
    var s = String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s;
  }
  function plural(word, n) { return n === 1 ? word : (/(s|sh|ch|x)$/i.test(word) ? word + 'es' : word + 's'); }
  function fmt(x) { return Math.abs(x) >= 100 ? String(Math.round(x)) : String(round1(x)); }

  function getPath(obj, path) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(obj, path, val) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }

  // mulberry32 — state.rng holds the 32-bit state
  function rand(state) {
    state.rng = ((state.rng >>> 0) + 0x6D2B79F5) >>> 0;
    var t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function chance(state, p) { return rand(state) < p; }
  function stochRound(state, x) {
    if (!(x > 0)) return 0;
    var f = Math.floor(x);
    return f + (rand(state) < (x - f) ? 1 : 0);
  }
  function binom(state, n, p) {
    n = Math.floor(n); if (n <= 0 || !(p > 0)) return 0; if (p >= 1) return n;
    if (n <= 40) { var k = 0; for (var i = 0; i < n; i++) if (rand(state) < p) k++; return k; }
    var u1 = Math.max(1e-12, rand(state)), u2 = rand(state);
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return clamp(Math.round(n * p + z * Math.sqrt(n * p * (1 - p))), 0, n);
  }

  // ---------------------------------------------------------------------------
  // content helpers (defensive: content is written in parallel by others)
  // ---------------------------------------------------------------------------
  function C(content) { return content || (ZTE.Content || {}); }
  function getFlavor(state, content) {
    var fl = arr(C(content).flavors), id = state && state.flavor;
    for (var i = 0; i < fl.length; i++) if (fl[i] && fl[i].id === id) return fl[i];
    return fl[0] || {};
  }
  function fv(state, content, key, dflt) { return num(getFlavor(state, content)[key], dflt); }
  function getLevelDef(content, level) {
    var lv = arr(C(content).levels);
    for (var i = 0; i < lv.length; i++) if (lv[i] && lv[i].id === level) return lv[i];
    return null;
  }
  function levelPlayable(content, level) {
    var d = getLevelDef(content, level);
    return !!(d && !d.locked && level <= TUNING.maxLevel);
  }
  function findById(list, id) {
    list = arr(list);
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function nbTerm(content, id) {
    var e = findById(C(content).notebook, id);
    return e ? (e.term || e.title || id) : id;
  }

  // effective modifier: permanent mod × active buffs × today's system multiplier (state._sysMods)
  function m(state, stat) {
    var v = num(state.mods && state.mods[stat], 1);
    var b = arr(state.buffs);
    for (var i = 0; i < b.length; i++) if (b[i] && b[i].stat === stat) v *= num(b[i].mult, 1);
    var sm = state._sysMods;
    if (sm && typeof sm[stat] === 'number' && isFinite(sm[stat])) v *= sm[stat];
    return v;
  }
  // niche focus 0..1 (0 until the player sets it in Level 5+)
  function focusF(state) { return clamp(num(state.focus, 0), 0, 100) / 100; }
  // multiplier on every lead source: focus narrows the market; systems may shrink it (saturation)
  function leadVol(state) {
    var v = 1 - TUNING.focusLeadCut * focusF(state);
    var sm = state._sysMods;
    if (sm && typeof sm.leadVolume === 'number' && isFinite(sm.leadVolume)) v *= Math.max(0, sm.leadVolume);
    return v;
  }

  // ---------------------------------------------------------------------------
  // state creation
  // ---------------------------------------------------------------------------
  function defaultState() {
    return {
      version: 1, seed: 12345, rng: 12345, flavor: 'fitness', day: 1, level: 1, speed: 1,
      cash: 3000, livingCost: 40,
      energy: { max: 100, current: 100, overtimeToday: false },
      burnout: 0,
      network: { size: 120, available: 120 },
      audience: 0,
      reputation: { testimonials: 0, caseStudies: 0 },
      leads: 0,
      offer: { dream: 4, likelihood: 3, speed: 3, ease: 3, price: 0, guarantee: 'none', name: 'My Offer' },
      combos: {
        hook: { unlocked: false, on: false, price: 47 },
        upsell: { unlocked: false, on: false, price: 300 },
        downsell: { unlocked: false, on: false, price: 0 },
        membership: { unlocked: false, on: false, price: 99 }
      },
      channels: {
        warm: { unlocked: true, level: 0 },
        cold: { unlocked: false, level: 0 },
        content: { unlocked: false, level: 0, posts: [] },
        ads: { unlocked: false, level: 0, dailyBudget: 0 }
      },
      plan: { warm: 60, cold: 0, content: 0, sales: 40 },
      skills: { closing: 0, hooks: 0, pricing: 0, proof: 0, nurture: 0, retention: 0 },
      mods: (function () { var o = {}; MOD_KEYS.forEach(function (k) { o[k] = 1; }); return o; })(),
      buffs: [],
      customers: { trials: 0, active: 0, members: 0, total: 0 },
      stats: {
        trialsStarted: 0, trialsCompleted: 0, salesCount: 0, revenueTotal: 0, refunds: 0,
        adSpendTotal: 0, outreachTotal: 0, tapsTotal: 0, callsTotal: 0, leadsTotal: 0, daily: []
      },
      upgrades: [], flags: {}, notebook: [], quizzes: {}, achievements: [],
      cardsSeen: [], pendingCard: null, history: [], coachSeen: [],
      streak: { grindDays: 0, saleDays: 0 }, log: [], gameOver: null, graduated: false,
      // late game (SPEC-LATE §2)
      team: { coach: 0, closer: 0, setter: 0, manager: 0, ramp: [], morale: 80, hires: [] },
      sops: { delivery: 0, sales: 0, marketing: 0, hiring: 0 },
      squad: { fans: { on: false, reward: 50 }, agency: { retainer: 0 }, partners: { count: 0, commission: 0.2 } },
      focus: 0,
      premium: { built: false, buildDays: 0, price: 0, on: false, name: '' },
      ops: { efficiency: 80, project: null, done: [] },
      depts: { marketing: { health: 80, spec: 0 }, sales: { health: 80, spec: 0 }, delivery: { health: 80, spec: 0 },
        people: { health: 80, spec: 0 }, finance: { health: 80, spec: 0 }, tech: { health: 80, spec: 0 } },
      fires: [],
      attention: { max: 3, left: 3 },
      calmDays: 0,
      bet: null,
      exit: { sold: false, valuation: 0, score: 0, wisdom: 0 },
      perks: [],
      _sysMods: {},
      // private
      _cohorts: [], _negCashDays: 0, _graceDays: 0, _leadQ: 1, _today: newToday(), _yesterday: newToday(),
      _deliveryNeed: 0, _overloaded: false, _restDays: 0, _eventsSeen: {}, _clientFinanced: false,
      _startEvents: [], _adShare: 0, _cfFailDays: 0, _cardQueue: [], _lastCardDay: -99, _memberWeek: 0,
      _srcShare: { ref: 0, partner: 0, agency: 0 }, _deliveryTotal: 0, _team: null, _sysInit: {},
      _summitReady: false
    };
  }
  function newToday() {
    return { leads: 0, sales: 0, revenue: 0, adSpend: 0, toolSpend: 0, outreach: 0, calls: 0,
      trials: 0, newCustomers: 0, refunds: 0, leadEnergy: 0, taps: 0, booked: 0, shows: 0, adCustomers: 0,
      payroll: 0, premiumRevenue: 0, premiumSales: 0, squadSpend: 0, invest: 0, founderCalls: 0, teamCalls: 0,
      finished: 0, opex: 0, loss: 0, interest: 0 };
  }

  // Deep-merge saved data over defaults (keeps old saves loadable).
  function fillDefaults(target, defs) {
    for (var k in defs) {
      if (!Object.prototype.hasOwnProperty.call(defs, k)) continue;
      if (target[k] === undefined || target[k] === null && defs[k] !== null) {
        target[k] = clone(defs[k] === undefined ? null : defs[k]);
      } else if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k]) &&
                 target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
        fillDefaults(target[k], defs[k]);
      }
    }
    return target;
  }

  function createState(content, opts) {
    content = C(content); opts = opts || {};
    var s = defaultState();
    var seed = opts.seed;
    if (typeof seed !== 'number' || !isFinite(seed)) seed = Math.floor(Math.random() * 4294967295);
    s.seed = seed >>> 0; s.rng = seed >>> 0;
    var flavors = arr(content.flavors);
    s.flavor = opts.flavor || (flavors[0] && flavors[0].id) || 'fitness';
    var fl = getFlavor(s, content), st = fl.start || {};
    s.cash = num(st.cash, 3000);
    s.livingCost = num(st.livingCost, 40);
    var ns = num(st.networkSize, 120);
    s.network.size = ns; s.network.available = ns;
    var d = st.dials || {};
    DIALS.forEach(function (k) { s.offer[k] = clamp(num(d[k], s.offer[k]), 1, 10); });
    if (fl.offerName) s.offer.name = String(fl.offerName);
    s.combos.downsell.price = 0;
    var evs = enterLevel(s, content, 1);
    // New Game+ perks: applied after Level 1 starts (SPEC-LATE §3.7)
    arr(opts.perks).forEach(function (id) {
      var pk = findById(content.perks, id);
      if (!pk || s.perks.indexOf(id) >= 0) return;
      s.perks.push(id);
      evs = evs.concat(applyEffects(s, content, pk.effects));
    });
    if (s.level < 2) s.offer.price = 0;
    startDay(s, content);
    s._startEvents = evs;
    return s;
  }

  // unlock fallbacks + onEnter effects for a level
  function enterLevel(state, content, level) {
    var events = [];
    if (level >= 4 && !(num(state._l4Customers, -1) >= 0)) state._l4Customers = num(state.customers && state.customers.total, 0);
    if (level >= 4 && !(num(state._l4Delivery, 0) > 0)) state._l4Delivery = l4Delivery(state);
    if (level >= 4 && !(num(state._l4Book, 0) > 0)) state._l4Book = l4Book(state);
    var chs = C(content).channels || {};
    CHANNEL_IDS.forEach(function (id) {
      var ul = num(chs[id] && chs[id].unlockLevel, DEFAULT_CHANNEL_LEVEL[id]);
      if (ul <= level) state.channels[id].unlocked = true;
    });
    var cbs = C(content).combos || {};
    COMBO_IDS.forEach(function (id) {
      var ul = num(cbs[id] && cbs[id].unlockLevel, TUNING.comboUnlockLevel);
      if (ul <= level) state.combos[id].unlocked = true;
    });
    var def = getLevelDef(content, level);
    if (def && !def.locked && Array.isArray(def.onEnter)) {
      events = events.concat(applyEffects(state, content, def.onEnter));
    }
    if (level === 1) state.offer.price = 0;
    // SPEC-GAP: L2's bottom line is "turn free fans into paying customers": trial users who loved it
    // (one per testimonial) become warm leads when paid offers open (they already trust you).
    if (level === 2 && TUNING.trialFanLeads > 0) {
      var fans = Math.round(Math.min(num(state.reputation.testimonials, 0), num(state.stats.trialsCompleted, 0)) * TUNING.trialFanLeads);
      if (fans > 0) {
        addLeads(state, fans, TUNING.qWarm);
        events.push({ type: 'lead', amount: fans, text: fans + ' free-trial fan' + (fans === 1 ? ' wants' : 's want') + ' to hear about the paid version!' });
      }
    }
    return events;
  }

  // ---------------------------------------------------------------------------
  // derived numbers
  // ---------------------------------------------------------------------------
  function offerScore(state) {
    var o = state.offer;
    return (o.dream * o.likelihood) / ((11 - o.speed) * (11 - o.ease));
  }
  function proofMult(state) {
    var t = Math.min(TUNING.proofTestimonialCap, num(state.reputation.testimonials, 0) * TUNING.proofPerTestimonial);
    var c = Math.min(TUNING.proofCaseStudyCap, num(state.reputation.caseStudies, 0) * TUNING.proofPerCaseStudy);
    return 1 + (t + c) * (1 + TUNING.proofSkillBonus * state.skills.proof);
  }
  function guaranteeMult(state) { return 1 + num(TUNING.guaranteeValue[state.offer.guarantee], 0); }
  function boostMult(state) {
    var raw = m(state, 'perceivedValue') * proofMult(state) * guaranteeMult(state);
    return Math.max(0.2, 1 + (raw - 1) * TUNING.boostStack);
  }
  function offerValue(state, content) {
    var mv = fv(state, content, 'marketValue', TUNING.marketValueDefault);
    return mv * Math.pow(Math.max(0.0001, offerScore(state)), TUNING.valueExponent) * boostMult(state) *
      (1 + TUNING.focusValue * focusF(state));
  }
  function isPaid(state) { return state.level >= 2 && state.offer.price > 0; }
  function curveClose(state, ratio) {
    var mid = TUNING.closeMid * Math.pow(1 - TUNING.pricingSkillShift, state.skills.pricing);
    var x = Math.log(Math.max(1e-6, ratio) / mid);
    return TUNING.closeLo + (TUNING.closeHi - TUNING.closeLo) / (1 + Math.exp(-TUNING.closeSteep * x));
  }
  function skillCloseMult(state) {
    return (1 + TUNING.closingSkill * state.skills.closing) * m(state, 'closeRate') * (1 + TUNING.focusClose * focusF(state));
  }
  function closeRateAt(state, content, price) {
    if (state.level < 2 || !(price > 0)) {
      return clamp(TUNING.trialClose * skillCloseMult(state), 0.1, 0.9);
    }
    return clamp(curveClose(state, offerValue(state, content) / price) * skillCloseMult(state),
      TUNING.closeMin, TUNING.closeMax);
  }
  function closeRate(state, content) { return closeRateAt(state, content, state.offer.price); }
  function hookOn(state) { return state.combos.hook.unlocked && state.combos.hook.on && isPaid(state); }
  function bookRateRaw(state) {
    var r = TUNING.bookRate * m(state, 'bookRate') * (1 + TUNING.nurtureBook * state.skills.nurture);
    if (!isPaid(state)) r *= TUNING.freeBookBonus;
    if (hookOn(state)) r *= TUNING.hookBookMult;
    return r;
  }
  function bookRate(state) { return clamp(bookRateRaw(state), 0.05, TUNING.bookMax); }
  // share of leads that book today: book rate × lead quality. Level 4+: booking gains stacked before Level 4 stop
  // at bookMax, but gains (and setbacks) added from Level 4 on multiply on top of that, so they still move colder
  // leads (ads, agency) instead of vanishing into the cap. _l4Book = the permanent multiplier when Level 4 began.
  function bookedRate(state) {
    var q = num(state._leadQ, 1), lateF = 1, base = num(state._l4Book, 0);
    if (isLate(state) && base > 0) lateF = Math.max(0.01, m(state, 'bookRate') / base);
    return clamp(clamp(bookRateRaw(state) / lateF, 0.05, TUNING.bookMax) * lateF * q, 0.02, TUNING.bookMax);
  }
  function showRate(state) {
    var r = TUNING.showRate * m(state, 'showRate') * (1 + TUNING.nurtureShow * state.skills.nurture);
    if (!isPaid(state)) r *= TUNING.freeShowBonus;
    if (hookOn(state)) r *= TUNING.hookShowMult;
    return clamp(r, 0.05, TUNING.showMax);
  }
  function warmReply(state, content) {
    var base = fv(state, content, 'warmReplyBase', TUNING.warmReplyDefault) * TUNING.warmReplyMult;
    return clamp(base * m(state, 'warmReply') * (1 + TUNING.hooksReplyBonus * state.skills.hooks) *
      (1 + TUNING.warmLevelBonus * state.channels.warm.level), 0, TUNING.warmReplyMax) * leadVol(state);
  }
  function coldReply(state, content) {
    var base = fv(state, content, 'coldReplyBase', TUNING.coldReplyDefault) * TUNING.coldReplyMult;
    return clamp(base * m(state, 'coldReply') * (1 + TUNING.hooksReplyBonus * state.skills.hooks) *
      (1 + TUNING.coldLevelBonus * state.channels.cold.level), 0, TUNING.coldReplyMax) * leadVol(state);
  }
  function postReach(state) {
    return (TUNING.postBaseReach + TUNING.postAudienceReach * Math.sqrt(Math.max(0, state.audience))) * m(state, 'contentReach') *
      (1 + TUNING.hooksReplyBonus * state.skills.hooks) * (1 + TUNING.contentLevelBonus * state.channels.content.level);
  }
  function adCpl(state, content) {
    var base = fv(state, content, 'adCplBase', TUNING.adCplDefault);
    var f = Math.pow(Math.max(0.0001, offerScore(state)), TUNING.valueExponent);
    var offerF = clamp(1 / Math.sqrt(f), 0.5, 1.5);   // a stronger offer makes ads cheaper per lead
    return Math.max(1, base * m(state, 'adCpl') * Math.max(0.3, 1 - TUNING.hooksCplBonus * state.skills.hooks) *
      offerF / (1 + TUNING.adLevelBonus * state.channels.ads.level)) * marketDepth(state);
  }
  // Level 4+: every customer you win comes from a little deeper in the market, so new ones cost more to reach:
  // ad and cold-outreach cost per lead × √(1 + customers won since Level 4 ÷ marketDepth)
  function marketDepth(state) {
    if (!isLate(state) || !(TUNING.marketDepth > 0)) return 1;
    var base = num(state._l4Customers, -1);
    if (!(base >= 0)) return 1;
    return Math.sqrt(1 + Math.max(0, num(state.customers.total, 0) - base) / TUNING.marketDepth);
  }
  // late-game economics apply from a playable Level 4 (a v0.1 "graduated" sandbox keeps the old numbers)
  function isLate(state) { return state.level >= 4 && !state.graduated; }
  function adSat(state) { return isLate(state) ? TUNING.adSaturationLate : TUNING.adSaturation; }
  function adCplAt(state, content, budget) {
    return adCpl(state, content) * Math.sqrt(1 + Math.max(0, budget) / adSat(state));
  }
  function adCap(state) {
    return state._clientFinanced ? (isLate(state) ? TUNING.adCapLate : TUNING.adCapAfterCF) : TUNING.adCapBeforeCF;
  }
  function cheap(state, content) {
    var sp = fv(state, content, 'suggestedPrice', 0);
    return isPaid(state) && sp > 0 && state.offer.price < TUNING.cheapRatio * sp;
  }
  // refund chance from the sale terms (guarantee, price vs value); stored on each cohort at sale time
  function saleRefundRate(state, content) {
    var r = num(TUNING.refundBase[state.offer.guarantee], 0.03) * m(state, 'refundRate') *
      (1 - TUNING.retentionRefundCut * state.skills.retention);
    if (cheap(state, content)) r *= TUNING.cheapRefundMult;
    if (offerValue(state, content) < state.offer.price) r *= TUNING.oversoldRefundMult;
    return r * (1 - TUNING.focusRefundCut * focusF(state));
  }
  // only the live delivery overload is applied on refund day
  function withOverload(state, r) { return clamp(r * (state._overloaded ? TUNING.overloadMult : 1), 0, TUNING.refundMax); }
  function refundRate(state, content) {
    if (!isPaid(state)) return 0;
    return withOverload(state, saleRefundRate(state, content));
  }
  function churnMonthly(state, content) {
    var r = TUNING.churnMonthly * m(state, 'churn') * Math.max(0.2, 1 - TUNING.retentionChurnCut * state.skills.retention);
    if (cheap(state, content)) r *= TUNING.cheapChurnMult;
    if (state._overloaded) r *= TUNING.overloadMult;
    r *= 1 - TUNING.focusChurnCut * focusF(state);
    return clamp(r, TUNING.churnMin, TUNING.churnMax);
  }
  function upsellTake(state) { return clamp(TUNING.upsellTake * m(state, 'upsellTake'), 0, 0.9); }
  function downsellTake(state) { return clamp(TUNING.downsellTake * m(state, 'downsellTake'), 0, 0.9); }
  function memberTake(state) { return clamp(TUNING.memberTake * (1 + TUNING.retentionMemberTake * state.skills.retention), 0, 0.9); }
  function downsellPrice(state) {
    var p = num(state.combos.downsell.price, 0);
    return p > 0 ? p : Math.round(state.offer.price * TUNING.downsellShare);
  }
  // late game: delivery savings stacked before Level 4 bottom out at deliveryEnergyMin (a customer always needs
  // real work); savings added from Level 4 on (projects, upgrades, cards, specialists) still count on top of that,
  // down to deliveryEnergyLateMin. _l4Delivery = the permanent multiplier when Level 4 began.
  function deliveryMod(state) {
    var d = m(state, 'deliveryEnergy');
    if (!isLate(state)) return d;
    var base = num(state._l4Delivery, 0);
    if (!(base > 0)) return Math.max(TUNING.deliveryEnergyMin, d);
    return Math.max(TUNING.deliveryEnergyLateMin, Math.max(TUNING.deliveryEnergyMin, base) * d / base);
  }
  function l4Delivery(state) { return Math.max(0.01, num(state.mods && state.mods.deliveryEnergy, 1)); }
  function l4Book(state) { return Math.max(0.01, num(state.mods && state.mods.bookRate, 1)); }
  function deliveryPer(state, content) {
    return fv(state, content, 'deliveryEnergyPerCustomer', TUNING.deliveryEnergyDefault) * deliveryMod(state) *
      (1 - TUNING.focusDeliveryCut * focusF(state));
  }
  function deliveryNeed(state, content) {
    var per = deliveryPer(state, content), need = 0, co = arr(state._cohorts);
    for (var i = 0; i < co.length; i++) need += co[i].n * per * num(co[i].e, 1);
    need += state.customers.members * TUNING.memberEnergy * deliveryMod(state);
    return need;
  }
  function recountCustomers(state) {
    var t = 0, a = 0, co = arr(state._cohorts);
    for (var i = 0; i < co.length; i++) { if (co[i].kind === 'trial') t += co[i].n; else if (co[i].kind !== 'premium') a += co[i].n; }
    state.customers.trials = t; state.customers.active = a;
  }

  // free energy = max (+ overtime) − delivery; overloaded when delivery needs more than that
  function energyTotal(state) { return state.energy.max + (state.energy.overtimeToday ? TUNING.overtimeEnergy : 0); }
  function freeEnergyFor(state, need) { return state._restDays > 0 ? 0 : Math.max(0, Math.floor(energyTotal(state) - need)); }
  // mid-day change (overtime, an upgrade that changes delivery): give or take only the change in free energy
  // coaches cover delivery before the founder; _deliveryNeed is the founder's part
  function founderNeedOf(state, total) {
    var td = num(state._team && state._team.delivery, 0);
    return td > 0 ? Math.max(0, total - td) : total;
  }
  function recomputeEnergy(state, content, prevFree) {
    var total = deliveryNeed(state, content), need = founderNeedOf(state, total);
    state._deliveryTotal = total; state._deliveryNeed = need;
    state._overloaded = need > energyTotal(state) + 1e-9;
    var d = freeEnergyFor(state, need) - prevFree;
    state.energy.current = Math.max(0, state.energy.current + d);
    state._dayFree = Math.max(0, num(state._dayFree, 0) + d);
  }
  // start-of-day
  function startDay(state, content) {
    recountCustomers(state);
    if (isLate(state) && !(num(state._l4Customers, -1) >= 0)) state._l4Customers = num(state.customers.total, 0);   // saves from before market depth
    if (isLate(state) && !(num(state._l4Delivery, 0) > 0)) state._l4Delivery = l4Delivery(state);
    if (isLate(state) && !(num(state._l4Book, 0) > 0)) state._l4Book = l4Book(state);
    recomputeSystems(state, content);   // resets state._sysMods, then every active system's recompute
    state._team = teamInfo(state, content);
    var total = deliveryNeed(state, content), need = founderNeedOf(state, total);
    state._deliveryTotal = total; state._deliveryNeed = need;
    state._overloaded = need > energyTotal(state) + 1e-9;
    state.energy.current = freeEnergyFor(state, need);
    state._dayFree = state.energy.current;   // the sales share of this is kept for Autopilot's calls
  }
  // energy the Autopilot plan keeps for sales calls today (taps and posts cannot dip into it)
  function salesReserve(state) {
    return Math.floor(num(state._dayFree, 0) * planShares(state).sales);
  }

  // ---------------------------------------------------------------------------
  // leads pool
  // ---------------------------------------------------------------------------
  // src (optional): 'ref' (referrals) | 'partner' | 'agency' — tracked so the Lead Squad can be paid per sale
  function addLeads(state, n, q, fromAds, src) {
    if (!(n > 0)) return;
    var L = Math.max(0, state.leads);
    state._leadQ = (L * num(state._leadQ, 1) + n * q) / (L + n);
    state._adShare = (L * num(state._adShare, 0) + (fromAds ? n : 0)) / (L + n);   // share of the pool that came from ads
    var ss = state._srcShare || (state._srcShare = { ref: 0, partner: 0, agency: 0 });
    for (var k in ss) if (Object.prototype.hasOwnProperty.call(ss, k)) ss[k] = (L * num(ss[k], 0) + (src === k ? n : 0)) / (L + n);
    state.leads = L + n;
    state.stats.leadsTotal += n;
    state._today.leads += n;
  }

  function outreachOne(state, content, channel, bonus) {
    // one outreach action; returns true if it produced a lead
    if (channel === 'warm') {
      if (state.network.available < 1) return false;
      state.network.available -= 1;
      if (chance(state, warmReply(state, content) * bonus)) { addLeads(state, 1, TUNING.qWarm); return true; }
      return false;
    }
    if (chance(state, coldReply(state, content) * bonus)) { addLeads(state, 1, TUNING.qCold); return true; }
    return false;
  }

  // ---------------------------------------------------------------------------
  // late game: team, specialists, systems hook (SPEC-LATE §3.1, §3.6)
  // ---------------------------------------------------------------------------
  // flavor (optional): uses roles[i].nameByFlavor for the job title
  // flavor pay scale (flavors[i].payScale, default 1): B2B pros cost more than gym coaches
  function payScaleOf(content, flavorId) {
    var f = flavorId ? findById(C(content).flavors, flavorId) : null;
    return Math.max(0.1, num(f && f.payScale, 1));
  }
  function roleDef(content, id, flavor) {
    var d = findById(DEFAULT_ROLES, id) || { id: id, name: id, emoji: '🙂', unlockLevel: 4, salary: 100, hireCost: 1000, capacity: 0 };
    var c = findById(C(content).roles, id) || {};
    var nf = flavor && c.nameByFlavor && c.nameByFlavor[flavor];
    var ps = payScaleOf(content, flavor);   // salary and hiring fee include the flavor's pay scale when a flavor is given
    return { id: id, name: nf || c.name || d.name, emoji: c.emoji || d.emoji, unlockLevel: num(c.unlockLevel, d.unlockLevel),
      salary: Math.round(Math.max(0, num(c.salary, d.salary)) * ps), hireCost: Math.round(Math.max(0, num(c.hireCost, d.hireCost)) * ps),
      capacity: Math.max(0, num(c.capacity, d.capacity)), desc: c.desc || '', teaches: c.teaches || '' };
  }
  function rampDaysFor(state) {
    var sh = clamp(num(state.sops && state.sops.hiring, 0), 0, 3);
    return Math.max(1, TUNING.rampDays / Math.max(0.05, m(state, 'hireRamp')) * Math.max(0.2, 1 - TUNING.rampSopCut * sh));
  }
  function rampFactor(e) {
    var days = Math.max(1, num(e.days, TUNING.rampDays)), left = clamp(num(e.daysLeft, 0), 0, days);
    return TUNING.rampStart + (1 - TUNING.rampStart) * (1 - left / days);
  }
  // Everything the staff adds today. Cheap; cached on state._team at the start of each day / after actions.
  function teamInfo(state, content) {
    var t = state.team || {}, counts = {}, staff = 0, payroll = 0, defs = {};
    for (var i = 0; i < ROLE_IDS.length; i++) {
      var r = ROLE_IDS[i];
      counts[r] = Math.max(0, Math.floor(num(t[r], 0)));
      staff += counts[r];
    }
    var out = { staff: staff, counts: counts, delivery: 0, calls: 0, outreach: 0, unmanaged: 0, managedF: 1,
      moraleF: 1, span: 0, capacity: TUNING.founderSpan, payroll: 0, ramping: 0, rampAvg: 1, eff: {}, closeMult: 1 };
    if (staff <= 0) return out;
    var rampLoss = {}, ramping = 0, rampSum = 0, rp = arr(t.ramp);
    for (i = 0; i < rp.length; i++) {
      var e = rp[i]; if (!e || !(e.n > 0)) continue;
      var f = rampFactor(e);
      rampLoss[e.role] = num(rampLoss[e.role], 0) + e.n * (1 - f);
      ramping += e.n; rampSum += e.n * f;
    }
    var sops = state.sops || {};
    for (i = 0; i < ROLE_IDS.length; i++) {
      defs[ROLE_IDS[i]] = roleDef(content, ROLE_IDS[i], state.flavor);
      payroll += counts[ROLE_IDS[i]] * defs[ROLE_IDS[i]].salary;
    }
    var span = defs.manager.capacity + clamp(num(sops.hiring, 0), 0, 3);
    var cap = TUNING.founderSpan + counts.manager * span;
    var unmanaged = Math.max(0, staff - cap);
    var managedF = (staff - unmanaged * (1 - TUNING.unmanagedOutput)) / staff;
    var moraleF = 0.7 + 0.3 * clamp(num(t.morale, TUNING.moraleBase), 0, 100) / 100;
    var common = managedF * Math.min(m(state, 'teamOutput'), TUNING.teamOutputMax) * moraleF;
    var eff = {};
    for (i = 0; i < ROLE_IDS.length; i++) {
      var id = ROLE_IDS[i];
      eff[id] = Math.max(0, counts[id] - Math.min(counts[id], num(rampLoss[id], 0))) * common;
    }
    out.eff = eff; out.unmanaged = unmanaged; out.managedF = managedF; out.moraleF = moraleF; out.span = span; out.capacity = cap;
    out.delivery = eff.coach * defs.coach.capacity * (1 + TUNING.sopDeliveryBonus * clamp(num(sops.delivery, 0), 0, 3));
    out.calls = eff.closer * defs.closer.capacity;
    out.outreach = eff.setter * defs.setter.capacity * (1 + TUNING.sopMarketingBonus * clamp(num(sops.marketing, 0), 0, 3));
    out.payroll = payroll * payLevel(state) * m(state, 'salaryCost');
    out.ramping = ramping; out.rampAvg = ramping > 0 ? rampSum / ramping : 1;
    out.closeMult = TUNING.closerBase + TUNING.closerSop * clamp(num(sops.sales, 0), 0, 3);
    return out;
  }
  function team(state) { return state._team || { staff: 0, counts: {}, delivery: 0, calls: 0, outreach: 0, unmanaged: 0, payroll: 0, eff: {} }; }
  // specialist teams from depts (engine-late upgrades them; core counts them in headcount)
  function perLevel(x, lvl, dflt) {
    if (Array.isArray(x)) { var s = 0; for (var i = 0; i < lvl; i++) s += num(x[Math.min(i, x.length - 1)], dflt); return s; }
    return num(x, dflt) * lvl;
  }
  function specialistInfo(state, content) {
    var deps = arr(C(content).departments), hc = 0, pay = 0, ds = state.depts || {};
    for (var i = 0; i < DEPT_IDS.length; i++) {
      var id = DEPT_IDS[i], lvl = clamp(Math.floor(num(ds[id] && ds[id].spec, 0)), 0, 3);
      if (lvl <= 0) continue;
      var d = findById(deps, id) || {};
      hc += perLevel(d.specHeadcount, lvl, 5);
      pay += perLevel(d.specSalary, lvl, 800);
    }
    return { headcount: Math.round(hc), payroll: pay * payScaleOf(content, state.flavor) * m(state, 'salaryCost') };
  }

  // --- systems hook ---
  var systems = [];
  function registerSystem(sys) {
    if (!sys || !sys.id) { warn('registerSystem needs an id'); return; }
    for (var i = 0; i < systems.length; i++) if (systems[i].id === sys.id) { systems[i] = sys; return; }
    systems.push(sys);
  }
  function sysActive(state, sys) { return sys && num(sys.minLevel, 1) <= state.level; }
  function sysMul(state, stat, mult) {
    if (!state._sysMods || typeof state._sysMods !== 'object') state._sysMods = {};
    if (typeof mult !== 'number' || !isFinite(mult)) return;
    state._sysMods[stat] = num(state._sysMods[stat], 1) * mult;
  }
  // bigger teams, pricier seats (senior hires, benefits, offices, HR): Level 4+ staff salaries ×
  // (1 + payGrowth per doubling of your staff above payGrowthFrom). Specialist teams are priced at senior
  // rates already (specSalary) and do not count.
  function payLevel(state) {
    if (!isLate(state)) return 1;
    var t = state.team || {}, n = 0;
    for (var i = 0; i < ROLE_IDS.length; i++) n += Math.max(0, Math.floor(num(t[ROLE_IDS[i]], 0)));
    return 1 + Math.max(0, TUNING.payGrowth) * Math.max(0, Math.log(Math.max(1, n) / TUNING.payGrowthFrom) / Math.LN2);
  }
  // what n more of a role really adds to daily payroll: their own salary plus the raise everyone else gets
  // because the team got bigger (payLevel). Hire cards and the runway check should use this, not the base salary.
  function hireDailyCost(state, content, roleId, n) {
    content = C(content);
    if (ROLE_IDS.indexOf(roleId) < 0 || !state.team) return 0;
    n = Math.max(1, Math.floor(num(n, 1)));
    var t = state.team, orig = t[roleId], before = teamInfo(state, content).payroll, after;
    t[roleId] = Math.max(0, Math.floor(num(orig, 0))) + n;
    try { after = teamInfo(state, content).payroll; } finally { t[roleId] = orig; }
    return Math.max(0, after - before);
  }
  function recomputeSystems(state, content) {
    state._sysMods = {};
    if (!systems.length) return;
    content = C(content);
    if (!state._sysInit || typeof state._sysInit !== 'object') state._sysInit = {};
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      if (!sysActive(state, sys)) continue;
      try {
        if (!state._sysInit[sys.id]) { state._sysInit[sys.id] = true; if (sys.init) sys.init(state, content, API); }
        if (sys.recompute) sys.recompute(state, content, API);
      } catch (err) { warn('system ' + sys.id + ' recompute failed: ' + (err && err.message)); }
    }
  }
  // after a player action: systems recompute, staff output refresh, energy re-split (only the change)
  function afterAction(state, content) {
    var prevFree = freeEnergyFor(state, state._deliveryNeed);
    recomputeSystems(state, content);
    state._team = teamInfo(state, content);
    recomputeEnergy(state, content, prevFree);
  }
  function apiEarn(state, amount, tag) {
    if (!(amount > 0)) return;
    earn(state, amount);
    if (tag === 'premium') state._today.premiumRevenue += amount;
  }
  // tag: 'tools' | 'payroll' | 'squad' (count in profit) | 'project' | 'dept' | 'bet' (one-off investments)
  function apiSpend(state, amount, tag) {
    if (!(amount > 0)) return;
    state.cash -= amount;
    var t = state._today;
    if (tag === 'payroll') t.payroll += amount;
    else if (tag === 'tools') t.toolSpend += amount;
    else if (tag === 'squad') t.squadSpend += amount;
    else if (tag === 'loss') t.loss = num(t.loss, 0) + amount;   // operating losses (burned fires): count against profit
    else t.invest += amount;
  }
  var API = {
    TUNING: TUNING, rand: rand, chance: chance, binom: binom, stochRound: stochRound,
    addLeads: function (state, n, q, fromAds, src) { addLeads(state, n, num(q, 1), fromAds, src); },
    earn: apiEarn, spend: apiSpend, pushLog: pushLog,
    applyEffects: function (state, content, effects) { return applyEffects(state, content, effects); },
    unlockNotebook: function (state, content, id) { return unlockNotebook(state, C(content), id); },
    m: m, getFlavor: getFlavor, deliveryMod: deliveryMod,
    computeMetrics: function (state, content, lite) { return computeMetrics(state, content, lite); },
    last30: function (state) { return last30(state); }, money: money,
    // extras
    clamp: clamp, num: num, findById: findById, sysMul: sysMul, getLevelDef: getLevelDef,
    teamInfo: function (state, content) { return teamInfo(state, C(content)); },
    hireCap: function (state, content) { return hireCap(state, C(content)); },
    payScale: function (state, content) { return payScaleOf(C(content), state && state.flavor); },
    specialistInfo: function (state, content) { return specialistInfo(state, C(content)); },
    recompute: function (state, content) { afterAction(state, C(content)); },
    DEPT_IDS: DEPT_IDS, ROLE_IDS: ROLE_IDS
  };

  // ---------------------------------------------------------------------------
  // conditions
  // ---------------------------------------------------------------------------
  function checkCond(state, content, cond, memo) {
    if (!cond) return true;
    if (Array.isArray(cond)) { for (var a = 0; a < cond.length; a++) if (!checkCond(state, content, cond[a], memo)) return false; return true; }
    if (typeof cond !== 'object') return !!cond;
    var i;
    if (cond.all) { var al = arr(cond.all); for (i = 0; i < al.length; i++) if (!checkCond(state, content, al[i], memo)) return false; }
    if (cond.any) {
      var an = arr(cond.any), ok = false;
      for (i = 0; i < an.length; i++) if (checkCond(state, content, an[i], memo)) { ok = true; break; }
      if (!ok) return false;
    }
    if (cond.not && checkCond(state, content, cond.not, memo)) return false;
    if (cond.path !== undefined) {
      var v;
      if (String(cond.path).indexOf('metrics.') === 0) {
        if (!memo.metrics) memo.metrics = computeMetrics(state, content, true);
        v = getPath(memo.metrics, String(cond.path).slice(8));
      } else v = getPath(state, cond.path);
      if (Array.isArray(v)) v = v.length;
      // null = "not measurable yet" (e.g. LTV:CAC with no spend): numeric comparisons fail
      if (v === null && (cond.gte !== undefined || cond.lte !== undefined || cond.gt !== undefined || cond.lt !== undefined)) return false;
      if (cond.gte !== undefined && !(v >= cond.gte)) return false;
      if (cond.lte !== undefined && !(v <= cond.lte)) return false;
      if (cond.gt !== undefined && !(v > cond.gt)) return false;
      if (cond.lt !== undefined && !(v < cond.lt)) return false;
      if (cond.eq !== undefined && v !== cond.eq) return false;
    }
    if (cond.level !== undefined && state.level !== cond.level) return false;
    if (cond.minLevel !== undefined && state.level < cond.minLevel) return false;
    if (cond.maxLevel !== undefined && state.level > cond.maxLevel) return false;
    if (cond.minDay !== undefined && state.day < cond.minDay) return false;
    if (cond.maxDay !== undefined && state.day > cond.maxDay) return false;
    if (cond.flag !== undefined && !state.flags[cond.flag]) return false;
    if (cond.notFlag !== undefined && state.flags[cond.notFlag]) return false;
    if (cond.upgrade !== undefined && state.upgrades.indexOf(cond.upgrade) < 0) return false;
    if (cond.notUpgrade !== undefined && state.upgrades.indexOf(cond.notUpgrade) >= 0) return false;
    // chance last so the roll only happens when everything else passed
    if (cond.chance !== undefined && !(rand(state) < cond.chance)) return false;
    return true;
  }
  function checkCondition(state, content, cond) { return checkCond(state, C(content), cond, {}); }

  // ---------------------------------------------------------------------------
  // effects
  // ---------------------------------------------------------------------------
  function clampPath(state, path) {
    var v = getPath(state, path);
    if (typeof v !== 'number' || !isFinite(v)) return;
    var p = path.split('.');
    if (p[0] === 'offer' && DIALS.indexOf(p[1]) >= 0) v = clamp(Math.round(v * 100) / 100, 1, 10);
    else if (p[0] === 'skills') v = clamp(v, 0, 5);
    else if (path === 'energy.max') v = Math.max(TUNING.minEnergyMax, v);
    else if (path === 'burnout') v = clamp(v, 0, 100);
    else if (path === 'network.available') v = clamp(v, 0, Math.max(0, state.network.size));
    else if (path === 'offer.price') v = state.level < 2 ? 0 : clamp(Math.round(v), 0, TUNING.maxPrice);
    else if (p[0] === 'channels') v = clamp(v, 0, 10);
    else if (path === 'focus' || path === 'team.morale' || path === 'ops.efficiency' || p[0] === 'depts') v = clamp(v, 0, 100);
    else if (p[0] === 'sops') v = clamp(Math.round(v), 0, 3);
    else if (path === 'squad.partners.count') v = Math.max(0, Math.round(v));
    else if (path === 'attention.max') v = clamp(Math.round(v), 1, 10);
    else if (path === 'premium.price') v = clamp(Math.round(v), 0, TUNING.maxPrice * 4);
    else if (path !== 'cash') v = Math.max(0, v);
    setPath(state, path, v);
    if (path === 'network.size') state.network.available = clamp(state.network.available, 0, v);
  }

  function pushLog(state, type, text) {
    if (!text) return;
    state.log.push({ day: state.day, type: type, text: String(text) });
    if (state.log.length > TUNING.logKeep) state.log.splice(0, state.log.length - TUNING.logKeep);
  }

  function unlockNotebook(state, content, id) {
    if (!id || state.notebook.indexOf(id) >= 0) return null;
    state.notebook.push(id);
    var t = 'New lesson: ' + nbTerm(content, id);
    pushLog(state, 'notebook', t);
    return { type: 'notebook', id: id, text: t };
  }

  function applyEffects(state, content, effects) {
    content = C(content);
    var events = [];
    var list = arr(effects);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || typeof e !== 'object') continue;
      var op = e.op;
      if (op === 'add' || op === 'mul' || op === 'set') {
        if (!isAllowedPath(e.path)) { warn('effect path not allowed: ' + e.path); continue; }
        var cur = getPath(state, e.path);
        if (op === 'set') {
          if (e.path === 'offer.guarantee') {
            if (GUARANTEES.indexOf(e.value) < 0) { warn('bad guarantee: ' + e.value); continue; }
            state.offer.guarantee = e.value;
          } else if (e.path === 'offer.name') {
            state.offer.name = String(e.value);
          } else {
            if (typeof e.value !== 'number' || !isFinite(e.value)) { warn('set needs a number: ' + e.path); continue; }
            setPath(state, e.path, e.value); clampPath(state, e.path);
          }
        } else {
          if (typeof cur !== 'number' || typeof e.value !== 'number' || !isFinite(e.value)) { warn(op + ' needs numbers: ' + e.path); continue; }
          // new leads from cards/events count like any other lead (totals, today's count, lead quality)
          if (e.path === 'leads' && op === 'add' && e.value > 0) { addLeads(state, e.value, TUNING.qReferral); continue; }
          setPath(state, e.path, op === 'add' ? cur + e.value : cur * e.value);
          clampPath(state, e.path);
        }
        // more (or less) CEO attention counts this week, not only after the next weekly refill
        if (e.path === 'attention.max' && state.attention && typeof cur === 'number') {
          var amax = num(state.attention.max, cur);
          state.attention.left = clamp(num(state.attention.left, 0) + (amax - cur), 0, amax);
        }
      } else if (op === 'mod') {
        if (MOD_KEYS.indexOf(e.stat) < 0 || typeof e.mult !== 'number') { warn('bad mod: ' + e.stat); continue; }
        state.mods[e.stat] = clamp(state.mods[e.stat] * e.mult, 0.05, 20);
      } else if (op === 'buff') {
        if (MOD_KEYS.indexOf(e.stat) < 0 || typeof e.mult !== 'number') { warn('bad buff: ' + e.stat); continue; }
        state.buffs.push({ stat: e.stat, mult: e.mult, daysLeft: Math.max(1, Math.round(num(e.days, 7))), label: e.label || '' });
      } else if (op === 'flag') {
        if (!e.name) continue;
        state.flags[e.name] = e.value === undefined ? true : e.value;
      } else if (op === 'unlock') {
        var parts = String(e.what || '').split(':');
        if (parts[0] === 'channel' && state.channels[parts[1]]) {
          if (!state.channels[parts[1]].unlocked) {
            state.channels[parts[1]].unlocked = true;
            var cn = (content.channels && content.channels[parts[1]] && content.channels[parts[1]].name) || parts[1];
            events.push({ type: 'info', id: e.what, text: cn + ' unlocked!' });
          }
        } else if (parts[0] === 'combo' && state.combos[parts[1]]) {
          if (!state.combos[parts[1]].unlocked) {
            state.combos[parts[1]].unlocked = true;
            var bn = (content.combos && content.combos[parts[1]] && content.combos[parts[1]].name) || parts[1];
            events.push({ type: 'info', id: e.what, text: bn + ' unlocked!' });
          }
        } else warn('bad unlock: ' + e.what);
      } else if (op === 'notebook') {
        var nev = unlockNotebook(state, content, e.id);
        if (nev) events.push(nev);
      } else if (op === 'coach') {
        events.push({ type: 'coach', text: String(e.text || '') });
      } else if (op === 'log') {
        pushLog(state, 'info', e.text);
        events.push({ type: 'info', text: String(e.text || '') });
      } else {
        warn('unknown effect op: ' + op);
      }
    }
    return events;
  }

  // ---------------------------------------------------------------------------
  // player actions
  // ---------------------------------------------------------------------------
  function tap(state, content, channelId, combo) {
    content = C(content);
    if (state.gameOver) return { ok: false, events: [], reason: 'Game over' };
    if (channelId !== 'warm' && channelId !== 'cold') return { ok: false, events: [], reason: 'Tap works on Friends or Cold Calls' };
    if (!state.channels[channelId] || !state.channels[channelId].unlocked) return { ok: false, events: [], reason: 'Channel locked' };
    if (state.energy.current < 1) return { ok: false, events: [], reason: 'Out of energy today' };
    if (channelId === 'warm' && state.network.available < 1) return { ok: false, events: [], reason: 'No friends left to message today. Try Cold Calls!' };
    if (state.energy.current - 1 < salesReserve(state)) return { ok: false, events: [], reason: 'The rest is saved for sales calls (see Autopilot plan)' };
    state.energy.current -= 1;
    state.stats.tapsTotal++; state.stats.outreachTotal++;
    state._today.taps++; state._today.outreach++; state._today.leadEnergy++;
    var bonus = 1 + Math.min(TUNING.comboCap, Math.max(0, Math.floor(num(combo, 0))) * TUNING.comboStep);
    var events = [];
    if (outreachOne(state, content, channelId, bonus)) {
      events.push({ type: 'lead', amount: 1, text: channelId === 'warm' ? 'A friend replied! +1 lead' : 'Someone bit! +1 lead' });
    }
    return { ok: true, events: events };
  }

  function setPlan(state, plan) {
    var keys = ['warm', 'cold', 'content', 'sales'], p = {}, sum = 0;
    plan = plan || {};
    keys.forEach(function (k) { p[k] = Math.max(0, num(plan[k], num(state.plan[k], 0))); sum += p[k]; });
    if (sum <= 0) { state.plan = { warm: 60, cold: 0, content: 0, sales: 40 }; return; }
    var out = {}, acc = 0;
    keys.forEach(function (k) { out[k] = Math.round(p[k] / sum * 100); acc += out[k]; });
    if (acc !== 100) { // fix rounding on the biggest entry
      var big = keys.reduce(function (a, b) { return out[b] > out[a] ? b : a; }, 'warm');
      out[big] += 100 - acc;
    }
    state.plan = out;
  }

  function setPrice(state, content, price) {
    if (state.level < 2) { state.offer.price = 0; return { ok: false, reason: 'Price is locked at $0 in the Garage. Get proof first!' }; }
    var p = num(price, NaN);
    if (!isFinite(p)) return { ok: false, reason: 'Not a number' };
    state.offer.price = clamp(Math.round(p), 0, TUNING.maxPrice);
    return { ok: true, reason: '' };
  }

  function setAdBudget(state, content, dollars) {
    if (!state.channels.ads.unlocked) return { ok: false, reason: 'Ads unlock at Level 3' };
    var d = Math.max(0, Math.round(num(dollars, 0))), cap = adCap(state);
    if (d > cap) { state.channels.ads.dailyBudget = cap; return { ok: false, reason: 'Ad budget capped at ' + money(cap) + '/day until new customers pay back their ad cost within 30 days' }; }
    state.channels.ads.dailyBudget = d;
    return { ok: true, reason: '' };
  }

  function makePost(state, content) {
    var reach = postReach(state);
    state.channels.content.posts.push({ day: state.day, reach: Math.round(reach * 10) / 10 });
    var gain = reach * TUNING.audiencePerReach;
    state.audience = Math.round((state.audience + gain) * 10) / 10;
    return reach;
  }
  function postContent(state, content) {
    content = C(content);
    if (state.gameOver) return { ok: false, events: [], reason: 'Game over' };
    if (!state.channels.content.unlocked) return { ok: false, events: [], reason: 'Content unlocks at Level 3' };
    if (state.energy.current < TUNING.postEnergy) return { ok: false, events: [], reason: 'Need ' + TUNING.postEnergy + ' energy to post' };
    if (state.energy.current - TUNING.postEnergy < salesReserve(state)) return { ok: false, events: [], reason: 'The rest is saved for sales calls (see Autopilot plan)' };
    state.energy.current -= TUNING.postEnergy;
    state._today.leadEnergy += TUNING.postEnergy;
    var reach = makePost(state, content);
    return { ok: true, events: [{ type: 'info', amount: Math.round(reach), text: 'Posted! Reached ~' + Math.round(reach) + ' people' }], reason: '' };
  }

  function toggleCombo(state, content, id, on) {
    var c = state.combos[id];
    if (!c) return { ok: false, reason: 'Unknown combo' };
    if (!c.unlocked) return { ok: false, reason: 'Locked' };
    c.on = on === undefined ? !c.on : !!on;
    return { ok: true, reason: '' };
  }

  function overtime(state, content) {
    if (state.gameOver) return { ok: false, reason: 'Game over' };
    if (state._restDays > 0) return { ok: false, reason: 'You are resting. Burnout is real!' };
    if (state.energy.overtimeToday) return { ok: false, reason: 'Already pushed overtime today' };
    var prevFree = freeEnergyFor(state, state._deliveryNeed);
    state.energy.overtimeToday = true;
    // the extra hours serve customers first: an overload clears before any energy is left over
    recomputeEnergy(state, content, prevFree);
    state.burnout = clamp(state.burnout + TUNING.overtimeBurnout, 0, 100);
    return { ok: true, reason: '' };
  }

  // --- team (SPEC-LATE §3.1) ---
  // recruiting capacity: hires in the last 7 days are capped at base + share of headcount + Hiring Playbook ranks
  function hireCap(state, content) {
    var t = state.team || {}, recent = arr(t.hires).filter(function (d) { return num(d, -99) > state.day - TUNING.hireWindow; });
    var cap = Math.max(1, Math.floor(TUNING.hireWeekBase + TUNING.hireWeekPct * headcountOf(state, content) +
      TUNING.hireWeekSop * clamp(num(state.sops && state.sops.hiring, 0), 0, 3)));
    return { cap: cap, used: recent.length, left: Math.max(0, cap - recent.length) };
  }
  function hire(state, content, roleId) {
    content = C(content);
    if (state.gameOver) return { ok: false, reason: 'Game over', events: [] };
    if (ROLE_IDS.indexOf(roleId) < 0) return { ok: false, reason: 'Unknown role', events: [] };
    var r = roleDef(content, roleId, state.flavor);
    if (state.level < r.unlockLevel) return { ok: false, reason: plural(r.name, 2) + ' unlock at Level ' + r.unlockLevel, events: [] };
    var hcap = hireCap(state, content);
    if (hcap.left <= 0) return { ok: false, reason: 'Recruiting is full for now (' + hcap.used + '/' + hcap.cap + ' hires in ' + TUNING.hireWindow + ' days). More room in a few days; Hiring Playbooks add more.', events: [] };
    if (state.cash < r.hireCost) return { ok: false, reason: 'Need ' + money(r.hireCost) + ' to hire a ' + r.name, events: [] };
    var prevFree = freeEnergyFor(state, state._deliveryNeed);
    state.cash -= r.hireCost; state._today.invest += r.hireCost;
    var first = ROLE_IDS.every(function (id) { return !(num(state.team[id], 0) > 0); });
    state.team[roleId] = Math.max(0, Math.floor(num(state.team[roleId], 0))) + 1;
    state.team.hires = arr(state.team.hires).filter(function (d) { return num(d, -99) > state.day - TUNING.hireWindow; }).concat([state.day]);
    if (!Array.isArray(state.team.ramp)) state.team.ramp = [];
    var days = Math.round(rampDaysFor(state) * 10) / 10;
    state.team.ramp.push({ role: roleId, n: 1, daysLeft: days, days: days });
    var txt = 'Hired a ' + r.name + '! ' + r.emoji + ' (ramping up for ~' + Math.ceil(days) + ' days)';
    var events = [{ type: 'info', id: 'hire_' + roleId, amount: -r.hireCost, text: txt }];
    pushLog(state, 'info', 'Hired a ' + r.name);
    if (first) { var ne = unlockNotebook(state, content, 'first_hire'); if (ne) events.push(ne); }
    recomputeSystems(state, content);
    state._team = teamInfo(state, content);
    recomputeEnergy(state, content, prevFree);
    return { ok: true, reason: '', events: events };
  }
  function fire(state, content, roleId) {
    content = C(content);
    if (ROLE_IDS.indexOf(roleId) < 0) return { ok: false, reason: 'Unknown role' };
    var r = roleDef(content, roleId, state.flavor);
    if (!letGo(state, roleId, 1)) return { ok: false, reason: 'No ' + plural(r.name, 2) + ' to let go' };
    state.team.morale = clamp(num(state.team.morale, TUNING.moraleBase) - TUNING.moraleFire, 0, 100);
    pushLog(state, 'info', 'Let a ' + r.name + ' go');
    afterAction(state, content);
    return { ok: true, reason: '' };
  }
  // headcount only (no morale, no refresh): the newest hires of that role leave first. Returns how many left.
  function letGo(state, roleId, n) {
    var have = Math.max(0, Math.floor(num(state.team[roleId], 0)));
    n = Math.min(have, Math.max(0, Math.floor(num(n, 0))));
    if (n <= 0) return 0;
    state.team[roleId] = have - n;
    var rp = arr(state.team.ramp), left = n;
    for (var i = rp.length - 1; i >= 0 && left > 0; i--) {
      if (!rp[i] || rp[i].role !== roleId || !(rp[i].n > 0)) continue;
      var k = Math.min(left, rp[i].n); rp[i].n -= k; left -= k;
      if (rp[i].n <= 0) rp.splice(i, 1);
    }
    return n;
  }

  // --- cash-crunch rescue (Level 4+) ---
  // Plans the cut on a short forward simulation instead of a fixed order, because every cut also changes sales:
  // setters feed the sales reps, reps turn leads into customers, managers keep the team at full output and coaches
  // keep refunds and churn down. Greedy: try each single cut (ads off, agency off, let 1 or a third of one
  // role go), keep the one that leaves the most cash after crunchDays without running out of grace, repeat until no
  // cut helps. The whole layoff costs one morale hit. If cutting would hurt, it says so and changes nothing.
  function crunchApply(s, content, plan) {
    if (plan.ads !== undefined) s.channels.ads.dailyBudget = plan.ads;
    if (plan.agency !== undefined) s.squad.agency.retainer = plan.agency;
    var n = 0;
    for (var i = 0; i < ROLE_IDS.length; i++) n += letGo(s, ROLE_IDS[i], num(plan.cut[ROLE_IDS[i]], 0));
    if (n > 0) s.team.morale = clamp(num(s.team.morale, TUNING.moraleBase) - TUNING.moraleFire, 0, 100);
    afterAction(s, content);
    return n;
  }
  // ref (from the do-nothing plan): a cut may not leave delivery overloaded (or more overloaded) or staff unmanaged
  // when they were not, so the plan never 'saves' a month of cash by wrecking delivery for the months after
  function crunchScore(state, content, plan, days, seeds, ref) {
    var tot = { score: 0, over: 0, back: -1 };
    for (var k = 0; k < seeds.length; k++) {
      var s = clone(state);
      s.history = []; s.pendingCard = null;
      crunchApply(s, content, plan);
      if (k === 0 && !ref) tot.ref = { over: !!s._overloaded, need: num(s._deliveryNeed, 0), unmanaged: num(s._team.unmanaged, 0) };
      if (ref && ((s._overloaded && (!ref.over || num(s._deliveryNeed, 0) > ref.need + 1e-6)) ||
        num(s._team.unmanaged, 0) > ref.unmanaged + 1e-6)) return null;
      var opts = { noCards: true, noEvents: true, noCoach: true }, back = s.cash >= 0 ? 0 : -1, i;
      for (i = 0; i < days && !s.gameOver && !(s.exit && s.exit.sold); i++) {
        s._crnDay = s.rng = ((seeds[k] >>> 0) ^ Math.imul(i + 1, 0x85EBCA6B)) >>> 0;
        autoFires(s, content);
        tick(s, content, opts);
        if (back < 0 && s.cash >= 0) back = i + 1;
      }
      // running out of grace outweighs any amount of cash; lasting longer still beats folding sooner
      tot.score += s.gameOver ? -1e12 + i * 1e8 + s.cash : s.cash;
      if (s.gameOver) tot.over++;
      if (k === 0) tot.back = back;
    }
    tot.score /= seeds.length;
    return tot;
  }
  function cutToBreakEven(state, content) {
    content = C(content);
    if (state.gameOver) return { ok: false, reason: 'Game over', events: [] };
    if (!isLate(state)) return { ok: false, reason: 'Nothing to cut yet', events: [] };
    var l30 = last30(state), avgRev = l30.days ? l30.revenue / l30.days : 0;   // same window as burnDaily
    var dailyCost = function (st) {
      var tm = teamInfo(st, content), sp = specialistInfo(st, content);
      var ads = st.channels.ads.unlocked ? Math.min(num(st.channels.ads.dailyBudget, 0), adCap(st)) : 0;
      return st.livingCost + ads + num(st.squad.agency.retainer, 0) + tm.payroll + sp.payroll + avgRev * TUNING.opexShare;
    };
    var before = dailyCost(state);
    var days = TUNING.crunchDays, base = state.rng >>> 0, seeds = [base, (base ^ 0x9E3779B1) >>> 0];
    var ads0 = num(state.channels.ads.dailyBudget, 0), agency0 = num(state.squad.agency.retainer, 0);
    var plan = { cut: {} }, best = crunchScore(state, content, plan, days, seeds), start = best, ref = best.ref, t0 = nowMs();
    var cands = function (p) {
      var out = [], add = function (ch) {
        var q = { ads: p.ads, agency: p.agency, cut: {} };
        for (var r in p.cut) q.cut[r] = p.cut[r];
        for (var key in ch) { if (key === 'cut') { for (r in ch.cut) q.cut[r] = num(q.cut[r], 0) + ch.cut[r]; } else q[key] = ch[key]; }
        out.push(q);
      };
      var ads = p.ads === undefined ? ads0 : p.ads;
      if (ads > 0) add({ ads: 0 });
      if (agency0 > 0 && p.agency === undefined) add({ agency: 0 });
      for (var i = 0; i < ROLE_IDS.length; i++) {
        var id = ROLE_IDS[i], c = Math.max(0, Math.floor(num(state.team[id], 0))) - num(p.cut[id], 0), o = {};
        if (c <= 0) continue;
        o[id] = 1; add({ cut: o });
        if (c >= 4) { var o2 = {}; o2[id] = Math.ceil(c / 3); add({ cut: o2 }); }
      }
      return out;
    };
    for (var it = 0; it < TUNING.crunchSteps; it++) {
      var list = cands(plan), pick = null, pickRes = null;
      for (var j = 0; j < list.length; j++) {
        var res = crunchScore(state, content, list[j], days, seeds, ref);
        if (res && (!pickRes || res.score > pickRes.score)) { pick = list[j]; pickRes = res; }
      }
      // a cut must clearly pay: small gains are noise, and a layoff is not free for the people in it
      if (!pick || pickRes.score <= best.score + Math.max(TUNING.crunchMinGain, 0.03 * Math.abs(best.score % 1e8))) break;
      plan = pick; best = pickRes;
      if (nowMs() - t0 > TUNING.crunchBudgetMs) break;   // slow phone: keep the best plan so far
    }
    var nCut = 0;
    for (var rid in plan.cut) nCut += plan.cut[rid];
    var paused = [];
    if (plan.ads !== undefined) paused.push('ads');
    if (plan.agency !== undefined) paused.push('the agency');
    var backTxt = function (b) { return b > 0 ? ' Cash should be back above $0 in about ' + b + ' day' + (b === 1 ? '' : 's') + ' if sales hold.' : ''; };
    if (!paused.length && !nCut) {
      if (!start.over) return { ok: false, reason: 'Cutting now would cost more in sales than it saves. Every role is paying for itself, so keep selling.' + backTxt(start.back), events: [] };
      return { ok: false, reason: 'No cut closes this gap: the people left bring in more than they cost. Now it is all about sales: reach out, raise value, then raise the price.', events: [] };
    }
    crunchApply(state, content, plan);
    var parts = paused.length ? ['paused ' + paused.join(' and ')] : [], fired = {};
    ['setter', 'closer', 'manager', 'coach'].forEach(function (id) {
      var n = num(plan.cut[id], 0); if (!(n > 0)) return;
      fired[id] = n;
      parts.push('let ' + n + ' ' + plural(roleDef(content, id, state.flavor).name, n) + ' go');
      pushLog(state, 'info', 'Let ' + n + ' ' + plural(roleDef(content, id, state.flavor).name, n) + ' go');
    });
    var after = dailyCost(state);
    var txt = 'Cash crunch plan: ' + parts.join(', ') + '. Daily costs ' + money(before) + ' → ' + money(after) +
      ' vs ' + money(avgRev) + ' a day in sales.' + (best.over ? ' This buys time, but cuts alone will not close the gap: you also need more sales.' : backTxt(best.back));
    pushLog(state, 'info', txt);
    return { ok: true, reason: '', before: before, after: after, avgRevenue: avgRev, fired: fired, paused: paused,
      events: [{ type: 'info', id: 'cut_to_break_even', text: txt }] };
  }

  // --- Lead Squad (SPEC-LATE §3.2) ---
  function setSquad(state, content, key, value) {
    content = C(content);
    var sq = state.squad;
    if (key === 'fans' || key === 'fansReward') {
      if (state.level < TUNING.squadFansLevel) return { ok: false, reason: 'Fans join the Lead Squad at Level ' + TUNING.squadFansLevel };
      if (key === 'fans') sq.fans.on = value === undefined ? !sq.fans.on : !!value;
      else sq.fans.reward = clamp(Math.round(num(value, sq.fans.reward)), 0, 5000);
    } else if (key === 'agency') {
      if (state.level < TUNING.squadAgencyLevel) return { ok: false, reason: 'Agencies join the Lead Squad at Level ' + TUNING.squadAgencyLevel };
      var d = Math.max(0, Math.round(num(value, 0))), cap = adCap(state);
      if (d > cap) { sq.agency.retainer = cap; return { ok: false, reason: 'Agency retainer capped at ' + money(cap) + '/day (same rule as ads)' }; }
      sq.agency.retainer = d;
    } else if (key === 'partnersRecruit') {
      if (state.level < TUNING.squadPartnersLevel) return { ok: false, reason: 'Partners join the Lead Squad at Level ' + TUNING.squadPartnersLevel };
      if (state.cash < TUNING.partnerCost) return { ok: false, reason: 'Need ' + money(TUNING.partnerCost) + ' to sign a partner' };
      if (state.energy.current < TUNING.partnerEnergy) return { ok: false, reason: 'Need ' + TUNING.partnerEnergy + ' energy to pitch a partner' };
      state.cash -= TUNING.partnerCost; state._today.squadSpend += TUNING.partnerCost;
      state.energy.current -= TUNING.partnerEnergy; state._today.leadEnergy += TUNING.partnerEnergy;
      sq.partners.count = Math.max(0, Math.floor(num(sq.partners.count, 0))) + 1;
      pushLog(state, 'info', 'Signed a new partner (' + sq.partners.count + ' total)');
      var ev = [{ type: 'info', id: 'partner', amount: -TUNING.partnerCost, text: 'New partner signed! They will send you leads.' }];
      var ne = unlockNotebook(state, content, 'partners'); if (ne) ev.push(ne);
      afterAction(state, content);
      return { ok: true, reason: '', events: ev };
    } else if (key === 'partnersCommission') {
      if (state.level < TUNING.squadPartnersLevel) return { ok: false, reason: 'Partners join the Lead Squad at Level ' + TUNING.squadPartnersLevel };
      sq.partners.commission = clamp(num(value, sq.partners.commission), 0.05, 0.5);
    } else return { ok: false, reason: 'Unknown Lead Squad setting' };
    afterAction(state, content);
    return { ok: true, reason: '' };
  }

  // --- niche focus (SPEC-LATE §3.3) ---
  function setFocus(state, content, v) {
    content = C(content);
    if (state.level < TUNING.focusUnlockLevel) return { ok: false, reason: 'Niche focus unlocks at Level ' + TUNING.focusUnlockLevel };
    var f = num(v, NaN);
    if (!isFinite(f)) return { ok: false, reason: 'Not a number' };
    state.focus = clamp(Math.round(f), 0, 100);
    afterAction(state, content);
    return { ok: true, reason: '' };
  }

  // --- premium product (SPEC-LATE §3.4) ---
  function premiumDefaults(content) {
    var d = C(content).premiumDefaults || {};
    return { buildCost: Math.max(0, num(d.buildCost, TUNING.premiumBuildCost)), buildDays: Math.max(1, Math.round(num(d.buildDays, TUNING.premiumBuildDays))),
      priceMult: Math.max(1, num(d.priceMult, TUNING.premiumPriceMult)), name: d.name || '', nameByFlavor: d.nameByFlavor || {},
      unlockLevel: Math.round(num(d.unlockLevel, TUNING.premiumUnlockLevel)), valueMult: Math.max(0.1, num(d.valueMult, TUNING.premiumValueMult)),
      finisherTake: clamp(num(d.finisherTake, TUNING.premiumFinisherTake), 0, 1), activeTake: clamp(num(d.activeTakePerDay, TUNING.premiumActiveTake), 0, 1),
      focusBoost: Math.max(0, num(d.focusBoost, TUNING.premiumFocusBonus)), energy: Math.max(0, num(d.deliveryEnergyMult, TUNING.premiumEnergy)) };
  }
  // what building the premium costs today: the listed cost, or about 3 days of average sales for a bigger company
  // (a $10k-a-day business builds a bigger product than a $2k-a-day one), rounded to $500
  function premiumCost(state, content) {
    var d = premiumDefaults(C(content)), l30 = last30(state), avg = l30.days ? l30.revenue / l30.days : 0;
    return Math.max(d.buildCost, Math.round(TUNING.premiumCostDays * avg / 500) * 500);
  }
  function buildPremium(state, content) {
    content = C(content);
    var p = state.premium, d = premiumDefaults(content);
    d.buildCost = premiumCost(state, content);
    if (state.level < d.unlockLevel) return { ok: false, reason: 'The Product Lab opens at Level ' + d.unlockLevel, events: [] };
    if (p.built) return { ok: false, reason: 'Already built', events: [] };
    if (p.buildDays > 0) return { ok: false, reason: 'Already building (' + p.buildDays + ' days left)', events: [] };
    if (state.cash < d.buildCost) return { ok: false, reason: 'Need ' + money(d.buildCost) + ' to build it', events: [] };
    state.cash -= d.buildCost; state._today.invest += d.buildCost;
    p.buildDays = d.buildDays;
    if (!p.name) p.name = d.nameByFlavor[state.flavor] || d.name || ('VIP ' + (state.offer.name || 'Program'));
    var t = 'Building ' + p.name + '. Ready in ' + d.buildDays + ' days.';
    pushLog(state, 'info', t);
    afterAction(state, content);
    return { ok: true, reason: '', events: [{ type: 'info', id: 'premium_start', amount: -d.buildCost, text: t }] };
  }
  function setPremiumPrice(state, content, price) {
    var p = state.premium;
    if (!p.built && !(p.buildDays > 0)) return { ok: false, reason: 'Build the premium product first' };
    var v = num(price, NaN);
    if (!isFinite(v)) return { ok: false, reason: 'Not a number' };
    p.price = clamp(Math.round(v), 0, TUNING.maxPrice * 4);
    afterAction(state, C(content));
    return { ok: true, reason: '' };
  }
  function togglePremium(state, content, on) {
    var p = state.premium;
    if (!p.built) return { ok: false, reason: p.buildDays > 0 ? 'Still building (' + p.buildDays + ' days left)' : 'Build the premium product first' };
    p.on = on === undefined ? !p.on : !!on;
    afterAction(state, C(content));
    return { ok: true, reason: '' };
  }
  // how well the premium price fits its value (1 = the take rates as written; higher when cheaper)
  function premiumFit(state, content) {
    var price = num(state.premium.price, 0);
    if (!(price > 0)) return 0;
    var val = premiumDefaults(content).valueMult * offerValue(state, content);
    return clamp(curveClose(state, val / price) / curveClose(state, TUNING.premiumRefRatio), 0, 2);
  }
  function premiumExpected(state, content, finished) {
    var p = state.premium;
    if (!p.built || !p.on || !(p.price > 0)) return 0;
    var d = premiumDefaults(content);
    return (d.finisherTake * Math.max(0, finished) + d.activeTake * state.customers.active) *
      Math.min(m(state, 'premiumTake'), TUNING.premiumTakeMax) * premiumFit(state, content) * (1 + d.focusBoost * focusF(state));
  }

  // friendly lock text for the simple "learned by doing" conditions (first failing count leaf)
  var COUNT_WORDS = { 'stats.salesCount': 'sales', 'stats.callsTotal': 'sales calls', 'reputation.testimonials': 'testimonials',
    'reputation.caseStudies': 'case studies', 'stats.trialsCompleted': 'finished trials' };
  function condReason(state, content, cond) {
    if (!cond || typeof cond !== 'object') return '';
    var kids = Array.isArray(cond) ? cond : arr(cond.all);
    for (var i = 0; i < kids.length; i++) {
      if (!checkCond(state, content, kids[i], {})) { var r = condReason(state, content, kids[i]); if (r) return r; }
    }
    if (cond.path && COUNT_WORDS[cond.path] && cond.gte !== undefined) {
      var have = num(getPath(state, cond.path), 0);
      if (have < cond.gte) return 'Needs ' + cond.gte + ' ' + COUNT_WORDS[cond.path] + ' (you have ' + Math.floor(have) + ')';
    }
    return '';
  }
  function upgradeStatus(state, content, u) {
    var owned = state.upgrades.indexOf(u.id) >= 0;
    var cost = u.cost || {}, cc = num(cost.cash, 0), ce = num(cost.energy, 0);
    var locked = false, reason = '';
    if (!owned) {
      if (state.level < num(u.minLevel, 1)) { locked = true; reason = 'Unlocks at Level ' + u.minLevel; }
      var req = arr(u.requires);
      for (var i = 0; !locked && i < req.length; i++) {
        if (state.upgrades.indexOf(req[i]) < 0) {
          var r = findById(C(content).upgrades, req[i]);
          locked = true; reason = 'Needs ' + (r ? r.name : req[i]);
        }
      }
      if (!locked && u.cond && !checkCond(state, content, u.cond, {})) { locked = true; reason = condReason(state, content, u.cond) || 'Not available yet'; }
    }
    var affordable = state.cash >= cc && state.energy.current >= ce;
    if (!owned && !locked && !affordable) reason = state.cash < cc ? 'Need ' + money(cc) : 'Need ' + ce + ' energy';
    if (owned) reason = 'Owned';
    return { upgrade: u, affordable: affordable, owned: owned, locked: locked, reason: reason };
  }
  function availableUpgrades(state, content) {
    content = C(content);
    return arr(content.upgrades).filter(function (u) { return u && u.id; }).map(function (u) { return upgradeStatus(state, content, u); });
  }
  function buyUpgrade(state, content, id) {
    content = C(content);
    var u = findById(content.upgrades, id);
    if (!u) return { ok: false, reason: 'Unknown upgrade', events: [] };
    var st = upgradeStatus(state, content, u);
    if (st.owned) return { ok: false, reason: 'Already owned', events: [] };
    if (st.locked) return { ok: false, reason: st.reason, events: [] };
    if (!st.affordable) return { ok: false, reason: st.reason, events: [] };
    var cc = num(u.cost && u.cost.cash, 0), ce = num(u.cost && u.cost.energy, 0);
    var prevFree = freeEnergyFor(state, state._deliveryNeed);
    state.cash -= cc; state.energy.current -= ce;
    if (TUNING.toolCategories.indexOf(u.category) >= 0) state._today.toolSpend += cc;
    state.upgrades.push(u.id);
    var events = [{ type: 'info', id: u.id, amount: -cc, text: 'Bought ' + (u.name || u.id) + '!' }];
    pushLog(state, 'info', 'Bought ' + (u.name || u.id));
    events = events.concat(applyEffects(state, content, u.effects));
    if (u.notebook) { var ne = unlockNotebook(state, content, u.notebook); if (ne) events.push(ne); }
    // delivery energy / team output may have changed (also re-checks the overload)
    recomputeSystems(state, content);
    state._team = teamInfo(state, content);
    recomputeEnergy(state, content, prevFree);
    return { ok: true, reason: '', events: events };
  }

  // ---------------------------------------------------------------------------
  // cards
  // ---------------------------------------------------------------------------
  function getPendingCard(state, content) {
    if (!state.pendingCard) return null;
    return findById(C(content).cards, state.pendingCard);
  }

  function snapshotOf(state) {
    var h = state.history; state.history = [];
    var snap = clone(state);
    state.history = h;
    delete snap.history;
    return snap;
  }

  function chooseCardOption(state, content, optionId) {
    content = C(content);
    var card = getPendingCard(state, content);
    if (!card) return { events: [] };
    var opt = findById(card.options, optionId);
    if (!opt) return { events: [] };
    state.history.push({ day: state.day, cardId: card.id, optionId: opt.id, snapshot: snapshotOf(state) });
    if (state.history.length > TUNING.historyKeep) state.history.splice(0, state.history.length - TUNING.historyKeep);
    state.pendingCard = null;
    if (state.cardsSeen.indexOf(card.id) < 0) state.cardsSeen.push(card.id);
    var events = applyEffects(state, content, opt.effects);
    if (card.notebook) { var ne = unlockNotebook(state, content, card.notebook); if (ne) events.push(ne); }
    pushLog(state, 'card', (card.title || card.id) + ': ' + (opt.label || opt.id));
    // effects may change delivery need / price lock
    if (state.level < 2) state.offer.price = 0;
    // systems and staff output follow the new state (energy is re-split tomorrow, as in v0.1)
    recomputeSystems(state, content);
    state._team = teamInfo(state, content);
    return { events: events };
  }

  function rewind(state, historyIndex) {
    var h = arr(state.history);
    var idx = Math.floor(num(historyIndex, -1));
    if (idx < 0 || idx >= h.length) return state;
    var ns = clone(h[idx].snapshot);
    ns.history = clone(h.slice(0, idx));
    ns.gameOver = null;
    return ns;
  }

  function pickCard(state, content, memo) {
    var cards = arr(content.cards), best = null;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c || !c.id || state.cardsSeen.indexOf(c.id) >= 0 || arr(state._cardQueue).indexOf(c.id) >= 0) continue;
      if (!Array.isArray(c.options) || !c.options.length) continue;
      if (c.level !== undefined && state.level < c.level) continue;
      if (best && !(num(c.priority, 0) > num(best.priority, 0) ||
        (num(c.priority, 0) === num(best.priority, 0) && num(c.level, 0) < num(best.level, 0)))) continue;
      if (!checkCond(state, content, c.trigger, memo)) continue;
      best = c;
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // the day
  // ---------------------------------------------------------------------------
  function planShares(state) {
    // locked channels' shares fall through to the other unlocked outreach channels (or sales)
    var p = state.plan, sh = { warm: 0, cold: 0, content: 0, sales: num(p.sales, 0) }, spill = 0;
    ['warm', 'cold', 'content'].forEach(function (k) {
      if (state.channels[k].unlocked) sh[k] = num(p[k], 0); else spill += num(p[k], 0);
    });
    if (spill > 0) {
      var outs = ['warm', 'cold', 'content'].filter(function (k) { return state.channels[k].unlocked && sh[k] > 0; });
      if (outs.length) outs.forEach(function (k) { sh[k] += spill / outs.length; });
      else if (state.channels.cold.unlocked) sh.cold += spill; else sh.warm += spill;
    }
    var sum = sh.warm + sh.cold + sh.content + sh.sales;
    if (sum <= 0) return { warm: 0.6, cold: 0, content: 0, sales: 0.4 };
    return { warm: sh.warm / sum, cold: sh.cold / sum, content: sh.content / sum, sales: sh.sales / sum };
  }

  // yieldMult (optional, setters only): share of the normal cold reply rate this batch gets
  function outreachBatch(state, content, channel, actions, yieldMult) {
    var n = stochRound(state, actions), leads = 0;
    if (n <= 0) return { actions: 0, leads: 0 };
    if (channel === 'warm') {
      n = Math.min(n, Math.floor(state.network.available));
      state.network.available -= n;
      leads = binom(state, n, warmReply(state, content));
      addLeads(state, leads, TUNING.qWarm);
    } else {
      leads = binom(state, n, coldReply(state, content) * (yieldMult === undefined ? 1 : yieldMult));
      addLeads(state, leads, TUNING.qCold);
    }
    state.stats.outreachTotal += n; state._today.outreach += n;
    return { actions: n, leads: leads };
  }

  function addCohort(state, kind, n, days, price, e, rr) {
    if (n <= 0) return;
    state._cohorts.push({ day: state.day, kind: kind, n: n, end: state.day + Math.max(1, Math.round(days)),
      price: price || 0, e: e || 1, rd: kind === 'trial' ? 0 : state.day + TUNING.refundWindow, rr: rr || 0 });
  }

  function earn(state, amount) {
    state.cash += amount; state.stats.revenueTotal += amount; state._today.revenue += amount;
  }

  function runFunnel(state, content, salesEnergy, events) {
    var cap = stochRound(state, salesEnergy * TUNING.autopilotEff / TUNING.callEnergy);
    var held = 0, closes = 0, trials = 0, saleCash = 0, downs = 0, hooks = 0;
    var paid = isPaid(state);
    var br = bookedRate(state), sr = showRate(state);
    var cr = closeRate(state, content), price = state.offer.price;
    var fl = getFlavor(state, content);
    var trialDays = num(fl.trialDays, TUNING.trialDaysDefault), delDays = num(fl.deliveryDays, TUNING.deliveryDaysDefault);
    var up = state.combos.upsell.unlocked && state.combos.upsell.on && paid;
    var ds = state.combos.downsell.unlocked && state.combos.downsell.on && paid;
    var mem = state.combos.membership.unlocked && state.combos.membership.on && paid;
    var hk = hookOn(state);
    var dsPrice = downsellPrice(state), recovered = 0, ups = 0, upCash = 0;
    // share of today's customers who came from ad leads (ad leads book less often, hence × qAds ÷ pool quality)
    var adFrac = clamp(num(state._adShare, 0) * TUNING.qAds / Math.max(0.01, num(state._leadQ, 1)), 0, 1);
    var L = Math.floor(state.leads), worked = 0;
    var booked = 0, heldF = 0, heldT = 0;
    var tm = team(state), capT = isLate(state) && tm.calls > 0 ? stochRound(state, tm.calls) : 0;
    if (capT <= 0 && (!isLate(state) || L <= TUNING.aggLeadMin)) {
      // exact per-lead loop (Levels 1–3 and small late-game funnels): the v0.1 RNG stream
      while (worked < L && held < cap) {
        worked++;
        if (!chance(state, br)) continue;
        booked++;
        if (hk && chance(state, TUNING.hookTake)) { hooks++; earn(state, state.combos.hook.price); }
        if (!chance(state, sr)) { if (chance(state, TUNING.noShowRecover)) recovered++; continue; }
        held++;
        if (chance(state, cr)) {
          if (!paid) { trials++; continue; }
          closes++; saleCash += price; earn(state, price);
          if (up && chance(state, upsellTake(state))) { ups++; upCash += state.combos.upsell.price; earn(state, state.combos.upsell.price); }
          if (mem && chance(state, memberTake(state))) state.customers.members += 1;
        } else if (ds && dsPrice > 0 && chance(state, downsellTake(state))) {
          downs++; earn(state, dsPrice);
          if (mem && chance(state, memberTake(state))) state.customers.members += 1;
        }
      }
      heldF = held;
    } else {
      // aggregate (binomial) funnel for big numbers: sales reps take calls first, the founder fills the rest
      var capAll = cap + capT, pShow = br * sr;
      if (capAll > 0 && L > 0) {
        worked = L * pShow <= capAll ? L : Math.min(L, Math.ceil(capAll / Math.max(1e-6, pShow)));
        booked = binom(state, worked, br);
        if (hk) { hooks = binom(state, booked, TUNING.hookTake); earn(state, hooks * state.combos.hook.price); }
        var shows = binom(state, booked, sr);
        recovered = binom(state, booked - shows, TUNING.noShowRecover);
        held = Math.min(capAll, shows);
        recovered += shows - held;                 // booked but nobody was free to take the call
        heldT = Math.min(held, capT); heldF = held - heldT;
        var crT = paid ? clamp(cr * tm.closeMult, TUNING.closeMin, TUNING.closeMax) : cr * tm.closeMult;
        var yesF = binom(state, heldF, cr), yesT = binom(state, heldT, crT);
        if (!paid) trials = yesF + yesT;
        else {
          closes = yesF + yesT; saleCash = closes * price; earn(state, saleCash);
          if (up) { ups = binom(state, closes, upsellTake(state)); upCash = ups * state.combos.upsell.price; earn(state, upCash); }
          if (ds && dsPrice > 0) { downs = binom(state, held - closes, downsellTake(state)); earn(state, downs * dsPrice); }
          if (mem) state.customers.members += binom(state, closes + downs, memberTake(state));
        }
      }
    }
    state.leads = Math.max(0, state.leads - worked + recovered);
    state.stats.callsTotal += held; state._today.calls += held;
    state._today.booked += booked; state._today.shows += held;
    state._today.founderCalls += heldF; state._today.teamCalls += heldT;
    var usedEnergy = heldF * TUNING.callEnergy / TUNING.autopilotEff;
    if (trials) {
      addCohort(state, 'trial', trials, trialDays, 0, 1);
      state.stats.trialsStarted += trials; state._today.trials += trials; state.customers.total += trials;
      state.network.size += trials * TUNING.trialNetworkGain; state.network.available += trials * TUNING.trialNetworkGain;
      events.push({ type: 'trial', amount: trials, text: trials === 1 ? 'Someone started a free trial!' : trials + ' people started free trials!' });
    }
    var saleRR = paid ? saleRefundRate(state, content) : 0;
    state._today.adCustomers += (closes + downs) * adFrac;
    if (paid && closes + downs > 0) squadPayouts(state, closes, downs, price, dsPrice, events);
    if (closes) {
      addCohort(state, 'customer', closes, delDays, price, 1, saleRR);
      state.stats.salesCount += closes; state._today.sales += closes; state._today.newCustomers += closes;
      state.customers.total += closes;
      if (closes <= 5) for (var i = 0; i < closes; i++) events.push({ type: 'sale', amount: price, text: 'Sale! +' + money(price) });
      else events.push({ type: 'sale', amount: saleCash, text: closes + ' sales! +' + money(saleCash) });
    }
    if (downs) {
      addCohort(state, 'customer', downs, delDays, dsPrice, TUNING.downsellEnergy, saleRR);
      state.stats.salesCount += downs; state._today.sales += downs; state._today.newCustomers += downs;
      state.customers.total += downs;
      events.push({ type: 'sale', amount: downs * dsPrice, text: downs + ' took the lighter option: +' + money(downs * dsPrice) });
    }
    // combos pay out where the player can see it (info, not 'sale': these are not new customers)
    if (hooks && state.combos.hook.price > 0) events.push({ type: 'info', id: 'hook', amount: hooks * state.combos.hook.price, text: hooks + ' bought the Hook Offer: +' + money(hooks * state.combos.hook.price) });
    if (ups) events.push({ type: 'info', id: 'upsell', amount: upCash, text: ups + ' grabbed the Upsell: +' + money(upCash) });
    if (held) events.push({ type: 'call', amount: held, text: held + ' sales call' + (held === 1 ? '' : 's') + ' held' });
    return { held: held, usedEnergy: Math.min(salesEnergy, usedEnergy), cap: cap };
  }

  // fans earn their reward and partners their commission on sales from the leads they sent
  function squadPayouts(state, closes, downs, price, dsPrice, events) {
    var sq = state.squad, ss = state._srcShare || {}, q = Math.max(0.01, num(state._leadQ, 1)), cost = 0;
    if (sq.fans.on && num(ss.ref, 0) > 0) {
      var fanSales = (closes + downs) * clamp(ss.ref * TUNING.qReferral / q, 0, 1);
      cost += fanSales * Math.max(0, num(sq.fans.reward, 0));
    }
    if (num(ss.partner, 0) > 0) {
      var pf = clamp(ss.partner * TUNING.partnerQuality / q, 0, 1);
      cost += pf * (closes * price + downs * dsPrice) * clamp(num(sq.partners.commission, TUNING.partnerCommission), 0, 1);
    }
    if (cost > 0) { state.cash -= cost; state._today.squadSpend += cost; }
  }

  function processCohorts(state, content, events) {
    var keep = [], co = arr(state._cohorts);
    var fl = state.offer, testiP = clamp((TUNING.testimonialBase + TUNING.testimonialLikelihood * (fl.likelihood - 3) +
      TUNING.testimonialEase * (fl.ease - 3) + TUNING.testimonialProof * state.skills.proof) *
      m(state, 'testimonialChance') * (state._overloaded ? TUNING.overloadTestimonialMult : 1), 0.05, 0.95);
    var tGot = 0, cGot = 0, refunded = 0, refundCash = 0;
    for (var i = 0; i < co.length; i++) {
      var c = co[i];
      if (c.kind !== 'trial' && c.rd && state.day >= c.rd) {
        // refund chance from the terms of the sale (old saves: today's terms); only the overload is live
        var r = binom(state, c.n, withOverload(state, c.rr !== undefined ? num(c.rr, 0) : saleRefundRate(state, content)));
        if (r > 0) {
          c.n -= r; refunded += r; refundCash += r * c.price;
          state.cash -= r * c.price; state.stats.revenueTotal -= r * c.price; state._today.revenue -= r * c.price;
        }
        c.rd = 0;
      }
      if (c.n <= 0) continue;
      if (state.day >= c.end) {
        if (c.kind === 'premium') continue;   // premium buyers were already customers
        if (c.kind === 'trial') {
          state.stats.trialsCompleted += c.n;
          var t = binom(state, c.n, testiP); tGot += t;
          state.network.size += c.n; state.network.available += c.n * 0.5;
        } else {
          state._today.finished += c.n;
          tGot += binom(state, c.n, testiP * TUNING.paidTestimonialMult);
          cGot += binom(state, c.n, TUNING.caseStudyChance * (1 + 0.2 * state.skills.proof) * (state._overloaded ? 0.5 : 1));
        }
        continue;
      }
      keep.push(c);
    }
    state._cohorts = keep;
    if (refunded) {
      state.stats.refunds += refunded; state._today.refunds += refunded;
      var rt = refunded === 1 ? 'A customer asked for a refund (-' + money(refundCash) + ')' : refunded + ' refunds (-' + money(refundCash) + ')';
      events.push({ type: 'refund', amount: -refundCash, text: rt }); pushLog(state, 'refund', rt);
    }
    if (tGot) {
      state.reputation.testimonials += tGot;
      var tt = tGot === 1 ? 'New testimonial! Proof sells.' : tGot + ' new testimonials!';
      events.push({ type: 'testimonial', amount: tGot, text: tt }); pushLog(state, 'testimonial', tt);
    }
    if (cGot) {
      state.reputation.caseStudies += cGot;
      var ct = cGot === 1 ? 'A client result turned into a case study!' : cGot + ' new case studies!';
      events.push({ type: 'testimonial', amount: cGot, text: ct }); pushLog(state, 'testimonial', ct);
    }
    recountCustomers(state);
  }

  function processMembers(state, content, events) {
    var mem = state.customers.members;
    if (mem <= 0) return;
    var price = num(state.combos.membership.price, 0);
    if (state.combos.membership.on) {
      earn(state, mem * price / 30);
      state._memberWeek = num(state._memberWeek, 0) + mem * price / 30;
    }
    var daily = 1 - Math.pow(1 - churnMonthly(state, content), 1 / 30);
    var lost = binom(state, mem, daily);
    if (!state.combos.membership.on) lost = mem; // turning it off ends memberships
    if (lost > 0) {
      state.customers.members = mem - lost;
      var t = lost === 1 ? 'A member cancelled' : lost + ' members cancelled';
      events.push({ type: 'churn', amount: lost, text: t });
    }
  }
  function memberWeekly(state, events) {
    if (state.day % 7 !== 0) return;
    var wk = Math.round(num(state._memberWeek, 0));
    state._memberWeek = 0;
    if (wk > 0) events.push({ type: 'info', id: 'membership', amount: wk, text: 'Members paid you ' + money(wk) + ' this week' });
  }

  function processContent(state, content) {
    var posts = arr(state.channels.content.posts), keep = [], leads = 0;
    for (var i = 0; i < posts.length; i++) {
      var age = state.day - posts[i].day;
      if (age >= TUNING.contentLifeDays) continue;
      leads += num(posts[i].reach, 0) * TUNING.contentLeadRate * Math.exp(-age / TUNING.contentDecayDays);
      keep.push(posts[i]);
    }
    state.channels.content.posts = keep;
    addLeads(state, stochRound(state, leads * leadVol(state)), TUNING.qContent);
  }

  // Level 4+: how far below $0 the business card lets ads keep running (0 before Level 4)
  function creditLine(state) {
    if (!isLate(state)) return 0;
    var d = arr(state.stats.daily), n = 0, rev = 0;
    for (var i = Math.max(0, d.length - 30); i < d.length; i++) { rev += num(d[i].revenue, 0); n++; }
    return Math.max(TUNING.creditLineMin, TUNING.creditLineDays * (n ? rev / n : 0));
  }
  // Level 4+ grace below $0: longer while the last 30 days still made an operating profit. Fixed for the
  // whole dip when cash first drops below $0 (_graceDays), so the countdown the player sees never jumps.
  function graceDaysOf(state) {
    if (!isLate(state)) return TUNING.gameOverDays;
    if (num(state._negCashDays, 0) > 0 && num(state._graceDays, 0) > 0) return state._graceDays;
    var d = arr(state.stats.daily), p = 0, n = 0;
    for (var i = Math.max(0, d.length - 30); i < d.length; i++) { p += num(d[i].profit, 0); n++; }
    return n >= 7 && p > 0 ? TUNING.gameOverDaysLateProfit : TUNING.gameOverDaysLate;
  }
  function processAds(state, content) {
    var b = Math.min(num(state.channels.ads.dailyBudget, 0), adCap(state));
    if (!state.channels.ads.unlocked || b <= 0) return 0;
    var spend = Math.max(0, Math.min(b, Math.floor(state.cash + creditLine(state))));
    if (spend <= 0) return 0;
    state.cash -= spend; state.stats.adSpendTotal += spend; state._today.adSpend += spend;
    addLeads(state, stochRound(state, spend / adCplAt(state, content, spend) * leadVol(state)), TUNING.qAds, true);
    return spend;
  }

  // --- late-game daily pieces (all skip RNG entirely while unused, so Levels 1–3 replay exactly) ---
  function setterSplit(state) {
    var sh = planShares(state), w = state.channels.warm.unlocked ? sh.warm : 0, c = state.channels.cold.unlocked ? sh.cold : 0;
    if (w + c <= 0) { if (state.channels.cold.unlocked) c = 1; else w = 1; }
    return w / (w + c);
  }
  // the more cold messages a team sends each day, the colder the list gets: reply rate ÷ √(1 + actions ÷ setterSaturation)
  function setterYield(actions, state) {
    return 1 / Math.sqrt(1 + Math.max(0, num(actions, 0)) / TUNING.setterSaturation) / (state ? marketDepth(state) : 1);
  }
  // setters: outreach actions split warm/cold like the plan (warm only while friends remain)
  function processSetters(state, content) {
    var acts = team(state).outreach;
    if (!(acts > 0)) return 0;
    var before = state._today.leads, wantW = acts * setterSplit(state);
    var canW = Math.min(wantW, Math.floor(state.network.available));
    outreachBatch(state, content, 'warm', canW);
    if (state.channels.cold.unlocked) outreachBatch(state, content, 'cold', acts - canW, setterYield(acts - canW, state));
    return state._today.leads - before;
  }
  function agencyLeadsFor(state, content, retainer) {
    if (!(retainer > 0)) return 0;
    return retainer / (adCpl(state, content) * TUNING.agencyCplMult * Math.sqrt(1 + retainer / TUNING.agencySaturation)) * leadVol(state);
  }
  function partnerLeadsFor(state) {
    var n = Math.max(0, Math.floor(num(state.squad.partners.count, 0)));
    if (n <= 0) return 0;
    var comm = clamp(num(state.squad.partners.commission, TUNING.partnerCommission), 0.05, 0.5);
    return n * TUNING.partnerLeads * Math.sqrt(comm / TUNING.partnerCommission) * leadVol(state);
  }
  // agency retainer + partners
  function processSquad(state, content) {
    var sq = state.squad, before = state._today.leads;
    var ret = state.level >= TUNING.squadAgencyLevel ? Math.min(num(sq.agency.retainer, 0), adCap(state)) : 0;
    if (ret > 0) {
      var pay = Math.max(0, Math.min(ret, Math.floor(state.cash)));
      if (pay > 0) {
        state.cash -= pay; state._today.squadSpend += pay;
        addLeads(state, stochRound(state, agencyLeadsFor(state, content, pay)), TUNING.agencyQuality, false, 'agency');
      }
    }
    var pl = partnerLeadsFor(state);
    if (pl > 0) addLeads(state, stochRound(state, pl), TUNING.partnerQuality, false, 'partner');
    return state._today.leads - before;
  }
  function fanMult(state) {
    if (!(state.level >= TUNING.squadFansLevel && state.squad.fans.on)) return 1;
    var r = clamp(Math.sqrt(Math.max(0, num(state.squad.fans.reward, TUNING.fanRewardDefault)) / TUNING.fanRewardDefault), 0.3, 1.6);
    return 1 + (TUNING.fanReferralMult - 1) * r;
  }
  function processPremium(state, content, events) {
    var p = state.premium;
    if (p.buildDays > 0) {
      p.buildDays = Math.max(0, Math.round(p.buildDays) - 1);
      if (p.buildDays === 0) {
        p.built = true; p.on = true;
        var base = state.offer.price > 0 ? state.offer.price : num(getFlavor(state, content).suggestedPrice, 500);
        if (!(p.price > 0)) p.price = Math.round(base * premiumDefaults(content).priceMult);
        var t = (p.name || 'Your premium product') + ' is ready and on sale at ' + money(p.price) + '!';
        events.push({ type: 'info', id: 'premium_ready', text: t }); pushLog(state, 'info', t);
        var ne = unlockNotebook(state, content, 'second_product'); if (ne) events.push(ne);
      }
      return;
    }
    var exp = premiumExpected(state, content, state._today.finished);
    if (!(exp > 0)) return;
    var n = stochRound(state, exp);
    if (n <= 0) return;
    var cash = n * p.price, fl = getFlavor(state, content);
    earn(state, cash); state._today.premiumRevenue += cash; state._today.premiumSales += n;
    state._cohorts.push({ day: state.day, kind: 'premium', n: n, end: state.day + Math.max(1, Math.round(num(fl.deliveryDays, TUNING.deliveryDaysDefault))),
      price: p.price, e: premiumDefaults(content).energy, rd: 0, rr: 0 });
    events.push({ type: 'info', id: 'premium', amount: cash, text: (n === 1 ? 'A customer' : n + ' customers') + ' upgraded to ' + (p.name || 'premium') + ': +' + money(cash) });
  }
  // payroll, ramp-up, morale (no RNG)
  function processTeam(state, content) {
    var tm = team(state), t = state.team;
    if (tm.payroll > 0) { state.cash -= tm.payroll; state._today.payroll += tm.payroll; }
    var rp = arr(t.ramp), keep = [];
    for (var i = 0; i < rp.length; i++) {
      var e = rp[i]; if (!e || !(e.n > 0)) continue;
      e.daysLeft = Math.round((num(e.daysLeft, 0) - 1) * 10) / 10;
      if (e.daysLeft > 0) keep.push(e);
    }
    t.ramp = keep;
    if (tm.staff > 0) {
      var mo = num(t.morale, TUNING.moraleBase);
      mo += (TUNING.moraleBase - mo) * TUNING.moraleDrift;
      if (state._overloaded) mo -= TUNING.moraleOverload;
      if (state.burnout > 70) mo -= TUNING.moraleBurnout;
      if (state.cash < 0) mo -= TUNING.moraleBroke;
      if (tm.unmanaged > 0) mo -= TUNING.moraleUnmanaged * Math.min(1, tm.unmanaged / Math.max(1, tm.staff) * 3);
      t.morale = Math.round(clamp(mo, 0, 100) * 10) / 10;
    }
  }

  // forward sims only: re-seed the RNG per day *and* per phase of the day (see simulateForward)
  function crn(state, phase) {
    if (state._crnDay !== undefined) state.rng = ((state._crnDay >>> 0) ^ Math.imul(phase, 0x27D4EB2F)) >>> 0;
  }
  function tick(state, content, _opts) {
    content = C(content);
    var opts = _opts || state._sim || {};
    var events = [];
    if (state.gameOver) return { events: events };
    if (state.exit && state.exit.sold) return { events: events };   // the company is sold: this run is over
    // old v0.1 saves graduated at "Level 4 coming soon": resume once that level is playable
    if (state.graduated && state.level >= 4 && state.level <= TUNING.maxLevel && levelPlayable(content, state.level)) {
      state.graduated = false;
      events = events.concat(enterLevel(state, content, state.level));
      afterAction(state, content);
    }
    var memo = {};

    // 1. Autopilot spends leftover energy. The plan's sales share of the day's free energy is kept
    //    for calls (taps cannot dip into it); outreach and posts split what is left.
    var left = Math.max(0, state.energy.current);
    var sh = planShares(state), eff = TUNING.autopilotEff;
    var dayFree = Math.max(left, num(state._dayFree, left));
    var salesE = Math.min(left, dayFree * sh.sales), outE = left - salesE, oSh = 1 - sh.sales;
    var oW = oSh > 0 ? sh.warm / oSh : 0, oC = oSh > 0 ? sh.cold / oSh : 0, oT = oSh > 0 ? sh.content / oSh : 0;
    var leadsBefore = state._today.leads;
    // friend messages that have nobody left to go to are redirected to Cold Calls once unlocked
    function warmThenCold(warmWant, coldWant, coldPhase) {
      var warmCan = Math.min(warmWant, Math.floor(state.network.available));
      var wr = outreachBatch(state, content, 'warm', warmCan);
      if (coldPhase) crn(state, coldPhase);
      var coldExtra = state.channels.cold.unlocked ? Math.max(0, warmWant - warmCan) : 0;
      var cr = outreachBatch(state, content, 'cold', coldWant + coldExtra);
      state._today.leadEnergy += (wr.actions + cr.actions) / eff;
    }
    crn(state, 1);
    warmThenCold(outE * oW * eff, outE * oC * eff, 2);
    var contentE = outE * oT, posts = stochRound(state, contentE * eff / TUNING.postEnergy);
    for (var pi = 0; pi < posts; pi++) makePost(state, content);
    state._today.leadEnergy += contentE;
    var teamLeads = 0;
    if (team(state).outreach > 0) { crn(state, 21); teamLeads = processSetters(state, content); }
    crn(state, 3);
    var f = runFunnel(state, content, salesE, events);
    state._today.leadEnergy += f.usedEnergy;
    // unused sales energy spills into outreach (leads arrive for tomorrow)
    crn(state, 4);
    var spillE = Math.max(0, salesE - f.usedEnergy);
    if (spillE > 0.5) {
      var ow = state.channels.warm.unlocked ? sh.warm : 0, oc = state.channels.cold.unlocked ? sh.cold : 0;
      if (ow + oc <= 0) { if (state.channels.cold.unlocked) oc = 1; else ow = 1; }
      warmThenCold(spillE * ow / (ow + oc) * eff, spillE * oc / (ow + oc) * eff);
    }
    state.energy.current = 0;
    var outreachLeads = state._today.leads - leadsBefore - teamLeads;

    // 2. other lead sources
    crn(state, 5);
    var lb = state._today.leads;
    processContent(state, content);
    var contentLeads = state._today.leads - lb;
    if (state.audience > 0) state.audience = Math.round(state.audience * (1 - TUNING.audienceDecay) * 10) / 10;
    crn(state, 6);
    lb = state._today.leads;
    var spend = processAds(state, content);
    var adLeads = state._today.leads - lb;
    var squadLeads = 0;
    if (state.level >= TUNING.squadAgencyLevel && (num(state.squad.agency.retainer, 0) > 0 || num(state.squad.partners.count, 0) > 0)) {
      crn(state, 22); squadLeads = processSquad(state, content);
    }
    crn(state, 7);
    var refN = ((state.customers.active + state.customers.members) * TUNING.referralRate +
      state.customers.trials * TUNING.trialReferralRate) * m(state, 'referralRate') *
      (1 + Math.min(0.4, TUNING.referralProofBonus * state.reputation.testimonials)) * fanMult(state) * leadVol(state);
    lb = state._today.leads;
    addLeads(state, stochRound(state, refN), TUNING.qReferral, false, 'ref');
    var refLeads = state._today.leads - lb;
    var newLeads = state._today.leads - leadsBefore;
    if (newLeads > 0) {
      var srcs = [['outreach', outreachLeads, 'from Autopilot outreach'], ['setters', teamLeads, 'from your setters'],
        ['content', contentLeads, 'from your content'], ['ads', adLeads, 'from ads'], ['Lead Squad', squadLeads, 'from your Lead Squad'],
        ['referrals', refLeads, 'from referrals']].filter(function (x) { return x[1] > 0; });
      var lt0 = '+' + newLeads + ' lead' + (newLeads === 1 ? '' : 's');
      events.push({ type: 'lead', amount: newLeads, text: srcs.length === 1 ? lt0 + ' ' + srcs[0][2] :
        lt0 + ' (' + srcs.map(function (x) { return x[0] + ' ' + x[1]; }).join(', ') + ')' });
    }

    // 3. delivery, refunds, trials → testimonials, members
    crn(state, 8);
    processCohorts(state, content, events);
    crn(state, 9);
    processMembers(state, content, events);
    memberWeekly(state, events);
    if (state.premium.built || state.premium.buildDays > 0) { crn(state, 23); processPremium(state, content, events); }

    // 4. leads go cold
    crn(state, 10);
    var decay = TUNING.leadDecay * m(state, 'leadDecay') * Math.max(0.2, 1 - TUNING.nurtureDecayCut * state.skills.nurture);
    state.leads = Math.max(0, state.leads - binom(state, Math.floor(state.leads), clamp(decay, 0, 1)));

    // 5. living cost, payroll, buffs, burnout, network refill
    state.cash -= state.livingCost;
    processTeam(state, content);
    // Level 4+ running costs that grow with sales: software, rent, card fees, contractors
    if (isLate(state) && TUNING.opexShare > 0 && state._today.revenue > 0) {
      var opex = state._today.revenue * TUNING.opexShare;
      state.cash -= opex; state._today.opex += opex;
    }
    // Level 4+: interest on the part of the credit line in use (a negative balance)
    if (isLate(state) && state.cash < 0 && TUNING.creditInterest > 0) {
      var interest = -state.cash * TUNING.creditInterest;
      state.cash -= interest; state._today.interest = num(state._today.interest, 0) + interest;
    }
    state.buffs = arr(state.buffs).filter(function (b) { b.daysLeft -= 1; return b.daysLeft > 0; });
    if (state._restDays > 0) {
      state._restDays -= 1;
      if (state._restDays === 0) state.burnout = TUNING.burnoutAfterRest;
    } else {
      // burnout that hit 100 earlier today (overtime, a card, an event) forces rest before any recovery
      var maxedOut = state.burnout >= 100;
      if (state._overloaded) state.burnout = Math.min(100, state.burnout + TUNING.overloadBurnout);   // no recovery while overloaded
      else if (!state.energy.overtimeToday) state.burnout = Math.max(0, state.burnout - TUNING.burnoutDecay);
      if (maxedOut || state.burnout >= 100) {
        state._restDays = TUNING.burnoutRestDays; state.burnout = 100;
        var bt = 'Burnout! You need ' + TUNING.burnoutRestDays + ' days of rest.';
        events.push({ type: 'burnout', text: bt }); pushLog(state, 'burnout', bt);
      }
    }
    var gap = state.network.size - state.network.available;
    if (gap > 0) state.network.available = Math.min(state.network.size, state.network.available +
      gap * (state.level <= 1 ? TUNING.networkRefillL1 : TUNING.networkRefill));

    // 5b. systems (engine-late): once per tick after cohorts/members, before goals
    if (systems.length) {
      for (var si = 0; si < systems.length; si++) {
        var sys = systems[si];
        if (!sysActive(state, sys) || !sys.onDay) continue;
        crn(state, 40 + si);
        try { sys.onDay(state, content, API, events); } catch (err) { warn('system ' + sys.id + ' onDay failed: ' + (err && err.message)); }
      }
    }

    // 6. daily grind streak
    if (state._today.leadEnergy >= TUNING.grindEnergy) state.streak.grindDays += 1; else state.streak.grindDays = 0;
    // consistency streak: consecutive days with at least one new customer (Level 3 goal)
    state.streak.saleDays = state._today.newCustomers > 0 ? num(state.streak.saleDays, 0) + 1 : 0;

    // 7. stats.daily (pushed before goal checks so 30-day numbers include today)
    state.stats.daily.push({ day: state.day, cash: Math.round(state.cash), revenue: Math.round(state._today.revenue),
      leads: state._today.leads, sales: state._today.sales, adSpend: spend,
      calls: state._today.calls, trials: state._today.trials, newCustomers: state._today.newCustomers,
      toolSpend: state._today.toolSpend, refunds: state._today.refunds, adCustomers: round2(state._today.adCustomers),
      payroll: Math.round(state._today.payroll), premiumRevenue: Math.round(state._today.premiumRevenue),
      squadSpend: Math.round(state._today.squadSpend), invest: Math.round(state._today.invest), opex: Math.round(state._today.opex || 0),
      loss: Math.round(num(state._today.loss, 0)), interest: Math.round(num(state._today.interest, 0)),
      cost: Math.round(dayCost(state, spend)), profit: Math.round(state._today.revenue - dayCost(state, spend)),
      headcount: headcountOf(state, content) });
    if (state.stats.daily.length > TUNING.dailyKeep) state.stats.daily.splice(0, state.stats.daily.length - TUNING.dailyKeep);
    if (state._today.sales > 0) pushLog(state, 'sale', state._today.sales + ' sale' + (state._today.sales === 1 ? '' : 's') + ' today (' + money(state._today.revenue) + ')');
    else if (state._today.trials > 0) pushLog(state, 'trial', state._today.trials + ' new free trial' + (state._today.trials === 1 ? '' : 's'));

    // 8. random events
    if (!opts.noEvents) {
      var evs = arr(content.events);
      for (var ei = 0; ei < evs.length; ei++) {
        var ev = evs[ei];
        if (!ev || !ev.id) continue;
        var seen = state._eventsSeen[ev.id];
        var once = ev.once !== false;
        if (seen !== undefined && (once || state.day - seen < TUNING.eventCooldown)) continue;
        if (!checkCond(state, content, ev.cond, memo)) continue;
        if (!(rand(state) < num(ev.chancePerDay, 0.03))) continue;
        state._eventsSeen[ev.id] = state.day;
        var eevs = applyEffects(state, content, ev.effects);
        events.push({ type: 'event', id: ev.id, text: (ev.emoji ? ev.emoji + ' ' : '') + (ev.text || '') });
        pushLog(state, 'event', ev.text);
        events = events.concat(eevs);
        memo = {};
        break; // at most one random event per day
      }
    }

    // 9. client-financed acquisition: judged on real ad spend and the customers ads actually brought
    //    (paid CAC), re-checked daily; the cap comes back after cfLoseDays days of ads not paying back.
    if (state.level >= 3) {
      memo.metrics = memo.metrics || computeMetrics(state, content, true);
      var mt = memo.metrics, last = last30(state);
      var adData = last.adDays >= TUNING.cfMinAdDays && last.adSpend >= TUNING.cfMinAdSpend;
      var adPays = adData && last.newCustomers >= TUNING.cfMinCustomers && last.adCustomers > 0 &&
        mt.cash30PerCustomer >= last.adSpend / last.adCustomers;
      if (!state._clientFinanced && adPays) {
        // The achievement itself is content-driven (base.js reads {flag:'clientFinanced'}) and fires
        // in step 10 below; the engine only announces the lifted cap.
        state._clientFinanced = true; state.flags.clientFinanced = true; state._cfFailDays = 0;
        var at = 'New customers from ads now pay back their ad cost within 30 days. Ad cap removed!';
        events.push({ type: 'info', id: 'ad_cap_removed', text: at }); pushLog(state, 'info', at);
        var ne = unlockNotebook(state, content, 'client_financed'); if (ne) events.push(ne);
      } else if (state._clientFinanced) {
        if (adPays) state._cfFailDays = 0;
        else if (adData) state._cfFailDays = num(state._cfFailDays, 0) + 1;
        if (state._cfFailDays >= TUNING.cfLoseDays) {
          state._clientFinanced = false; state.flags.clientFinanced = false; state._cfFailDays = 0;
          state.channels.ads.dailyBudget = Math.min(num(state.channels.ads.dailyBudget, 0), TUNING.adCapBeforeCF);
          var lt2 = 'Ads stopped paying back within 30 days. Ad cap back to ' + money(TUNING.adCapBeforeCF) + '/day until they do.';
          events.push({ type: 'info', id: 'ad_cap_back', text: lt2 }); pushLog(state, 'info', lt2);
        }
      }
    }

    // 10. coach lines (one per day), achievements
    if (!opts.noCoach) {
      var co = arr(content.coach);
      for (var ci = 0; ci < co.length; ci++) {
        var cl = co[ci];
        if (!cl || !cl.id || state.coachSeen.indexOf(cl.id) >= 0) continue;
        if (!checkCond(state, content, cl.cond, memo)) continue;
        state.coachSeen.push(cl.id);
        events.push({ type: 'coach', id: cl.id, text: cl.text || '' });
        break;
      }
    }
    var achs = arr(content.achievements);
    for (var ai = 0; ai < achs.length; ai++) {
      var a = achs[ai];
      if (!a || !a.id || state.achievements.indexOf(a.id) >= 0 || !a.cond) continue;
      if (!checkCond(state, content, a.cond, memo)) continue;
      state.achievements.push(a.id);
      var atx = (a.emoji ? a.emoji + ' ' : '') + (a.name || a.id) + (a.desc ? ' — ' + a.desc : '');
      events.push({ type: 'achievement', id: a.id, text: atx }); pushLog(state, 'achievement', atx);
    }

    // 11. level goal. Cards whose trigger holds today are queued before the level-up (one extra slot on a
    //     level-up day), so a level-up on the same tick cannot wipe out a card that only fits the old level.
    var g = (!state.graduated && state.level <= TUNING.maxLevel) ? getGoal(state, content) : null;
    var goalMet = !!(g && g.items.length && g.progress >= 1);
    // Level 10 never auto-levels: the player sells at The Summit (engine-late sellCompany)
    var willLevel = goalMet && state.level < TUNING.maxLevel;
    if (goalMet && state.level >= TUNING.maxLevel && !state._summitReady) {
      state._summitReady = true;
      var sr = 'Goal reached! The Summit is ready when you are: sell the company or keep growing the price.';
      events.push({ type: 'info', id: 'summit_ready', text: sr }); pushLog(state, 'info', sr);
    }
    if (!Array.isArray(state._cardQueue)) state._cardQueue = [];
    if (!opts.noCards && !state.pendingCard && (state._cardQueue.length === 0 || (willLevel && state._cardQueue.length < 2))) {
      var qc = pickCard(state, content, memo);
      if (qc) state._cardQueue.push(qc.id);
    }
    if (willLevel) {
      var def = getLevelDef(content, state.level);
      var from = state.level;
      state.level += 1;
      var nd = getLevelDef(content, state.level);
      var lt = (def && def.outro) || ('Level ' + from + ' complete!');
      events.push({ type: 'levelUp', level: state.level, text: lt });
      pushLog(state, 'levelUp', 'Reached Level ' + state.level + (nd && nd.name ? ': ' + nd.name : ''));
      if (!levelPlayable(content, state.level)) {
        state.graduated = true;
        events.push({ type: 'graduated', level: state.level, text: from === 3 ? 'You beat the first three levels!' : 'You beat the first ' + from + ' levels!' });
      } else {
        events = events.concat(enterLevel(state, content, state.level));
      }
      memo = {};
    }

    // 12. choice card: queued cards wait for breathing room (not on day 1, not on a level-up day,
    //     at least cardGapDays apart), so the intro and level-up screens never stack with a card
    if (!opts.noCards && !state.pendingCard) {
      var q = state._cardQueue = state._cardQueue.filter(function (id) { return findById(content.cards, id) && state.cardsSeen.indexOf(id) < 0; });
      if (!q.length) { var nc = pickCard(state, content, memo); if (nc) q.push(nc.id); }
      if (q.length && !willLevel && state.day >= TUNING.cardFirstDay && state.day - num(state._lastCardDay, -99) >= TUNING.cardGapDays) {
        var card = findById(content.cards, q.shift());
        state.pendingCard = card.id; state._lastCardDay = state.day;
        events.push({ type: 'card', id: card.id, text: card.title || '' });
      }
    }

    // 13. negative cash streak
    // Level 4+: a negative balance inside the credit line is borrowing, not a crisis; the countdown runs
    // only while cash sits below −creditLine (before Level 4: below $0)
    if (state.cash < -creditLine(state)) { if (!state._negCashDays) state._graceDays = graceDaysOf(state); state._negCashDays += 1; }
    else { state._negCashDays = 0; state._graceDays = 0; }
    var goDays = graceDaysOf(state);
    if (state._negCashDays >= goDays) {
      state.gameOver = { reason: (isLate(state) ? 'Past the credit line for ' : 'Out of cash for ') + goDays + ' days. Back to the 9-to-5!', day: state.day };
      events.push({ type: 'gameOver', text: state.gameOver.reason }); pushLog(state, 'gameOver', state.gameOver.reason);
    }

    // 14. next day
    state._yesterday = state._today;
    state._today = newToday();
    state.day += 1;
    state.energy.overtimeToday = false;
    startDay(state, content);
    return { events: events };
  }

  // ---------------------------------------------------------------------------
  // forward simulation / ghost timeline
  // ---------------------------------------------------------------------------
  function seriesPoint(s) {
    return { day: s.day, cash: Math.round(s.cash), revenue30: Math.round(last30(s).revenue),
      customers: s.customers.active + s.customers.members, total: s.customers.total, level: s.level };
  }
  // SPEC-GAP: forward sims keep the player's plan/price/budget, but if the sim levels into L2+ with a
  // $0 price (the player never got to set one), Autopilot uses the flavor's suggested price so the
  // timeline shows real money instead of flat lines.
  function autoPrice(s, content) {
    if (s.level >= 2 && !(s.offer.price > 0)) {
      var fl = getFlavor(s, content);
      s.offer.price = Math.round(num(fl.suggestedPrice, num(fl.marketValue, TUNING.marketValueDefault) / 3));
    }
  }
  // _crnSeed (optional, used by ghostCompare): re-seed the RNG at the start of every simulated day
  // (and each phase of the day) from (seed, day). Every option's timeline then sees the same luck on the same day ("common random
  // numbers"), so the gap between options shows the decision, not one lucky extra sale.
  function simulateForward(state, content, days, _crnSeed) {
    content = C(content);
    var s = clone(state);
    s.history = [];
    s.pendingCard = null;
    var opts = { noCards: true, noEvents: true, noCoach: true };
    autoPrice(s, content);
    var out = [seriesPoint(s)];
    var n = Math.max(0, Math.floor(num(days, TUNING.ghostDaysDefault)));
    for (var i = 0; i < n; i++) {
      if (_crnSeed !== undefined) s._crnDay = s.rng = ((_crnSeed >>> 0) ^ Math.imul(i + 1, 0x85EBCA6B)) >>> 0;
      autoFires(s, content);
      tick(s, content, opts);
      autoPrice(s, content);
      out.push(seriesPoint(s));
    }
    return out;
  }
  // forward sims (Level 8+): Autopilot spends CEO attention on the biggest open fire (impact 2+), like a player
  // would, so a timeline that reaches Level 8 is not punished for fires nobody could touch. No RNG.
  function autoFires(s, content) {
    var E2 = ZTE.Engine;
    if (!(s.level >= 8) || !E2 || typeof E2.handleFire !== 'function' || !s.attention || !(s.attention.left >= 1)) return;
    var fs = arr(s.fires).filter(function (f) { return f && num(f.impact, 1) >= 2; });
    if (!fs.length) return;
    fs.sort(function (a, b) { return (num(b.impact, 1) - num(a.impact, 1)) || (num(a.daysLeft, 9) - num(b.daysLeft, 9)); });
    E2.handleFire(s, content, fs[0].uid);
  }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') ? performance.now() : Date.now();
  }
  function averageSeries(list) {
    var base = list[0], out = [];
    for (var i = 0; i < base.length; i++) {
      var p = { day: base[i].day, cash: 0, revenue30: 0, customers: 0, total: 0, level: 0 };
      for (var k = 0; k < list.length; k++) {
        var q = list[k][i] || list[k][list[k].length - 1];
        p.cash += q.cash; p.revenue30 += q.revenue30; p.customers += q.customers; p.total += q.total; p.level += q.level;
      }
      ['cash', 'revenue30', 'customers', 'total'].forEach(function (f) { p[f] = Math.round(p[f] / list.length); });
      p.level = Math.round(p.level / list.length * 10) / 10;
      out.push(p);
    }
    return out;
  }
  function ghostCompare(state, content, cardId) {
    content = C(content);
    var card = findById(content.cards, cardId || state.pendingCard);
    var res = {};
    if (!card) return res;
    var days = num(card.ghostDays, TUNING.ghostDaysDefault);
    var opts = arr(card.options).filter(function (o) { return o && o.id; });
    // Level 4+: fewer runs (heavier days). Runs are interleaved (run k of every option, then run k+1) and the
    // time budget is re-checked after every round, so a slow phone stops early but every option keeps the same
    // number of runs; at least ghostMinRuns rounds always run (fewer would let luck pick the winner).
    var late = isLate(state), nRuns = Math.max(1, Math.floor(num(TUNING.ghostRuns, 1)));
    if (late) nRuns = Math.max(1, Math.min(nRuns, Math.floor(num(TUNING.ghostRunsLate, nRuns))));
    var budget = late ? num(TUNING.ghostBudgetMs, 0) : 0, minRuns = Math.min(nRuns, Math.max(1, Math.floor(num(TUNING.ghostMinRuns, 3))));
    var starts = [], runs = {}, baseRng = state.rng >>> 0;
    opts.forEach(function (opt) {
      var s = clone(state);
      s.history = [];
      s.pendingCard = null;
      if (s.cardsSeen.indexOf(card.id) < 0) s.cardsSeen.push(card.id);
      applyEffects(s, content, opt.effects);
      if (s.level < 2) s.offer.price = 0;
      starts.push(s); runs[opt.id] = [];
    });
    // run k uses the state's own rng for k = 0, then derived seeds — identical across options
    var t0 = budget > 0 ? nowMs() : 0, done = 0;
    for (var k = 0; k < nRuns; k++) {
      var seedK = k === 0 ? baseRng : ((baseRng ^ Math.imul(k, 0x9E3779B1)) >>> 0);
      for (var oi = 0; oi < opts.length; oi++) {
        starts[oi].rng = seedK;
        runs[opts[oi].id].push(simulateForward(starts[oi], content, days, seedK));
      }
      done = k + 1;
      if (budget > 0 && done >= minRuns) {
        var spent = nowMs() - t0;
        if (spent + spent / done > budget) break;   // another round would burst the budget
      }
    }
    nRuns = done;
    opts.forEach(function (opt) { res[opt.id] = averageSeries(runs[opt.id]); });
    if (ZTE.Engine) ZTE.Engine._lastGhostRuns = nRuns;
    return res;
  }

  // ---------------------------------------------------------------------------
  // metrics
  // ---------------------------------------------------------------------------
  function last30(state) {
    var d = arr(state.stats.daily), o = { revenue: 0, adSpend: 0, toolSpend: 0, newCustomers: 0, sales: 0, leads: 0, days: 0, adDays: 0, adCustomers: 0,
      payroll: 0, premiumRevenue: 0, squadSpend: 0, invest: 0, cost: 0, profit: 0, opex: 0, loss: 0 };
    var adDayMin = Math.max(1, TUNING.cfAdDayShare * TUNING.adCapBeforeCF);   // $1 a day is not an ad test
    for (var i = Math.max(0, d.length - 30); i < d.length; i++) {
      o.revenue += num(d[i].revenue, 0); o.adSpend += num(d[i].adSpend, 0); o.toolSpend += num(d[i].toolSpend, 0);
      o.newCustomers += num(d[i].newCustomers, num(d[i].sales, 0)); o.sales += num(d[i].sales, 0);
      o.leads += num(d[i].leads, 0); o.days++; if (num(d[i].adSpend, 0) >= adDayMin) o.adDays++;
      o.adCustomers += num(d[i].adCustomers, 0);
      o.payroll += num(d[i].payroll, 0); o.premiumRevenue += num(d[i].premiumRevenue, 0);
      o.squadSpend += num(d[i].squadSpend, 0); o.invest += num(d[i].invest, 0); o.opex += num(d[i].opex, 0); o.loss += num(d[i].loss, 0);
      var dc = num(d[i].cost, num(d[i].adSpend, 0) + num(d[i].toolSpend, 0));
      o.cost += dc; o.profit += num(d[i].profit, num(d[i].revenue, 0) - dc);
    }
    o.adCustomers = round2(o.adCustomers);
    return o;
  }

  // today's running costs that count against profit (one-off investments excluded)
  function dayCost(state, adSpend) {
    var t = state._today;
    return num(state.livingCost, 0) + num(t.payroll, 0) + num(adSpend, num(t.adSpend, 0)) + num(t.toolSpend, 0) + num(t.squadSpend, 0) + num(t.opex, 0) +
      num(t.loss, 0) + num(t.interest, 0);
  }
  function headcountOf(state, content) { return 1 + team(state).staff + specialistInfo(state, content).headcount; }

  // what your team spends to deliver one customer start to finish at today's pay (Level 4+): delivery energy
  // per customer × delivery days, at a coach's cost per energy. The price has to cover this first.
  function serveCost(state, content, tm) {
    if (!isLate(state)) return 0;
    content = C(content); tm = tm || teamInfo(state, content);
    var coach = roleDef(content, 'coach', state.flavor), sops = state.sops || {};
    var capE = coach.capacity * (1 + TUNING.sopDeliveryBonus * clamp(num(sops.delivery, 0), 0, 3)) * Math.min(m(state, 'teamOutput'), TUNING.teamOutputMax);
    if (!(capE > 0)) return 0;
    var perEnergy = coach.salary * payLevel(state) * m(state, 'salaryCost') / capE;
    return deliveryPer(state, content) * Math.max(1, num(fv(state, content, 'deliveryDays', 30), 30)) * perEnergy;
  }

  // ---------------------------------------------------------------------------
  // advice: the next move the coach owl and the tabs name (one source for the UI hints and the tools).
  // price: the price that earns the most per call (from Level 4: after running costs and what serving the
  // customer costs the team); ads: up / hold / down / off; hire: the bottleneck role, held back while the
  // margin or cash is thin; runwayAfter(): days of cash left after a purchase.
  // ---------------------------------------------------------------------------
  function roundPrice(p) { return p >= 1000 ? Math.round(p / 50) * 50 : Math.round(p / 10) * 10; }
  function priceAdvice(state, content, mt) {
    if (state.level < 2) return null;
    var val = offerValue(state, content), late = isLate(state), opex = late ? TUNING.opexShare : 0;
    var sc = late ? num(mt && mt.serveCost, serveCost(state, content)) : 0;
    // the price that brings in the most money per sales call...
    var best = 0, bestV = -Infinity;
    for (var k = 0; k <= 48; k++) {
      var p = val * 0.12 * Math.pow(1.045, k);
      var v = p * closeRateAt(state, content, p);
      if (v > bestV) { bestV = v; best = p; }
    }
    // ...but never so low that serving the customer eats more than serveShareMax of it (Level 4+)
    if (sc > 0) best = Math.max(best, sc / TUNING.serveShareMax);
    var sp = num(fv(state, content, 'suggestedPrice', 0), 0);
    var hint = roundPrice(Math.max(best, state.level <= 2 && sp > 0 ? Math.min(sp, best * 1.2) : 0));
    var price = num(state.offer.price, 0), verdict = 'fair', busy = false;
    // before the team arrives the founder's day is the limit: when clients already eat 40%+ of the energy,
    // more yeses can hardly be served, so each yes should be worth more (while 20%+ still say yes)
    if (!late && price > 0 && num(state._deliveryNeed, 0) >= 0.4 * num(state.energy.max, 100) &&
        closeRateAt(state, content, price) >= 0.2) {
      busy = true;
      hint = Math.max(hint, roundPrice(price * (num(state._deliveryNeed, 0) >= 0.8 * num(state.energy.max, 100) ? 1.25 : 1.15)));
    }
    if (price <= 0) verdict = 'set';
    else if (busy && hint > price) verdict = 'raise';
    else if (price < hint * 0.88) verdict = 'raise';
    else if (price > hint * 1.3 && !(!late && num(state._deliveryNeed, 0) >= 0.3 * num(state.energy.max, 100))) verdict = 'lower';
    return { hint: hint, verdict: verdict, busy: busy, value: val, serveCost: sc, keepShare: price > 0 ? (price * (1 - opex) - sc) / price : 0 };
  }
  function adsAdvice(state, content, mt, flow) {
    var ads = state.channels.ads;
    if (!ads.unlocked) return null;
    var b = num(ads.dailyBudget, 0), cap = adCap(state);
    if (b <= 0) return { step: 'start', to: 20, reason: 'Try a small ad budget and watch what a customer costs.' };
    if (num(mt.adSpend30, 0) < 300 || mt.adLtvCac === null) return { step: 'hold', reason: 'Still testing: give the ads a few hundred dollars before you judge them.' };
    if (mt.adLtvCac < 1) return { step: 'off', to: 0, reason: 'Each ad customer is worth less than they cost. Pause and fix the offer first.' };
    var down = function (to, why) { return { step: 'down', to: Math.max(0, Math.floor(Math.min(b * 0.7, to))), reason: why }; };
    if (isLate(state)) {
      var avg = num(mt.revenue30, 0) / 30, share = b / Math.max(1, avg), top = TUNING.adShareMax * avg;
      if (mt.adLtvCac < 1.5) return down(b, 'Ads barely pay back. Turn the budget down a step.');
      if (flow && flow.waiting > flow.callsCap * 2 + 4) return down(b, 'Leads are going stale before anyone calls them. Turn ads down until your callers catch up.');
      if (share > TUNING.adShareMax * 1.5) return down(top, 'Ads take ' + Math.round(share * 100) + '% of sales. Bigger budgets reach pricier people: bring them back to about ' + Math.round(TUNING.adShareMax * 100) + '%.');
      // ads that pay for themselves within 30 days are the way out of a thin month, as long as cash holds
      var payBack30 = mt.adCac > 0 && num(mt.cash30PerCustomer, 0) >= mt.adCac;
      if (payBack30 && mt.adLtvCac >= 3 && b < top && state.cash >= 0 && num(mt.runwayDays, 999) >= 14 && !(flow && flow.backlog) &&
          !state._overloaded && num(mt.founderDeliveryShare, 0) <= 0.35)
        return { step: 'up', to: Math.floor(Math.min(cap, top, Math.max(b + 10, b * 1.5))), reason: 'Ad customers pay you back within 30 days. Turn the budget up a step: that is how you grow out of a thin month.' };
      if (state.cash < 0 || num(mt.runwayDays, 999) < 21 || num(mt.profitMargin30, 0) < 0.12)
        return { step: 'hold', reason: 'Ads work, but cash is thin. Hold the budget until the margin is back above 12%.' };
      if (flow && flow.backlog) return { step: 'hold', reason: 'Ads work, but leads are already waiting for a call. Hold the budget and add a ' + roleDef(content, 'closer', state.flavor).name + ' first.' };
      if (state._overloaded || num(mt.founderDeliveryShare, 0) > 0.35) return { step: 'hold', reason: 'Ads work, but delivery is full. Hold the budget until the team can serve more customers.' };
      if (b >= top) return { step: 'hold', reason: 'Ads already take ' + Math.round(share * 100) + '% of sales. Bigger budgets reach pricier people, so hold here.' };
      if (mt.adLtvCac >= 3 && b < cap) return { step: 'up', to: Math.floor(Math.min(cap, top, Math.max(b + 10, b * 1.5))), reason: 'Your ads pay for themselves. Turn the budget up a step.' };
      return { step: 'hold', reason: 'Ads pay back. Keep the budget where it is.' };
    }
    if (mt.adLtvCac >= 3 && b < cap) return { step: 'up', to: Math.min(cap, Math.max(b + 10, Math.round(b * 1.5))), reason: 'Your ads pay for themselves. Turn the budget up a step.' };
    return { step: 'hold', reason: 'Ads pay back. Keep the budget where it is.' };
  }
  // calls and shows: what is waiting against what the team (and the founder) can take
  function funnelFlow(state, content, mt) {
    var pShow = num(mt.bookedRate, 0.3) * num(mt.showRate, 0.6);
    var callsCap = num(mt.teamCalls, 0) + num(mt.founderCallCap, 0);
    var waiting = num(state.leads, 0) * pShow, inflow = num(state._yesterday && state._yesterday.leads, 0) * pShow;
    return { pShow: pShow, callsCap: callsCap, waiting: waiting, inflow: inflow, backlog: waiting > callsCap * 1.5 + 2 };
  }
  function runwayAfter(state, content, cost, extraDaily, mt) {
    mt = mt || computeMetrics(state, content, true);
    var burn = num(mt.burnDaily, 0) + Math.max(0, num(extraDaily, 0));
    if (burn <= 0) return null;
    return Math.max(0, num(state.cash, 0) - Math.max(0, num(cost, 0))) / burn;
  }
  function hireAdvice(state, content, mt, flow) {
    if (!isLate(state)) return null;
    var hc = num(mt.headcount, 1), staff = num(mt.staff, 0), want = null, why = '', critical = false;
    var perCoach = roleDef(content, 'coach', state.flavor).capacity;
    var name = function (id) { var n = roleDef(content, id, state.flavor).name; return (/^[AEIOU]/i.test(n) ? 'an ' : 'a ') + n; };
    var fD = num(mt.founderDeliveryShare, 0), team = mt.team || {}, um = num(mt.unmanaged, 0);
    // a manager first when several people coast unmanaged: one manager brings 6+ people back to full speed,
    // cheaper than hiring more of them
    if (state.level >= 5 && um >= Math.max(3, 0.12 * staff)) { want = 'manager'; critical = true; why = Math.round(um) + ' people have no manager and work at 60%.'; }
    else if (fD > 0.3 || state._overloaded) { want = 'coach'; critical = true; why = 'You still do ' + Math.round(fD * 100) + '% of delivery' + (state._overloaded ? ' and customers are waiting' : '') + '.'; }
    else if (flow.waiting > flow.callsCap * 2 + 4) { want = 'closer'; critical = true; why = 'About ' + Math.round(flow.waiting) + ' booked calls are waiting and going stale.'; }
    else if (state.level >= 5 && num(mt.unmanaged, 0) >= 2) { want = 'manager'; why = Math.round(num(mt.unmanaged, 0)) + ' people have no manager and work at 60%.'; }
    else if (flow.backlog) { want = 'closer'; why = 'About ' + Math.round(flow.waiting) + ' booked calls are waiting and nobody is free to take them.'; }
    else if (num(mt.deliveryTotal, 0) > num(mt.teamDelivery, 0) + perCoach * 0.25 && fD > 0.15) { want = 'coach'; why = 'Delivery is nearly full.'; }
    else if (flow.inflow < flow.callsCap * 0.5 && num(mt.teamOutreach, 0) < 3 * TUNING.setterSaturation && num(team.setter, 0) <= num(team.closer, 0) * 3 + 1) {
      want = 'setter'; why = 'Your callers have free slots. More outreach fills them.';
    }
    var def = getLevelDef(content, state.level), gi = arr(def && def.goal && def.goal.items).concat(arr(FALLBACK_GOALS[state.level] && FALLBACK_GOALS[state.level].items));
    var hcItem = gi.filter(function (it) { return it && it.path === 'metrics.headcount'; })[0];
    var hcTarget = hcItem ? num(hcItem.targetByFlavor && hcItem.targetByFlavor[state.flavor], num(hcItem.target, 0)) : 0;
    if (!want && hc < hcTarget) { want = num(mt.team && mt.team.setter, 0) <= num(mt.team && mt.team.coach, 0) * 0.6 ? 'setter' : 'coach'; why = 'Your goal needs ' + Math.round(hcTarget) + ' people.'; }
    if (!want) return { role: null, hold: false, reason: 'No one is overloaded. Hire when the work is already waiting.' };
    // margin: the lower of the last 30 days and today's run rate after this hire (payroll jumps before the
    // 30-day number shows it)
    var daily = num(mt.hireDaily && mt.hireDaily[want], roleDef(content, want, state.flavor).salary), avgRev = num(mt.revenue30, 0) / 30;
    var margin = Math.min(num(mt.profitMargin30, 0), avgRev > 0 ? -(num(mt.burnDaily, 0) + daily) / avgRev : -1);
    // Level 7+: with efficiency sliding, a project helps more than another hire
    if (!critical && state.level >= 7 && mt.efficiency != null && num(mt.efficiency, 100) < 65 && !(state.ops && state.ops.project))
      return { role: null, hold: true, wait: want, reason: 'Efficiency is ' + Math.round(num(mt.efficiency, 0)) + '. Run an improvement project before you hire again: it makes everyone faster.' };
    var left = runwayAfter(state, content, roleDef(content, want, state.flavor).hireCost, daily, mt);
    var thin = critical ? (left !== null && left < 14) : (margin < 0.12 || (left !== null && left < 21));
    if (thin) return { role: null, hold: true, wait: want, reason: 'Hold hiring for now: ' + (margin < 0.12 ? 'your margin is ' + Math.round(margin * 100) + '%' : 'cash is thin') + '. Raise the price or let idle seats go first, then hire ' + name(want) + '.' };
    return { role: want, hold: false, critical: critical, reason: 'Next hire: ' + name(want) + '. ' + why };
  }
  // the level's own big purchase comes first: the Product Lab at Level 6, the Big Bet at Level 10
  function saveAdvice(state, content) {
    if (!isLate(state)) return null;
    if (state.level === 6 && state.premium && !state.premium.built && !(num(state.premium.buildDays, 0) > 0)) {
      var pc = premiumCost(state, content);
      if (state.cash < pc) return { what: 'premium', amount: pc, reason: 'Save ' + money(pc) + ' for the Product Lab before you hire for growth. It is your goal now.' };
    }
    if (state.level >= 10 && !state.bet && !(state.flags && state.flags.betDone) && arr(content.bets).length) {
      var cheapest = Math.min.apply(null, arr(content.bets).map(function (b) { return num(b.cost, 300000); }));
      var keep = ZTE.Engine.late && ZTE.Engine.late.betKeep ? num(ZTE.Engine.late.betKeep(state, content), 0) : 0;
      if (state.cash < cheapest + keep) return { what: 'bet', amount: cheapest + keep, reason: 'Save ' + money(cheapest + keep) + ' for the Big Bet (the bet plus a few days of costs). Pause specialist teams, projects and growth hires until then.' };
    }
    return null;
  }
  function advice(state, content, mt) {
    content = C(content);
    mt = mt || computeMetrics(state, content, true);
    var flow = isLate(state) ? funnelFlow(state, content, mt) : null, save = saveAdvice(state, content);
    var hire = hireAdvice(state, content, mt, flow || {});
    if (save && hire && hire.role && !hire.critical) hire = { role: null, hold: true, wait: hire.role, reason: save.reason };
    return { price: priceAdvice(state, content, mt), ads: adsAdvice(state, content, mt, flow), hire: hire, save: save, flow: flow };
  }

  // lite (internal): skip the human-readable why lines (ticks, conditions, goals); numbers are identical
  function computeMetrics(state, content, lite) {
    content = C(content);
    var fl = getFlavor(state, content), paid = isPaid(state);
    var score = offerScore(state), val = offerValue(state, content), price = state.offer.price;
    var cr = closeRate(state, content), br = bookRate(state), sr = showRate(state);
    var wr = warmReply(state, content), cRep = coldReply(state, content), cpl = adCpl(state, content);
    var rr = refundRate(state, content), churn = churnMonthly(state, content);
    var up = state.combos.upsell, ds = state.combos.downsell, mb = state.combos.membership, hk = state.combos.hook;
    var upOn = up.unlocked && up.on && paid, mbOn = mb.unlocked && mb.on && paid, hkOn = hookOn(state);
    var upT = upsellTake(state), mT = memberTake(state);
    var hookPerCustomer = hkOn ? TUNING.hookTake / Math.max(0.05, sr * cr) * hk.price : 0; // hook buys per customer won
    var front = paid ? price * (1 - rr) : 0;
    var upsellV = upOn ? upT * up.price : 0;
    var memberLife = mbOn ? mT * mb.price / churn : 0;
    var member30 = mbOn ? mT * mb.price : 0;
    var ltv = front + upsellV + memberLife + hookPerCustomer;
    var cash30 = front + upsellV + member30 + hookPerCustomer;
    var l30 = last30(state);
    var spend30 = l30.adSpend + l30.toolSpend + l30.squadSpend;
    // with no new customers CAC is at least the whole spend; with no spend LTV:CAC is not measurable (null)
    var cac = l30.newCustomers > 0 ? spend30 / l30.newCustomers : spend30;
    var ltvCac = spend30 > 0 ? (l30.newCustomers > 0 ? ltv / cac : 0) : null;
    // paid CAC: ad spend ÷ customers who came from ad leads (what the client-financed check uses)
    var adCac = l30.adCustomers > 0 ? l30.adSpend / l30.adCustomers : null;
    var adLtvCac = l30.adSpend > 0 ? (adCac ? ltv / adCac : 0) : null;
    var need = state._deliveryNeed, free = state.energy.current, total = energyTotal(state);
    var avgRev = l30.days ? l30.revenue / l30.days : 0;
    var tmI = state._team || teamInfo(state, content), spI = specialistInfo(state, content);
    var retainer = state.level >= TUNING.squadAgencyLevel ? Math.min(num(state.squad.agency.retainer, 0), adCap(state)) : 0;
    var burn = state.livingCost + (state.channels.ads.unlocked ? Math.min(state.channels.ads.dailyBudget, adCap(state)) : 0) - avgRev;
    if (tmI.payroll > 0 || spI.payroll > 0 || retainer > 0) burn += tmI.payroll + spI.payroll + retainer;
    if (isLate(state) && TUNING.opexShare > 0) burn += avgRev * TUNING.opexShare;
    var runway = burn > 0 ? Math.max(0, state.cash) / burn : 999;
    var t = state._today;

    var why = { leads: [], funnel: [], money: [], company: [] };
    if (!lite) {
      // --- why lines (projected for the energy left today) ---
      var sh = planShares(state), eff = TUNING.autopilotEff;
      var salesNow = Math.min(free, Math.max(free, num(state._dayFree, free)) * sh.sales), outNow = free - salesNow, oShare = 1 - sh.sales;
      var warmA = oShare > 0 ? outNow * sh.warm / oShare * eff : 0, coldA = oShare > 0 ? outNow * sh.cold / oShare * eff : 0;
      var warmUsable = Math.min(warmA, state.network.available);
      if (state._restDays > 0) why.leads.push('Resting: 0 energy today (' + state._restDays + ' rest day' + (state._restDays === 1 ? '' : 's') + ' left). Burnout is real!');
      else why.leads.push('Energy today: ' + fmt(state.energy.max) + (state.energy.overtimeToday ? ' + ' + TUNING.overtimeEnergy + ' overtime' : '') +
        ' − ' + fmt(need) + ' delivery = ' + (need > total ? '0 free (short by ' + fmt(need - total) + ')' : fmt(Math.floor(total - need)) + ' free') + ' (' + fmt(free) + ' left)');
      if (salesNow > 0.5) why.leads.push('Saved for sales calls: ' + fmt(salesNow) + ' energy (Autopilot plan; what calls do not use goes to outreach). Outreach gets the other ' + fmt(outNow));
      why.leads.push('Friends: ' + fmt(warmUsable) + ' messages × ' + pct(wr) + ' reply = ' + fmt(warmUsable * wr) + ' leads (' +
        Math.floor(state.network.available) + ' of ' + Math.floor(state.network.size) + ' friends free to message)');
      var warmSpill = Math.max(0, warmA - warmUsable);
      if (warmSpill > 0.5) why.leads.push('Autopilot wants ' + fmt(warmA) + ' friend messages but only ' + Math.floor(state.network.available) + ' friends are free. ' +
        (state.channels.cold.unlocked ? 'The extra ' + fmt(warmSpill) + ' go to Cold Calls.' : 'The rest is wasted!'));
      if (state.channels.cold.unlocked) {
        coldA += warmSpill;
        why.leads.push('Cold Calls: ' + fmt(coldA) + ' messages × ' + pct(cRep) + ' reply = ' + fmt(coldA * cRep) + ' leads');
      }
      if (state.channels.content.unlocked) {
        var cl = 0, posts = arr(state.channels.content.posts);
        for (var i = 0; i < posts.length; i++) cl += posts[i].reach * TUNING.contentLeadRate * Math.exp(-(state.day - posts[i].day) / TUNING.contentDecayDays);
        why.leads.push('Content: ' + posts.length + ' live posts → ~' + fmt(cl) + ' leads/day; next post reaches ~' + Math.round(postReach(state)) + ' (audience ' + Math.round(state.audience) + ')');
      }
      if (state.channels.ads.unlocked) {
        var bud = Math.min(state.channels.ads.dailyBudget, adCap(state));
        var cplB = adCplAt(state, content, bud);
        why.leads.push('Ads: ' + money(bud) + '/day ÷ ' + money(cplB) + ' per lead = ' + fmt(bud / cplB) + ' leads (cap ' + money(adCap(state)) + '/day)');
        if (bud > 0) why.leads.push('Bigger budgets cost more per lead: base ' + money(cpl) + ' × √(1 + ' + money(bud) + ' ÷ ' + money(adSat(state)) + ') = ' + money(cplB));
      }
      why.leads.push('Waiting leads: ' + Math.floor(state.leads) + ', about ' + pct(TUNING.leadDecay * m(state, 'leadDecay') * Math.max(0.2, 1 - TUNING.nurtureDecayCut * state.skills.nurture)) + ' go cold each day nobody calls them');

      why.funnel.push('Value-o-Meter: (dream ' + fmt(state.offer.dream) + ' × likelihood ' + fmt(state.offer.likelihood) + ') ÷ ((11 − speed ' +
        fmt(state.offer.speed) + ') × (11 − ease ' + fmt(state.offer.ease) + ')) = ' + score.toFixed(2));
      why.funnel.push('Perceived value: ' + money(fv(state, content, 'marketValue', TUNING.marketValueDefault)) + ' × ' +
        Math.pow(Math.max(0.0001, score), TUNING.valueExponent).toFixed(2) + ' offer × ' + boostMult(state).toFixed(2) + ' boosts = ' + money(val));
      why.funnel.push('Boosts: proof ' + proofMult(state).toFixed(2) + ' × guarantee ' + guaranteeMult(state).toFixed(2) + ' × bonuses ' +
        m(state, 'perceivedValue').toFixed(2) + ' (boosts stack with diminishing returns) = ' + boostMult(state).toFixed(2));
      if (paid) why.funnel.push('Value ÷ price = ' + money(val) + ' ÷ ' + money(price) + ' = ' + (val / price).toFixed(1) + '× → close rate ' + pct(cr));
      else why.funnel.push(state.level < 2 ? 'Free trial (price locked at $0) → ' + pct(cr) + ' of calls say yes' : 'Price is $0, so closes are free trials. Set a price to make money!');
      why.funnel.push('Leads → booked ' + pct(bookedRate(state)) + ' → showed ' + pct(sr) + ' → yes ' + pct(cr) + ' = ' + pct(bookedRate(state) * sr * cr) + ' of leads become ' + (paid ? 'customers' : 'trials'));
      if (num(state._leadQ, 1) < 0.99) why.funnel.push('Lead quality ' + pct(state._leadQ) + ' (colder leads book less often)');
      why.funnel.push('Sales energy ' + fmt(salesNow) + ' → up to ' + fmt(salesNow * eff / TUNING.callEnergy) + ' calls today (' +
        fmt(TUNING.callEnergy / eff) + ' energy each on Autopilot)');
      var fullN = 0, lightN = 0, coh = arr(state._cohorts);
      for (var ci = 0; ci < coh.length; ci++) if (coh[ci].kind !== 'trial') { if (num(coh[ci].e, 1) < 1) lightN += coh[ci].n; else fullN += coh[ci].n; }
      var mEn = TUNING.memberEnergy * deliveryMod(state);
      why.funnel.push('Delivery: (' + state.customers.trials + ' trials + ' + fullN + ' customers' +
        (lightN ? ' + ' + lightN + ' lighter-option × ' + TUNING.downsellEnergy : '') + ') × ' + round2(deliveryPer(state, content)) + ' energy' +
        (state.customers.members ? ' + ' + state.customers.members + ' members × ' + round2(mEn) : '') + ' = ' + fmt(need) + ' energy/day' +
        (state._overloaded ? ' (overloaded! quality is slipping)' : ''));

      if (paid) {
        why.money.push('Front-end: ' + money(price) + ' × ' + pct(1 - rr) + ' kept after refunds = ' + money(front));
        if (upOn) why.money.push('Upsell: ' + pct(upT) + ' take × ' + money(up.price) + ' = ' + money(upsellV));
        if (mbOn) why.money.push('Membership: ' + pct(mT) + ' join × ' + money(mb.price) + '/mo ÷ ' + pct(churn) + ' monthly churn = ' + money(memberLife));
        if (hkOn) why.money.push('Hook Offer: ~' + money(hookPerCustomer) + ' extra per customer won');
        why.money.push('LTV = ' + money(ltv) + '; cash in first 30 days = ' + money(cash30));
      } else why.money.push('No price yet, so no money per customer.');
      if (spend30 <= 0) why.money.push('CAC: no ad or tool spend in the last 30 days, so LTV : CAC is n/a');
      else if (l30.newCustomers <= 0) why.money.push('CAC: ' + money(l30.adSpend) + ' ads + ' + money(l30.toolSpend) + ' tools in 30 days and no new customers yet (LTV : CAC 0 : 1)');
      else {
        why.money.push('CAC = (' + money(l30.adSpend) + ' ads + ' + money(l30.toolSpend) + ' tools) ÷ ' + l30.newCustomers + ' new customers (30 days) = ' + money(cac));
        why.money.push('LTV : CAC = ' + ltvCac.toFixed(1) + ' : 1');
      }
      if (state.channels.ads.unlocked && l30.adSpend > 0) {
        why.money.push(adCac ? 'Paid CAC = ' + money(l30.adSpend) + ' ads ÷ ~' + fmt(l30.adCustomers) + ' customers from ad leads = ' + money(adCac) +
          (cash30 >= adCac ? ' — ad customers pay for themselves within 30 days!' : ' — more than ' + money(cash30) + ' cash per customer in 30 days')
          : 'Paid CAC: ' + money(l30.adSpend) + ' on ads and no customers from ad leads yet');
      }
      why.money.push('30-day revenue ' + money(l30.revenue) + '; daily costs ' + money(state.livingCost) + ' living' +
        (state.channels.ads.dailyBudget ? ' + ' + money(Math.min(state.channels.ads.dailyBudget, adCap(state))) + ' ads' : '') +
        ' → runway ' + (runway >= 999 ? 'safe' : Math.floor(runway) + ' days'));
      if (isLate(state)) why.money.push('Credit line: ' + money(creditLine(state)) + ' (10 days of average sales). ' + (state.cash < 0 ? 'In use: ' + money(-state.cash) +
        ', interest ' + money(-state.cash * TUNING.creditInterest) + '/day. ' : '') + 'The game-over countdown only starts past the line.');
    }

    var out = {
      offerScore: score, offerValue: val, closeRate: cr, bookRate: br, bookedRate: bookedRate(state), showRate: sr,
      warmReply: wr, coldReply: cRep, cpl: cpl,
      ltv: ltv, cac: cac, ltvCac: ltvCac, cash30PerCustomer: cash30, adCac: adCac, adLtvCac: adLtvCac, adCustomers30: l30.adCustomers,
      revenue30: l30.revenue, revenueToday: t.revenue, leadsToday: t.leads, salesToday: t.sales,
      customersActive: state.customers.active, deliveryEnergy: need, freeEnergy: free, runwayDays: Math.min(999, runway), burnDaily: burn,
      negCashDays: num(state._negCashDays, 0), graceDays: graceDaysOf(state), creditLine: creditLine(state),
      // extras (beyond the spec list)
      refundRate: rr, churnMonthly: churn, upsellTake: upT, memberTake: mT, downsellPrice: downsellPrice(state),
      adCap: adCap(state), clientFinanced: !!state._clientFinanced, overloaded: !!state._overloaded,
      leadQuality: num(state._leadQ, 1), callsToday: t.calls, trialsToday: t.trials,
      yesterday: state._yesterday || newToday(), newCustomers30: l30.newCustomers, adSpend30: l30.adSpend, adDays30: l30.adDays,
      postReach: postReach(state), restDays: state._restDays,
      why: why
    };
    lateMetrics(state, content, out, l30, tmI, spI, lite);
    // systems (engine-late) add their own fields + why.company lines
    for (var si = 0; si < systems.length; si++) {
      var sys = systems[si];
      if (!sysActive(state, sys) || !sys.onMetrics) continue;
      try { sys.onMetrics(state, content, out, API); } catch (err) { warn('system ' + sys.id + ' onMetrics failed: ' + (err && err.message)); }
    }
    return out;
  }

  // late-game metrics (SPEC-LATE §3.1–3.5) + why.company lines
  function lateMetrics(state, content, out, l30, tm, sp, lite) {
    var total = num(state._deliveryTotal, out.deliveryEnergy), founderNeed = num(state._deliveryNeed, 0);
    var headcount = 1 + tm.staff + sp.headcount;
    var y = state._yesterday || {}, yCalls = num(y.founderCalls, 0) + num(y.teamCalls, 0);
    var founderCapEst = num(state._dayFree, 0) * planShares(state).sales * TUNING.autopilotEff / TUNING.callEnergy;
    var fSales = yCalls > 0 ? num(y.founderCalls, 0) / yCalls : (tm.calls > 0 ? founderCapEst / (founderCapEst + tm.calls) : 1);
    var rev30 = l30.revenue, fl = getFlavor(state, content), paid = isPaid(state);
    var counts = tm.counts || {};
    out.headcount = headcount;
    out.staff = tm.staff;
    out.team = { coach: num(counts.coach, 0), closer: num(counts.closer, 0), setter: num(counts.setter, 0), manager: num(counts.manager, 0) };
    out.staffPayroll = tm.payroll;
    out.specialistHeadcount = sp.headcount;
    out.specialistPayroll = sp.payroll;
    out.payrollDaily = tm.payroll + sp.payroll;
    out.teamDelivery = tm.delivery;
    out.teamCalls = tm.calls;
    out.teamOutreach = tm.outreach;
    out.unmanaged = tm.unmanaged;
    out.managerSpan = tm.span;
    out.manageCapacity = tm.capacity;
    out.morale = num(state.team.morale, TUNING.moraleBase);
    out.salaryCostMult = m(state, 'salaryCost');
    out.marketDepth = marketDepth(state);
    out.payLevel = payLevel(state);
    out.hireDaily = {};   // per role: what one more really adds to daily payroll (see hireDailyCost)
    for (var hr = 0; hr < ROLE_IDS.length; hr++) out.hireDaily[ROLE_IDS[hr]] = hireDailyCost(state, content, ROLE_IDS[hr], 1);
    out.ramping = tm.ramping;
    var hcap = hireCap(state, content);
    out.hireCap = hcap.cap; out.hiresLeft = hcap.left; out.hiresUsed = hcap.used;
    out.deliveryTotal = total;
    out.founderDeliveryShare = total > 0 ? clamp(founderNeed / total, 0, 1) : 0;
    out.founderSalesShare = clamp(fSales, 0, 1);
    out.founderCallCap = founderCapEst;
    out.serveCost = serveCost(state, content, tm);
    out.revenuePerEmployee = rev30 * 365 / 30 / headcount;
    out.profit30 = l30.profit;
    out.cost30 = l30.cost;
    out.profitMargin30 = rev30 > 0 ? l30.profit / rev30 : 0;
    out.payroll30 = l30.payroll;
    out.opex30 = l30.opex;
    out.squadSpend30 = l30.squadSpend;
    out.invest30 = l30.invest;
    out.premiumRevenue30 = l30.premiumRevenue;
    out.premiumShare30 = rev30 > 0 ? l30.premiumRevenue / rev30 : 0;
    out.premiumFit = premiumFit(state, content);
    out.premiumDaysLeft = num(state.premium.buildDays, 0);
    out.focus = num(state.focus, 0);
    out.leadVolume = leadVol(state);
    var ret = state.level >= TUNING.squadAgencyLevel ? Math.min(num(state.squad.agency.retainer, 0), adCap(state)) : 0;
    out.agencyLeads = agencyLeadsFor(state, content, ret);
    out.partnerLeads = partnerLeadsFor(state);
    out.fanReferralMult = fanMult(state);
    out.partners = Math.max(0, Math.floor(num(state.squad.partners.count, 0)));
    var dl = arr(state.stats.daily), last = dl.length ? dl[dl.length - 1] : null;
    out.profitYesterday = last ? num(last.profit, 0) : 0;
    if (lite || !(state.level >= 4 || tm.staff > 0)) return;

    // --- why.company ---
    var w = out.why.company, defs = {};
    ROLE_IDS.forEach(function (id) { defs[id] = roleDef(content, id, state.flavor); });
    var parts = ROLE_IDS.filter(function (id) { return counts[id] > 0; }).map(function (id) { return counts[id] + ' ' + plural(defs[id].name, counts[id]); });
    w.push('Team: you' + (parts.length ? ' + ' + parts.join(' + ') : ' (no hires yet)') + (sp.headcount ? ' + ' + sp.headcount + ' specialists' : '') + ' = ' + headcount + ' people');
    if (tm.staff > 0 || sp.payroll > 0) {
      var pay = ROLE_IDS.filter(function (id) { return counts[id] > 0; }).map(function (id) { return counts[id] + ' × ' + money(defs[id].salary); }).join(' + ');
      var sc = m(state, 'salaryCost');
      w.push('Payroll: ' + (pay || '$0') + (out.payLevel > 1.005 ? ' × ' + out.payLevel.toFixed(2) + ' bigger-team pay (senior hires, benefits, offices: +' + pct(TUNING.payGrowth) + ' per doubling of staff above ' + TUNING.payGrowthFrom + ')' : '') +
        (Math.abs(sc - 1) > 0.005 ? ' × ' + sc.toFixed(2) + ' salary costs' : '') +
        (sp.payroll > 0 ? ' + ' + money(sp.payroll) + ' specialists' : '') + ' = ' + money(tm.payroll + sp.payroll) + '/day');
    }
    if (tm.staff > 0) {
      w.push('Output per hire: ramp-up × managed ' + tm.managedF.toFixed(2) + ' × morale ' + tm.moraleF.toFixed(2) +
        ' (morale ' + Math.round(out.morale) + ')' + (Math.abs(m(state, 'teamOutput') - 1) > 0.005 ? ' × team output ' + m(state, 'teamOutput').toFixed(2) : ''));
      if (tm.ramping > 0) w.push('Ramping up: ' + tm.ramping + ' new hire' + (tm.ramping === 1 ? '' : 's') + ' at ~' + pct(tm.rampAvg) + ' (new hires start at ' + pct(TUNING.rampStart) + ', full speed in ~' + Math.ceil(rampDaysFor(state)) + ' days)');
      w.push('Recruiting: ' + hcap.used + ' of ' + hcap.cap + ' hires used in the last ' + TUNING.hireWindow + ' days (' + TUNING.hireWeekBase + ' + ' + pct(TUNING.hireWeekPct) + ' of your ' + headcount + ' people + ' + TUNING.hireWeekSop + ' per Hiring Playbook rank). Good people take time to find.');
      w.push('Span of control: you manage ' + TUNING.founderSpan + (counts.manager ? ' + ' + counts.manager + ' manager' + (counts.manager === 1 ? '' : 's') + ' × ' + tm.span : '') +
        ' = ' + tm.capacity + ' people' + (tm.unmanaged > 0 ? '. ' + tm.unmanaged + ' unmanaged staff work at ' + pct(TUNING.unmanagedOutput) + '!' : '. Everyone has a boss.'));
    }
    w.push('Delivery: ' + fmt(total) + ' energy/day; coaches cover ' + fmt(Math.min(total, tm.delivery)) + ' → you do ' + fmt(founderNeed) +
      ' (your share ' + pct(out.founderDeliveryShare) + ')' + (state._overloaded ? ' — overloaded! Hire coaches.' : ''));
    if (tm.calls > 0) w.push('Sales reps: ' + fmt(tm.calls) + ' calls/day at ' + pct(clamp(out.closeRate * tm.closeMult, 0, 1)) + ' close (' + tm.closeMult.toFixed(2) + ' × yours, sales Playbook ' + num(state.sops.sales, 0) + '/3). You took ' + pct(out.founderSalesShare) + ' of calls');
    if (out.marketDepth > 1.01) w.push('Market depth: ' + Math.max(0, Math.round(num(state.customers.total, 0) - num(state._l4Customers, 0))) + ' customers won since Level 4, so new ones come from deeper in the market: ads and cold outreach cost ×' + out.marketDepth.toFixed(2) + ' per lead (√(1 + won ÷ ' + TUNING.marketDepth + '))');
    if (tm.outreach > 0) {
      var sCold = state.channels.cold.unlocked ? Math.max(0, tm.outreach - Math.min(tm.outreach * setterSplit(state), Math.floor(state.network.available))) : 0;
      w.push('Setters: ' + fmt(tm.outreach) + ' outreach actions/day (split like your Autopilot plan)' +
        (sCold > 0 ? '; ' + fmt(sCold) + ' cold messages reply at ' + pct(setterYield(sCold, state)) + ' of the normal rate (the more you send, the colder the list: ÷ √(1 + ' + fmt(sCold) + ' ÷ ' + TUNING.setterSaturation + '))' : ''));
    }
    if (state.level >= TUNING.focusUnlockLevel || state.focus > 0) {
      var f = focusF(state);
      w.push('Niche focus ' + Math.round(state.focus) + '%: leads ×' + (1 - TUNING.focusLeadCut * f).toFixed(2) + ', close ×' + (1 + TUNING.focusClose * f).toFixed(2) +
        ', value ×' + (1 + TUNING.focusValue * f).toFixed(2) + ', churn ×' + (1 - TUNING.focusChurnCut * f).toFixed(2) + ', delivery ×' + (1 - TUNING.focusDeliveryCut * f).toFixed(2) + ' (fewer leads, more money)');
    }
    var sq = state.squad;
    if (state.level >= TUNING.squadFansLevel) {
      w.push('Lead Squad: fans ' + (sq.fans.on ? 'on (referrals ×' + out.fanReferralMult.toFixed(2) + ', ' + money(sq.fans.reward) + ' per referral sale)' : 'off') +
        (state.level >= TUNING.squadAgencyLevel ? '; agency ' + money(ret) + '/day → ~' + fmt(out.agencyLeads) + ' leads; ' + out.partners + ' partners → ~' + fmt(out.partnerLeads) + ' leads/day (' + pct(sq.partners.commission) + ' commission)' : ''));
    }
    if (state.premium.buildDays > 0) w.push('Product Lab: ' + (state.premium.name || 'premium product') + ' ready in ' + state.premium.buildDays + ' days');
    else if (state.premium.built) {
      w.push('Premium: ' + money(state.premium.price) + ' vs value ~' + money(premiumDefaults(content).valueMult * out.offerValue) + ' (fit ×' + out.premiumFit.toFixed(2) + ')' +
        (state.premium.on ? '; ' + pct(out.premiumShare30) + ' of 30-day sales' : ' — switched off'));
    }
    if (paid || rev30 > 0) {
      w.push('Profit (30 days): ' + money(rev30) + ' sales − ' + money(l30.cost) + ' costs (' + money(l30.payroll) + ' payroll, ' +
        money(l30.adSpend) + ' ads, ' + money(l30.squadSpend) + ' Lead Squad, ' + money(l30.opex) + ' running costs (' + pct(TUNING.opexShare) + ' of sales: software, rent, card fees), ' + money(l30.toolSpend) + ' tools, ' + (l30.loss > 0 ? money(l30.loss) + ' lost to burned fires, ' : '') + 'living) = ' + money(l30.profit) +
        ' → margin ' + pct(out.profitMargin30));
      if (l30.invest > 0) w.push('Invested (not in profit): ' + money(l30.invest) + ' in hires, projects and builds over 30 days');
    }
    w.push('Sales per person: ' + money(out.revenuePerEmployee) + '/year (' + (fl.name || 'your business') + ')');
  }

  // ---------------------------------------------------------------------------
  // goal, quiz, save
  // ---------------------------------------------------------------------------
  function getGoal(state, content) {
    content = C(content);
    var def = getLevelDef(content, state.level);
    var goal = def && def.goal;
    // unlocked late levels without goal items fall back to the SPEC-LATE §1 table
    if (def && !def.locked && state.level >= 4 && !(goal && arr(goal.items).length) && FALLBACK_GOALS[state.level]) {
      goal = { text: (goal && goal.text) || FALLBACK_GOALS[state.level].text, items: FALLBACK_GOALS[state.level].items };
    }
    if (!def || !goal) return { text: def && def.locked ? 'Coming soon' : '', items: [], progress: state.graduated ? 1 : 0 };
    var metrics = null, items = [], sum = 0;
    arr(goal.items).forEach(function (it) {
      if (!it || !it.path) return;
      var v;
      if (String(it.path).indexOf('metrics.') === 0) { metrics = metrics || computeMetrics(state, content, true); v = getPath(metrics, it.path.slice(8)); }
      else v = getPath(state, it.path);
      if (Array.isArray(v)) v = v.length;
      v = num(v, 0);
      // targetByFlavor lets one goal scale with the business (e.g. big-ticket agency sales)
      var target = num(it.targetByFlavor && it.targetByFlavor[state.flavor], num(it.target, 1));
      if (it.lte) {
        // "at most" goals (e.g. founder's share of delivery): done when current ≤ target
        items.push({ label: it.label || it.path, current: v, target: target, format: it.format, lte: true });
        sum += v <= target ? 1 : (v > 0 ? clamp(target / v, 0, 1) : 1);
        return;
      }
      items.push({ label: it.label || it.path, current: v, target: target, format: it.format });
      sum += target > 0 ? Math.min(1, Math.max(0, v) / target) : 1;
    });
    var text = String(goal.text || '');
    if (items.length) text = text.replace('{target}', '$' + Math.round(items[0].target).toLocaleString('en-US'));
    return { text: text, items: items, progress: items.length ? sum / items.length : 0 };
  }

  function answerQuiz(state, content, notebookId, index) {
    var e = findById(C(content).notebook, notebookId);
    if (!e || !e.quiz) return { correct: false, explain: '' };
    var correct = index === e.quiz.answer;
    if (correct) state.quizzes[notebookId] = true;
    return { correct: correct, explain: e.quiz.explain || '' };
  }

  function serialize(state) { return JSON.stringify(state); }
  function deserialize(str) {
    var s = typeof str === 'string' ? JSON.parse(str) : clone(str);
    if (!s || typeof s !== 'object') throw new Error('Bad save');
    fillDefaults(s, defaultState());
    if (!Array.isArray(s.history)) s.history = [];
    return s;
  }

  ZTE.Engine = {
    createState: createState, tick: tick, tap: tap, setPlan: setPlan, setPrice: setPrice,
    setAdBudget: setAdBudget, postContent: postContent, toggleCombo: toggleCombo, overtime: overtime,
    buyUpgrade: buyUpgrade, availableUpgrades: availableUpgrades, getPendingCard: getPendingCard,
    ghostCompare: ghostCompare, chooseCardOption: chooseCardOption, rewind: rewind,
    simulateForward: simulateForward, computeMetrics: computeMetrics, getGoal: getGoal,
    checkCondition: checkCondition, applyEffects: applyEffects, answerQuiz: answerQuiz,
    serialize: serialize, deserialize: deserialize,
    TUNING: TUNING,
    // extras for UI / tools
    closeRateAt: closeRateAt, offerValueOf: offerValue, getFlavor: getFlavor, isAllowedPath: isAllowedPath,
    ALLOWED_PATHS: ALLOWED_PATHS, MOD_KEYS: MOD_KEYS, CHANNEL_IDS: CHANNEL_IDS, COMBO_IDS: COMBO_IDS,
    SKILL_IDS: SKILL_IDS, rand: rand,
    // late game (SPEC-LATE)
    hire: hire, fire: fire, hireDailyCost: hireDailyCost, advice: advice, runwayAfter: runwayAfter, cutToBreakEven: cutToBreakEven, setSquad: setSquad, setFocus: setFocus, buildPremium: buildPremium,
    setPremiumPrice: setPremiumPrice, togglePremium: togglePremium,
    registerSystem: registerSystem, systems: systems, api: API,
    enterLevel: function (state, content, level) { return enterLevel(state, C(content), level); },   // tools / tests
    recomputeSystems: function (state, content) { afterAction(state, C(content)); },
    roleDef: function (content, id, flavor) { return roleDef(C(content), id, flavor); },
    teamInfo: function (state, content) { return teamInfo(state, C(content)); },
    hireCap: function (state, content) { return hireCap(state, C(content)); },
    payScale: function (state, content) { return payScaleOf(C(content), state && state.flavor); },
    specialistInfo: function (state, content) { return specialistInfo(state, C(content)); },
    premiumDefaults: function (content) { return premiumDefaults(C(content)); }, premiumCost: premiumCost,
    adCapOf: adCap, levelPlayable: function (content, level) { return levelPlayable(C(content), level); },
    ROLE_IDS: ROLE_IDS, DEPT_IDS: DEPT_IDS, FALLBACK_GOALS: FALLBACK_GOALS, DEFAULT_ROLES: DEFAULT_ROLES
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
