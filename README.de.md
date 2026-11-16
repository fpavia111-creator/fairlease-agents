# Keystone-Frachtagenten

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

Dreißig kleine MCP-Agenten für Fracht- und Versandkosten. Jeder ist für **eine Aufgabe** zuständig, etwa eine Frachtrechnung prüfen, die Frachtabgrenzung zum Monatsende erstellen, Frachtführer-Zahlungen abrechnen oder eine Zollanmeldung prüfen, und kann nicht darüber hinaus handeln. Sie lesen die Dateien, die Sie bereits aus TMS, ERP, WMS, Frachtführer-Portalen und vom EDI-Dienstleister exportieren, schreiben Berichte auf Ihrem Rechner und warten auf eine namentlich genannte Person, bevor Geld bewegt, eine Nachricht gesendet oder ein laufendes System geändert wird.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · keine Abhängigkeiten

## Ausprobieren

```bash
npx -y polaris-of-bills demo        # Frachtrechnungsprüfung mit fiktiven Daten
npx -y procyon-of-accruals demo     # Frachtabgrenzung mit fiktiven Daten
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`npx -y <agent> mcp --root <ordner>`) für Claude Desktop, Claude Code, Cursor und andere MCP-Hosts. Spaltennamen und Berichte sind vorerst auf Englisch.

## Die Agenten

**Was Frachtführer berechnen:** `polaris-of-bills` (Komplett- und Teilladungsrechnungen gegen Verträge), `sirius-of-parcels` (Paketrechnungen), `vega-of-detention` (Standgeld und Wartezeit), `spica-of-fuel` (Dieselzuschläge), `betelgeuse-of-accessorials` (Ursachen von Nebenleistungen), `bellatrix-of-reweighs` (Nachwiegungen und Klassenänderungen), `algol-of-duplicates` (Doppelzahlungen), `adhara-of-ocean` (Seefracht), `canopus-of-air` (Luftfracht), `alcor-of-pods` (Zustellnachweise), `fomalhaut-of-demurrage` (Container-Freizeit und Demurrage), `antares-of-entries` (Zollanmeldungen gegen Handelsrechnungen, ohne Tarifierungsberatung).

**Fracht planen, einkaufen und steuern:** `altair-of-bids` (Ausschreibungen), `regulus-of-tariffs` (Historie unter jedem Vertrag neu bewertet), `nunki-of-quotes` (Spotangebote), `mizar-of-lanes` (Relationskosten und Bündelung), `rigel-of-scorecards` (Frachtführer-Scorecards), `aldebaran-of-carriers` (Warnzeichen für Betrug), `mira-of-tracking` (verspätete Sendungen), `hadar-of-docks` (Rampentermine), `deneb-of-cartons` (Kartongrößen), `arcturus-of-edi` (X12-Dateien lesen und abgleichen).

**Abschluss und Kosten:** `procyon-of-accruals` (Frachtabgrenzung), `castor-of-allocations` (Fracht auf Aufträge und Kostenstellen verteilen), `pollux-of-costing` (Frachtstandards in Artikelkosten), `elnath-of-margins` (berechnete gegen tatsächliche Fracht je Kunde), `alnilam-of-settlements` (Frachtführer-Zahlungen für Broker), `capella-of-claims` (Schadensmeldungen), `achernar-of-returns` (Retouren bis zur Gutschrift), `shaula-of-emissions` (Emissionsschätzungen mit Faktoren Ihrer Wahl).

## Wie sie sicher bleiben

- **Freigabeliste je Agent.** Jeder Agent darf nur seine eigenen Werkzeuge aufrufen.
- **Verweigerte Werkzeuge.** Bezahlen, E-Mails senden, TMS ändern, ins Hauptbuch buchen oder beim Zoll einreichen sind benannt und gesperrt.
- **Ein namentlicher Klick.** Zahlungen, Sendungen, Produktionsänderungen und Buchungsfreigaben warten auf eine namentlich genannte Person, auch im Auto-Modus, gebunden an den sha256 des geprüften Entwurfs.
- **Prüfprotokoll** unter `.keystone/`, verkettet über Hashes, signiert, wenn Sie einen Ed25519-Schlüssel einrichten.
- **Not-Aus:** `<agent> kill` stoppt alle Werkzeuge bis `<agent> unkill`.

## Grenzen

- Jeder Agent arbeitet nur mit den Dateien, die Sie ihm geben, und meldet sich bei keinem Frachtführer-, TMS-, ERP-, Bank- oder Behördensystem an.
- Keine Rechts-, Steuer-, Zoll- oder Buchhaltungsberatung. Menschen entscheiden und handeln.
