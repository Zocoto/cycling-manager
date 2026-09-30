# Gabarit PCM26

`OfficialRelease.template.cdb` est la base `Default` officielle de PCM26 utilisée
comme socle de l'export administrateur Cyclostratège.

- Taille attendue : `441077` octets
- SHA-256 : `f305b1700a797b46f4e0fc7cc19b4dce006119b4081db25b0b20b972839f1d14`
- Le générateur conserve intégralement les courses et étapes de ce gabarit.
- Les données Cyclostratège ajoutées sont limitées aux équipes, sponsors,
  coureurs, contrats et historiques d'équipe.

Ne pas remplacer ce fichier par une base WorldDB sans embarquer également ses
fichiers d'étapes : PCM26 refuserait alors le mod lors du contrôle `CheckRaces`.

`OfficialLocal.template.cdb` est la base locale officielle livrée avec PCM26.
Elle est recopiée sans modification dans le pack afin que le dossier du mod soit
complet et n'émette pas l'avertissement `Could not find file OfficialLocal.cdb`.

- Taille attendue : `2001159` octets
- SHA-256 : `8e4312928de4700fafbb85e2b63b71635ab5455aa45c60dc6190784b7d51a740`
