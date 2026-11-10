# OpenQuest 🗡️

*Budget Quest*, le tracker de dépenses de la cité suspendue, observée depuis le PC de Roré dans l'Open Space.

Tracker de dépenses et de budgets **en FCFA**, présenté comme un RPG 16 bits de la SNES.
Un seul fichier : `index.html`. Il ne demande ni installation ni serveur.

## Utilisation

Le jeu tient dans un seul fichier, `public/index.html`. Il est mis en ligne par un **Worker Cloudflare** (`openquest`), derrière une porte d'entrée : il faut donner son nom et le code d'accès pour entrer.

| Fichier | Rôle |
|---|---|
| `public/index.html` | Le jeu |
| `src/worker.js` | La porte d'entrée (vérifie le code, ouvre la session, note les entrées, sert le jeu) et le coffre en ligne de chaque joueur (`/api/coffre`) |
| `wrangler.jsonc` | La configuration du Worker (nom, fichiers statiques, coffre des joueurs, journaux) |

### Où sont gardées les données

- **Sur l'appareil**, en cache (`localStorage`) : le jeu marche même si la connexion tombe.
- **En ligne, dans un coffre** (un Durable Object Cloudflare par joueur), rangé sous **le nom donné à la porte d'entrée** (sans tenir compte des majuscules ni des accents). Chaque modification y part dans la seconde.
- Au lancement, et chaque fois qu'on revient sur l'onglet, le jeu compare les deux copies et garde **la plus récente**. Avec le même nom, on retrouve donc sa trésorerie de départ, son personnage et toutes ses données sur n'importe quel téléphone ou ordinateur, même après avoir vidé le navigateur.
- ⚙ › Sauvegarde indique si le coffre est actif et à quelle heure il a été mis à jour. **Exporter (JSON) / Importer** reste possible pour garder une copie à soi.
- Le coffre est créé automatiquement au déploiement : rien à régler dans le tableau de bord.
- *À savoir* : toute personne qui connaît le code d'accès et tape le même nom voit les mêmes données. Si deux appareils modifient en même temps, la dernière modification l'emporte.
**Exporter (CSV)** sort tes dépenses pour Excel, avec `;` comme séparateur.

## La porte d'entrée : le code d'accès

Au lancement, une fenêtre demande **ton nom** et **le code d'accès**. **Toutes les 15 minutes, le code est redemandé** : le jeu se cache derrière un écran « Session expirée » ; il suffit de redonner le code (le nom est retenu), et l'on reprend là où l'on était, sans rien perdre. Le code est vérifié par le Worker, jamais dans la page : il n'apparaît nulle part dans le code du jeu.
- Le bon code ouvre une session de 15 minutes. Le nom, lui, est retenu 30 jours sur l'appareil. ⚙ › Héros affiche le nom donné et un bouton **Se déconnecter**.
- Chaque essai, réussi ou non, est noté avec le nom, la date, le pays et l'adresse IP : c'est ainsi qu'on sait qui a accès.
- **Changer le code** (le secret `TOKEN_PASS`) ferme aussitôt toutes les sessions : chacun devra redonner le nouveau code.
- Sans secret `TOKEN_PASS`, la porte reste fermée.

### Déploiement

Chaque push sur `main` est déployé automatiquement par **Cloudflare Workers Builds** (`npx wrangler deploy`), sur le Worker `openquest`.

**Le code d'accès** : tableau de bord Cloudflare → **Workers & Pages** → `openquest` → **Paramètres** → **Variables et secrets** → **Ajouter** : type **Secret**, nom `TOKEN_PASS`, valeur = le code. Un secret est gardé d'un déploiement à l'autre.

**Voir qui est entré** : Worker `openquest` → **Observabilité** → **Journaux** (lignes `openquest_access`).
*Facultatif, pour garder une liste des entrées* : créer un espace **KV** et le déclarer dans `wrangler.jsonc` sous le nom `ACCESS_LOG` (pas seulement dans le tableau de bord : chaque déploiement remplace les liaisons par celles du fichier). Chaque entrée y est gardée 180 jours.

