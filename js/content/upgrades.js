/*
 * Zero to Exit - shop upgrades (spec section 5.5).
 * Categories: 'offer' (Offer Forge), 'skill' (Skill Scrolls + Close Kit ranks),
 * 'nurture' (lead follow-up), 'megaphone' (gear for the Four Megaphones).
 *
 * Rules followed here:
 *  - effects only use the ops in 5.2, paths in 5.3 and mods keys from section 4
 *  - multipliers stay modest; the integrator tunes final numbers with balance-sim
 *  - costs fit a broke solo founder who starts with about $3,000
 *  - notebook ids come only from the fixed list in 5.7
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  ZTE.Content.upgrades = [

    // ------------------------------------------------------------------
    // OFFER FORGE (category 'offer') - turn the Value-o-Meter dials
    // ------------------------------------------------------------------

    {
      id: 'pick_niche', name: 'Pick Your Niche', emoji: '🎯',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 20 },
      // SPEC-GAP: cards may also set flag 'niched'; this upgrade hides once the
      // flag exists so the dream boost never stacks twice.
      cond: { notFlag: 'niched' },
      desc: 'Serve one kind of customer. +2 Dream and cold messages land 10% better.',
      teaches: 'A specific promise to a specific person feels made for them, so it is worth more.',
      effects: [
        { op: 'add', path: 'offer.dream', value: 2 },
        { op: 'mod', stat: 'coldReply', mult: 1.1 },
        { op: 'flag', name: 'niched', value: true },
        { op: 'coach', text: 'Niched! Now you are the go-to for somebody, not a maybe for everybody.' }
      ],
      notebook: 'niche'
    },

    {
      id: 'fast_start', name: 'Fast-Start Win', emoji: '⚡',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 15 },
      desc: 'Give every new customer a quick win in week one. +2 Speed.',
      teaches: 'An early win proves they made the right call and keeps them going to the big result.',
      effects: [
        { op: 'add', path: 'offer.speed', value: 2 }
      ]
    },

    {
      id: 'dwy_kickoff', name: 'Done-With-You Kickoff', emoji: '🤝',
      category: 'offer', minLevel: 2, cost: { cash: 50, energy: 15 },
      desc: 'Set up the hard first steps together on a call. +2 Ease, but each customer takes 20% more energy.',
      teaches: 'Doing more of the work for people makes your offer worth more, but it costs you time.',
      effects: [
        { op: 'add', path: 'offer.ease', value: 2 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 1.2 }
      ]
    },

    {
      id: 'obstacle_list', name: 'Obstacle Buster List', emoji: '🧗',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 25 },
      desc: 'List every reason a customer could fail, then solve each one. +1 Likelihood, +1 Ease.',
      teaches: 'One unsolved worry can kill a sale, so hunt them all down before the call.',
      effects: [
        { op: 'add', path: 'offer.likelihood', value: 1 },
        { op: 'add', path: 'offer.ease', value: 1 }
      ],
      notebook: 'value_meter'
    },

    {
      id: 'testimonial_wall', name: 'Testimonial Wall', emoji: '🧱',
      category: 'offer', minLevel: 2, cost: { cash: 49, energy: 10 },
      cond: { path: 'reputation.testimonials', gte: 3 },
      desc: 'Put your best results on one simple page. +2 Likelihood. Needs 3 testimonials.',
      teaches: 'People believe other customers far more than they believe you.',
      effects: [
        { op: 'add', path: 'offer.likelihood', value: 2 }
      ],
      notebook: 'testimonials'
    },

    {
      id: 'guarantee_conditional', name: 'Do-the-Work Guarantee', emoji: '🛡️',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 10 },
      // Hidden once the stronger guarantee is owned, so you cannot "downgrade"
      // and keep the higher refund rate.
      cond: { notUpgrade: 'guarantee_unconditional' },
      desc: 'Promise a result if they do the key steps, or you keep working free. Sets a conditional guarantee.',
      teaches: 'Tying the promise to the actions that get results lowers risk for both of you.',
      effects: [
        { op: 'set', path: 'offer.guarantee', value: 'conditional' }
      ],
      notebook: 'guarantees'
    },

    {
      id: 'guarantee_unconditional', name: 'No-Questions Refund', emoji: '💸',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 10 },
      cond: { path: 'stats.salesCount', gte: 10 },   // learned by doing: unlocks after 10 sales
      desc: 'Full money back, no questions asked. Strongest guarantee, but refunds roughly double (about 5% to 10%). Needs 10 sales first.',
      teaches: 'More people buy when you carry the risk; do the math, the extra sales usually beat the extra refunds.',
      effects: [
        // No extra refundRate mod: the unconditional base rate already doubles refunds.
        { op: 'set', path: 'offer.guarantee', value: 'unconditional' },
        { op: 'coach', text: 'Bold! Some folks will refund. Count net sales, not feelings.' }
      ],
      notebook: 'guarantees'
    },

    {
      id: 'bonus_stack', name: 'Bonus Stack', emoji: '🎁',
      category: 'offer', minLevel: 2, cost: { cash: 120, energy: 15 },
      desc: 'Add checklists, templates and quick tools as named bonuses. About +6% value, +5% delivery energy.',
      teaches: 'Adding value beats cutting price, and handy tools feel worth more than extra lessons.',
      effects: [
        { op: 'mod', stat: 'perceivedValue', mult: 1.15 },
        { op: 'mod', stat: 'deliveryEnergy', mult: 1.05 }
      ],
      notebook: 'bonuses'
    },

    {
      id: 'offer_name', name: 'Catchy Offer Name', emoji: '🏷️',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 10 },
      // SPEC-GAP: effects cannot read the flavor, so the new name is generic.
      // It follows the idea: say the result, the speed and the container.
      desc: 'Rename your offer so it says the result and how fast. About +2% value.',
      teaches: 'A name that states the outcome tells the right people "this is for me" in one glance.',
      effects: [
        { op: 'set', path: 'offer.name', value: 'Fast-Track Results Program' },
        { op: 'mod', stat: 'perceivedValue', mult: 1.05 },
        { op: 'flag', name: 'namedOffer', value: true }
      ]
    },

    {
      id: 'scarcity_urgency', name: 'Limited Spots + Start Dates', emoji: '⏳',
      category: 'offer', minLevel: 2, cost: { cash: 0, energy: 10 },
      cond: { path: 'stats.salesCount', gte: 8 },   // learned by doing: unlocks after 8 sales
      desc: 'Cap new spots each month and start people on fixed dates. +10% close rate. Needs 8 sales first.',
      teaches: 'Honest limits on spots and time give people a reason to decide today, not someday.',
      effects: [
        { op: 'mod', stat: 'closeRate', mult: 1.1 }
      ]
    },

    {
      id: 'no_brainer_seal', name: 'No-Brainer Polish', emoji: '💎',
      category: 'offer', minLevel: 2, cost: { cash: 400, energy: 20 },
      requires: ['bonus_stack', 'offer_name'],
      cond: { all: [{ any: [{ upgrade: 'guarantee_conditional' }, { upgrade: 'guarantee_unconditional' }] }, { path: 'stats.salesCount', gte: 18 }] },
      desc: 'Pay a pro to tighten your one-page pitch: name, bonuses and guarantee together. About +4% value, +5% close rate. Needs 18 sales first.',
      teaches: 'When value, proof, bonuses and risk reversal all stack up, saying no starts to feel silly.',
      effects: [
        { op: 'mod', stat: 'perceivedValue', mult: 1.1 },
        { op: 'mod', stat: 'closeRate', mult: 1.05 },
        { op: 'flag', name: 'noBrainerOffer', value: true },
        { op: 'coach', text: 'That is a No-Brainer Offer. Now go put it in front of a LOT of people.' }
      ],
      notebook: 'no_brainer_offer'
    },

    // ------------------------------------------------------------------
    // SKILL SCROLLS + CLOSE KIT RANKS (category 'skill')
    // ------------------------------------------------------------------

    {
      id: 'hooks_1', name: 'Hooks: Rank 1', emoji: '🪝',
      category: 'skill', minLevel: 1, cost: { cash: 0, energy: 15 },
      desc: 'Practice openers that call out who it is for and promise something useful. +1 Hooks, +10% replies.',
      teaches: 'Your first line has one job: earn the next few seconds of attention.',
      effects: [
        { op: 'add', path: 'skills.hooks', value: 1 },
        { op: 'mod', stat: 'warmReply', mult: 1.1 },
        { op: 'mod', stat: 'coldReply', mult: 1.1 },
        { op: 'mod', stat: 'contentReach', mult: 1.05 }
      ],
      notebook: 'hooks'
    },

    {
      id: 'hooks_2', name: 'Hooks: Rank 2', emoji: '🎣',
      category: 'skill', minLevel: 3, cost: { cash: 200, energy: 15 },
      requires: ['hooks_1'],
      desc: 'Test hooks in batches: mostly winners, some twists, a few wild ideas. +1 Hooks, +15% reach, ads 8% cheaper.',
      teaches: 'Make a lot, keep what wins, remix it; volume finds the hits you could never predict.',
      effects: [
        { op: 'add', path: 'skills.hooks', value: 1 },
        { op: 'mod', stat: 'contentReach', mult: 1.15 },
        { op: 'mod', stat: 'adCpl', mult: 0.92 },
        { op: 'mod', stat: 'coldReply', mult: 1.05 }
      ],
      notebook: 'volume_then_quality'
    },

    {
      id: 'proof_scroll', name: 'Proof Scroll', emoji: '📸',
      category: 'skill', minLevel: 1, cost: { cash: 0, energy: 15 },
      desc: 'Ask for before-and-after shots and a short review at every win. +1 Proof, +25% testimonial chance.',
      teaches: 'Proof does not collect itself; you get it by asking at the moment people are happiest.',
      effects: [
        { op: 'add', path: 'skills.proof', value: 1 },
        { op: 'mod', stat: 'testimonialChance', mult: 1.25 }
      ],
      notebook: 'proof_checklist'
    },

    {
      id: 'pricing_scroll', name: 'Pricing Scroll', emoji: '🧮',
      category: 'skill', minLevel: 2, cost: { cash: 49, energy: 10 },
      desc: 'Learn to price on value, not fear. +1 Pricing, about +2% value.',
      teaches: 'If you close 40% or more of your calls, your price is probably too low.',
      effects: [
        { op: 'add', path: 'skills.pricing', value: 1 },
        { op: 'mod', stat: 'perceivedValue', mult: 1.05 }
      ],
      notebook: 'pricing_up'
    },

    {
      id: 'close_kit_1', name: 'Close Kit: Rank 1', emoji: '📋',
      category: 'skill', minLevel: 2, cost: { cash: 0, energy: 25 },
      desc: 'Role-play the six Close Kit steps until they feel natural. +1 Closing.',
      teaches: 'A simple, repeatable call plan beats winging it every single time.',
      effects: [
        { op: 'add', path: 'skills.closing', value: 1 }
      ],
      notebook: 'close_kit'
    },

    {
      id: 'close_kit_2', name: 'Close Kit: Rank 2', emoji: '🧯',
      category: 'skill', minLevel: 2, cost: { cash: 150, energy: 15 },
      cond: { path: 'stats.callsTotal', gte: 20 },   // learned by doing: unlocks after 20 sales calls
      requires: ['close_kit_1'],
      desc: 'Build a doubt-buster sheet for time, money, partner and "will it work for me?" worries. +1 Closing. Needs 20 sales calls first.',
      teaches: 'Most "no"s are really worries about time, money, other people or self-doubt; answer the real one.',
      effects: [
        { op: 'add', path: 'skills.closing', value: 1 }
      ]
    },

    {
      id: 'close_kit_3', name: 'Close Kit: Rank 3', emoji: '🥊',
      category: 'skill', minLevel: 3, cost: { cash: 1000, energy: 20 },
      cond: { path: 'stats.callsTotal', gte: 60 },   // learned by doing: unlocks after 60 sales calls
      requires: ['close_kit_2'],
      desc: 'A sales coaching sprint: learn to ask again after the first no. +1 Closing, +15% downsell take. Needs 60 sales calls first.',
      teaches: 'The first no is often just a pause; clear the doubt, then ask again.',
      effects: [
        { op: 'add', path: 'skills.closing', value: 1 },
        { op: 'mod', stat: 'downsellTake', mult: 1.15 }
      ],
      notebook: 'downsell'   // the only unlock for the Downsell lesson
    },

    {
      id: 'retention_scroll', name: 'Retention Scroll', emoji: '🧲',
      category: 'skill', minLevel: 3, cost: { cash: 250, energy: 15 },
      desc: 'Spot customers who go quiet, check in twice a week and talk before anyone cancels. +1 Retention, churn -15%.',
      teaches: 'Keeping a customer is far cheaper than finding a new one, and people leave quietly before they leave loudly.',
      effects: [
        { op: 'add', path: 'skills.retention', value: 1 },
        { op: 'mod', stat: 'churn', mult: 0.85 },
        { op: 'mod', stat: 'refundRate', mult: 0.95 }
      ],
      notebook: 'churn'
    },

    // ------------------------------------------------------------------
    // NURTURE (category 'nurture') - turn leads into calls into shows
    // ------------------------------------------------------------------

    {
      id: 'speed_to_lead', name: 'Speed-to-Lead Autoresponder', emoji: '🏎️',
      category: 'nurture', minLevel: 2, cost: { cash: 49, energy: 5 },
      desc: 'New leads get a reply within minutes, day or night. +20% book rate, leads cool 10% slower.',
      teaches: 'Interest fades fast; whoever replies first usually wins the deal.',
      effects: [
        { op: 'mod', stat: 'bookRate', mult: 1.2 },
        { op: 'mod', stat: 'leadDecay', mult: 0.9 }
      ],
      notebook: 'speed_to_lead'
    },

    {
      id: 'reminder_texts', name: 'Reminder Texts', emoji: '📲',
      category: 'nurture', minLevel: 2, cost: { cash: 39, energy: 5 },
      desc: 'Automatic texts a day, half a day and a few hours before each call. +15% show rate.',
      teaches: 'People forget, not because they do not care; a friendly nudge gets them to show up.',
      effects: [
        { op: 'mod', stat: 'showRate', mult: 1.15 }
      ],
      notebook: 'show_rate'
    },

    {
      id: 'follow_up_sequence', name: 'Follow-Up Sequence', emoji: '🔁',
      category: 'nurture', minLevel: 2, cost: { cash: 0, energy: 20 },
      desc: 'Write a 5-touch follow-up for leads who go quiet. +1 Nurture, leads cool 20% slower, +5% book rate.',
      teaches: 'Most people need several touches, yet most sellers give up after one.',
      effects: [
        { op: 'add', path: 'skills.nurture', value: 1 },
        { op: 'mod', stat: 'leadDecay', mult: 0.8 },
        { op: 'mod', stat: 'bookRate', mult: 1.05 }
      ]
    },

    {
      id: 'simple_crm', name: 'Simple CRM + Booking Link', emoji: '🗂️',
      category: 'nurture', minLevel: 2, cost: { cash: 99, energy: 10 },
      desc: 'Track every lead in one place and let them pick a time themselves. +1 Nurture, +10% book rate, leads cool 10% slower.',
      teaches: 'More open time slots and fewer steps to book means more people actually book.',
      effects: [
        { op: 'add', path: 'skills.nurture', value: 1 },
        { op: 'mod', stat: 'bookRate', mult: 1.1 },
        { op: 'mod', stat: 'leadDecay', mult: 0.9 }
      ]
    },

    {
      id: 'confirmation_call', name: 'Confirmation Call', emoji: '☎️',
      category: 'nurture', minLevel: 2, cost: { cash: 0, energy: 15 },
      requires: ['reminder_texts'],
      desc: 'A quick personal call the day before each appointment. +10% show rate, +3% close rate.',
      teaches: 'A real human voice turns "some call I booked" into a promise they keep.',
      effects: [
        { op: 'mod', stat: 'showRate', mult: 1.1 },
        { op: 'mod', stat: 'closeRate', mult: 1.03 }
      ]
    },

    // ------------------------------------------------------------------
    // MEGAPHONE GEAR (category 'megaphone') - more and cheaper leads
    // ------------------------------------------------------------------

    {
      id: 'lead_list', name: 'Targeted Lead List', emoji: '📇',
      category: 'megaphone', minLevel: 2, cost: { cash: 79, energy: 0 },
      desc: 'Buy a clean list of people who fit your ideal customer. Cold replies +15%, Cold Calls gear +1.',
      teaches: 'Cold outreach starts with the right list; great words sent to the wrong people still flop.',
      effects: [
        { op: 'mod', stat: 'coldReply', mult: 1.15 },
        { op: 'add', path: 'channels.cold.level', value: 1 }
      ],
      notebook: 'cold_outreach'
    },

    {
      id: 'personalization_templates', name: 'Personalization Templates', emoji: '✍️',
      category: 'megaphone', minLevel: 2, cost: { cash: 0, energy: 20 },
      desc: 'Templates with a custom first line about each person. Cold replies +12%, warm replies +5%.',
      teaches: 'Strangers ignore spam but answer someone who clearly looked them up.',
      effects: [
        { op: 'mod', stat: 'coldReply', mult: 1.12 },
        { op: 'mod', stat: 'warmReply', mult: 1.05 }
      ]
    },

    {
      id: 'referral_script', name: 'Referral Ask Script', emoji: '🗣️',
      category: 'megaphone', minLevel: 2, cost: { cash: 0, energy: 10 },
      cond: { path: 'stats.salesCount', gte: 1 },
      desc: 'Ask every happy customer who else they know, with a thank-you gift for both. +25% referrals, +15 contacts.',
      teaches: 'Most businesses get few referrals simply because they never ask, or never make it worth it.',
      effects: [
        { op: 'mod', stat: 'referralRate', mult: 1.25 },
        { op: 'add', path: 'network.size', value: 15 },
        { op: 'add', path: 'network.available', value: 15 }
      ]
    },

    {
      id: 'phone_camera_kit', name: 'Phone Studio Kit', emoji: '🎥',
      category: 'megaphone', minLevel: 3, cost: { cash: 180, energy: 0 },
      desc: 'Tripod, clip-on mic and an editing app. Content reach +20%, Content gear +1.',
      teaches: 'You do not need a studio, just clear sound and a steady shot so people keep watching.',
      effects: [
        { op: 'mod', stat: 'contentReach', mult: 1.2 },
        { op: 'add', path: 'channels.content.level', value: 1 }
      ],
      notebook: 'content'
    },

    {
      id: 'ad_creative_pack', name: 'Ad Creative Pack', emoji: '🖼️',
      category: 'megaphone', minLevel: 3, cost: { cash: 800, energy: 0 },
      desc: 'A freelancer makes a batch of fresh ad videos and images. Ad cost per lead -15%, Ads gear +1.',
      teaches: 'Ads wear out; a steady supply of fresh creative keeps your cost per lead down.',
      effects: [
        { op: 'mod', stat: 'adCpl', mult: 0.85 },
        { op: 'add', path: 'channels.ads.level', value: 1 }
      ],
      notebook: 'paid_ads'
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
