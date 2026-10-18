/*
 * Zero to Exit — Founder's Notebook, late game (appends to ZTE.Content.notebook)
 *
 * Exactly the 25 lessons with the fixed ids from SPEC-LATE §6 (levels 4–10).
 * Same shape as js/content/notebook.js:
 *   { id, term, emoji, level, title, summary, formula?, tip, quiz }
 *   level   = the level (4–10) where the player first meets the idea
 *   formula = optional; omitted on entries that have no real formula
 *   quiz    = { q, options: [3 strings], answer: index 0..2, explain }
 *
 * Load order: after js/content/notebook.js (which assigns the 28 early lessons).
 * All text is written in our own words using the in-game glossary.
 * Plain data only: no DOM, safe to require() from Node.
 *
 * SPEC-GAP: the array is appended with concat; any id that is already present is
 *           skipped, so loading this file twice never creates duplicate lessons.
 * SPEC-GAP: some formulas quote the game's own tuning so the lesson matches what the
 *           player sees (focus 3.3, span of control 3.1, premium take 3.4 / premiumDefaults,
 *           efficiency 4.1, fire damage 4.2, attention 4.2, bet chance 4.4, wisdom 4.4).
 *           If those numbers are retuned, update the matching formula string here.
 * SPEC-GAP: team roles are described by job ("someone to take sales calls") rather than
 *           by name, because role display names change per flavor (roles[i].nameByFlavor).
 */
