# Staff — marché, contrats et effets

## Périmètre livré

- Marché mondial quotidien commun à tous les joueurs : 25 profils, 8 métiers et 5 niveaux.
- Filtres par nom, métier, niveau, nationalité et spécialité d’entraîneur.
- Recrutement atomique avec contrôle serveur de l’authentification, de la disponibilité, de la capacité du DS et des finances.
- Contrat permanent jusqu’à future résiliation, prime de signature immédiate et salaire saisonnier en quatre échéances (J7, J14, J21 et J28).
- Vue du staff de l’équipe avec masse salariale, effets et places disponibles.
- Bonus du community manager appliqué automatiquement aux événements de réputation.

## Capacité du Directeur Sportif

Le projet existant démarre les DS au niveau 1. Ce niveau correspond au niveau initial évoqué comme « niveau 0 » dans la spécification et autorise un seul recrutement.

| Niveau DS | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Staff maximal | 1 | 2 | 3 | 5 | 7 | 10 | 13 | 17 | 21 | 25 |

Au-delà du niveau 10, quatre places supplémentaires sont accordées par niveau, avec un plafond de 45.

## Équilibre des métiers

À niveau égal, la hiérarchie salariale principale est : entraîneur, scout, médecin, mécanicien. Le niveau applique ensuite un multiplicateur croissant de 1 à 3.

| Métier | Effet au niveau 1 | Effet au niveau 5 |
|---|---|---|
| Entraîneur | +4 % d’efficacité dans sa spécialité | +20 % |
| Scout | +5 % de précision dans son pays | +25 % |
| Médecin | −6 % de temps de récupération | −30 % |
| Mécanicien | −8 % de temps d’arrêt sur avarie | −40 % |
| Community manager | +2 % de réputation | +10 % |
| Nutritionniste | −5 % sur les compléments et +0,2 forme/jour | −25 % et +1 forme/jour |
| Kiné | −1 point de malus après course | −5 points |
| Architecte | −5 % sur les délais de construction | −25 % |

Pour un même effet global, seul le meilleur niveau actif est retenu. Les entraîneurs peuvent être complémentaires grâce à leurs spécialités distinctes.

## Connexions avec les autres briques

La fonction SQL `get_active_team_staff_level` expose le meilleur niveau actif par équipe, métier et, si nécessaire, spécialité d’entraîneur. Les futures rubriques Entraînements, Infrastructures, reconnaissance, nutrition et gestion des avaries peuvent donc consommer les effets sans modifier le modèle contractuel.

Le community manager est déjà raccordé au registre central `reward_events`. Les autres effets deviennent actifs lorsque leur moteur fonctionnel correspondant les consomme.
