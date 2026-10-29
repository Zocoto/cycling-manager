# Leaders automatiques et favoris — 29 octobre 2026

## Problème

À la Clásica de Barichara S4 (28 octobre), Sebastian Olsson est premier du
pronostic enregistré mais devient équipier derrière Alpha Dramé. Le pronostic
utilise les notes natives ; le choix automatique utilisait une autre formule,
après équipement et météo. Le classement des favoris et la hiérarchie automatique
pouvaient donc se contredire.

## Règle

- Une classique choisit son meilleur favori éligible par équipe comme leader.
- Sur un parcours de sprint massif, ce favori prend le rôle leader/sprinteur.
- Les rôles et missions explicitement choisis par le DS restent prioritaires.
- Un coureur indisponible est exclu ; les équipes hors des vingt favoris affichés
  bénéficient de la même règle, sans dépendre de cette limite d'affichage.
- Les tours conservent le choix stable du leader sur le pronostic général de
  l'édition et les règles existantes de remplacement après indisponibilité.
- Les égalités suivent le pronostic : score brut, nom français, identifiant.
- Les CLM individuels et prologues utilisent leur pronostic propre et ne
  désignent pas automatiquement un sprinteur sur leur parcours plat.
- Le CLM par équipes conserve son attribution précédente : ses favoris sont
  collectifs et les rôles interviennent dans l'abri et la répartition des relais.

## Implémentation et limites

Le score d'étape et le départage sont partagés dans `race-favorites.ts`.
La normalisation calcule une fois les scores avant les bonus de course puis
transmet une Map locale au sélecteur de rôles. Aucun nouveau champ persistant,
appel réseau ou accès BDD. Les bonus continuent d'influencer les performances.
Les sélections de poisson-pilote et d'électron libre restent inchangées.

Version des prochaines simulations :
`2026.10-favorite-aligned-auto-leaders-v55` (inclut le correctif de regroupement
des chasseurs v54 arrivé sur main pendant cette livraison).
Les scénarios verrouillés et résultats existants ne sont ni recalculés ni modifiés.
Aucune migration ni réparation de données n'est nécessaire pour ce changement.

## Vérification

- 328 tests du moteur, favoris, adaptateur calendrier, consignes DS, préparations,
  non-rétroactivité et nouvelle régression passent, dont 32 nouveaux contrôles.
- 228 contrôles complémentaires passent : sprints plats, pavés urbains, CLM,
  relais, tactiques, échappées, rôles d'étape et verrouillage des scénarios.
- Compilation Next.js/TypeScript, ESLint et contrôles postbuild réussis.
- Comparaison isolée avec v53 : 16 scénarios CLM collectif strictement identiques
  (deux parcours, quatre graines, moteur complet et résultats seuls), avec abri
  des leaders faibles et redistribution des relais effectivement déclenchés.
- Mesure locale indicative : environ 0,30 ms pour calculer les scores natifs de
  200 coureurs sur 20 tronçons mixtes ; ce n'est pas une mesure de production.
- Dix attentes de tests de préparation étaient déjà en échec sur v53 : elles
  attendaient une protection automatique du général annulant une mission du DS.
  Elles suivent maintenant la priorité des consignes déjà imposée par v53.
- Une assertion de type sur une fixture partielle de Gazette, arrivée sur main,
  est corrigée pour permettre la compilation ; aucun comportement Gazette changé.

Les preuves de comparaison et du diagnostic v53 sont conservées localement dans
`C:/Dev/tmp/olsson-v53-baseline-20261029/`.
