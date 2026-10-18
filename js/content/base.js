/* Zero to Exit — base content: meta, glossary, flavors, levels, channels, combos, coach, achievements.
 * Classic script, no DOM. Loads in the browser and in Node (see SPEC §3).
 * All text is written in our own words; numbers are loosely grounded in the source texts (SPEC §10).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};
  var C = ZTE.Content;

  // ---------------------------------------------------------------------------
  // META
  // ---------------------------------------------------------------------------
  C.meta = {
    title: 'Zero to Exit',
    version: '0.2.0',
    tagline: 'From broke idea to big exit, one Daily Grind at a time.',
    // SPEC-GAP: optional extras for the UI (not required by the spec; safe to ignore).
    closeKitSteps: ['Ask why now', 'Name the gap', 'Paint the dream', 'Clear the doubts', 'Make the ask', 'Welcome them in'],
    leadSquad: [
      { id: 'fans', name: 'Fans', emoji: '🥰', desc: 'Happy customers who send their friends your way.' },
      { id: 'staff', name: 'Staff', emoji: '🧑‍💼', desc: 'People you pay to do outreach for you.' },
      { id: 'agencies', name: 'Agencies', emoji: '🏢', desc: 'Outside teams you hire to run your marketing.' },
      { id: 'partners', name: 'Partners', emoji: '🤝', desc: 'Other businesses that promote you for a cut.' }
    ]
  };

  // ---------------------------------------------------------------------------
  // GLOSSARY (SPEC §2) — key -> display name
  // ---------------------------------------------------------------------------
  C.glossary = {
    coach: 'Coach Flex',
    summit: 'The Summit',
    offerForge: 'Offer Forge',
    noBrainerOffer: 'No-Brainer Offer',
    valueMeter: 'Value-o-Meter',
    megaphones: 'The Four Megaphones',
    leadSquad: 'Lead Squad',
    dailyGrind: 'The Daily Grind',
    cashCombos: 'Cash Combos',
    closeKit: 'Close Kit',
    skillScrolls: 'Skill Scrolls',
    notebook: "Founder's Notebook"
  };

  // ---------------------------------------------------------------------------
  // FLAVORS (SPEC §5.4)
  // Grounding notes (our paraphrase of the source benchmarks):
  //  - Warm outreach: roughly 1 in 5 warm contacts engage; only part of those become real leads.
  //    B2C fitness has the biggest, friendliest network; B2B agency friends are rarely buyers.
  //  - Cold outreach: a few percent of a list turning into engaged leads is a decent result;
  //    personalized B2B outreach does best, so the agency gets the highest cold rate.
  //  - Ads: local consumer leads are cheap, business-owner leads are pricey.
  //  - Prices: a 6-week fitness program in the low hundreds, tutoring around $40/session,
  //    agency service packages in the low thousands. marketValue = 2.2x suggested price for
  //    every flavor so the engine's value curve treats them the same (a strong offer ends up
  //    worth roughly 2x the starting price; tuned with tools/balance-sim.js).
  //  - Delivery (energy per customer per day; 100 energy is roughly a 10-hour day): fitness
  //    check-ins ~11 min, tutoring ~12 min, agency client work ~25 min. Agency is the heaviest.
  // ---------------------------------------------------------------------------
  C.flavors = [
    {
      id: 'fitness',
      name: 'Fitness Coach',
      emoji: '💪',
      pitch: 'Help busy people get in shape',
      offerName: '6-Week Body Reboot',
      start: {
        cash: 3000, livingCost: 40, networkSize: 150,
        dials: { dream: 5, likelihood: 3, speed: 3, ease: 2 }   // big dream, but workouts feel hard
      },
      suggestedPrice: 500,
      marketValue: 1100,
      warmReplyBase: 0.14,
      coldReplyBase: 0.018,
      adCplBase: 20,
      deliveryEnergyPerCustomer: 1.8,
      deliveryDays: 42,
      trialDays: 7,       // free 7-day kickstart (shorter, so the L1 goal bar keeps moving)
      // SPEC-GAP: optional flavor-text extras (safe to ignore)
      market: 'B2C',
      customerWord: 'client',
      trialName: 'Free 7-Day Kickstart',
      blurb: 'Cheaper offer, huge friendly network, cheap ad leads. Lots of small sales.'
    },
    {
      id: 'agency',
      name: 'Marketing Agency',
      emoji: '📈',
      pitch: 'Get local businesses more customers',
      offerName: '90-Day Client Surge',
      start: {
        cash: 4000, livingCost: 45, networkSize: 100,
        dials: { dream: 4, likelihood: 3, speed: 2, ease: 4 }   // done-for-you is easy, results take a while
      },
      suggestedPrice: 1500,
      marketValue: 3300,
      warmReplyBase: 0.11,
      coldReplyBase: 0.024,
      adCplBase: 60,
      deliveryEnergyPerCustomer: 4.0,
      deliveryDays: 90,
      payScale: 1.15,     // Level 4+: B2B specialists cost more than gym coaches (staff and specialist salaries, hiring fees)
      trialDays: 12,      // free two-week test campaign
      market: 'B2B',
      customerWord: 'client',
      trialName: 'Free Test Campaign',
      blurb: 'Pricey offer, small network, cold outreach shines. Few big sales, heavy delivery.'
    },
    {
      id: 'tutor',
      name: 'Online Tutor',
      emoji: '📚',
      pitch: 'Help students ace their exams',
      offerName: '8-Week Grade Boost',
      start: {
        cash: 3000, livingCost: 40, networkSize: 120,
        dials: { dream: 4, likelihood: 3, speed: 3, ease: 3 }
      },
      suggestedPrice: 600,
      marketValue: 1320,
      warmReplyBase: 0.12,
      coldReplyBase: 0.02,
      adCplBase: 30,
      deliveryEnergyPerCustomer: 2.0,
      deliveryDays: 56,
      trialDays: 7,       // free first week of sessions
      market: 'B2C',
      customerWord: 'student',
      trialName: 'Free Trial Week',
      blurb: 'Middle of the road on price, network and ad costs. A solid all-rounder.'
    }
  ];

  // ---------------------------------------------------------------------------
  // LEVELS (SPEC §1 table) — constraints/bottom lines reworded from the scaling stage guides.
  // ---------------------------------------------------------------------------
  C.levels = [
    {
      id: 1, key: 'garage', name: 'Garage', role: 'Researcher', emoji: '🔧',
      constraint: 'Nobody knows you',
      bottomLine: 'Let people try it free and learn what they love',
      goal: {
        text: 'Get 5 free trials and 3 testimonials',
        items: [
          { label: 'Free trials', path: 'stats.trialsStarted', target: 5 },
          { label: 'Testimonials', path: 'reputation.testimonials', target: 3 }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'start_free' },
        { op: 'notebook', id: 'warm_outreach' },
        { op: 'notebook', id: 'daily_grind' }
      ],
      intro: [
        "Hoo! I'm Coach Flex. Yes, I'm an owl. Yes, I lift. Let's build you a business.",
        "Right now nobody knows you exist. That's the boss of this level.",
        'So we start free. Get 5 people to try it and ask them what they really think.',
        "Tap 'Reach out!' to message friends. You get 100 Energy a day, and some is saved for calls. Use the rest. That's the Daily Grind.",
        'Make 3 of them happy enough to vouch for you. Testimonials are your first currency.'
      ],
      outro: "Five trials, three fans singing your praises. You've got proof now. Time to charge for it!",
      locked: false
    },
    {
      id: 2, key: 'hustle', name: 'Hustle', role: 'Starter', emoji: '🏃',
      constraint: 'You make no money',
      bottomLine: 'Turn free fans into your first paying customers',
      goal: {
        text: 'Make $5,000 in total sales',
        // SPEC-GAP: `format: 'money'` is an optional UI hint (render as $).
        items: [
          { label: 'Total sales', path: 'stats.revenueTotal', target: 5000, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'unlock', what: 'channel:cold' },
        { op: 'notebook', id: 'value_meter' },
        { op: 'notebook', id: 'close_kit' },
        { op: 'notebook', id: 'pricing_up' }
      ],
      intro: [
        "Level 2! The free buffet is closed. This level's boss: you make zero dollars.",
        "Set a price in the Offer Forge. Don't race to the bottom. Raise the value instead.",
        'Value-o-Meter 101: bigger dream, more belief it works, faster results, less effort. Crank those and your price stops being scary.',
        "Friends running dry? Cold Calls just unlocked. Strangers are only friends you haven't bugged yet.",
        'Learn the Close Kit. Ask why now, name the gap, paint the dream... and then actually ask for the money.'
      ],
      outro: "$5,000 in sales! Real people paid real money for your thing. Now let's make it come in every week.",
      locked: false
    },
    {
      id: 3, key: 'megaphone', name: 'Megaphone', role: 'Doer', emoji: '📣',
      constraint: 'New customers come in unevenly',
      bottomLine: 'Get the word out every single day so sales stop being feast or famine',
      goal: {
        text: '{target} in sales over the last 30 days',
        // SPEC-GAP: goal item reads a metrics.* path; Engine.getGoal must resolve metrics.* like checkCondition does.
        items: [
          // agency deals are ~3× bigger but rarer, so its bar is higher (tuned with tools/balance-sim.js)
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 15000, targetByFlavor: { agency: 22000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'unlock', what: 'channel:content' },
        { op: 'unlock', what: 'channel:ads' },
        { op: 'unlock', what: 'combo:hook' },
        { op: 'unlock', what: 'combo:upsell' },
        { op: 'unlock', what: 'combo:downsell' },
        { op: 'unlock', what: 'combo:membership' },
        { op: 'notebook', id: 'ltv_cac' },
        { op: 'notebook', id: 'content' },
        { op: 'notebook', id: 'paid_ads' },
        { op: 'notebook', id: 'scaling_path' }   // the only unlock for this lesson (its quiz is set at Megaphone)
      ],
      intro: [
        "Level 3: Megaphone! Some weeks you're slammed, some weeks it's crickets. That's the new boss.",
        'Content and Ads just unlocked. Post useful stuff daily, and pay to be seen when the math says yes.',
        'The math: what a customer is worth to you (LTV) versus what it costs to land one (CAC). Aim for 3 to 1 or better.',
        'Cash Combos are live! A Hook Offer pulls them in, an Upsell grows the cart, a Downsell rescues the no\'s, and a Membership keeps them paying.',
        'Goal: a big month — check the bar up top. Steady beats spiky. Every. Single. Day.'
      ],
      outro: "A monster month, on repeat! You built a real growth engine. Next up: building a crew. Hoo-rah!",
      locked: false
    },
    // --- Late game (SPEC-LATE §1). Each level is grounded in the matching scaling stage guide
    // (Stage 3 Stabilize -> Crew ... Stage 9 Capitalize -> Empire), reworded in our own words.
    // Goal items follow the SPEC-LATE §1 table in its order. Extras the UI may read:
    //  - `lte: true`         (SPEC-LATE §5) "current <= target counts as done"
    //  - `format: 'money'`   render as $ (existing hint)
    //  - `format: 'percent'` SPEC-GAP: new hint, the value is a 0..1 fraction -> render as 40%
    // Goal text only uses {target} when the first item is money; L4–L10 lead with headcount, so their
    // text is plain and the per-flavor sales target shows on the item itself.
    // onEnter unlocks every SPEC-LATE notebook id of that level (cards/upgrades may unlock them too;
    // a repeat unlock is a no-op), so every late lesson always has something that unlocks it.
    // Channel and combo unlocks already happened by L3, so none are needed here.
    {
      // Stage 3 (Stabilize): 1–4 people, too much work for one person, the owner becomes a trainer.
      id: 4, key: 'crew', name: 'Crew', role: 'Trainer', emoji: '👥',
      constraint: 'Too much for one person',
      bottomLine: 'Bring in help and teach them to do it your way',
      goal: {
        text: 'Build a crew of 3, hand off delivery, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 3 },
          { label: 'Delivery you still do', path: 'metrics.founderDeliveryShare', target: 0.4, lte: true, format: 'percent' },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 30000, targetByFlavor: { agency: 45000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'hire_help' },
        { op: 'notebook', id: 'playbooks' },
        { op: 'notebook', id: 'first_hire' },
        { op: 'notebook', id: 'lead_squad' },
        { op: 'notebook', id: 'payroll_math' }
      ],
      intro: [
        "Level 4: Crew! You're doing everything and the to-do list just laughs at you. That's the new boss.",
        'Time to get help. Open the new Company tab and hire for your biggest jam. For most solo owners that is delivery: it frees the most hours.',
        'New people start slow. Write down how you do it, show them, then watch them do it. That is a Playbook.',
        'Payroll gets paid every day, sales or no sales. Hire for your bottleneck, not for the vibes.',
        "Fans and staff can bring leads too. Say hi to the Lead Squad!"
      ],
      outro: "A real crew doing real work, and you're not doing it all anymore. Next boss: trying to please everybody.",
      locked: false
    },
    {
      // Stage 4 (Prioritize): 5–9 people, saying yes to everyone pulls the product apart; niche down.
      id: 5, key: 'focus', name: 'Focus', role: 'Manager', emoji: '🎯',
      constraint: 'Trying to serve everyone',
      bottomLine: 'Serve only people like your best customers and say no to the rest',
      goal: {
        text: 'Grow to 5, niche down, stay profitable, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 5 },
          { label: 'Niche focus', path: 'focus', target: 60 },
          { label: 'Profit margin, 30 days', path: 'metrics.profitMargin30', target: 0.15, format: 'percent' },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 60000, targetByFlavor: { agency: 90000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'ideal_customer' },
        { op: 'notebook', id: 'saying_no' },
        { op: 'notebook', id: 'span_of_control' },
        { op: 'notebook', id: 'profit_margin' }
      ],
      intro: [
        "Level 5: Focus! You've said yes to anyone with a wallet, and now your crew is pulled ten ways at once.",
        "That's the boss: trying to serve everyone. Look at your very best customers. Build only for people like them.",
        'Slide Niche Focus up on the Company tab. Fewer leads show up... but they buy more, pay more and stay longer.',
        'One person can only keep an eye on about four others. Past that, add a manager or your crew drifts.',
        'And watch profit, not just sales. Busy and broke is still broke.'
      ],
      outro: 'Focused, managed and making real profit. You traded a crowd for a clear target. Next: more money from every customer.',
      locked: false
    },
    {
      // Stage 5 (Productize): 10–19 people, customers have nothing else to buy; launch a premium second product.
      id: 6, key: 'productline', name: 'Product Line', role: 'Director', emoji: '📦',
      constraint: 'Too little money per customer',
      bottomLine: 'Launch a second, premium product your customers already want',
      goal: {
        text: 'Grow to 10, earn 20% from premium, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 10 },
          { label: 'Premium share of sales', path: 'metrics.premiumShare30', target: 0.2, format: 'percent' },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 120000, targetByFlavor: { agency: 180000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'second_product' },
        { op: 'notebook', id: 'ascension' },
        { op: 'notebook', id: 'partners' }
      ],
      intro: [
        'Level 6: Product Line! People buy once, love it... and then there is no next thing to buy. That is the boss.',
        'Find out what your biggest fans would happily pay for next. Then build it in the new Product Lab.',
        'Make it richer than your core offer, with a price tag to match. The folks who love you most will gladly pay for more.',
        'The Lead Squad grows: hire an outside Agency, or recruit Partners who send you buyers for a cut.',
        "Don't let the core product slip while the new one takes shape. Guard the ball you're already holding."
      ],
      outro: 'Two products, a next step for every customer and partners sending buyers. More money per customer means more fuel to grow.',
      locked: false
    },
    {
      // Stage 6 (Optimize): 20–49 people, more people made everything slower; do better, not more.
      id: 7, key: 'tuneup', name: 'Tune-Up', role: 'Leader', emoji: '⚙️',
      constraint: 'Everything is inefficient',
      bottomLine: 'Do things better before you do more of them',
      goal: {
        text: 'Grow to 20, run lean and profitable, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 20 },
          { label: 'Efficiency', path: 'metrics.efficiency', target: 75 },
          { label: 'Profit margin, 30 days', path: 'metrics.profitMargin30', target: 0.2, format: 'percent' },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 250000, targetByFlavor: { agency: 350000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'better_not_more' },
        { op: 'notebook', id: 'measure_it' },
        { op: 'notebook', id: 'bloat' }
      ],
      intro: [
        "Level 7: Tune-Up! More people didn't make things smoother. It made them slower. That's the boss.",
        'Every new hire adds a little drag. Keep an eye on the Efficiency meter in the Company tab.',
        'Run improvement projects, one at a time. Fix your weakest number first. That is where the big win hides.',
        "Train the people you have before you hire the people you don't. Better first, then more."
      ],
      outro: 'Leaner, faster, sharper. You grew by getting better, not just bigger. Brace yourself: things are about to get loud.',
      locked: false
    },
    {
      // Stage 7 (Categorize): 50–99 people, every system overwhelmed; sort into buckets and triage.
      id: 8, key: 'orgchart', name: 'Org Chart', role: 'Executive', emoji: '🗂️',
      constraint: 'Every system is overwhelmed',
      bottomLine: 'Sort the chaos into buckets and handle the most urgent first',
      goal: {
        text: 'Grow to 50, keep it healthy and calm, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 50 },
          { label: 'Weakest department', path: 'metrics.deptHealthMin', target: 60 },
          { label: 'Calm days in a row', path: 'metrics.calmDays', target: 14 },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 500000, targetByFlavor: { agency: 650000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'triage' },
        { op: 'notebook', id: 'departments' },
        { op: 'notebook', id: 'ceo_attention' }
      ],
      intro: [
        'Level 8: Org Chart! Fifty-plus people and every system is creaking under the load. That is the boss.',
        'Sort the mess into six departments. Each one gets a health bar. Keep them all out of the red.',
        'Fires will pop up every day. Most are noise, a few are real. And you only get a few CEO attention points a week.',
        'Triage like an ER nurse: big-impact fires first, loud little ones last. Some fires you just let burn out.'
      ],
      outro: 'Chaos, sorted. Every problem has a home and you only fight the fires that matter. Next up: specialists.',
      locked: false
    },
    {
      // Stage 8 (Specialize): 100–249 people, nobody can be great at everything; build dedicated teams.
      id: 9, key: 'specialists', name: 'Specialists', role: 'President', emoji: '🔬',
      constraint: 'Nobody can know everything',
      bottomLine: 'Build focused teams that each own one job',
      goal: {
        text: 'Grow to 100, specialise 4 departments, grow sales',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 100 },
          { label: 'Specialist departments', path: 'metrics.specialistDepts', target: 4 },
          { label: 'Sales, last 30 days', path: 'metrics.revenue30', target: 1000000, targetByFlavor: { agency: 1300000 }, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'specialists' },
        { op: 'notebook', id: 'a_players' },
        { op: 'notebook', id: 'department_heads' }
      ],
      intro: [
        'Level 9: Specialists! At this size nobody can be great at everything. Not even you. That is the boss.',
        'Turn your generalists into focused teams. Each department can grow specialist squads in the Company tab.',
        'Think pit crew: one person only changes tires, and they are the fastest on the planet at it.',
        'Upgrade the department that hurts most first. Two levels deep counts as truly specialised.',
        'Top people want to hear from the top. Recruiting your leaders is now your job.'
      ],
      outro: "A company of experts, each owning one job. You're the conductor now. One mountain left to climb.",
      locked: false
    },
    {
      // Stage 9 (Capitalize): 250–500 people, growth plateaus; make one big bet, then sell at The Summit.
      // SPEC-LATE §1: this level never auto-graduates; the UI offers "Sell at The Summit" instead.
      id: 10, key: 'empire', name: 'Empire', role: 'Chairman', emoji: '👑',
      constraint: 'Growth stalls — make a big bet & exit at The Summit',
      bottomLine: 'Place one bold bet on the future, then climb The Summit and sell',
      goal: {
        text: 'Grow to 250, place your Big Bet, reach a $50 million value',
        items: [
          { label: 'Headcount', path: 'metrics.headcount', target: 250 },
          { label: 'Big Bet played', path: 'metrics.betDone', target: 1 },
          { label: 'Company value', path: 'metrics.valuation', target: 50000000, format: 'money' }
        ]
      },
      onEnter: [
        { op: 'notebook', id: 'big_bet' },
        { op: 'notebook', id: 'valuation' },
        { op: 'notebook', id: 'owner_independence' },
        { op: 'notebook', id: 'the_summit' }
      ],
      intro: [
        "Level 10: Empire! You're big, you're steady... and growth is flattening out. That's the final boss.",
        'Your market is getting crowded and ads keep getting pricier. Small tweaks barely move a company this size.',
        'Time for one Big Bet: buy a rival, open a new market, launch a new kind of product or build your own tech. Prep it well, then commit.',
        "Buyers pay for profit that keeps coming without you. Repeat revenue, healthy departments and an owner who isn't needed all raise your price.",
        'When the number looks right, climb The Summit and sell. That is the exit.'
      ],
      outro: 'From a broke idea to a company someone wants to buy. Take a breath and enjoy the view from The Summit!',
      locked: false
    }
  ];

  // ---------------------------------------------------------------------------
  // CHANNELS — The Four Megaphones
  // SPEC-GAP: `notebook` is an optional extra linking each channel to its lesson.
  // ---------------------------------------------------------------------------
  C.channels = {
    warm: {
      name: 'Friends', emoji: '👋', verb: 'Message a friend',
      desc: 'People who already know you. The easiest yeses, but the list runs out and refills slowly.',
      unlockLevel: 1, notebook: 'warm_outreach'
    },
    cold: {
      name: 'Cold Calls', emoji: '📞', verb: 'Call a stranger',
      desc: 'Reach strangers one by one. Few reply, but the supply never ends. Volume wins.',
      unlockLevel: 2, notebook: 'cold_outreach'
    },
    content: {
      name: 'Content', emoji: '🎬', verb: 'Post something useful',
      desc: 'Give away helpful stuff for free. Slow start, then it grows an audience that sends leads for weeks.',
      unlockLevel: 3, notebook: 'content'
    },
    ads: {
      name: 'Ads', emoji: '📺', verb: 'Run an ad',
      desc: 'Pay to get in front of strangers. Leads on demand, as long as a customer is worth more than they cost.',
      unlockLevel: 3, notebook: 'paid_ads'
    }
  };

  // ---------------------------------------------------------------------------
  // CASH COMBOS — the four offer types, explained simply in our own words.
  // SPEC-GAP: `notebook` and `role` are optional extras.
  // ---------------------------------------------------------------------------
  C.combos = {
    hook: {
      name: 'Hook Offer', emoji: '🪝', role: 'Bring them in',
      desc: 'A cheap or free front-door deal that turns strangers into customers fast. More people book, and the early cash helps pay for your ads.',
      notebook: 'hook_offer'
    },
    upsell: {
      name: 'Upsell', emoji: '⬆️', role: 'Sell the next step',
      desc: 'Every solution reveals a new problem. Right after someone buys, offer the fix for what comes next. Fresh buyers say yes the most.',
      notebook: 'upsell'
    },
    downsell: {
      name: 'Downsell', emoji: '⬇️', role: 'Rescue the no',
      desc: "A 'no' is usually about this offer, not about you. Offer a smaller, cheaper or pay-over-time version and turn some no's into yeses.",
      notebook: 'downsell'
    },
    membership: {
      name: 'Membership', emoji: '🔁', role: 'Keep them paying',
      desc: 'An ongoing plan that keeps delivering value every month, and keeps money coming in every month until they cancel.',
      notebook: 'membership'
    }
  };

  // ---------------------------------------------------------------------------
  // COACH LINES — each shown once when its cond becomes true. Array order = priority.
  // SPEC-GAP: metrics.closeRate / metrics.showRate are assumed to be fractions (0..1), like the
  // flavor reply rates. metrics.ltvCac / adLtvCac are plain ratios (3 = "3 to 1"); ad lines read adLtvCac (ads alone).
  // ---------------------------------------------------------------------------
  C.coach = [
    // --- Survival first ---
    { id: 'cash_negative', cond: { path: 'cash', lt: 0 },
      text: "You're in the red! Seven days of this and it's back to the 9-to-5. Sell now, polish later." },
    { id: 'cash_low', cond: { all: [{ path: 'cash', lt: 500 }, { path: 'cash', gte: 0 }, { minDay: 3 }] },
      text: 'Under $500 in the bank. Every bit of energy today should point at a sale.' },
    { id: 'runway_low', cond: { all: [{ minDay: 5 }, { path: 'metrics.runwayDays', lt: 20 }, { path: 'metrics.revenue30', lt: 2000 }] },
      text: 'Hoot alert: less than 20 days of cash left. Go sell something. Tweaking can wait.' },
    { id: 'burnout_high', cond: { path: 'burnout', gte: 60 },
      text: "Whoa, you're running hot. Overtime is a sprint, not a lifestyle. Ease off or you'll crash." },

    // --- Level 1: Garage ---
    { id: 'tap_the_button', cond: { all: [{ level: 1 }, { minDay: 2 }, { path: 'stats.tapsTotal', eq: 0 }] },
      text: "Psst. That big button isn't decoration. Autopilot only works at 80%. Tap it yourself!" },
    { id: 'first_lead', cond: { path: 'stats.leadsTotal', gte: 1 },
      text: "Your first lead! Someone raised a hand. Don't leave them hanging." },
    { id: 'first_trial', cond: { path: 'stats.trialsStarted', gte: 1 },
      text: 'First free trial! Now over-deliver like your reputation depends on it. Because it does.' },
    { id: 'ask_feedback', cond: { all: [{ level: 1 }, { path: 'customers.trials', gte: 3 }] },
      text: 'Three people trying your stuff. Ask what they love and what bugs them. Free feedback is pure gold.' },
    { id: 'first_testimonial', cond: { path: 'reputation.testimonials', gte: 1 },
      text: "A testimonial! Strangers trust other people's words way more than yours. Collect these like trophies." },
    { id: 'l1_constraint', cond: { all: [{ level: 1 }, { minDay: 6 }, { path: 'stats.trialsStarted', lt: 2 }] },
      text: "Day 6 and barely anyone has tried it. Nobody knows you yet. That's the boss. More reach-outs!" },
    { id: 'network_dry_l1', cond: { all: [{ level: 1 }, { path: 'network.available', lt: 20 }] },
      text: 'Your friends list is running dry. It refills slowly. Make every message count.' },
    { id: 'grind_streak_3', cond: { path: 'streak.grindDays', gte: 3 },
      text: 'Three full grind days in a row. Showing up every day beats talent that sleeps in.' },

    // --- Funnel hygiene (any level) ---
    { id: 'energy_wasted', cond: { all: [{ minDay: 3 }, { path: 'leads', eq: 0 }, { path: 'plan.sales', gte: 50 }] },
      text: "No leads waiting, so Autopilot pours your call time into outreach for now. Keep that Sales slice ready for when they reply." },
    { id: 'leads_piling', cond: { all: [{ path: 'leads', gte: 8 }, { path: 'plan.sales', lt: 30 }] },
      text: 'Leads are stacking up like dirty dishes and barely any energy goes to calls. Give Sales a bigger slice!' },
    { id: 'leads_stale', cond: { path: 'leads', gte: 20 },
      text: 'Leads go stale fast. A lead you call today is worth three you call next week.' },
    { id: 'first_overtime', cond: { path: 'energy.overtimeToday', eq: true },
      text: 'Overtime! Extra hustle today, extra tired tomorrow. Save it for when it really counts.' },

    // --- Level 2: Hustle ---
    { id: 'l2_set_price', cond: { all: [{ level: 2 }, { path: 'offer.price', lte: 0 }] },
      text: 'Level 2 means you charge now. Slide that price up. Free was the tutorial.' },
    { id: 'first_payday', cond: { path: 'stats.salesCount', gte: 1 },
      text: "CHA-CHING! Someone paid you real money. You're officially a business, not a hobby." },
    { id: 'network_dry_l2', cond: { all: [{ minLevel: 2 }, { path: 'network.available', lt: 20 }] },
      text: 'Friends tapped out? Good thing strangers exist. Turn up Cold Calls.' },
    { id: 'cold_ignored', cond: { all: [{ level: 2 }, { path: 'plan.cold', eq: 0 }, { path: 'stats.salesCount', gte: 1 }] },
      text: "Cold Calls are unlocked and your plan gives them 0%. Strangers won't call you first." },
    { id: 'price_too_low', cond: { all: [
        { minLevel: 2 }, { path: 'offer.price', gt: 0 }, { path: 'stats.salesCount', gte: 2 },
        { any: [
          { all: [{ path: 'flavor', eq: 'fitness' }, { path: 'offer.price', lt: 300 }] },
          { all: [{ path: 'flavor', eq: 'agency' }, { path: 'offer.price', lt: 900 }] },
          { all: [{ path: 'flavor', eq: 'tutor' }, { path: 'offer.price', lt: 350 }] }
        ] }
      ] },
      text: "Your price is way under what this is worth. Cheap prices attract cheap problems. Nudge it up and add value." },
    { id: 'everyone_says_yes', cond: { all: [{ minLevel: 2 }, { path: 'offer.price', gt: 0 }, { path: 'stats.callsTotal', gte: 10 }, { path: 'metrics.closeRate', gte: 0.4 }] },
      text: "Closing 40%+ of your calls? That's not a flex, that's a hint. Your price is too low. Raise it until a few people flinch." },
    { id: 'close_rate_low', cond: { all: [{ minLevel: 2 }, { path: 'stats.callsTotal', gte: 8 }, { path: 'metrics.closeRate', lt: 0.15 }] },
      text: "Under 15% of calls close. Don't slash the price. Pump the value. Go visit the Offer Forge." },
    { id: 'low_belief', cond: { all: [{ minLevel: 2 }, { path: 'stats.callsTotal', gte: 5 }, { path: 'offer.likelihood', lte: 3 }] },
      text: "People doubt it'll work for them. Proof and guarantees push Likelihood up on the Value-o-Meter." },
    { id: 'no_guarantee', cond: { all: [{ minLevel: 2 }, { path: 'offer.guarantee', eq: 'none' }, { path: 'stats.salesCount', gte: 3 }] },
      text: 'Still no guarantee? Take the risk off their plate and the yes gets way easier.' },
    { id: 'train_closing', cond: { all: [{ minLevel: 2 }, { path: 'skills.closing', eq: 0 }, { path: 'stats.callsTotal', gte: 12 }] },
      text: 'A dozen calls and zero Close Kit training? Selling is a skill. Grab a Skill Scroll.' },
    { id: 'no_shows', cond: { all: [{ minLevel: 2 }, { path: 'stats.callsTotal', gte: 10 }, { path: 'metrics.showRate', lt: 0.5 }] },
      text: 'Half your calls are no-shows. Fast follow-up and reminders get people to actually show up.' },
    { id: 'refunds_rising', cond: { path: 'stats.refunds', gte: 2 },
      text: 'Refunds pile up when the promise outruns the delivery. Fix the product or the pitch, not just the price.' },
    { id: 'l2_constraint', cond: { all: [{ level: 2 }, { path: 'stats.callsTotal', gte: 15 }, { path: 'stats.revenueTotal', lt: 1000 }] },
      text: "Lots of talking, not much money. This level's boss is 'no money.' Every call should end with a clear ask." },
    { id: 'proof_pile', cond: { path: 'reputation.testimonials', gte: 5 },
      text: 'Five testimonials! Put them everywhere. Proof keeps selling while you sleep.' },

    // --- Level 3: Megaphone ---
    { id: 'l3_constraint', cond: { all: [{ level: 3 }, { path: 'metrics.leadsToday', eq: 0 }] },
      text: "Zero new leads today. That's how feast-or-famine starts. Do lead work every day, not just when you're hungry." },
    { id: 'start_content', cond: { all: [{ level: 3 }, { path: 'plan.content', eq: 0 }, { path: 'audience', eq: 0 }] },
      text: 'Content compounds. Post today, get leads next month. Start now and Future You says thanks.' },
    { id: 'hook_for_ads', cond: { all: [{ minLevel: 3 }, { path: 'channels.ads.dailyBudget', gt: 0 }, { path: 'combos.hook.on', eq: false }] },
      text: 'Running ads without a Hook Offer is fishing with no bait. Try a cheap front-door deal.' },
    { id: 'ads_losing', cond: { all: [{ minLevel: 3 }, { path: 'stats.adSpendTotal', gte: 300 }, { path: 'metrics.adLtvCac', lt: 1 }] },
      text: 'Your ads lose money on every customer: LTV is below CAC. Pause, then fix the offer or add a Cash Combo.' },
    { id: 'ads_winning', cond: { all: [{ minLevel: 3 }, { maxLevel: 3 }, { path: 'stats.adSpendTotal', gte: 300 }, { path: 'metrics.adLtvCac', gte: 3 }] },
      text: 'Every ad dollar brings back 3 or more. That is the green light. Turn it up, one step at a time.' },
    // Level 4+: payroll and running costs come first, so the green light also needs a healthy margin and cash
    { id: 'ads_winning_late', cond: { all: [{ minLevel: 4 }, { path: 'stats.adSpendTotal', gte: 300 }, { path: 'metrics.adLtvCac', gte: 3 },
        { path: 'metrics.profitMargin30', gte: 0.15 }, { path: 'metrics.runwayDays', gte: 21 }] },
      text: 'Ads pay back 3 to 1 and your margin is healthy. Turn the budget up a step, then check the margin again next week.' },
    { id: 'ads_cash_thin', cond: { all: [{ minLevel: 4 }, { path: 'stats.adSpendTotal', gte: 300 }, { path: 'metrics.adLtvCac', gte: 1.5 },
        { path: 'channels.ads.dailyBudget', gt: 0 }, { path: 'metrics.profitMargin30', lt: 0.1 }] },
      text: 'Your ads work, but the margin is thin. Hold the budget. Raise the price or let idle seats go before you spend more.' },
    { id: 'upsell_nudge', cond: { all: [{ minLevel: 3 }, { path: 'combos.upsell.on', eq: false }, { path: 'metrics.revenue30', gte: 3000 }] },
      text: 'Every buyer has a next problem. Turn on an Upsell and solve it for them.' },
    { id: 'membership_nudge', cond: { all: [{ minLevel: 3 }, { path: 'combos.membership.on', eq: false }, { path: 'customers.total', gte: 20 }] },
      text: 'Customers finish and walk away. A Membership keeps them around, and keeps them paying.' },
    { id: 'first_member', cond: { path: 'customers.members', gte: 1 },
      text: "First member! Money that shows up every month is the closest thing to a money tree." },
    { id: 'self_funding', cond: { flag: 'clientFinanced' },
      text: 'New customers now pay back their ad cost within 30 days. Your growth pays for itself. Respect!' },
    { id: 'lead_squad_teaser', cond: { all: [{ level: 3 }, { path: 'metrics.revenue30', gte: 7000 }] },
      text: "Psst... soon you won't find every lead yourself. Fans, Staff, Agencies, Partners. The Lead Squad is coming." },

    // --- Late game (L4–L10): SPEC-LATE §2 state paths and §3–4 metrics only. Metrics that an
    // engine-late system adds (criticalFires, valuation) are guarded with that system's minLevel.
    // SPEC-GAP: there is no payroll-share metric, so "payroll is eating the revenue" uses a razor-thin
    // 30-day margin while staff are on payroll as the proxy.
    { id: 'l8_big_fire', cond: { all: [{ minLevel: 8 }, { path: 'metrics.criticalFires', gte: 1 }] },
      text: 'A big fire is burning! Spend CEO attention on high-impact fires first. The noisy little ones can wait.' },
    { id: 'payroll_heavy', cond: { all: [{ minLevel: 4 }, { path: 'metrics.payrollDaily', gt: 0 }, { path: 'metrics.revenue30', gt: 0 }, { path: 'metrics.profitMargin30', lt: 0.05 }] },
      text: 'Your profit margin is razor thin, and payroll is usually the biggest bill. Every hire has to earn more than they cost.' },
    { id: 'morale_low', cond: { all: [{ minLevel: 4 }, { path: 'team.morale', lt: 50 }] },
      text: 'Team morale is sinking. Overloaded people do sloppy work, then quit. Lighten the load before you pile on more.' },

    // Level 4: Crew
    { id: 'l4_doing_it_all', cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', eq: 1 }, { path: 'customers.active', gte: 3 }, { path: 'metrics.founderDeliveryShare', gte: 0.95 }] },
      text: "You're still doing every bit of delivery yourself. Hire your first delivery helper and buy back your day." },
    { id: 'l4_first_hire', cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 2 }] },
      text: "Your first hire! You're a trainer now. Write the steps down, show them, then watch them do it until they nail it." },
    { id: 'l4_let_go', cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 3 }, { path: 'metrics.founderDeliveryShare', gte: 0.6 }] },
      text: "You hired help but you're still doing most of the work. Let them. Eighty percent as good as you, done by someone else, is a win." },
    { id: 'l4_playbook', cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 3 }, { path: 'sops.delivery', eq: 0 }] },
      text: "A crew and zero Playbooks? Everyone's doing it their own way. Write down how it's done so results stop depending on who shows up." },
    { id: 'l4_ramping', cond: { all: [{ minLevel: 4 }, { path: 'team.ramp', gte: 3 }] },
      text: "Lots of new faces still learning the ropes. New hires start slow. Don't judge them in week one, and don't hire faster than you can train." },
    { id: 'unmanaged_staff', cond: { all: [{ minLevel: 5 }, { path: 'metrics.unmanaged', gte: 2 }, { any: [{ path: 'metrics.profitMargin30', gte: 0.12 }, { path: 'metrics.runwayDays', gte: 30 }] }] },
      text: 'Some of your people have nobody checking in on them, so they coast at about 60%. Hire a manager once your margin can carry one.' },
    { id: 'l4_staff_squad', cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 3 }, { path: 'team.setter', eq: 0 }, { any: [{ path: 'metrics.profitMargin30', gte: 0.12 }, { path: 'metrics.runwayDays', gte: 30 }] }] },
      text: 'Still doing all the outreach yourself? A setter can run the Daily Grind for you. That is Staff on your Lead Squad.' },
    { id: 'l4_fans', cond: { all: [{ minLevel: 4 }, { path: 'squad.fans.on', eq: false }, { path: 'reputation.testimonials', gte: 8 }] },
      text: 'Your happy customers already brag about you. Switch on Fans in the Company tab and reward them when a friend buys.' },

    // Level 5: Focus
    { id: 'l5_no_focus', cond: { all: [{ level: 5 }, { path: 'focus', lt: 20 }, { path: 'metrics.headcount', gte: 5 }] },
      text: "Niche Focus has barely moved. When you serve everyone, nobody feels it was built for them. Slide it up and watch the close rate." },
    { id: 'l5_focused', cond: { all: [{ minLevel: 5 }, { path: 'focus', gte: 60 }] },
      text: 'Fewer leads, bigger yeses. Turning people away feels scary, but look at those customers stick around.' },
    { id: 'l5_more_managers', cond: { all: [{ minLevel: 5 }, { path: 'metrics.unmanaged', gte: 4 }, { any: [{ path: 'metrics.profitMargin30', gte: 0.12 }, { path: 'metrics.runwayDays', gte: 30 }] }] },
      text: 'Four or more people with no manager. Each manager can only coach a handful well. Add another one.' },
    { id: 'l5_founder_sales', cond: { all: [{ minLevel: 5 }, { path: 'metrics.headcount', gte: 5 }, { path: 'metrics.founderSalesShare', gte: 0.7 }, { any: [{ path: 'metrics.profitMargin30', gte: 0.12 }, { path: 'metrics.runwayDays', gte: 30 }] }] },
      text: 'You still take most of the sales calls. Hire a sales rep, hand them the Close Kit and step back.' },
    { id: 'l4_hold_hiring', cond: { all: [{ minLevel: 4 }, { path: 'metrics.staff', gte: 2 }, { path: 'metrics.revenue30', gt: 0 }, { path: 'metrics.profitMargin30', lt: 0.08 }] },
      text: 'Margin under 8%. Hold hiring for now. Check the price hint on the Offer tab and let go of anyone sitting idle before you add more people.' },
    { id: 'l5_thin_margin', cond: { all: [{ level: 5 }, { path: 'metrics.revenue30', gte: 20000 }, { path: 'metrics.profitMargin30', lt: 0.1 }] },
      text: 'Big sales, tiny profit. Niche down and charge like the specialist you are. Saying no to bad-fit buyers saves money too.' },

    // Level 6: Product Line
    { id: 'l6_no_premium', cond: { all: [{ level: 6 }, { path: 'metrics.headcount', gte: 7 }, { path: 'premium.built', eq: false }, { path: 'premium.buildDays', eq: 0 }] },
      text: "Customers finish and find no next step. That's money walking out the door. Start your premium product in the Product Lab." },
    { id: 'l6_save_premium', cond: { all: [{ level: 6 }, { path: 'metrics.headcount', gte: 8 }, { path: 'premium.built', eq: false }, { path: 'premium.buildDays', eq: 0 }, { path: 'metrics.premiumShare30', lt: 0.01 }] },
      text: 'Your goal now is the premium product. Pause growth hires and big upgrades and save for the Product Lab. It pays you back from people who already trust you.' },
    { id: 'l6_premium_off', cond: { all: [{ minLevel: 6 }, { path: 'premium.built', eq: true }, { path: 'premium.on', eq: false }] },
      text: 'Your premium product is built and gathering dust. Switch it on and offer it to the people who already trust you.' },
    { id: 'l6_partners', cond: { all: [{ minLevel: 6 }, { path: 'metrics.headcount', gte: 12 }, { path: 'squad.partners.count', eq: 0 }] },
      text: 'Other businesses already serve your buyers. Recruit a Partner and only pay them when they send you a sale.' },

    // Level 7: Tune-Up
    { id: 'l7_efficiency_low', cond: { all: [{ minLevel: 7 }, { path: 'ops.efficiency', lt: 65 }] },
      text: 'Efficiency is sliding. Every new hire adds meetings, handoffs and mix-ups. Run an improvement project before you hire again.' },
    { id: 'l7_fix_weakest', cond: { all: [{ level: 7 }, { path: 'ops.done', eq: 0 }, { path: 'ops.efficiency', lt: 75 }] },
      text: 'No improvement project finished yet. Find your weakest number and fix that one first. Polishing a strong one barely helps.' },
    { id: 'l7_rev_per_head', cond: { all: [{ minLevel: 7 }, { path: 'metrics.headcount', gte: 20 }, { path: 'metrics.revenuePerEmployee', lt: 100000 }] },
      text: 'Each person brings in under $100k a year. More bodies is not the fix. Make the people you already have more effective.' },

    // Level 8: Org Chart
    { id: 'l8_idle_attention', cond: { all: [{ minLevel: 8 }, { path: 'attention.left', gte: 3 }, { path: 'fires', gte: 2 }] },
      text: 'Fires are open and your CEO attention is just sitting there. It resets every week, so spend it on the fires that matter.' },
    { id: 'l8_sick_dept', cond: { all: [{ minLevel: 8 }, { any: [
        { path: 'depts.marketing.health', lt: 40 }, { path: 'depts.sales.health', lt: 40 },
        { path: 'depts.delivery.health', lt: 40 }, { path: 'depts.people.health', lt: 40 },
        { path: 'depts.finance.health', lt: 40 }, { path: 'depts.tech.health', lt: 40 }] }] },
      text: 'One department is deep in the red, and it drags the others down with it. Point your attention there first.' },
    { id: 'l8_calm_week', cond: { all: [{ minLevel: 8 }, { path: 'calmDays', gte: 7 }] },
      text: 'A whole week with no big fire burning. That is what good triage buys you: room to think.' },

    // Level 9: Specialists
    { id: 'l9_no_specialists', cond: { all: [{ level: 9 }, { path: 'metrics.headcount', gte: 60 },
        { path: 'depts.marketing.spec', eq: 0 }, { path: 'depts.sales.spec', eq: 0 }, { path: 'depts.delivery.spec', eq: 0 }] },
      text: 'Everyone still does a bit of everything. Generalists got you here, specialists take you further. Upgrade your weakest department first.' },
    { id: 'l9_people_dept', cond: { all: [{ minLevel: 9 }, { path: 'depts.people.health', lt: 50 }] },
      text: 'Hiring at this pace needs a real People team. A weak People department means slow ramps and grumpy crews.' },

    // Level 10: Empire
    { id: 'l10_place_bet', cond: { all: [{ level: 10 }, { notFlag: 'betDone' }] },
      text: "Growth is flattening and more of the same won't fix it. That's what the Big Bet is for. Stack the prep in your favor first." },
    { id: 'l10_bet_won', cond: { flag: 'betWon' },
      text: 'The Big Bet paid off! The market noticed, and buyers will too. Your company just got a lot more valuable.' },
    { id: 'l10_bet_lost', cond: { all: [{ flag: 'betDone' }, { notFlag: 'betWon' }] },
      text: "The bet missed. It happens to the best. A healthy core business is what keeps you standing after a miss, so check your cash cushion and keep climbing." },
    { id: 'l10_owner_needed', cond: { all: [{ level: 10 }, { any: [{ path: 'metrics.founderSalesShare', gte: 0.2 }, { path: 'metrics.founderDeliveryShare', gte: 0.2 }] }] },
      text: "Buyers ask one thing first: does this run without the founder? Right now it doesn't. Hand off what you still do yourself." },
    { id: 'l10_repeat_revenue', cond: { all: [{ level: 10 }, { path: 'combos.membership.on', eq: false }] },
      text: 'Money that renews every month is worth far more to a buyer than one-off sales. A Membership raises your multiple.' },
    { id: 'l10_summit_ready', cond: { all: [{ minLevel: 10 }, { path: 'metrics.valuation', gte: 50000000 }] },
      text: 'Company value just passed $50 million. Finish the rest of your goal and The Summit is yours. Your call, Chairman.' }
  ];

  // ---------------------------------------------------------------------------
  // ACHIEVEMENTS
  // ---------------------------------------------------------------------------
  C.achievements = [
    { id: 'hand_raised', name: 'Hand Raised', emoji: '🙋', desc: 'Get your very first lead.',
      cond: { path: 'stats.leadsTotal', gte: 1 } },
    { id: 'free_sample', name: 'Free Sample', emoji: '🧪', desc: 'Someone starts a free trial.',
      cond: { path: 'stats.trialsStarted', gte: 1 } },
    { id: 'word_of_mouth', name: 'Word of Mouth', emoji: '🗣️', desc: 'Collect your first testimonial.',
      cond: { path: 'reputation.testimonials', gte: 1 } },
    { id: 'button_masher', name: 'Button Masher', emoji: '👆', desc: "Tap 'Reach out!' 100 times.",
      cond: { path: 'stats.tapsTotal', gte: 100 } },
    { id: 'grind_week', name: 'Grind Week', emoji: '🔥', desc: 'Finish the Daily Grind 7 days in a row.',
      cond: { path: 'streak.grindDays', gte: 7 } },
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', desc: 'Pull your first overtime shift.',
      cond: { path: 'energy.overtimeToday', eq: true } },
    { id: 'first_sale', name: 'Cha-ching!', emoji: '💰', desc: 'Make your first paid sale.',
      cond: { path: 'stats.salesCount', gte: 1 } },
    { id: 'ramen_mode', name: 'Ramen Mode', emoji: '🍜', desc: 'Keep the lights on with less than $100 in the bank.',
      cond: { all: [{ path: 'cash', gte: 0 }, { path: 'cash', lt: 100 }] } },
    { id: 'ten_yeses', name: 'Ten Yeses', emoji: '✋', desc: 'Close 10 sales.',
      cond: { path: 'stats.salesCount', gte: 10 } },
    { id: 'five_grand', name: 'Five Grand', emoji: '💵', desc: 'Reach $5,000 in total sales.',
      cond: { path: 'stats.revenueTotal', gte: 5000 } },
    { id: 'thousand_day', name: 'Thousand-Dollar Day', emoji: '🤑', desc: 'Bring in $1,000 or more in a single day.',
      cond: { path: 'metrics.revenueToday', gte: 1000 } },
    { id: 'wall_of_love', name: 'Wall of Love', emoji: '🧱', desc: 'Collect 10 testimonials.',
      cond: { path: 'reputation.testimonials', gte: 10 } },
    { id: 'bold_promise', name: 'Bold Promise', emoji: '🛡️', desc: 'Back your offer with a no-questions-asked guarantee.',
      cond: { path: 'offer.guarantee', eq: 'unconditional' } },
    { id: 'no_brainer', name: 'No-Brainer', emoji: '🧠', desc: 'Push all four Value-o-Meter dials to 6 or higher.',
      cond: { all: [{ path: 'offer.dream', gte: 6 }, { path: 'offer.likelihood', gte: 6 }, { path: 'offer.speed', gte: 6 }, { path: 'offer.ease', gte: 6 }] } },
    // SPEC-GAP: state has no upsell counter, so "first upsell" = Upsell is on and a sale happened today.
    { id: 'next_step', name: 'Next Step Sold', emoji: '⬆️', desc: 'Make a sale with your Upsell switched on.',
      cond: { all: [{ path: 'combos.upsell.on', eq: true }, { path: 'metrics.salesToday', gte: 1 }] } },
    { id: 'first_member_ach', name: 'Regulars', emoji: '🔁', desc: 'Sign up your first monthly member.',
      cond: { path: 'customers.members', gte: 1 } },
    { id: 'crowd_pleaser', name: 'Crowd Pleaser', emoji: '📣', desc: 'Grow your audience to 1,000 followers.',
      cond: { path: 'audience', gte: 1000 } },
    { id: 'three_to_one', name: 'Three to One', emoji: '⚖️', desc: 'Get LTV to at least 3x CAC after real ad spend.',
      cond: { all: [{ path: 'metrics.adLtvCac', gte: 3 }, { path: 'stats.adSpendTotal', gte: 200 }] } },
    { id: 'self_funded', name: 'Self-Funding Machine', emoji: '🏦', desc: 'New customers pay back what they cost within 30 days.',
      cond: { flag: 'clientFinanced' } },
    { id: 'garage_grad', name: 'Out of the Garage', emoji: '🚪', desc: 'Graduate Level 1.',
      cond: { minLevel: 2 } },
    { id: 'summit_bound', name: 'Summit Bound', emoji: '🏔️', desc: 'Graduate Level 3 and build a steady growth engine.',
      cond: { minLevel: 4 } },

    // --- Late game (L4–L10). Metrics from engine-late systems are guarded with their minLevel.
    // SPEC-GAP: 'summit_sold' needs one achievement pass after sellCompany sets exit.sold (the run ends
    // there), so engine-late should check achievements before it computes the exit score.
    { id: 'first_hire', name: 'Not Alone', emoji: '🙌', desc: 'Make your first hire.',
      cond: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 2 }] } },
    { id: 'written_down', name: 'Written Down', emoji: '📘', desc: 'Write your first Playbook.',
      cond: { any: [{ path: 'sops.delivery', gte: 1 }, { path: 'sops.sales', gte: 1 }, { path: 'sops.marketing', gte: 1 }, { path: 'sops.hiring', gte: 1 }] } },
    { id: 'off_the_tools', name: 'Off the Tools', emoji: '🧤', desc: 'Let your team handle 90% of the delivery work.',
      cond: { all: [{ minLevel: 4 }, { path: 'customers.active', gte: 5 }, { path: 'metrics.founderDeliveryShare', lte: 0.1 }] } },
    { id: 'first_manager', name: 'Middle Manager', emoji: '📋', desc: 'Hire your first manager.',
      cond: { path: 'team.manager', gte: 1 } },
    { id: 'team_10', name: 'Double Digits', emoji: '🔟', desc: 'Grow to 10 people.',
      cond: { path: 'metrics.headcount', gte: 10 } },
    { id: 'laser_focus', name: 'Laser Focus', emoji: '🎯', desc: 'Push Niche Focus to 80 or more.',
      cond: { path: 'focus', gte: 80 } },
    { id: 'top_shelf', name: 'Top Shelf', emoji: '💎', desc: 'Build your premium product and put it on sale.',
      cond: { all: [{ path: 'premium.built', eq: true }, { path: 'premium.on', eq: true }] } },
    { id: 'tuned_up', name: 'Tuned Up', emoji: '🔧', desc: 'Finish your first improvement project.',
      cond: { path: 'ops.done', gte: 1 } },
    { id: 'team_50', name: 'Fifty Strong', emoji: '🏢', desc: 'Grow to 50 people.',
      cond: { path: 'metrics.headcount', gte: 50 } },
    { id: 'calm_waters', name: 'Calm Waters', emoji: '🌊', desc: 'Go 14 days in a row with no big fire left burning.',
      cond: { all: [{ minLevel: 8 }, { path: 'calmDays', gte: 14 }] } },
    { id: 'team_100', name: 'Hundred Club', emoji: '💯', desc: 'Grow to 100 people.',
      cond: { path: 'metrics.headcount', gte: 100 } },
    { id: 'dream_team', name: 'Dream Team', emoji: '🧬', desc: 'Build deep specialist teams in all six departments.',
      cond: { all: [
        { path: 'depts.marketing.spec', gte: 2 }, { path: 'depts.sales.spec', gte: 2 }, { path: 'depts.delivery.spec', gte: 2 },
        { path: 'depts.people.spec', gte: 2 }, { path: 'depts.finance.spec', gte: 2 }, { path: 'depts.tech.spec', gte: 2 }] } },
    { id: 'team_250', name: 'Small Town', emoji: '🏙️', desc: 'Grow to 250 people.',
      cond: { path: 'metrics.headcount', gte: 250 } },
    { id: 'called_it', name: 'Called It', emoji: '🎲', desc: 'Win your Big Bet.',
      cond: { flag: 'betWon' } },
    { id: 'eight_figures', name: 'Eight Figures', emoji: '📈', desc: 'Grow your company value past $10 million.',
      cond: { all: [{ minLevel: 10 }, { path: 'metrics.valuation', gte: 10000000 }] } },
    { id: 'big_league', name: 'Big League', emoji: '💼', desc: 'Grow your company value past $25 million.',
      cond: { all: [{ minLevel: 10 }, { path: 'metrics.valuation', gte: 25000000 }] } },
    { id: 'summit_ready', name: 'Summit Ready', emoji: '🏆', desc: 'Grow your company value past $50 million.',
      cond: { all: [{ minLevel: 10 }, { path: 'metrics.valuation', gte: 50000000 }] } },
    { id: 'summit_sold', name: 'Top of the Mountain', emoji: '🥂', desc: 'Sell your company at The Summit.',
      cond: { path: 'exit.sold', eq: true } }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
