# Agents Fairlease pour la gestion immobilière

Trente petits agents MCP pour la gestion immobilière, pensés pour les gestionnaires d'immobilier commercial et de parcs résidentiels de taille moyenne. Chacun a **une seule tâche**, par exemple contrôler l'état locatif face aux baux, rapprocher un compte de gestion pour compte de tiers, recalculer les charges (CAM) ou relancer les attestations d'assurance des locataires, et ne peut rien faire en dehors. Ils lisent les fichiers que vous exportez déjà d'AppFolio, Yardi, Buildium, Rent Manager et d'autres systèmes, écrivent leurs rapports sur votre machine, ne déplacent jamais d'argent et ne modifient jamais un système en production, et attendent une personne nommée avant qu'une lettre ou un avis ne parte.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · aucune dépendance

Autres langues : [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (traduit par Claude ; relecture par un locuteur natif en attente)

## Essayer

Depuis une copie de ce dépôt :

```bash
npm ci
node packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js demo     # état locatif face aux fiches de bail, données fictives
node packages/fairlease-trust-reconciliation/bin/fairlease-trust-reconciliation.js demo           # rapprochement à trois voies d'un compte mandant, données fictives
```

Une fois les paquets publiés sur npm, la même chose fonctionne avec `npx -y fairlease-rent-roll-audit demo`. Chaque agent a un `demo` sur des fichiers fictifs, un `eval` qui le vérifie sur ses propres cas de test, un `inspect <fichier>` qui montre comment les colonnes ont été lues, et un serveur MCP (`<agent> mcp --root <dossier>`) pour Claude Desktop, Claude Code, Cursor et d'autres hôtes MCP. Avec `--lang fr`, les titres, intertitres et noms de colonnes des rapports ainsi que la page d'approbation sortent en français (neuf langues disponibles) ; les phrases des constats et les résultats des outils restent en anglais. Le README de chaque agent liste ses outils.

## Les agents

**État locatif, baux et revenus**

| Agent | Ce qu'il fait | Ne fait jamais (bloqué) |
|---|---|---|
| [`fairlease-rent-roll-audit`](packages/fairlease-rent-roll-audit) | État locatif face à vos fiches de bail, lot par lot : loyers, paliers, dates, dépôts, surfaces, locataires, vacance, maintien dans les lieux | Modifier le logiciel de gestion ou passer des écritures au locataire |
| [`fairlease-lease-abstracts`](packages/fairlease-lease-abstracts) | Baux commerciaux résumés clause par clause avec la référence de chaque terme ; fiches existantes contrôlées face au texte | Modifier le système ou envoyer en signature |
| [`fairlease-rent-escalations`](packages/fairlease-rent-escalations) | Loyer facturé face aux règles d'indexation et de paliers de chaque bail (paliers, pourcentages, indice avec plancher et plafond) ; hausses à venir | Passer des écritures au locataire |
| [`fairlease-lease-renewals`](packages/fairlease-lease-renewals) | Baux à renouveler, dates limites d'offre, loyers proposés dans votre propre plafond, lettres d'offre en brouillon | Envoyer en signature ou par e-mail |
| [`fairlease-occupancy-and-vacancy`](packages/fairlease-occupancy-and-vacancy) | Occupation, taux loué, exposition, perte de vacance et écart au loyer de marché à partir d'un état locatif | Modifier le système ou publier des annonces |
| [`fairlease-percentage-rent`](packages/fairlease-percentage-rent) | Loyer variable sur chiffre d'affaires à partir des déclarations des locataires, déclarations en retard ou manquantes, relevé en brouillon | Passer des écritures ou lancer un audit du chiffre d'affaires |
| [`fairlease-estoppel-review`](packages/fairlease-estoppel-review) | Attestations de locataires (estoppels) retournées, face à vos fiches de bail avant une vente ou un refinancement | Envoyer en signature ou déposer dans une data room |
| [`fairlease-acquisition-diligence`](packages/fairlease-acquisition-diligence) | État locatif d'un vendeur face aux douze derniers mois de revenus avant un achat ou un financement | Soumettre une offre ou déposer dans une data room |
| [`fairlease-pms-migration`](packages/fairlease-pms-migration) | État locatif de l'ancien système face au nouveau à la bascule : lots, locataires, loyers, dépôts, soldes, dates, totaux qui ne concordent pas | Valider la mise en production ou supprimer les anciennes données |

**Locataires, commercialisation et recouvrement**

| Agent | Ce qu'il fait | Ne fait jamais (bloqué) |
|---|---|---|
| [`fairlease-delinquency-worklist`](packages/fairlease-delinquency-worklist) | Balance âgée ou compte locataire transformés en liste de travail avec les étapes de votre propre politique, contrôle des pénalités, relances en brouillon | Signifier des actes, engager une expulsion ou déclarer à un fichier de crédit |
| [`fairlease-security-deposits`](packages/fairlease-security-deposits) | Dépôts de garantie au départ face à vos propres règles (délai, détail, usure normale, vétusté) ; décompte en brouillon | Rembourser ou transmettre au recouvrement |
| [`fairlease-tenant-insurance`](packages/fairlease-tenant-insurance) | Attestations d'assurance des locataires face aux montants, assurés additionnels et dates exigés par le bail | Souscrire une assurance pour compte ou envoyer une mise en demeure |
| [`fairlease-utility-billback`](packages/fairlease-utility-billback) | Refacturation des fluides (RUBS) recalculée selon votre propre méthode ; sur-récupération, lots vacants facturés, pics | Passer des écritures ou modifier les portails des fournisseurs |
| [`fairlease-listing-checks`](packages/fairlease-listing-checks) | Annonces sur tous les sites face à l'état locatif ; formulations signalées pour relecture par une personne | Publier des annonces, changer le loyer demandé ou répondre aux candidats |
| [`fairlease-leasing-funnel`](packages/fairlease-leasing-funnel) | Entonnoir de location à partir des fiches prospects : réponses lentes ou absentes, relances dues, conversion et coût par bail selon la source | Décider des dossiers, lancer une vérification ou écrire aux candidats |
| [`fairlease-affordable-recerts`](packages/fairlease-affordable-recerts) | Dates et avis de recertification en logement aidé selon le calendrier de votre fichier de politique. Dates uniquement | Certifier un ménage, transmettre à un organisme ou changer un loyer |
| [`fairlease-short-term-rental-payouts`](packages/fairlease-short-term-rental-payouts) | Versements de location courte durée (Airbnb, Vrbo et autres) face aux réservations et aux encaissements bancaires | Rembourser des voyageurs, payer les propriétaires ou modifier les annonces |

**Propriétaires, comptes mandants et comptabilité**

| Agent | Ce qu'il fait | Ne fait jamais (bloqué) |
|---|---|---|
| [`fairlease-trust-reconciliation`](packages/fairlease-trust-reconciliation) | Rapprochement à trois voies : relevé bancaire, journal de trésorerie, comptes propriétaires et locataires | Déplacer des fonds, annuler des chèques ou passer au grand livre |
| [`fairlease-owner-statements`](packages/fairlease-owner-statements) | Comptes rendus de gestion contrôlés avant envoi : calculs, report, réserves, reversements | Payer les propriétaires ou publier les comptes rendus |
| [`fairlease-management-fees`](packages/fairlease-management-fees) | Honoraires de gestion, de location et majorations recalculés à partir de chaque mandat | Passer des avoirs ou modifier le paramétrage des honoraires |
| [`fairlease-cam-reconciliation`](packages/fairlease-cam-reconciliation) | Régularisation des charges (CAM) : pools de dépenses, quotes-parts, extrapolation d'occupation, plafonds, années de base, frais de gestion | Passer des écritures ou modifier le système |
| [`fairlease-budget-variance`](packages/fairlease-budget-variance) | Budget face au réalisé, écarts à expliquer selon le mandat, prévision de fin d'année, note au propriétaire en brouillon | Modifier le budget ou passer au grand livre |
| [`fairlease-tax-forms`](packages/fairlease-tax-forms) | Préparation des formulaires américains 1099 : totaux par bénéficiaire face au seuil que vous donnez, identifiants fiscaux et adresses manquants ; identifiants toujours masqués | Déposer les 1099, lancer un contrôle d'identifiant ou une retenue à la source |
| [`fairlease-hoa-accounts`](packages/fairlease-hoa-accounts) | Comptes des copropriétaires (HOA, copropriété) face à votre politique d'appels de fonds et de recouvrement ; infractions face à vos étapes d'avis | Inscrire une hypothèque légale ou passer des amendes |
| [`fairlease-property-taxes`](packages/fairlease-property-taxes) | Avis de taxe foncière, échéances et dates limites de recours que vous saisissez ; calendrier des échéances | Déposer un recours ou payer l'impôt |

**Exploitation et prestataires**

| Agent | Ce qu'il fait | Ne fait jamais (bloqué) |
|---|---|---|
| [`fairlease-work-orders`](packages/fairlease-work-orders) | Bons d'intervention ouverts vieillis selon vos délais cibles, problèmes répétés, urgences saisies comme routine, prestataires lents | Missionner un prestataire, valider une facture ou clore un bon |
| [`fairlease-unit-turns`](packages/fairlease-unit-turns) | Remises en état entre départ et arrivée : jours, coût par corps de métier, éléments refacturables, loyer perdu | Missionner un prestataire ou passer des écritures |
| [`fairlease-unit-inspections`](packages/fairlease-unit-inspections) | État des lieux de sortie face à l'entrée, point par point, visites en retard, points en mauvais état sans intervention | Passer des écritures ou missionner un prestataire |
| [`fairlease-capital-projects`](packages/fairlease-capital-projects) | Travaux d'investissement face au budget, aux engagements, au planning et aux réserves | Valider des avenants ou des factures |
| [`fairlease-vendor-compliance`](packages/fairlease-vendor-compliance) | Assurance, licence et formulaire fiscal des prestataires face à vos exigences ; paiements faits hors conformité | Valider des factures ou changer le statut d'un prestataire |

## Comment ils restent sûrs

- **Liste blanche par agent.** Chaque agent ne peut appeler que ses propres outils. Tout le reste est bloqué, y compris les outils qu'un modèle invente.
- **Outils refusés.** Chaque agent nomme les actions réelles proches de sa tâche (remboursements, écritures, expulsions, déclarations, envoi d'e-mails) et les bloque ; un modèle qui les demande reçoit un refus clair.
- **Un clic nominatif.** Envoyer un brouillon, accepter ce que l'agent doit retenir ou valider une mise en production attend une personne nommée, même en mode Auto. L'accord est lié au sha256 du brouillon relu ; si le brouillon change, l'accord ne correspond plus.
- **Journal d'audit.** Chaque appel est écrit dans un journal chaîné par hachage sous `.keystone/`, signé en Ed25519 si vous configurez une clé.
- **Arrêt d'urgence.** `<agent> kill` arrête tous les outils jusqu'à `<agent> unkill`.
- **Testés contre les entrées hostiles.** Formules de tableur, HTML, chemins piégés et texte adressé au modèle sont glissés dans les données de chaque agent (`npm run hostile`).
- **Peu de données personnelles.** Les identifiants fiscaux sont masqués dans chaque rapport. Le journal d'audit garde un hachage des arguments, pas les arguments, et les agents ne gardent aucune copie de vos fichiers.

## Avec Claude Code

Ce dépôt est une place de marché de plugins Claude Code. Chaque agent est un plugin qui lance son serveur MCP avec `npx` :

```text
/plugin marketplace add <chemin ou URL git de ce dépôt>
/plugin install fairlease-rent-roll-audit@keystone-property
```

Les plugins lancent `npx -y <agent>@<version>` et ont donc besoin de cette version sur npm. En attendant, ajoutez un agent depuis une copie locale :

```bash
claude mcp add fairlease-rent-roll-audit -- node /chemin/vers/fairlease-agents/packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js mcp --root .
```

## Développer

```bash
npm ci
npm test                       # tests et evals de chaque paquet
npm run hostile                # entrées hostiles glissées dans chaque agent
npm run bench                  # temps sur 1 000 et 10 000 lignes
npm run plugin:check           # fichiers de plugin cohérents avec les paquets
npm run intl                   # chaque eval rejoué sur des fichiers de huit autres marchés
npm run mcp:check              # client officiel du SDK MCP contre chaque agent
npm run release:check:offline  # contenu des paquets, licences, docs et versions
```

Le workflow de CI tourne sur Node 20, 22 et 24, sous Linux et Windows.

## Limites

- Chaque agent travaille sur les fichiers que vous lui donnez. Aucun ne se connecte à un logiciel de gestion, une banque, un site d'annonces, une plateforme ou une administration.
- Les formats d'export nommés ont été écrits d'après la connaissance de ces exports et n'ont pas été vérifiés sur des comptes réels. Si un en-tête diffère, `inspect` montre ce qui a été associé et `keystone-sources.json` permet de nommer les colonnes à la main.
- Les constats ne valent que ce que valent ces fichiers. Chaque rapport dit ce qu'il a supposé.
- Ni conseil juridique, fiscal ou comptable, ni avis sur la licéité d'une annonce. Seuils, délais et règles d'honoraires viennent de vos propres fichiers de politique. Les personnes décident et agissent.
