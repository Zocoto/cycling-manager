# Dotations fédérales à partir de la saison 4

Toutes les fédérations conservent le socle garanti de leur division Nations Cup :
D1 : 450 000 €, D2 : 300 000 €, D3 : 200 000 €, D4 : 120 000 €.

Une prime sportive s'ajoute au socle à l'ouverture de S4 et des saisons suivantes :

`prime = arrondi à 1 000 € (socle de division / sqrt(rang UCI des nations))`

Le rang est celui du classement définitif de la saison précédente. La division
est celle attribuée à la nouvelle saison par le mécanisme Nations Cup, qui tient
compte des promotions et relégations. Les deux critères sont indépendants.

Exemples pour une fédération de D1 :

| Rang UCI de la saison source | Socle garanti | Prime | Dotation division + prime |
| --- | ---: | ---: | ---: |
| 1 | 450 000 € | 450 000 € | 900 000 € |
| 2 | 450 000 € | 318 000 € | 768 000 € |
| 3 | 450 000 € | 260 000 € | 710 000 € |
| 5 | 450 000 € | 201 000 € | 651 000 € |
| 10 | 450 000 € | 142 000 € | 592 000 € |
| 20 | 450 000 € | 101 000 € | 551 000 € |

La prime est plafonnée au montant du socle. L'écart entre les premiers est
marqué puis diminue progressivement ; l'arrondi peut produire des égalités en
bas de classement. Le socle commun de 1,2 M€, la dotation UCI historique et les
recettes de courses restent cumulables. Les bonus d'objectifs de 3/6/10 % portent
sur les dotations structurelles, prime sportive comprise, suivant la règle existante.

L'ouverture et son détail sont figés dans le compte et le journal. La migration
ne recalcule aucun compte existant et n'exécute pas l'initialisation des budgets.
Les relances du traitement ne créditent pas deux fois un compte déjà créé.

## Vérification

Les tests unitaires couvrent les quatre bases, les 173 rangs, la dégressivité,
les saisons antérieures et le calcul des objectifs. Le contrôle PostgreSQL
utilise uniquement PGlite en mémoire, sans connexion à Supabase :

```powershell
node scripts/check-federation-season4-budgets.mjs <chemin-vers-@electric-sql/pglite/dist/index.js>
```

Le moteur de test peut être installé dans un dossier temporaire. Le contrôle
compare 2 768 calculs SQL/aperçu, initialise 25 comptes S4, préserve les comptes
S3 et la division réellement attribuée, puis vérifie une relance sans doublon.
Ne jamais envoyer les fixtures dans une base de production.
