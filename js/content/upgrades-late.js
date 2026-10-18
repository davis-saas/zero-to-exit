/*
 * Zero to Exit - late-game shop upgrades, Levels 4-10 (SPEC-LATE section 6).
 * Appends to ZTE.Content.upgrades; never replaces it. Schema as SPEC.md 5.5.
 *
 * Categories used here: 'systems' (Playbooks, dashboards, automation, protection,
 * product + squad helpers) and 'team' (hiring, managers, culture, CEO time).
 * SPEC-GAP: nothing here uses the old categories ('offer', 'skill', 'nurture',
 * 'megaphone') so the Level 1-3 Growth tab stays exactly as it was (no extra
 * locked cards, same "x / N collected" counts). The Company tab owns these.
 *
 * Extra optional fields (UI hints, safe to ignore):
 *   sop:  'delivery' | 'sales' | 'marketing' | 'hiring'   (Playbook upgrades only)
 *   rank: 1 | 2 | 3                                      (Playbook upgrades only)
 *   group: 'playbooks' | 'team' | 'squad' | 'product' | 'ops' | 'protect'
 *
 * Rules followed here:
 *  - effects only use the ops in SPEC.md 5.2, the paths in 5.3 + SPEC-LATE 2,
 *    and mods keys from SPEC.md 4 + the four new ones (teamOutput, salaryCost,
 *    premiumTake, hireRamp)
 *  - each Playbook rank adds 1 to its sops.* rank via 'add' and also carries its
 *    own small mods, so a rank bought on top of a free rank (perk / card) still
 *    pays off; ranks chain through `requires`
 *  - ops.efficiency is only touched by Level 7+ upgrades and depts.*.health only
 *    by Level 8+ upgrades (those systems switch on at 7 and 8)
 *  - costs grow with company size: about $500 at Level 4 up to $150k at Level 10
 *  - notebook ids come only from the fixed lists (SPEC.md 5.7 + SPEC-LATE 6)
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  ZTE.Content.upgrades = (ZTE.Content.upgrades || []).concat([

    // ------------------------------------------------------------------
    // PLAYBOOKS - write it down once, so anyone can do it the same way
    // ------------------------------------------------------------------

    // --- Delivery ---
    {
      id: 'playbook_delivery_1', name: 'Delivery Playbook I', emoji: '📘',
      category: 'systems', group: 'playbooks', sop: 'delivery', rank: 1,
      minLevel: 4, cost: { cash: 500, energy: 20 },
      desc: 'Write every step of how you serve a client, start to finish. Playbook rank 1. Delivery takes 5% less energy, churn -3%.',
      teaches: 'If it only lives in your head, only you can do it. Write it down and anyone can.',
      effects: [
        { op: 'add', path: 'sops.delivery', value: 1 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 0.95 },
        { op: 'mod', stat: 'churn', mult: 0.97 },
        { op: 'coach', text: 'First Playbook done! Now a new coach can copy you instead of guessing.' }
      ],
      notebook: 'playbooks'
    },

    {
      id: 'playbook_delivery_2', name: 'Delivery Playbook II', emoji: '📘',
      category: 'systems', group: 'playbooks', sop: 'delivery', rank: 2,
      minLevel: 6, cost: { cash: 8000, energy: 15 },
      requires: ['playbook_delivery_1'],
      desc: 'Add a quality checklist and grade sessions against it every week. Rank 2. Delivery energy -6%, churn -5%, refunds -5%.',
      teaches: 'A written standard lets you check quality without doing the work yourself.',
      effects: [
        { op: 'add', path: 'sops.delivery', value: 1 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 0.94 },
        { op: 'mod', stat: 'churn', mult: 0.95 },
        { op: 'mod', stat: 'refundRate', mult: 0.95 }
      ]
    },

    {
      id: 'playbook_delivery_3', name: 'Delivery Playbook III', emoji: '📘',
      category: 'systems', group: 'playbooks', sop: 'delivery', rank: 3,
      minLevel: 8, cost: { cash: 45000, energy: 10 },
      requires: ['playbook_delivery_2'],
      desc: 'Training videos, client scorecards and a loop where senior coaches train new ones. Rank 3. Delivery energy -7%, churn -6%, team output +3%.',
      teaches: 'Delivery should get better as you grow, not worse. Systems are how that happens.',
      effects: [
        { op: 'add', path: 'sops.delivery', value: 1 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 0.93 },
        { op: 'mod', stat: 'churn', mult: 0.94 },
        { op: 'mod', stat: 'teamOutput', mult: 1.03 }
      ]
    },

    // --- Sales ---
    {
      id: 'playbook_sales_1', name: 'Sales Playbook I', emoji: '📗',
      category: 'systems', group: 'playbooks', sop: 'sales', rank: 1,
      minLevel: 4, cost: { cash: 900, energy: 20 },
      desc: 'Turn your Close Kit into a written call script any rep can learn. Rank 1. Sales reps close nearer your own rate; close rate +3%.',
      teaches: 'A script is not about sounding like a robot. It makes sure every rep hits every step.',
      effects: [
        { op: 'add', path: 'sops.sales', value: 1 },
        { op: 'mod', stat: 'closeRate', mult: 1.03 }
      ]
    },

    {
      id: 'playbook_sales_2', name: 'Sales Playbook II', emoji: '📗',
      category: 'systems', group: 'playbooks', sop: 'sales', rank: 2,
      minLevel: 6, cost: { cash: 12000, energy: 15 },
      requires: ['playbook_sales_1'],
      desc: 'Record calls and review one together as a team every week. Rank 2. Close rate +3%, show rate +4%.',
      teaches: 'Reps improve fastest when they watch their own calls with fresh eyes.',
      effects: [
        { op: 'add', path: 'sops.sales', value: 1 },
        { op: 'mod', stat: 'closeRate', mult: 1.03 },
        { op: 'mod', stat: 'showRate', mult: 1.04 }
      ]
    },

    {
      id: 'playbook_sales_3', name: 'Sales Playbook III', emoji: '📗',
      category: 'systems', group: 'playbooks', sop: 'sales', rank: 3,
      minLevel: 10, cost: { cash: 130000, energy: 10 },
      requires: ['playbook_sales_2'],
      desc: 'An objection library, a ramp plan for new reps and a monthly script refresh. Rank 3. Close rate +4%, upsells +10%.',
      teaches: 'The best answer to an objection should belong to the company, not to one star rep.',
      effects: [
        { op: 'add', path: 'sops.sales', value: 1 },
        { op: 'mod', stat: 'closeRate', mult: 1.04 },
        { op: 'mod', stat: 'upsellTake', mult: 1.1 }
      ]
    },

    // --- Marketing ---
    {
      id: 'playbook_marketing_1', name: 'Marketing Playbook I', emoji: '📙',
      category: 'systems', group: 'playbooks', sop: 'marketing', rank: 1,
      minLevel: 5, cost: { cash: 3000, energy: 20 },
      desc: 'Write down the recipe behind your best ads and posts so anyone can repeat it. Rank 1. Ad cost per lead -5%, content reach +8%.',
      teaches: 'Once something works, turn it into a process. Repeatable beats lucky.',
      effects: [
        { op: 'add', path: 'sops.marketing', value: 1 },
        { op: 'mod', stat: 'adCpl', mult: 0.95 },
        { op: 'mod', stat: 'contentReach', mult: 1.08 }
      ]
    },

    {
      id: 'playbook_marketing_2', name: 'Marketing Playbook II', emoji: '📙',
      category: 'systems', group: 'playbooks', sop: 'marketing', rank: 2,
      minLevel: 7, cost: { cash: 25000, energy: 15 },
      requires: ['playbook_marketing_1'],
      desc: 'A weekly ad testing calendar plus outreach scripts for your setters. Rank 2. Ad cost per lead -7%, cold replies +8%.',
      teaches: 'Test a little every week, so the next winner is ready before the old one wears out.',
      effects: [
        { op: 'add', path: 'sops.marketing', value: 1 },
        { op: 'mod', stat: 'adCpl', mult: 0.93 },
        { op: 'mod', stat: 'coldReply', mult: 1.08 }
      ]
    },

    {
      id: 'playbook_marketing_3', name: 'Marketing Playbook III', emoji: '📙',
      category: 'systems', group: 'playbooks', sop: 'marketing', rank: 3,
      minLevel: 10, cost: { cash: 150000, energy: 10 },
      requires: ['playbook_marketing_2'],
      desc: 'Every channel documented: briefs, tests, budgets and the hand-off to sales. Rank 3. Ad cost per lead -10%, content reach +10%.',
      teaches: 'At this size, marketing is a factory. Clear steps keep quality high while volume climbs.',
      effects: [
        { op: 'add', path: 'sops.marketing', value: 1 },
        { op: 'mod', stat: 'adCpl', mult: 0.9 },
        { op: 'mod', stat: 'contentReach', mult: 1.1 }
      ]
    },

    // --- Hiring ---
    {
      id: 'playbook_hiring_1', name: 'Hiring Playbook I', emoji: '📕',
      category: 'systems', group: 'playbooks', sop: 'hiring', rank: 1,
      minLevel: 4, cost: { cash: 1200, energy: 20 },
      desc: 'A scorecard for each role, one simple interview and a first-week plan. Rank 1. New hires ramp about 15% faster; each manager can lead 1 more person.',
      teaches: 'Decide what great looks like before you interview. Then you hire the job, not the vibe.',
      effects: [
        { op: 'add', path: 'sops.hiring', value: 1 },
        { op: 'add', path: 'team.morale', value: 3 }
      ],
      notebook: 'first_hire'
    },

    {
      id: 'playbook_hiring_2', name: 'Hiring Playbook II', emoji: '📕',
      category: 'systems', group: 'playbooks', sop: 'hiring', rank: 2,
      minLevel: 7, cost: { cash: 22000, energy: 15 },
      requires: ['playbook_hiring_1'],
      desc: 'Onboarding with a buddy, a 30-day plan and clear check-ins. Rank 2. Faster ramp again, plus hires ramp 10% faster and morale +5.',
      teaches: 'The first month decides if a hire stays and shines. Do not leave it to luck.',
      effects: [
        { op: 'add', path: 'sops.hiring', value: 1 },
        { op: 'mod', stat: 'hireRamp', mult: 1.1 },
        { op: 'add', path: 'team.morale', value: 5 }
      ]
    },

    {
      id: 'playbook_hiring_3', name: 'Hiring Playbook III', emoji: '📕',
      category: 'systems', group: 'playbooks', sop: 'hiring', rank: 3,
      minLevel: 9, cost: { cash: 90000, energy: 10 },
      requires: ['playbook_hiring_2'],
      desc: 'Hire for proven skill, promote from within and train managers to hire well. Rank 3. Hires ramp 10% faster, team output +4%.',
      teaches: 'Top performers want to work with other top performers. Raise the bar and they stay.',
      effects: [
        { op: 'add', path: 'sops.hiring', value: 1 },
        { op: 'mod', stat: 'hireRamp', mult: 1.1 },
        { op: 'mod', stat: 'teamOutput', mult: 1.04 }
      ],
      notebook: 'a_players'
    },

    // ------------------------------------------------------------------
    // TEAM - recruiting, managers, culture, the CEO's own week
    // ------------------------------------------------------------------

    {
      id: 'team_huddle', name: 'Daily Huddle & Wins Board', emoji: '🙌',
      category: 'team', group: 'team',
      minLevel: 4, cost: { cash: 600, energy: 10 },
      desc: 'Ten minutes each morning: today\'s targets, yesterday\'s wins, shout-outs. Team output +3%, morale +10.',
      teaches: 'People push harder for a team that notices their effort. Recognition is cheap and strong.',
      effects: [
        { op: 'mod', stat: 'teamOutput', mult: 1.03 },
        { op: 'add', path: 'team.morale', value: 10 }
      ]
    },

    {
      id: 'recruiting_pipeline', name: 'Recruiting Pipeline', emoji: '🧲',
      category: 'team', group: 'team',
      minLevel: 5, cost: { cash: 2500, energy: 10 },
      requires: ['playbook_hiring_1'],
      desc: 'Always-open job posts, a referral bonus for staff and a bench of ready candidates. New hires ramp 25% faster.',
      teaches: 'Recruit before you are desperate. Great people rarely show up the week you need them.',
      effects: [
        { op: 'mod', stat: 'hireRamp', mult: 1.25 }
      ],
      notebook: 'hire_help'
    },

    {
      // SPEC-GAP: span of control has no mods key; core grows span only through
      // sops.hiring (+1 per Hiring Playbook rank). Training lifts output instead.
      id: 'manager_training', name: 'Manager Training', emoji: '🧑‍🏫',
      category: 'team', group: 'team',
      minLevel: 5, cost: { cash: 5000, energy: 15 },
      desc: 'Teach managers to run 1-on-1s, set clear targets and give honest feedback. Team output +6%, morale +5.',
      teaches: 'A manager sets the ceiling for their whole team. Train the manager and everyone lifts.',
      effects: [
        { op: 'mod', stat: 'teamOutput', mult: 1.06 },
        { op: 'add', path: 'team.morale', value: 5 }
      ],
      notebook: 'span_of_control'
    },

    {
      id: 'ceo_calendar', name: 'CEO Calendar', emoji: '📅',
      category: 'team', group: 'team',
      minLevel: 8, cost: { cash: 40000, energy: 0 },
      desc: 'A weekly planning block, protected deep-work time and half the meetings. +1 CEO attention point every week.',
      teaches: 'Your attention is the scarcest thing in the company. Plan where it goes, or others will.',
      effects: [
        { op: 'add', path: 'attention.max', value: 1 },
        { op: 'coach', text: 'One more point of focus a week. Spend it on the fires that can burn the house down.' }
      ],
      notebook: 'ceo_attention'
    },

    // ------------------------------------------------------------------
    // LEAD SQUAD + PRODUCT helpers
    // ------------------------------------------------------------------

    {
      id: 'agency_vetting', name: 'Agency Vetting Checklist', emoji: '🔍',
      category: 'systems', group: 'squad',
      minLevel: 6, cost: { cash: 5000, energy: 15 },
      desc: 'Only hire agencies that come recommended, report cost per lead and teach your team. Ad and agency leads cost 10% less.',
      teaches: 'A good agency is a teacher you rent. Learn their tricks, then compare them to your own team.',
      effects: [
        { op: 'mod', stat: 'adCpl', mult: 0.9 }
      ],
      notebook: 'lead_squad'
    },

    {
      id: 'partner_kit', name: 'Partner Kit', emoji: '🤝',
      category: 'systems', group: 'squad',
      minLevel: 6, cost: { cash: 4000, energy: 10 },
      desc: 'Ready-made emails, posts, tracking links and fast commission payouts. 3 partners sign up right away; referrals +10%.',
      teaches: 'Make promoting you easy and worth it. Partners send more when you do the hard part for them.',
      effects: [
        { op: 'add', path: 'squad.partners.count', value: 3 },
        { op: 'mod', stat: 'referralRate', mult: 1.1 }
      ],
      notebook: 'partners'
    },

    {
      id: 'upgrade_moment', name: 'Upgrade Moment', emoji: '🚀',
      category: 'systems', group: 'product',
      minLevel: 6, cost: { cash: 6000, energy: 10 },
      desc: 'Offer your premium product right after a customer hits a big win. Premium sales +25%.',
      teaches: 'The best time to offer the next step is right after someone gets a result from the first.',
      effects: [
        { op: 'mod', stat: 'premiumTake', mult: 1.25 }
      ],
      notebook: 'ascension'
    },

    // ------------------------------------------------------------------
    // OPS - measure, automate, protect
    // ------------------------------------------------------------------

    {
      id: 'business_insurance', name: 'Insurance & Contracts', emoji: '🛡️',
      category: 'systems', group: 'protect',
      minLevel: 5, cost: { cash: 2000, energy: 5 },
      desc: 'Proper business insurance plus clear written client agreements. Refunds -10%, and you sleep better (burnout -10).',
      teaches: 'Protect what you built. One lawsuit or accident should never be able to end the company.',
      effects: [
        { op: 'mod', stat: 'refundRate', mult: 0.9 },
        { op: 'add', path: 'burnout', value: -10 },
        { op: 'flag', name: 'insured', value: true }
      ]
    },

    {
      id: 'kpi_dashboard', name: 'KPI Dashboard', emoji: '📊',
      category: 'systems', group: 'ops',
      minLevel: 7, cost: { cash: 15000, energy: 10 },
      desc: 'One screen with the numbers that matter, updated daily for every team. Efficiency +8, team output +4%.',
      teaches: 'What you track gets better. What you ignore quietly drifts.',
      effects: [
        { op: 'add', path: 'ops.efficiency', value: 8 },
        { op: 'mod', stat: 'teamOutput', mult: 1.04 }
      ],
      notebook: 'measure_it'
    },

    {
      id: 'client_autopilot', name: 'Client Autopilot', emoji: '🤖',
      category: 'systems', group: 'ops',
      minLevel: 7, cost: { cash: 30000, energy: 0 },
      desc: 'Automatic onboarding, reminders and progress check-ins for every client. Delivery energy -12%, churn -3%, efficiency +4.',
      teaches: 'Automate the boring, repeatable parts so your people spend time where it counts.',
      effects: [
        { op: 'mod', stat: 'deliveryEnergy', mult: 0.88 },
        { op: 'mod', stat: 'churn', mult: 0.97 },
        { op: 'add', path: 'ops.efficiency', value: 4 }
      ],
      notebook: 'better_not_more'
    },

    {
      id: 'security_lockdown', name: 'Security Lockdown', emoji: '🔐',
      category: 'systems', group: 'protect',
      minLevel: 8, cost: { cash: 35000, energy: 0 },
      desc: 'Password manager, access rules and clean account setup and shutdown for every hire. Tech health +15, People health +5, efficiency +3.',
      teaches: 'More people means more doors into your data. Lock them before someone walks in.',
      effects: [
        { op: 'add', path: 'depts.tech.health', value: 15 },
        { op: 'add', path: 'depts.people.health', value: 5 },
        { op: 'add', path: 'ops.efficiency', value: 3 },
        { op: 'flag', name: 'securityLocked', value: true }
      ]
    },

    {
      id: 'workflow_bots', name: 'Workflow Automation', emoji: '⚙️',
      category: 'systems', group: 'ops',
      minLevel: 9, cost: { cash: 100000, energy: 0 },
      requires: ['client_autopilot'],
      desc: 'Connect your tools so data, hand-offs and reports move on their own. Team output +8%, payroll -3%, efficiency +5.',
      teaches: 'Every manual hand-off is a spot where work gets lost. Automate the hand-offs first.',
      effects: [
        { op: 'mod', stat: 'teamOutput', mult: 1.08 },
        { op: 'mod', stat: 'salaryCost', mult: 0.97 },
        { op: 'add', path: 'ops.efficiency', value: 5 }
      ]
    }
  ]);
})(typeof globalThis !== 'undefined' ? globalThis : this);
