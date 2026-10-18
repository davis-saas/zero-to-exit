/*
 * Zero to Exit — Founder's Notebook (ZTE.Content.notebook)
 *
 * Exactly 28 lessons, one per id in the fixed list (SPEC §5.7).
 * Each entry: { id, term, emoji, level, title, summary, formula?, tip, quiz }
 *   level   = the level (1–3) where the player first meets the idea
 *   formula = optional; omitted on entries that have no real formula
 *   quiz    = { q, options: [3 strings], answer: index 0..2, explain }
 *
 * All text is written in our own words using the in-game glossary (§2).
 * Plain data only: no DOM, safe to require() from Node.
 *
 * SPEC-GAP: entries without a formula simply leave the `formula` key out
 *           (never null / empty string). UI should check `if (entry.formula)`.
 * SPEC-GAP: `constraint` is level 3 because its only unlock is the level-3
 *           card all_four_megaphones; `scaling_path` is level 3 (the "what
 *           comes after Megaphone" lesson, unlocked when Megaphone starts).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  ZTE.Content.notebook = [
    /* ───────────────────────── Level 1 · Garage ───────────────────────── */
    {
      id: "start_free",
      term: "Free Trials",
      emoji: "🎁",
      level: 1,
      title: "Your first customers are free",
      summary: "Before anyone pays you, get a handful of people to try your thing for free. They forgive rookie mistakes, tell you what to fix, and hand you the stories you'll need to sell later. Free users can also turn into buyers, send you their friends, or leave reviews that bring in paying customers. Charging comes later, because right now you're trading your time for practice and proof.",
      tip: "Free isn't charity, it's tuition. Ask for feedback and a review in return!",
      quiz: {
        q: "You just launched and nobody has tried your program yet. Your cousin says: “Charge full price from day one or you'll look cheap.” What's the smartest first move?",
        options: [
          "Charge full price and wait patiently for the right buyer to show up",
          "Spend your savings on ads so strangers find you faster",
          "Let a few people try it free in exchange for feedback and an honest review"
        ],
        answer: 2,
        explain: "With zero proof and zero reps, free trials get you practice, feedback and testimonials fast, and those make every later sale easier. Running ads before you know what works mostly burns cash."
      }
    },
    {
      id: "warm_outreach",
      term: "Friends Megaphone",
      emoji: "👋",
      level: 1,
      title: "Start with people who know you",
      summary: "Your easiest leads are people who already know and trust you: friends, family, old coworkers, everyone in your phone. Send short, personal messages. Check in first, then ask if they know anyone who wants the result you deliver. Asking for referrals instead of a sale takes the pressure off, and lots of people answer “actually… me!” Rough benchmark: about 1 in 5 reply, about 1 in 5 of those try it, and about 1 in 4 triers end up paying.",
      formula: "100 messages → ~20 replies → ~4 try it → ~1 paying customer",
      tip: "Your contacts list is a gold mine. Stop scrolling it and start messaging it!",
      quiz: {
        q: "You sent 100 personal messages to friends. 20 replied, but nobody wanted to try your offer. Which part is broken?",
        options: [
          "Reach: you simply need to message a lot more people",
          "The offer: replies are healthy, but what you offer isn't grabbing them",
          "Your friends: give up on them and switch to cold outreach today"
        ],
        answer: 1,
        explain: "About 1 in 5 replying is right on benchmark, so people are listening. The drop happens after they hear the offer, so make it easier to say yes: free, specific, with a clear result."
      }
    },
    {
      id: "testimonials",
      term: "Testimonials",
      emoji: "🗣️",
      level: 1,
      title: "Let happy people do the talking",
      summary: "A testimonial is a customer telling others what changed for them. Strangers doubt your promises but believe people like themselves, so every story nudges up the Likelihood dial on your Value-o-Meter. The best ones follow a simple arc: where they started, what worried them, why they went for it anyway, and the result they got, with real numbers. Ask for them on purpose, right after a win.",
      tip: "A result you didn't capture is a result nobody sees. Ask while they're still grinning!",
      quiz: {
        q: "A trial user just hit a big milestone and is thrilled. When should you ask for a testimonial?",
        options: [
          "Right now, while the win is fresh and they're excited",
          "In a few months, once they've racked up even bigger results",
          "Never. Asking feels pushy, and happy people post on their own"
        ],
        answer: 0,
        explain: "Excitement fades fast. Ask at the moment of the win and guide them: where they started, what they doubted, what they got. Most happy customers never write one unless you ask."
      }
    },
    {
      id: "daily_grind",
      term: "The Daily Grind",
      emoji: "⚡",
      level: 1,
      title: "100 actions a day, no excuses",
      summary: "Leads come from actions, and actions are the one thing you fully control. Pick your lead activity and do a big, fixed amount of it every day (around 100 messages, calls or minutes of creating) whether you feel like it or not. Keep it up for months, not days. Steady input is what turns “sometimes slammed, sometimes dead” into a steady flow of customers.",
      formula: "Leads = Lead actions × Reply rate",
      tip: "Motivation is optional. The 100 is not. Spend that Energy!",
      quiz: {
        q: "You had a great sales week, so you skip outreach for a few days to rest. What usually happens next?",
        options: [
          "Nothing much. A strong week keeps paying off for a long time",
          "Your reply rate jumps because people missed hearing from you",
          "A dry spell a week or two later, because nothing new went into the pipeline"
        ],
        answer: 2,
        explain: "Today's customers come from outreach you did days ago. Stop the input and the pipeline empties out later. That's why the grind is daily, even on good weeks."
      }
    },
    {
      id: "constraint",
      term: "The Boss (Constraint)",
      emoji: "🚧",
      level: 3,   // unlocked by the level-3 card all_four_megaphones
      title: "Fix the biggest leak first",
      summary: "At every stage, one thing holds the whole business back: your constraint, the level's boss. Find it by looking for the step where the most people drop off, or the thing everything else is waiting on. A small fix there beats a big fix anywhere else. Once you beat it, a new boss shows up somewhere else, and that's how you know you've leveled up.",
      formula: "Weakest step 5% → 10% = 2× results · Strong step 50% → 55% = only 1.1×",
      tip: "Stop polishing what isn't broken. Find the leak, plug the leak. Hoo-rah!",
      quiz: {
        q: "Your numbers: plenty of leads, 60% book a call, 70% show up, but only 8% buy. Where should your next upgrade go?",
        options: [
          "More leads: pump up the ad budget and outreach",
          "Closing: sharpen your offer and your Close Kit",
          "Show rate: send even more reminders before calls"
        ],
        answer: 1,
        explain: "Leads, booking and show-ups all look healthy. The big drop is at the close, so that's the boss. Pouring more leads into an 8% close mostly wastes them."
      }
    },

    /* ───────────────────────── Level 2 · Hustle ───────────────────────── */
    {
      id: "value_meter",
      term: "Value-o-Meter",
      emoji: "📈",
      level: 2,
      title: "Make value obvious",
      summary: "How much people value your offer comes down to four dials. A bigger dream outcome and stronger belief that it'll work push value up. A longer wait and more effort or sacrifice drag it down. Rookies keep inflating the promise, but the real wins come from making results faster and easier, and it only counts if the buyer can actually see it.",
      formula: "Value = (Dream × Likelihood) ÷ (Time Delay × Effort)",
      tip: "Anyone can promise big. Make it fast and easy and watch the meter explode!",
      quiz: {
        q: "Your Dream and Likelihood dials are already high, but buyers keep saying it “sounds like a lot of work.” Which change moves the Value-o-Meter most?",
        options: [
          "Cut the effort: done-for-you plans, simple checklists, fewer steps",
          "Promise an even bigger, flashier result in your messages",
          "Lower the price so the work feels more worth it"
        ],
        answer: 0,
        explain: "Effort sits on the bottom of the equation, so shrinking it multiplies value. A bigger promise adds little when the dream is already high, and a lower price doesn't change value at all."
      }
    },
    {
      id: "no_brainer_offer",
      term: "No-Brainer Offer",
      emoji: "🤯",
      level: 2,
      title: "So good that no feels silly",
      summary: "A No-Brainer Offer packages your product so the value feels way bigger than the price. You build it in the Offer Forge: list every problem your buyer will hit on the way to their dream, turn each one into a solution, then keep the ones that are high-value and cheap for you to deliver. Top it off with bonuses, a guarantee and a great name. When an offer is this good, you stop competing on price because there's nothing to compare it to.",
      formula: "Goal: Perceived value ≫ Price",
      tip: "If they're comparing your price to someone else's, your offer isn't different enough yet.",
      quiz: {
        q: "Three competitors sell the same 6-week program for about the same price. How do you win without starting a price war?",
        options: [
          "Undercut all of them by 30% and make it up on volume",
          "Copy their sales page, but make yours look prettier",
          "Stack your offer with solutions to every obstacle so it can't be compared"
        ],
        answer: 2,
        explain: "When offers look identical, buyers shop on price and everyone races to the bottom. Solving more of their problems makes yours one of a kind, so price stops being the deciding factor."
      }
    },
    {
      id: "pricing_up",
      term: "Premium Pricing",
      emoji: "💎",
      level: 2,
      title: "Cheap is expensive",
      summary: "Low prices feel safe but quietly wreck you: thin margins, less committed clients, worse results and the pickiest customers. Higher prices give you money to deliver better and attract buyers who actually do the work. A price raise usually costs fewer sales than you fear: double the price, lose 30% of buyers, and you still bring in 40% more. Raise value along with price, and if you close 40% or more of your calls, you're probably too cheap.",
      formula: "Double the price, keep 70% of sales → 2 × 0.7 = 1.4× revenue",
      tip: "A few extra no's won't sink you. Underpricing will.",
      quiz: {
        q: "You close 45% of your sales calls and your calendar is packed solid. What does that tell you?",
        options: [
          "Your price is probably too low, so test raising it",
          "Everything is perfect, so change absolutely nothing",
          "You should cut the price a bit to grow even faster"
        ],
        answer: 0,
        explain: "A very high close rate plus a full calendar means buyers see far more value than you charge. Raise the price (and the value), accept a few more no's, and profit goes up."
      }
    },
    {
      id: "guarantees",
      term: "Guarantees",
      emoji: "🛡️",
      level: 2,
      title: "Take the risk off their plate",
      summary: "A guarantee moves the risk from the buyer to you, so more people say yes. Strong ones are specific: if you don't get X by Y, I'll do Z. Unconditional guarantees sell the most but invite more refunds, while conditional ones tie the promise to the actions that actually get results, keeping refunds low and customers working. Do the math: even when refunds double, the extra sales usually win.",
      formula: "100 sales − 5% refunds = 95 · 130 sales − 10% refunds = 117 (+23%)",
      tip: "Scared of refunds? Run the numbers first. Then be brave.",
      quiz: {
        q: "Adding a money-back guarantee lifted sales by 30%, but refunds went from 5% to 10%. Keep it?",
        options: [
          "No. Refunds doubled, so the guarantee clearly backfired",
          "Yes. Even after refunds you keep about 23% more sales",
          "Only if you can get refunds back down to 5% first"
        ],
        answer: 1,
        explain: "100 sales minus 5% is 95. 130 sales minus 10% is 117. That's more customers and more money even with twice the refunds. Tying it to key actions (a conditional guarantee) trims refunds further."
      }
    },
    {
      id: "close_kit",
      term: "Close Kit",
      emoji: "🤝",
      level: 2,
      title: "A call plan that helps people decide",
      summary: "Most people on a sales call are on the fence: they want the result but feel nervous about the money or the leap. The Close Kit walks them through six steps: Ask why now → Name the gap → Paint the dream → Clear the doubts → Make the ask → Welcome them in. Lines like “no time,” “too expensive” or “I need to ask my partner” usually hide a deeper worry, so get curious instead of pushy. A solid process can double your close rate with the very same leads.",
      formula: "Sales = Calls that show up × Close rate",
      tip: "Fence-sitters don't need a pushier pitch. They need a guide. Be the guide.",
      quiz: {
        q: "On a call, the prospect says: “It's too expensive.” Which Close Kit move fits best?",
        options: [
          "Knock 30% off on the spot so you don't lose the sale",
          "Thank them politely and end the call, since a no is a no",
          "Clear the doubt: ask what's behind it and tie the price back to the gap they described"
        ],
        answer: 2,
        explain: "“Too expensive” often means “I'm not sure it'll work for me.” Get curious, revisit the gap between where they are and where they want to be, and weigh the price against staying stuck. Discounting on the spot teaches people your prices are negotiable."
      }
    },
    {
      id: "cold_outreach",
      term: "Cold Calls Megaphone",
      emoji: "📞",
      level: 2,
      title: "Strangers, one at a time",
      summary: "Once your friends list runs dry, reach out one-on-one to people who don't know you yet: calls, emails, DMs. Strangers don't trust you, so expect much lower reply rates than with friends and make up for it with volume and a short, personal message. Lead with something free and useful instead of a hard pitch. The upside: it's private, scalable and predictable, with more outreach in meaning more leads out.",
      formula: "100 personal emails → ~30 opened → ~3 interested leads",
      tip: "They don't know you yet. Earn the reply with one personal line, then give before you ask.",
      quiz: {
        q: "You sent 200 cold messages and got just 2 interested replies. What do you try first?",
        options: [
          "Add a personal line to each message and offer something free instead of pitching",
          "Decide cold outreach doesn't work in your market and quit for good",
          "Write a much longer message that explains every single feature"
        ],
        answer: 0,
        explain: "Around 1% is low but fixable. Personal touches and a free, useful offer lift replies, then volume does the rest. Just expect cold numbers to stay well below warm ones."
      }
    },
    {
      id: "hooks",
      term: "Hooks",
      emoji: "🎣",
      level: 2,
      title: "Win the first three seconds",
      summary: "A hook is whatever people see or hear first: the opening line of a message, the first seconds of a video, an email's subject line. If it doesn't grab attention, nothing after it matters. Good hooks do two things: call out who it's for (“busy parents…”) and promise something worth their time. Write lots of them, keep the winners, and put most of your effort into the opening.",
      tip: "Nobody reads line two if line one is boring. Hooks first, everything else second!",
      quiz: {
        q: "Your video explains your program really well, but almost nobody watches past the first second. What do you change?",
        options: [
          "Make the video longer and pack in more helpful detail",
          "The opening: call out your audience and promise a clear payoff",
          "Post the exact same video again at a different time of day"
        ],
        answer: 1,
        explain: "People leave before they ever reach the good stuff, so the hook is the bottleneck. Fix the first seconds and the rest finally gets seen."
      }
    },
    {
      id: "speed_to_lead",
      term: "Speed to Lead",
      emoji: "⏱️",
      level: 2,
      title: "Hot leads cool fast",
      summary: "The moment someone raises their hand is when they care the most. Every minute you wait, they get distracted, forget, or buy from whoever answered first. Aim to reach new leads within minutes, not hours, because fast replies book more calls and need fewer follow-ups. Interest melts, so treat new leads like ice cream on a hot day.",
      tip: "A lead that waits is a lead that leaves. Reply fast. Owls never sleep on a lead!",
      quiz: {
        q: "Ten new leads came in this morning, but you planned to reply tomorrow after your deliveries. What happens?",
        options: [
          "Same result. Truly interested people are happy to wait a day",
          "More of them book, because looking busy makes you seem in demand",
          "Fewer of them book. Some cool off and some go elsewhere"
        ],
        answer: 2,
        explain: "Interest fades by the hour, and the first business to respond often wins. Reply within minutes when you can, even if it's just to grab a time on the calendar."
      }
    },
    {
      id: "show_rate",
      term: "Show Rate",
      emoji: "📅",
      level: 2,
      title: "Booked is not bought",
      summary: "A booked call only counts if they actually show up, and show rate is often the cheapest number in your funnel to raise. Book calls within a few days instead of weeks, offer plenty of time slots, send friendly reminders, and give people a reason to come, like something useful they get just for showing up. Lifting show rate from 50% to 70% means 40% more sales with zero extra leads.",
      formula: "Sales = Leads × Book % × Show % × Close %",
      tip: "Ghosts don't buy. Book it soon and remind them often!",
      quiz: {
        q: "100 leads → 50 book a call → only 20 show up → 5 buy. What's the biggest, cheapest win?",
        options: [
          "Buy more leads so more people end up on the calendar",
          "Lift the show rate: book sooner and send reminders",
          "Raise your price so each of the 5 sales is worth more"
        ],
        answer: 1,
        explain: "Only 40% of booked people show, so most of your buyers vanish before you can help them. Getting that to 70% turns 5 sales into about 9 with the very same leads."
      }
    },
    {
      id: "bonuses",
      term: "Bonuses",
      emoji: "🎀",
      level: 2,
      title: "Add value, don't cut price",
      summary: "Instead of discounting, add bonuses. Breaking your offer into named pieces and stacking extras on top makes the same stuff feel worth far more. The best bonuses each knock out one specific worry (“I can't cook” → a 10-minute meal plan), and tools or checklists beat extra lessons because they save effort. Discounts teach people your prices are up for haggling, while bonuses make the deal better without touching the price.",
      tip: "Never cut the price when you can stack the value. Throw in the meal plan!",
      quiz: {
        q: "A prospect is hesitating because they're “not sure I can stick with it.” What's the best move?",
        options: [
          "Add a bonus that solves exactly that worry, like weekly check-ins",
          "Offer them 20% off so the decision feels less risky",
          "Tell them to come back once they feel more motivated"
        ],
        answer: 0,
        explain: "A bonus aimed at their exact doubt raises value and removes the reason to say no. A discount leaves the doubt in place and shrinks your margin."
      }
    },
    {
      id: "niche",
      term: "Niche",
      emoji: "🎯",
      level: 2,
      title: "Serve someone, not everyone",
      summary: "Trying to help everyone makes your message bland and your offer generic. Pick one type of person with one painful problem and everything gets easier: your messages hit harder, your offer fits better, and you can charge much more for nearly the same work. A general workout plan is cheap, but one built only for long-haul truck drivers is worth a lot more to them. Pick one, then stick with it long enough to get good.",
      tip: "Helping everyone sounds like helping no one. Pick your people!",
      quiz: {
        q: "Your messages say you help “anyone who wants to get fit,” and replies are weak. What should you test?",
        options: [
          "Go even broader: “anyone who wants to feel better”",
          "Switch to a totally different business idea next week",
          "Target one group with one problem, like new moms who want their energy back"
        ],
        answer: 2,
        explain: "Specific beats general. When people read a message and think “that's exactly me,” they reply, trust you more and pay more. Hopping between markets resets your learning every time."
      }
    },
    {
      id: "proof_checklist",
      term: "Proof",
      emoji: "🧾",
      level: 2,
      title: "Receipts beat promises",
      summary: "Claims are cheap. Proof is what makes people believe. Strong proof is specific (real numbers and timeframes), relatable (people like your buyer, with the same struggles) and plentiful (lots of results, not one lucky case). Collect before-and-afters, screenshots and short customer videos as a habit, and show them everywhere you sell.",
      tip: "Don't tell me you're good. Show me the receipts!",
      quiz: {
        q: "Which testimonial will convince a busy dad the most?",
        options: [
          "“Great coach, super friendly, highly recommend to anyone!”",
          "“Dad of three, zero free time. Lost 20 pounds in 8 weeks on 20-minute workouts.”",
          "A photo of all your fitness certificates on the wall"
        ],
        answer: 1,
        explain: "Specific numbers plus a story that matches the buyer's own life beat vague praise and credentials. He sees himself in it, so his belief that it'll work goes way up."
      }
    },
    {
      id: "volume_then_quality",
      term: "Volume First",
      emoji: "🔊",
      level: 2,
      title: "Do more, then do better",
      summary: "When you want more leads, the first lever is simply doing more of what already works: more messages, more posts, more ad budget. Keep pushing volume until results start to slip, then improve the step where most people drop off, testing one change at a time. Only after that, try somewhere new. Beginners tweak forever at tiny volume, while winners pile on reps and learn as they go.",
      tip: "You can't fine-tune 5 messages. Send 500, then we'll talk.",
      quiz: {
        q: "You've sent 15 cold messages total and you're rewriting your script for the fifth time. What's the best next step?",
        options: [
          "Send a lot more with the current script, then fix the weakest step",
          "Keep polishing the script until it feels absolutely perfect",
          "Ditch this megaphone and jump to a brand-new one tomorrow"
        ],
        answer: 0,
        explain: "15 messages is too little data to know what's broken. Do the volume first so patterns appear, then improve the step where most people drop off."
      }
    },

    /* ───────────────────────── Level 3 · Megaphone ───────────────────────── */
    {
      id: "content",
      term: "Content Megaphone",
      emoji: "📱",
      level: 3,
      title: "Give way more than you ask",
      summary: "Free content (posts, videos, tips) reaches lots of people at once and builds an audience that trusts you. Each piece has to grab attention, hold it, and leave people better off than before. Think of trust like a piggy bank: helpful posts fill it and sales pitches spend it, so give far more than you ask. Content grows slowly and old posts keep sending leads for a while, so consistency beats big bursts.",
      tip: "Post like you mean it, every day. Your future customers are scrolling right now!",
      quiz: {
        q: "Your new account has 300 followers. Should every post end with a hard sales pitch?",
        options: [
          "Yes. Every single post is a chance to make a sale",
          "Never. Asking for money ever will scare everyone away",
          "No. Mostly share helpful stuff, with an occasional clear invite"
        ],
        answer: 2,
        explain: "Pitching every post drains goodwill and slows your growth. Give a lot and ask now and then, clearly. People you've helped for free are the ones who come knocking to buy."
      }
    },
    {
      id: "paid_ads",
      term: "Ads Megaphone",
      emoji: "📣",
      level: 3,
      title: "Buy leads, track every dollar",
      summary: "Ads let you pay to reach strangers at scale: dollars in, leads out. Set up tracking first, then expect to lose a little while you test, since most ads flop and a few winners pay for the rest. Give a test ad a budget of about twice what a customer pays you in their first 30 days before judging it, and kill ads that bring no leads at all much sooner. Once ads bring in more than they cost, spend as much as you can handle.",
      formula: "Leads per day = Daily budget ÷ Cost per lead",
      tip: "Ads don't print money until you know your numbers. Track first, then hit the gas!",
      quiz: {
        q: "Your first ad spent $150 and brought 6 leads but no sales yet. A customer pays you about $100 in their first month. What now?",
        options: [
          "Kill it right away. It already lost $150",
          "Let it run a bit longer. It's bringing leads and is still under a ~$200 test budget",
          "Triple the budget right away to find buyers faster"
        ],
        answer: 1,
        explain: "It's producing leads and hasn't hit 2× first-month cash ($200) yet, so it deserves a fair test. Cut ads that bring zero leads early, and scale only once an ad clearly pays you back."
      }
    },
    {
      id: "ltv_cac",
      term: "LTV : CAC",
      emoji: "⚖️",
      level: 3,
      title: "Worth vs. cost of a customer",
      summary: "LTV (lifetime value) is everything a customer pays you over their whole time with you, and pros count the profit left after delivery costs. CAC (customer acquisition cost) is what you spend on marketing to win one customer. Businesses tend to take off once LTV is at least 3 times CAC. If the ratio is weak, the fix is often not cheaper ads but making more per customer with upsells, a membership or a higher price.",
      formula: "LTV = Front-end + Upsells + (Monthly price ÷ Churn) · Ratio = LTV ÷ CAC, aim for 3 : 1+",
      tip: "Your ads aren't too expensive. Your customers are worth too little. Fix that!",
      quiz: {
        q: "Your CAC is $200 and a customer is worth $300 in total. Ads feel way too expensive. What's usually the smarter fix?",
        options: [
          "Raise LTV with an upsell or membership so each customer is worth $600+",
          "Hunt for some magic ad that brings customers in for $20",
          "Stop advertising completely and wait for referrals"
        ],
        answer: 0,
        explain: "1.5 : 1 is too thin. Ad costs can only drop so far, but what a customer is worth can climb a lot. Get LTV to $600 or more and you're at 3 : 1."
      }
    },
    {
      id: "client_financed",
      term: "Client-Financed Acquisition",
      emoji: "🔁",
      level: 3,
      title: "Let customers pay for the next one",
      summary: "Even great customers can cause a cash crunch if they pay you back slowly over many months. The fix is making sure what a new customer pays in their first 30 days covers what it cost to get them. Then every customer funds the next one, cash stops holding you back, and you can grow ads as fast as you can deliver. Hook Offers, upsells and up-front payments are how you get there.",
      formula: "30-day cash per customer ≥ CAC → ads pay for themselves",
      tip: "Get paid back inside 30 days and your ad budget refills itself. That's the cheat code!",
      quiz: {
        q: "Your membership is $50/month, CAC is $120, and members stay about 10 months. Ads are profitable on paper, but cash keeps running out. What fixes it fastest?",
        options: [
          "Just wait. The money will arrive over the next 10 months",
          "Cut the membership price so more people sign up",
          "Add an upsell at signup so the first 30 days bring in $120 or more"
        ],
        answer: 2,
        explain: "Each member is worth about $500, but you collect only $50 in month one while paying $120 up front. Lift 30-day cash above CAC and every customer pays for the next one, so you can scale without running dry."
      }
    },
    {
      id: "hook_offer",
      term: "Hook Offer",
      emoji: "🪝",
      level: 3,
      title: "Bait that pays",
      summary: "A Hook Offer is the first thing you sell to turn strangers into customers: something free, cheap or obviously a great deal. Strangers can't judge your value yet, but everyone recognizes a bargain, so a low entry price gets far more people in the door. Its job isn't profit, it's starting the relationship so your next offers can follow. Free brings the most leads, while a small price brings fewer people but more of them show up.",
      tip: "Get them in the door cheap, then wow them. The real money comes next!",
      quiz: {
        q: "Your free consult gets tons of bookings, but half the people never show up. Which Hook Offer tweak helps most?",
        options: [
          "Make it even sweeter by adding more free gifts",
          "Charge a small amount, like $47, so fewer sign up but more show",
          "Drop the Hook Offer and only sell the full program"
        ],
        answer: 1,
        explain: "A small price filters for people who are serious, so show rates go up. Free maximizes leads, a cheap deal maximizes show-ups. Pick based on your bottleneck."
      }
    },
    {
      id: "upsell",
      term: "Upsell",
      emoji: "⬆️",
      level: 3,
      title: "Solve the next problem",
      summary: "Every purchase fixes one problem and uncovers the next. An upsell offers that next fix right when the customer notices it: more of what they bought, a better version, or something that goes with it. People who just bought already trust you, so they're far easier to sell than strangers. Often the upsell, not the first sale, is where most of your profit lives.",
      formula: "Extra cash per customer = Take rate × Upsell price",
      tip: "They just said yes. Offer the next thing. They want it more than you think!",
      quiz: {
        q: "You sell a 6-week fitness program. Which upsell is most likely to get taken?",
        options: [
          "A ready-made meal plan offered at checkout, since food is their next struggle",
          "A random e-book about a totally different topic",
          "A great add-on, but pitched by email six months later"
        ],
        answer: 0,
        explain: "Upsells work when they solve the problem the first purchase reveals, at the moment that problem shows up. Off-topic or late offers get ignored."
      }
    },
    {
      id: "downsell",
      term: "Downsell",
      emoji: "⬇️",
      level: 3,
      title: "Turn a no into a smaller yes",
      summary: "When someone turns down your main offer, they said no to that package, not to getting help. A downsell changes how they pay (a payment plan, a trial) or what they get (a lighter version) so they can still start. It's a fair trade, not a discount: get less, pay less. Never just slash the price to save a sale, because customers talk and it teaches everyone to haggle.",
      formula: "Recovered cash = No's × Downsell take rate × Downsell price",
      tip: "A no is just the start of a better question: what would work for you?",
      quiz: {
        q: "A prospect loves the program but can't pay $500 today. What's the best downsell?",
        options: [
          "Quietly drop the price to $300, just this once",
          "Tell them to save up and come back when they can afford it",
          "Offer a payment plan, or a lighter self-guided version for less"
        ],
        answer: 2,
        explain: "A payment plan keeps the full price but changes how they pay, and a lighter version gives less for less. Both are fair trades. A secret discount upsets everyone who paid full price."
      }
    },
    {
      id: "membership",
      term: "Membership",
      emoji: "🔄",
      level: 3,
      title: "Revenue on repeat",
      summary: "A membership delivers ongoing value for an ongoing payment until the customer cancels. It brings in less cash today but much more over time: a $50/month plan that people keep for 20 months earns as much as a $1,000 one-time sale, and more people can afford to start. It fits things people keep using, and works best after your other offers so you still collect cash up front. How long members stay is everything, so watch your churn.",
      formula: "Membership LTV = Monthly price ÷ Monthly churn",
      tip: "Recurring revenue is the gift that keeps on giving. Keep 'em happy, keep 'em paying!",
      quiz: {
        q: "Your membership costs $99/month and 10% of members cancel each month. Roughly what is one member worth?",
        options: [
          "About $99",
          "About $990",
          "About $9,900"
        ],
        answer: 1,
        explain: "Average stay is 1 ÷ 10% = 10 months, so $99 × 10 ≈ $990. Cut churn to 5% and the same member is worth about $1,980."
      }
    },
    {
      id: "churn",
      term: "Churn",
      emoji: "🪣",
      level: 3,
      title: "Plug the leaky bucket",
      summary: "Churn is the share of customers who leave each month. High churn is a leaky bucket: you sprint just to replace people instead of growing. Small cuts make a huge difference, since dropping from 10% to 3% monthly churn more than triples how long people stay. Keep people by getting them an early win, keeping things simple (overwhelm makes people quit), and reaching out when they go quiet.",
      formula: "Average lifetime (months) = 1 ÷ Monthly churn",
      tip: "Keeping a customer is way cheaper than finding a new one. Guard that bucket!",
      quiz: {
        q: "You have 200 members and lose 20 every month. You sign up 20 a month and you're stuck at 200. What's the best lever?",
        options: [
          "Cut churn with better onboarding and early wins. At 5% you'd keep growing",
          "Pour everything into more ads and ignore cancellations",
          "Raise prices on current members to cover the gap"
        ],
        answer: 0,
        explain: "At 10% churn you need 20 new members a month just to stay flat. Halve churn to 5% and those same 20 signups grow you toward 400. Lower churn compounds."
      }
    },
    {
      id: "scaling_path",
      term: "The Scaling Path",
      emoji: "🗺️",
      level: 3,
      title: "Ten levels to The Summit",
      summary: "Every business climbs the same ten stages, from Garage to Empire, and each one has its own boss. Early on the boss is “nobody knows you,” then “no money yet,” then “customers come in unevenly.” Later it becomes “too much for one person,” “serving everyone,” and beyond. Your role changes too (Researcher, Starter, Doer, then Trainer and up), so focus on your current level's boss and ignore problems from levels you haven't reached yet.",
      tip: "Don't fight a Level 8 boss with a Level 3 sword. Beat the one in front of you!",
      quiz: {
        q: "You're at Megaphone (Level 3) and customers come in unevenly. A friend says you need an org chart and five managers. What's the right focus?",
        options: [
          "Hire managers now so you look like a real company",
          "Launch a second product line to spread your risk",
          "Make lead flow steady with daily outreach, content and ads that work"
        ],
        answer: 2,
        explain: "Each level has one main constraint. At Megaphone it's steady lead flow, so that's where effort pays off. Org charts and product lines are bosses for later levels."
      }
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