(function (root) {
  'use strict';
  var ZTE = (root.ZTE = root.ZTE || {});
  ZTE.Content = ZTE.Content || {};

  var LATE = [
    /* ───────────────────────── Level 4 · Crew ───────────────────────── */
    {
      id: "hire_help",
      term: "Get Help",
      emoji: "🆘",
      level: 4,
      title: "Hire before you drown",
      summary: "Once there's more work than one person can do, the business can only grow as fast as you can run. Hire while you still have the time and energy to train, because a new hire starts slow and needs a couple of weeks to get up to speed. If you wait until you're buried, there's no time left to teach anyone, so mistakes pile up and customers feel it. Your job is changing from doing the work to teaching it.",
      formula: "New hire output: ~40% on day one → 100% after about 3 weeks",
      tip: "If you're too busy to hire, you waited too long. Hire now, thank me later!",
      quiz: {
        q: "Your energy runs out by lunch every day, customers wait longer for help, and two complained this week. Cash is fine. What's the smart move?",
        options: [
          "Push through a few more months until you're completely swamped, then hire",
          "Hire help now and train them while you can still keep customers happy",
          "Stop taking new customers until things calm down on their own"
        ],
        answer: 1,
        explain: "New hires take a couple of weeks to ramp, and you need spare time to train them. Hiring before you're buried keeps quality up. Waiting means training in the middle of a fire, and turning customers away caps your growth."
      }
    },
    {
      id: "playbooks",
      term: "Playbooks",
      emoji: "📘",
      level: 4,
      title: "Write it down so others can do it",
      summary: "A Playbook is a step-by-step checklist for a job you already do well. Write the steps exactly as you do them, do the job once in front of your hire, then watch them do it and fix any step that tripped them up. The test is simple: could a total stranger get your result using only the checklist? Each Playbook you add makes your team better at that job without you hovering.",
      tip: "If it only lives in your head, it isn't a system. It's a hostage situation!",
      quiz: {
        q: "You wrote a delivery checklist, handed it to your new hire, and their work came back sloppy. What's the best next step?",
        options: [
          "Take the work back for good, because it's faster to just do it yourself",
          "Give them a stern talk about quality and hope it sticks next time",
          "Show them the job once, watch them try, and fix the steps that confused them"
        ],
        answer: 2,
        explain: "Sloppy work usually means the checklist has gaps. Show it, watch them try, and fix the steps until a new person gets your result. Taking the work back keeps you stuck as the bottleneck forever."
      }
    },
    {
      id: "first_hire",
      term: "Hire for the Bottleneck",
      emoji: "🧩",
      level: 4,
      title: "Your first hire fixes your biggest jam",
      summary: "Don't hire for the job you hate most. Hire for the job that's capping growth right now. If customers are waiting on delivery, hire someone to serve them; if booked calls pile up, hire someone to take sales calls; if the pipeline is drying up, hire someone to do outreach. The wrong first hire adds payroll and leaves the real jam right where it was.",
      formula: "Delivery backed up → delivery help · Calls piling up → sales rep · Pipeline dry → outreach rep",
      tip: "Find the jam, hire for the jam. Everything else can wait!",
      quiz: {
        q: "You have more booked sales calls than you can take, so leads go cold. Delivery runs smoothly and outreach is steady. Who should your first hire be?",
        options: [
          "Someone to take sales calls",
          "Someone to help serve customers",
          "Someone to send even more outreach"
        ],
        answer: 0,
        explain: "The jam is at the sales call. More outreach would pile even more leads onto calls nobody can take, and delivery isn't the problem yet. Hire for the step that's capping growth."
      }
    },
    {
      id: "lead_squad",
      term: "Lead Squad",
      emoji: "🦸",
      level: 4,
      title: "Get other people to bring you leads",
      summary: "Your Lead Squad is everyone who brings you leads so you don't have to do it all yourself. Fans are happy customers who send friends, Staff are people you train to do outreach, Agencies are outside teams you pay to run marketing, and Partners are other businesses that promote you for a cut. Each one swaps hours of your doing for minutes of your managing. That's leverage: more leads for less of your time.",
      formula: "Total leads = Leads you get yourself + Leads your Lead Squad gets for you",
      tip: "You can't out-hustle a whole squad. So go recruit one!",
      quiz: {
        q: "You do all your own outreach. It brings in enough leads to pay the bills, but you have zero spare time. What gives you the most leverage next?",
        options: [
          "Train a setter to run the outreach that already works for you",
          "Work longer hours so you can send even more messages yourself",
          "Stop outreach and hope word of mouth picks up the slack"
        ],
        answer: 0,
        explain: "A trained setter runs the same proven outreach while you spend a fraction of the time managing. Your own hours have a hard ceiling. Dropping outreach just empties the pipeline a few weeks later."
      }
    },
    {
      id: "payroll_math",
      term: "Payroll Math",
      emoji: "💸",
      level: 4,
      title: "Every hire must pay their way",
      summary: "Payroll gets paid every single day, whether sales show up or not. Add up what everyone costs per day and keep enough cash to ride out a few slow weeks. A good hire makes more than they cost, either by bringing in cash or by freeing your time for work that does. If a role can't pay for itself, fix the role before you add another one.",
      formula: "Daily payroll = Σ (people × daily salary) · 2 × $156 + 1 × $108 = $420/day ≈ $12,600/month",
      tip: "Payroll never takes a day off. Make sure your sales don't either!",
      quiz: {
        q: "A sales rep costs $160 a day. They take 6 calls a day, win 1 in 4, and each sale is worth $400. Is this hire paying their way?",
        options: [
          "No. At $160 a day, payroll eats too much of your cash",
          "Yes. About 1.5 sales a day brings in roughly $600 against a $160 cost",
          "Can't tell. Hires should only be judged by how hard they work"
        ],
        answer: 1,
        explain: "6 calls × 1 in 4 = 1.5 sales a day. At $400 each that's about $600 coming in for $160 going out. Judge a hire by what they produce, not by the price tag alone."
      }
    },

    /* ───────────────────────── Level 5 · Focus ───────────────────────── */
    {
      id: "ideal_customer",
      term: "Ideal Customer",
      emoji: "💘",
      level: 5,
      title: "Build for your best customers",
      summary: "Look at your best customers: the ones who got great results, paid on time, sent friends and were easy to serve. Those are your ideal customers, so shape your offer, your message and your price around people just like them. You'll get fewer leads, but more of them buy, they stay longer and they ask for fewer refunds. Fewer leads, more money.",
      formula: "Focus 100 → leads −45% · close rate +20% · value +15% · churn −35%",
      tip: "Stop fishing for everyone. Fish where the best fish swim!",
      quiz: {
        q: "You turned up your niche focus, and this week you got fewer leads than before. What should you check before you panic?",
        options: [
          "Whether revenue and profit went up, since more of those leads buy and stay",
          "Nothing to check. Fewer leads means focus failed, so undo it right away",
          "Whether you can triple the ad budget to win back the old lead count"
        ],
        answer: 0,
        explain: "Focus trades volume for quality. Close rate, value and retention rise, so the money often goes up while leads go down. Judge it by revenue and profit, not by lead count."
      }
    },
    {
      id: "saying_no",
      term: "Saying No",
      emoji: "🙅",
      level: 5,
      title: "Every yes to the wrong fit costs you",
      summary: "Saying yes to anyone who'll pay pulls your product in ten directions at once. Bad-fit customers eat extra delivery time, ask for custom work, churn faster and rarely send referrals. Turning them down feels like losing money today, but it frees your team to wow the people you're built for. A polite no, plus a pointer to someone who fits them better, protects your team and your reputation.",
      tip: "A polite no today beats a refund and a bad review next month!",
      quiz: {
        q: "A big customer outside your niche offers good money, but wants custom work your team has never done. What's the smart call?",
        options: [
          "Take it. Money is money, and your team will figure it out",
          "Take it, but charge double to make the pain worth it",
          "Politely decline and point them to someone who fits better"
        ],
        answer: 2,
        explain: "Custom work outside your niche drags your team off course and usually ends in extra hours, refunds or churn. A friendly no keeps your focus where you win. Charging double doesn't fix the distraction."
      }
    },
    {
      id: "span_of_control",
      term: "Span of Control",
      emoji: "🕸️",
      level: 5,
      title: "Nobody can manage everybody",
      summary: "One leader can only guide a handful of people well. You can keep about 4 people on track yourself, and each manager handles about 6 more, a few extra with Hiring Playbooks. Anyone past that works unmanaged at about 60% output, so piling on staff without managers quietly wastes payroll. Add a manager before the team outgrows the people leading it.",
      formula: "People you can lead well = 4 (you) + Managers × 6 (+1 per Hiring Playbook rank) · beyond that → ~60% output",
      tip: "Ten people with no captain is just a crowd. Get a captain!",
      quiz: {
        q: "You have 9 team members and no managers. Everyone is busy, but output feels sluggish. What's the best next hire?",
        options: [
          "Another delivery person, so there are more hands to share the work",
          "A manager, so the 5 people past your limit get led properly",
          "Nobody yet. Send more pep talks and wait for it to pick up"
        ],
        answer: 1,
        explain: "You can lead about 4 people well, so 5 are working unmanaged at reduced output. One manager brings them back to full speed. More hands without leadership only adds more unmanaged people."
      }
    },
    {
      id: "profit_margin",
      term: "Profit Margin",
      emoji: "🧮",
      level: 5,
      title: "Keep more of what you make",
      summary: "Profit margin is the share of every dollar you keep after paying for everything: payroll, ads, tools and your own living costs. Big revenue with a thin margin means one bad month can sink you. A healthy margin pays for new hires, bigger ads and honest mistakes without panic. Raise it by charging more, cutting waste and dropping bad-fit customers who cost more than they pay.",
      formula: "Profit margin = (Revenue − All costs) ÷ Revenue · $60,000 − $51,000 = $9,000 → 15%",
      tip: "Revenue is the show-off number. Profit is the one that pays you!",
      quiz: {
        q: "Business A makes $100,000 a month and spends $95,000. Business B makes $60,000 and spends $45,000. Which one is healthier?",
        options: [
          "B, because it keeps 25% of every dollar while A keeps only 5%",
          "A, because it brings in $40,000 more revenue every month",
          "Neither. They're equally healthy, since both make a profit"
        ],
        answer: 0,
        explain: "A keeps $5,000 (5%), B keeps $15,000 (25%). B makes three times the profit on less revenue and can survive a bad month. Margin, not revenue, tells you how healthy a business is."
      }
    },

    /* ───────────────────────── Level 6 · Product Line ───────────────────────── */
    {
      id: "second_product",
      term: "Premium Product",
      emoji: "📦",
      level: 6,
      title: "Give happy customers something more to buy",
      summary: "Your happiest customers reach the end of what you sell and hit a dead end, so their next dollar goes to someone else. Find out what they'd gladly pay you for next and turn it into a richer, pricier offer. Build a small first version, try it on your biggest fans, and keep the core product humming the whole time. More money per customer pays for bigger ads and better hires.",
      formula: "Value per customer = Core sale + (Premium buy rate × Premium price) · $1,000 + 20% × $4,000 = $1,800",
      tip: "Your happiest customers want more. Don't make them shop next door!",
      quiz: {
        q: "Customers love your program, but most leave when it ends, and new customers keep getting pricier to find. What fixes this best?",
        options: [
          "Cut your price so more new people sign up and the leaving matters less",
          "Spend more on ads so new customers replace the ones who leave",
          "Build a premium next step that finishing customers actually want"
        ],
        answer: 2,
        explain: "The leak is that happy customers hit a dead end with you. A premium next step earns more from people who already trust you, with no extra ad cost. A lower price and more ads just make each customer worth less."
      }
    },
    {
      id: "ascension",
      term: "Ascension",
      emoji: "🪜",
      level: 6,
      title: "Offer the next step at the right moment",
      summary: "Ascension means moving customers up to your bigger product. The best moment to offer it is right after a win, when they finish and can feel the results, not on some random Tuesday. Someone who just bought from you again is the least likely to leave, so planning this path also cuts churn. Keep the price fair and your niche focus high, because the right customers say yes more often.",
      formula: "Premium sales ≈ 6% of customers finishing + 0.12% of active customers per day (more with a fair price and higher focus)",
      tip: "The win is the doorway. Offer the next step while they're standing in it!",
      quiz: {
        q: "When is the best moment to offer your premium product to a customer?",
        options: [
          "On day one, before they've seen any results",
          "Only after they complain, as a way to calm them down",
          "Right after they finish and get a real result"
        ],
        answer: 2,
        explain: "Right after a win, trust and excitement peak, so yes comes easier. Day one asks for more before you've proven anything. Pitching an upset customer feels like a cash grab."
      }
    },
    {
      id: "partners",
      term: "Partners",
      emoji: "🔗",
      level: 6,
      title: "Let other businesses sell for you",
      summary: "Partners are businesses that already serve your kind of customer and promote you to their audience for a cut. You only pay when someone actually buys, so a partner costs nothing until they make you money. Make it fast and easy for them to earn: a clear offer, a simple link or script, and quick payouts. An Agency is different, because you pay it a retainer to run marketing for you whether it works or not.",
      formula: "Partner cost per sale = Commission × Price · 20% × $2,000 = $400, and no sale = no cost",
      tip: "Borrow a crowd that already trusts someone. Then pay them for every win!",
      quiz: {
        q: "You sell a study program for high schoolers. Which partner makes the most sense?",
        options: [
          "A used car lot with a huge email list of local families",
          "A test-prep bookstore whose customers are students and parents",
          "A rival tutoring company that sells the same thing you do"
        ],
        answer: 1,
        explain: "The best partners already serve the exact people you want and don't compete with you. The car lot talks to the wrong crowd, and a direct rival has no reason to send you its customers."
      }
    },

    /* ───────────────────────── Level 7 · Tune-Up ───────────────────────── */
    {
      id: "better_not_more",
      term: "Better, Not More",
      emoji: "🔧",
      level: 7,
      title: "Do better, not more",
      summary: "At this size, adding more people and more stuff stops making things better and starts making them slower. Instead of hiring more, train the team you have; instead of new products, improve the ones you sell; instead of chasing more customers, serve the ones you have better. Small gains on every step multiply into big results. It's slower to set up, but it sticks.",
      formula: "4 steps each 10% better → 1.1 × 1.1 × 1.1 × 1.1 ≈ 1.46× results, same team",
      tip: "More is easy. Better is where the money hides!",
      quiz: {
        q: "Revenue is flat, payroll keeps rising, and all four steps of your funnel are a little sloppy. What's the best move?",
        options: [
          "Hire 10 more people so the team can push through the flat spell",
          "Launch a third product to bring in a fresh wave of buyers",
          "Tighten each step a little with training and better systems"
        ],
        answer: 2,
        explain: "Four steps each 10% better compound to about 1.46× results without adding a single person. More people and more products add cost and complexity to a machine that's already leaking."
      }
    },
    {
      id: "measure_it",
      term: "Measure It",
      emoji: "📏",
      level: 7,
      title: "Track it or you're guessing",
      summary: "You can't fix what you don't measure. Track the few numbers that run your business (book rate, show rate, close rate, churn, delivery cost and cost per lead) and compare each one to a healthy benchmark. The one furthest behind is your weakest metric, and that's where your next improvement project goes. Fix one thing at a time and check the numbers before and after, so you know it actually worked.",
      formula: "Project on your weakest metric → full effect + 8 efficiency · anywhere else → half effect + 3",
      tip: "Feelings lie. Scoreboards don't. Check the numbers!",
      quiz: {
        q: "Your numbers vs healthy benchmarks: book rate 58% (healthy 55%), show rate 45% (healthy 70%), close rate 31% (healthy 30%). Which project should you start?",
        options: [
          "A show-up system with reminders and confirmations",
          "Sales call training, because selling always matters most",
          "More ad creatives to bring in extra leads"
        ],
        answer: 0,
        explain: "Show rate is the only number well below its benchmark, so it's your weakest metric and a fix there pays off in full. Booking and closing already beat their benchmarks, so sales training gets only half the payoff, and new ad creatives go after cost per lead, which isn't your weak spot either."
      }
    },
    {
      id: "bloat",
      term: "Bloat",
      emoji: "🎈",
      level: 7,
      title: "Growth brings hidden waste",
      summary: "Bloat is the waste that sneaks in as a team grows: extra meetings, duplicate work, tools nobody uses and spending that doesn't create growth. Your efficiency slides as headcount climbs past 20, and low efficiency shrinks what your team gets done while making payroll pricier. Playbooks, managers, a healthy tech team and improvement projects push it back up. Keep an eye on it, because bloat never announces itself.",
      formula: "Real team output = Team output × (0.6 + 0.4 × Efficiency) · 50% efficiency → only 80% output",
      tip: "Every extra meeting has a payroll price tag. Cut the fat!",
      quiz: {
        q: "You doubled your team this year, but output barely moved and efficiency has slid to 55. What should you do first?",
        options: [
          "Hire even more people so the extra hands make up for the slowdown",
          "Accept it. Every big company slows down, so plan around it",
          "Run an improvement project and cut tools and work that add nothing"
        ],
        answer: 2,
        explain: "Low efficiency means every person produces less than they could, and payroll costs more. Fixing the waste lifts output for the whole team. Hiring into bloat just buys more bloat."
      }
    },

    /* ───────────────────────── Level 8 · Org Chart ───────────────────────── */
    {
      id: "triage",
      term: "Triage",
      emoji: "🚑",
      level: 8,
      title: "Fight the fire that can burn the house down",
      summary: "At this size something is always on fire, and you can't put out every one. Sort problems like an emergency room does: how much damage will this do if nobody touches it, and how soon? Big, dangerous fires get handled first. Small, noisy ones can wait, or the people closest to them can sort them out.",
      formula: "Ignored fire → its damage lands + that department loses (Impact × 6) health",
      tip: "Loud isn't the same as important. Triage, soldier!",
      quiz: {
        q: "Three fires: the office printer is jammed and everyone is grumbling, a billing error is double-charging hundreds of customers, and the team is arguing about a new logo color. Which one first?",
        options: [
          "The printer, because the whole office is stuck and complaining loudly",
          "The billing error, because it hurts customers and cash every hour",
          "The logo, because a brand decision affects every future ad"
        ],
        answer: 1,
        explain: "The billing error has the biggest impact: refunds, angry customers and lost trust. The printer and the logo are loud but low impact. Someone else can handle them, or they can simply wait."
      }
    },
    {
      id: "departments",
      term: "Departments",
      emoji: "🗂️",
      level: 8,
      title: "Sort the chaos into boxes",
      summary: "When everything feels messy, start by sorting the company into departments: Marketing, Sales, Delivery, People, Finance and Tech. Give each one an owner, its own numbers to watch and its own budget with spending limits. Now every problem has a home, and you can see which part is struggling. A company is only as strong as its weakest department.",
      formula: "Company health ≈ Your weakest department's health (aim for every one ≥ 60)",
      tip: "A messy garage gets clean one pile at a time. Sort it!",
      quiz: {
        q: "Department health: Marketing 88, Sales 82, Delivery 79, Finance 41. Where does your next effort go?",
        options: [
          "Marketing, to make your strongest team even stronger and grow faster",
          "Spread it evenly across all four so nobody feels left out",
          "Finance, because the weakest department drags the whole company down"
        ],
        answer: 2,
        explain: "A shaky Finance team can sink a company that sells and delivers well: surprise costs, cash crunches, sloppy budgets. Shore up the weakest link first. Polishing Marketing adds little while Finance stays broken."
      }
    },
    {
      id: "ceo_attention",
      term: "CEO Attention",
      emoji: "🔦",
      level: 8,
      title: "Your focus is the scarcest thing you own",
      summary: "As the boss, your attention is limited, and every hour on small stuff is an hour stolen from big stuff. Plan each week at the start: put your top priorities on the calendar first, then fit everything else around them. Spend your attention where only you can make the call, and let your managers handle the rest. You get just a few attention points a week, so save them for the fires that matter most.",
      formula: "3 ⚡ per week (more with upgrades, resets every 7 days) · Handling 1 fire = 1 ⚡",
      tip: "Your calendar shows your real priorities. Make it match the ones you brag about!",
      quiz: {
        q: "You have 1 attention point left this week. Open fires: a small team chat glitch (due today), a broken coffee machine (due today), and a key supplier threatening to quit (due in 3 days). Where does it go?",
        options: [
          "The supplier, because losing them would do real damage",
          "The chat glitch, because it's due first and everyone uses it",
          "The coffee machine, because the team will be grumpy"
        ],
        answer: 0,
        explain: "Due first isn't the same as most important. The supplier is the high-impact fire, so it gets your scarce attention. The small stuff can burn out on its own or be handled by someone else."
      }
    },

    /* ───────────────────────── Level 9 · Specialists ───────────────────────── */
    {
      id: "specialists",
      term: "Specialists",
      emoji: "🔬",
      level: 9,
      title: "Experts beat jacks-of-all-trades",
      summary: "At this size nobody can be great at everything, not even you. Think of a race pit crew: one person changes tires, one fuels, one works the jack, and together they finish in seconds. Break big jobs into smaller pieces, give each piece to people who are great at it, and set up simple ways for those teams to work together. A specialist team lifts its department's health and gives it a lasting boost.",
      formula: "Each specialist level → +15 department health + a lasting department boost · costs more people and payroll",
      tip: "Jack of all trades, master of none? Not on my watch. Specialize!",
      quiz: {
        q: "Your sales team sells three very different products, and win rates are sliding on all of them. What should you try?",
        options: [
          "Split the team so each group sells one product and gets great at it",
          "Have everyone study all three products harder so nobody falls behind",
          "Cut two of the products so the team has less to learn and remember"
        ],
        answer: 0,
        explain: "Specialized reps learn one product and one type of buyer inside out, so they sell it better. Asking everyone to master everything is the problem. Cutting products throws away revenue to fix a team-design issue."
      }
    },
    {
      id: "a_players",
      term: "A-Players",
      emoji: "⭐",
      level: 9,
      title: "Great people are worth the wait",
      summary: "One great hire can outwork several average ones, raise the bar for everyone around them, and need less managing. Use one standard hiring process so every recruiter picks the same kind of person, and personally check the most important hires. Reward your best people fastest, with raises tied to results, and don't burn them out. Average hires take the same management time and slowly drag the standard down.",
      tip: "Hire slow, reward fast. Stars want to work with stars!",
      quiz: {
        q: "You need a new leader for a key department. One candidate can start tomorrow and seems fine. A standout candidate needs six weeks to start. What's the smart move?",
        options: [
          "Hire the available one, because an empty seat costs money every day",
          "Hire both and let them fight it out for the job",
          "Have a manager cover the seat and wait for the standout"
        ],
        answer: 2,
        explain: "Key roles shape everyone under them, so the gap between fine and great gets multiplied. Cover the seat for a few weeks and land the great hire. Hiring both burns cash and splits the team."
      }
    },
    {
      id: "department_heads",
      term: "Department Heads",
      emoji: "👔",
      level: 9,
      title: "Put a leader on every team",
      summary: "You can't be the boss of every department and still steer the company. Each department needs a head who owns its numbers, hires and trains its people, and fixes its problems before they reach your desk. Top leaders want to hear the vision from the founder, so recruit them yourself, promote from within when you can, and be patient. Then you only step in for the biggest calls.",
      tip: "Lead the leaders. Let them lead the troops!",
      quiz: {
        q: "Every small decision in Marketing, Sales and Tech still lands on your desk, and big projects stall while you're stuck. What's the fix?",
        options: [
          "Hire a head for each department who owns its numbers and decisions",
          "Work weekends for a while to clear the backlog faster yourself",
          "Pause all small decisions until you finally have time for them"
        ],
        answer: 0,
        explain: "When every decision runs through you, you're the bottleneck for the whole company. Department heads make the day-to-day calls, so you can focus on the few only you can make. Working weekends just delays the same jam."
      }
    },

    /* ───────────────────────── Level 10 · Empire ───────────────────────── */
    {
      id: "big_bet",
      term: "Big Bet",
      emoji: "🎲",
      level: 10,
      title: "Make a bet big enough to matter",
      summary: "When a big company's growth flattens out, small tweaks stop moving the needle. You need one bold move sized to your company: buy a rival, open a new market, launch a new kind of product or build your own platform. Big bets take months and can fail, so prepare first, because strong numbers, healthy departments and spare cash all raise your odds. Keep enough cash back that a miss can't sink the core business, and pick the bet you're best prepared for, not the flashiest one.",
      formula: "Win chance = Base chance + Prep bonuses (max 90%)",
      tip: "Small bets are safe and useless at this size. Bet big, but bet prepared!",
      quiz: {
        q: "Your company is worth tens of millions and growth has stalled. Which move fits this stage best?",
        options: [
          "A careful $5,000 test of a new ad on one channel, then wait and see",
          "One big, well-prepared bet, like buying a rival or opening a new market",
          "Five medium-sized bets at the same time, so at least one of them hits"
        ],
        answer: 1,
        explain: "At this size a tiny test can't change the company's path, but one big, well-prepared bet can. Five bets at once split your cash and attention, which makes each one more likely to fail."
      }
    },
    {
      id: "valuation",
      term: "Valuation",
      emoji: "🏷️",
      level: 10,
      title: "What your company is worth",
      summary: "A buyer doesn't pay for your revenue. They pay for your yearly profit, times a multiple. The multiple climbs when profit is recurring, growing, comes from several lead sources, runs on healthy departments and doesn't depend on you. Two companies with the same profit can sell for wildly different prices because of that multiple.",
      formula: "Valuation = Annual profit × Multiple · $500,000/month × 12 = $6M a year × 9 = $54M",
      tip: "Revenue gets applause. Profit times multiple gets you paid!",
      quiz: {
        q: "Two companies each make $3M profit a year. One runs on monthly memberships and doesn't need its founder. The other sells one-time deals, and the founder runs every sales call. Which sells for more?",
        options: [
          "The same price, since buyers only care how much profit there is",
          "The one-time-deals company, because big deals look impressive to buyers",
          "The membership one, since recurring, founder-free profit earns a higher multiple"
        ],
        answer: 2,
        explain: "Same profit, different multiple. Recurring revenue and a company that runs without its founder are less risky for a buyer, so they pay more for every dollar of profit."
      }
    },
    {
      id: "owner_independence",
      term: "Owner Independence",
      emoji: "🏝️",
      level: 10,
      title: "Build a business that runs without you",
      summary: "If the business only makes money while you're in it, you own a demanding job, not an asset. Nobody pays much for a company that falls apart when the founder takes a vacation. When your team runs delivery and sales without you, the same profit is worth far more, because a buyer could run it too. Your goal is to make yourself unnecessary to the daily work.",
      formula: "Independence = 1 − your biggest share of the work (delivery or sales) · worth up to +2 on your multiple",
      tip: "If you can't take a two-week vacation, you don't own a company. You own a cage!",
      quiz: {
        q: "You still personally handle 70% of sales calls, and you want a higher sale price. What's the best move?",
        options: [
          "Train your team and hand off sales so it runs without you",
          "Take even more calls yourself, since you're the best seller you have",
          "Keep it quiet during the sale and hope buyers don't ask"
        ],
        answer: 0,
        explain: "A buyer pays more when the company doesn't need its founder. Handing off sales raises your multiple, even if you're a bit better on calls. Hiding it falls apart the moment a buyer looks at the numbers."
      }
    },
    {
      id: "the_summit",
      term: "The Summit",
      emoji: "🏔️",
      level: 10,
      title: "Sell at the top",
      summary: "Selling your company turns years of future profit into cash today. Sell when profit is strong and still climbing, the team runs without you and the books are clean, not when you're burnt out and the numbers are sliding. Buyers check profit, growth, recurring revenue and how much depends on you, so fix those before you sell. The sale ends your run, and the lessons come with you as Wisdom for your next climb.",
      formula: "Wisdom = 1 + 1 per $10M of sale price (max 10)",
      tip: "Sell from strength, never from exhaustion. Now go plant that flag!",
      quiz: {
        q: "When is the smartest time to sell your company?",
        options: [
          "Right after a bad quarter, before things get worse",
          "When profit is growing and the business runs without you",
          "The day you feel burnt out and want to quit"
        ],
        answer: 1,
        explain: "Buyers pay the most for growing profit that doesn't depend on you, because the future looks bright. Selling after a slump or while burnt out means selling weak numbers at a low multiple."
      }
    }
  ];

  var existing = ZTE.Content.notebook || [];
  var have = {};
  existing.forEach(function (e) { if (e && e.id) have[e.id] = true; });
  ZTE.Content.notebook = existing.concat(LATE.filter(function (e) { return !have[e.id]; }));
})(typeof globalThis !== 'undefined' ? globalThis : this);
