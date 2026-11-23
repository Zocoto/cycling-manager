# Noël — Lunette de sniper de cadeaux

- Lancer manuel par défaut sur ordinateur et téléphone.
- Nouvel objet de la boutique : **Lunette de sniper de cadeaux**, **10 Grelots**, achat renouvelable sans quota.
- Une lunette permet le lancer automatique à l’alignement pendant une seule tournée. Elle ne change ni la visée, ni le vent, ni l’inertie, ni les collisions, ni les récompenses.
- Préparation depuis l’inventaire ou sélection de l’option avant le départ lorsqu’une lunette est disponible. Préparer ne consomme pas l’objet. Le démarrage avec l’option consomme une lunette, une seule fois pour cet identifiant de tournée.
- Un départ manuel préserve l’objet. Une tournée assistée abandonnée reste une utilisation ; la suivante exige une autre lunette.
- L’option gratuite n’est plus proposée en l’absence de l’objet. Une autorisation du parent, rattachée à la tournée en cours, est nécessaire avant tout lancer automatique.
- Le catalogue, les stocks et les effets de cette page restent ceux du brouillon privé de Noël. Aucun changement de données ou de service Supabase.

L’illustration de l’objet utilise le même dessin Canvas que les autres articles de la boutique : optique verte et dorée, verre bleu et ruban rouge. Aucun fichier image ou service tiers supplémentaire.

Vérifications : contrôles des commandes sur ordinateur/téléphone, activation limitée à un run, absence d’activation gratuite, consommation unique, rejeux et anciens messages, achats répétés, inventaire, contrôle de provenance des messages, règles et physique existantes.

## Top 10 des contributeurs

Classement par cumul des lumières apportées pendant tout l’événement : tournées récompensées et Seconds tours compris, entraînements sans gains exclus. Les ex æquo gardent le même rang et le même cadeau.

| Rang | Récompense |
| --- | --- |
| 1er | Cuissard Quatre Saisons : ignore les malus de notes liés à la météo, effets météo favorables conservés |
| 2e–3e | Cadre Traîneau du renne en danseuse : +3 END / RES / REC, +2 MON |
| 4e–6e | Bonnet de course de Noël : +2 MON, +2 RES |
| 7e–10e | Gants du dernier relais : +1 END, +1 REC |

Le groupe est retiré. Les quatre récompenses utilisent les emplacements réels du jeu : `bib_shorts`, `frame`, `helmet`, `gloves`.

Le casque-bonnet est retiré du palier collectif et du dessin sous l’étoile. Le palier 23 500 lumières retrouve ses deux boosters et deux vignettes, le sommet 28 000 et le Carnet de progression restent inchangés.

L’effet du cuissard utilise le flag optionnel `ignoreWeatherPenalties: true` dans les effets d’équipement. Il neutralise les composantes négatives des ajustements individuels de notes dus à la météo. Les bonus favorables et les facteurs globaux de course restent actifs. Son absence conserve le comportement courant. Les attributions de fin d’événement restent celles à raccorder lors de l’ouverture publique de Noël ; cet aperçu ne distribue pas de nouveaux équipements en production.
