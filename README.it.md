# Agenti Keystone per la gestione immobiliare

Trenta piccoli agenti MCP per la gestione immobiliare, pensati per gestori di immobili commerciali e di portafogli residenziali di medie dimensioni. Ognuno ha **un solo compito**, ad esempio controllare il rent roll rispetto ai contratti, riconciliare un conto di terzi, ricalcolare le spese comuni (CAM) o sollecitare i certificati assicurativi degli inquilini, e non può agire al di fuori di esso. Leggono i file che già esportate da AppFolio, Yardi, Buildium, Rent Manager e altri sistemi, scrivono i report sul vostro computer, non spostano mai denaro né modificano un sistema in produzione, e aspettano una persona con nome prima che parta qualsiasi lettera o avviso.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · nessuna dipendenza

Altre lingue: [English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (tradotto da Claude; revisione madrelingua in sospeso)

## Provarne uno

Da una copia di questo repository:

```bash
npm ci
node packages/granite-of-rentrolls/bin/granite-of-rentrolls.js demo     # rent roll contro le schede contratto, dati fittizi
node packages/obsidian-of-trust/bin/obsidian-of-trust.js demo           # riconciliazione a tre vie di un conto di terzi, dati fittizi
```

Quando i pacchetti saranno su npm, lo stesso funziona con `npx -y granite-of-rentrolls demo`. Ogni agente ha un `demo` su file fittizi, un `eval` che lo verifica sui propri casi di test, un `inspect <file>` che mostra come sono state lette le colonne e un server MCP (`<agente> mcp --root <cartella>`) per Claude Desktop, Claude Code, Cursor e altri host MCP. Con `--lang it` titoli, intestazioni e nomi di colonna dei report e la pagina delle approvazioni escono in italiano (nove lingue disponibili); le frasi dei risultati e gli output degli strumenti restano in inglese. Il README di ogni agente elenca i suoi strumenti.

## Gli agenti

**Rent roll, contratti e ricavi**

| Agente | Cosa fa | Non fa mai (bloccato) |
|---|---|---|
| [`granite-of-rentrolls`](packages/granite-of-rentrolls) | Rent roll contro le vostre schede contratto, unità per unità: canoni, scaglioni, date, depositi, superfici, inquilini, sfitti, occupazioni oltre scadenza | Modificare il gestionale o addebitare importi |
| [`slate-of-leases`](packages/slate-of-leases) | Contratti commerciali riassunti clausola per clausola con il riferimento di ogni termine; schede esistenti controllate sul testo | Modificare il sistema o inviare in firma |
| [`jade-of-escalations`](packages/jade-of-escalations) | Canone fatturato contro il piano di aggiornamento di ogni contratto (scaglioni, percentuali, indice con minimo e massimo); aumenti in arrivo | Addebitare importi |
| [`garnet-of-renewals`](packages/garnet-of-renewals) | Contratti in rinnovo, scadenze delle offerte, canoni proposti entro il vostro tetto, lettere di offerta in bozza | Inviare in firma o per e-mail |
| [`shale-of-vacancy`](packages/shale-of-vacancy) | Occupazione, quota locata, esposizione, perdita da sfitto e scarto dal canone di mercato da un rent roll | Modificare il sistema o pubblicare annunci |
| [`talc-of-overage`](packages/talc-of-overage) | Canone variabile sul fatturato dai report di vendita degli inquilini, report in ritardo o mancanti, rendiconto in bozza | Addebitare importi o avviare un audit delle vendite |
| [`feldspar-of-estoppels`](packages/feldspar-of-estoppels) | Dichiarazioni degli inquilini (estoppel) restituite, contro le vostre schede prima di una vendita o di un rifinanziamento | Inviare in firma o caricare in una data room |
| [`zircon-of-diligence`](packages/zircon-of-diligence) | Rent roll di un venditore contro gli ultimi dodici mesi di ricavi prima di comprare o finanziare | Presentare un'offerta o caricare in una data room |
| [`tourmaline-of-migration`](packages/tourmaline-of-migration) | Rent roll del vecchio sistema contro quello nuovo al passaggio: unità, inquilini, canoni, depositi, saldi, date, totali che non quadrano | Approvare l'avvio in produzione o cancellare i vecchi dati |

**Inquilini, locazione e incassi**

| Agente | Cosa fa | Non fa mai (bloccato) |
|---|---|---|
| [`quartz-of-delinquency`](packages/quartz-of-delinquency) | Scadenziario o estratto conto dell'inquilino trasformati in lista di lavoro con le fasi della vostra politica, controllo delle penali, solleciti in bozza | Notificare atti, avviare sfratti o segnalare a centrali rischi |
| [`jasper-of-deposits`](packages/jasper-of-deposits) | Depositi cauzionali all'uscita contro le vostre regole (termine, dettaglio, normale usura, vita utile); rendiconto in bozza | Rimborsare o passare al recupero crediti |
| [`amber-of-insurance`](packages/amber-of-insurance) | Certificati assicurativi degli inquilini contro massimali, assicurati aggiuntivi e date richiesti dal contratto | Stipulare una polizza per conto dell'inquilino o notificare inadempimenti |
| [`topaz-of-utilities`](packages/topaz-of-utilities) | Ripartizione delle utenze (RUBS) rifatta con il vostro metodo; sovra-recupero, unità sfitte addebitate, picchi | Addebitare importi o modificare i portali dei fornitori |
| [`cobalt-of-listings`](packages/cobalt-of-listings) | Annunci su tutti i portali contro il rent roll; formulazioni segnalate perché una persona le riveda | Pubblicare annunci, cambiare il canone richiesto o rispondere ai contatti |
| [`mica-of-leads`](packages/mica-of-leads) | Funnel di locazione dalle schede contatto: risposte lente o mancanti, richiami dovuti, conversione e costo per contratto per fonte | Decidere sulle domande, avviare verifiche o scrivere ai contatti |
| [`malachite-of-recerts`](packages/malachite-of-recerts) | Date e avvisi di ricertificazione nell'edilizia agevolata secondo il calendario del vostro file di politica. Solo date | Certificare nuclei, inviare a un ente o cambiare canoni |
| [`lapis-of-payouts`](packages/lapis-of-payouts) | Accrediti degli affitti brevi da Airbnb, Vrbo e altri contro prenotazioni ed entrate bancarie | Rimborsare ospiti, pagare proprietari o modificare gli annunci sul canale |

**Proprietari, conti di terzi e contabilità**

| Agente | Cosa fa | Non fa mai (bloccato) |
|---|---|---|
| [`obsidian-of-trust`](packages/obsidian-of-trust) | Riconciliazione a tre vie: estratto conto, registro di cassa, partitari di proprietari e inquilini | Spostare fondi, annullare assegni o registrare in contabilità generale |
| [`onyx-of-statements`](packages/onyx-of-statements) | Rendiconti ai proprietari controllati prima dell'invio: calcoli, riporto, riserve, distribuzioni | Pagare proprietari o pubblicare rendiconti |
| [`pyrite-of-fees`](packages/pyrite-of-fees) | Compensi di gestione, locazione e maggiorazioni ricalcolati da ogni mandato di gestione | Registrare note di credito o cambiare l'impostazione dei compensi |
| [`marble-of-cam`](packages/marble-of-cam) | Conguaglio delle spese comuni (CAM): gruppi di spesa, quote, adeguamento all'occupazione, tetti, anni base, compensi di gestione | Addebitare importi o modificare il sistema |
| [`beryl-of-budgets`](packages/beryl-of-budgets) | Budget contro consuntivo, scostamenti che il mandato chiede di spiegare, previsione di fine anno, nota al proprietario in bozza | Cambiare il budget o registrare in contabilità generale |
| [`pearl-of-filings`](packages/pearl-of-filings) | Preparazione dei moduli statunitensi 1099: totali per beneficiario contro la soglia che indicate, codici fiscali e indirizzi mancanti; codici sempre mascherati | Trasmettere i 1099, verificare i codici o avviare ritenute |
| [`coral-of-associations`](packages/coral-of-associations) | Conti dei condomini (HOA, condominio) contro la vostra politica di rate e recupero; violazioni contro i vostri passi di avviso | Iscrivere ipoteche o addebitare sanzioni |
| [`chert-of-taxes`](packages/chert-of-taxes) | Accertamenti dell'imposta sugli immobili, rate e i termini di ricorso che inserite; calendario delle scadenze | Presentare ricorsi o pagare imposte |

**Operatività e fornitori**

| Agente | Cosa fa | Non fa mai (bloccato) |
|---|---|---|
| [`agate-of-workorders`](packages/agate-of-workorders) | Ordini di lavoro aperti invecchiati rispetto ai vostri obiettivi, problemi ripetuti, urgenze registrate come ordinarie, fornitori lenti | Incaricare fornitori, approvare fatture o chiudere ordini |
| [`basalt-of-turns`](packages/basalt-of-turns) | Ripristino delle unità tra uscita e ingresso: giorni, costo per categoria, voci riaddebitabili, canone perso | Incaricare fornitori o addebitare importi |
| [`flint-of-inspections`](packages/flint-of-inspections) | Verbale di uscita contro quello d'ingresso, voce per voce, ispezioni scadute, voci in cattivo stato senza ordine di lavoro | Addebitare importi o incaricare fornitori |
| [`gypsum-of-capex`](packages/gypsum-of-capex) | Progetti di investimento contro budget, impegni, cronoprogramma e riserve | Approvare varianti o fatture |
| [`opal-of-vendors`](packages/opal-of-vendors) | Assicurazione, abilitazione e modulo fiscale dei fornitori contro i vostri requisiti; pagamenti fatti fuori conformità | Approvare fatture o cambiare lo stato del fornitore |

## Come restano sicuri

- **Lista consentita per agente.** Ogni agente può chiamare solo i propri strumenti. Tutto il resto è bloccato, compresi gli strumenti inventati da un modello.
- **Strumenti rifiutati.** Ogni agente nomina le azioni reali vicine al suo compito (rimborsi, addebiti, sfratti, trasmissioni, invio di e-mail) e le blocca; un modello che le chiede riceve un rifiuto chiaro.
- **Un clic con nome.** Inviare una bozza, accettare qualcosa che l'agente deve ricordare o approvare un avvio in produzione aspetta una persona con nome, anche in modalità Auto. L'approvazione è legata allo sha256 della bozza rivista; se la bozza cambia, l'approvazione non corrisponde più.
- **Registro di audit.** Ogni chiamata finisce in un registro concatenato con hash sotto `.keystone/`, firmato con Ed25519 se configurate una chiave.
- **Interruttore di arresto.** `<agente> kill` ferma tutti gli strumenti fino a `<agente> unkill`.
- **Testati contro input ostili.** Formule di foglio di calcolo, HTML, trucchi sui percorsi e testo rivolto al modello vengono inseriti nei dati di ogni agente (`npm run hostile`).
- **Pochi dati personali.** I codici fiscali sono mascherati in ogni report. Il registro di audit conserva un hash degli argomenti, non gli argomenti, e gli agenti non conservano copia dei vostri file.

## Con Claude Code

Questo repository è un marketplace di plugin per Claude Code. Ogni agente è un plugin che avvia il proprio server MCP con `npx`:

```text
/plugin marketplace add <percorso o URL git di questo repository>
/plugin install granite-of-rentrolls@keystone-property
```

I plugin avviano `npx -y <agente>@<versione>`, quindi serve quella versione su npm. Nel frattempo, aggiungete un agente da una copia locale:

```bash
claude mcp add granite-of-rentrolls -- node /percorso/di/keystone-agents/packages/granite-of-rentrolls/bin/granite-of-rentrolls.js mcp --root .
```

## Sviluppo

```bash
npm ci
npm test                       # test ed eval di ogni pacchetto
npm run hostile                # input ostili inseriti in ogni agente
npm run bench                  # tempi su 1.000 e 10.000 righe
npm run plugin:check           # file dei plugin coerenti con i pacchetti
npm run intl                   # ogni eval di nuovo su file di altri otto mercati
npm run mcp:check              # client ufficiale dell'SDK MCP contro ogni agente
npm run release:check:offline  # contenuto dei pacchetti, licenze, documentazione e versioni
```

Il workflow di CI gira su Node 20, 22 e 24, su Linux e Windows.

## Limiti

- Ogni agente lavora sui file che gli date. Nessuno accede a un gestionale, una banca, un portale di annunci, un canale o un ente pubblico.
- I formati di esportazione con nome sono stati scritti in base alla conoscenza di quelle esportazioni e non sono stati verificati su account reali. Se un'intestazione è diversa, `inspect` mostra cosa è stato associato e `keystone-sources.json` permette di nominare le colonne a mano.
- I risultati valgono quanto quei file. Ogni report dice cosa ha presupposto.
- Non è consulenza legale, fiscale o contabile, né un giudizio sulla liceità di un annuncio. Soglie, scadenze e regole dei compensi vengono dai vostri file di politica. Le persone decidono e agiscono.
