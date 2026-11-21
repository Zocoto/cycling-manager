import type { AppLocale } from "@/lib/i18n/config";

export const PUBLIC_GUIDE_SLUGS = ["premieres-courses", "entrainement-forme", "recrutement-budget"] as const;
export type PublicGuideSlug = typeof PUBLIC_GUIDE_SLUGS[number];

type GuideCopy = {
  title: string;
  description: string;
  introduction: string;
  sections: { title: string; paragraphs: string[]; advice: string }[];
};

const guides: Record<PublicGuideSlug, Record<AppLocale, GuideCopy>> = {
  "premieres-courses": {
    fr: {
      title: "Préparer ses premières courses dans Cyclo Stratège",
      description: "Choisir une course, composer son équipe et donner les bons rôles : les étapes pour débuter dans le jeu de management cycliste Cyclo Stratège.",
      introduction: "Une course commence sur le bureau du Directeur Sportif. Le choix du parcours, les coureurs engagés et les consignes déterminent le projet de l’équipe. Voici comment préparer un premier départ et tirer des enseignements de l’arrivée.",
      sections: [
        {
          title: "Choisir un parcours adapté à son effectif",
          paragraphs: ["Ouvrez le calendrier et regardez le profil des épreuves accessibles à votre équipe. Une arrivée au sprint, des pavés et une longue ascension ne demandent pas les mêmes qualités. Commencez par repérer le terrain sur lequel vos meilleurs coureurs sont à l’aise.", "Sur un tour, observez l’ensemble des étapes. Engager un bon sprinteur peut servir à chercher une victoire d’étape ; viser le classement général demande aussi de traverser les journées moins favorables. Le calendrier doit laisser des possibilités de récupération entre les objectifs."],
          advice: "Choisissez d’abord une course qui convient à vos coureurs, puis définissez l’objectif sportif.",
        },
        {
          title: "Composer un collectif en bonne condition",
          paragraphs: ["Dans la sélection des engagés, comparez les caractéristiques utiles au parcours et les deux dimensions de la santé du coureur : sa forme physique et son moral. Une excellente note de montagne ne suffit pas à résumer sa situation du jour.", "Regardez aussi les jours de course déjà accumulés dans la saison. Alterner les engagements et prévoir du repos permet de conserver un groupe disponible. Gardez des équipiers capables d’accompagner le leader sur le terrain où la course devrait se décider."],
          advice: "Comparez les qualités sportives avec l’état actuel du coureur avant de confirmer l’inscription.",
        },
        {
          title: "Donner un rôle clair à chaque coureur",
          paragraphs: ["Dans la préparation de course, choisissez le leader à soutenir et répartissez les autres missions. Le rôle de sprinteur répond à un objectif d’arrivée groupée ; les équipiers participent au travail collectif. Un électron libre dispose d’un projet plus indépendant.", "Les consignes doivent raconter la même stratégie que votre sélection. Préparez aussi le matériel et, lorsque cette option est disponible et utile, la reconnaissance du parcours. Revenez vérifier les réglages avant la fermeture de la préparation."],
          advice: "Un leader, un objectif et des missions cohérentes rendent la préparation plus facile à suivre.",
        },
        {
          title: "Lire l’arrivée et préparer la course suivante",
          paragraphs: ["Suivez la simulation ou consultez le résultat et le journal de course. Reconstituez le déroulement : échappée, dépense d’énergie, terrain décisif, incidents et composition des groupes. La place finale se comprend avec ce contexte.", "Après la course, contrôlez la forme, le moral et la disponibilité des coureurs. Vous pourrez adapter le prochain engagement, laisser récupérer un leader ou confier une autre mission à un équipier. Les premières courses servent aussi à apprendre à connaître votre effectif."],
          advice: "Évaluez la préparation à partir des faits de course et de l’objectif de départ.",
        },
      ],
    },
    en: {
      title: "Prepare your first races in Cyclo Stratège",
      description: "Choose a race, build your squad and assign rider roles: a practical introduction to racing in the free online cycling management game Cyclo Stratège.",
      introduction: "A race starts at the sports director’s desk. The route, the riders you enter and their instructions shape the team’s plan. Here is how to prepare your first start and learn from the finish.",
      sections: [
        {
          title: "Choose a route that suits your squad",
          paragraphs: ["Open the calendar and check the profiles of the events available to your team. A sprint finish, cobbles and a long climb demand different strengths. Start by identifying the terrain on which your best riders feel at home.", "For a stage race, look at the entire route. A good sprinter can target a stage win; a general classification contender also needs to get through the less favourable days. Your calendar should leave room for recovery between targets."],
          advice: "Choose a race that fits your riders, then define your sporting goal.",
        },
        {
          title: "Enter a squad in good condition",
          paragraphs: ["When selecting riders, compare the attributes that matter for the route and both sides of rider health: physical form and morale. An excellent climbing rating alone does not describe a rider’s condition on the day.", "Check the race days already accumulated this season. Rotating your squad and planning rest helps keep riders available. Include teammates who can support your leader on the terrain likely to decide the race."],
          advice: "Compare sporting strengths with the rider’s current condition before confirming the entry.",
        },
        {
          title: "Give every rider a clear role",
          paragraphs: ["In race preparation, choose the leader you want to support and distribute the remaining jobs. A sprinter role suits a bunch-finish target; teammates contribute to the collective effort. A free rider has a more independent brief.", "Your instructions should follow the same plan as your selection. Prepare equipment too and, when available and useful, reconnoitre the route. Check your settings again before preparation closes."],
          advice: "One leader, a clear goal and consistent rider jobs make your plan easier to follow.",
        },
        {
          title: "Read the result and plan the next race",
          paragraphs: ["Watch the simulation or read the result and race journal. Reconstruct what happened: the breakaway, energy use, decisive terrain, incidents and group composition. The finishing position makes sense in that context.", "After the race, review rider form, morale and availability. You can adapt the next entry, let a leader recover or give a teammate a different job. Your first races are also a way to get to know your squad."],
          advice: "Judge your preparation using the race events and your original goal.",
        },
      ],
    },
  },
  "entrainement-forme": {
    fr: {
      title: "Entraînement, forme et moral : faire progresser ses coureurs",
      description: "Comprendre l’entraînement, préserver la forme et suivre le moral de ses coureurs dans Cyclo Stratège, le jeu gratuit de gestion d’équipe cycliste.",
      introduction: "Développer un coureur consiste à choisir les qualités à travailler tout en conservant un athlète prêt à courir. La progression se construit avec l’entraînement, le staff, la récupération et un calendrier adapté.",
      sections: [
        {
          title: "Choisir les qualités qui servent le profil",
          paragraphs: ["Commencez par lire les caractéristiques et le profil naturel du coureur. Un grimpeur, un spécialiste des pavés et un sprinteur n’ont pas les mêmes priorités. Le domaine d’entraînement doit accompagner les courses que vous souhaitez lui confier.", "Le potentiel encadre la progression par l’entraînement. Lorsqu’une caractéristique atteint son palier, revenez sur le programme et cherchez les qualités complémentaires qui peuvent encore évoluer. Un programme utile en début de saison mérite d’être réexaminé ensuite."],
          advice: "Comparez régulièrement les notes et les paliers avec le domaine d’entraînement choisi.",
        },
        {
          title: "Ajuster la charge à l’état du coureur",
          paragraphs: ["L’intensité est un choix de gestion. Regardez la forme physique avant de demander un effort important et tenez compte des courses à venir. Accumuler les sollicitations complique la préparation d’un objectif proche.", "La rubrique d’entraînement permet de revoir les réglages de chaque coureur et son encadrement. Vérifiez les choix enregistrés avant de valider. Après une période chargée, prévoir de la récupération fait partie du programme sportif."],
          advice: "Préparez la charge d’entraînement avec le calendrier des courses sous les yeux.",
        },
        {
          title: "Utiliser le staff et les infrastructures",
          paragraphs: ["Un entraîneur adapté accompagne la progression du coureur. Le staff médical et les installations de soin répondent à d’autres besoins : blessures, récupération ou préparation physique. Chaque poste doit correspondre à un besoin identifiable de l’équipe.", "Les bâtiments ouvrent progressivement de nouvelles possibilités. Avant de construire ou de recruter, vérifiez le coût, le délai, les places disponibles et la fréquence à laquelle vous utiliserez réellement le service."],
          advice: "Développez d’abord les moyens que votre effectif utilisera régulièrement.",
        },
        {
          title: "Suivre ensemble la forme et le moral",
          paragraphs: ["La forme et le moral sont deux informations complémentaires. La première décrit la condition physique ; le second reflète aussi la vie du coureur dans l’équipe et son expérience sportive. Suivez leur évolution sur la fiche du coureur et dans l’effectif.", "Les jours de course, les résultats et les décisions de gestion peuvent modifier la situation. Consulter le détail des variations aide à comprendre ce qui a changé. Utilisez ensuite les engagements, la récupération et les outils disponibles pour préparer la suite."],
          advice: "Réévaluez l’état du coureur après les courses et avant de lui fixer un nouvel objectif.",
        },
      ],
    },
    en: {
      title: "Training, form and morale: develop your riders",
      description: "Understand training, preserve physical form and track rider morale in Cyclo Stratège, the free online cycling team management game.",
      introduction: "Developing a rider means choosing what to improve while keeping an athlete ready to race. Progress comes from training, staff, recovery and a calendar that fits the rider.",
      sections: [
        {
          title: "Train the strengths your rider needs",
          paragraphs: ["Start with the rider’s attributes and natural profile. A climber, a cobbled classics specialist and a sprinter have different priorities. The training domain should support the races you want the rider to tackle.", "Potential limits development through training. When an attribute reaches its ceiling, revisit the programme and look for complementary strengths that can still improve. A useful early-season programme deserves another look later on."],
          advice: "Regularly compare attributes and ceilings with the selected training domain.",
        },
        {
          title: "Match workload to condition",
          paragraphs: ["Intensity is a management decision. Check physical form before asking for a major effort, and consider upcoming races. A heavy accumulated workload can make a nearby target harder to prepare for.", "The training section lets you review each rider’s settings and coaching. Check the saved choices before confirming. After a busy period, scheduling recovery is part of the sporting plan."],
          advice: "Plan training load with the race calendar in view.",
        },
        {
          title: "Use staff and facilities purposefully",
          paragraphs: ["A suitable coach supports rider development. Medical staff and care facilities address other needs, including injuries, recovery and physical preparation. Each appointment should answer an identifiable need in your squad.", "Facilities gradually unlock more options. Before building or recruiting, check the cost, completion time, available capacity and how often your team will actually use the service."],
          advice: "Develop the services your squad will use regularly first.",
        },
        {
          title: "Read form and morale together",
          paragraphs: ["Form and morale provide complementary information. Form describes physical condition; morale also reflects life in the team and the rider’s sporting experience. Follow both on the rider profile and roster.", "Race days, results and management decisions can change a rider’s situation. Reading the explanation of changes helps you understand what happened. Then use race entries, recovery and the available tools to prepare what comes next."],
          advice: "Review rider condition after racing and before setting the next target.",
        },
      ],
    },
  },
  "recrutement-budget": {
    fr: {
      title: "Recruter des coureurs et construire un budget durable",
      description: "Évaluer un recrutement, suivre les contrats et financer la progression de son équipe dans le jeu de management cycliste gratuit Cyclo Stratège.",
      introduction: "Un recrutement réussi complète le projet sportif et reste compatible avec les moyens du club. Avant de renforcer votre équipe, prenez le temps de définir le besoin, de comparer les candidats et de mesurer les engagements à venir.",
      sections: [
        {
          title: "Définir le rôle à pourvoir",
          paragraphs: ["Examinez votre effectif et les courses que vous souhaitez disputer. Vous pouvez avoir besoin d’un leader sur un terrain précis, d’équipiers pour le soutenir ou d’un jeune à développer. Ce besoin donne un sens aux comparaisons entre les candidats.", "Lisez les notes utiles au rôle, le profil, l’âge et le potentiel. Un coureur complète aussi un collectif existant : cherchez ce qu’il apportera aux autres et quelles occasions vous pourrez lui offrir."],
          advice: "Écrivez le rôle du futur recruté avant de choisir un nom.",
        },
        {
          title: "Comparer le coût complet du recrutement",
          paragraphs: ["Regardez le montant nécessaire à l’arrivée du coureur, puis les conditions de son contrat et les salaires à venir. La trésorerie du jour et la capacité à financer toute la saison sont deux lectures complémentaires.", "Gardez une marge pour les engagements, les besoins du staff et le développement du club. Vérifiez aussi la capacité de votre effectif et les dates du contrat au moment de confirmer une signature."],
          advice: "Comparez le prix d’arrivée avec les dépenses récurrentes qu’il entraîne.",
        },
        {
          title: "Faire une place aux jeunes et au scouting",
          paragraphs: ["Le scouting et l’école de cyclisme permettent de préparer l’avenir. Un rapport aide à apprécier un jeune dans le contexte de votre projet de formation. Recrutez les profils auxquels vous pourrez proposer un encadrement et des perspectives de progression.", "La Dev Team prolonge cette logique avec son propre programme sportif. Les jeunes, le staff et les infrastructures forment un ensemble : leur développement demande du temps et une place dans votre budget."],
          advice: "Reliez chaque recrutement junior à un vrai projet de formation.",
        },
        {
          title: "Faire évoluer le club avec les revenus disponibles",
          paragraphs: ["Les sponsors, les résultats et les autres recettes du jeu soutiennent la progression du club. Consultez les finances pour comprendre les entrées, les dépenses et la projection. Les objectifs sponsor vous donnent aussi des engagements à suivre pendant la saison.", "Avant un chantier ou un nouveau membre du staff, demandez-vous quel problème il résout aujourd’hui et ce qu’il permettra demain. Une progression régulière laisse plus de liberté pour saisir une bonne occasion de recrutement."],
          advice: "Réservez une marge de fonctionnement avant d’engager un nouveau projet.",
        },
      ],
    },
    en: {
      title: "Recruit riders and build a sustainable team budget",
      description: "Evaluate signings, follow contracts and fund your squad’s development in Cyclo Stratège, the free online cycling management game.",
      introduction: "A successful signing fits your sporting project and your club’s resources. Before strengthening the team, define the need, compare candidates and consider the commitments ahead.",
      sections: [
        {
          title: "Define the job you need to fill",
          paragraphs: ["Review your roster and the races you want to enter. You may need a leader for particular terrain, teammates to support that leader or a young prospect to develop. That need gives your comparison between candidates a purpose.", "Look at the attributes relevant to the role, the rider’s profile, age and potential. A signing also joins an existing group: consider what the rider brings to teammates and which opportunities your team can offer."],
          advice: "Write down the new rider’s job before choosing a name.",
        },
        {
          title: "Compare the full cost of a signing",
          paragraphs: ["Check the amount needed to bring in the rider, then the contract terms and future wages. Today’s cash balance and the ability to fund an entire season are complementary views of your finances.", "Keep room for entries, staff needs and club development. Also check roster capacity and contract dates before confirming a signing."],
          advice: "Compare the upfront cost with the recurring expenses it creates.",
        },
        {
          title: "Make room for youth development and scouting",
          paragraphs: ["Scouting and the cycling school help you prepare for the future. A report helps you assess a young rider in the context of your development project. Recruit prospects you can give proper support and opportunities to improve.", "The Dev Team extends that approach with its own race programme. Young riders, staff and facilities work together: developing them takes time and a place in your budget."],
          advice: "Give every junior signing a real development plan.",
        },
        {
          title: "Grow the club with the income available",
          paragraphs: ["Sponsors, race results and other game income support club development. Review the finances to understand income, expenses and the projection. Sponsor objectives also set commitments to follow throughout the season.", "Before starting construction or adding staff, consider which need it addresses today and what it unlocks tomorrow. Steady development gives you more freedom to act when a good signing opportunity appears."],
          advice: "Keep an operating reserve before committing to another project.",
        },
      ],
    },
  },
};

export function isPublicGuideSlug(value: string): value is PublicGuideSlug {
  return PUBLIC_GUIDE_SLUGS.some(slug => slug === value);
}

export function getPublicGuide(slug: PublicGuideSlug, locale: AppLocale): GuideCopy {
  return guides[slug][locale];
}
