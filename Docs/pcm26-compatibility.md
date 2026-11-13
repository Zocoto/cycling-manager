# Vérifier un export PCM26 et préparer le Workshop

L’export du site produit une paire `OfficialRelease.cdb` / `OfficialLocal.cdb`,
un identifiant de mod unique, le script d’installation et un rapport
`compatibilite-graphismes.json`. Les deux CDB et leurs empreintes sont
inséparables : le second contient les noms des pays ajoutés au premier.
L’installateur vérifie la paire avant de monter les quatre PAK compatibles
de l’article Steam `3811779261` dans le dossier de la base sélectionnée.

Le code du maillot et du mini-maillot vient du registre des équipes permanentes,
y compris après changement de sponsor. Les clubs sans paire publiée reçoivent
un code qui ne peut désigner la tenue d’un autre club ni un ancien slot du mod.
Le rapport compare les références aux fichiers cuits dans les PAK, et distingue
les titres de champion dans la base des textures personnalisées disponibles.
PCM26 fournit des identifiants de titre pour les championnats nationaux,
mondiaux et européens (route et CLM). La présence d’une texture ne démontre pas
à elle seule son affichage dans chaque mode. Les variantes des Jeux quadriannaux
et des autres championnats continentaux restent conservées comme sources ;
aucun titre natif de remplacement n’est attribué pour les afficher.

Pour reconstruire une base depuis une capture locale vérifiée, utiliser
`scripts/build-pcm-from-reviewed-snapshot.ts` avec son SHA-256 et un nouveau
dossier. `--preserve-gala-schelde` sert exclusivement à reproduire l’archive
du 6 novembre, dont la version publique conservait aussi l’ancienne règle de
l’Escaut. Le gala actif emploie le GP de Dunkerque.

Depuis la racine du projet, avec UnrealPak 5.6 installé :

```powershell
node scripts/prepare-pcm-workshop.mjs --export <dossier-ou-zip> --graphics <ancien-pack> --startlists <capture-des-six-xml.json> --output <nouveau-dossier> --title 'Titre visible dans PCM26'
```

Le script relit les CDB, liste les ressources réellement présentes dans les
PAK, extrait les quatre atlas des drapeaux et compare les six XML aux courses,
aux contrats et aux identifiants des coureurs. Il refuse de préparer le dossier
si un drapeau utilisé ou une tenue d’un club inscrit manque. Le dossier
`Content` est le seul contenu destiné à Steam. `Startlists.zip` reste à part :
World Tour et Continental partagent deux noms natifs et ne peuvent être
installés ensemble. L’installateur vérifie l’empreinte de la BDD avant de
sauvegarder les anciennes compositions et de copier les trois XML choisis.
