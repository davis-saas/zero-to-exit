/*
 * Zero to Exit - content/cards-late-a.js
 * Choice cards for Levels 4-6 (6 each) and 6 random events. Appends to
 * ZTE.Content.cards and ZTE.Content.events (SPEC.md 5.6, SPEC-LATE 6).
 * Card ids use the l4_ / l5_ / l6_ prefixes; event ids use ev_a_.
 *
 * Conventions used here:
 * - Every card gates on { minLevel: N } so a player who levels fast still meets it.
 *   Extra gates (headcount, premium on, ad budget, a daily chance) spread the six
 *   cards across the level instead of stacking them on day one.
 * - Effects use only the ops in SPEC 5.2, the paths in SPEC 5.3 + SPEC-LATE 2 and the
 *   mods keys incl. teamOutput, salaryCost, premiumTake, hireRamp.
 * - The 'best' option usually costs cash, burnout or a short slump now and adds
 *   lasting mods; the 'trap' pays now (cash or a short buff) and costs more later.
 *   Each 'best' leans on at least one lever that shows up in cash inside the ghost
 *   timeline (closeRate, perceivedValue, salaryCost, deliveryEnergy, adCpl,
 *   premiumTake while premium is on, partners) so the lesson is visible.
 * - Integration balance pass: every mod is the square root of the builder's original
 *   (e.g. 1.10 -> 1.049) so the 42 late cards do not stack into a runaway economy.
 * - Text never names a role by its in-game title (titles change per flavor), so
 *   it says "someone to handle delivery", "a salesperson", "your best person".
 *
 * Flags set here (free for anyone to read):
 *   deliveryHireFirst, salesHireFirst, founderDoesAll, wrotePlaybook, wingedIt,
 *   hiredFriend*, properPayroll, cashUnderTable*, askForReferrals, referralBounty,
 *   pickedNiche, firedBadClient, keptBadClient, saidYesCustom, trainedManager,
 *   cutServices, discountedMisfits, chasedNewMarket, cheapPremium,
 *   handPickedPartners, partnerDiscounts, agencyTeaches, agencyLockIn,
 *   giantBundle, fixedDelivery.        (* = read by an event below)
 *
 * SPEC-GAP: cards cannot hire (team.* counts are not effect paths), so options
 * describe how you hire or hand off; the real hire happens in the Company tab and
 * coach lines point there.
 * SPEC-GAP: no card writes sops.* so the Playbook upgrades keep their full value;
 * the "write it down" card uses mods (deliveryEnergy, teamOutput, hireRamp) instead.
 * SPEC-GAP: the premium price / bundle / quality cards wait for premium.on, so their
 * premiumTake effects are real in the ghost timeline (an unbuilt product sells nothing).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  ZTE.Content.cards = (ZTE.Content.cards || []).concat([
    /* ------------------------------------------------------------------ */
    /* LEVEL 4 - CREW (too much for one person)                           */
    /* ------------------------------------------------------------------ */
    {
      id: 'l4_first_hire', level: 4, emoji: '🙋', title: 'Your first hire',
      trigger: { all: [{ minLevel: 4 }] },
      priority: 9,
      text: 'You can\'t keep up. Client work eats your whole day, sales calls get squeezed into the gaps, and you need sleep. Who joins the crew first?',
      ghostDays: 90,
      options: [
        {
          id: 'delivery_first', label: 'Hire someone to handle delivery. You keep selling', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'add', path: 'burnout', value: -15 },
            { op: 'mod', stat: 'closeRate', mult: 1.034 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.974 },
            { op: 'flag', name: 'deliveryHireFirst', value: true },
            { op: 'coach', text: 'Open the Company tab and hire for delivery first. Your calendar will thank you.' }
          ],
          outcome: 'Training them ate a week and $500. Then your days opened up, and you hit every sales call fresh.',
          lesson: 'Hand off the work you can teach. Keep the work only you can do, for now.'
        },
        {
          id: 'booker_first', label: 'Hire someone to book more sales calls', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 5 },
            { op: 'buff', stat: 'bookRate', mult: 1.15, days: 14, label: 'Fresh call booker' }
          ],
          outcome: 'Your calendar filled up fast. Shame you\'re still too buried in delivery to take most of those calls.',
          lesson: 'More leads don\'t help when your hands are already full.'
        },
        {
          id: 'sales_first', label: 'Hire a pricey salesperson so you can step back', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.1, days: 10, label: 'New salesperson buzz' },
            { op: 'add', path: 'burnout', value: 10 },
            { op: 'mod', stat: 'salaryCost', mult: 1.01 },
            { op: 'mod', stat: 'closeRate', mult: 0.992 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'mod', stat: 'refundRate', mult: 1.019 },
            { op: 'flag', name: 'salesHireFirst', value: true }
          ],
          outcome: 'They landed a few deals in week one! Then clients waited on you, refunds crept in, and the big salary kept coming.',
          lesson: 'Don\'t hire someone to sell more of what you can\'t deliver.'
        }
      ],
      notebook: 'first_hire'
    },

    {
      id: 'l4_let_go', level: 4, emoji: '🔑', title: 'Only you can do it?',
      trigger: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 2 }] },
      priority: 7,
      text: 'Your new hire is ready. But clients keep asking for you, and part of you likes it. Do you let go?',
      ghostDays: 90,
      options: [
        {
          id: 'warm_handoff', label: 'Introduce them warmly, shadow for a week, then step out', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'add', path: 'burnout', value: -10 },
            { op: 'add', path: 'team.morale', value: 8 },
            { op: 'mod', stat: 'closeRate', mult: 1.03 },
            { op: 'mod', stat: 'teamOutput', mult: 1.02 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.98 }
          ],
          outcome: 'A few clients grumbled for a week. Then they loved the new person, and you got whole afternoons back for selling.',
          lesson: 'If it all depends on you, you own a job, not a business.'
        },
        {
          id: 'keep_favorites', label: 'Keep your favorite clients, hand off the rest', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 5 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 }
          ],
          outcome: 'Half your week is still delivery. Better than all of it, but you\'re still the bottleneck.',
          lesson: 'Letting go halfway still leaves you holding the heavy end.'
        },
        {
          id: 'do_it_all', label: 'Keep doing it all yourself. Nobody does it like you', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'churn', mult: 0.9, days: 10, label: 'Clients love the founder' },
            { op: 'add', path: 'burnout', value: 15 },
            { op: 'add', path: 'team.morale', value: -10 },
            { op: 'mod', stat: 'teamOutput', mult: 0.987 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'mod', stat: 'closeRate', mult: 0.992 },
            { op: 'flag', name: 'founderDoesAll', value: true }
          ],
          outcome: 'Clients felt special for a week. Then you got slower at everything, and your new hire got bored and stopped trying.',
          lesson: 'Your team can\'t grow if you never hand them the keys.'
        }
      ],
      notebook: 'hire_help'
    },

    {
      id: 'l4_playbook', level: 4, emoji: '📒', title: 'Write it down?',
      trigger: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 2 }, { chance: 0.5 }] },
      priority: 6,
      text: 'Every new hire asks the same twenty questions. You answer them all, every time, from memory.',
      ghostDays: 75,
      options: [
        {
          id: 'record_it', label: 'Film yourself doing the work, then turn it into step-by-step guides', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 10 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.985 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 },
            { op: 'mod', stat: 'hireRamp', mult: 1.046 },
            { op: 'mod', stat: 'refundRate', mult: 0.982 },
            { op: 'mod', stat: 'closeRate', mult: 1.007 },
            { op: 'flag', name: 'wrotePlaybook', value: true },
            { op: 'coach', text: 'Love it. Playbooks in the Company tab take this even further.' }
          ],
          outcome: 'Two late nights with your phone camera. Now new people learn in days, and every client gets the same great result.',
          lesson: 'If it only lives in your head, it walks out the door when you\'re tired.'
        },
        {
          id: 'buy_template', label: 'Buy a generic template off the internet', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -300 },
            { op: 'mod', stat: 'hireRamp', mult: 1.025 }
          ],
          outcome: 'It covered the basics. None of the little tricks that make your way work, though.',
          lesson: 'A template is a start. Your own steps are the secret sauce.'
        },
        {
          id: 'wing_it', label: 'Skip it. Smart people figure things out', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'teamOutput', mult: 1.05, days: 7, label: 'No time spent writing' },
            { op: 'mod', stat: 'refundRate', mult: 1.019 },
            { op: 'mod', stat: 'churn', mult: 1.015 },
            { op: 'mod', stat: 'hireRamp', mult: 0.974 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'flag', name: 'wingedIt', value: true }
          ],
          outcome: 'No writing, no time lost! But everyone did it their own way, and some clients got a much worse version of you.',
          lesson: 'Without a written way, every hire invents their own.'
        }
      ],
      notebook: 'playbooks'
    },

    {
      id: 'l4_friend_or_pro', level: 4, emoji: '👯', title: 'Hire your buddy?',
      trigger: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 2 }, { chance: 0.3 }] },
      priority: 5,
      text: 'Your best friend needs a job and could start tomorrow. A seasoned pro also applied, but wants more money.',
      ghostDays: 90,
      options: [
        {
          id: 'same_tryout', label: 'Give both the same paid tryout task. Best work wins', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -300 },
            { op: 'mod', stat: 'teamOutput', mult: 1.02 },
            { op: 'mod', stat: 'salaryCost', mult: 0.984 },
            { op: 'mod', stat: 'closeRate', mult: 1.03 }
          ],
          outcome: 'Awkward, but fair. The work spoke for itself, and whoever got the job knew they earned it.',
          lesson: 'Hire for the job you need done, not the person you want to help.'
        },
        {
          id: 'hire_pro', label: 'Hire the pro. Safe, but pricey', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'salaryCost', mult: 1.02 },
            { op: 'mod', stat: 'teamOutput', mult: 1.015 }
          ],
          outcome: 'They\'re great. They also cost more than you budgeted, and your friend stopped texting back.',
          lesson: 'Paying for experience works. Testing for it works even better.'
        },
        {
          id: 'hire_friend', label: 'Hire your buddy today. Trust beats a resume', quality: 'trap',
          effects: [
            { op: 'add', path: 'burnout', value: -10 },
            { op: 'add', path: 'team.morale', value: 5 },
            { op: 'mod', stat: 'teamOutput', mult: 0.985 },
            { op: 'mod', stat: 'churn', mult: 1.012 },
            { op: 'mod', stat: 'salaryCost', mult: 1.005 },
            { op: 'flag', name: 'hiredFriend', value: true }
          ],
          outcome: 'Fun for a week! Then you had to give your best friend tough feedback, and you just... didn\'t.',
          lesson: 'If you couldn\'t let them go, think twice before you let them in.'
        }
      ],
      notebook: 'first_hire'
    },

    {
      id: 'l4_contractor', level: 4, emoji: '📋', title: 'Part-time or all in?',
      trigger: { all: [{ minLevel: 4 }, { path: 'metrics.headcount', gte: 3 }] },
      priority: 6,
      text: 'Your part-timers are good, but they juggle other gigs and vanish on busy days. Time to decide how you pay people.',
      ghostDays: 90,
      options: [
        {
          id: 'make_official', label: 'Make them real hires with proper payroll and clear roles', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'add', path: 'team.morale', value: 10 },
            { op: 'mod', stat: 'teamOutput', mult: 1.022 },
            { op: 'mod', stat: 'salaryCost', mult: 0.985 },
            { op: 'mod', stat: 'hireRamp', mult: 1.024 },
            { op: 'flag', name: 'properPayroll', value: true }
          ],
          outcome: 'A payroll service, paperwork and a real first day cost $500 and a weekend. Now people stay, and nobody burns cash replacing them.',
          lesson: 'People commit to companies that commit to them.'
        },
        {
          id: 'stay_contractors', label: 'Keep them as part-time contractors for now', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'salaryCost', mult: 0.99 },
            { op: 'mod', stat: 'teamOutput', mult: 0.99 }
          ],
          outcome: 'Cheaper on paper. But on your busiest days, half of them were busy somewhere else.',
          lesson: 'Part-time help brings part-time commitment.'
        },
        {
          id: 'off_books', label: 'Pay cash off the books and skip payroll taxes', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 600 },
            { op: 'add', path: 'team.morale', value: -8 },
            { op: 'mod', stat: 'teamOutput', mult: 0.99 },
            { op: 'mod', stat: 'salaryCost', mult: 1.01 },
            { op: 'mod', stat: 'hireRamp', mult: 0.96 },
            { op: 'flag', name: 'cashUnderTable', value: true }
          ],
          outcome: 'You kept $600 this month! Good people kept leaving for real jobs, though, and you\'re one letter away from a tax mess.',
          lesson: 'Shortcuts on payroll come back with interest.'
        }
      ],
      notebook: 'payroll_math'
    },

    {
      id: 'l4_referrals', level: 4, emoji: '🎟️', title: 'Pay for referrals?',
      trigger: { all: [{ minLevel: 4 }, { path: 'customers.active', gte: 10 }, { chance: 0.25 }] },
      priority: 4,
      text: 'Happy clients mention you to friends now and then. You want way more of that. How do you get it?',
      ghostDays: 90,
      options: [
        {
          id: 'ask_at_win', label: 'Ask right after each client\'s big win, with a small thank-you gift', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'mod', stat: 'referralRate', mult: 1.117 },
            { op: 'mod', stat: 'testimonialChance', mult: 1.049 },
            { op: 'mod', stat: 'closeRate', mult: 1.024 },
            { op: 'flag', name: 'askForReferrals', value: true },
            { op: 'coach', text: 'Turn on Fans in the Lead Squad (Company tab) to keep those intros coming.' }
          ],
          outcome: 'A handwritten card and a coffee gift, right at the high point. Referrals jumped, and they showed up already trusting you.',
          lesson: 'Ask when they\'re happiest, and make it easy to say yes.'
        },
        {
          id: 'hope_it_spreads', label: 'Do nothing special. Great work spreads on its own', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'referralRate', mult: 1.015 }
          ],
          outcome: 'A few referrals trickled in. Nice, but you left plenty on the table by never asking.',
          lesson: 'Most happy clients would send a friend. Most are never asked.'
        },
        {
          id: 'cash_bounty', label: 'Pay $200 cash to anyone for any signup they send', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -1500 },
            { op: 'add', path: 'leads', value: 6 },
            { op: 'mod', stat: 'referralRate', mult: 1.012 },
            { op: 'mod', stat: 'refundRate', mult: 1.035 },
            { op: 'mod', stat: 'churn', mult: 1.015 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'flag', name: 'referralBounty', value: true }
          ],
          outcome: 'Bounty hunters sent anyone with a pulse. Lots of signups, lots of refunds, and $1,500 out the door.',
          lesson: 'Reward people for sending good fits, not just bodies.'
        }
      ],
      notebook: 'lead_squad'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 5 - FOCUS (trying to serve everyone)                         */
    /* ------------------------------------------------------------------ */
    {
      id: 'l5_niche', level: 5, emoji: '🔍', title: 'Serve everyone?',
      trigger: { all: [{ minLevel: 5 }] },
      priority: 9,
      text: 'Your team serves five kinds of customers, and each wants something different. Nobody is great at anything anymore.',
      ghostDays: 90,
      options: [
        {
          id: 'serve_best', label: 'Study your 10 happiest customers. Build everything around people like them', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'mod', stat: 'closeRate', mult: 1.051 },
            { op: 'mod', stat: 'churn', mult: 0.951 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.98 },
            { op: 'mod', stat: 'referralRate', mult: 1.038 },
            { op: 'flag', name: 'pickedNiche', value: true },
            { op: 'coach', text: 'Now slide Niche focus up in the Company tab. Fewer leads, more money per customer.' }
          ],
          outcome: 'You rewrote your materials and turned some leads away. Then sales got easy, and happy clients started sending friends just like them.',
          lesson: 'Try to be perfect for everyone and you end up special to no one.'
        },
        {
          id: 'two_lanes', label: 'Keep two customer types and split the team', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.995 },
            { op: 'mod', stat: 'closeRate', mult: 1.01 }
          ],
          outcome: 'A little calmer. But two pitches and two sets of problems still pull your team apart.',
          lesson: 'Half-focused beats unfocused. Fully focused beats both.'
        },
        {
          id: 'stay_broad', label: 'Stay broad. Every customer is money!', quality: 'trap',
          effects: [
            { op: 'add', path: 'leads', value: 12 },
            { op: 'mod', stat: 'closeRate', mult: 0.974 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.02 },
            { op: 'mod', stat: 'teamOutput', mult: 0.984 },
            { op: 'mod', stat: 'churn', mult: 1.024 }
          ],
          outcome: 'A nice bump of leads this week. Then delivery got messier, your pitch got vaguer, and more people said "maybe later."',
          lesson: 'A message for everyone lands with no one.'
        }
      ],
      notebook: 'ideal_customer'
    },

    {
      id: 'l5_bad_fit_client', level: 5, emoji: '😤', title: 'The nightmare client',
      trigger: { all: [{ minLevel: 5 }, { path: 'metrics.headcount', gte: 4 }, { chance: 0.3 }] },
      priority: 6,
      text: 'Your biggest client pays well, but yells at your team, changes the plan weekly, and eats a huge slice of everyone\'s time.',
      ghostDays: 90,
      options: [
        {
          id: 'let_them_go', label: 'Refund this month, thank them, and help them find a better fit', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'add', path: 'team.morale', value: 12 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 },
            { op: 'mod', stat: 'salaryCost', mult: 0.992 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.99 },
            { op: 'mod', stat: 'closeRate', mult: 1.01 },
            { op: 'flag', name: 'firedBadClient', value: true }
          ],
          outcome: 'Losing that check stung. But your team cheered, overtime vanished, and your good clients got your best people back.',
          lesson: 'Some revenue costs more than it pays.'
        },
        {
          id: 'set_rules', label: 'Keep them, but set firm rules and raise their price', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: 500 },
            { op: 'add', path: 'team.morale', value: -3 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.005 }
          ],
          outcome: 'They grumbled, paid more, and behaved... mostly. Your team still flinches when their number pops up.',
          lesson: 'Rules help. Sometimes the fit is still wrong.'
        },
        {
          id: 'keep_them_happy', label: 'Give them whatever they want. They pay the most!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 2500 },
            { op: 'add', path: 'team.morale', value: -15 },
            { op: 'mod', stat: 'teamOutput', mult: 0.987 },
            { op: 'mod', stat: 'salaryCost', mult: 1.01 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'flag', name: 'keptBadClient', value: true }
          ],
          outcome: 'They bought extras, and the money was nice. Two of your best people quietly started job hunting.',
          lesson: 'Never let one client matter more than your whole team.'
        }
      ],
      notebook: 'saying_no'
    },

    {
      id: 'l5_custom_request', level: 5, emoji: '🛠️', title: 'Just one custom version?',
      trigger: { all: [{ minLevel: 5 }, { chance: 0.25 }] },
      priority: 5,
      text: 'A big prospect will sign today if you build them a custom version. Their own reports, their own schedule, their own everything.',
      ghostDays: 90,
      options: [
        {
          id: 'point_to_core', label: 'Say no kindly, and show how the core offer gets them there', quality: 'best',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 0.92, days: 7, label: 'Turned down custom deals' },
            { op: 'add', path: 'team.morale', value: 3 },
            { op: 'mod', stat: 'closeRate', mult: 1.017 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.992 },
            { op: 'mod', stat: 'teamOutput', mult: 1.007 }
          ],
          outcome: 'They walked, and a couple like them did too. But your team stayed sharp, and your one clear offer started selling better.',
          lesson: 'Every yes to a custom job is a no to your core.'
        },
        {
          id: 'charge_triple', label: 'Build it, but charge triple for the custom work', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: 2000 },
            { op: 'add', path: 'team.morale', value: -5 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.02 },
            { op: 'mod', stat: 'teamOutput', mult: 0.995 }
          ],
          outcome: 'Great check. Then the custom work dragged on for weeks, and everyone else waited in line.',
          lesson: 'Charging more for custom work softens the blow. It doesn\'t remove it.'
        },
        {
          id: 'yes_for_free', label: 'Say yes at no extra charge. A win is a win!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 1500 },
            { op: 'add', path: 'team.morale', value: -8 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.015 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'flag', name: 'saidYesCustom', value: true }
          ],
          outcome: 'They signed! Then word got around, and now three more clients want "just one small custom tweak."',
          lesson: 'Whatever you do for one, the rest will expect.'
        }
      ],
      notebook: 'saying_no'
    },

    {
      id: 'l5_promote', level: 5, emoji: '🧭', title: 'Who runs the team?',
      trigger: { all: [{ minLevel: 5 }, { any: [{ path: 'metrics.headcount', gte: 5 }, { path: 'team.manager', gte: 1 }] }] },
      priority: 7,
      text: 'You can\'t check in on everyone anymore. Your best person wants to lead. Or you could bring in a manager from outside.',
      ghostDays: 90,
      options: [
        {
          id: 'promote_and_train', label: 'Promote your star, and train them to manage first', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'add', path: 'team.morale', value: 10 },
            { op: 'mod', stat: 'teamOutput', mult: 1.024 },
            { op: 'mod', stat: 'hireRamp', mult: 1.071 },
            { op: 'mod', stat: 'salaryCost', mult: 0.99 },
            { op: 'flag', name: 'trainedManager', value: true },
            { op: 'coach', text: 'Each manager keeps about six people on track. Hire them before your team outgrows you.' }
          ],
          outcome: 'A management course and a few weeks of coaching later, your star became a real leader. Everyone saw you can grow here.',
          lesson: 'Great doers aren\'t born managers. Train them before you crown them.'
        },
        {
          id: 'hire_outside', label: 'Hire an experienced manager from outside', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'add', path: 'team.morale', value: -3 },
            { op: 'mod', stat: 'salaryCost', mult: 1.015 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 }
          ],
          outcome: 'They know their stuff, but they\'re pricey and don\'t know your clients yet. Your star feels passed over.',
          lesson: 'Outside managers bring skill. Inside ones bring trust.'
        },
        {
          id: 'promote_untrained', label: 'Promote your star tomorrow, and keep their full client load', quality: 'trap',
          effects: [
            { op: 'add', path: 'team.morale', value: -8 },
            { op: 'mod', stat: 'teamOutput', mult: 0.987 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'hireRamp', mult: 0.974 }
          ],
          outcome: 'A free promotion, no cost! Now your best doer is a stressed-out boss doing two jobs badly.',
          lesson: 'Promote without training and you lose a great doer to gain a shaky boss.'
        }
      ],
      notebook: 'span_of_control'
    },

    {
      id: 'l5_cut_services', level: 5, emoji: '✂️', title: 'Too many services',
      trigger: { all: [{ minLevel: 5 }, { any: [{ path: 'metrics.profitMargin30', lte: 0.15 }, { path: 'metrics.headcount', gte: 7 }] }] },
      priority: 6,
      text: 'You sell seven different services. Two bring in almost all the profit. The rest eat time and barely break even.',
      ghostDays: 90,
      options: [
        {
          id: 'cut_to_core', label: 'Cut the losers. Move those clients to your core offer or refer them out', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.982 },
            { op: 'mod', stat: 'salaryCost', mult: 0.99 },
            { op: 'mod', stat: 'closeRate', mult: 1.005 },
            { op: 'flag', name: 'cutServices', value: true }
          ],
          outcome: 'A few clients left and you refunded some prepaid work. Then margins jumped, and your team got really good at two things.',
          lesson: 'Profit hides in what you stop doing.'
        },
        {
          id: 'review_later', label: 'Keep everything for now. Review it next quarter', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 3 }
          ],
          outcome: 'Nothing broke. Nothing got better either. The time sinks are still sinking time.',
          lesson: 'Putting off a decision is still a decision.'
        },
        {
          id: 'add_more', label: 'Add two more services. Bigger menu, more money!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 2500 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.015 },
            { op: 'mod', stat: 'salaryCost', mult: 1.01 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'mod', stat: 'closeRate', mult: 0.992 }
          ],
          outcome: 'Two quick sales of the new stuff! Then your team had to learn two new things, and everything got a bit worse.',
          lesson: 'A bigger menu brings bigger headaches long before bigger profit.'
        }
      ],
      notebook: 'profit_margin'
    },

    {
      id: 'l5_price_misfits', level: 5, emoji: '🧩', title: 'High-maintenance customers',
      trigger: { all: [{ minLevel: 5 }, { path: 'metrics.revenue30', gte: 40000 }, { chance: 0.3 }] },
      priority: 4,
      text: 'Most of your customers are easy to serve. A few are right in your niche but want twice the hand-holding for the same price, and your team groans when they sign.',
      ghostDays: 90,
      options: [
        {
          id: 'fit_premium', label: 'Keep the core price. Extra hand-holding becomes a paid add-on', quality: 'best',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 0.92, days: 10, label: 'Hard cases walking away' },
            { op: 'mod', stat: 'refundRate', mult: 0.974 },
            { op: 'mod', stat: 'churn', mult: 0.982 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.99 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.007 },
            { op: 'mod', stat: 'closeRate', mult: 1.007 },
            { op: 'add', path: 'team.morale', value: 5 }
          ],
          outcome: 'A few hard cases walked. The ones who wanted extra help now paid for it, and your team had time again for everyone else.',
          lesson: 'Extra work deserves an extra price. Let heavy needs pay their own way.'
        },
        {
          id: 'one_price', label: 'One price for everyone. Keep it simple', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.005 }
          ],
          outcome: 'Simple, sure. Your best clients quietly pay for the time your hardest ones eat up.',
          lesson: 'Same price for very different work isn\'t fair to anyone.'
        },
        {
          id: 'discount_misfits', label: 'Give the hard cases a discount so they still sign', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 1500 },
            { op: 'buff', stat: 'closeRate', mult: 1.1, days: 10, label: 'Discount signups' },
            { op: 'add', path: 'team.morale', value: -5 },
            { op: 'mod', stat: 'churn', mult: 1.019 },
            { op: 'mod', stat: 'refundRate', mult: 1.029 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'mod', stat: 'teamOutput', mult: 0.995 },
            { op: 'flag', name: 'discountedMisfits', value: true }
          ],
          outcome: 'More signups this week! Then the discount crowd needed the most help, complained the most, and asked for refunds the most.',
          lesson: 'Discounts pull in the customers who cost you the most.'
        }
      ],
      notebook: 'profit_margin'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 6 - PRODUCT LINE (too little money per customer)             */
    /* ------------------------------------------------------------------ */
    {
      id: 'l6_premium_idea', level: 6, emoji: '💎', title: 'What\'s next?',
      trigger: { all: [{ minLevel: 6 }] },
      priority: 9,
      text: 'Clients finish your program and ask, "What\'s next?" You have nothing to sell them. Meanwhile, a shiny new market is calling.',
      ghostDays: 90,
      options: [
        {
          id: 'ask_customers', label: 'Ask your best customers what they\'d pay for next. Build that', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -2500 },
            { op: 'mod', stat: 'premiumTake', mult: 1.049 },
            { op: 'mod', stat: 'referralRate', mult: 1.019 },
            { op: 'mod', stat: 'churn', mult: 0.982 },
            { op: 'mod', stat: 'upsellTake', mult: 1.024 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.007 },
            { op: 'coach', text: 'Build it in the Product Lab (Company tab), then sell it to people who already trust you.' }
          ],
          outcome: 'Twenty interviews and a stack of gift cards later, you knew exactly what to build. Bonus: clients loved being asked and told their friends.',
          lesson: 'Your easiest next sale is to someone who already bought.'
        },
        {
          id: 'copy_competitor', label: 'Copy whatever a competitor sells as their top tier', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'mod', stat: 'premiumTake', mult: 1.025 }
          ],
          outcome: 'It\'s fine. It\'s also what everyone else sells, so nobody gets excited about it.',
          lesson: 'Copying gets you average. Asking gets you wanted.'
        },
        {
          id: 'new_market', label: 'Launch a new product to a whole new crowd, with a big ad push', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -15000 },
            { op: 'add', path: 'leads', value: 10 },
            { op: 'mod', stat: 'premiumTake', mult: 0.96 },
            { op: 'mod', stat: 'closeRate', mult: 0.99 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.01 },
            { op: 'flag', name: 'chasedNewMarket', value: true }
          ],
          outcome: 'Lots of clicks, few buyers. Strangers don\'t trust you yet, and your team got split across two different worlds.',
          lesson: 'Strangers are the hardest sale there is. Start with your fans.'
        }
      ],
      notebook: 'second_product'
    },

    {
      id: 'l6_premium_price', level: 6, emoji: '💰', title: 'Price the premium',
      trigger: { all: [{ minLevel: 6 }, { path: 'premium.built', eq: true }, { path: 'premium.on', eq: true }] },
      priority: 8,
      text: 'Your premium product is live. Now the scary part: what do you really charge for it?',
      ghostDays: 75,
      options: [
        {
          id: 'price_on_value', label: 'Price it on the result it delivers, and stack bonuses so it\'s a no-brainer', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -2500 },
            { op: 'mod', stat: 'premiumTake', mult: 1.044 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.007 }
          ],
          outcome: 'You priced the outcome, not your hours, and built bonuses that answered every "but what if." Buyers said yes without blinking.',
          lesson: 'Price the result, then make the deal feel silly to pass up.'
        },
        {
          id: 'shave_it', label: 'Trim the price a bit to play it safe', quality: 'ok',
          effects: [
            { op: 'mul', path: 'premium.price', value: 0.75 },
            { op: 'mod', stat: 'premiumTake', mult: 1.025 }
          ],
          outcome: 'A few more buyers, a lot less money per buyer. Safe isn\'t the same as smart.',
          lesson: 'Cutting price is the laziest way to sell more.'
        },
        {
          id: 'bargain', label: 'Price it barely above the core so everyone grabs it', quality: 'trap',
          effects: [
            { op: 'mul', path: 'premium.price', value: 0.4 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.015 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.99 },
            { op: 'flag', name: 'cheapPremium', value: true }
          ],
          outcome: 'Everyone grabbed it! Now your team delivers premium work at bargain prices, and your core offer suddenly looks overpriced.',
          lesson: 'A cheap premium is a contradiction your team pays for.'
        }
      ],
      notebook: 'second_product'
    },

    {
      id: 'l6_partners', level: 6, emoji: '🤝', title: 'Partner program',
      trigger: { all: [{ minLevel: 6 }, { chance: 0.3 }] },
      priority: 6,
      text: 'Three businesses that serve your exact customers want to promote you. A flood of random "affiliates" wants a link too.',
      ghostDays: 60,
      options: [
        {
          id: 'hand_pick', label: 'Sign the three. Make them customers first, then hand them a promo kit', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'add', path: 'squad.partners.count', value: 3 },
            { op: 'add', path: 'leads', value: 8 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.024 },
            { op: 'flag', name: 'handPickedPartners', value: true },
            { op: 'coach', text: 'Partners live in the Lead Squad (Company tab). Recruit more who already serve your crowd.' }
          ],
          outcome: 'Free product, a promo kit and a kickoff call cost $1,000. Their audiences already trusted them, so the leads showed up warm.',
          lesson: 'The best partners already serve your customers. Make them fans first.'
        },
        {
          id: 'anyone_joins', label: 'Let anyone sign up. Same link, same deal for all', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -1500 },
            { op: 'add', path: 'squad.partners.count', value: 1 },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'mod', stat: 'refundRate', mult: 1.02 }
          ],
          outcome: 'Two hundred signups, one partner who actually promotes you, and a few who overpromised. The rest just wanted a free login.',
          lesson: 'A long partner list is useless if nobody on it sells.'
        },
        {
          id: 'discount_codes', label: 'Skip commissions. Give their audiences a big discount code instead', quality: 'trap',
          effects: [
            { op: 'add', path: 'leads', value: 8 },
            { op: 'buff', stat: 'closeRate', mult: 1.1, days: 10, label: 'Discount code rush' },
            { op: 'mod', stat: 'perceivedValue', mult: 0.974 },
            { op: 'mod', stat: 'refundRate', mult: 1.038 },
            { op: 'mod', stat: 'churn', mult: 1.02 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.02 },
            { op: 'mod', stat: 'referralRate', mult: 0.974 },
            { op: 'flag', name: 'partnerDiscounts', value: true }
          ],
          outcome: 'A burst of bargain hunters! The partners earned nothing, so they stopped posting, and now your price looks negotiable everywhere.',
          lesson: 'Pay partners for results. Don\'t pay them with your price.'
        }
      ],
      notebook: 'partners'
    },

    {
      id: 'l6_agency', level: 6, emoji: '📡', title: 'Hire an agency?',
      trigger: { all: [{ minLevel: 6 }, { path: 'metrics.headcount', gte: 10 }, { chance: 0.3 }] },
      priority: 5,
      text: 'Your lead flow has flattened. A slick marketing agency promises to double it. Your team could learn their tricks, but that takes months.',
      ghostDays: 90,
      options: [
        {
          id: 'agency_teaches', label: 'Hire a good agency for six months, with one rule: they teach your team', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -500 },
            { op: 'mod', stat: 'adCpl', mult: 0.975 },
            { op: 'mod', stat: 'contentReach', mult: 1.029 },
            { op: 'mod', stat: 'coldReply', mult: 1.02 },
            { op: 'mod', stat: 'closeRate', mult: 1.015 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.02 },
            { op: 'flag', name: 'agencyTeaches', value: true }
          ],
          outcome: 'You paid extra for them to explain every move. Leads got cheaper and posts got sharper, and your team can now run it without them.',
          lesson: 'Rent their skills, then own them. Never rent forever.'
        },
        {
          id: 'diy', label: 'Skip agencies. Your team learns by trial and error', quality: 'ok',
          effects: [
            { op: 'buff', stat: 'adCpl', mult: 1.1, days: 21, label: 'Learning the hard way' },
            { op: 'buff', stat: 'contentReach', mult: 0.85, days: 30, label: 'Learning the hard way' },
            { op: 'mod', stat: 'closeRate', mult: 0.99 },
            { op: 'mod', stat: 'contentReach', mult: 1.005 }
          ],
          outcome: 'Three weeks of pricey mistakes, then slow progress. You got there, just later than you had to.',
          lesson: 'Learning alone works. It just bills you in time.'
        },
        {
          id: 'lock_in', label: 'Sign their 12-month contract and let them run everything', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -20000 },
            { op: 'buff', stat: 'adCpl', mult: 0.85, days: 14, label: 'Agency honeymoon' },
            { op: 'mod', stat: 'adCpl', mult: 1.019 },
            { op: 'mod', stat: 'contentReach', mult: 0.987 },
            { op: 'mod', stat: 'closeRate', mult: 0.992 },
            { op: 'flag', name: 'agencyLockIn', value: true }
          ],
          outcome: 'Great first month! Then their best people moved to newer clients, results slid, and nobody in-house knows how any of it works.',
          lesson: 'If only the agency understands your leads, the agency owns your growth.'
        }
      ],
      notebook: 'partners'
    },

    {
      id: 'l6_bundle', level: 6, emoji: '📦', title: 'One giant bundle?',
      trigger: { all: [{ minLevel: 6 }, { path: 'premium.on', eq: true }, { chance: 0.3 }] },
      priority: 5,
      text: 'Your sales team wants to pitch core and premium as one giant package on the first call. Bigger tickets! But is that how people buy?',
      ghostDays: 90,
      options: [
        {
          id: 'ladder', label: 'Sell the core first. Offer premium right after their first big win', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'mod', stat: 'premiumTake', mult: 1.1 },
            { op: 'mod', stat: 'churn', mult: 0.974 },
            { op: 'mod', stat: 'refundRate', mult: 0.974 }
          ],
          outcome: 'You set up a simple "first win" check-in. Clients who had just tasted success said yes to premium like it was obvious.',
          lesson: 'Offer the next step right after a win, not before they start.'
        },
        {
          id: 'menu', label: 'Show both on the first call and let them pick', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'premiumTake', mult: 1.025 },
            { op: 'mod', stat: 'closeRate', mult: 0.99 }
          ],
          outcome: 'Some picked premium. More of them froze between the two and said they\'d think about it.',
          lesson: 'Too many choices on one call turns yes into maybe.'
        },
        {
          id: 'giant_bundle', label: 'Bundle everything into one huge price tag', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 7000 },
            { op: 'mod', stat: 'closeRate', mult: 0.949 },
            { op: 'mod', stat: 'refundRate', mult: 1.049 },
            { op: 'mod', stat: 'premiumTake', mult: 0.949 },
            { op: 'flag', name: 'giantBundle', value: true }
          ],
          outcome: 'Two big spenders paid the giant price on day one! After that, most people choked on the number and walked.',
          lesson: 'A giant first ask scares off people who would have climbed step by step.'
        }
      ],
      notebook: 'ascension'
    },

    {
      id: 'l6_quality', level: 6, emoji: '🧯', title: 'Cracks in delivery',
      trigger: { all: [{ minLevel: 6 }, { path: 'premium.on', eq: true }, { path: 'metrics.headcount', gte: 10 }, { chance: 0.3 }] },
      priority: 6,
      text: 'Sales are booming, but reviews are slipping. Clients wait days for answers, and two premium buyers want refunds.',
      ghostDays: 90,
      options: [
        {
          id: 'fix_first', label: 'Slow sales for two weeks. Fix onboarding and train everyone on one standard', quality: 'best',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 0.92, days: 10, label: 'Fixing delivery first' },
            { op: 'add', path: 'cash', value: -5000 },
            { op: 'add', path: 'team.morale', value: 8 },
            { op: 'mod', stat: 'churn', mult: 0.969 },
            { op: 'mod', stat: 'refundRate', mult: 0.96 },
            { op: 'mod', stat: 'premiumTake', mult: 1.024 },
            { op: 'mod', stat: 'referralRate', mult: 1.024 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.01 },
            { op: 'flag', name: 'fixedDelivery', value: true }
          ],
          outcome: 'Two slow weeks and a training bill. Then reviews bounced back, refunds stopped, and happy clients started moving up to premium.',
          lesson: 'Pouring more customers into broken delivery is filling a leaky bucket faster.'
        },
        {
          id: 'hire_fast', label: 'Hire three more people this week. No time for training', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -2500 },
            { op: 'mod', stat: 'churn', mult: 0.98 },
            { op: 'mod', stat: 'refundRate', mult: 0.985 }
          ],
          outcome: 'More hands helped a little. Without training, they gave clients three different answers to the same question.',
          lesson: 'More people without a standard just spreads the mess around.'
        },
        {
          id: 'push_harder', label: 'Push sales harder. Growth fixes everything!', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.1, days: 10, label: 'Sales sprint' },
            { op: 'add', path: 'team.morale', value: -10 },
            { op: 'mod', stat: 'churn', mult: 1.024 },
            { op: 'mod', stat: 'refundRate', mult: 1.035 },
            { op: 'mod', stat: 'referralRate', mult: 0.96 },
            { op: 'mod', stat: 'premiumTake', mult: 0.974 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.992 }
          ],
          outcome: 'A record sales week! Then refunds, angry reviews and cancellations ate the gains, and your team started running on fumes.',
          lesson: 'Sell faster than you can deliver and customers turn into critics.'
        }
      ],
      notebook: 'ascension'
    }
  ]);

  /* -------------------------------------------------------------------- */
  /* RANDOM EVENTS, Levels 4-6 (no choice; shown as a toast)              */
  /* -------------------------------------------------------------------- */
  ZTE.Content.events = (ZTE.Content.events || []).concat([
    {
      // Consequence of 'off_books' in l4_contractor.
      id: 'ev_a_back_taxes', emoji: '📬',
      cond: { all: [{ minLevel: 4 }, { flag: 'cashUnderTable' }] },
      chancePerDay: 0.04, once: true,
      text: 'A letter from the tax office: those off-the-books payments caught up with you. $4,000 in back taxes and fines.',
      effects: [
        { op: 'add', path: 'cash', value: -4000 },
        { op: 'add', path: 'team.morale', value: -5 },
        { op: 'coach', text: 'Run payroll properly. Cheap today, expensive forever.' }
      ]
    },
    {
      // Consequence of 'hire_friend' in l4_friend_or_pro.
      id: 'ev_a_friend_fallout', emoji: '😬',
      cond: { all: [{ minLevel: 4 }, { flag: 'hiredFriend' }] },
      chancePerDay: 0.04, once: true,
      text: 'Your buddy keeps showing up late, and nobody wants to be the one to say it. The whole team slows down.',
      effects: [
        { op: 'add', path: 'team.morale', value: -12 },
        { op: 'buff', stat: 'teamOutput', mult: 0.85, days: 14, label: 'Awkward team vibes' }
      ]
    },
    {
      id: 'ev_a_client_joins_team', emoji: '🌟',
      cond: { all: [{ minLevel: 4 }, { maxLevel: 6 }, { path: 'metrics.headcount', gte: 2 }] },
      chancePerDay: 0.02, once: true,
      text: 'A former client loved her results so much she applied to work for you. She already knows the method by heart!',
      effects: [
        { op: 'add', path: 'team.morale', value: 5 },
        { op: 'buff', stat: 'hireRamp', mult: 1.5, days: 21, label: 'Fan on the team' },
        { op: 'buff', stat: 'teamOutput', mult: 1.1, days: 14, label: 'Fan on the team' }
      ]
    },
    {
      id: 'ev_a_star_quits', emoji: '🚪',
      cond: { all: [{ minLevel: 5 }, { path: 'team.morale', lte: 60 }] },
      chancePerDay: 0.05, once: true,
      text: 'Your best team member just quit. Low morale finally sent the bill, and everyone else is covering the gap.',
      effects: [
        { op: 'add', path: 'team.morale', value: -5 },
        { op: 'buff', stat: 'teamOutput', mult: 0.8, days: 14, label: 'Covering for a quitter' },
        { op: 'coach', text: 'Morale is a number too. Protect it before it costs you your best people.' }
      ]
    },
    {
      id: 'ev_a_partner_shoutout', emoji: '📢',
      cond: { all: [{ minLevel: 6 }, { path: 'squad.partners.count', gte: 1 }] },
      chancePerDay: 0.03, once: true,
      text: 'One of your partners featured you to their whole audience. Your inbox is on fire!',
      effects: [
        { op: 'add', path: 'leads', value: 25 }
      ]
    },
    {
      id: 'ev_a_premium_story', emoji: '🏅',
      cond: { all: [{ minLevel: 6 }, { path: 'premium.on', eq: true }] },
      chancePerDay: 0.03, once: true,
      text: 'A premium client got a jaw-dropping result and shared the whole story. Now other clients want in!',
      effects: [
        { op: 'add', path: 'reputation.caseStudies', value: 1 },
        { op: 'buff', stat: 'premiumTake', mult: 1.3, days: 14, label: 'Premium buzz' }
      ]
    }
  ]);
})(typeof globalThis !== 'undefined' ? globalThis : this);
