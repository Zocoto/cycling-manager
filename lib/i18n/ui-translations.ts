import generatedCatalog from "@/lib/i18n/generated-fr-en.json";

const REVIEWED_TRANSLATIONS: Record<string, string> = {
  "Sous-poids": "Underweight",
  "Sous-poids pour le profil": "Underweight for the profile",
  "poids minimal": "minimum weight",
  "manque de puissance sur pavés, plat/sprint et CLM": "reduced power on cobbles, flat/sprint courses and time trials",
  "coureur trop léger pour son profil": "rider too light for their profile",
  "coureurs trop légers pour leur profil": "riders too light for their profile",
  "Un programme d’athlétisation peut les aider.": "A strength-building programme can help them.",
  "Ajuster le poids": "Adjust weight",
  "· optionnel": "· optional",
  "Affûtage / athlétisation": "Weight cutting / strength building",
  "±0,2 à 1 kg · −4 forme par 0,2 kg · un programme tous les 5 jours, dans les deux sens.": "±0.2 to 1 kg · −4 form per 0.2 kg · one programme every 5 days, shared by both directions.",
  "Programme de poids": "Weight programme",
  "Aucun programme": "No programme",
  "Affûtage · alléger": "Weight cutting · slim down",
  "Athlétisation · renforcer": "Strength building · gain weight",
  "Poids / coût en forme": "Weight / form cost",
  "Variation de poids et coût en forme": "Weight change and form cost",
  "Forme insuffisante ou limite de poids atteinte : ajustez la sélection.": "Insufficient form or weight limit reached: adjust your selection.",
  "Un poids trop faible réduit la puissance de ce profil. L’athlétisation peut aider.": "Being too light reduces this profile’s power. Strength building can help.",
  "L’affûtage peut réduire le surpoids. Évitez de descendre sous le poids adapté au profil.": "Weight cutting can reduce excess weight. Avoid going below your profile’s suitable weight.",
  "Vérifiez la forme ou le délai des ajustements de poids.": "Check form or the weight programme cooldown.",
  "Tout valider": "Confirm all",
  "Valider le choix": "Confirm selection",
  "Sous-poids des profils de puissance": "Underweight power specialists",
  "Un rouleur, pavéman ou sprinteur trop léger manque de puissance sur pavés, plat/sprint et CLM. Sous le seuil ci-dessous, le bonus éventuel diminue sur un point d’IMC et un malus progresse immédiatement, avec les mêmes pentes et plafonds que dans le barème précédent. Les autres profils ne reçoivent pas ce malus de sous-poids.": "A rouleur, cobbles specialist or sprinter who is too light lacks power on cobbles, flat/sprint courses and time trials. Below the threshold shown, any bonus fades over one BMI point and a penalty immediately increases, using the slopes and caps in the previous scale. Other profiles do not receive this underweight penalty.",
  "Poids minimal sans alerte de sous-poids": "Minimum weight without an underweight warning",
  "IMC minimal ≈": "Minimum BMI ≈",
  "Dans la rubrique nutrition, « Ajuster le poids » est optionnel : affûtage pour alléger, athlétisation pour renforcer. Chaque programme ajuste de 0,2 à 1 kg et coûte 4 points de forme par 0,2 kg, sans frais supplémentaires. Les deux sens partagent un délai de cinq jours par coureur. Compléments et programmes se valident ensemble dans la barre flottante ; la forme gagnée par le complément est prise en compte.": "In the nutrition section, ‘Adjust weight’ is optional: weight cutting to slim down, strength building to gain weight. Each programme adjusts 0.2 to 1 kg and costs 4 form points per 0.2 kg, with no extra fee. Both directions share a five-day cooldown per rider. Supplements and programmes are confirmed together in the floating bar; form gained from the supplement counts.",
  "Aucun nouveau spécialiste de puissance ne commence en sous-poids. Les morphologies restent variées : environ 5 % des futurs coureurs peuvent naître avec un léger surpoids, de +0,15 à +0,75 d’IMC au-dessus du seuil de leur profil. Les variations liées aux compléments et aux programmes restent sous votre responsabilité.": "No new power specialist starts underweight. Physiques remain varied: about 5% of future riders can be born slightly overweight, from +0.15 to +0.75 BMI above their profile’s threshold. Changes from supplements and programmes remain your responsibility.",
  "Avec un nutritionniste actif, l’affûtage allège et l’athlétisation renforce le coureur de 0,2 à 1 kg. Les deux sens partagent un délai de cinq jours ; chaque tranche de 0,2 kg coûte 4 points de forme. Ces programmes restent optionnels dans la rubrique nutrition et se valident avec les compléments. La perte de poids est limitée par un poids de sécurité ; la prise de poids ne peut dépasser 120 kg.": "With an active nutritionist, weight cutting slims down and strength building increases a rider’s weight by 0.2 to 1 kg. Both directions share a five-day cooldown; each 0.2 kg costs 4 form points. These programmes are optional in nutrition and are confirmed with supplements. Weight loss is limited by a safety weight; weight gain cannot exceed 120 kg.",
  "Poids et surpoids : seuils et barème": "Weight and overweight: thresholds and scale",
  "Le seuil dépend du profil naturel et de la taille du coureur, pas de son rôle en course ni de son équipement. Ce sont des seuils sportifs propres au jeu, pas des classifications médicales. L’IMC correspond au poids divisé par la taille en mètres au carré.": "The threshold depends on the rider’s natural profile and height, not their race role or equipment. These are sporting thresholds specific to the game, not medical classifications. BMI is weight divided by height in metres squared.",
  "Début de l’alerte de surpoids": "Overweight warning threshold",
  "Profil naturel": "Natural profile",
  "IMC limite ≈": "BMI limit ≈",
  "Les poids indiquent le premier dixième déclenchant l’alerte. Les IMC affichés sont arrondis ; le calcul utilise les seuils exacts.": "Weights show the first tenth that triggers the warning. Displayed BMI values are rounded; calculations use exact thresholds.",
  "Sur pavés, plat/sprint et CLM, le bonus acquis au seuil diminue ensuite progressivement. À un point d’IMC au-dessus du seuil, il en reste la moitié ; à deux points, il disparaît. Au-delà, un malus progresse jusqu’à la limite propre au terrain. Un malus déjà présent n’est jamais effacé.": "On cobbles, flat/sprint courses and time trials, the bonus reached at the threshold then gradually decreases. One BMI point above the threshold, half remains; at two points, it disappears. Beyond that, a penalty increases up to the terrain-specific limit. An existing penalty is never removed.",
  "Barème sur pavés, plat/sprint et CLM": "Scale for cobbles, flat/sprint courses and time trials",
  "Diminution du bonus": "Bonus reduction",
  "Bonus disparu": "Bonus removed",
  "Malus par point d’IMC suivant": "Penalty per further BMI point",
  "Malus maximal": "Maximum penalty",
  "Dès le seuil du profil": "From the profile threshold",
  "Seuil +": "Threshold +",
  "d’IMC": "BMI points",
  "Exemples à 1,80 m sur le terrain favori": "Examples at 1.80 m on the favoured terrain",
  "Profil / terrain": "Profile / terrain",
  "Bonus réduit dès": "Bonus reduced from",
  "Bonus disparu dès": "Bonus removed from",
  "Malus à IMC 30 · 97,2 kg": "Penalty at BMI 30 · 97.2 kg",
  "Ces valeurs modulent la performance en course : ce ne sont ni des pourcentages ni des pertes permanentes de notes. Montagne et vallons conservent leurs pénalités de poids. Les résultats passés ne changent pas.": "These values adjust race performance: they are neither percentages nor permanent rating losses. Mountains and hills retain their weight penalties. Past results do not change.",
  "L’assistant du DS vous avertit du surpoids et distingue bonus réduit et malus. La fiche du coureur et la rubrique nutrition affichent son seuil. Revenir sous le seuil retire l’alerte de surpoids.": "The SD assistant warns you about overweight and distinguishes a reduced bonus from a penalty. The rider profile and nutrition section show their threshold. Returning below the threshold removes the overweight warning.",
  "Puissance valorisée, excès de poids pénalisé": "Power rewarded, excess weight penalised",
  "Taille et puissance valorisées sans surpoids excessif": "Height and power rewarded without excessive weight",
  "Bonus réduit sur pavés, plat/sprint et CLM.": "Reduced bonus on cobbles, flat/sprint courses and time trials.",
  "Ces exemples supposent qu’aucun malus de gabarit n’est déjà présent.": "These examples assume there is no existing physique penalty.",
  "avec malus sur pavés, plat/sprint et CLM.": "with a penalty on cobbles, flat/sprint courses and time trials.",
  "coureur en surpoids": "overweight rider",
  "coureurs en surpoids": "overweight riders",
  "affûtage possible pour coureur en surpoids": "weight cutting available for an overweight rider",
  "affûtage possible pour coureurs en surpoids": "weight cutting available for overweight riders",
  "Surpoids pour le profil": "Overweight for the profile",
  "seuil de poids": "weight threshold",
  "bonus réduit sur pavés, plat/sprint et CLM": "reduced bonus on cobbles, flat/sprint courses and time trials",
  "malus sur pavés, plat/sprint et CLM": "penalty on cobbles, flat/sprint courses and time trials",
  "Joindre une image": "Attach an image",
  "Joindre une image (ou Ctrl+V)": "Attach an image (or Ctrl+V)",
  "Ctrl+V pour joindre une image": "Ctrl+V to attach an image",
  "Image jointe": "Attached image",
  "Image indisponible.": "Image unavailable.",
  "Retirer l’image": "Remove image",
  "Aperçu de l’image à envoyer": "Preview of the image to send",
  "Préparation de l’image…": "Preparing image…",
  "Image jointe · ajoutez un message si vous le souhaitez.": "Image attached · add a message if you wish.",
  "Formats acceptés : PNG, JPEG et WebP (images fixes).": "Accepted formats: PNG, JPEG and WebP (still images).",
  "L’image doit peser moins de 10 Mo.": "The image must be smaller than 10 MB.",
  "L’image est trop volumineuse pour être envoyée.": "The image is too large to send.",
  "L’image est trop grande : 24 millions de pixels maximum.": "The image is too large: maximum 24 million pixels.",
  "Votre navigateur ne peut pas préparer cette image.": "Your browser cannot prepare this image.",
  "L’image reste trop volumineuse. Essayez une capture plus petite.": "The image is still too large. Try a smaller screenshot.",
  "Cette image n’a pas pu être préparée.": "This image could not be prepared.",
  "Une seule image par message. Retirez l’image actuelle pour la remplacer.": "One image per message. Remove the current image to replace it.",
  "Collez une seule image à la fois.": "Paste one image at a time.",
  "L’image n’a pas pu être envoyée.": "The image could not be sent.",
  "L’image n’a pas pu être envoyée. Votre brouillon est conservé, vous pouvez réessayer.": "The image could not be sent. Your draft has been kept; you can try again.",
  "Limite de 10 images par heure atteinte. Réessayez plus tard.": "The limit of 10 images per hour has been reached. Try again later.",
  "EN": "EN",
  "FR": "FR",
  "Pôle de gestion sportive": "Sporting operations centre",
  "Effectif · Contrats · Rotation": "Roster · Contracts · Rotation",
  "Élargit l’effectif professionnel et structure durablement le suivi des contrats, des rotations et des jeunes promus.":
    "Expands the professional roster and provides long-term management for contracts, rotations and academy graduates.",
  "Effectif professionnel porté de 35 à 40 coureurs.":
    "Professional roster capacity increased from 35 to 40 riders.",
  "Effectif professionnel porté à 45 coureurs.":
    "Professional roster capacity increased to 45 riders.",
  "Effectif professionnel porté à 50 coureurs et choix d’une orientation de gestion.":
    "Professional roster capacity increased to 50 riders, with a management pathway to choose.",
  "Effectif professionnel porté à 55 coureurs et orientation renforcée.":
    "Professional roster capacity increased to 55 riders, with a stronger pathway effect.",
  "Effectif professionnel porté à 60 coureurs et orientation pleinement développée.":
    "Professional roster capacity increased to 60 riders, with the full pathway effect.",
  "Cellule de fidélisation": "Retention unit",
  "Sécuriser les cadres sans réduire artificiellement tous les salaires de l’équipe.":
    "Secure key riders without artificially reducing every salary on the team.",
  "−3 %, −4 % puis −5 % sur le salaire des futures prolongations.":
    "−3%, −4%, then −5% on salaries for future contract renewals.",
  "La réduction est enregistrée sur le nouveau contrat et reste visible dans la proposition.":
    "The discount is recorded on the new contract and remains visible in the offer.",
  "Les contrats déjà signés et les recrutements extérieurs ne sont jamais recalculés.":
    "Existing contracts and external signings are never recalculated.",
  "Gestion des rotations": "Rotation management",
  "Rendre de la fraîcheur aux coureurs réellement laissés au repos.":
    "Restore freshness to riders who have genuinely been rested.",
  "Après 48 h sans course, les 3, 4 puis 5 coureurs les plus fatigués gagnent +1 forme.":
    "After 48 hours without racing, the 3, 4, then 5 most fatigued riders gain +1 form.",
  "La sélection est automatique et privilégie les formes les plus basses.":
    "Selection is automatic and prioritises riders with the lowest form.",
  "Un coureur à 100 de forme ou ayant couru pendant les deux jours concernés ne reçoit rien.":
    "A rider at 100 form or who raced during either of the two days receives no bonus.",
  "Passerelle espoirs": "Prospect pathway",
  "Conserver davantage de talents formés par le club sans ouvrir ces places au marché.":
    "Keep more club-trained talent without opening those roster places to the market.",
  "+3, +4 puis +5 places réservées aux coureurs issus du Centre de formation.":
    "+3, +4, then +5 places reserved for riders promoted from the youth academy.",
  "Ces places complètent la capacité générale du bâtiment.":
    "These places are added on top of the building’s general capacity.",
  "Les enchères, agents libres et transferts externes ne peuvent jamais consommer ces places réservées.":
    "Auctions, free agents and external transfers can never use these reserved places.",
  "Réserve jeunes": "Academy reserve",
  "Capacité de recrutement atteinte": "Recruitment capacity reached",
  "Je souhaite recevoir par e-mail les nouveautés importantes de Cyclo Stratège. Ce choix est facultatif et modifiable à tout moment depuis le menu utilisateur.":
    "I would like to receive important Cyclo Stratège news by email. This is optional and can be changed at any time from the user menu.",
  "En savoir plus": "Learn more",
  "Jeux quadriennaux professionnels": "Professional Quadrennial Games",
  "JQ Pro": "QG Pro",
  "Six candidatures : CM et CC pros/juniors, JQ pros et Nations Cup juniors":
    "Six bids: professional/junior Worlds and Continental Championships, professional Quadrennial Games and junior Nations Cup",
  "Programme professionnel exceptionnel à la place de la Nations Cup":
    "Special professional programme replacing the Nations Cup",
  "Le classement cumulé du programme professionnel quadriennal de J24 est retenu.":
    "The cumulative standings from the J24 professional Quadrennial Games programme apply.",
  "Annulé": "Cancelled",
  "Aucun coureur actif n’est présent dans l’effectif.":
    "There are no active riders in the roster.",
  "Baroudeur": "Breakaway specialist",
  "Boîte mail": "Mailbox",
  "Classement général des Grands Tours": "Grand Tour general classification",
  "Classiques ardennaises": "Ardennes classics",
  "Classiques pavées": "Cobbled classics",
  "Bureau du DS": "Sporting Director office",
  "Centre de formation": "Youth development centre",
  "Centre de soin": "Medical centre",
  "Classer par statistique": "Rank by attribute",
  "Choisir un junior de 17 ans ou plus": "Choose a junior aged 17 or over",
  "Choisir une nationalité": "Choose a nationality",
  "Choisir un métier": "Choose a role",
  "· promotion prévue en": "· scheduled promotion in",
  "Classement": "Standings",
  "Classements": "Standings",
  "Chaque discipline regroupe les classements des pays liés à votre effectif. Les épreuves sans partant apparaissent comme annulées.":
    "Each discipline groups the results from the countries represented in your roster. Events with no starters are shown as cancelled.",
  "Championnats nationaux — inscription automatique du top 200 de chaque pays et des coureurs libres, grille route/CLM unifiée pour le DS, simulation simultanée sans live, résultats centralisés et un point de réputation par victoire.":
    "National Championships — automatic entry for each country’s top 200 and free agents, one road/TT grid for the Sporting Director, simultaneous simulation without live coverage, centralised results and one reputation point per win.",
  "CN CLM": "National TT",
  "CN en ligne": "National road race",
  "Consultez directement chaque classement officiel disponible.":
    "Open each available official result directly.",
  "Contre-la-montre": "Time trial",
  "Contrat Espoir immédiat": "Instant prospect contract",
  "Équerre de chantier": "Builder’s square",
  "Té d’architecte de précision": "Precision architect’s T-square",
  "Insigne d’expertise": "Expertise badge",
  "Un outil de contrôle qui permet de corriger rapidement le planning d’un bâtiment déjà en construction.":
    "A checking tool used to quickly adjust the schedule of a building already under construction.",
  "Un instrument rare réservé aux grands chantiers, capable de raccourcir nettement un calendrier de construction en cours.":
    "A rare instrument for major projects that can significantly shorten an active construction schedule.",
  "Récompense un membre actif du staff par une progression immédiate de son niveau professionnel.":
    "Immediately raises the professional level of one active staff member.",
  "Retire 2 jours à un chantier actif · 1 jour minimum restant":
    "Removes 2 days from an active project · at least 1 day remains",
  "Retire 7 jours à un chantier actif · 1 jour minimum restant":
    "Removes 7 days from an active project · at least 1 day remains",
  "+1 étoile au membre du staff choisi · maximum 5★":
    "+1 star for the selected staff member · maximum 5★",
  "Chantier en cours": "Active construction project",
  "Choisir un chantier": "Choose a construction project",
  "Membre du staff": "Staff member",
  "Choisir un membre à faire progresser": "Choose a staff member to improve",
  "Accélérer ce chantier": "Speed up this project",
  "Attribuer l’étoile": "Award the star",
  "Accélération chantier": "Construction boost",
  "Perfectionnement du staff": "Staff development",
  "Vous choisissez la cible adaptée : coureur, statistique, course, chantier ou membre du staff. Les bonus expirent à la fin de la saison suivante.":
    "Choose the appropriate target: rider, attribute, race, construction project or staff member. Bonuses expire at the end of the following season.",
  "Permet à un junior de 17 ans ou plus de quitter immédiatement l’école pour rejoindre l’équipe première, même en cours de saison.":
    "Allows a junior aged 17 or over to leave the academy and join the first team immediately, even during the season.",
  "Permet à un junior de 17 ans ou plus de rejoindre immédiatement l’équipe première, même en cours de saison.":
    "Allows a junior aged 17 or over to join the first team immediately, even during the season.",
  "Promotion professionnelle immédiate d’un junior éligible":
    "Immediate professional promotion for an eligible junior",
  "Coureur": "Rider",
  "Coureurs": "Riders",
  "Directeur Sportif": "Sporting Director",
  "Effectif": "Roster",
  "Effectif complet": "Full roster",
  "Enregistrer les inscriptions": "Save entries",
  "Aucune course inscrite": "No race entries",
  "Sélectionnez les coureurs inscrits à la même course. Seules leurs courses communes et les périodes compatibles avec toute la délégation seront proposées.":
    "Select riders entered in the same race. Only shared races with a preparation window that works for the whole group will be shown.",
  "Une étape d’un tour coûte moins cher qu’une classique de même catégorie. Seules les courses où tous les coureurs sélectionnés sont inscrits et disposent d’un créneau commun sont affichées.":
    "A stage race reconnaissance costs less than a classic in the same category. Only races entered by every selected rider with a shared available window are shown.",
  "Aucune course commune aux coureurs sélectionnés ne possède de créneau de reconnaissance compatible. Vérifiez les inscriptions affichées à côté de leurs noms.":
    "The selected riders have no shared race with an available reconnaissance window. Check the entries beside their names.",
  "Entraînement": "Training",
  "Répartition du gain": "Progress distribution",
  "Poids appliqué au gain de base": "Share of base progress",
  "Gain prioritaire": "Primary progress",
  "Gain secondaire": "Secondary progress",
  "Gain d’entretien": "Maintenance progress",
  "Le gain réel varie ensuite selon l’intensité, l’âge, le potentiel, le niveau actuel et les bonus d’encadrement.":
    "Actual progress then varies with intensity, age, potential, current rating and staff bonuses.",
  "Grimpeur": "Climber",
  "Puncheur": "Puncheur",
  "Coureur de tour": "Stage racer",
  "Classiques du Nord · Pavés": "Northern classics · Cobbles",
  "Rouleur": "Time trialist",
  "Sprinteur": "Sprinter",
  "Équipementier": "Equipment supplier",
  "Équipementiers": "Equipment suppliers",
  "Épreuve absente": "Missing event",
  "est absente": "is missing",
  "Gérer les inscriptions": "Manage entries",
  "Gérez les inscriptions de toute votre équipe aux CN en ligne et contre-la-montre depuis une seule grille.":
    "Manage your whole team’s National road race and time trial entries from one grid.",
  "Gestion du club": "Club management",
  "Infrastructures": "Facilities",
  "Inscriptions aux championnats nationaux":
    "National Championships entries",
  "Inscriptions de l’équipe": "Team entries",
  "Installer l’application": "Install the app",
  "Inventaire": "Inventory",
  "Loupe du recruteur": "Scout’s magnifier",
  "Une fenêtre d’observation privilégiée pour examiner sans approximation les talents disponibles.":
    "A privileged scouting window for assessing available talent without approximation.",
  "Révèle pendant 24 h toutes les notes et le potentiel des coureurs libres et des juniors repérés":
    "Reveals every rating and potential value for free agents and scouted juniors for 24 hours",
  "Vision du scouting": "Scouting insight",
  "Révéler les rapports pendant 24 h": "Reveal reports for 24 hours",
  "Loupe du recruteur active": "Scout’s magnifier active",
  "Vision complète active": "Full visibility active",
  "Les notes des coureurs libres sont entièrement visibles.":
    "Free-agent ratings are fully visible.",
  "Conservez cet objet pour une prochaine période de scouting.":
    "Keep this item for a future scouting window.",
  "Toutes les notes restent visibles jusqu’au":
    "All ratings remain visible until",
  "Les notes et le potentiel des juniors repérés sont entièrement visibles jusqu’au":
    "Every rating and potential value for scouted juniors is fully visible until",
  "Invitation": "Wild Card",
  "Invitation refusée": "Wild Card declined",
  "J8 · Deux disciplines · Une seule grille":
    "D8 · Two disciplines · One grid",
  "Kiné": "Physiotherapist",
  "Junior à promouvoir": "Junior to promote",
  "L’école nationale": "Home-nation staff academy",
  "La décennie des pépites": "A decade of prospects",
  "L’organigramme idéal": "The ideal organisation chart",
  "Maillot": "Jersey",
  "Matériel": "Equipment",
  "Mandat de recrutement sur mesure": "Custom staff recruitment mandate",
  "Choisissez le métier et la nationalité. Le profil généré reçoit un niveau de 1 à 5 étoiles à chances égales et un talent compatible aléatoire.":
    "Choose the role and nationality. The generated staff member receives a level from 1 to 5 stars with equal odds and a random compatible talent.",
  "1 staff sur mesure · 20 % de chance pour chaque niveau":
    "1 custom staff member · 20% chance for each level",
  "Métier": "Role",
  "Niveau minimum": "Minimum level",
  "Niveau 1 et plus": "Level 1 and above",
  "Niveau 2 et plus": "Level 2 and above",
  "Niveau 3 et plus": "Level 3 and above",
  "Niveau 4 et plus": "Level 4 and above",
  "Niveau 5 et plus": "Level 5 and above",
  "Moyenne générale": "Overall average",
  "Les meilleurs coureurs": "Top riders",
  "Objectif": "Objective",
  "Objectifs": "Objectives",
  "Philosophie sportive": "Sporting philosophy",
  "Préférence nationale": "National preference",
  "Formateur": "Staff educator",
  "Responsable de formation": "Youth development manager",
  "Responsables de formation": "Youth development managers",
  "Encadre toute l’école de cyclisme dans sa spécialité, sans affectation individuelle.":
    "Guides the whole cycling school in their speciality, with no individual assignment.",
  "Filière formatrice": "Youth development",
  "Optimise les stages de l’Académie des métiers.":
    "Optimises Trades Academy courses.",
  "peuvent être menés en parallèle": "can run simultaneously",
  "Pédagogie accélérée": "Accelerated teaching",
  "Double cursus": "Dual course",
  "Excellence pédagogique": "Teaching excellence",
  "Formateurs de l’équipe": "Team staff educators",
  "Aucun formateur actif": "No active staff educator",
  "· Académie des métiers requise": "· Trades Academy required",
  "Ajoute une place de formation simultanée à l’Académie des métiers":
    "Adds one simultaneous course slot to the Trades Academy",
  "% sur la durée des stages de l’Académie":
    "% off Trades Academy course duration",
  "% sur le coût des stages de l’Académie":
    "% off Trades Academy course cost",
  "% sur le coût et la durée des stages de l’Académie":
    "% off Trades Academy course cost and duration",
  ", bonus du formateur inclus": ", including the staff educator bonus",
  "Bonus formateur : coût −": "Staff educator bonus: cost −",
  "Formateur · coût −": "Staff educator · cost −",
  "· délai −": "· duration −",
  "Douze métiers, douze leviers de progression":
    "Twelve professions, twelve development levers",
  "Le sponsor exige une forte majorité de coureurs de son pays. Cet engagement pèse lourd dans sa satisfaction et augmente de 15 % le budget proposé.":
    "The sponsor requires a strong majority of riders from its own country. This commitment weighs heavily on satisfaction and increases the proposed budget by 15%.",
  "Le sponsor privilégie les promotions du Centre de formation, la Dev Team, les victoires juniors et la valorisation de quelques coureurs formés au club.":
    "The sponsor prioritises academy promotions, the Development Team, junior victories and the development of a small number of homegrown riders.",
  "Pays / rang": "Country / rank",
  "Parrainage": "Referral programme",
  "Pavé": "Cobblestone",
  "Pavés": "Cobblestones",
  "Plaine": "Flat",
  "Préparation de course": "Race preparation",
  "Qualifié par défaut": "Qualified by default",
  "Demande d’invitation transmise": "Wild Card request submitted",
  "Demander une invitation": "Request a Wild Card",
  "Résultats": "Results",
  "Résultats / Live": "Results / Live",
  "Retour aux inscriptions courses": "Back to race entries",
  "s sont absentes": "s are missing",
  "Sponsoring": "Sponsorship",
  "Sprints": "Sprints",
  "Signer le junior maintenant": "Sign the junior now",
  "Générer et signer ce staff": "Generate and sign this staff member",
  "Promotion junior": "Junior promotion",
  "Recrutement staff": "Staff recruitment",
  "Statistiques primaires": "Primary attributes",
  "Statistiques secondaires": "Secondary attributes",
  "Afficher les 5 suivants": "Show the next 5",
  "coureurs affichés": "riders shown",
  "· saison active · avec ou sans équipe":
    "· active season · with or without a team",
  "Stratège": "Stratège",
  "Tableau de bord": "Dashboard",
  "Top 200 national par défaut": "National top 200 by default",
  "Tours intermédiaires": "Medium stage races",
  "Tous les coureurs sont regroupés ci-dessous. Le top 200 de chaque pays est coché par défaut ; vous pouvez ensuite confirmer ou retirer chaque participation jusqu’au départ de la discipline.":
    "All riders are grouped below. Each country’s top 200 is selected by default; you can then confirm or withdraw each entry until that discipline starts.",
  "Un coureur sélectionné ne fait pas partie de l’effectif.":
    "A selected rider is not part of the roster.",
  "Un staff aux couleurs du sponsor": "Staff in the sponsor’s colours",
  "Une filière qui compte": "A youth system that delivers",
  "Une case décochée signifie que le coureur ne prendra pas le départ. Chaque colonne se verrouille à l’heure de son CN.":
    "An unticked box means the rider will not start. Each column locks when its National Championship begins.",
  "Une seule grille regroupe le CN contre-la-montre à 14 h et le CN en ligne à 18 h pour tous les coureurs de l’effectif.":
    "One grid groups the 2 pm National time trial and the 6 pm National road race for every rider in the roster.",
  "Une seule grille regroupe le CN contre-la-montre et le CN en ligne de J8. Vérifiez les choix de tout votre effectif avant les départs.":
    "One grid groups the National time trial and road race on D8. Check the choices for your whole roster before the starts.",
  "Vallon": "Hills",
  "Vallons": "Hills",
  "Vous devez être connecté pour gérer les inscriptions.":
    "You must be signed in to manage entries.",
  "du calendrier. L’enregistrement est temporairement bloqué afin de ne perdre aucun choix.":
    "from the calendar. Saving is temporarily disabled so none of your choices are lost.",
  "La grille d’inscriptions transmise est invalide.":
    "The submitted entry grid is invalid.",
  "Les choix enregistrés remplacent la sélection automatique et restent prioritaires, même si le classement national évolue.":
    "Saved choices override automatic selection and remain authoritative even if the national ranking changes.",
  "Les inscriptions aux deux championnats ont bien été enregistrées.":
    "Entries for both championships have been saved.",
  "Le sponsor attend des performances sur les chronos individuels et par équipes.":
    "The sponsor expects strong performances in individual and team time trials.",
  "Le sponsor privilégie les arrivées massives et les courses favorables aux sprinteurs.":
    "The sponsor prioritises bunch finishes and races suited to sprinters.",
  "Le sponsor privilégie les classiques vallonnées et les arrivées pour puncheurs.":
    "The sponsor prioritises hilly classics and finishes suited to puncheurs.",
  "Le sponsor recherche des résultats au classement général des courses par étapes hors Grands Tours.":
    "The sponsor targets general classification results in stage races outside the Grand Tours.",
  "Le sponsor valorise les résultats sur les courses d’un jour disputées sur les pavés.":
    "The sponsor values results in cobbled one-day races.",
  "Le sponsor vise les classements généraux des Grands Tours dès que la réputation de l’équipe le permet.":
    "The sponsor targets Grand Tour general classifications as soon as the team’s reputation allows it.",
  "Les objectifs sont reliés au calendrier réel et à la philosophie de chaque sponsor. Les courses du pays du sponsor sont prioritaires, puis celles des pays voisins et enfin celles du même continent.":
    "Objectives are linked to the real calendar and each sponsor’s philosophy. Races in the sponsor’s country come first, followed by neighbouring countries and then the same continent.",
  "Les objectifs de course privilégient le pays du sponsor, puis ses voisins et enfin son continent. Les courses Continentales deviennent accessibles à 100 points de réputation, les Mondiales à 200 points.":
    "Race objectives prioritise the sponsor’s country, then its neighbours and finally its continent. Continental races unlock at 100 reputation points and World races at 200.",
  "Tirage équitable : chaque niveau de 1 à 5 étoiles a exactement 20 % de chance. Le talent et les éventuelles spécialités sont ensuite tirés parmi les options compatibles.":
    "Fair draw: each level from 1 to 5 stars has exactly a 20% chance. Talent and any specialties are then drawn from the compatible options.",
  "La prime de signature est offerte. Le salaire normal et les limites habituelles de votre structure restent applicables.":
    "The signing fee is waived. The normal salary and your organisation’s usual limits still apply.",
  "Réunir trois membres actifs du staff ayant la nationalité de l’équipe, définie par son sponsor.":
    "Employ three active staff members who share the team nationality defined by its sponsor.",
  "Réunir six membres actifs du staff ayant la nationalité de l’équipe. Récompense : un Contrat Espoir immédiat.":
    "Employ six active staff members who share the team nationality. Reward: an Instant prospect contract.",
  "Réunir simultanément les douze métiers de staff. Récompense : un Mandat de recrutement sur mesure.":
    "Employ all twelve staff roles at the same time. Reward: a Custom staff recruitment mandate.",
  "Accueillir dix juniors au centre de formation. Récompense : un Contrat Espoir immédiat.":
    "Recruit ten juniors to the youth development centre. Reward: an Instant prospect contract.",
  "Promouvoir dix juniors dans l’effectif professionnel. Récompense : un Mandat de recrutement sur mesure.":
    "Promote ten juniors to the professional roster. Reward: a Custom staff recruitment mandate.",
  "Construire une première infrastructure de performance parmi les sept nouvelles installations. Récompense : une Équerre de chantier.":
    "Build the first of the seven performance facilities. Reward: one Builder’s Square.",
  "Construire les sept infrastructures de performance : piste, cryothérapie, soufflerie, R&D, accueil international, météo et Média Center. Récompense : un Té d’architecte de précision.":
    "Build all seven performance facilities: indoor track, cryotherapy centre, wind tunnel, R&D lab, international welcome centre, weather centre and Media Centre. Reward: one Precision Architect’s T-square.",
  "Réunir trois membres actifs du staff ayant la nationalité de l’équipe, définie par son sponsor. Récompense : un Insigne d’expertise.":
    "Employ three active staff members with the team nationality set by its sponsor. Reward: one Expertise Badge.",
  "Nationalité de l’équipe": "Team nationality",
  "Nationalité de l’équipe et de l’entraîneur":
    "Team and coach nationality",
  "Actuelle": "Current",
  "Fédération": "Federation",
  "Équipe amateure": "Amateur team",
  "Entraîneur": "Coach",
  "Déjà aligné": "Already aligned",
  "Non renseignée": "Not provided",
  "Ancrer votre équipe amateur dans la fédération":
    "Root your amateur team in the federation",
  "Ancrer votre structure amateure dans la fédération":
    "Root your amateur structure in the federation",
  "Alignez en une seule démarche la nationalité sportive de votre équipe amateure et de votre profil d’entraîneur sur celle de la fédération. La nationalité de l’équipe contribue à déterminer les sponsors qui vous contacteront en fin de saison.":
    "In one step, align the sporting nationality of your amateur team and coach profile with the federation. The team nationality helps determine which sponsors will contact you at the end of the season.",
  "Une saison complète dans cette fédération est requise. Les coureurs et les contrats en cours restent inchangés.":
    "One full season in this federation is required. Riders and current contracts remain unchanged.",
  "Je confirme l’adoption de la nationalité sportive :":
    "I confirm the adoption of the following sporting nationality:",
  "Je confirme l’adoption de la nationalité sportive de l’équipe amateure et de l’entraîneur :":
    "I confirm that the amateur team and coach will adopt this sporting nationality:",
  "Confirmer le changement": "Confirm the change",
  "Changement…": "Changing…",
  "Naturaliser la structure": "Naturalise the organisation",
  "Naturalisation…": "Naturalising…",
  "Votre équipe porte déjà la nationalité sportive de cette fédération.":
    "Your team already holds this federation’s sporting nationality.",
  "Votre équipe amateure et votre entraîneur portent déjà la nationalité sportive de cette fédération.":
    "Your amateur team and coach already hold this federation’s sporting nationality.",
  "Ce changement sera disponible en Saison":
    "This change will become available in Season",
  "si votre équipe reste affiliée à cette fédération.":
    "if your team remains affiliated with this federation.",
  "Le changement de nationalité a déjà été utilisé cette saison.":
    "The nationality change has already been used this season.",
  "Confirmez le changement de nationalité sportive.":
    "Confirm the sporting nationality change.",
  "Confirmez la naturalisation de l’équipe et de l’entraîneur.":
    "Confirm the naturalisation of the team and coach.",
  "Le changement de nationalité n’a pas abouti.":
    "The nationality change could not be completed.",
  "La naturalisation n’a pas abouti.":
    "The naturalisation could not be completed.",
  "Naturalisation finalisée": "Naturalisation completed",
  "Votre équipe amateure et votre profil d’entraîneur sont désormais alignés avec la fédération.":
    "Your amateur team and coach profile are now aligned with the federation.",
  "La nouvelle nationalité de l’équipe sera prise en compte dans les prochaines affinités sponsors.":
    "The team’s new nationality will be reflected in future sponsor affinities.",
  "Nationalité sportive adoptée": "Sporting nationality adopted",
  "Elle sera prise en compte dans les prochaines affinités sponsors.":
    "It will be reflected in future sponsor affinities.",
  "Trier par": "Sort by",
  "Ordre décroissant": "Descending order",
  "Ordre croissant": "Ascending order",
  "Trier par ordre croissant": "Sort in ascending order",
  "Trier par ordre décroissant": "Sort in descending order",
  "Affinités météo": "Weather affinities",
  "Affinité avec la météo annoncée": "Affinity with the forecast weather",
  "Météo fédérale": "Federation weather",
  "Météo fédérale · sans centre météo":
    "Federation weather · no weather centre required",
  "Prévision fédérale · parcours officiel":
    "Federation forecast · official course",
  "Prévision fédérale · créneau officiel":
    "Federation forecast · official event slot",
  "Prévision en attente du calendrier": "Forecast awaiting the calendar",
  "À l’ouverture de la fenêtre de convocation":
    "When the call-up window opens",
  "Disponible lorsque la prévision est publiée":
    "Available once the forecast is published",
  "Condition favorite": "Preferred conditions",
  "Condition difficile": "Difficult conditions",
  "Parcours de l’épreuve": "Race course",
  "Parcours en attente de publication": "Course awaiting publication",
  "Relief non précisé": "Terrain not specified",
  "Plat · Sprint": "Flat · Sprint",
  "Montagneux": "Mountainous",
  "Voir la course →": "View race →",
  "La composition des listes est verrouillée en mode automatique. Les parcours restent consultables.":
    "Lineup editing is locked in automatic mode. Courses remain available to view.",
  "Masquer les courses": "Hide race chats",
  "Courses masquées": "Race chats hidden",
  "Discussions de courses": "Race discussions",
  "Affichées dans le chat général": "Shown in the general chat",
  "Masquées du chat général": "Hidden from the general chat",
  "Réafficher": "Show again",
  "Masquer les messages issus des courses": "Hide messages from race chats",
  "Afficher les messages issus des courses": "Show messages from race chats",
  "Voir les Directeurs Sportifs en ligne": "View online Sporting Directors",
  "Directeurs Sportifs en ligne": "Online Sporting Directors",
  "convocation fédérale à finaliser": "federation call-up to finalise",
  "convocations fédérales à finaliser": "federation call-ups to finalise",
  "Une liste nationale reste à publier": "A national team list still needs to be published",
  "Prochaine :": "Next:",
  "échéance": "deadline",
  "à confirmer": "to be confirmed",
};

