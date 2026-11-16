# Agents de fret Keystone

*Traduit par Claude ; relecture par un locuteur natif en attente. Le [README](README.md) anglais fait foi.*

Trente petits agents MCP pour les coûts de fret et d'expédition. Chacun est responsable d'**une seule tâche**, comme contrôler une facture de transport, préparer la provision de fret de fin de mois, régler les transporteurs ou vérifier une déclaration en douane, et ne peut pas agir au-delà. Ils lisent les fichiers que vous exportez déjà de votre TMS, ERP, WMS, des portails transporteurs et de votre prestataire EDI, écrivent leurs rapports sur votre machine et attendent une personne nommée avant tout ce qui déplace de l'argent, envoie un message ou modifie un système en production.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · aucune dépendance

## Essayer

```bash
npx -y polaris-of-bills demo        # contrôle de factures de fret sur données fictives
npx -y procyon-of-accruals demo     # provision de fret sur données fictives
```

Chaque agent a une `demo` sur fichiers fictifs, un `eval` sur ses propres cas de test et un serveur MCP (`npx -y <agent> mcp --root <dossier>`) pour Claude Desktop, Claude Code, Cursor et d'autres hôtes MCP. Les noms de colonnes et les rapports sont en anglais pour l'instant.

## Les agents

**Ce que facturent les transporteurs :** `polaris-of-bills` (factures complet et groupage contre contrats), `sirius-of-parcels` (factures colis), `vega-of-detention` (immobilisation et attente), `spica-of-fuel` (surcharges carburant), `betelgeuse-of-accessorials` (origine des prestations annexes), `bellatrix-of-reweighs` (repesées et changements de classe), `algol-of-duplicates` (paiements en double), `adhara-of-ocean` (maritime), `canopus-of-air` (aérien), `alcor-of-pods` (preuves de livraison), `fomalhaut-of-demurrage` (franchise des conteneurs et surestaries), `antares-of-entries` (déclarations en douane contre factures commerciales, sans conseil de classement).

**Planifier, acheter et piloter le fret :** `altair-of-bids` (appels d'offres), `regulus-of-tariffs` (historique revalorisé sous chaque contrat), `nunki-of-quotes` (cotations spot), `mizar-of-lanes` (dépenses par ligne et groupage), `rigel-of-scorecards` (tableaux de bord transporteurs), `aldebaran-of-carriers` (signaux de fraude), `mira-of-tracking` (envois en retard), `hadar-of-docks` (rendez-vous à quai), `deneb-of-cartons` (tailles de cartons), `arcturus-of-edi` (lecture et rapprochement des fichiers X12).

**Clôture et coûts :** `procyon-of-accruals` (provision de fret), `castor-of-allocations` (fret réparti par commande et centre de coût), `pollux-of-costing` (standards de fret dans le coût des articles), `elnath-of-margins` (fret facturé contre fret réel par client), `alnilam-of-settlements` (paiement des transporteurs pour courtiers), `capella-of-claims` (réclamations pour avarie), `achernar-of-returns` (retours jusqu'à l'avoir), `shaula-of-emissions` (estimations d'émissions avec les facteurs de votre choix).

## Comment ils restent sûrs

- **Liste autorisée par agent.** Chaque agent ne peut appeler que ses propres outils.
- **Outils refusés.** Payer, envoyer des e-mails, modifier le TMS, comptabiliser au grand livre ou déposer en douane sont nommés et bloqués.
- **Un clic nominatif.** Paiements, envois, changements en production et validations d'écritures attendent une personne nommée, même en mode Auto, liés au sha256 du brouillon relu.
- **Journal d'audit** sous `.keystone/`, chaîné par hachage, signé si vous configurez une clé Ed25519.
- **Arrêt d'urgence :** `<agent> kill` arrête tous les outils jusqu'à `<agent> unkill`.

## Limites

- Chaque agent travaille uniquement avec les fichiers que vous lui donnez et ne se connecte à aucun système de transporteur, TMS, ERP, banque ou administration.
- Aucun conseil juridique, fiscal, douanier ou comptable. Les personnes décident et agissent.
