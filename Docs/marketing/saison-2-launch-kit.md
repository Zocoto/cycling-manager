# Kit de lancement — Saison 2 / Bêta test

Date de lancement : 16 août 2026

Objectif principal : transformer la visibilité Instagram et Google en créations de compte qualifiées.

## Profil Instagram

Nom affiché :

> Cyclo Stratège | Jeu cycliste

Bio :

> 🚴 Jeu de management cycliste sur navigateur
>
> 🏁 Saison 2 : bêta ouverte
>
> 🧠 Bâtissez votre équipe et votre légende
>
> 👇 Rejoindre la bêta

Lien de bio :

```text
https://cyclostratege.fr/beta-saison-2?utm_source=instagram&utm_medium=social&utm_campaign=saison2_beta&utm_content=bio
```

Publications à épingler :

1. Saison 2 — la bêta est ouverte.
2. Qu’est-ce que Cyclo Stratège ?
3. Comment démarrer sa carrière ?

Stories à la une : `Débuter`, `Gameplay`, `Saison 2`, `Nouveautés`, `Communauté`.

## Carrousel d’annonce

Visuels :

1. `instagram/season-2-beta-carousel-01.png`
2. `instagram/season-2-beta-carousel-02.png`
3. `instagram/season-2-beta-carousel-03.png`

Direction artistique : compositions éditoriales de marque, sans image
générée. Le logo, la grille, les repères de course et la typographie sont
produits de manière déterministe. Pour les Reels et les futurs carrousels
de gameplay, utiliser uniquement des captures réelles du jeu, sans faux
écran ni embellissement qui ne soit pas présent dans l’interface.

Texte de publication :

> 🚴 La Saison 2 de Cyclo Stratège démarre.
>
> Le jeu entre officiellement en bêta test. Notre objectif : accueillir davantage de directeurs sportifs, éprouver l’équilibrage du jeu et construire la suite grâce à vos retours.
>
> Recrutez vos coureurs, développez votre équipe, préparez vos courses et prenez les décisions qui feront la différence.
>
> 👉 Rejoignez la bêta via le lien en bio.
>
> 💬 Quel type de directeur sportif serez-vous : bâtisseur, tacticien ou chasseur de victoires ?
>
> #CycloStratège #JeuDeCyclisme #ManagementSportif #Cyclisme #BetaTest #GameDevFR

Lien associé au carrousel :

```text
https://cyclostratege.fr/beta-saison-2?utm_source=instagram&utm_medium=social&utm_campaign=saison2_beta&utm_content=carousel_launch
```

## Story

Visuel : `instagram/season-2-beta-story.png`

Séquence conseillée :

1. La Saison 2 commence.
2. Gérez les coureurs, le staff, le matériel et la stratégie.
3. Le bêta test sert à améliorer le jeu avec les joueurs.
4. Sticker lien : « Rejoindre la bêta ».

Lien :

```text
https://cyclostratege.fr/beta-saison-2?utm_source=instagram&utm_medium=social&utm_campaign=saison2_beta&utm_content=story_launch
```

## Reel de lancement

Durée : 12 à 18 secondes.

Plan :

- 0–2 s : logo + « Saison 2 » ;
- 2–6 s : capture réelle de l’effectif et du développement des coureurs ;
- 6–10 s : capture réelle de la préparation et des tactiques de course ;
- 10–14 s : capture réelle d’un résultat ou du classement ;
- fin : « La bêta est ouverte — lien en bio ».

Texte court :

> Une équipe. Une saison. Vos décisions. 🚴
>
> La bêta de Cyclo Stratège est ouverte. Rejoignez le peloton via le lien en bio.

Lien :

```text
https://cyclostratege.fr/beta-saison-2?utm_source=instagram&utm_medium=social&utm_campaign=saison2_beta&utm_content=reel_launch
```

## Calendrier éditorial — 14 jours

- J0 : carrousel d’annonce + stories.
- J1 : Reel de découverte du jeu.
- J3 : focus « bâtir son équipe ».
- J5 : présentation d’une décision tactique.
- J7 : premier bilan de bêta et appel aux retours.
- J9 : mise en avant des infrastructures ou du staff.
- J11 : question à la communauté / sondage en story.
- J14 : nouveautés apportées depuis l’ouverture.

Cadence durable après le lancement : deux publications ou Reels par semaine, complétés par des stories de progression et de communauté.

## Mesure

Les paramètres `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` et `utm_term` sont transmis jusqu’au formulaire puis enregistrés dans les métadonnées du compte Supabase sous `marketing_attribution`.

Indicateurs hebdomadaires :

- visites de la page Saison 2 ;
- clics vers l’inscription ;
- comptes créés par source et contenu ;
- comptes ayant confirmé leur e-mail ;
- joueurs ayant terminé le parcours de découverte ;
- retours et bugs reçus sur Discord.

## Actions externes à effectuer une fois les comptes connectés

### Instagram / Meta

- passer le compte en mode professionnel si nécessaire ;
- appliquer le nom, la bio et le lien UTM ;
- importer et programmer le carrousel, la story et le Reel ;
- relever portée, visites du profil, clics et abonnements chaque semaine ;
- relier la page Facebook si Meta Business Suite doit programmer les contenus.

### Google Search Console

- ajouter la propriété de domaine `cyclostratege.fr` ;
- utiliser la valeur de vérification fournie dans `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, ou la vérification DNS ;
- soumettre `https://cyclostratege.fr/sitemap.xml` ;
- demander l’indexation de `/`, `/beta-saison-2`, `/guide` et `/nouveautes`.

### Domaine www

- ajouter `www.cyclostratege.fr` au projet d’hébergement ;
- appliquer chez OVH la valeur DNS exacte indiquée par l’hébergeur ;
- configurer une redirection permanente de `www` vers `https://cyclostratege.fr` ;
- vérifier ensuite HTTP, HTTPS et le certificat.
