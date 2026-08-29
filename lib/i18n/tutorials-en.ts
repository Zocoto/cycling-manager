import type { AppLocale } from "@/lib/i18n/config";
import type { TutorialDefinition } from "@/types/tutorial";

type TutorialStepCopy = { title: string; content: string };
type TutorialCopy = {
  title: string;
  description: string;
  steps: Readonly<Record<string, TutorialStepCopy>>;
};

export const ENGLISH_TUTORIAL_COPY: Readonly<Record<string, TutorialCopy>> = {
  "onboarding-core": {
    title: "Getting started with Cyclo Stratège",
    description:
      "Learn the basics of being a Sports Director, from founding your team to securing sponsorship.",
    steps: {
      welcome: {
        title: "Welcome to Cyclo Stratège",
        content:
          "You are now the Sports Director of a young cycling team. This tour introduces the essential game features and prepares you for the Discovery Criterium.\n\nGreen landmarks simply show where to look: the rest of the interface remains visible and accessible. You can leave at any time, resume later or permanently skip the tutorial.",
      },
      "news-feed": {
        title: "Keep an eye on your notifications",
        content:
          "Alerts that require your attention are grouped in the Sports Director mailbox, available from the envelope at the top of the screen.\n\nIt includes injuries, completed scouting missions, championship registrations and financial situations that need resolving.",
      },
      "profile-overview": {
        title: "Complete your identity",
        content:
          "Your Sports Director name is already the one chosen during registration: you do not need to enter it again.\n\nYou only need to choose an avatar, then a nationality. Select Next: each control will appear as an informative landmark without locking the rest of the page.",
      },
      "profile-form": {
        title: "Choose your avatar",
        content:
          "Your name has already been filled from account creation. Now choose the portrait that will represent your Sports Director.\n\nSelect Create my avatar and compose your portrait. The Next button will unlock as soon as you confirm your choice.",
      },
      "profile-nationality": {
        title: "Set your nationality",
        content:
          "Your avatar is ready. Now choose your Sports Director nationality; the Next button will unlock after your selection.\n\nThis personal choice is permanent. Your team country and the country of your first seven riders will be selected separately in the next stage.",
      },
      "profile-save": {
        title: "Confirm your profile",
        content:
          "Your avatar and nationality are ready. Select Confirm my profile in the highlighted area.\n\nOnce saved, the tutorial will automatically take you to team creation.",
      },
      "team-foundation": {
        title: "Found your amateur team",
        content:
          "The chosen name becomes your team's founding identity. Its country is permanent: it determines your first seven riders and influences the geographical priorities of future sponsors.\n\nYour amateur jersey can be changed later. Found the team to continue.",
      },
      "roster-overview": {
        title: "Meet your first roster",
        content:
          "Your amateur team starts with seven riders. This page brings together their age, profile, potential, contract and all their sporting attributes.",
      },
      "primary-ratings": {
        title: "Start with the primary attributes",
        content:
          "Focus first on MO, HIL, FL, COB, SP and TT. They immediately reveal a rider's preferred terrain.\n\nFlat stage → FL and SP\nMountain → MO\nHilly route → HIL\nCobbles → COB\nTime trial or prologue → TT and PRL",
      },
      "secondary-ratings": {
        title: "Then refine your analysis",
        content:
          "ACC, DH, STA, RES, REC, FTR and PRL are secondary attributes. They separate similar riders through acceleration, downhill ability, stamina, resistance, recovery, fighting spirit and prologue skill.\n\nAt first, identify the stage profile, then look at the matching primary attributes.",
      },
      calendar: {
        title: "Plan a 28-day season",
        content:
          "The calendar contains one-day races and stage races. Their category, profile and dates determine difficulty, prestige and available points.\n\nRegister your team and select riders suited to the route. The Discovery Criterium is available from the Tutorials menu and follows this same registration flow.",
      },
      reputation: {
        title: "Build your reputation",
        content:
          "Your reputation grows through results, objectives and sound management. From 30 points, sponsors may offer to turn your amateur team into a professional structure.",
      },
      "sponsoring-overview": {
        title: "Prepare to turn professional",
        content:
          "The market remains locked while your reputation is below 30. Once you reach the threshold, proposals include a budget, contract length and sporting or structural objectives.",
      },
      "sponsoring-demo-offer": {
        title: "Learn how to read an offer",
        content:
          "This proposal is a fictional preview: it cannot be signed and changes no data. Always compare the budget, duration and every objective. A generous offer may come with tougher commitments.",
      },
      complete: {
        title: "You have mastered the basics",
        content:
          "You have completed the Cyclo Stratège core tutorial.\n\nYou can now continue with the Discovery Criterium to select a team, assign tactical roles and follow your first live race without affecting your season. This tutorial remains available from the Tutorials menu.",
      },
    },
  },
  "criterium-discovery": {
    title: "Discovery Criterium",
    description:
      "Select your first squad, understand the AI's decisions and follow a fictional race in the real Live area.",
    steps: {
      briefing: {
        title: "Your first race, without risk",
        content:
          "Welcome to the Discovery Criterium. This fictional event uses the same engine and screens as an official race.\n\nIt awards no money, points or rewards, consumes no form, causes no fatigue and cannot create a lasting injury. Opponents are deliberately weak to give you every chance of a first victory.",
      },
      "course-profile": {
        title: "Read the profile first",
        content:
          "The course combines flat roads, hills, mountains and cobbles. Its profile shows which attributes to compare before choosing your five riders.\n\nIn a real race, always do this before registration: it reveals the natural leader, whether a sprinter is useful and how many domestiques are needed.",
      },
      "rider-selection": {
        title: "Select exactly five riders",
        content:
          "Select five available riders. For this mixed course, look for a complete squad: a strong hills or mountain rider for victory, a sprinter for a possible regrouping, then riders with good FL, STA and RES.\n\nYou can open each rider profile in a new tab.",
      },
      "role-guide": {
        title: "What tactical roles ask the AI to do",
        content:
          "Leader: the AI protects this rider for decisive sectors. Sprinter: the team increases the chase and prepares a bunch finish. Lead-out: works for the sprinter. Free role: prioritises breakaways. Domestique: spends more energy chasing and working for the team.",
      },
      "role-assignment": {
        title: "Assign your strategy",
        content:
          "Choose roles below the selected riders. Only one leader and one sprinter are allowed.\n\nWith Automatic, the AI analyses the profile and attributes: it chooses a sprinter when the finish looks favourable, then the best leader, a lead-out rider, a free role and domestiques.",
      },
      registration: {
        title: "Lock in your line-up",
        content:
          "When the five riders and their roles are ready, confirm registration with the highlighted button.\n\nAs in an official race, the line-up is locked. For this tutorial only, the simulation is calculated immediately and stored without changing your riders' sporting data.",
      },
      "registration-confirmed": {
        title: "Registration confirmed",
        content:
          "Your team is registered and the race appears in the calendar like a normal event. The key difference for your career is that no official settlement will run.\n\nSelect Next to open the replay in Results / Live.",
      },
      "live-overview": {
        title: "Welcome to Live",
        content:
          "This is the real race display: active profile, groups, gaps, commentary and finish animation.\n\nThe simulation is already locked. Replaying it or changing speed never recalculates the race and cannot alter the result.",
      },
      "replay-controls": {
        title: "Control the replay",
        content:
          "Play, pause or speed up to ×2 and ×4. You can also select a course segment to jump to that moment.\n\nWatch the groups evolve: assigned roles influence breakaways, the peloton chase and sprint preparation.",
      },
      classification: {
        title: "Analyse the standings",
        content:
          "Open Standings to see the finish order and gaps, then Active rules to review the engine principles.\n\nTutorial opponents are restricted and receive no bonuses, allowing one of your riders to challenge for first place.",
      },
      "formation-complete": {
        title: "Your first race is over",
        content:
          "You can now read a profile, select a squad, assign tactical roles and follow the live engine.\n\nThis race remains entirely fictional: no form, fatigue, injury, prize, point or reward was recorded. Select Finish in this panel to complete the practical tutorial.",
      },
    },
  },
  "medical-center": {
    title: "Mastering the Medical Centre",
    description:
      "Manage injuries and form, use nutrition, organise physiotherapist follow-up and oversee your medical team.",
    steps: {
      "medical-center-overview": {
        title: "Your health dashboard",
        content:
          "The Medical Centre contains every decision affecting rider availability and form. Five tabs cover injuries, form camps, nutrition, physiotherapist assignments and the medical-team summary.\n\nHeader indicators show injured riders, riders in camp, the current day and available cash.",
      },
      "injury-management": {
        title: "Follow every injury through to recovery",
        content:
          "An injured rider is automatically unavailable for racing and training. Their card shows the diagnosis, form, daily loss, remaining time and estimated return.\n\nDoctors reduce new injuries automatically. A fatigue injury caused by form dropping below zero always requires three rest days and cannot be shortened.",
      },
      "injury-protocols": {
        title: "Choose a treatment protocol",
        content:
          "Protocols balance cost against recovery speed. The catalogue remains visible when the infirmary is empty so you can plan your budget.\n\nOnly one protocol can be applied while at least 24 hours of recovery remain; the actual time saved is recalculated before confirmation.",
      },
      "form-management": {
        title: "Build and protect form",
        content:
          "Form represents a rider's current freshness. Without racing, injury, demanding training or a camp, they naturally recover 2 points each day. Low-intensity training, nutrition and some staff effects can increase recovery.\n\nForm is capped at 100, so time boosts around important objectives.",
      },
      "form-camps": {
        title: "Schedule a form camp",
        content:
          "Choose a standard camp (+10 form per day) or premium camp (+20), then select any future range of one to three days. Doctors add another 5% efficiency per combined level.\n\nThe inline schedule disables riders who are racing, injured or already in another camp. Select the available riders you want, then confirm the entire booking and its cost once from the floating bar.",
      },
      "nutrition-overview": {
        title: "Nutrition supports recovery",
        content:
          "Nutritionists provide a passive daily recovery bonus to the whole team and unlock immediate paid supplements for individual riders.\n\nRequirements, gains and prices vary. The effect is immediate, cannot exceed 100 form and each rider can receive only one intervention per day.",
      },
      "nutritionist-impact": {
        title: "Nutritionists determine cost, gain and capacity",
        content:
          "Each nutritionist has a daily capacity. Their level reduces supplement prices and may improve form gains; several nutritionists also combine their passive recovery support.\n\nChoose the specialist and check their daily counter before confirming.",
      },
      "physiotherapist-impact": {
        title: "Physiotherapists preserve form",
        content:
          "A physiotherapist protects assigned riders during races, training and injury days. Their level controls both capacity and the maximum form preserved, while at least 1 penalty point always remains.\n\nThe preview shows future settings even before you recruit one.",
      },
      "physiotherapist-assignments": {
        title: "Build follow-up lists",
        content:
          "Select riders without exceeding capacity, then save assignments. A rider can have only one physiotherapist at a time, and the selection can be changed later.\n\nThe preview is read-only until your first physiotherapist is recruited.",
      },
      "medical-staff-summary": {
        title: "Oversee the whole medical team",
        content:
          "The final tab summarises doctors, nutritionists and physiotherapists and their combined effects. Doctors now reduce injury recovery and add 5% form-camp efficiency per level.\n\nUse it to spot a missing profession, review combined effects and reach the staff market or the relevant operational tab.",
      },
      complete: {
        title: "Your medical department is ready",
        content:
          "You can now manage injuries and protocols, rebuild form, use nutrition, assign riders to physiotherapists and read the medical-team summary.\n\nSelect Finish to complete this tour. It remains available from the question mark in the Medical Centre.",
      },
    },
  },
  "roster-management": {
    title: "Managing your roster",
    description:
      "Read attributes and contracts, explore a complete rider profile and plan their season.",
    steps: {
      "roster-overview": {
        title: "Your roster control room",
        content:
          "This section contains every rider currently under contract. Attributes & contracts and Season plan answer two related questions: what qualities does your team have, and when will each rider be available?",
      },
      "roster-ratings": {
        title: "Compare attributes without losing sight of the profile",
        content:
          "Primary attributes describe decisive terrain: MO, HIL, FL, TT, COB and SP. Secondary attributes — ACC, DH, STA, RES, REC, FTR and PRL — refine rider behaviour.\n\nProfile and AVG are useful first indicators, but the best choice always depends on the course. Blue equipment bonuses are added to base attributes in compatible races.",
      },
      "roster-contracts": {
        title: "Read salary and expiry together",
        content:
          "Salary is displayed per week and per season and affects the team budget throughout the contract. Expiry shows the final covered season.\n\nPlan ahead: an extension secures the rider for the next season but also commits future budget.",
      },
      "open-first-rider": {
        title: "Move from the team to a rider",
        content:
          "Each name opens a detailed profile. To continue without making you choose at random, Next opens the first rider in your roster. In daily management, you can naturally open any rider.",
      },
      "rider-overview": {
        title: "The rider's sporting identity card",
        content:
          "The header shows age, nationality, team, potential, experience and career race days. These details put attributes into context: a young prospect and a veteran with the same current level are different sporting projects.",
      },
      "rider-experience-potential": {
        title: "Experience and talent shape a rider",
        content:
          "Race days count only events actually ridden: a classic is 1 day and each completed stage is 1 day; a non-starter gains none. Each day gives 0.2 experience, reaching 100 after 500 race days, and experience provides a measured race bonus.\n\nPotential sets the growth ceiling: every half-star adds 5 points to the AVG ceiling and improves training efficiency. It indicates how far a rider can develop, not their current strength.",
      },
      "rider-ratings": {
        title: "Attributes and radar tell the same story",
        content:
          "The detail lists every rider attribute. The radar translates them visually: peaks reveal dominant areas and dips expose weaknesses.\n\nUse exact values to compare close riders and the chart to understand their overall balance quickly.",
      },
      "rider-naturalization": {
        title: "Naturalisation follows strict rules",
        content:
          "A professional can be naturalised after three full seasons — 84 game days — spent continuously with the team. Their nationality then becomes the team's country.\n\nNaturalisation is impossible after winning a national road or time-trial title, which permanently binds the rider to their original country.",
      },
      "rider-form": {
        title: "Form measures current condition",
        content:
          "Form complements permanent attributes and shows how a rider will approach upcoming goals. Check it before an important race and balance rest, training and camps.\n\nThe training tutorial explains form and progression in detail.",
      },
      "rider-special-abilities": {
        title: "Special abilities complement attributes",
        content:
          "Medallions represent known or unlocked special abilities. They provide specific effects without replacing attributes.\n\nHover on desktop or select on mobile to read an ability when needed.",
      },
      "rider-season-program": {
        title: "Set the rhythm of the whole season",
        content:
          "The 28-day season plan combines races, camps, recon missions, injuries and other absences. Use it to identify sequences, prevent overlaps and prepare form peaks.\n\nSchedule major objectives, then leave enough time for training, recovery and camps.",
      },
      "rider-contract": {
        title: "Manage the contract before expiry",
        content:
          "The private profile shows salary and contract dates. When an extension is available, it displays the rider's request for the next season.\n\nRenewing secures the rider but reserves future roster space and budget; decide according to role, development and finances.",
      },
      "rider-history": {
        title: "Review the whole career",
        content:
          "History lists previous teams, victories, points, titles, notable results and UCI ranking season by season. Active team names link to their profile.\n\nThis helps distinguish theoretical promise from proven results.",
      },
      "rider-equipment": {
        title: "Equip the rider piece by piece",
        content:
          "Each slot accepts a specific category: helmet, glasses, gloves, shorts, frame, wheels or shoes. Choose an available item, drag it to the slot or use the fill button.\n\nActive bonuses are summarised below the rider and apply to compatible races.",
      },
      complete: {
        title: "Your roster is ready to manage",
        content:
          "You can now read attributes and contracts, assess experience and potential, check form and abilities, plan the season, review a career and equip a rider.\n\nSelect Finish to complete this tutorial; it remains available from the Roster and rider-profile question marks.",
      },
    },
  },
  training: {
    title: "Training and reconnaissance",
    description:
      "Control rider progression and form, analyse reports and prepare a race with reconnaissance.",
    steps: {
      "training-overview": {
        title: "Manage the daily session",
        content:
          "The Training tab contains settings applied every day at 8:00. A change saved before the session applies that day; after 8:00 it starts with the next session and remains active.\n\nInjury, a form camp or reconnaissance suspends the rider's session.",
      },
      "training-threshold": {
        title: "Protect form with the minimum threshold",
        content:
          "If a rider's form is below the threshold at session time, they do not train, gain no attributes and recover 2 form points.\n\nA high threshold protects the roster but slows progression. Always save after moving it.",
      },
      "training-staff": {
        title: "Read staff bonuses and limits",
        content:
          "Technical staff shows coaches, level, speciality and capacity. A coach improves progression in matching attributes; shared nationality with the rider adds another 5%.\n\nCapacity limits how many riders can be assigned at once.",
      },
      "training-rider-setup": {
        title: "Each rider has their own programme",
        content:
          "A programme combines intensity, focus and an optional coach. Settings remain active until changed, so adapt them to age, potential, qualities and season goals.",
      },
      "training-intensity": {
        title: "Trade form for progression with intensity",
        content:
          "Higher intensity gives more progression millipoints but reduces form above 50%: 60% costs 5 points, 80% costs 15 and 100% costs 25.\n\nAt 50%, form is stable. Below that, training is slower but can restore up to 2 form points at zero intensity.",
      },
      "training-domain": {
        title: "Use focus to direct gains",
        content:
          "The focus selects the main attributes trained: climber, puncheur, rouleur, sprinter, northern classics, fighter or stage races.\n\nOther attributes may still improve slowly. Match the focus to the profile you want to build, not only the rider's current strength.",
      },
      "training-trainer": {
        title: "Assign the right coach",
        content:
          "A coach strengthens gains in their speciality. Level controls the bonus and capacity limits assigned riders. National affinity adds 5% when coach and rider share a nationality.",
      },
      "training-save": {
        title: "Save all changes together",
        content:
          "You can edit several programmes before stopping. A floating bar shows the number of changed programmes and follows the page.\n\nSave them together when ready, or Cancel to restore initial settings. Unsaved changes never replace active programmes.",
      },
      "training-latest-report": {
        title: "Review the latest session",
        content:
          "Reports opens on the latest session: status, focus, intensity, form change, coach and physiotherapist, millipoints earned and any full-attribute increases.\n\nOpen it during the tour to inspect the rider's real values.",
      },
      "training-season-report": {
        title: "Take a step back with the season report",
        content:
          "The Season tab compares Day 1 attributes with current values. It totals completed or missed sessions, cumulative form impact, gained or lost attributes and the remaining decimal balance.\n\nUse it to check a programme over several days.",
      },
      "reconnaissance-overview": {
        title: "Prepare a future event precisely",
        content:
          "Reconnaissance studies a stage or classic before it takes place. It costs money but gives selected riders a bonus for that event.\n\nDefault duration is two days; some route specialists reduce it, improve the bonus or increase capacity.",
      },
      "reconnaissance-riders": {
        title: "Start by selecting riders",
        content:
          "Riders remain selectable even when unavailable today; the planner checks future races, injuries and camps.\n\nFor several riders, only eligible races with a common available period are kept. Respect the selected specialist's capacity.",
      },
      "reconnaissance-race": {
        title: "Choose the actual target event",
        content:
          "The calendar lists only future eligible races that all selected riders can prepare. Choose a stage of a tour or the relevant classic.\n\nFor that event only, participants receive the displayed bonus on all 13 race attributes, capped at 100.",
      },
      "reconnaissance-dates": {
        title: "Reserve a common period before the race",
        content:
          "After choosing the event, select an available preparation period. Occupied days and overlaps with the target tour are excluded automatically.\n\nParticipants cannot race or train during these dates and do not receive threshold rest recovery.",
      },
      "reconnaissance-validation": {
        title: "Check and confirm reconnaissance",
        content:
          "The summary shows race, stage, dates, bonus and cost. Confirmation becomes available when capacity, common dates and cash requirements are satisfied.\n\nConfirming permanently records the mission and rider unavailability.",
      },
      complete: {
        title: "Training and reconnaissance mastered",
        content:
          "You can now set the team threshold, prepare and save individual programmes, measure results in reports and organise compatible reconnaissance for a whole group.\n\nSelect Finish to complete this tutorial; it remains available from the Training question mark.",
      },
    },
  },
  staff: {
    title: "Building your staff",
    description:
      "Understand available slots, professions, the global market and the active effects of your specialists.",
    steps: {
      "staff-overview": {
        title: "The team behind your team",
        content:
          "Staff specialists improve your team and riders over time through training, scouting, medical care, racing, infrastructure or reputation.\n\nEach hire immediately costs a signing fee, followed by salary across the season's four payment dates.",
      },
      "staff-capacity": {
        title: "Your SD level opens staff slots",
        content:
          "Sports Director level sets the maximum number of active staff contracts: 1 slot at level 1, then 2, 3, 5, 7 and 10 at levels 2 to 6, rising later to 45.\n\nLevel gains open slots but never hire anyone automatically.",
      },
      "staff-tabs": {
        title: "Two complementary views",
        content:
          "The Job market is used to find and hire today's available profiles. Team staff summarises contracts, payroll and active effects.\n\nThis tutorial starts with the market, then opens your staff automatically.",
      },
      "staff-market": {
        title: "A shared global market",
        content:
          "Every day, 25 specialists arrive at midnight and another 25 are added at noon. All 50 profiles are shared by every Sports Director, and the whole market refreshes the following midnight. It remains first come, first served: once hired elsewhere, a profile disappears for everyone.\n\nWatch both waves and check open slots, the immediate fee and full-season budget.",
      },
      "staff-market-filters": {
        title: "Find the specialist you need",
        content:
          "Filter by profession, level, nationality or coach speciality. Recruited profiles disappear immediately. Combine filters and Reset to see all remaining profiles.\n\nLevels range from 1 to 5: higher levels have stronger effects, salaries and signing fees.",
      },
      "staff-professions": {
        title: "Eleven professions, eleven development levers",
        content:
          "Coaches improve rider training; scouts youth detection; doctors injury recovery; physiotherapists form protection; nutritionists recovery; mechanics mechanical-loss protection.\n\nRoute specialists improve reconnaissance, architects reduce infrastructure cost and time, community managers increase reputation gains, R&D engineers improve laboratory prototypes and staff educators optimise Trades Academy courses. Staff educators can only be recruited after that building has been constructed. Read every profile: two people in the same profession may provide different value.",
      },
      "staff-team": {
        title: "Manage active effects",
        content:
          "This tab shows used capacity, free slots, payroll and contracted specialists. Compatible effects can stack, and nationality affinities add efficiency.\n\nDismissal is immediate and costs only remaining salary instalments for the current season. An empty view is normal for a new team.",
      },
      complete: {
        title: "You can now build your support team",
        content:
          "You know how many specialists your level allows, how to filter the market, compare professions and effects, and review recruited staff.\n\nSelect Finish to complete this tutorial; it remains available from the Staff question mark.",
      },
    },
  },
  transfers: {
    title: "Mastering the Transfer Office",
    description:
      "Explore daily auctions, sales between Sports Directors and free-agent signings.",
    steps: {
      "transfer-overview": {
        title: "Three ways to strengthen your roster",
        content:
          "The Transfer Office contains all rider recruitment and sales. The header shows projected budget, funds reserved by leading bids, available cash, Data Room level and remaining roster slots.\n\nThe Data Room gradually narrows scouting estimates; it does not reveal every real value instantly.",
      },
      "transfer-tabs": {
        title: "Choose the right market",
        content:
          "Daily auctions feature new riders for one day. SD auctions let teams buy and sell between themselves for at least 24 hours. Free agents can be signed immediately with no transfer fee.\n\nThe tutorial visits these three areas in order.",
      },
      "daily-overview": {
        title: "New profiles every day",
        content:
          "Daily selection opens at 9:00, with an initial close at 18:00. Each group contains market-generated riders starting with 0 career race days.\n\nA bid placed in the final 10 minutes adds 30 minutes. The same rule applies again near every new deadline.",
      },
      "daily-bidding": {
        title: "Include every cost in your bid",
        content:
          "Each card shows the leading bid, next minimum, salary and time remaining. While you lead, the bid is reserved and reduces cash available elsewhere.\n\nAn accepted bid is binding: at closing, the highest bidder recruits the rider for this season and the next, provided roster space remains available.",
      },
      "director-selling": {
        title: "List a rider for at least 24 hours",
        content:
          "Choose an eligible rider, set the opening price and publish. The rider stays with your team until closing and transfers automatically if a bid exists. A bid in the final 10 minutes adds 30 minutes.\n\nA rider recruited during the season cannot be resold until the next; founding riders can be listed immediately.",
      },
      "director-market": {
        title: "Buy directly from other Sports Directors",
        content:
          "Other teams' listings work like daily auctions, with an initial duration of 24 hours. Compare scouting report, current price, salary and time before bidding.\n\nA bid in the final 10 minutes adds 30 minutes. You cannot bid on your own sale; finances and team ownership update automatically at closing.",
      },
      "free-agents-overview": {
        title: "Sign without a transfer fee",
        content:
          "Teamless riders are immediately available with no auction or fee. Salary is known and the contract covers this season and the next.\n\nScouting accuracy still applies. Signing immediately uses one roster slot and commits the salary.",
      },
      "free-agent-filters": {
        title: "Narrow the list to useful profiles",
        content:
          "Combine profile, nationality, age and a minimum estimated attribute. The attribute filter can use AVG or a specific quality.\n\nReports remain imperfect, so use thresholds to shortlist candidates, then compare profile and cost.",
      },
      "free-agent-signing": {
        title: "Check your roster before signing",
        content:
          "Each card summarises the report and salary request. The signing button is disabled when the roster is full; free a slot first.\n\nSigning is immediate, with no auction delay or closing decision.",
      },
      complete: {
        title: "The Transfer Office is mastered",
        content:
          "You can now read financial capacity, bid in daily auctions, buy or sell with another Sports Director, and filter and sign a free agent.\n\nSelect Finish to complete this tutorial; it remains available from the Transfer Office question mark.",
      },
    },
  },
  equipment: {
    title: "Mastering equipment",
    description:
      "Compare commercial equipment, understand supplier contracts and equip riders from their profile.",
    steps: {
      "equipment-commercial-overview": {
        title: "Equipment transforms rider qualities",
        content:
          "The commercial shop sells eight equipment families: helmet, gloves, shorts, glasses, shoes, front and rear wheels, and frame.\n\nEach item enters team inventory, can be worn by one rider at a time and adds compatible effects to base attributes.",
      },
      "equipment-commercial-brands": {
        title: "Compare brand philosophies",
        content:
          "Commercial brands offer different ranges and prices. Filter by brand to compare versatility, mountain, sprint, time trial, protection or prestige.\n\nAdd several references and quantities to the cart: cash is only deducted when the whole order is paid, then every item joins your inventory.",
      },
      "equipment-commercial-filters": {
        title: "Find the right item with filters",
        content:
          "Filter by slot, then desired effect. MO, HIL, FL, TT, COB, SP, ACC, DH, STA, RES, REC and PRL match rider attributes; other filters cover protection and reputation.\n\nYou can combine brand, category and effect.",
      },
      "equipment-commercial-products": {
        title: "Read gains before buying",
        content:
          "Each card states price, rarity, slot and exact gains. Attribute bonuses add to rider values; conditional effects such as time-trial-only bonuses activate only in the stated situation.\n\nSeveral equipped items can stack their effects.",
      },
      "equipment-partner-overview": {
        title: "A supplier is a team partnership",
        content:
          "Once reputation is high enough, your team can sign a supplier for free. Each brand has its own philosophy; its allocation is available without quantity limits for the whole contract.\n\nSupplier references stay outside inventory as temporary usage rights. Unique prototypes are developed separately in your R&D Lab.",
      },
      "equipment-partner-rules": {
        title: "A two-season technical commitment",
        content:
          "The contract is free but irreversible, lasts two seasons and cannot be renewed with the same brand. The whole allocation is removed at expiry.\n\nR&D is handled only in your own laboratory using stock items.",
      },
      "equipment-partner-workflow": {
        title: "Content adapts to your situation",
        content:
          "Below 200 reputation, this area shows unlock progress. Once reached, it compares available partners. After signing, it lists the allocation; the R&D Lab has its own Equipment tab.\n\nA brand already used cannot be selected again.",
      },
      "equipment-inventory-overview": {
        title: "All your equipment is in inventory",
        content:
          "Inventory contains commercial purchases, equipment rewards and earned items. Counters distinguish owned, available, equipped and scheduled copies.\n\nA free pair of Tutorial Glasses has been added for this welcome tour. It gives +1 STA to its wearer.",
      },
      "equipment-inventory-categories": {
        title: "Show available equipment",
        content:
          "The Equipment category shows only items actually owned. Each card gives free quantity, current wearers and resale value.\n\nSupplier references do not use inventory and remain unlimited from rider profiles while the contract is active.",
      },
      "equipment-welcome-gift": {
        title: "Try your Tutorial Glasses",
        content:
          "Open Choose from roster, compare the displayed attributes, select a rider and choose Equip this item. If Glasses is occupied, the row changes colour and names the replaced piece.\n\nYou can try it now and return to the panel. This gift is awarded only once, even when replaying the tutorial.",
      },
      "equipment-unequip": {
        title: "Equip or remove without losing the item",
        content:
          "From a rider profile, drag an item to the highlighted slot or use Fill this slot. Remove equipment frees the slot and returns the item to inventory availability.\n\nFrom five minutes before the start until the rider finishes, equipment is locked to protect the simulation.",
      },
      complete: {
        title: "Your workshop is ready",
        content:
          "You can now buy and filter commercial equipment, understand supplier contracts, read gains, find an item's owners and equip or unequip riders.\n\nSelect Finish to complete this tutorial; it remains available from Equipment, Supplier and Inventory question marks.",
      },
    },
  },
  infrastructure: {
    title: "Developing infrastructure",
    description:
      "Explore active buildings, manage construction and understand the global effect of cycling schools.",
    steps: {
      "infrastructure-overview": {
        title: "Long-term, costly investments",
        content:
          "Infrastructure follows your team across seasons. Construction is reserved for Sports Directors at level 10 or above and requires significant cash.\n\nThe header summarises balance, available architects, active construction and Skills Academy level.",
      },
      "construction-rules": {
        title: "Only one construction project at a time",
        content:
          "A project blocks all others until delivery. Cost is paid at launch and duration uses game days.\n\nAn architect is optional, but speciality and level may reduce cost, time or both. New effects begin only after completion.",
      },
      "infrastructure-tabs": {
        title: "Two complementary families",
        content:
          "Team buildings contains the Data Room and Skills Academy, whose effects belong to your team. International School shows a global network funded by every team.\n\nThe tour begins with internal buildings, then opens the school map.",
      },
      "recruitment-data-room": {
        title: "The Data Room makes recruitment more reliable",
        content:
          "Its three levels progressively reduce uncertainty in Transfer Office reports. Level 1 reveals three exact attributes, level 2 reveals five and removes unknowns, and level 3 reveals seven with tight ranges.\n\nIt improves information but never changes a rider's real qualities.",
      },
      "staff-academy": {
        title: "The Skills Academy develops staff",
        content:
          "This high-level building sends staff or coaches on courses to add a star or available talent line. The new bonus arrives at course end while existing effects remain active.\n\nEach Academy level adds a simultaneous course, up to five; price and duration rise with member level and improvement complexity.",
      },
      "international-school-effect": {
        title: "Schools improve youth from their country",
        content:
          "Each centre star in a country adds a 10-point chance that a scouted youth there gains a full potential star. Contributions stack globally up to 90%.\n\nThe effect applies when the youth is generated and never changes already discovered riders.",
      },
      "international-school-map": {
        title: "Choose the country before investing",
        content:
          "The map shows centres funded by the community. Select a country to see global stars, shared chance and teams with a school there.\n\nYour centre can reach five levels; each upgrade costs more, takes longer and follows the one-project rule.",
      },
      "international-school-strategy": {
        title: "Concentrate or diversify your network",
        content:
          "Strengthening an established country quickly improves a shared probability, while opening in an uncovered nation creates a new improved scouting area.\n\nThe bonus belongs to the country, not the paying team: every SD benefits when scouting there.",
      },
      complete: {
        title: "Your infrastructure strategy is ready",
        content:
          "You can now plan construction, use an architect, distinguish the Data Room and Skills Academy, and understand international-school building and shared bonuses.\n\nSelect Finish to complete this tutorial; it remains available from the Infrastructure question mark.",
      },
    },
  },
  "youth-development": {
    title: "Developing tomorrow's talent",
    description:
      "Explore the global network, simulate scouting, analyse a report and discover the school and junior training.",
    steps: {
      "youth-overview": {
        title: "From scouting to the professional team",
        content:
          "Youth Development follows the whole journey: scout detection, report review, school signing, daily training and promotion to the first team.\n\nThis tour uses fictional data only, so the highlighted controls never affect your budget, staff or juniors.",
      },
      "youth-tabs": {
        title: "Three areas for three stages",
        content:
          "Scouting contains the map, missions and reports. Cycling School contains signed youth and training settings. Development Team forms a junior roster on Days 1–7, then races its own calendar without live events.\n\nThe tour starts with detection and later opens the school.",
      },
      "youth-world-map": {
        title: "The world map opens a global network",
        content:
          "Each point is an explorable country. Select the map or list to see reputation, local facilities and training traditions.\n\nSpecialities improve the chance of certain profiles but never guarantee report contents.",
      },
      "youth-country-filter": {
        title: "Filter before choosing an area",
        content:
          "Search accepts country name or code. Shortcuts below the map show the first results and quickly change areas.\n\nTry a filter or another point: country details update without starting a mission.",
      },
      "youth-fake-mission": {
        title: "Launch a completely fictional mission",
        content:
          "The tour provides demo scout Camille Moreau even if your staff has no scout. Choose a duration and select Simulate departure.\n\nIn the real game, assign an available scout. Level improves youth quality and shared nationality with the target country adds 15% efficiency.",
      },
      "youth-delays": {
        title: "Time is counted in season days",
        content:
          "A mission lasts 3 to 7 complete days. Starting on Day 12 for three days delivers on Day 15. It cannot go beyond Day 28 and the scout stays unavailable.\n\nLonger missions slightly improve potential chances but occupy the scout longer. Reports contain one to four youths.",
      },
      "youth-report": {
        title: "Analyse certainties and unknowns",
        content:
          "The fictional report shows overall projection, potential and 13 attributes. An exact value is known, a range is estimated and ? means insufficient information.\n\nStart with potential and profile-defining attributes, then check weaknesses, signing bonus and annual costs.",
      },
      "youth-signing": {
        title: "Signing opens the school doors",
        content:
          "Signing immediately pays the welcome fee, then adds tuition for every school season. In a real mission, the candidate moves to Cycling School.\n\nNo money is spent here. Select Next to follow this fictional youth into the demo school.",
      },
      "youth-academy": {
        title: "The school brings every prospect together",
        content:
          "Each card shows age, nationality, potential, projected attributes, schooling and status. Notifications flag promotions, expiries and administrative decisions.\n\nFrom age 17, a youth can be scheduled for next season's first team if a slot remains.",
      },
      "youth-training-settings": {
        title: "Choose training mode and profile",
        content:
          "Automatic mode calculates one session every morning at 8:00 with no assignable coach. Manual mode opens midnight–noon and noon–midnight slots.\n\nTalent is decisive and development remains continuous: an already excellent attribute improves more slowly without being blocked, while rare excellent or poor sessions add some variation. Two good manual sessions yield about 40% more than an automatic day. The chosen profile sets trained attributes and minigame. Changes start the next day; a missed manual slot is never replaced automatically.",
      },
      "youth-minigame": {
        title: "Try the minigame for the selected profile",
        content:
          "Each profile has a challenge: Cadence for climbers, The bump for puncheurs, Whack-a-mole for northern classics, Breakaway for fighters, Left/right for sprinters and Aero zone for rouleurs.\n\nThe real 30-second session scores up to 1000 and converts it to progression based on potential and current attributes. This demo saves nothing.",
      },
      complete: {
        title: "Your development pathway is ready",
        content:
          "You can now filter the map, launch and time a mission, read a report, sign a candidate and choose automatic training or manual school minigames.\n\nSelect Finish to complete this tutorial; it remains available from the Youth Development question mark.",
      },
    },
  },
};

export function localizeTutorialDefinition(
  definition: TutorialDefinition,
  locale: AppLocale,
): TutorialDefinition {
  if (locale !== "en") {
    return definition;
  }

  const copy = ENGLISH_TUTORIAL_COPY[definition.key];
  if (!copy) {
    return definition;
  }

  return {
    ...definition,
    title: copy.title,
    description: copy.description,
    steps: definition.steps.map((step) => ({
      ...step,
      title: copy.steps[step.key]?.title ?? step.title,
      content: copy.steps[step.key]?.content ?? step.content,
    })),
  };
}

export function getMissingEnglishTutorialStepKeys(
  definitions: readonly TutorialDefinition[],
): string[] {
  return definitions.flatMap((definition) => {
    const copy = ENGLISH_TUTORIAL_COPY[definition.key];

    if (!copy) {
      return [`${definition.key}:*`];
    }

    return definition.steps
      .filter((step) => !copy.steps[step.key])
      .map((step) => `${definition.key}:${step.key}`);
  });
}
