# Agenti per i trasporti Keystone

*Tradotto da Claude; revisione di un madrelingua in attesa. Il [README](README.md) inglese fa fede.*

Trenta piccoli agenti MCP per i costi di trasporto e spedizione. Ognuno si occupa di **un solo compito**, come controllare una fattura di trasporto, preparare il rateo dei trasporti di fine mese, liquidare i pagamenti ai vettori o verificare una dichiarazione doganale, e non può agire oltre. Leggono i file che già esportate da TMS, ERP, WMS, portali dei vettori e fornitore EDI, scrivono i report sul vostro computer e attendono una persona indicata per nome prima di qualsiasi cosa che sposti denaro, invii un messaggio o modifichi un sistema in produzione.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · nessuna dipendenza

## Provare

```bash
npx -y polaris-of-bills demo        # controllo fatture di trasporto su dati fittizi
npx -y procyon-of-accruals demo     # rateo dei trasporti su dati fittizi
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi di prova e un server MCP (`npx -y <agent> mcp --root <cartella>`) per Claude Desktop, Claude Code, Cursor e altri host MCP. Per ora i nomi delle colonne e i report sono in inglese.

## Gli agenti

**Cosa fatturano i vettori:** `polaris-of-bills` (carico completo e groupage rispetto ai contratti), `sirius-of-parcels` (corrieri), `vega-of-detention` (soste e attese), `spica-of-fuel` (supplementi carburante), `betelgeuse-of-accessorials` (origine dei servizi accessori), `bellatrix-of-reweighs` (ripesature e cambi di classe), `algol-of-duplicates` (pagamenti doppi), `adhara-of-ocean` (marittimo), `canopus-of-air` (aereo), `alcor-of-pods` (prove di consegna), `fomalhaut-of-demurrage` (franchigia container e controstallie), `antares-of-entries` (dichiarazioni doganali rispetto alle fatture commerciali, senza consulenza sulla classificazione).

**Pianificare, acquistare e gestire i trasporti:** `altair-of-bids` (gare), `regulus-of-tariffs` (storico ricalcolato con ogni contratto), `nunki-of-quotes` (quotazioni spot), `mizar-of-lanes` (spesa per tratta e consolidamento), `rigel-of-scorecards` (scorecard dei vettori), `aldebaran-of-carriers` (segnali di frode), `mira-of-tracking` (spedizioni in ritardo), `hadar-of-docks` (appuntamenti alle baie), `deneb-of-cartons` (dimensioni degli imballi), `arcturus-of-edi` (lettura e riconciliazione dei file X12).

**Chiusura e costi:** `procyon-of-accruals` (rateo dei trasporti), `castor-of-allocations` (trasporto ripartito per ordine e centro di costo), `pollux-of-costing` (standard di trasporto nel costo degli articoli), `elnath-of-margins` (trasporto addebitato rispetto al costo reale per cliente), `alnilam-of-settlements` (pagamenti ai vettori per broker), `capella-of-claims` (reclami per danni), `achernar-of-returns` (resi fino alla nota di credito), `shaula-of-emissions` (stime delle emissioni con i fattori che scegliete voi).

## Come restano sicuri

- **Elenco consentito per agente.** Ogni agente può chiamare solo i propri strumenti.
- **Strumenti rifiutati.** Pagare, inviare e-mail, modificare il TMS, registrare in contabilità generale o presentare in dogana sono nominati e bloccati.
- **Un clic nominativo.** Pagamenti, invii, modifiche in produzione e approvazioni di registrazioni attendono una persona indicata per nome, anche in modalità Auto, legati allo sha256 della bozza rivista.
- **Registro di audit** in `.keystone/`, concatenato tramite hash, firmato se configurate una chiave Ed25519.
- **Arresto di emergenza:** `<agent> kill` ferma tutti gli strumenti fino a `<agent> unkill`.

## Limiti

- Ogni agente lavora solo con i file che gli fornite e non accede a nessun sistema di vettori, TMS, ERP, banche o enti pubblici.
- Nessuna consulenza legale, fiscale, doganale o contabile. Le persone decidono e agiscono.
