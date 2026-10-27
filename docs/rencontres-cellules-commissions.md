# Rencontres internes des cellules et commissions

Un compte ORG_UNIT_RESP peut créer et gérer les rencontres de ses institutions actives, via « Mon Institution » → « Créer une rencontre » ou « Mes Rencontres ». Le serveur vérifie les affectations actuelles, y compris après révocation. Les présences sont saisies en nombres hommes/femmes ; elles ne modifient pas les statistiques de présence des sections.

La localité consulte les comptes rendus dans « Historique » et peut filtrer les organisateurs « Cellules » / « Commissions ». Le nom de la cellule/commission apparaît aussi dans le détail et le document imprimable. Les responsables disposent du formulaire habituel (type, date, lieu libre, thème ou ordre du jour, développement/PV, observations) et de la fenêtre de modification/suppression existante de 24 heures.

## Mise en ligne

Déployer le backend avec `npm run build`, puis exécuter `npx prisma migrate deploy` avant son démarrage, comme configuré sur Render. La migration `20261027090000_org_unit_rencontres` ajoute le scope ORG_UNIT, une relation facultative et un index ; elle ne supprime ni ne réécrit les rencontres existantes. Déployer ensuite le frontend pour exposer les nouveaux accès. Ne pas utiliser `db push` ou réinitialiser la base de production.

Le rattachement institutionnel ne peut pas être modifié après création. La suppression d’une institution contenant des rencontres est empêchée pour préserver l’historique ; elle peut être masquée à la place.

## Vérifications

- Frontend : `npm --prefix frontend run build`.
- Backend + scénarios API : `npm --prefix backend run test:org-unit-rencontres`.
- Les tests utilisent une persistance simulée, sans connexion à une base réelle. Ils couvrent création cellule/commission, rattachement forcé par le serveur, isolation, visibilité locale, filtres, révocation d’affectation, institutions désactivées et verrouillage après 24 heures.
- En prévisualisation : connecter un responsable affecté, créer une rencontre, vérifier son compte rendu depuis la localité, puis vérifier qu’un autre responsable sans affectation ne peut pas y accéder.

## Archives mensuelles intégrales

Historique, Mes Rencontres et Historique sections utilisent les mêmes archives par année/mois. Le serveur agrège toutes les dates autorisées pour fournir les mois et les totaux, puis charge 50 rencontres par page du mois sélectionné. Aucune date minimale ni durée de conservation n'est appliquée. Les droits existants restent appliqués aux résumés et aux listes. Les totaux mensuels portent sur tout le mois filtré, pas seulement la page affichée. La navigation permet de rejoindre le premier mois enregistré, même au-delà de 100 ou 5 000 rencontres.

L'API `GET /api/rencontres?archive=1` retourne les mois avec leurs effectifs et présences cumulées. `month=AAAA-MM&page=1&limit=50` retourne les rencontres du mois, en ordre déterministe. Les filtres existants sont combinés avec le mois. `sectionsOnly=1` réserve l'historique par section au périmètre de l'utilisateur. L'ancienne limite arbitraire de 5 000 lignes du point d'accès sections-history a été retirée.

Les tests couvrent des archives de plusieurs années, un mois de 151 rencontres réparties sur quatre pages sans doublon, l'accès à un mois ancien, le 29 février et le refus des mois invalides. Les rencontres déjà supprimées ne sont pas recréées.