**Essayer en local** : créer un fichier `.dev.vars` contenant `TOKEN_PASS=un-code` (il est ignoré par git), puis lancer `npx wrangler dev`.

**À savoir** : la porte protège le site mis en ligne, pas le dépôt. Tant que `RoreAndreas/OpenQuest` est public, son code reste lisible sur GitHub ; passe-le en privé si tu veux le cacher. N'active pas GitHub Pages : ce serait une seconde adresse, sans porte.

## Au départ

1. **Choisis ton personnage** parmi 13 robots :
   - l'équipe de l'Open Space : Roré, Nyx, Merlain, Boulon, Margaux, Zaza, Rook, Hares ;
   - les nouveaux venus de la cité : **Kora** (marchande, foulard et collier de perles), **Ama** (pilote de dirigeable, lunettes et écharpe), **Baobab** (jardinier, chapeau de paille et tablier), **Pépin** (cuisinier, toque) et **Lune** (astronome, cape étoilée).
2. Donne-lui un nom, et indique ta **trésorerie de départ** : ce que tu as aujourd'hui.

Si tu choisis un membre de l'équipe qui tient un lieu, Roré prend sa place au comptoir. Tu peux changer de personnage plus tard (⚙ › Personnage) : ton niveau, tes accessoires et tes tenues te suivent.

## Ce qu'on voit : la cité, depuis le PC de Roré

L'écran est celui du PC de Roré, posé sur son bureau de l'Open Space, avec sa tasse « 43 ».
Sur le moniteur, on observe **la cité suspendue** : un panorama en 2D qu'on fait glisser de gauche à droite.
- Au premier plan, la rue de la cité, sur sa terrasse à balustrade, avec des maisons de ville du XVIIIe siècle.
- Chaque lieu a son allure propre :

| Lieu | Ce qui le distingue |
|---|---|
| **La maison du héros** | Jardinières fleuries, antenne parabolique sur le toit, plaque « 43 » près de la porte |
| **Les Archives** | Haute façade de pierre, horloge dans le toit, perron |
| **Le Marché** | Auvent rayé rouge et blanc, cagettes d'oranges, de légumes et de fruits rouges |
| **Le Tableau des quêtes** | Petit toit, avis épinglés, cloche |
| **La Banque** | Temple de pierre claire, colonnes, fronton à la pièce d'or, porte de bronze cloutée |
| **Le Labo** | Brique rouge, verrière en dents de scie, baie verte lumineuse, cheminée qui fume, bobine qui crépite |
| **Le Belvédère** | Longue-vue de laiton, banc, pots de fleurs |

- Entre les groupes de maisons, des terrasses ouvertes sur **la vallée en contrebas**.

**Pour se promener** : fais glisser le paysage (doigt, souris, molette) ou utilise les flèches ← →.
**Au survol** d'un lieu (souris), sa silhouette s'illumine et un onglet s'affiche au-dessus : le nom du lieu, le robot qui le tient, ce qu'on y fait. Un toucher ou un clic l'ouvre : la caméra y glisse, le reste s'assombrit autour de sa silhouette, et le robot parle.

### La ville en contrebas : elle part de zéro

Au début, la vallée est vide : des champs, des haies, une rivière.
**Chaque jour terminé sous le budget du jour, elle gagne une construction.** Dès que la journée est sur la bonne voie, un échafaudage montre où la ville grandira demain ; il disparaît si la journée déborde.

| Jour tenu | Construction |
|---|---|
| 1, 2, 4 | Les premiers bouts de chemin pavé |
| 3, 5 | Un arbre, une maison |
| 8 | Le puits |
| 10 | Un potager |
| 14 | Le moulin |
| 20 | Le lac |
| 25 | La place pavée |
| 30 | L'église |
| 40 | Le pont sur la rivière |
| 50 | La halle du marché |
| 60 | La tour de guet |
| 75 | La grande coupole |
| 90 | Le château, sur sa colline |
| 100 à 115 | Les remparts, pan par pan |
| 120 | Le palais royal |
| 150 | Les bannières du royaume |

