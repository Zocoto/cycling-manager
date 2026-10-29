# Chargement du calendrier des sponsors secondaires — 29 octobre 2026

## Incident

Fra Troisset (Kaffa Origins) voit « Le détail du calendrier secondaire est
indisponible » à J21 de S4. Les lectures de production bornées confirment
1 569,26 points de réputation, trois offres S5 ouvertes et aucun objectif créé.
Le calendrier S5 comprend 852 éditions non annulées, dont 452 ouvertes et
accessibles à sa réputation.

Le service chargeait toutes les éditions puis envoyait tous leurs UUID dans
un seul filtre HTTP `.in(...)`, soit une URL de plusieurs dizaines de Ko.
Il ne paginait pas non plus les éditions et relisait le calendrier même lorsque
les objectifs d'une offre étaient déjà enregistrés. L'erreur utilisateur masque
le détail de la requête de relation ayant échoué.

## Correction

- Filtrage des éditions ouvertes et accessibles dès la lecture, avec les mêmes
  critères qu'auparavant ; aucun changement de prestige, primes ou sélection.
- Pagination stable par identifiant, pages de 500 éditions.
- Lecture des courses par lots de 75 UUID et pagination, une lecture de lot à
  la fois. Les catégories restent une petite liste de métadonnées.
- Lecture groupée des objectifs existants ; calendrier consulté uniquement si
  une offre doit encore recevoir ses objectifs.
- Les propositions existantes sont conservées ; seules les offres incomplètes
  reçoivent leurs objectifs. Le chemin normal les préparera au prochain accès.
- Journal serveur borné indiquant la relation et l'erreur de lecture, sans
  exposer la requête complète au joueur.

La signature du sponsor principal n'est pas un prérequis pour accéder ou signer
les offres secondaires. Le principal et son maillot sont nécessaires ensuite
pour l'éditeur de placement du logo.

## Validation

34 tests passent : service secondaire, règles de primes, pagination et workflow
sponsoring. Les nouveaux contrôles isolés couvrent 1 203 éditions éligibles,
la sélection au-delà de la 1 000e, les filtres d'accès, les lots de 75, les offres
déjà préparées, l'offre manquante, le calendrier vide et l'échec d'un lot sans
création d'objectifs partiels. ESLint et couverture des traductions vérifiés.

Aucun scénario de test, génération manuelle d'offres ou mutation de données n'a
été exécuté en production. Aucune migration requise.
