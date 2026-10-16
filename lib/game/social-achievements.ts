export const SOCIAL_ACHIEVEMENTS_START_LABEL = "16 octobre 2026";

export const SOCIAL_ACHIEVEMENTS = {
  community_days: { title: "Une voix dans le peloton", group: "social", targets: [1, 3, 7],
    descriptions: [1, 3, 7].map(n => `Participer au chat général pendant ${n} jour${n > 1 ? "s distincts" : ""}, avec un message d’au moins 20 caractères. Un seul crédit par jour, sans avantage à multiplier les messages.`) },
  private_contacts: { title: "Le carnet d’adresses", group: "social", targets: [1, 3, 10],
    descriptions: [1, 3, 10].map(n => `Échanger des messages privés avec ${n} autre${n > 1 ? "s DS différents" : " DS"}. Chacun doit avoir envoyé un message personnel d’au moins 5 caractères depuis l’activation. Les notifications automatiques ne comptent pas.`) },
  transfer_sent: { title: "Ouvrir les négociations", group: "transfers", targets: [1, 5, 20],
    descriptions: [1, 5, 20].map(n => `Déposer une offre de transfert direct valide pour ${n} coureur${n > 1 ? "s différents" : ""}. Les relances et contre-offres pour le même coureur ne comptent pas une seconde fois.`) },
  transfer_received: { title: "Votre effectif intéresse", group: "transfers", targets: [1, 5],
    descriptions: [1, 5].map(n => `Recevoir une offre directe valide de ${n} autre${n > 1 ? "s DS différents" : " DS"}. Une seule progression par acheteur, même s’il multiplie ses offres.`) },
  interview_support_given: { title: "Encourager les voix du peloton", group: "social", targets: [1, 5],
    descriptions: [1, 5].map(n => `Apprécier une réponse d’interview de ${n} autre${n > 1 ? "s DS différents" : " DS"}. Un seul crédit par auteur, indépendamment du nombre de réponses ou d’émojis.`) },
  interview_support_received: { title: "Des réponses qui font réagir", group: "social", targets: [1, 5],
    descriptions: [1, 5].map(n => `Recevoir une appréciation sur vos interviews de ${n} autre${n > 1 ? "s DS différents" : " DS"}. Les auto-appréciations et répétitions d’une même personne ne comptent pas.`) },
  gazette_days: { title: "Au rendez-vous de la Gazette", group: "social", targets: [3, 10],
    descriptions: [3, 10].map(n => `Commenter la Cyclogazette pendant ${n} jours distincts, avec un commentaire d’au moins 30 caractères. Un seul crédit par jour, sans avantage au spam.`) },
  game_variety: { title: "La tête et les jambes", group: "social", targets: [2],
    descriptions: ["Terminer les deux jeux de la Cyclogazette : un sudoku et des mots croisés. Les deux réussites doivent être postérieures à l’activation."] },
  first_deal: { title: "Poignée de main", group: "transfers", targets: [1],
    descriptions: ["Conclure un achat par offre de transfert direct déposée et acceptée après l’activation. Une offre simplement envoyée ne suffit pas."] },
  interview_regular: { title: "Habitué de la zone mixte", group: "social", targets: [25, 50],
    descriptions: [25, 50].map(n => `Répondre et soumettre ${n} interviews d’après-course différentes depuis l’activation. Modifier une interview déjà publiée ne donne pas de crédit supplémentaire.`) },
} as const;
