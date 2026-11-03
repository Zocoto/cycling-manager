# Rapports des stages de forme

L’assistant du bureau du DS affiche un compte rendu à côté des rapports senior et junior lorsqu’un stage classique ou premium a été effectivement réglé la veille. La ligne indique explicitement Jn : les gains de ce jour de stage sont reçus à Jn+1.

Le lien ouvre `/jeu/centre-de-soin/rapport-stages?jour=N`, dans l’interface connectée. Le détail donne le type et les dates du stage, la forme avant/après et le gain réel par coureur. Les journées précédentes restent consultables pendant la saison active.

Les valeurs proviennent du registre des effets de condition, sans recalcul ni règlement de jeu. Un gain nominal de 20 pour une forme de 95 donne bien +5 ; un stage à 100 reste présent avec +0. Les stages annulés avant réalisation et les préparations de parcours sont exclus ; les journées acquises avant une interruption sont conservées.

Le résumé utilise la requête existante de l’assistant, un accès indexé par équipe et le délai existant de trois secondes. Le détail utilise une RPC authentifiée sans paramètre d’équipe, ne permettant de consulter que son propre effectif.

Validation : 162 tests applicatifs ciblés, 40 assertions SQL sur PGlite isolé, TypeScript, ESLint, build et postbuild. Installation bornée et reçue par `scripts/apply-reviewed-daily-form-camp-reports.mjs` ; aucun changement de coureur, de programme, de gain ou de règlement.
