/*
 * Zero to Exit - late-game systems content (SPEC-LATE section 6).
 * Owns these keys of ZTE.Content and nothing else:
 *   roles, premiumDefaults, projects, departments, fireTypes, bets, perks
 *
 * Rules followed here:
 *  - every effect list uses the ops from SPEC 5.2, the paths from SPEC 5.3 + SPEC-LATE 2,
 *    and mods keys from SPEC 4 + SPEC-LATE 2 (teamOutput, salaryCost, premiumTake, hireRamp)
 *  - money is realistic: salaries are $ per day, one-time costs are $
 *  - all text is our own words, glossary names only
 *
 * Extra fields (optional helpers on top of the SPEC-LATE schemas; engines/UI may ignore them):
 *  - roles[i].unit, roles[i].nameByFlavor       UI label for capacity, flavor-specific job title
 *  - premiumDefaults.*                          every premium tuning constant from SPEC-LATE 3.4
 *  - projects[i].metric === 'general'           not tied to a weakest-metric id; numbers are sized
 *                                               to be fair at full strength and still useful at half
 *  - projects[i].notebook                       Founder's Notebook id to unlock when it finishes
 *                                               (same convention as upgrades; `teaches` is text)
 *  - premiumDefaults.nameByFlavor               suggested premium name per flavor (no `name` key on
 *                                               purpose, so the engine's own default is not overridden)
 *  - departments[i].specTeams[0..2]             name of the specialist team added at spec 1/2/3
 *  - departments[i].lowHealth                   what a sick department does (UI hint)
 *  - fireTypes[i].weight                        spawn weight (noise 1.6, impact 2: 1, impact 3: 0.8)
 *  - fireTypes[i].teaches/failText/fixText      lesson + log lines for burn / handle
 *  - bets[i].prep[j].label                      human-readable prep condition
 *  - bets[i].successText/failText               result text for the { type: 'bet' } event
 *  - perks[i].cost                              Wisdom points to unlock it in the New Game+ picker
 *
 * Every list also gets non-enumerable by-id lookups (ZTE.Content.roles.coach === the coach
 * entry). They are invisible to forEach / for..in / Object.keys / JSON, so arrays stay arrays.
 *
 * SPEC-GAP: bets[i].prep[j].metric is a bare computeMetrics key (e.g. 'deptHealthMin'), not a
 *           'metrics.' path.
 * SPEC-GAP: departments[i].specEffects are written as SPEC 5.2 'mod' ops so the validator can
 *           check them. They are PER-LEVEL multipliers meant for recompute:
 *           _sysMods[stat] *= Math.pow(mult, dept.spec). They should not go through
 *           applyEffects (that would make them permanent mods on top).
 * SPEC-GAP: raw lead volume exists only as the _sysMods key 'leadVolume', not as a mods key,
 *           so marketing's "more leads" is contentReach + coldReply (plus cheaper ads via adCpl).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  // by-id lookup on top of a plain array, without changing how the array iterates
  function indexById(list) {
    list.forEach(function (x) {
      if (x && typeof x.id === 'string' && !(x.id in list)) {
        Object.defineProperty(list, x.id, { value: x, enumerable: false, configurable: true, writable: true });
      }
    });
    return list;
  }

  // ---------------------------------------------------------------------------
  // ROLES (SPEC-LATE 3.1) - capacity meaning is fixed per id by the engine:
  // coach = delivery energy/day, the sales role = sales calls/day, setter = outreach/day,
  // manager = staff managed. The sales role id is fixed by the SPEC-LATE state shape
  // (team.<id>); its display name is 'Sales Rep'.
  // ---------------------------------------------------------------------------
  ZTE.Content.roles = indexById([
    {
      id: 'coach', name: 'Coach', emoji: '🧑‍🏫', unlockLevel: 4,
      salary: 156, hireCost: 1500, capacity: 35, unit: 'delivery energy / day',
      nameByFlavor: { fitness: 'Coach', agency: 'Campaign Pro', tutor: 'Tutor' },
      desc: 'Serves your customers so you do not have to. Covers 35 energy of delivery every day.',
      teaches: 'Write the steps down, show them once, then watch them try it while you coach. That is how your time comes back.'
    },
    {
      id: 'closer', name: 'Sales Rep', emoji: '🤝', unlockLevel: 4,
      salary: 192, hireCost: 2000, capacity: 6, unit: 'sales calls / day',
      nameByFlavor: { fitness: 'Sales Rep', agency: 'Account Exec', tutor: 'Enrollment Advisor' },
      desc: 'Takes up to 6 sales calls a day using your Close Kit. Sales Playbooks make them sharper.',
      teaches: 'A trained rep turns leads you never had time to call into customers. Record their calls so the promises stay honest.'
    },
    {
      id: 'setter', name: 'Setter', emoji: '📞', unlockLevel: 4,
      salary: 108, hireCost: 1000, capacity: 80, unit: 'outreach / day',
      nameByFlavor: { fitness: 'Setter', agency: 'Outreach Rep', tutor: 'Outreach Rep' },
      desc: 'The Staff member of your Lead Squad. Sends 80 outreach messages a day: friends first, then cold.',
      teaches: 'Staff who reach out for you multiply your Daily Grind. Teach them the exact steps that already work for you.'
    },
    {
      id: 'manager', name: 'Manager', emoji: '📋', unlockLevel: 5,
      salary: 264, hireCost: 3000, capacity: 6, unit: 'staff managed',
      nameByFlavor: { fitness: 'Head Coach', agency: 'Team Lead', tutor: 'Program Lead' },
      desc: 'Keeps 6 people on track (+1 per Hiring Playbook rank). Staff with no manager work at 60%.',
      teaches: 'One leader can only guide a handful of people well. Past that, people drift. Add managers before the cracks show.'
    }
  ]);

  // ---------------------------------------------------------------------------
  // PREMIUM PRODUCT (SPEC-LATE 3.4)
  // ---------------------------------------------------------------------------
  ZTE.Content.premiumDefaults = {
    emoji: '💎', unlockLevel: 6,
    buildCost: 6000,             // one-time $ to build it (the engine asks for ~3 days of sales when that is more)
    buildDays: 21,               // days until it is ready
    priceMult: 4,                // default price = 4 x core offer price
    valueMult: 3,                // a "fair" premium price is about 3 x perceived value
    finisherTake: 0.06,          // share of customers finishing delivery who buy it
    activeTakePerDay: 0.0012,    // share of active customers who buy it each day
    focusBoost: 0.5,             // take x (1 + focusBoost x focus/100)
    deliveryEnergyMult: 1.5,     // a premium customer costs 1.5 x delivery energy
    nameByFlavor: { fitness: 'VIP Body Reboot Year', agency: 'Growth Partner Program', tutor: 'Top Marks Masterclass' },
    desc: 'A second, bigger product for people who already love you. Build it once, then offer it as customers finish.',
    teaches: 'Your best next customer is one you already have. Ask what else they want, build it well, and price it higher.'
  };

  // ---------------------------------------------------------------------------
  // IMPROVEMENT PROJECTS (SPEC-LATE 4.1) - one per weakestMetric id + general ones.
  // Full strength when `metric` is today's weakest metric, half strength otherwise.
  // `notebook` = lesson unlocked on finish; `teaches` = the one-line lesson text.
  // ---------------------------------------------------------------------------
  ZTE.Content.projects = indexById([
    {
      id: 'speed_to_lead_desk', name: 'Speed-to-Lead Desk', emoji: '⏱️', metric: 'bookRate',
      cost: 10000, days: 10,
      effects: [{ op: 'mod', stat: 'bookRate', mult: 1.15 }],
      desc: 'Staff a rota so every new lead hears back within minutes. Book rate +15%.',
      teaches: 'Leads cool off fast. When someone is always on deck to reply, far more of them book a call.',
      notebook: 'better_not_more'
    },
    {
      id: 'show_up_system', name: 'Show-Up System', emoji: '📅', metric: 'showRate',
      cost: 6000, days: 7,
      effects: [{ op: 'mod', stat: 'showRate', mult: 1.15 }],
      desc: 'Reminders, a follow-up checklist, and a bonus for setters whose calls actually show. Show rate +15%.',
      teaches: 'Pay for the result you want. Reward booked calls that show up, not just calls that get booked.',
      notebook: 'measure_it'
    },
    {
      id: 'game_tape', name: 'Weekly Call Review', emoji: '🎬', metric: 'closeRate',
      cost: 15000, days: 14,
      effects: [{ op: 'mod', stat: 'closeRate', mult: 1.12 }],
      desc: 'Each week your reps pick one real sales call, score it against the script and agree on one thing to do better. Close rate +12%.',
      teaches: 'Skills grow with honest feedback. One call scored every week beats a yearly sales seminar.',
      notebook: 'measure_it'
    },
    {
      id: 'care_standard', name: 'Customer Care Standard', emoji: '💖', metric: 'churn',
      cost: 22000, days: 14,
      effects: [{ op: 'mod', stat: 'churn', mult: 0.85 }, { op: 'mod', stat: 'refundRate', mult: 0.9 }],
      desc: 'One service standard for everyone, plus early outreach when a customer starts slipping. Churn -15%, refunds -10%.',
      teaches: 'People quit over bad service more often than over price. Spot the slide early and most of them stay.',
      notebook: 'better_not_more'
    },
    {
      id: 'delivery_streamline', name: 'Delivery Streamline', emoji: '🧹', metric: 'deliveryEfficiency',
      cost: 30000, days: 14,
      effects: [{ op: 'mod', stat: 'deliveryEnergy', mult: 0.85 }],
      desc: 'Ask customers what they actually use and cut the rest. Each customer takes 15% less delivery energy.',
      teaches: 'More features is not more value. Strip delivery down to what gets the result and everyone moves faster.',
      notebook: 'bloat'
    },
    {
      id: 'ad_factory', name: 'Ad Creative Factory', emoji: '🏭', metric: 'cpl',
      cost: 40000, days: 14,
      effects: [{ op: 'mod', stat: 'adCpl', mult: 0.85 }],
      desc: 'A steady system for making lots of new ads and keeping only the winners. Cost per lead -15%.',
      teaches: 'Ads wear out as you reach colder crowds. Fresh creative, made in volume, keeps your leads cheap.',
      notebook: 'measure_it'
    },
    // general projects: not tied to one weak metric
    {
      id: 'kpi_scoreboard', name: 'Company Scoreboard', emoji: '📊', metric: 'general',
      cost: 12000, days: 10,
      effects: [{ op: 'add', path: 'ops.efficiency', value: 8 }, { op: 'mod', stat: 'teamOutput', mult: 1.04 }],
      desc: 'One dashboard where every team tracks its key numbers. Efficiency +8, team output +4%.',
      teaches: 'A number nobody watches never improves. Measure first, then fix the worst thing you find.',
      notebook: 'measure_it'
    },
    {
      id: 'partner_kit', name: 'Partner Launch Kit', emoji: '🎁', metric: 'general',
      cost: 20000, days: 12,
      effects: [{ op: 'add', path: 'squad.partners.count', value: 4 }, { op: 'mod', stat: 'referralRate', mult: 1.12 }],
      desc: 'Hand partners ready-made ads, emails and scripts, plus prizes for referral goals. +4 partners, referrals +12%.',
      teaches: 'Partners promote what is easy to promote. Do the work for them, reward milestones, and they send more people.',
      notebook: 'partners'
    },
    {
      id: 'budget_guardrails', name: 'Budget Guardrails', emoji: '🛡️', metric: 'general',
      cost: 5000, days: 7,
      effects: [{ op: 'mod', stat: 'salaryCost', mult: 0.95 }, { op: 'add', path: 'ops.efficiency', value: 5 }],
      desc: 'Every department gets a quarterly budget and big buys need a sign-off. Payroll costs -5%, efficiency +5.',
      teaches: 'A company card with no rules leaks money. Clear budgets turn spending into a choice instead of a habit.',
      notebook: 'bloat'
    }
  ]);

  // ---------------------------------------------------------------------------
  // DEPARTMENTS (SPEC-LATE 4.2 / 4.3) - order matches state.depts.
  // Spec level n costs specCost x n (one time) and adds specHeadcount people and
  // specSalary $/day (about $160 per senior specialist per day, times the flavor's payScale).
  // Totals: 30 people per level across all six (90 at max), $189k per round of upgrades x level.
  // (Integration balance pass: small senior teams; the Level 10 headcount goal still needs generalists.)
  // specEffects are per-level multipliers (see SPEC-GAP above).
  // ---------------------------------------------------------------------------
  ZTE.Content.departments = indexById([
    {
      id: 'marketing', name: 'Marketing', emoji: '📣',
      specCost: 36000, specHeadcount: 5, specSalary: 800,
      specEffects: [
        { op: 'mod', stat: 'adCpl', mult: 0.88 },
        { op: 'mod', stat: 'contentReach', mult: 1.1 },
        { op: 'mod', stat: 'coldReply', mult: 1.1 }
      ],
      specTeams: ['Ad Buyers', 'Content Studio', 'Brand Team'],
      lowHealth: 'Leads get pricier',
      desc: 'Brings in the leads. Each specialist level cuts ad costs 12% and grows organic leads 10%.',
      teaches: 'One lead source is one point of failure. A dedicated team can add a second channel and build a brand people trust.'
    },
    {
      id: 'sales', name: 'Sales', emoji: '💼',
      specCost: 30000, specHeadcount: 6, specSalary: 960,
      specEffects: [
        { op: 'mod', stat: 'closeRate', mult: 1.06 },
        { op: 'mod', stat: 'showRate', mult: 1.03 }
      ],
      specTeams: ['Lead Scoring Desk', 'Senior Deal Team', 'Product Squads'],
      lowHealth: 'Fewer calls turn into sales',
      desc: 'Turns leads into customers. Each specialist level lifts close rate 6% and show rate 3%.',
      teaches: 'Route the hottest leads to your strongest reps, and let each rep master one product or customer type instead of all of them.'
    },
    {
      id: 'delivery', name: 'Delivery', emoji: '📦',
      specCost: 42000, specHeadcount: 6, specSalary: 960,
      specEffects: [
        { op: 'mod', stat: 'churn', mult: 0.85 },
        { op: 'mod', stat: 'refundRate', mult: 0.92 }
      ],
      specTeams: ['Onboarding Crew', 'Success Coaches', 'Product Support Pods'],
      lowHealth: 'More customers leave',
      desc: 'Keeps customers happy and getting results. Each specialist level cuts churn 15% and refunds 8%.',
      teaches: 'Delivery is often the first thing to crack as you grow. Give each kind of customer a team that knows them well.'
    },
    {
      id: 'people', name: 'People', emoji: '🧑‍🤝‍🧑',
      specCost: 18000, specHeadcount: 4, specSalary: 640,
      specEffects: [
        { op: 'mod', stat: 'hireRamp', mult: 1.3 },
        { op: 'mod', stat: 'teamOutput', mult: 1.02 }
      ],
      specTeams: ['Recruiting Team', 'Training Academy', 'Workforce Planners'],
      lowHealth: 'New hires ramp slowly and morale sags',
      desc: 'Hires, trains and keeps your team. Each specialist level gets new hires up to speed 30% faster.',
      teaches: 'One clear hiring process keeps the culture steady. Plan for people leaving before they actually do.'
    },
    {
      id: 'finance', name: 'Finance', emoji: '🏦',
      specCost: 15000, specHeadcount: 4, specSalary: 640,
      specEffects: [
        { op: 'mod', stat: 'salaryCost', mult: 0.95 }
      ],
      specTeams: ['Budget Office', 'Vendor Negotiators', 'Audit and Tax Pros'],
      lowHealth: 'Costs creep up',
      desc: 'Watches every dollar. Each specialist level trims payroll costs 5%.',
      teaches: 'Big companies stop paying full price. Renegotiate with suppliers, audit the spending, and let pros handle taxes.'
    },
    {
      id: 'tech', name: 'Tech', emoji: '🖥️',
      specCost: 48000, specHeadcount: 5, specSalary: 800,
      specEffects: [
        { op: 'mod', stat: 'teamOutput', mult: 1.06 }
      ],
      specTeams: ['IT Help Desk', 'Data and Security', 'Platform Engineers'],
      lowHealth: 'Efficiency slips faster',
      desc: 'Keeps tools, data and security humming. Each specialist level lifts everyone’s output 6%.',
      teaches: 'Scattered data and one lonely IT person cannot carry a big company. Put data in one place and give each team its own tools.'
    }
  ]);

  // ---------------------------------------------------------------------------
  // FIRES (SPEC-LATE 4.2) - impact 1 = noise, 3 = real emergency. Urgency sets the
  // timer: urgency 3 -> 2 days, 2 -> 3-4 days, 1 -> 6-7 days. Burning also costs the
  // department impact x 6 health (engine), so failEffects only hold the extra damage.
  // ---------------------------------------------------------------------------
  ZTE.Content.fireTypes = indexById([
    // marketing
    {
      id: 'ad_account_frozen', dept: 'marketing', title: 'Ad account frozen!', emoji: '🚫',
      impact: 3, urgency: 3, days: 2, weight: 0.8,
      failEffects: [{ op: 'buff', stat: 'adCpl', mult: 1.6, days: 14, label: 'Ad account frozen' }],
      desc: 'The ad platform froze your account over one flagged ad. Every day it stays frozen, leads dry up.',
      failText: 'The appeal dragged on. Leads cost 60% more for two weeks.',
      fixText: 'You jumped on it, fixed the ad and got the account back.',
      teaches: 'High impact and high urgency: this one jumps the queue. Drop the small stuff.'
    },
    {
      id: 'comment_storm', dept: 'marketing', title: 'Comment section drama', emoji: '💬',
      impact: 1, urgency: 3, days: 2, weight: 1.6,
      failEffects: [{ op: 'buff', stat: 'contentReach', mult: 0.95, days: 3, label: 'Comment drama' }],
      desc: 'A few trolls are arguing under your latest post. The team wants the CEO to weigh in. Right now.',
      failText: 'It blew over in a few days. Hardly anyone noticed.',
      fixText: 'You spent your time on trolls. They did not even notice.',
      teaches: 'Loud is not the same as important. Check the impact before you jump in.'
    },
    {
      id: 'logo_debate', dept: 'marketing', title: 'The great logo debate', emoji: '🎨',
      impact: 1, urgency: 2, days: 3, weight: 1.6,
      failEffects: [{ op: 'add', path: 'team.morale', value: -2 }],
      desc: 'Two teams are fighting over the new logo color and want you to break the tie.',
      failText: 'They picked blue. Nobody remembers why it mattered.',
      fixText: 'You picked a color. A week of your attention for a shade of blue.',
      teaches: 'Let the people closest to the work decide small things. Save your attention for the big ones.'
    },
    // sales
    {
      id: 'rep_poached', dept: 'sales', title: 'Top rep being poached', emoji: '🎣',
      impact: 3, urgency: 2, days: 3, weight: 0.8,
      failEffects: [
        { op: 'buff', stat: 'closeRate', mult: 0.85, days: 21, label: 'Lost your top rep' },
        { op: 'add', path: 'team.morale', value: -5 }
      ],
      desc: 'A rival offered your best sales rep a big raise. They decide this week.',
      failText: 'They left and took their best habits with them. Sales sagged for weeks.',
      fixText: 'You showed them their path here and paid what was fair. They stayed.',
      teaches: 'Losing a top performer costs far more than keeping one. Clear, fair pay rules stop bidding wars before they start.'
    },
    {
      id: 'rogue_promises', dept: 'sales', title: 'Reps overpromising', emoji: '🤥',
      impact: 2, urgency: 2, days: 3, weight: 1,
      failEffects: [
        { op: 'buff', stat: 'refundRate', mult: 1.3, days: 21, label: 'Broken promises' },
        { op: 'add', path: 'cash', value: -8000 }
      ],
      desc: 'Some reps are promising results the product cannot deliver. Refund requests are piling up.',
      failText: 'Refunds spiked and a few angry reviews landed.',
      fixText: 'You reviewed the calls, reset the pitch, and the refunds calmed down.',
      teaches: 'A sale built on a fib comes back as a refund. Review real calls and keep the pitch honest.'
    },
    {
      id: 'dashboard_glitch', dept: 'sales', title: 'Scary dip on the dashboard', emoji: '📉',
      impact: 1, urgency: 3, days: 2, weight: 1.6,
      failEffects: [{ op: 'add', path: 'team.morale', value: -1 }],
      desc: 'The sales dashboard shows a huge overnight dip. It smells like a tracking bug, but people are panicking.',
      failText: 'It was a tracking bug. The numbers fixed themselves by morning.',
      fixText: 'You dug in. It was a tracking bug all along.',
      teaches: 'Check the data before you react to it. Plenty of scary dips are just broken tracking.'
    },
    // delivery
    {
      id: 'client_meltdown', dept: 'delivery', title: 'Big customer meltdown', emoji: '🌋',
      impact: 3, urgency: 3, days: 2, weight: 0.8,
      failEffects: [
        { op: 'buff', stat: 'churn', mult: 1.35, days: 14, label: 'Public meltdown' },
        { op: 'buff', stat: 'referralRate', mult: 0.7, days: 21, label: 'Bad buzz' }
      ],
      desc: 'One of your best-known customers is furious and threatening to go public about a bad experience.',
      failText: 'The rant went around. Churn rose and referrals dried up for a while.',
      fixText: 'You called them yourself, owned the mistake and fixed it in one go. Now they are a fan.',
      teaches: 'Every customer touch builds or breaks trust. Fix it fully the first time and show you care.'
    },
    {
      id: 'quality_slip', dept: 'delivery', title: 'Results quietly slipping', emoji: '🐌',
      impact: 2, urgency: 1, days: 6, weight: 1,
      failEffects: [
        { op: 'buff', stat: 'churn', mult: 1.2, days: 21, label: 'Results slipping' },
        { op: 'buff', stat: 'testimonialChance', mult: 0.7, days: 21, label: 'Fewer wins' }
      ],
      desc: 'Newer customers are getting slightly worse results than older ones. Nobody is yelling yet.',
      failText: 'The slip became a trend. Fewer wins, fewer stories, more cancels.',
      fixText: 'You compared customer groups, found the broken step and fixed it.',
      teaches: 'Quiet problems grow. Compare customers by when they joined so you catch a slide early.'
    },
    {
      id: 'grumpy_review', dept: 'delivery', title: 'One grumpy review', emoji: '😾',
      impact: 1, urgency: 3, days: 2, weight: 1.6,
      failEffects: [{ op: 'buff', stat: 'closeRate', mult: 0.98, days: 3, label: 'Grumpy review' }],
      desc: 'Someone left a one-star review because the welcome email went to spam. The team wants a crisis meeting.',
      failText: 'One review among hundreds. It sank without a trace.',
      fixText: 'You wrote a kind reply. Nice, but it did not need the CEO.',
      teaches: 'One review is noise. A pattern of reviews is a signal. Learn to tell them apart.'
    },
    // people
    {
      id: 'toxic_star', dept: 'people', title: 'Brilliant but toxic', emoji: '☠️',
      impact: 3, urgency: 1, days: 7, weight: 0.8,
      failEffects: [
        { op: 'add', path: 'team.morale', value: -12 },
        { op: 'buff', stat: 'teamOutput', mult: 0.88, days: 21, label: 'Toxic culture' }
      ],
      desc: 'Your top performer hits every number, but people dread working with them. Two others are quietly job hunting.',
      failText: 'Good people left instead. Morale and output both took a hit.',
      fixText: 'You had the hard talk: change, or go. The whole team exhaled.',
      teaches: 'Not urgent does not mean not important. Slow-burning people problems can do the most damage.'
    },
    {
      id: 'manager_burnout', dept: 'people', title: 'Manager running on fumes', emoji: '🥵',
      impact: 2, urgency: 2, days: 4, weight: 1,
      failEffects: [
        { op: 'add', path: 'team.morale', value: -6 },
        { op: 'buff', stat: 'teamOutput', mult: 0.92, days: 14, label: 'Burned-out manager' }
      ],
      desc: 'One of your managers is doing three jobs and skipping one-on-ones. Their team is drifting.',
      failText: 'They burned out and took leave. Their team floundered.',
      fixText: 'You moved work around and gave them a plan for the week. Crisis over.',
      teaches: 'Stretched managers break quietly. Plan each week up front and check who is overloaded.'
    },
    {
      id: 'snack_war', dept: 'people', title: 'Snack drawer scandal', emoji: '🍪',
      impact: 1, urgency: 3, days: 2, weight: 1.6,
      failEffects: [{ op: 'add', path: 'team.morale', value: -1 }],
      desc: 'Someone keeps taking the good snacks. A 40-message thread demands action from the top.',
      failText: 'Someone bought more cookies. Peace returned.',
      fixText: 'You settled the great snack war. History will not remember it.',
      teaches: 'Not every fire needs the CEO. Most need someone with a clear job to own it.'
    },
    // finance
    {
      id: 'cash_crunch', dept: 'finance', title: 'Cash crunch before payday', emoji: '💸',
      impact: 3, urgency: 2, days: 3, weight: 0.8,
      failEffects: [
        { op: 'add', path: 'cash', value: -40000 },
        { op: 'add', path: 'team.morale', value: -4 }
      ],
      desc: 'Two big invoices are late and payroll is due. Finance needs you to step in.',
      failText: 'You covered payroll with a pricey short-term loan. Ouch.',
      fixText: 'You chased the invoices, moved a few bills, and payday went out on time.',
      teaches: 'Profit on paper is not cash in the bank. Forecast cash so payday is never a surprise.'
    },
    {
      id: 'tax_notice', dept: 'finance', title: 'Letter from the tax office', emoji: '📨',
      impact: 2, urgency: 1, days: 7, weight: 1,
      failEffects: [{ op: 'add', path: 'cash', value: -25000 }],
      desc: 'A notice says last year’s filings look off. It is not due for a while, but it will not go away.',
      failText: 'Penalties and interest piled up while it sat in a drawer.',
      fixText: 'You got a tax pro on it early. Sorted for a small fee.',
      teaches: 'Boring money tasks need specialists. Clean books and quarterly taxes prevent painful surprises.'
    },
    // tech
    {
      id: 'site_down', dept: 'tech', title: 'Checkout page down!', emoji: '🔥',
      impact: 3, urgency: 3, days: 2, weight: 0.8,
      failEffects: [
        { op: 'add', path: 'cash', value: -30000 },
        { op: 'buff', stat: 'closeRate', mult: 0.85, days: 5, label: 'Checkout outage' }
      ],
      desc: 'Customers cannot pay. Every hour the checkout stays broken, sales walk away.',
      failText: 'Hours of lost sales, then days of shaky trust.',
      fixText: 'You got the right people in one room and it was back up by lunch.',
      teaches: 'When money stops flowing, nothing else matters. Stop the leak first, then ask why.'
    },
    {
      id: 'data_leak', dept: 'tech', title: 'Security hole found', emoji: '🔓',
      impact: 3, urgency: 2, days: 3, weight: 0.8,
      failEffects: [
        { op: 'add', path: 'cash', value: -50000 },
        { op: 'buff', stat: 'churn', mult: 1.15, days: 14, label: 'Data scare' },
        { op: 'buff', stat: 'closeRate', mult: 0.9, days: 21, label: 'Trust dent' }
      ],
      desc: 'A former employee can still log in to customer data. Someone has to lock it down.',
      failText: 'Data walked out the door. Cleanup costs, lawyers and lost trust.',
      fixText: 'Access cut, passwords changed, and a proper exit checklist written.',
      teaches: 'As people join and leave, access gets messy. Lock down your data before it bites you.'
    },
    {
      id: 'shiny_tool', dept: 'tech', title: 'Shiny new tool request', emoji: '✨',
      impact: 1, urgency: 3, days: 2, weight: 1.6,
      failEffects: [{ op: 'add', path: 'cash', value: -2500 }],
      desc: 'The team found a slick new app and wants everyone switched over by Friday.',
      failText: 'They bought it anyway. Half the team never logged in.',
      fixText: 'You sat through the demo. It was the same as the tool you already pay for.',
      teaches: 'More tools is not better tools. Use what you have well before you buy more.'
    }
  ]);

  // ---------------------------------------------------------------------------
  // BIG BETS (SPEC-LATE 4.4) - one per run. chance = baseChance + prep bonuses (max 0.9).
  // success/fail effects come on top of the cost already paid.
  // ---------------------------------------------------------------------------
  ZTE.Content.bets = indexById([
    {
      id: 'acquire_rival', name: 'Buy a Rival', emoji: '🦈',
      cost: 600000, days: 36, baseChance: 0.55,
      prep: [
        { metric: 'deptHealthMin', gte: 70, bonus: 0.12, label: 'Every department at 70+ health' },
        { metric: 'profitMargin30', gte: 0.2, bonus: 0.08, label: 'Profit margin 20%+' },
        { metric: 'specialistDepts', gte: 5, bonus: 0.08, label: '5 specialist departments' }
      ],
      success: [
        { op: 'add', path: 'audience', value: 40000 },
        { op: 'add', path: 'leads', value: 3000 },
        { op: 'add', path: 'reputation.caseStudies', value: 10 },
        { op: 'mod', stat: 'adCpl', mult: 0.85 },
        { op: 'mod', stat: 'referralRate', mult: 1.2 }
      ],
      fail: [
        { op: 'buff', stat: 'churn', mult: 1.3, days: 30, label: 'Messy merger' },
        { op: 'add', path: 'team.morale', value: -15 },
        { op: 'add', path: 'depts.people.health', value: -10 },
        { op: 'mod', stat: 'salaryCost', mult: 1.04 }
      ],
      successText: 'The merger clicked. Their customers and audience, your systems. Growth is back!',
      failText: 'Two cultures clashed. Duplicate jobs, confused customers and a rough quarter.',
      desc: 'Buy a competitor and fold their customers and audience into yours. Big price, big jump.',
      teaches: 'Buying a company can restart growth fast, but only if your systems can absorb their people and customers.'
    },
    {
      id: 'new_market', name: 'Open a New Market', emoji: '🗺️',
      cost: 250000, days: 32, baseChance: 0.7,
      prep: [
        { metric: 'efficiency', gte: 80, bonus: 0.08, label: 'Efficiency 80+' },
        { metric: 'specialistDepts', gte: 4, bonus: 0.07, label: '4 specialist departments' },
        { metric: 'calmDays', gte: 14, bonus: 0.05, label: '14 calm days in a row' }
      ],
      success: [
        { op: 'add', path: 'audience', value: 20000 },
        { op: 'mod', stat: 'contentReach', mult: 1.25 },
        { op: 'mod', stat: 'coldReply', mult: 1.15 },
        { op: 'mod', stat: 'adCpl', mult: 0.82 }
      ],
      fail: [
        { op: 'add', path: 'cash', value: -150000 },
        { op: 'buff', stat: 'adCpl', mult: 1.25, days: 30, label: 'Market flop' },
        { op: 'add', path: 'team.morale', value: -8 }
      ],
      successText: 'Your playbooks traveled well. A whole new crowd of fresh leads!',
      failText: 'The new market did not bite. You pulled back and ate the losses.',
      desc: 'Take your proven offer to a new region or a new kind of customer. The safest bet, with a solid payoff.',
      teaches: 'Expansion works when your playbooks travel. If it only works with you in the room, it will not copy.'
    },
    {
      id: 'new_category', name: 'Launch a New Category', emoji: '🧪',
      cost: 150000, days: 28, baseChance: 0.6,
      prep: [
        { metric: 'premiumShare30', gte: 0.25, bonus: 0.12, label: 'Premium is 25%+ of revenue' },
        { metric: 'ltvCac', gte: 4, bonus: 0.06, label: 'LTV:CAC of 4 or more' },
        { metric: 'deptHealthMin', gte: 65, bonus: 0.05, label: 'Every department at 65+ health' }
      ],
      success: [
        { op: 'mod', stat: 'premiumTake', mult: 1.35 },
        { op: 'mod', stat: 'upsellTake', mult: 1.3 },
        { op: 'mod', stat: 'perceivedValue', mult: 1.1 },
        { op: 'mod', stat: 'referralRate', mult: 1.1 }
      ],
      fail: [
        { op: 'buff', stat: 'closeRate', mult: 0.88, days: 30, label: 'Distracted team' },
        { op: 'mod', stat: 'deliveryEnergy', mult: 1.05 },
        { op: 'add', path: 'team.morale', value: -6 }
      ],
      successText: 'Customers loved the new line. Each one is now worth a lot more.',
      failText: 'The new line flopped and pulled focus from the core product.',
      desc: 'Build a whole new product line for the customers you already have. Cheapest bet, lives or dies on customer love.',
      teaches: 'Your famous product gets worse if you keep tinkering with it. New growth comes from new products, tested with your best customers first.'
    },
    {
      id: 'own_platform', name: 'Build Your Own Platform', emoji: '🚀',
      cost: 1000000, days: 48, baseChance: 0.45,
      prep: [
        { metric: 'efficiency', gte: 85, bonus: 0.12, label: 'Efficiency 85+' },
        { metric: 'specialistDepts', gte: 5, bonus: 0.1, label: '5 specialist departments' },
        { metric: 'profitMargin30', gte: 0.25, bonus: 0.06, label: 'Profit margin 25%+' }
      ],
      success: [
        { op: 'mod', stat: 'teamOutput', mult: 1.2 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 0.75 },
        { op: 'mod', stat: 'churn', mult: 0.8 },
        { op: 'mod', stat: 'salaryCost', mult: 0.92 },
        { op: 'add', path: 'ops.efficiency', value: 15 }
      ],
      fail: [
        { op: 'add', path: 'ops.efficiency', value: -12 },
        { op: 'add', path: 'team.morale', value: -12 },
        { op: 'buff', stat: 'teamOutput', mult: 0.85, days: 30, label: 'Failed rollout' }
      ],
      successText: 'The platform works! Delivery is faster, cheaper and stickier than ever.',
      failText: 'Over budget, behind schedule and buggy. The team spent months cleaning up.',
      desc: 'Build software that runs your delivery, so every customer gets more for less effort. Riskiest bet, biggest upside.',
      teaches: 'Big bets can take a year to pay off, and some fail. Bet big only when the core business can carry the risk.'
    }
  ]);

  // ---------------------------------------------------------------------------
  // NEW GAME+ PERKS (SPEC-LATE 3.7) - effects run right after level 1 starts.
  // cost = Wisdom points (wisdom from a sale = 1 + floor(valuation / 10M), max 10).
  // ---------------------------------------------------------------------------
  ZTE.Content.perks = indexById([
    {
      id: 'nest_egg', name: 'Nest Egg', emoji: '🐷', cost: 1,
      effects: [{ op: 'add', path: 'cash', value: 2000 }],
      desc: 'Start with $2,000 extra cash.',
      teaches: 'Runway buys you time to learn, and early on, time is everything.'
    },
    {
      id: 'big_rolodex', name: 'Big Rolodex', emoji: '📇', cost: 1,
      effects: [
        { op: 'add', path: 'network.size', value: 20 },
        { op: 'add', path: 'network.available', value: 20 }
      ],
      desc: 'Start with 20 more friends to reach out to.',
      teaches: 'Your network is your first megaphone. The bigger it is, the sooner your first wins come.'
    },
    {
      id: 'hook_instinct', name: 'Hook Instinct', emoji: '🪝', cost: 2,
      effects: [{ op: 'add', path: 'skills.hooks', value: 1 }],
      desc: 'Start with Hooks rank 1.',
      teaches: 'Grabbing attention is a skill you keep forever. You bring it into every new business.'
    },
    {
      id: 'smooth_talker', name: 'Smooth Talker', emoji: '🗣️', cost: 3,
      effects: [{ op: 'mod', stat: 'closeRate', mult: 1.1 }],
      desc: '+10% close rate for the whole run.',
      teaches: 'Sales skill compounds. Every call you ever took makes the next one easier.'
    },
    {
      id: 'talent_magnet', name: 'Talent Magnet', emoji: '🧲', cost: 2,
      effects: [{ op: 'mod', stat: 'hireRamp', mult: 1.25 }],
      desc: 'New hires get up to speed 25% faster.',
      teaches: 'Good people want to work for someone who has done it before. Your track record recruits for you.'
    },
    {
      id: 'playbook_pro', name: 'Playbook Pro', emoji: '📘', cost: 2,
      effects: [{ op: 'add', path: 'sops.delivery', value: 1 }],
      desc: 'Start with a free Delivery Playbook (rank 1).',
      teaches: 'Write it down once and it works for every hire after. Founders who document early scale faster.'
    }
  ]);
})(typeof globalThis !== 'undefined' ? globalThis : this);