export const UI_TRANSLATIONS: Readonly<Record<string, string>> = {
  ...(generatedCatalog as Record<string, string>),
  ...REVIEWED_TRANSLATIONS,
};

const EMBEDDED_TRANSLATIONS = Object.entries(UI_TRANSLATIONS)
  .filter(([source, target]) => {
    if (source === target || source.length < 4 || source.length > 180) return false;
    return (
      Object.hasOwn(REVIEWED_TRANSLATIONS, source) ||
      /[\s·:;,.!?«»'’()/%+−–—-]/.test(source)
    );
  })
  .sort(([left], [right]) => right.length - left.length);

const EMBEDDED_TRANSLATIONS_BY_ANCHOR = new Map<
  string,
  Array<(typeof EMBEDDED_TRANSLATIONS)[number]>
>();
const UNANCHORED_EMBEDDED_TRANSLATIONS: Array<
  (typeof EMBEDDED_TRANSLATIONS)[number]
> = [];

for (const translation of EMBEDDED_TRANSLATIONS) {
  const anchor = getTranslationAnchor(translation[0]);
  if (!anchor) {
    UNANCHORED_EMBEDDED_TRANSLATIONS.push(translation);
    continue;
  }

  const translations = EMBEDDED_TRANSLATIONS_BY_ANCHOR.get(anchor) ?? [];
  translations.push(translation);
  EMBEDDED_TRANSLATIONS_BY_ANCHOR.set(anchor, translations);
}

export function normalizeUiText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function translateUiText(value: string): string {
  const normalized = normalizeUiText(value);
  if (!normalized) return value;

  const directTranslation = UI_TRANSLATIONS[normalized];
  if (directTranslation) {
    return preserveOuterWhitespace(value, normalizeEnglishTerminology(directTranslation));
  }

  let translated = normalized;
  for (const [source, target] of getEmbeddedTranslationCandidates(normalized)) {
    if (translated.includes(source)) translated = translated.replaceAll(source, target);
  }

  const normalizedEnglish = normalizeEnglishTerminology(translated);
  return normalizedEnglish === normalized
    ? value
    : preserveOuterWhitespace(value, normalizedEnglish);
}

function getEmbeddedTranslationCandidates(
  value: string,
): Array<(typeof EMBEDDED_TRANSLATIONS)[number]> {
  const candidates = new Set<(typeof EMBEDDED_TRANSLATIONS)[number]>(
    UNANCHORED_EMBEDDED_TRANSLATIONS,
  );

  for (const token of value.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const translations = EMBEDDED_TRANSLATIONS_BY_ANCHOR.get(
      token.toLocaleLowerCase("fr"),
    );
    if (!translations) continue;
    for (const translation of translations) candidates.add(translation);
  }

  return [...candidates].sort(
    ([left], [right]) => right.length - left.length,
  );
}

function getTranslationAnchor(value: string): string | null {
  const tokens = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  const longestToken = tokens.reduce<string | null>(
    (longest, token) =>
      !longest || token.length > longest.length ? token : longest,
    null,
  );

  return longestToken?.toLocaleLowerCase("fr") ?? null;
}

function normalizeEnglishTerminology(value: string): string {
  return value
    .replace(/\bSports Directors\b/g, "Sporting Directors")
    .replace(/\bSports Director\b/g, "Sporting Director");
}

function preserveOuterWhitespace(source: string, translated: string): string {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}
