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