Entre ces étapes : des maisons, des arbres, des chemins et des potagers. La ville est complète au bout de 200 jours tenus.

### Les petites animations du fond

Discrètes, sur ordinateur seulement (coupées sur téléphone et quand l'appareil demande moins d'animations) :
- **le ciel** : nuages qui glissent, une volée d'oiseaux de temps en temps, le dirigeable d'Ama, des étoiles filantes la nuit ;
- **la vallée** : fumée des cheminées, ailes du moulin qui tournent, rivière et lac qui scintillent, barque qui glisse sur le lac ;
- **la rue** : flammes des lanternes qui vacillent, un chat sur la balustrade qui remue la queue, des pigeons qui picorent puis s'envolent ;
- **l'ambiance de l'heure** : pétales et feuilles au vent, brume du matin sur la vallée (6 h – 10 h), poussière dorée du soir (17 h – 21 h), lucioles la nuit.

### L'heure et la météo

| Ce qui change | Ce qui le décide |
|---|---|
| **L'heure** : jour, soir, nuit étoilée, fenêtres et lanternes allumées | L'heure réelle de l'appareil |
| **La météo** : soleil, nuages, pluie, orage avec éclairs | Soleil sous le budget du jour, nuages près de la limite, pluie au-delà, orage si une catégorie dépasse son budget de 25 % ou si les PV tombent sous 25 |

## Les menus, comme dans Final Fantasy

**Sur téléphone**, l'affichage est épuré : plein écran, sans moniteur ni bureau, la scène en bandeau, le menu en onglets à faire défiler (« ◂ Retour » toujours en premier), l'écran du lieu en entier et une barre d'état réduite à la trésorerie, au niveau et à la série. Les répliques des robots ne s'y affichent pas.

Tout passe par les fenêtres bleues du bas : on choisit avec la main, au doigt, à la souris ou au clavier (↑ ↓, Entrée, Échap).

