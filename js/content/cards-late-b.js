/*
 * Zero to Exit - content/cards-late-b.js
 * Choice cards for Levels 7-10 (6 each) and 6 random events. Appends to
 * ZTE.Content.cards and ZTE.Content.events (SPEC.md 5.6, SPEC-LATE 6).
 * Card ids use the l7_ / l8_ / l9_ / l10_ prefixes; event ids use ev_b_.
 *
 * Conventions used here:
 * - Every card gates on { minLevel: N } so a player who levels fast still meets it.
 *   The first card of each level opens right away; the others wait for a level
 *   signal (headcount, efficiency, department health, sales) OR a small daily
 *   chance, so the six cards spread across the level instead of stacking up.
 * - Effects use only the ops in SPEC 5.2, the paths in SPEC 5.3 + SPEC-LATE 2 and
 *   the mods keys incl. teamOutput, salaryCost, premiumTake, hireRamp.
 * - The 'best' option costs cash and often a short slump (a buff below 1) now,
 *   then pays back through lasting mods. The 'trap' pays now (cash, a short buff
 *   or a mood boost) and costs more later. Every 'best' leans on levers that show
 *   up in cash inside the ghost timeline (closeRate, churn, adCpl, salaryCost,
 *   teamOutput, ops.efficiency, department health), because the ghost timeline
 *   runs on Autopilot: it never hires, handles fires or starts projects, so
 *   attention.max and hireRamp alone would be invisible there.
 * - Cash sizes follow the company: about $5k-15k at Level 7, $5k-15k at
 *   Level 8, $2k-40k at Level 9 and $9k-150k at Level 10. (Integration balance
 *   pass: cash and mod sizes were scaled down to the tuned late-game economy;
 *   every mod is the square root of the builder's original, e.g. 1.10 -> 1.049.)
 * - Text never uses a role's in-game title (titles change per flavor); it says
 *   "sales reps", "your best seller", "your delivery team".
 *
 * Flags set here (free for anyone to read):
 *   fixedProcess, hiredBodies, measuredFirst, gutCall, fixedBottleneck,
 *   pouredIntoAds, purgedMeetings, addedSyncs, properSystem, cheapTool,
 *   trainedTeam, skippedTraining, triagedQuietFire, chasedLoudFire,
 *   delegatedDecisions, ceoDoesAll, builtDepartments, everyoneOwnsIt,
 *   centralData, dataLater*, segmentedCustomers, segmentedHiring, hiredFastest,
 *   hiredSpecialist, generalistStretched, provenLeader, promotedStar,
 *   paidAPlayer, tookBPlayer, splitSalesTeams, retentionTeam, outranTheLeak,
 *   financeTeam, cheapBooks, adjacentBet, shinyBet, rightSizedBet, betTheFarm,
 *   leadershipTeam, founderInEverything, saleReady, waitedOneMoreYear,
 *   recurringPush, lockInContracts, cleanBooks, dressedUpBooks
 *   (* = read by an event below). Flags read: dataLater (own), betDone (engine-late).
 *
 * SPEC-GAP: cards cannot hire, fire, start projects or place the Big Bet (those
 * are player actions). Options describe HOW you would do it and model the
 * consequence with mods; coach lines point to the Company tab.
 * SPEC-GAP: the bet cards (l10_which_bet, l10_bet_size) gate on
 * { notFlag: 'betDone' }; that flag is set by engine-late when a Big Bet resolves
 * (SPEC-LATE 4.4), so they show up before the bet, while the choice still matters.
 * SPEC-GAP: no card writes sops.* or squad.partners.count, so the Playbook
 * upgrades and Lead Squad actions keep their full value.
 * SPEC-GAP (ghost timeline, for engine owners): Autopilot never handles fires, so
 * a forward sim that levels up from 7 to 8 pays for every unhandled fire. That
 * makes any Level 7 option that graduates sooner look worse. These cards were
 * tuned with forward sims that either stay in the current level or spend CEO
 * attention on the biggest fire each day; with either, every 'best' wins.
 * Leads from effects arrive at referral quality and are worth a lot late in the
 * game, so cards here add only a few (no "buy 1,000 leads" options).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  // "this signal, or a small daily roll": spreads cards across a level
  function orChance(cond, p) { return { any: [cond, { chance: p }] }; }

  ZTE.Content.cards = (ZTE.Content.cards || []).concat([
    /* ------------------------------------------------------------------ */
    /* LEVEL 7 - TUNE-UP (everything is inefficient)                      */
    /* ------------------------------------------------------------------ */
    {
      id: 'l7_hire_or_fix', level: 7, emoji: '🛠️', title: 'More hands or better hands?',
      trigger: { all: [{ minLevel: 7 }] },
      priority: 9,
      text: 'Your delivery team is swamped and clients wait days for answers. Your ops lead wants ten new hires by Friday. Coach Flex raises one eyebrow. 🦉',
      ghostDays: 75,
      options: [
        {
          id: 'fix_process', label: 'Map every delivery step first and cut the waste', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -7000 },
            { op: 'buff', stat: 'teamOutput', mult: 0.94, days: 10, label: 'Process overhaul' },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.974 },
            { op: 'mod', stat: 'teamOutput', mult: 1.007 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.005 },
            { op: 'add', path: 'ops.efficiency', value: 3 },
            { op: 'add', path: 'team.morale', value: 4 },
            { op: 'flag', name: 'fixedProcess', value: true }
          ],
          outcome: 'Two slow weeks of sticky notes on the wall. You found four steps nobody needed and a hand-off that lost every third request. Same team, way more done.',
          lesson: 'Fix the process before you feed it more people.'
        },
        {
          id: 'hire_two_trained', label: 'Hire two great people and train them properly', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'buff', stat: 'teamOutput', mult: 1.04, days: 21, label: 'Two fresh hires' }
          ],
          outcome: 'The two new hires helped, but they learned the same clunky steps. The queue shrank for a month, then crept back.',
          lesson: 'New people inside an old mess just make a bigger mess, slower.'
        },
        {
          id: 'hire_ten', label: 'Hire ten people this week. More hands, more output!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -13000 },
            { op: 'buff', stat: 'teamOutput', mult: 1.1, days: 14, label: 'Hiring spree' },
            { op: 'mod', stat: 'salaryCost', mult: 1.015 },
            { op: 'add', path: 'ops.efficiency', value: -8 },
            { op: 'add', path: 'team.morale', value: -5 },
            { op: 'flag', name: 'hiredBodies', value: true },
            { op: 'coach', text: 'Ten new seats, same broken process. Watch that Efficiency meter.' }
          ],
          outcome: 'Output jumped for two weeks. Then the newbies started tripping over each other, asking the same questions, and redoing each other\'s work. Payroll stayed jumped.',
          lesson: 'More people on a bad process means more people doing waste.'
        }
      ],
      notebook: 'better_not_more'
    },

    {
      id: 'l7_gut_or_numbers', level: 7, emoji: '📏', title: 'Gut feel or numbers?',
      trigger: { all: [{ minLevel: 7 }, orChance({ path: 'metrics.headcount', gte: 24 }, 0.08)] },
      priority: 8,
      text: 'Sales dipped last month. Your sales lead is sure it\'s the new ad. Your marketer is sure it\'s the reps. Nobody has a single number to back it up.',
      ghostDays: 75,
      options: [
        {
          id: 'measure_first', label: 'Track every funnel step for two weeks, then fix what the data shows', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -3000 },
            { op: 'buff', stat: 'closeRate', mult: 0.97, days: 14, label: 'Waiting for data' },
            { op: 'mod', stat: 'closeRate', mult: 1.012 },
            { op: 'mod', stat: 'bookRate', mult: 1.01 },
            { op: 'add', path: 'ops.efficiency', value: 2 },
            { op: 'flag', name: 'measuredFirst', value: true }
          ],
          outcome: 'The dashboard showed the ad was fine. Reps were calling new leads two days late. One schedule change later, bookings and closes both climbed.',
          lesson: 'Measure first. A guess fixes the wrong thing with total confidence.'
        },
        {
          id: 'ask_team', label: 'Poll the team and go with the most popular fix', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'mod', stat: 'bookRate', mult: 1.005 },
            { op: 'add', path: 'team.morale', value: 3 }
          ],
          outcome: 'People liked being asked. The winning idea helped a little, but it was a popularity contest, not a diagnosis.',
          lesson: 'Opinions are a starting point. Numbers settle the argument.'
        },
        {
          id: 'gut_rewrite', label: 'Trust your gut: kill the new ad and rebuild the whole funnel', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'buff', stat: 'adCpl', mult: 1.25, days: 21, label: 'Funnel rebuild' },
            { op: 'mod', stat: 'closeRate', mult: 0.995 },
            { op: 'add', path: 'team.morale', value: -3 },
            { op: 'flag', name: 'gutCall', value: true }
          ],
          outcome: 'You scrapped a working ad and three weeks of learning with it. The real problem, slow follow-up, never got touched.',
          lesson: 'Big bold moves on a hunch usually fix the wrong thing.'
        }
      ],
      notebook: 'measure_it'
    },

    {
      id: 'l7_which_bottleneck', level: 7, emoji: '🪣', title: 'Three leaks, one bucket',
      trigger: { all: [{ minLevel: 7 }, orChance({ path: 'ops.efficiency', lte: 77 }, 0.06)] },
      priority: 7,
      text: 'Your dashboard shows three leaks: no-shows on sales calls, slow onboarding and ad costs creeping up. You have budget and focus for one big fix this month.',
      ghostDays: 75,
      options: [
        {
          id: 'fix_worst', label: 'Find the single worst step and pour everything into it', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -4000 },
            { op: 'mod', stat: 'showRate', mult: 1.019 },
            { op: 'mod', stat: 'bookRate', mult: 1.012 },
            { op: 'mod', stat: 'closeRate', mult: 1.005 },
            { op: 'add', path: 'ops.efficiency', value: 2 },
            { op: 'flag', name: 'fixedBottleneck', value: true }
          ],
          outcome: 'No-shows were the worst by far. Reminders, a short pre-call video and a confirm-or-reschedule text later, half the empty slots filled up.',
          lesson: 'One fixed bottleneck beats three half-fixed ones.'
        },
        {
          id: 'split_three', label: 'Split the budget three ways. A little for everyone', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -11000 },
            { op: 'mod', stat: 'showRate', mult: 1.012 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 0.99 },
            { op: 'mod', stat: 'adCpl', mult: 0.99 }
          ],
          outcome: 'Each team got a small win and nobody felt left out. None of the three leaks actually closed.',
          lesson: 'Spread a fix too thin and every problem survives.'
        },
        {
          id: 'pour_ads', label: 'Ignore the leaks. Buy more leads and outrun them', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -12000 },
            { op: 'add', path: 'leads', value: 10 },
            { op: 'buff', stat: 'adCpl', mult: 1.12, days: 30, label: 'Colder audiences' },
            { op: 'mod', stat: 'bookRate', mult: 0.992 },
            { op: 'flag', name: 'pouredIntoAds', value: true }
          ],
          outcome: 'A wave of new leads hit the same broken funnel. Most of them no-showed, just like before. You paid more to lose more.',
          lesson: 'Pouring more water into a leaky bucket just makes a bigger puddle.'
        }
      ],
      notebook: 'better_not_more'
    },

    {
      id: 'l7_meeting_bloat', level: 7, emoji: '📅', title: 'Meeting madness',
      trigger: { all: [{ minLevel: 7 }, orChance({ path: 'metrics.headcount', gte: 28 }, 0.05)] },
      priority: 6,
      text: 'Your calendar has 31 hours of meetings this week. So does everyone else\'s. Real work happens after 6 pm.',
      ghostDays: 60,
      options: [
        {
          id: 'purge_meetings', label: 'Cancel every meeting with no owner, no agenda and no decision', quality: 'best',
          effects: [
            { op: 'buff', stat: 'teamOutput', mult: 0.96, days: 5, label: 'Calendar shake-up' },
            { op: 'add', path: 'ops.efficiency', value: 3 },
            { op: 'mod', stat: 'teamOutput', mult: 1.017 },
            { op: 'add', path: 'team.morale', value: 5 },
            { op: 'flag', name: 'purgedMeetings', value: true }
          ],
          outcome: 'A few managers grumbled for a week. Then people got whole afternoons back, and the meetings that survived actually ended with decisions.',
          lesson: 'Every meeting needs an owner, an agenda and a decision, or it goes.'
        },
        {
          id: 'shorter_meetings', label: 'Keep them all, but cut each one to 25 minutes', quality: 'ok',
          effects: [
            { op: 'add', path: 'ops.efficiency', value: 1 },
            { op: 'add', path: 'team.morale', value: 1 }
          ],
          outcome: 'Meetings got shorter but not fewer. Still a lot of status updates that could have been a message.',
          lesson: 'A shorter useless meeting is still a useless meeting.'
        },
        {
          id: 'add_sync', label: 'Add a weekly all-hands sync so everyone stays aligned', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.02, days: 7, label: 'Feeling aligned' },
            { op: 'add', path: 'ops.efficiency', value: -5 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'add', path: 'team.morale', value: -3 },
            { op: 'flag', name: 'addedSyncs', value: true }
          ],
          outcome: 'Everyone felt informed for about a week. Then the sync grew a pre-sync and a follow-up. Thirty people, two hours, every week.',
          lesson: 'Meetings grow like weeds. Pull them, don\'t plant more.'
        }
      ],
      notebook: 'bloat'
    },

    {
      id: 'l7_cheap_tool', level: 7, emoji: '🧰', title: 'Cheap tool or real system?',
      trigger: { all: [{ minLevel: 7 }, orChance({ path: 'metrics.revenue30', gte: 180000 }, 0.05)] },
      priority: 5,
      text: 'Customer info lives in nine spreadsheets and three inboxes. A $49-a-month app promises to fix it all. A proper system costs about $7k and a month of setup.',
      ghostDays: 75,
      options: [
        {
          id: 'proper_system', label: 'Buy the proper system and set it up right', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -7000 },
            { op: 'buff', stat: 'teamOutput', mult: 0.97, days: 14, label: 'System setup' },
            { op: 'mod', stat: 'teamOutput', mult: 1.02 },
            { op: 'mod', stat: 'churn', mult: 0.97 },
            { op: 'mod', stat: 'bookRate', mult: 1.014 },
            { op: 'mod', stat: 'closeRate', mult: 1.02 },
            { op: 'add', path: 'ops.efficiency', value: 2 },
            { op: 'add', path: 'depts.tech.health', value: 8 },
            { op: 'flag', name: 'properSystem', value: true }
          ],
          outcome: 'A painful month of moving data and training people. After that, every client had one history and nobody fell through the cracks.',
          lesson: 'Pay once for a real system or pay forever in workarounds.'
        },
        {
          id: 'tidy_sheets', label: 'Keep the spreadsheets, but merge them and name one owner', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'add', path: 'ops.efficiency', value: 1 },
            { op: 'mod', stat: 'churn', mult: 0.995 }
          ],
          outcome: 'Fewer files, one owner, a little less chaos. Fine for now, but it won\'t survive the next 30 hires.',
          lesson: 'A tidy stopgap buys time, not scale.'
        },
        {
          id: 'cheap_app', label: 'Grab the $49 app. Why pay thousands?', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -1000 },
            { op: 'buff', stat: 'teamOutput', mult: 1.03, days: 10, label: 'Shiny new app' },
            { op: 'add', path: 'ops.efficiency', value: -4 },
            { op: 'mod', stat: 'teamOutput', mult: 0.995 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'bookRate', mult: 0.995 },
            { op: 'flag', name: 'cheapTool', value: true }
          ],
          outcome: 'It worked great for ten users. At thirty it slowed, at forty it lost a week of notes. Now there are nine spreadsheets AND an app.',
          lesson: 'Cheap tools get expensive the moment you outgrow them.'
        }
      ],
      notebook: 'bloat'
    },

    {
      id: 'l7_training_budget', level: 7, emoji: '🎓', title: 'The training budget',
      trigger: { all: [{ minLevel: 7 }, orChance({ path: 'metrics.headcount', gte: 32 }, 0.04)] },
      priority: 4,
      text: 'As the sales team grew, the close rate slid. Newer reps wing it and the veterans are too busy to help. Finance asks what to do with the training budget.',
      ghostDays: 75,
      options: [
        {
          id: 'game_tape', label: 'Weekly call reviews: record calls, score them, coach the gaps', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -5500 },
            { op: 'buff', stat: 'closeRate', mult: 0.97, days: 7, label: 'Reps in training' },
            { op: 'mod', stat: 'closeRate', mult: 1.019 },
            { op: 'mod', stat: 'bookRate', mult: 1.005 },
            { op: 'mod', stat: 'hireRamp', mult: 1.035 },
            { op: 'add', path: 'team.morale', value: 4 },
            { op: 'flag', name: 'trainedTeam', value: true }
          ],
          outcome: 'The first reviews were awkward. By week four, reps were catching their own mistakes and the close rate was back above where it started.',
          lesson: 'Train the people you have before you hire more of them.'
        },
        {
          id: 'one_workshop', label: 'Fly in a big-name speaker for a one-day workshop', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -7000 },
            { op: 'buff', stat: 'closeRate', mult: 1.08, days: 14, label: 'Workshop buzz' },
            { op: 'mod', stat: 'closeRate', mult: 1.005 }
          ],
          outcome: 'Great energy, great selfies. Two weeks later most reps were back to their old habits.',
          lesson: 'One big event inspires. Weekly practice changes behavior.'
        },
        {
          id: 'hire_more_reps', label: 'Skip training. Hire more reps to make up the numbers', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -9000 },
            { op: 'buff', stat: 'closeRate', mult: 1.03, days: 10, label: 'Fresh faces' },
            { op: 'mod', stat: 'closeRate', mult: 0.992 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'add', path: 'ops.efficiency', value: -4 },
            { op: 'flag', name: 'skippedTraining', value: true }
          ],
          outcome: 'More reps, same habits. The average close rate dropped again, and now payroll was bigger too.',
          lesson: 'Untrained people multiply your problems, not your results.'
        }
      ],
      notebook: 'better_not_more'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 8 - ORG CHART (every system is overwhelmed)                  */
    /* ------------------------------------------------------------------ */
    {
      id: 'l8_loud_or_quiet', level: 8, emoji: '🚨', title: 'The loud fire and the quiet one',
      trigger: { all: [{ minLevel: 8 }] },
      priority: 9,
      text: 'A big client is yelling in your inbox about a typo on an invoice. Meanwhile, quietly, refunds have doubled this month. You have one week of real focus.',
      ghostDays: 75,
      options: [
        {
          id: 'quiet_big', label: 'Spend the week on the refund spike. Send a calm manager to the yeller', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'add', path: 'depts.delivery.health', value: 12 },
            { op: 'mod', stat: 'refundRate', mult: 0.922 },
            { op: 'mod', stat: 'churn', mult: 0.974 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.02 },
            { op: 'mod', stat: 'referralRate', mult: 1.038 },
            { op: 'flag', name: 'triagedQuietFire', value: true }
          ],
          outcome: 'The refunds came from one new team member skipping onboarding calls. Fixed in a week. The yeller got a fixed invoice and a polite note, and calmed right down.',
          lesson: 'Fix the fire that costs the most, not the one that shouts the loudest.'
        },
        {
          id: 'split_time', label: 'Split your week between both', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -5000 },
            { op: 'add', path: 'depts.delivery.health', value: 4 },
            { op: 'mod', stat: 'refundRate', mult: 0.98 }
          ],
          outcome: 'The client calmed down and refunds dipped a little. You never found the root cause, so they crept back.',
          lesson: 'Half your attention on a big fire lets it keep burning.'
        },
        {
          id: 'loud_small', label: 'Drop everything for the angry client. Make them happy today!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 3000 },
            { op: 'add', path: 'depts.delivery.health', value: -10 },
            { op: 'mod', stat: 'refundRate', mult: 1.038 },
            { op: 'mod', stat: 'churn', mult: 1.02 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.99 },
            { op: 'mod', stat: 'referralRate', mult: 0.974 },
            { op: 'flag', name: 'chasedLoudFire', value: true }
          ],
          outcome: 'The client loved the VIP treatment and paid early. While you were busy, refunds kept quietly draining far more than that one invoice.',
          lesson: 'Loud is not the same as important.'
        }
      ],
      notebook: 'triage'
    },

    {
      id: 'l8_ceo_bottleneck', level: 8, emoji: '🧑‍✈️', title: 'Everything waits on you',
      trigger: { all: [{ minLevel: 8 }, orChance({ path: 'metrics.headcount', gte: 60 }, 0.07)] },
      priority: 8,
      text: 'Thirty decisions a day land on your desk. Approvals sit for days. Your managers have stopped deciding anything without you.',
      ghostDays: 75,
      options: [
        {
          id: 'delegate', label: 'Write clear decision rules and hand approvals to department heads', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -2500 },
            { op: 'buff', stat: 'teamOutput', mult: 0.97, days: 10, label: 'Learning to decide' },
            { op: 'mod', stat: 'teamOutput', mult: 1.024 },
            { op: 'add', path: 'ops.efficiency', value: 7 },
            { op: 'add', path: 'attention.max', value: 1 },
            { op: 'add', path: 'team.morale', value: 5 },
            { op: 'flag', name: 'delegatedDecisions', value: true }
          ],
          outcome: 'A few wrong calls in week one, nothing fatal. By week three decisions took hours, not days, and you finally had time to think.',
          lesson: 'If every decision needs you, you are the bottleneck.'
        },
        {
          id: 'assistant', label: 'Hire an assistant to sort your inbox', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -5000 },
            { op: 'add', path: 'ops.efficiency', value: 1 }
          ],
          outcome: 'Your inbox got tidier. The decisions still had to go through you, just in a nicer order.',
          lesson: 'Organizing a bottleneck does not remove it.'
        },
        {
          id: 'work_harder', label: 'Work 80-hour weeks. Nobody cares like you do', quality: 'trap',
          effects: [
            { op: 'add', path: 'burnout', value: 25 },
            { op: 'buff', stat: 'teamOutput', mult: 1.05, days: 10, label: 'Founder on fire' },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'add', path: 'ops.efficiency', value: -3 },
            { op: 'add', path: 'team.morale', value: -6 },
            { op: 'flag', name: 'ceoDoesAll', value: true }
          ],
          outcome: 'You cleared the pile for ten days. Then you got sick, the pile tripled, and your managers learned to wait for you even harder.',
          lesson: 'Working harder can\'t fix a job only you are allowed to do.'
        }
      ],
      notebook: 'ceo_attention'
    },

    {
      id: 'l8_departments', level: 8, emoji: '🗂️', title: 'Whose job is this?',
      trigger: { all: [{ minLevel: 8 }, orChance({ path: 'depts.delivery.health', lte: 74 }, 0.06)] },
      priority: 7,
      text: 'A customer complaint bounced between sales, delivery and support for nine days. Everyone thought it was someone else\'s job.',
      ghostDays: 75,
      options: [
        {
          id: 'clear_departments', label: 'Split into clear departments, each with one owner and a scoreboard', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'buff', stat: 'teamOutput', mult: 0.96, days: 14, label: 'Reorg' },
            { op: 'add', path: 'depts.marketing.health', value: 6 },
            { op: 'add', path: 'depts.sales.health', value: 6 },
            { op: 'add', path: 'depts.delivery.health', value: 8 },
            { op: 'add', path: 'depts.people.health', value: 6 },
            { op: 'add', path: 'depts.finance.health', value: 6 },
            { op: 'add', path: 'depts.tech.health', value: 6 },
            { op: 'mod', stat: 'teamOutput', mult: 1.03 },
            { op: 'mod', stat: 'churn', mult: 0.98 },
            { op: 'flag', name: 'builtDepartments', value: true }
          ],
          outcome: 'Two weeks of new boxes and lines. Then every problem had a home, every home had a boss, and complaints got fixed in a day.',
          lesson: 'When everyone owns a problem, nobody does. Give each one a home.'
        },
        {
          id: 'task_force', label: 'Form a task force just for complaints', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -5000 },
            { op: 'add', path: 'depts.delivery.health', value: 5 },
            { op: 'add', path: 'team.morale', value: -1 }
          ],
          outcome: 'Complaints got handled faster. Everything else that fell between teams kept falling.',
          lesson: 'A task force patches one gap. Structure closes all of them.'
        },
        {
          id: 'everyone_owns', label: 'Make it everyone\'s job. We\'re one big family!', quality: 'trap',
          effects: [
            { op: 'add', path: 'team.morale', value: 4 },
            { op: 'add', path: 'depts.delivery.health', value: -8 },
            { op: 'add', path: 'depts.sales.health', value: -5 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'teamOutput', mult: 0.995 },
            { op: 'flag', name: 'everyoneOwnsIt', value: true }
          ],
          outcome: 'It felt warm and fuzzy. In practice, ninety people each assumed one of the other eighty-nine had it covered.',
          lesson: 'Shared ownership is no ownership.'
        }
      ],
      notebook: 'departments'
    },

    {
      id: 'l8_one_source', level: 8, emoji: '🗄️', title: 'Where is everything?',
      trigger: { all: [{ minLevel: 8 }, orChance({ path: 'depts.tech.health', lte: 74 }, 0.06)] },
      priority: 6,
      text: 'Passwords on sticky notes. Files on personal laptops. Client notes in five different tools. A senior rep just quit and took every client note with her.',
      ghostDays: 75,
      options: [
        {
          id: 'central_hub', label: 'Move everything into one company-owned hub with proper access rules', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -3500 },
            { op: 'buff', stat: 'teamOutput', mult: 0.97, days: 14, label: 'Big data move' },
            { op: 'add', path: 'depts.tech.health', value: 15 },
            { op: 'mod', stat: 'churn', mult: 0.974 },
            { op: 'mod', stat: 'teamOutput', mult: 1.012 },
            { op: 'mod', stat: 'closeRate', mult: 1.014 },
            { op: 'mod', stat: 'bookRate', mult: 1.01 },
            { op: 'add', path: 'ops.efficiency', value: 4 },
            { op: 'flag', name: 'centralData', value: true }
          ],
          outcome: 'Moving years of files was a slog. Now every client has one history, people only see what they need, and leavers hand back the keys.',
          lesson: 'Company data belongs in one place the company owns.'
        },
        {
          id: 'password_manager', label: 'Buy a password manager and call it done', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'add', path: 'depts.tech.health', value: 5 }
          ],
          outcome: 'The sticky notes are gone. The client notes are still scattered across five tools and a dozen laptops.',
          lesson: 'Locking the door helps. Knowing where your stuff is helps more.'
        },
        {
          id: 'later', label: 'Too busy growing. Deal with it next quarter', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'teamOutput', mult: 1.02, days: 7, label: 'Skipped the cleanup' },
            { op: 'add', path: 'depts.tech.health', value: -12 },
            { op: 'mod', stat: 'churn', mult: 1.007 },
            { op: 'mod', stat: 'bookRate', mult: 0.995 },
            { op: 'add', path: 'ops.efficiency', value: -3 },
            { op: 'flag', name: 'dataLater', value: true }
          ],
          outcome: 'Next quarter came with two more leavers and a lost contract. Clients noticed when nobody remembered their history.',
          lesson: 'Messy data gets more expensive every person you add.'
        }
      ],
      notebook: 'departments'
    },

    {
      id: 'l8_customer_tiers', level: 8, emoji: '🏷️', title: 'Not all customers are the same',
      trigger: { all: [{ minLevel: 8 }, orChance({ path: 'metrics.revenue30', gte: 400000 }, 0.05)] },
      priority: 5,
      text: 'Support treats a client who pays $40k a year exactly like one who paid once for $500. Your biggest accounts feel ignored. Your smallest ones eat half the support time.',
      ghostDays: 75,
      options: [
        {
          id: 'tiers', label: 'Sort customers into tiers by value and give each tier its own care plan', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -8000 },
            { op: 'mod', stat: 'churn', mult: 0.949 },
            { op: 'mod', stat: 'upsellTake', mult: 1.038 },
            { op: 'mod', stat: 'premiumTake', mult: 1.038 },
            { op: 'add', path: 'depts.delivery.health', value: 6 },
            { op: 'flag', name: 'segmentedCustomers', value: true }
          ],
          outcome: 'Big accounts got a named contact and quarterly check-ins. Small ones got great self-serve help. Both groups stayed longer and the big ones bought more.',
          lesson: 'Sort customers by what they need and what they\'re worth, then serve each group on purpose.'
        },
        {
          id: 'vip_hotline', label: 'Add a VIP hotline for the biggest clients only', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -3000 },
            { op: 'mod', stat: 'churn', mult: 0.985 }
          ],
          outcome: 'Your top clients loved the hotline. Everyone else still waited in one long line.',
          lesson: 'One special lane helps. A plan for every lane helps more.'
        },
        {
          id: 'same_for_all', label: 'Treat everyone exactly the same. Fair is fair!', quality: 'trap',
          effects: [
            { op: 'add', path: 'team.morale', value: 2 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'upsellTake', mult: 0.99 },
            { op: 'add', path: 'depts.delivery.health', value: -4 },
            { op: 'coach', text: 'Same treatment for every customer means the wrong treatment for most of them.' }
          ],
          outcome: 'Simple rules, happy support team. Then two of your biggest clients left for a rival who gave them a real account manager.',
          lesson: 'Equal treatment is not the same as good treatment.'
        }
      ],
      notebook: 'triage'
    },

    {
      id: 'l8_hiring_pipeline', level: 8, emoji: '📥', title: 'The applicant avalanche',
      trigger: { all: [{ minLevel: 8 }, orChance({ path: 'metrics.headcount', gte: 70 }, 0.04)] },
      priority: 4,
      text: 'Twenty open roles and 1,800 applications in one shared inbox. The best candidates take other offers while your managers dig through it.',
      ghostDays: 75,
      options: [
        {
          id: 'sorted_pipeline', label: 'Sort the pipeline by role, score every applicant and track each stage', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -9000 },
            { op: 'add', path: 'depts.people.health', value: 12 },
            { op: 'mod', stat: 'hireRamp', mult: 1.057 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 },
            { op: 'mod', stat: 'salaryCost', mult: 0.995 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.003 },
            { op: 'add', path: 'team.morale', value: 3 },
            { op: 'flag', name: 'segmentedHiring', value: true }
          ],
          outcome: 'Each role got its own lane, a scorecard and a 48-hour reply rule. You stopped losing top candidates, and new hires fit better from day one.',
          lesson: 'Sort applicants like leads: by role, by fit, by speed.'
        },
        {
          id: 'outside_recruiter', label: 'Pay an outside recruiting firm to handle the hardest roles', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -15000 },
            { op: 'add', path: 'depts.people.health', value: 6 },
            { op: 'mod', stat: 'teamOutput', mult: 1.005 }
          ],
          outcome: 'The firm found solid people for the senior roles. Pricey, and the other 15 roles were still stuck in the inbox.',
          lesson: 'Outside help fills a few seats. A system fills all of them.'
        },
        {
          id: 'first_come', label: 'Hire whoever replies first. Seats need filling!', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'teamOutput', mult: 1.04, days: 14, label: 'Seats filled' },
            { op: 'mod', stat: 'teamOutput', mult: 0.99 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.996 },
            { op: 'add', path: 'depts.people.health', value: -10 },
            { op: 'add', path: 'team.morale', value: -6 },
            { op: 'flag', name: 'hiredFastest', value: true }
          ],
          outcome: 'Every seat was full in two weeks. Two months later a third of them were gone and the good people were tired of covering for them.',
          lesson: 'A fast bad hire costs more than a slow empty seat.'
        }
      ],
      notebook: 'triage'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 9 - SPECIALISTS (nobody can know everything)                 */
    /* ------------------------------------------------------------------ */
    {
      id: 'l9_veteran_or_specialist', level: 9, emoji: '🎯', title: 'The veteran or the specialist?',
      trigger: { all: [{ minLevel: 9 }] },
      priority: 9,
      text: 'Ad costs keep climbing. Sam, your loyal do-it-all veteran, offers to take it on. Or you could hire someone who has only ever run big ad budgets.',
      ghostDays: 75,
      options: [
        {
          id: 'hire_specialist', label: 'Hire the ad specialist. Keep Sam where he shines', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -3000 },
            { op: 'mod', stat: 'adCpl', mult: 0.92 },
            { op: 'mod', stat: 'bookRate', mult: 1.024 },
            { op: 'mod', stat: 'closeRate', mult: 1.02 },
            { op: 'add', path: 'depts.marketing.health', value: 10 },
            { op: 'flag', name: 'hiredSpecialist', value: true }
          ],
          outcome: 'Sam sulked for a day, then admitted he was relieved. The specialist rebuilt the ad account in a month and every lead got cheaper.',
          lesson: 'At this size, a master of one beats a jack of all trades.'
        },
        {
          id: 'train_sam', label: 'Send Sam on an ads course and let him learn', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -9000 },
            { op: 'mod', stat: 'adCpl', mult: 0.98 },
            { op: 'add', path: 'team.morale', value: 1 }
          ],
          outcome: 'Sam learned a lot and costs dipped a little. But he still had four other jobs, so the ads got his leftover hours.',
          lesson: 'Training helps, but a part-time expert is still part-time.'
        },
        {
          id: 'sam_does_it', label: 'Give it to Sam. He\'s done every job here and never let you down', quality: 'trap',
          effects: [
            { op: 'add', path: 'team.morale', value: 1 },
            { op: 'mod', stat: 'adCpl', mult: 1.024 },
            { op: 'mod', stat: 'closeRate', mult: 0.99 },
            { op: 'add', path: 'depts.marketing.health', value: -6 },
            { op: 'flag', name: 'generalistStretched', value: true }
          ],
          outcome: 'Sam worked nights to keep up. Ad costs kept rising, and the three other things Sam owned started slipping too.',
          lesson: 'Loyalty earns trust. It doesn\'t earn expertise.'
        }
      ],
      notebook: 'specialists'
    },

    {
      id: 'l9_promote_or_hire', level: 9, emoji: '🪜', title: 'Who runs sales?',
      trigger: { all: [{ minLevel: 9 }, orChance({ path: 'metrics.headcount', gte: 120 }, 0.07)] },
      priority: 8,
      text: 'You need a head of sales for a team of 40. Your top rep wants the job, but has never managed anyone. A proven leader who built a team this size is open to talk.',
      ghostDays: 75,
      options: [
        {
          id: 'proven_leader', label: 'Recruit the proven leader yourself. Sell them on the vision', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -4000 },
            { op: 'buff', stat: 'closeRate', mult: 0.99, days: 14, label: 'New sales boss' },
            { op: 'mod', stat: 'closeRate', mult: 1.044 },
            { op: 'mod', stat: 'bookRate', mult: 1.01 },
            { op: 'mod', stat: 'salaryCost', mult: 0.97 },
            { op: 'add', path: 'depts.sales.health', value: 12 },
            { op: 'mod', stat: 'teamOutput', mult: 1.01 },
            { op: 'flag', name: 'provenLeader', value: true }
          ],
          outcome: 'It took six calls and a dinner to land them. They brought a hiring scorecard, a coaching rhythm and a forecast you can trust. Your top rep kept selling, and kept winning.',
          lesson: 'Hire leaders who have already done the job at the size you\'re heading to.'
        },
        {
          id: 'promote_with_coach', label: 'Promote your top rep and pay for a leadership coach', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -8000 },
            { op: 'mod', stat: 'closeRate', mult: 1.01 },
            { op: 'add', path: 'team.morale', value: 4 },
            { op: 'add', path: 'depts.sales.health', value: 4 }
          ],
          outcome: 'Slow start, real effort, steady growth. The coach helped a lot, but learning to lead 40 people on the job is tough.',
          lesson: 'Promoting from within works best with support and a smaller first team.'
        },
        {
          id: 'promote_star', label: 'Promote your best seller. Loyalty pays!', quality: 'trap',
          effects: [
            { op: 'add', path: 'team.morale', value: 5 },
            { op: 'buff', stat: 'closeRate', mult: 1.03, days: 10, label: 'Promotion buzz' },
            { op: 'mod', stat: 'closeRate', mult: 0.987 },
            { op: 'mod', stat: 'bookRate', mult: 0.995 },
            { op: 'add', path: 'depts.sales.health', value: -6 },
            { op: 'flag', name: 'promotedStar', value: true }
          ],
          outcome: 'You lost your best seller and gained a stressed-out manager who kept jumping on calls instead of coaching. The whole team\'s numbers slipped.',
          lesson: 'Your best player is not automatically your best coach.'
        }
      ],
      notebook: 'department_heads'
    },

    {
      id: 'l9_pay_up', level: 9, emoji: '💎', title: 'Pay up for the best?',
      trigger: { all: [{ minLevel: 9 }, orChance({ path: 'depts.delivery.health', lte: 76 }, 0.06)] },
      priority: 7,
      text: 'A star head of delivery wants 40% above your pay band. A solid, fine candidate will take the band today. Your delivery team is waiting.',
      ghostDays: 75,
      options: [
        {
          id: 'pay_star', label: 'Pay the star. One great leader beats three okay ones', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -7000 },
            { op: 'mod', stat: 'churn', mult: 0.974 },
            { op: 'mod', stat: 'teamOutput', mult: 1.007 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.01 },
            { op: 'mod', stat: 'premiumTake', mult: 1.015 },
            { op: 'mod', stat: 'referralRate', mult: 1.012 },
            { op: 'add', path: 'depts.delivery.health', value: 10 },
            { op: 'flag', name: 'paidAPlayer', value: true }
          ],
          outcome: 'Pricey, and finance winced. Within two months churn fell, your best delivery people stayed, and the weak ones got coached up or moved on.',
          lesson: 'Top people cost more and are worth far more than they cost.'
        },
        {
          id: 'meet_middle', label: 'Offer halfway and hope they say yes', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -4000 },
            { op: 'mod', stat: 'churn', mult: 0.985 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.005 },
            { op: 'add', path: 'depts.delivery.health', value: 3 }
          ],
          outcome: 'They took it, a little grudgingly. Good work, but they kept one eye on other offers.',
          lesson: 'Haggling with a top hire saves pennies and costs commitment.'
        },
        {
          id: 'take_fine', label: 'Take the fine candidate. Budget is budget', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 3000 },
            { op: 'mod', stat: 'churn', mult: 1.01 },
            { op: 'mod', stat: 'teamOutput', mult: 0.997 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.995 },
            { op: 'mod', stat: 'premiumTake', mult: 0.99 },
            { op: 'add', path: 'depts.delivery.health', value: -5 },
            { op: 'flag', name: 'tookBPlayer', value: true }
          ],
          outcome: 'You saved on salary. The new head kept things running but never fixed anything, and your best delivery people got bored and left.',
          lesson: 'The cheapest leader is often the most expensive mistake.'
        }
      ],
      notebook: 'a_players'
    },

    {
      id: 'l9_split_sales', level: 9, emoji: '🧩', title: 'One team, too many products',
      trigger: { all: [{ minLevel: 9 }, orChance({ path: 'metrics.revenue30', gte: 800000 }, 0.05)] },
      priority: 6,
      text: 'Every rep sells the core offer, the premium tier and three add-ons. Callers get mixed messages, and reps fumble the products they rarely sell.',
      ghostDays: 75,
      options: [
        {
          id: 'product_teams', label: 'Split sales into product teams, each with its own script and scoreboard', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -8000 },
            { op: 'buff', stat: 'closeRate', mult: 0.95, days: 14, label: 'Team split' },
            { op: 'mod', stat: 'closeRate', mult: 1.015 },
            { op: 'mod', stat: 'premiumTake', mult: 1.039 },
            { op: 'mod', stat: 'upsellTake', mult: 1.03 },
            { op: 'mod', stat: 'salaryCost', mult: 0.992 },
            { op: 'add', path: 'depts.sales.health', value: 8 },
            { op: 'flag', name: 'splitSalesTeams', value: true }
          ],
          outcome: 'A messy two weeks of reshuffling. Then each team got scary good at one product, and the best leads went to the reps who knew them best.',
          lesson: 'Specialized sellers know their product cold, and buyers can feel it.'
        },
        {
          id: 'cheat_sheet', label: 'Give everyone a one-page cheat sheet for every product', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'mod', stat: 'closeRate', mult: 1.005 }
          ],
          outcome: 'Fewer wrong answers on calls. Still five products in every rep\'s head, and still a fumble on the rare ones.',
          lesson: 'A cheat sheet helps a generalist. It doesn\'t make one an expert.'
        },
        {
          id: 'pitch_everything', label: 'Keep everyone selling everything. Bigger bundles, bigger checks!', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'upsellTake', mult: 1.1, days: 14, label: 'Bundle push' },
            { op: 'mod', stat: 'closeRate', mult: 0.99 },
            { op: 'mod', stat: 'refundRate', mult: 1.019 },
            { op: 'add', path: 'depts.sales.health', value: -5 }
          ],
          outcome: 'Check sizes popped for two weeks. Then refunds rolled in from people who bought things they didn\'t understand.',
          lesson: 'A rep who sells everything ends up selling nothing well.'
        }
      ],
      notebook: 'specialists'
    },

    {
      id: 'l9_retention_team', level: 9, emoji: '🛟', title: 'The leak at scale',
      trigger: { all: [{ minLevel: 9 }, orChance({ path: 'metrics.headcount', gte: 150 }, 0.05)] },
      priority: 5,
      text: 'You win a thousand customers a month and quietly lose seven hundred. Sales gets the cheers. Nobody owns keeping customers.',
      ghostDays: 90,
      options: [
        {
          id: 'retention_team', label: 'Build a team that owns onboarding, check-ins and renewals', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -9500 },
            { op: 'mod', stat: 'churn', mult: 0.952 },
            { op: 'mod', stat: 'upsellTake', mult: 1.012 },
            { op: 'mod', stat: 'premiumTake', mult: 1.029 },
            { op: 'mod', stat: 'referralRate', mult: 1.029 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.005 },
            { op: 'add', path: 'depts.delivery.health', value: 8 },
            { op: 'flag', name: 'retentionTeam', value: true }
          ],
          outcome: 'The team called every new customer in week one, spotted who was drifting and saved them before they left. The bucket finally started filling up.',
          lesson: 'Keeping a customer is cheaper than winning a new one. Give it an owner.'
        },
        {
          id: 'win_back', label: 'Run a win-back campaign for people who already left', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'add', path: 'leads', value: 30 },
            { op: 'mod', stat: 'churn', mult: 0.99 }
          ],
          outcome: 'Some old customers came back. The reasons they left were still there, so many left again.',
          lesson: 'Winning people back is nice. Not losing them is better.'
        },
        {
          id: 'outrun_leak', label: 'Outrun the leak. Double the ad spend', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -40000 },
            { op: 'buff', stat: 'adCpl', mult: 0.8, days: 21, label: 'Ad blitz' },
            { op: 'mod', stat: 'adCpl', mult: 1.012 },
            { op: 'mod', stat: 'churn', mult: 1.007 },
            { op: 'mod', stat: 'referralRate', mult: 0.987 },
            { op: 'flag', name: 'outranTheLeak', value: true }
          ],
          outcome: 'A big month of new sign-ups. Then the same seven in ten walked out the back door, now on a much bigger ad bill.',
          lesson: 'Plug the holes before you pour in more water.'
        }
      ],
      notebook: 'specialists'
    },

    {
      id: 'l9_finance_team', level: 9, emoji: '🧮', title: 'Who minds the money?',
      trigger: { all: [{ minLevel: 9 }, orChance({ path: 'depts.finance.health', lte: 76 }, 0.05)] },
      priority: 4,
      text: 'Your bookkeeper is drowning: quarterly taxes, payroll for 150 people and vendor contracts nobody has questioned in years. Time to decide who minds the money.',
      ghostDays: 75,
      options: [
        {
          id: 'finance_team', label: 'Build an in-house finance team: a controller, a tax pro and a buyer', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -9500 },
            { op: 'mod', stat: 'salaryCost', mult: 0.99 },
            { op: 'add', path: 'depts.finance.health', value: 15 },
            { op: 'add', path: 'ops.efficiency', value: 2 },
            { op: 'flag', name: 'financeTeam', value: true }
          ],
          outcome: 'They renegotiated every big vendor, caught duplicate payments and set real budgets per department. The team paid for itself in a couple of months.',
          lesson: 'At this size, money needs its own specialists, not a heroic generalist.'
        },
        {
          id: 'part_time_cfo', label: 'Keep the bookkeeper and add a part-time finance chief', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -6000 },
            { op: 'mod', stat: 'salaryCost', mult: 0.995 },
            { op: 'add', path: 'depts.finance.health', value: 6 }
          ],
          outcome: 'Better reports and a few smart cuts. Still not enough hands to dig into every contract.',
          lesson: 'Part-time help gives part-time results.'
        },
        {
          id: 'cheapest_firm', label: 'Outsource it all to the cheapest accounting firm you can find', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -2000 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'add', path: 'depts.finance.health', value: -8 },
            { op: 'flag', name: 'cheapBooks', value: true }
          ],
          outcome: 'Cheap and hands-off. They filed what you sent them and never asked a question. Waste kept leaking, and nobody looked.',
          lesson: 'Nobody guards your money like someone whose only job is your money.'
        }
      ],
      notebook: 'department_heads'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 10 - EMPIRE (growth stalls: one Big Bet, then The Summit)    */
    /* ------------------------------------------------------------------ */
    {
      id: 'l10_which_bet', level: 10, emoji: '🎲', title: 'Which bet?',
      trigger: { all: [{ minLevel: 10 }, { notFlag: 'betDone' }] },
      priority: 9,
      text: 'Growth has flattened. Your team pitches three big ideas. You can only back one with real money and your best people.',
      ghostDays: 90,
      options: [
        {
          id: 'adjacent_bet', label: 'Bet next to your strengths: a new thing your customers already ask for', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -23000 },
            { op: 'mod', stat: 'premiumTake', mult: 1.035 },
            { op: 'mod', stat: 'upsellTake', mult: 1.019 },
            { op: 'mod', stat: 'closeRate', mult: 1.005 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.007 },
            { op: 'flag', name: 'adjacentBet', value: true },
            { op: 'coach', text: 'Good instinct. When you place the real Big Bet in the Company tab, prep it like this.' }
          ],
          outcome: 'You surveyed your top customers and built a pilot for the thing they kept requesting. It sold before it was finished.',
          lesson: 'The best big bets stand on what you already do well.'
        },
        {
          id: 'no_bet', label: 'No bet yet. Squeeze a bit more out of what you have', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'teamOutput', mult: 0.985 },
            { op: 'buff', stat: 'adCpl', mult: 1.06, days: 45, label: 'Crowded market' }
          ],
          outcome: 'You shaved some costs, and your most ambitious people got bored. The market kept getting more crowded and growth stayed flat.',
          lesson: 'Small tweaks can\'t move a company this big. At some point you have to bet.'
        },
        {
          id: 'shiny_bet', label: 'Chase the hottest trend, in a market you know nothing about', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -90000 },
            { op: 'add', path: 'team.morale', value: 4 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'add', path: 'depts.tech.health', value: -6 },
            { op: 'flag', name: 'shinyBet', value: true }
          ],
          outcome: 'Exciting launch party. Then you learned what everyone in that market already knew, the expensive way, while your best people were distracted.',
          lesson: 'Hot trends are hot for everyone. Your edge lives where you already win.'
        }
      ],
      notebook: 'big_bet'
    },

    {
      id: 'l10_bet_size', level: 10, emoji: '⚖️', title: 'How big is big?',
      trigger: { all: [{ minLevel: 10 }, { notFlag: 'betDone' }, orChance({ path: 'metrics.headcount', gte: 260 }, 0.08)] },
      priority: 8,
      text: 'Your board asks how much to put behind the next bet. Too small won\'t matter at your size. Too big could sink you if it flops.',
      ghostDays: 90,
      options: [
        {
          id: 'right_sized', label: 'Big enough to matter, safe enough to survive, with clear go/no-go checkpoints', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -18000 },
            { op: 'mod', stat: 'premiumTake', mult: 1.029 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.007 },
            { op: 'mod', stat: 'closeRate', mult: 1.007 },
            { op: 'add', path: 'depts.finance.health', value: 10 },
            { op: 'add', path: 'ops.efficiency', value: 3 },
            { op: 'flag', name: 'rightSizedBet', value: true }
          ],
          outcome: 'You funded it in stages. The first checkpoint showed real demand, so the second check went in with confidence instead of hope.',
          lesson: 'Size a bet so a win changes the company and a loss doesn\'t end it.'
        },
        {
          id: 'tiny_test', label: 'Play it safe: a tiny side test', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -7000 },
            { op: 'mod', stat: 'premiumTake', mult: 1.01 },
            { op: 'mod', stat: 'teamOutput', mult: 0.995 },
            { op: 'buff', stat: 'adCpl', mult: 1.06, days: 45, label: 'Still stuck' }
          ],
          outcome: 'The test kind of worked, but at your size it barely showed up in the numbers. Growth stayed flat.',
          lesson: 'A bet too small to matter is its own kind of risk.'
        },
        {
          id: 'bet_the_farm', label: 'All in: every dollar in the bank. Fortune favors the bold!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -150000 },
            { op: 'buff', stat: 'teamOutput', mult: 1.05, days: 14, label: 'All hands on deck' },
            { op: 'add', path: 'team.morale', value: -5 },
            { op: 'add', path: 'depts.finance.health', value: -15 },
            { op: 'flag', name: 'betTheFarm', value: true }
          ],
          outcome: 'With no cushion left, payroll got tight, vendors got nervous and a pricey emergency loan plus late fees ate $150k. Even the good news came too slowly to relax.',
          lesson: 'Never bet more than you can afford to lose.'
        }
      ],
      notebook: 'big_bet'
    },

    {
      id: 'l10_keep_the_keys', level: 10, emoji: '🔑', title: 'Can it run without you?',
      trigger: { all: [{ minLevel: 10 }, orChance({ path: 'metrics.headcount', gte: 280 }, 0.06)] },
      priority: 7,
      text: 'A buyer\'s scout asks one question: what happens if you take three months off? Honest answer: a lot of things stop.',
      ghostDays: 90,
      options: [
        {
          id: 'leadership_team', label: 'Build a leadership team that runs it without you, then step back', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -23000 },
            { op: 'buff', stat: 'closeRate', mult: 0.97, days: 21, label: 'Handing over the keys' },
            { op: 'mod', stat: 'teamOutput', mult: 1.012 },
            { op: 'mod', stat: 'salaryCost', mult: 0.995 },
            { op: 'mod', stat: 'bookRate', mult: 1.007 },
            { op: 'add', path: 'ops.efficiency', value: 5 },
            { op: 'add', path: 'depts.people.health', value: 10 },
            { op: 'add', path: 'attention.max', value: 1 },
            { op: 'add', path: 'team.morale', value: 5 },
            { op: 'flag', name: 'leadershipTeam', value: true }
          ],
          outcome: 'Letting go was hard. Your leaders made calls you wouldn\'t have, and most were better. The scout\'s next report said the company runs fine without its founder.',
          lesson: 'A company that needs you is a job. One that runs without you is an asset buyers pay more for.'
        },
        {
          id: 'one_coo', label: 'Hire one strong second-in-command, keep the big calls yourself', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -18000 },
            { op: 'mod', stat: 'teamOutput', mult: 1.007 },
            { op: 'add', path: 'depts.people.health', value: 3 }
          ],
          outcome: 'Day-to-day got smoother. Every big decision still waited on you, and buyers noticed.',
          lesson: 'One deputy helps. A whole bench is what makes you optional.'
        },
        {
          id: 'stay_in_charge', label: 'Stay hands-on in every big deal. Buyers love a visionary founder!', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.04, days: 21, label: 'Founder closes' },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'add', path: 'ops.efficiency', value: -4 },
            { op: 'add', path: 'depts.people.health', value: -8 },
            { op: 'add', path: 'team.morale', value: -4 },
            { op: 'add', path: 'burnout', value: 20 },
            { op: 'flag', name: 'founderInEverything', value: true }
          ],
          outcome: 'You closed some big deals personally. Your leaders stopped growing, and the scout wrote: "Value walks out the door with the founder."',
          lesson: 'If the business needs you, a buyer is buying a job, and pays like it.'
        }
      ],
      notebook: 'owner_independence'
    },

    {
      id: 'l10_sell_or_wait', level: 10, emoji: '⏳', title: 'Sell now or one more year?',
      trigger: { all: [{ minLevel: 10 }, orChance({ path: 'metrics.revenue30', gte: 1500000 }, 0.05)] },
      priority: 6,
      text: 'A buyer sends a friendly first offer. Your gut says one more year could fetch way more. Your advisor reminds you buyers pay most while growth is still climbing.',
      ghostDays: 90,
      options: [
        {
          id: 'ready_both_ways', label: 'Grow like you\'ll never sell, prepare like you\'ll sell tomorrow', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -18000 },
            { op: 'add', path: 'depts.finance.health', value: 12 },
            { op: 'mod', stat: 'churn', mult: 0.987 },
            { op: 'mod', stat: 'salaryCost', mult: 0.995 },
            { op: 'mod', stat: 'bookRate', mult: 1.007 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.005 },
            { op: 'add', path: 'ops.efficiency', value: 3 },
            { op: 'flag', name: 'saleReady', value: true },
            { op: 'coach', text: 'Now you can sell on your timing, not theirs. The Summit is open whenever the number is right.' }
          ],
          outcome: 'You kept investing in growth and tidied everything a buyer would check. When more offers came, you could say yes on a good day instead of a desperate one.',
          lesson: 'Sell while you\'re still growing, and stay ready so the timing is yours.'
        },
        {
          id: 'take_first', label: 'Take the first offer before it disappears', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -9000 },
            { op: 'add', path: 'depts.finance.health', value: 4 },
            { op: 'buff', stat: 'teamOutput', mult: 0.97, days: 21, label: 'Deal distraction' }
          ],
          outcome: 'Advisors and lawyers got busy fast. One offer with no competition rarely turns out to be the best one.',
          lesson: 'One offer is a price. Several offers are a market.'
        },
        {
          id: 'one_more_year', label: 'Wait one more year and cut costs hard to make profit look huge', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 15000 },
            { op: 'mod', stat: 'closeRate', mult: 0.99 },
            { op: 'mod', stat: 'bookRate', mult: 0.99 },
            { op: 'mod', stat: 'adCpl', mult: 1.019 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.992 },
            { op: 'mod', stat: 'referralRate', mult: 0.974 },
            { op: 'mod', stat: 'churn', mult: 1.012 },
            { op: 'mod', stat: 'teamOutput', mult: 0.992 },
            { op: 'add', path: 'team.morale', value: -6 },
            { op: 'flag', name: 'waitedOneMoreYear', value: true }
          ],
          outcome: 'Profit looked great for a quarter. Then growth stalled, good people left and buyers spotted a business that had stopped investing in itself.',
          lesson: 'Starving the business to fake profit lowers the price you get.'
        }
      ],
      notebook: 'the_summit'
    },

    {
      id: 'l10_recurring_push', level: 10, emoji: '🔁', title: 'Make the money repeat',
      trigger: { all: [{ minLevel: 10 }, orChance({ path: 'metrics.headcount', gte: 300 }, 0.05)] },
      priority: 5,
      text: 'Buyers pay a lot more for revenue that renews by itself. Right now most of yours is one-time sales you have to win again every month.',
      ghostDays: 90,
      options: [
        {
          id: 'real_reasons', label: 'Move customers onto ongoing plans with real reasons to stay', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -12000 },
            { op: 'mod', stat: 'churn', mult: 0.969 },
            { op: 'mod', stat: 'premiumTake', mult: 1.029 },
            { op: 'mod', stat: 'upsellTake', mult: 1.01 },
            { op: 'mod', stat: 'referralRate', mult: 1.024 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.005 },
            { op: 'flag', name: 'recurringPush', value: true }
          ],
          outcome: 'Community, regular check-ins and new perks each quarter gave people reasons to stay. Repeat revenue climbed month after month.',
          lesson: 'Repeat revenue is worth more, and people repeat for value, not handcuffs.'
        },
        {
          id: 'prepay_discount', label: 'Offer a discount to anyone who prepays a full year', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: 5000 },
            { op: 'mul', path: 'combos.membership.price', value: 0.85 },
            { op: 'mod', stat: 'churn', mult: 0.99 }
          ],
          outcome: 'Nice cash bump up front and fewer cancellations for the year. You did trade away some revenue to get it.',
          lesson: 'Prepay is great for cash, but a discount is still a discount.'
        },
        {
          id: 'lock_in', label: 'Lock everyone into 3-year contracts with nasty cancel fees', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 9000 },
            { op: 'buff', stat: 'churn', mult: 0.7, days: 30, label: 'Locked in' },
            { op: 'mod', stat: 'closeRate', mult: 0.982 },
            { op: 'mod', stat: 'bookRate', mult: 0.987 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.992 },
            { op: 'mod', stat: 'refundRate', mult: 1.024 },
            { op: 'mod', stat: 'referralRate', mult: 0.96 },
            { op: 'flag', name: 'lockInContracts', value: true }
          ],
          outcome: 'Churn froze for a month. New buyers balked at the contract, angry customers fought the fees and the reviews turned ugly.',
          lesson: 'Handcuffs keep customers for a while. Value keeps them for years.'
        }
      ],
      notebook: 'valuation'
    },

    {
      id: 'l10_due_diligence', level: 10, emoji: '🔍', title: 'The buyer\'s checklist',
      trigger: { all: [{ minLevel: 10 }, orChance({ path: 'depts.finance.health', lte: 78 }, 0.05)] },
      priority: 4,
      text: 'A buyer sends a 200-item checklist. Two big clients never signed contracts, the books have gaps and half your processes live in one person\'s head.',
      ghostDays: 90,
      options: [
        {
          id: 'clean_house', label: 'Clean house properly: audited books, signed contracts, written processes', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -30000 },
            { op: 'buff', stat: 'teamOutput', mult: 0.97, days: 21, label: 'Cleanup crunch' },
            { op: 'add', path: 'depts.finance.health', value: 20 },
            { op: 'mod', stat: 'churn', mult: 0.987 },
            { op: 'mod', stat: 'salaryCost', mult: 0.99 },
            { op: 'mod', stat: 'bookRate', mult: 1.005 },
            { op: 'add', path: 'ops.efficiency', value: 5 },
            { op: 'flag', name: 'cleanBooks', value: true }
          ],
          outcome: 'Auditors, lawyers and a month of late nights. You found waste you never knew about, and the buyer\'s team found nothing to haggle over.',
          lesson: 'Clean books and signed contracts are worth a fortune at the closing table.'
        },
        {
          id: 'patch_flags', label: 'Fix only the items the buyer flags', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -15000 },
            { op: 'add', path: 'depts.finance.health', value: 8 }
          ],
          outcome: 'You patched what they found. They kept finding more, and every surprise shaved a little off the price.',
          lesson: 'Fixing problems after a buyer finds them costs you twice.'
        },
        {
          id: 'dress_it_up', label: 'Dress it up and hope they don\'t look too hard', quality: 'trap',
          effects: [
            { op: 'add', path: 'depts.finance.health', value: -15 },
            { op: 'mod', stat: 'salaryCost', mult: 1.007 },
            { op: 'add', path: 'team.morale', value: -5 },
            { op: 'flag', name: 'dressedUpBooks', value: true }
          ],
          outcome: 'Buyers always look hard. The gaps came out in week two, trust broke and the waste you never fixed kept leaking.',
          lesson: 'Buyers always look. Surprises kill deals or crush the price.'
        }
      ],
      notebook: 'the_summit'
    }
  ]);

  ZTE.Content.events = (ZTE.Content.events || []).concat([
    {
      id: 'ev_b_ghost_subscriptions', emoji: '🧾',
      cond: { all: [{ minLevel: 7 }] },
      chancePerDay: 0.015, once: true,
      text: 'Someone finally checked the software bills: $30k a year in tools nobody uses. Cancelled!',
      effects: [
        { op: 'add', path: 'cash', value: 30000 },
        { op: 'add', path: 'ops.efficiency', value: 1 }
      ]
    },
    {
      id: 'ev_b_manager_quits', emoji: '🚪',
      cond: { all: [{ minLevel: 7 }, { path: 'team.morale', lte: 62 }] },
      chancePerDay: 0.04, once: true,
      text: 'One of your best managers quit. Exit note: "Too many meetings, too little trust." Morale took a hit.',
      effects: [
        { op: 'add', path: 'team.morale', value: -5 },
        { op: 'buff', stat: 'teamOutput', mult: 0.93, days: 14, label: 'Manager gone' },
        { op: 'add', path: 'depts.people.health', value: -5 }
      ]
    },
    {
      id: 'ev_b_press_feature', emoji: '📰',
      cond: { all: [{ minLevel: 8 }] },
      chancePerDay: 0.012, once: true,
      text: 'A big business magazine featured your company! Leads and job applications flooded in.',
      effects: [
        { op: 'add', path: 'leads', value: 100 },
        { op: 'add', path: 'depts.people.health', value: 5 },
        { op: 'buff', stat: 'contentReach', mult: 1.3, days: 10, label: 'In the news' }
      ]
    },
    {
      id: 'ev_b_phishing_scare', emoji: '🎣',
      cond: { all: [{ minLevel: 8 }, { any: [{ path: 'depts.tech.health', lte: 68 }, { flag: 'dataLater' }] }] },
      chancePerDay: 0.03, once: true,
      text: 'A fake invoice email fooled someone in accounts. Caught in time, but two days of lockdown and password resets.',
      effects: [
        { op: 'add', path: 'depts.tech.health', value: -8 },
        { op: 'add', path: 'ops.efficiency', value: -2 },
        { op: 'buff', stat: 'teamOutput', mult: 0.95, days: 3, label: 'Security lockdown' }
      ]
    },
    {
      id: 'ev_b_poached_reps', emoji: '🦊',
      cond: { all: [{ minLevel: 9 }] },
      chancePerDay: 0.015, once: true,
      text: 'A rival poached two of your top sales reps with fat signing bonuses. The team will recover, but it stings.',
      effects: [
        { op: 'buff', stat: 'closeRate', mult: 0.92, days: 14, label: 'Reps poached' },
        { op: 'add', path: 'team.morale', value: -3 },
        { op: 'add', path: 'depts.sales.health', value: -4 }
      ]
    },
    {
      id: 'ev_b_buyer_knocks', emoji: '🏔️',
      cond: { all: [{ minLevel: 10 }] },
      chancePerDay: 0.02, once: true,
      text: 'An investment banker called: three buyers want a peek at your company. The Summit is in sight!',
      effects: [
        { op: 'add', path: 'depts.finance.health', value: 4 },
        { op: 'coach', text: 'Buyers are circling. Clean books, repeat revenue and a team that runs without you all push your price up.' }
      ]
    }
  ]);
})(typeof globalThis !== 'undefined' ? globalThis : this);
