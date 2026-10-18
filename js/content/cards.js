/*
 * Zero to Exit - content/cards.js
 * Choice cards (6 per level, levels 1-3) and random events (toasts, no choice).
 * Owns: ZTE.Content.cards, ZTE.Content.events  (spec section 5.6)
 *
 * Conventions used here:
 * - Level 1 cards gate on { level: 1 } because they only make sense while the
 *   offer is free. Level 2 and 3 cards gate on { minLevel: N } so a fast player
 *   who graduates early can still meet them later (the lessons stay relevant).
 * - Effects use only the ops in 5.2, the paths in 5.3 and the mods keys in 4.
 * - Flags set here (read only by the events below, free for others to read):
 *   personalOutreach, setExpectations, grinding, askedForProof, skippedAsk,
 *   grindFirst, triedDiscount, addedBonus, noGuarantee, niched, boughtBigList,
 *   adsTracked, lifetimeDeal, pausedScaling.
 * - The "best" option usually costs cash, energy (burnout) or a short slump now
 *   and adds a permanent mod; the "trap" usually gives a short buff or cash now
 *   and a permanent penalty.
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  // SPEC-GAP: the spec does not say whether metrics.closeRate is a fraction
  // (0.30) or a percent (30). This condition is true at "30% or more" in either
  // scale: fraction values pass the first branch, percent values the second.
  function rateAtLeast(path, frac) {
    return {
      any: [
        { all: [{ path: path, gte: frac }, { path: path, lte: 1 }] },
        { path: path, gte: frac * 100 }
      ]
    };
  }

  // SPEC-GAP: path conditions with `eq` are used on booleans
  // (channels.<id>.unlocked) and strings (offer.guarantee); this assumes the
  // engine compares with strict equality.

  ZTE.Content.cards = [
    /* ------------------------------------------------------------------ */
    /* LEVEL 1 - GARAGE (nobody knows you, everything is free)            */
    /* ------------------------------------------------------------------ */
    {
      id: 'who_to_tell_first', level: 1, emoji: '📱', title: 'Who hears first?',
      trigger: { all: [{ level: 1 }] },
      priority: 10,
      text: 'Your idea is ready and your phone is packed with contacts. Time to tell people. How do you start?',
      ghostDays: 60,
      options: [
        {
          id: 'personal_ask', label: 'Send personal notes and ask "who do you know?"', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 5 },
            { op: 'mod', stat: 'warmReply', mult: 1.15 },
            { op: 'mod', stat: 'referralRate', mult: 1.15 },
            { op: 'add', path: 'network.size', value: 6 },
            { op: 'add', path: 'network.available', value: 6 },
            { op: 'flag', name: 'personalOutreach', value: true }
          ],
          outcome: 'Slower to write and a bit awkward, but people actually wrote back. Two even sent names of friends who need help.',
          lesson: 'Start with people who know you, and ask who they know. No pitch needed.'
        },
        {
          id: 'group_post', label: 'Post one big announcement on my page', quality: 'ok',
          effects: [
            { op: 'add', path: 'leads', value: 1 },
            { op: 'mod', stat: 'warmReply', mult: 0.92 }
          ],
          outcome: 'A few likes and one curious friend. Easy to post, easy to scroll past.',
          lesson: 'A post is a whisper. A personal message is a tap on the shoulder.'
        },
        {
          id: 'hide_from_friends', label: "Skip friends. I'll find strangers so nobody sees me flop", quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -150 },
            { op: 'buff', stat: 'warmReply', mult: 0.7, days: 7, label: 'Hiding from friends' },
            { op: 'mod', stat: 'warmReply', mult: 0.95 }
          ],
          outcome: 'You paid $150 for a forum promo and spent a week pitching people who had never heard of you. Crickets.',
          lesson: 'Strangers are the hardest yes. Friends are the easiest place to practice.'
        }
      ],
      notebook: 'warm_outreach'
    },

    {
      id: 'free_with_strings', level: 1, emoji: '🎁', title: 'Free... but how free?',
      trigger: { all: [{ level: 1 }, { path: 'stats.leadsTotal', gte: 1 }] },
      priority: 8,
      text: 'Your first interested friend says: "I\'d love to try it!" It\'s free while you\'re in the Garage. What do you ask for in return?',
      ghostDays: 60,
      options: [
        {
          id: 'feedback_and_review', label: 'Free if they use it, give feedback, and leave a review if it helped', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 3 },
            { op: 'mod', stat: 'testimonialChance', mult: 1.25 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.08 },
            { op: 'flag', name: 'setExpectations', value: true }
          ],
          outcome: 'A couple of people passed when they heard the deal. The ones who said yes showed up, did the work, and were happy to rave about it.',
          lesson: 'Free is the price. Feedback and an honest review are the deal.'
        },
        {
          id: 'no_strings', label: 'Totally free, no strings attached', quality: 'ok',
          effects: [
            { op: 'buff', stat: 'warmReply', mult: 1.1, days: 7, label: 'No-strings freebie' },
            { op: 'mod', stat: 'testimonialChance', mult: 0.85 }
          ],
          outcome: 'More people said yes. Fewer followed through, and reviews were rare because you never asked.',
          lesson: 'Free with no expectations gets you users, not proof.'
        },
        {
          id: 'small_fee', label: 'Charge a $50 "commitment fee" to see who\'s serious', quality: 'trap',
          effects: [
            { op: 'mod', stat: 'warmReply', mult: 0.88 },
            { op: 'mod', stat: 'testimonialChance', mult: 0.85 },
            { op: 'mod', stat: 'perceivedValue', mult: 0.98 }
          ],
          outcome: 'Two people paid, then asked for their money back when it wasn\'t polished yet. Everyone else went quiet.',
          lesson: 'While you\'re still learning, free buys you forgiveness, practice and reviews.'
        }
      ],
      notebook: 'start_free'
    },

    {
      id: 'perfect_message', level: 1, emoji: '✍️', title: 'The perfect message',
      trigger: { all: [{ level: 1 }, { minDay: 3 }] },
      priority: 6,
      text: 'You\'ve rewritten the same outreach message eleven times. It\'s... fine? Coach Flex taps his watch. 🦉',
      ghostDays: 60,
      options: [
        {
          id: 'send_100', label: 'Send 100 good-enough messages today, improve as replies come in', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 8 },
            { op: 'add', path: 'leads', value: 4 },
            { op: 'add', path: 'skills.hooks', value: 1 },
            { op: 'mod', stat: 'warmReply', mult: 1.1 },
            { op: 'flag', name: 'grinding', value: true }
          ],
          outcome: 'Some messages flopped, some landed. By message 60 you knew exactly which line made people reply. (+1 Hooks skill!)',
          lesson: 'Volume first, polish second. Real replies teach faster than drafts.'
        },
        {
          id: 'send_20', label: 'Send 20 careful ones a day', quality: 'ok',
          effects: [
            { op: 'buff', stat: 'warmReply', mult: 0.85, days: 7, label: 'Slow and careful' },
            { op: 'mod', stat: 'warmReply', mult: 1.02 }
          ],
          outcome: 'Lovely messages, slow learning. After a week you had sent 140, not even a day and a half of the big plan.',
          lesson: 'Careful is nice. Careful and slow is expensive.'
        },
        {
          id: 'polish_more', label: 'Polish it a few more days until it\'s perfect', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'warmReply', mult: 0.6, days: 10, label: 'Still polishing...' }
          ],
          outcome: 'The message got 2% prettier. Your inbox stayed empty all week.',
          lesson: 'Perfect is a hiding spot. Hit send and let real people edit you.'
        }
      ],
      notebook: 'volume_then_quality'
    },

    {
      id: 'ask_for_testimonial', level: 1, emoji: '⭐', title: 'They loved it!',
      trigger: { all: [{ level: 1 }, { path: 'stats.trialsCompleted', gte: 1 }] },
      priority: 9,
      text: 'Your first trial just wrapped up and they texted: "This was amazing, thank you!!" What\'s your reply?',
      ghostDays: 60,
      options: [
        {
          id: 'ask_video', label: 'Ask for a 30-second video and "who else should try this?"', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 2 },
            { op: 'add', path: 'reputation.testimonials', value: 1 },
            { op: 'mod', stat: 'testimonialChance', mult: 1.15 },
            { op: 'mod', stat: 'referralRate', mult: 1.2 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.03 },
            { op: 'mod', stat: 'closeRate', mult: 1.03 },
            { op: 'add', path: 'network.size', value: 10 },
            { op: 'add', path: 'network.available', value: 10 },
            { op: 'flag', name: 'askedForProof', value: true }
          ],
          outcome: 'They filmed it in one take and named two friends. Your first real proof!',
          lesson: 'Happy people want to help. Make it easy and ask while the win is fresh.'
        },
        {
          id: 'ask_later', label: 'Plan to email a review request next month', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'testimonialChance', mult: 1.03 }
          ],
          outcome: 'By next month the excitement had cooled. You got a short, polite review... eventually.',
          lesson: 'Proof goes stale fast. Ask at the moment of the win.'
        },
        {
          id: 'just_thanks', label: 'Just say thanks. Asking feels pushy', quality: 'trap',
          effects: [
            { op: 'mod', stat: 'testimonialChance', mult: 0.85 },
            { op: 'flag', name: 'skippedAsk', value: true }
          ],
          outcome: 'They felt great. Nobody else ever heard about it.',
          lesson: 'Free work without an ask is a favor, not a step forward.'
        }
      ],
      notebook: 'testimonials'
    },

    {
      id: 'nobody_bites', level: 1, emoji: '🤔', title: 'Why the "maybe later"?',
      trigger: {
        all: [
          { maxLevel: 2 },   // Level 1 can be short; allow early Level 2 so the lesson isn't missed
          { path: 'stats.outreachTotal', gte: 30 },
          { any: [{ path: 'stats.trialsStarted', lt: 3 }, { minDay: 8 }] }
        ]
      },
      priority: 5,
      text: 'Some friends said "maybe later." One was honest: "Sounds like a lot of work, and I\'m not sure it would work for me." Hmm.',
      ghostDays: 60,
      options: [
        {
          id: 'ask_why', label: 'Ask every "no" what would make it worth it, then fix that', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 4 },
            { op: 'add', path: 'offer.likelihood', value: 1 },
            { op: 'add', path: 'offer.ease', value: 1 },
            { op: 'mod', stat: 'warmReply', mult: 1.04 }
          ],
          outcome: 'The answers stung but were gold: people doubted it would work for them and it looked like a hassle. You added a simple step-by-step plan and weekly check-ins.',
          lesson: 'If free still gets a no, the hidden costs (doubt, effort, waiting) are too high.'
        },
        {
          id: 'add_more', label: 'Add more stuff: extra calls, extra videos, a bigger plan', quality: 'ok',
          effects: [
            { op: 'add', path: 'offer.dream', value: 1 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.08 }
          ],
          outcome: 'It looks bigger now. It also feels like more work, for them and for you.',
          lesson: 'More stuff isn\'t more value if it also means more effort.'
        },
        {
          id: 'wrong_friends', label: 'Decide your friends just aren\'t the right market', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'warmReply', mult: 0.8, days: 7, label: 'Sulking' },
            { op: 'mod', stat: 'warmReply', mult: 0.9 }
          ],
          outcome: 'You stopped asking, so you stopped learning. The same doubt was waiting for the next person.',
          lesson: 'Every "no" is free research. Don\'t waste it by blaming the people.'
        }
      ],
      notebook: 'value_meter'
    },

    {
      id: 'fancy_website', level: 1, emoji: '🖥️', title: 'The $600 website',
      trigger: { all: [{ maxLevel: 2 }, { minDay: 5 }, { chance: 0.5 }] },   // may spill into early Level 2
      priority: 4,
      text: 'A designer friend says: "Nobody takes you seriously without a real website. I\'ll build one for $600: logo, colors, the works."',
      ghostDays: 60,
      options: [
        {
          id: 'keep_grinding', label: 'Not yet. Use free tools and keep doing 100 reach-outs a day', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 4 },
            { op: 'add', path: 'leads', value: 3 },
            { op: 'mod', stat: 'warmReply', mult: 1.08 },
            { op: 'mod', stat: 'coldReply', mult: 1.08 },
            { op: 'flag', name: 'grindFirst', value: true }
          ],
          outcome: 'No logo, no fonts. Just you, your phone and a daily habit. The replies kept coming.',
          lesson: 'Early customers come from conversations, not decorations.'
        },
        {
          id: 'one_pager', label: 'Make a free one-page site in an afternoon', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 2 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.01 }
          ],
          outcome: 'Simple, clear, done by dinner. A couple of friends said it helped them get what you do.',
          lesson: 'Good enough wins when it takes an afternoon, not a month.'
        },
        {
          id: 'buy_site', label: 'Do it! Real businesses need real websites', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -600 },
            { op: 'buff', stat: 'warmReply', mult: 0.75, days: 7, label: 'Picking fonts' },
            { op: 'mod', stat: 'perceivedValue', mult: 1.02 }
          ],
          outcome: 'It\'s gorgeous. You spent a week picking fonts instead of messaging people, and nobody visited.',
          lesson: 'Spending money to feel legit is not the same as getting customers.'
        }
      ],
      notebook: 'daily_grind'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 2 - HUSTLE (you make no money yet: start charging)           */
    /* ------------------------------------------------------------------ */
    {
      id: 'too_expensive', level: 2, emoji: '🏷️', title: 'The price objection',
      trigger: {
        all: [{ minLevel: 2 }, { path: 'offer.price', gt: 0 }, { path: 'stats.callsTotal', gte: 5 }]
      },
      priority: 9,
      text: 'Mid-call, a prospect who clearly needs this says: "I love it... but it\'s too expensive." They\'re waiting for your answer.',
      ghostDays: 60,
      options: [
        {
          id: 'discount', label: 'Knock 30% off to close the deal', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.12, days: 7, label: 'Discount spree' },
            { op: 'mod', stat: 'perceivedValue', mult: 0.92 },
            { op: 'mod', stat: 'refundRate', mult: 1.12 },
            { op: 'flag', name: 'triedDiscount', value: true }
          ],
          outcome: 'They said yes! Then asked for extras, paid late, and told a friend you "do deals."',
          lesson: 'Cutting price on the spot teaches people to haggle and makes your offer feel cheap.'
        },
        {
          id: 'add_bonus', label: 'Keep the price, add a bonus that solves their biggest worry', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -100 },
            { op: 'add', path: 'offer.ease', value: 1 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.08 },
            { op: 'flag', name: 'addedBonus', value: true }
          ],
          outcome: 'You built a done-for-you starter kit. It cost a weekend and $100, and now "too expensive" comes up way less.',
          lesson: '"Too expensive" usually means "not worth it yet." Raise the value, not the discount.'
        },
        {
          id: 'let_go', label: 'Say "no worries" and let them go', quality: 'ok',
          effects: [
            { op: 'coach', text: 'Next time, ask what feels expensive about it. Their answer is your homework.' }
          ],
          outcome: 'No sale, but no damage either. You kept your price and your pride.',
          lesson: 'Holding your price is good. Finding out why they hesitated is better.'
        }
      ],
      notebook: 'bonuses'
    },

    {
      id: 'pick_a_guarantee', level: 2, emoji: '🛡️', title: 'What if it doesn\'t work?',
      trigger: {
        // Not gated on offer.guarantee === 'none': the free Do-the-Work upgrade is
        // often bought before the first sale. Every option sets the guarantee, so
        // it is safe to show whatever is already in place.
        all: [{ minLevel: 2 }, { path: 'stats.salesCount', gte: 1 }, { notUpgrade: 'guarantee_unconditional' }]
      },
      priority: 7,
      text: 'Prospects keep asking the same thing: "What if it doesn\'t work for me?" Time to decide who carries the risk.',
      ghostDays: 60,
      options: [
        {
          id: 'conditional', label: 'Do the steps and get the result, or I keep helping free until you do', quality: 'best',
          effects: [
            { op: 'set', path: 'offer.guarantee', value: 'conditional' },
            { op: 'add', path: 'offer.likelihood', value: 1 },
            { op: 'mod', stat: 'closeRate', mult: 1.03 },
            { op: 'mod', stat: 'churn', mult: 0.95 },
            { op: 'mod', stat: 'refundRate', mult: 0.9 }
          ],
          outcome: 'Buyers relaxed, and the promise nudged them to actually do the steps. Hardly anyone needed it.',
          lesson: 'A guarantee tied to the key actions sells more and gets better results.'
        },
        {
          id: 'unconditional', label: 'Full refund, no questions asked', quality: 'ok',
          effects: [
            { op: 'set', path: 'offer.guarantee', value: 'unconditional' },
            { op: 'mod', stat: 'refundRate', mult: 1.15 }
          ],
          outcome: 'More yeses and a few more refunds. The math still worked, but some buyers never even started.',
          lesson: 'A no-strings refund boosts sales but invites people who won\'t do the work.'
        },
        {
          id: 'no_guarantee', label: 'No guarantee. I don\'t want to deal with refunds', quality: 'trap',
          effects: [
            { op: 'set', path: 'offer.guarantee', value: 'none' },
            { op: 'mod', stat: 'closeRate', mult: 0.95 },
            { op: 'flag', name: 'noGuarantee', value: true }
          ],
          outcome: 'Zero refunds... and fewer sales. Every buyer had to carry the whole risk alone.',
          lesson: 'If you won\'t bet on your offer, why should they?'
        }
      ],
      notebook: 'guarantees'
    },

    {
      id: 'who_is_it_for', level: 2, emoji: '🎯', title: 'Who is this for?',
      trigger: { all: [{ minLevel: 2 }, { path: 'channels.cold.unlocked', eq: true }] },
      priority: 7,
      text: 'Cold outreach is open! A list seller offers 10,000 "people who might be interested" for $99. Or you could build a smaller list of one exact type of customer.',
      ghostDays: 60,
      options: [
        {
          id: 'one_niche', label: 'Build a list of one exact customer with one painful problem', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -80 },
            { op: 'add', path: 'burnout', value: 5 },
            { op: 'mod', stat: 'coldReply', mult: 1.2 },
            { op: 'mod', stat: 'closeRate', mult: 1.05 },
            { op: 'flag', name: 'niched', value: true }
          ],
          outcome: 'Only 400 names, but every message spoke their language. Replies jumped and calls felt easy.',
          lesson: 'Talk to everyone and nobody feels talked to. Pick a lane.'
        },
        {
          id: 'a_few_types', label: 'Mix two or three types of customer to play it safe', quality: 'ok',
          effects: [
            { op: 'add', path: 'cash', value: -80 },
            { op: 'mod', stat: 'coldReply', mult: 1.06 }
          ],
          outcome: 'Decent replies, but your messages had to stay vague to fit everyone.',
          lesson: 'Hedging feels safe, but it waters down your message.'
        },
        {
          id: 'big_list', label: 'Buy the 10,000 names. More shots on goal!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -99 },
            { op: 'add', path: 'leads', value: 4 },
            { op: 'mod', stat: 'coldReply', mult: 0.88 },
            { op: 'flag', name: 'boughtBigList', value: true }
          ],
          outcome: 'A few quick replies, then a flood of "who is this?" and spam reports.',
          lesson: 'A cheap list gets expensive when nobody on it needs you.'
        }
      ],
      notebook: 'niche'
    },

    {
      id: 'no_shows', level: 2, emoji: '👻', title: 'Ghosted again',
      trigger: {
        all: [
          { minLevel: 2 },
          { path: 'stats.callsTotal', gte: 12 },
          { path: 'stats.salesCount', gte: 1 },
          { path: 'metrics.showRate', lt: 0.7 },   // only while no-shows are a real problem
          { chance: 0.5 }
        ]
      },
      priority: 6,
      text: 'Three people booked calls today. One showed up. You stared at an empty video room for half an hour.',
      ghostDays: 60,
      options: [
        {
          id: 'reminders', label: 'Set up reminders: confirm right away, then the day before and an hour before', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -40 },
            { op: 'mod', stat: 'showRate', mult: 1.15 },
            { op: 'mod', stat: 'bookRate', mult: 1.04 }
          ],
          outcome: 'A $40 scheduling tool and a few friendly texts later, the empty chairs started filling up.',
          lesson: 'People forget, they don\'t hate you. Reminders turn bookings into shows.'
        },
        {
          id: 'book_sooner', label: 'Only offer slots today or tomorrow', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'showRate', mult: 1.05 },
            { op: 'mod', stat: 'bookRate', mult: 0.95 }
          ],
          outcome: 'Fewer people found a time that worked, but the ones who booked mostly showed.',
          lesson: 'The sooner the call, the warmer the lead.'
        },
        {
          id: 'double_book', label: 'Double-book every slot so no-shows don\'t matter', quality: 'trap',
          effects: [
            { op: 'add', path: 'burnout', value: 8 },
            { op: 'mod', stat: 'closeRate', mult: 0.92 }
          ],
          outcome: 'Then everyone showed up at once. Rushed calls, a rattled you, fewer sales.',
          lesson: 'Fix the leak. Don\'t just flood the bucket.'
        }
      ],
      notebook: 'show_rate'
    },

    {
      id: 'gone_quiet', level: 2, emoji: '📵', title: 'The pile of maybes',
      trigger: { all: [{ minLevel: 2 }, { path: 'stats.revenueTotal', gte: 1000 }] },
      priority: 6,
      text: 'A dozen people said "Sounds interesting!" last week, then went silent. Your list of maybes keeps growing.',
      ghostDays: 60,
      options: [
        {
          id: 'follow_up', label: 'Reach out fast and often: call, text, and try again all week', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 6 },
            { op: 'add', path: 'leads', value: 3 },
            { op: 'mod', stat: 'leadDecay', mult: 0.8 },
            { op: 'mod', stat: 'bookRate', mult: 1.1 }
          ],
          outcome: 'Most weren\'t saying no, they were just busy. Four booked calls after the third or fourth try.',
          lesson: 'Most yeses hide behind the follow-ups other people never send.'
        },
        {
          id: 'one_nudge', label: 'Send one polite "just checking in" email', quality: 'ok',
          effects: [
            { op: 'add', path: 'leads', value: 1 },
            { op: 'mod', stat: 'leadDecay', mult: 0.95 }
          ],
          outcome: 'One person replied. The rest sank further down their inbox.',
          lesson: 'One try is a coin flip. Several tries is a system.'
        },
        {
          id: 'move_on', label: 'Move on. If they wanted it, they\'d reply', quality: 'trap',
          effects: [
            { op: 'mod', stat: 'leadDecay', mult: 1.12 },
            { op: 'mod', stat: 'bookRate', mult: 0.95 }
          ],
          outcome: 'You spent the week chasing brand-new leads while the warm ones went cold.',
          lesson: 'They raised their hand once. Reaching out again isn\'t pushy, it\'s service.'
        }
      ],
      notebook: 'speed_to_lead'
    },

    {
      id: 'raise_the_price', level: 2, emoji: '📈', title: 'Booked solid',
      trigger: {
        all: [
          { minLevel: 2 },
          { path: 'offer.price', gt: 0 },
          { path: 'stats.revenueTotal', gte: 2000 },
          { any: [rateAtLeast('metrics.closeRate', 0.3), { path: 'stats.salesCount', gte: 8 }] }
        ]
      },
      priority: 5,
      text: 'Sales are rolling in and your calendar is filling up. Two clients even told you: "Honestly, I\'d have paid more."',
      ghostDays: 60,
      options: [
        {
          id: 'raise_20', label: 'Raise the price 20% for new customers', quality: 'best',
          effects: [
            { op: 'mul', path: 'offer.price', value: 1.2 },
            { op: 'mod', stat: 'perceivedValue', mult: 1.05 },
            { op: 'mod', stat: 'refundRate', mult: 0.92 }
          ],
          outcome: 'A few more people said "let me think about it." But you earn more per client, and the new ones take it more seriously.',
          lesson: 'When buyers say they\'d pay more, test a higher price and keep it if total money goes up.'
        },
        {
          id: 'keep_price', label: 'Keep it. Don\'t rock the boat', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 6 }
          ],
          outcome: 'Same price, same packed calendar, same tired you.',
          lesson: 'Busy and underpaid is a choice you can change.'
        },
        {
          id: 'flash_sale', label: 'Run a 25%-off sale to lock in next month', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.2, days: 10, label: 'Flash sale' },
            { op: 'mod', stat: 'perceivedValue', mult: 0.92 },
            { op: 'mod', stat: 'churn', mult: 1.08 }
          ],
          outcome: 'A rush of bargain hunters: your most demanding clients ever, for the least money.',
          lesson: 'In a race to the cheapest price, the winner goes broke first.'
        }
      ],
      notebook: 'pricing_up'
    },

    /* ------------------------------------------------------------------ */
    /* LEVEL 3 - MEGAPHONE (new customers come in unevenly)               */
    /* ------------------------------------------------------------------ */
    {
      id: 'ads_too_soon', level: 3, emoji: '📣', title: 'Ads are unlocked!',
      trigger: { all: [{ minLevel: 3 }, { path: 'channels.ads.unlocked', eq: true }] },
      priority: 8,
      text: 'An online guru says: "Just throw $800 at ads this week and figure it out as you go!" Right now, only some of your calls turn into sales.',
      ghostDays: 60,
      options: [
        {
          id: 'tighten_then_test', label: 'Tighten the offer first, then test small and track every dollar', quality: 'best',
          effects: [
            { op: 'add', path: 'cash', value: -50 },
            { op: 'add', path: 'offer.likelihood', value: 1 },
            { op: 'mod', stat: 'adCpl', mult: 0.9 },
            { op: 'mod', stat: 'closeRate', mult: 1.03 },
            { op: 'flag', name: 'adsTracked', value: true }
          ],
          outcome: 'You added proof to the offer and ran a tiny tracked test. One ad worked, and you shut off the losers early.',
          lesson: 'Ads pour fuel on your offer. Make sure it\'s a fire, not a puddle.'
        },
        {
          id: 'no_ads', label: 'Skip ads for now and stick to the free megaphones', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'contentReach', mult: 1.03 }
          ],
          outcome: 'No ad bill, steady nerves. Growth stayed slow but safe.',
          lesson: 'Free channels are slower, but a fine place to sharpen your offer.'
        },
        {
          id: 'spend_800', label: 'Go big: $800 this week!', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -800 },
            { op: 'add', path: 'leads', value: 5 },
            { op: 'mod', stat: 'adCpl', mult: 1.1 }
          ],
          outcome: 'Lots of clicks, a few calls, maybe one sale. No tracking, so you have no idea which ad did it.',
          lesson: 'Spending before you track is just gambling with extra steps.'
        }
      ],
      notebook: 'paid_ads'
    },

    {
      id: 'ads_payback', level: 3, emoji: '🧮', title: 'The 30-day test',
      trigger: { all: [{ minLevel: 3 }, { path: 'stats.adSpendTotal', gte: 300 }] },
      priority: 7,
      text: 'Ads are bringing in customers! Coach Flex points at your Numbers tab: "What does a new customer cost you, and what do they pay you in their first 30 days? If month one beats the cost, you can grow fast. Just grow smart."',
      ghostDays: 60,
      options: [
        {
          id: 'pay_back_fast', label: 'Raise the budget in steps, and add a quick upsell so month one pays for even more ads', quality: 'best',
          effects: [
            { op: 'unlock', what: 'combo:upsell' },
            { op: 'unlock', what: 'combo:downsell' },
            { op: 'mod', stat: 'upsellTake', mult: 1.3 },
            { op: 'mod', stat: 'downsellTake', mult: 1.1 },
            { op: 'coach', text: 'Switch on Upsell and Downsell in Growth, then watch CAC vs 30-day cash.' }
          ],
          outcome: 'You stepped the budget up and checked the numbers each time. The upsell made month one even fatter, so your ads started paying for more ads.',
          lesson: 'When month-one cash beats what a customer costs, spend more, one step at a time, and keep checking.'
        },
        {
          id: 'hold_steady', label: 'Keep the budget flat and watch the numbers', quality: 'ok',
          effects: [
            { op: 'flag', name: 'pausedScaling', value: true },
            { op: 'coach', text: 'Good habit. Now find a way to collect more in month one.' }
          ],
          outcome: 'Nothing broke, nothing grew much. Your ads were paying you back, and you left that growth on the table.',
          lesson: 'Measuring is step one. Once the numbers say yes, act on them.'
        },
        {
          id: 'pour_more', label: 'Dump $600 into one big ad blast today and skip the tracking', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: -600 },
            { op: 'add', path: 'leads', value: 5 },
            { op: 'mod', stat: 'adCpl', mult: 1.06 }
          ],
          outcome: 'A burst of clicks, a handful of leads, and no clue which ad worked. The same people saw it ten times, so every lead after cost more.',
          lesson: 'Scale what you can measure. Big jumps you can\'t track just burn cash.'
        }
      ],
      notebook: 'client_financed'
    },

    {
      id: 'hook_offer', level: 3, emoji: '🪝', title: 'Just a taste?',
      trigger: { all: [{ minLevel: 3 }, { chance: 0.2 }] },
      priority: 6,
      text: 'Lots of leads say: "I\'m interested, but can I try a little first?" You could sell a small starter that leads into your main offer.',
      ghostDays: 60,
      options: [
        {
          id: 'paid_starter', label: 'Sell a $47 quick-win starter that leads into the full offer', quality: 'best',
          effects: [
            { op: 'unlock', what: 'combo:hook' },
            { op: 'set', path: 'combos.hook.price', value: 47 },
            { op: 'mod', stat: 'bookRate', mult: 1.08 },
            { op: 'mod', stat: 'adCpl', mult: 0.93 },
            { op: 'coach', text: 'Flip on the Hook Offer in Growth when you\'re ready.' }
          ],
          outcome: 'Small yeses turned into big yeses, and the starter money helped pay for your ads.',
          lesson: 'An easy first yes makes the big yes feel natural.'
        },
        {
          id: 'free_starter', label: 'Give a starter away free to anyone', quality: 'ok',
          effects: [
            { op: 'unlock', what: 'combo:hook' },
            { op: 'set', path: 'combos.hook.price', value: 0 },
            { op: 'mod', stat: 'bookRate', mult: 1.08 },
            { op: 'mod', stat: 'showRate', mult: 0.93 }
          ],
          outcome: 'Tons of sign-ups. Plenty were freebie collectors who never showed up.',
          lesson: 'Free grabs attention. A small price grabs commitment.'
        },
        {
          id: 'discount_main', label: 'Just discount the main offer 40% for first-timers', quality: 'trap',
          effects: [
            { op: 'buff', stat: 'closeRate', mult: 1.2, days: 10, label: 'First-timer discount' },
            { op: 'mod', stat: 'perceivedValue', mult: 0.9 },
            { op: 'mod', stat: 'refundRate', mult: 1.1 }
          ],
          outcome: 'Sales spiked for a week. Then people started waiting for the next discount.',
          lesson: 'A hook should open the door, not knock down your price.'
        }
      ],
      notebook: 'hook_offer'
    },

    {
      id: 'keep_working_together', level: 3, emoji: '🔁', title: 'Can we keep going?',
      trigger: { all: [{ minLevel: 3 }, { path: 'stats.salesCount', gte: 12 }] },
      priority: 6,
      text: 'Clients finishing your program keep asking: "Can I keep working with you after this?"',
      ghostDays: 90,
      options: [
        {
          id: 'monthly_membership', label: 'Offer a monthly membership with perks for staying', quality: 'best',
          effects: [
            { op: 'add', path: 'burnout', value: 5 },
            { op: 'add', path: 'cash', value: 200 },
            { op: 'unlock', what: 'combo:membership' },
            { op: 'mod', stat: 'churn', mult: 0.9 },
            { op: 'mod', stat: 'referralRate', mult: 1.05 },
            { op: 'coach', text: 'Turn on Membership in Growth. Recurring cash is the comfiest cash.' }
          ],
          outcome: 'Setting it up ate a weekend. A few clients joined on the spot, and now some income shows up every month before you lift a finger.',
          lesson: 'Once they love the result, make staying the easy, rewarding choice.'
        },
        {
          id: 'lifetime_deal', label: 'Sell lifetime access for one big payment', quality: 'trap',
          effects: [
            { op: 'add', path: 'cash', value: 500 },
            { op: 'mod', stat: 'deliveryEnergy', mult: 1.15 },
            { op: 'flag', name: 'lifetimeDeal', value: true }
          ],
          outcome: 'Cha-ching today! But "forever" is a long time to keep delivering for one payment.',
          lesson: 'Never promise forever for a one-time price.'
        },
        {
          id: 'say_goodbye', label: 'Wish them well. You\'re a one-time program', quality: 'ok',
          effects: [
            { op: 'mod', stat: 'referralRate', mult: 1.03 }
          ],
          outcome: 'They left happy and told a few friends. You\'ll need new customers to replace them, though.',
          lesson: 'Happy goodbyes are nice. Happy renewals pay the bills.'
        }
      ],
      notebook: 'membership'
    },

    {
      id: 'upsell_timing', level: 3, emoji: '⏰', title: 'Perfect timing',
      trigger: { all: [{ minLevel: 3 }, { path: 'stats.salesCount', gte: 8 }, { chance: 0.25 }] },
      priority: 5,
      text: 'Clients keep hitting the same next problem right after they start. You built an add-on that solves it. When do you offer it?',
      ghostDays: 60,
      options: [
        {
          id: 'right_when_needed', label: 'Right after they buy, the moment that next problem shows up', quality: 'best',
          effects: [
            { op: 'unlock', what: 'combo:upsell' },
            { op: 'mod', stat: 'upsellTake', mult: 1.2 },
            { op: 'mod', stat: 'churn', mult: 0.96 },
            { op: 'coach', text: 'Switch on the Upsell in Growth to start collecting.' }
          ],
          outcome: 'Offered at the perfect moment, it felt like help, not a pitch. Lots of clients said yes on the spot.',
          lesson: 'The best upsell solves the problem your first offer just revealed.'
        },
        {
          id: 'later_newsletter', label: 'Mention it in a newsletter in a few months', quality: 'ok',
          effects: [
            { op: 'unlock', what: 'combo:upsell' },
            { op: 'mod', stat: 'upsellTake', mult: 0.9 }
          ],
          outcome: 'By then most clients had found a workaround. A few bought.',
          lesson: 'Timing is half the offer.'
        },
        {
          id: 'bundle_first_call', label: 'Pitch everything together on the first call', quality: 'trap',
          effects: [
            { op: 'mod', stat: 'closeRate', mult: 0.92 },
            { op: 'mod', stat: 'upsellTake', mult: 0.9 }
          ],
          outcome: 'Too much, too soon. People felt overwhelmed and said "let me think about it."',
          lesson: 'Offer the next thing after they feel the need, not before.'
        }
      ],
      notebook: 'upsell'
    },

    {
      id: 'all_four_megaphones', level: 3, emoji: '🔊', title: 'Be everywhere?',
      trigger: { all: [{ minLevel: 3 }, { path: 'channels.content.unlocked', eq: true }, { chance: 0.25 }] },
      priority: 5,
      text: 'Your founder group chat is buzzing: "You need to be on every platform! Post daily, cold call, run ads, all at once!"',
      ghostDays: 60,
      options: [
        {
          id: 'double_down', label: 'Max out what already works, then add one new megaphone at a time', quality: 'best',
          effects: [
            { op: 'buff', stat: 'contentReach', mult: 0.85, days: 7, label: 'Content on hold' },
            { op: 'mod', stat: 'coldReply', mult: 1.12 },
            { op: 'mod', stat: 'warmReply', mult: 1.05 },
            { op: 'mod', stat: 'closeRate', mult: 1.04 }
          ],
          outcome: 'Boring? A little. But going all-in on your best channel made it way better, and leads stopped showing up in random bursts.',
          lesson: 'Master one megaphone before you juggle four.'
        },
        {
          id: 'add_one', label: 'Add one new megaphone now, keep the rest steady', quality: 'ok',
          effects: [
            { op: 'add', path: 'burnout', value: 6 },
            { op: 'mod', stat: 'contentReach', mult: 1.05 }
          ],
          outcome: 'The new channel took real effort to learn, but it started paying off by the end of the month.',
          lesson: 'Add something new once the old thing runs without babysitting.'
        },
        {
          id: 'everywhere', label: 'Go everywhere at once. More megaphones, more leads!', quality: 'trap',
          effects: [
            { op: 'add', path: 'burnout', value: 15 },
            { op: 'buff', stat: 'contentReach', mult: 1.2, days: 7, label: 'New-channel buzz' },
            { op: 'mod', stat: 'contentReach', mult: 0.92 },
            { op: 'mod', stat: 'coldReply', mult: 0.92 }
          ],
          outcome: 'Week one felt amazing. By week three every channel was half-done and you were running on fumes.',
          lesson: 'Spread too thin, and every channel gets your worst.'
        }
      ],
      notebook: 'constraint'
    }
  ];

  /* -------------------------------------------------------------------- */
  /* RANDOM EVENTS (no choice; shown as a toast)                          */
  /* `text` is the toast; effects do not repeat it as a log line.         */
  /* -------------------------------------------------------------------- */
  ZTE.Content.events = [
    {
      id: 'friend_spreads_word', emoji: '🗣️',
      cond: { all: [{ minDay: 3 }, { maxLevel: 2 }] },
      chancePerDay: 0.04, once: true,
      text: 'Your old roommate heard what you\'re building and told her whole office about you!',
      effects: [
        { op: 'add', path: 'network.size', value: 15 },
        { op: 'add', path: 'network.available', value: 15 },
        { op: 'add', path: 'leads', value: 2 }
      ]
    },
    {
      // Repeatable on purpose: referrals keep trickling in once people are happy.
      id: 'happy_referral', emoji: '🤝',
      cond: { any: [{ path: 'stats.trialsCompleted', gte: 1 }, { path: 'stats.salesCount', gte: 2 }] },
      chancePerDay: 0.02, once: false,
      text: 'A happy client sent a friend your way. Best kind of lead there is!',
      effects: [
        { op: 'add', path: 'leads', value: 2 }
      ]
    },
    {
      id: 'rainy_week', emoji: '🌧️',
      cond: { minDay: 4 },
      chancePerDay: 0.02, once: true,
      text: 'Rainy week! Everyone\'s stuck inside and actually answering their messages.',
      effects: [
        { op: 'buff', stat: 'warmReply', mult: 1.2, days: 7, label: 'Rainy week' }
      ]
    },
    {
      id: 'refund_request', emoji: '💸',
      cond: { all: [{ minLevel: 2 }, { path: 'stats.salesCount', gte: 3 }] },
      chancePerDay: 0.03, once: true,
      text: 'A client asked for their money back. You refunded $250 and asked what went wrong. Ouch, but useful.',
      effects: [
        { op: 'add', path: 'cash', value: -250 },
        { op: 'coach', text: 'Refunds sting. Ask why, then fix that part of the offer.' }
      ]
    },
    {
      id: 'surprise_case_study', emoji: '🏆',
      cond: { all: [{ minLevel: 2 }, { path: 'stats.salesCount', gte: 5 }] },
      chancePerDay: 0.03, once: true,
      text: 'A client got a huge result and offered to share their whole story. Instant case study!',
      effects: [
        { op: 'add', path: 'reputation.caseStudies', value: 1 }
      ]
    },
    {
      id: 'competitor_price_cut', emoji: '🪓',
      cond: { all: [{ minLevel: 2 }, { minDay: 20 }] },
      chancePerDay: 0.02, once: true,
      text: 'A competitor slashed their price in half. A few leads ask why you cost more.',
      effects: [
        { op: 'buff', stat: 'closeRate', mult: 0.9, days: 7, label: 'Price war nearby' },
        { op: 'coach', text: 'Don\'t race them down. Show what people get with you that they can\'t get there.' }
      ]
    },
    {
      id: 'algorithm_change', emoji: '🤖',
      cond: { all: [{ minLevel: 3 }, { path: 'audience', gte: 50 }] },
      chancePerDay: 0.03, once: true,
      text: 'The platform changed its algorithm overnight. Your posts reach fewer people this week.',
      effects: [
        { op: 'buff', stat: 'contentReach', mult: 0.7, days: 7, label: 'Algorithm change' }
      ]
    },
    {
      id: 'viral_post', emoji: '🚀',
      cond: { all: [{ minLevel: 3 }, { path: 'audience', gte: 100 }] },
      chancePerDay: 0.02, once: true,
      text: 'One of your posts went viral! New followers are pouring in.',
      effects: [
        { op: 'add', path: 'audience', value: 400 },
        { op: 'add', path: 'leads', value: 6 },
        { op: 'buff', stat: 'contentReach', mult: 1.3, days: 7, label: 'Viral momentum' }
      ]
    },
    {
      id: 'ad_account_hiccup', emoji: '⚠️',
      cond: { all: [{ minLevel: 3 }, { path: 'stats.adSpendTotal', gte: 200 }] },
      chancePerDay: 0.03, once: true,
      text: 'Your ad account got flagged for review. Ads still run, but leads cost more until it\'s sorted.',
      effects: [
        { op: 'buff', stat: 'adCpl', mult: 1.35, days: 7, label: 'Ad account review' }
      ]
    },
    {
      id: 'slow_summer_week', emoji: '🏖️',
      cond: { minDay: 30 },
      chancePerDay: 0.015, once: true,
      text: 'Summer slump! Half your leads are on vacation this week.',
      effects: [
        { op: 'buff', stat: 'warmReply', mult: 0.8, days: 7, label: 'Summer slump' },
        { op: 'buff', stat: 'coldReply', mult: 0.8, days: 7, label: 'Summer slump' },
        { op: 'buff', stat: 'bookRate', mult: 0.9, days: 7, label: 'Summer slump' }
      ]
    },
    {
      // Consequence of the 'discount' option in too_expensive.
      id: 'discount_echo', emoji: '🔖',
      cond: { flag: 'triedDiscount' },
      chancePerDay: 0.05, once: true,
      text: 'Word got around that you give discounts. Two prospects ask for "the friend price."',
      effects: [
        { op: 'buff', stat: 'closeRate', mult: 0.85, days: 10, label: 'Haggle hangover' }
      ]
    },
    {
      // Consequence of the 'lifetime_deal' option in keep_working_together.
      id: 'lifetime_regret', emoji: '♾️',
      cond: { flag: 'lifetimeDeal' },
      chancePerDay: 0.04, once: true,
      text: 'A lifetime-deal client wants a brand-new plan every week. Forever is a long time.',
      effects: [
        { op: 'add', path: 'burnout', value: 12 }
      ]
    },
    {
      // Consequence of the 'big_list' option in who_is_it_for.
      id: 'spam_complaints', emoji: '🚫',
      cond: { flag: 'boughtBigList' },
      chancePerDay: 0.05, once: true,
      text: 'Spam complaints from that cheap list got your email flagged. Cold replies drop for a while.',
      effects: [
        { op: 'buff', stat: 'coldReply', mult: 0.7, days: 10, label: 'Flagged as spam' }
      ]
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