| Menu | Lieu | Robot | Ce qu'on y fait |
|---|---|---|---|
| **Dépense** | Le Marché | Zaza | **Noter** un décaissement (dépense) ou un encaissement (rentrée), **Autres flux** (remboursements, dons, épargne), pointer un jour sans dépense, revoir les derniers mouvements |
| **Écarts** | La Banque des Écarts | Hares | Bilan du mois (budget, réel, écart, projection), écarts par catégorie, graphique jour par jour, plus grosses dépenses |
| **Journal** | Les Archives | Margaux | Calendrier du mois, liste, modification et suppression |
| **Quêtes** | Le Tableau des quêtes | Rook | Habitudes du jour, semaine, **progression**, trophées, nouvelle quête, **Gérer** (renommer, supprimer : l'XP déjà gagnée reste acquise) |
| **Suivis** | Le Labo | Boulon | Compteurs personnalisés avec un objectif « au moins » ou « au plus » |
| **Trésorerie** | La Banque | Hares | Le solde d'aujourd'hui et son calcul (départ, rentrées, dépenses, remboursements), ce qui reste dû, le départ à modifier |
| **🎁 (en haut à droite)** | Le Belvédère | Merlain | La wishlist (envies et projets), les prévisions sur 12 mois, un conseil |
| **⚙ (en haut à droite de l'écran)** | La maison du héros | — | La configuration : héros, personnage, apparence, tenues, budgets, catégories, sauvegarde, règles |
| — | Le Belvédère (à toucher dans la scène) | Merlain | Des conseils, et la prochaine construction de la vallée |

**Changer de mois** (Écarts, Journal, Budgets) : les deux flèches de part et d'autre du mois, en haut de l'écran, ou les touches Page précédente / Page suivante.

La barre d'état montre la trésorerie, les PV, le niveau avec sa jauge d'XP et l'XP gagnée aujourd'hui, la série et son multiplicateur. Touche la trésorerie ou le niveau pour ouvrir l'écran correspondant.

## La trésorerie

**Trésorerie = trésorerie de départ + rentrées − dépenses ± remboursements**, comptées depuis la date de départ.
Trésorerie montre le détail, les dernières rentrées, et ce qui restera à la fin du mois si le budget est tenu.


## La wishlist et les prévisions (bouton 🎁)

Le bouton **🎁**, à côté de ⚙ en haut à droite, ouvre le Belvédère : la longue-vue de Merlain regarde l'avenir.

**Envies** : chaque envie (ou projet) a un nom, un prix estimé, **la catégorie de budget** où elle tombe et **le mois prévu**.
- Elle **réserve** son prix dans ce budget, ce mois-là : le budget du jour du mois baisse d'autant, pour que l'argent soit mis de côté au fil des jours.
- Si elle coûte plus que le budget de sa catégorie, la ligne le signale ; **Ajuster** monte le budget de ce seul mois, juste assez (les autres mois ne changent pas).
- **Acheté** : l'envie devient une vraie dépense (au prix réellement payé) et sa réservation disparaît. Écarts › Catégories montre les montants réservés.

**Prévisions** : trois chiffres (aujourd'hui, au plus bas, dans 12 mois) et **une barre par mois** : la trésorerie prévue à la fin du mois, verte au-dessus de zéro, rouge en dessous, avec un point doré quand une envie tombe ce mois-là. Toucher une barre affiche le mois, la trésorerie, le revenu et les budgets comptés. Le détail mois par mois reste disponible en dessous.
- Chaque mois : + le revenu mensuel prévu − les budgets du mois. Une envie plus chère que son budget pèse en plus. Le mois en cours ne compte que ce qui reste à dépenser.
- Le revenu prévu se règle sur l'écran ; sans réglage, c'est la moyenne des rentrées des trois derniers mois.
- Si la courbe passe sous zéro, l'écran dit quand et de combien : de quoi repousser une envie, ajuster un budget ou prévoir une rentrée.

## Noter : décaissement ou encaissement

Marché › **Noter** commence par le sens du mouvement :
- **Décaissement** : une dépense, dans une catégorie de budget. Elle compte dans le budget du jour.
- **Encaissement** : une rentrée, avec sa catégorie (Salaire, Prime, Vente, Cadeau reçu, Autre). Elle s'ajoute à la trésorerie sans changer le budget du jour. Le revenu prévu des prévisions ignore les cadeaux reçus.

Récentes montre les deux, mêlés par date.

## Les autres flux (hors budget)

Marché › **Autres flux** regroupe ce qui touche la trésorerie **sans toucher au budget** : ni le budget du jour, ni l'XP, ni la météo, ni la ville en contrebas ne bougent.

| Flux | Effet sur la trésorerie |
|---|---|
| **J'ai avancé de l'argent** (on me doit) | Aucun à la saisie (déjà dans la trésorerie de départ) ; elle remonte quand on te rembourse |
| **On a payé à ma place** (je dois) | Aucun à la saisie ; elle baisse quand tu rembourses |
| **On m'a prêté de l'argent** (je dois) | Aucun à la saisie (déjà dans la trésorerie de départ) ; elle baisse quand tu rembourses |
| **J'ai fait un don** | Elle baisse du montant du don |
| **J'ai mis de côté** (épargne) | Elle baisse ; l'épargne monte |
| **J'ai retiré de l'épargne** | Elle remonte ; l'épargne baisse |

- Pour un prêt ou une avance fait **après** ta trésorerie de départ, coche « Pas encore dans ma trésorerie » : il sera alors compté.
- Remboursements : le bouton ✓ règle tout ou partie. L'écran montre le **solde réel** (encaissé − remboursé par toi), le **solde théorique** (on te doit − tu dois), le **combiné** et la trésorerie **si tout est remboursé et encaissé**.
- Dons et épargne : le total des dons, l'épargne totale de côté, et la liste des derniers mouvements.

L'écran Trésorerie reprend tout : le **disponible** (départ + rentrées − dépenses ± remboursements − dons − mis de côté + retiré de l'épargne), l'épargne de côté, puis la trésorerie **si tout est remboursé et encaissé**, dont partent les prévisions.

## L'XP : chaque jour compte

| Ce qui rapporte, chaque jour | XP |
|---|---|
| Journal tenu (au moins une dépense notée, ou un jour sans dépense pointé) | +10 |
| Chaque dépense notée (5 au plus) | +2 |
| Sous le budget du jour (plus tu restes loin de la limite, plus ça rapporte) | +30 à +50 |
| Journée sans dépense | +20 |
| Chaque quête accomplie | +15 |
| Toutes les quêtes du jour | +25 |
| Chaque mesure de suivi (objectif atteint : +10) | +5 |

- **Combo de série** : l'XP du jour est multipliée par la série en cours, +4 % par jour, jusqu'à **×2** au 25e jour.
- **Paliers de série** : +150 XP à 7 et 14 jours, +500 à 30, 60 et 100 jours.
- **Fin de mois** : +300 XP si le mois est sous le budget, +40 par catégorie tenue.
- **Niveaux** : le premier demande 100 XP, chaque suivant 75 XP de plus. Les premiers niveaux tombent vite, les suivants restent à portée.
- Quêtes › Progrès détaille l'XP gagnée aujourd'hui, le combo, le prochain accessoire, le prochain titre et la prochaine construction.

### Les accessoires gagnés avec les niveaux

Chaque personnage commence avec son apparence d'origine. Les accessoires se gagnent en montant de niveau, et le héros les porte aussitôt. ⚙ › Apparence permet de les changer.

| Niveau | Accessoire | Emplacement |
|---|---|---|
| 2 | Écharpe | Cou |
| 3 | Lunettes | Visage |
| 4 | Béret | Tête |
| 5 | Cape | Dos |
| 6 | Casque audio | Tête |
| 7 | Lunettes de soleil | Visage |
| 8 | Chapeau de paille | Tête |
| 9 | Lunettes d'aviateur | Visage |
| 10 | Étoile et épaulettes | Poitrine |
| 11 | Collier de perles | Cou |
| 12 | Chapeau d'explorateur | Tête |
| 14 | Foulard | Tête |
| 15 | Voyant de poitrine | Poitrine |
| 16 | Toque | Tête |
| 18 | Chapeau de mage | Tête |
| 20 | Couronne | Tête |

Les couleurs (visière, cape et écharpe, corps) se choisissent librement. Les **tenues** se gagnent avec les récompenses (séries, jours sans dépense, premier mois réussi, niveau 10).

### Les titres

Apprenti (1), Habitant (2), Écuyer (3), Chevalier (5), Gardien du Trésor (7), Paladin de l'Épargne (10), Bâtisseur de cité (13), Seigneur du FCFA (16), Souverain de la vallée (20), Légende vivante (25).

## Son

- Une petite musique en 8 bits, composée et générée dans le navigateur. Elle est coupée au départ : bouton **♪ MUSIQUE** sous l'écran, ou ⚙ › Héros.
- Un bip à chaque choix de menu et pendant que le texte s'écrit, et une fanfare aux montées de niveau.

## Règles

- **Budget du jour** = reste du mois ÷ jours restants.
- **PV** : ils repartent à 100 chaque mois. Une catégorie qui dépasse son budget fait perdre entre 10 et 40 PV ; une journée au-delà de 150 % du budget moyen, 5 PV. Chaque quête accomplie rend 1 PV, jusqu'à 30 par mois.
- **Changer un budget** : ⚙ › Budgets, choisis le mois avec les flèches, modifie les montants (les lignes changées s'entourent d'or et le total se met à jour), puis touche **Valider**. Une confirmation s'affiche. Rien n'est enregistré avant Valider.
- Un budget validé s'applique au mois choisi et aux mois suivants. Les mois passés gardent leurs écarts d'origine.

## Crédits

Les robots sont un portage de `src/engine/robots.ts` de l'[Open Space](https://github.com/RoreAndreas/Openspace43), d'après *Le Bureau des agents* de VibesMoney (licence MIT).
