# Keystone-Agenten für die Immobilienverwaltung

Dreißig kleine MCP-Agenten für die Immobilienverwaltung, gedacht für gewerbliche und mittelgroße Wohnungsverwalter. Jeder hat **genau eine Aufgabe**, etwa die Mieterliste gegen die Mietverträge prüfen, ein Treuhandkonto abstimmen, Nebenkosten (CAM) neu berechnen oder Versicherungsnachweise von Mietern anfordern, und kann nichts außerhalb davon tun. Sie lesen die Dateien, die Sie bereits aus AppFolio, Yardi, Buildium, Rent Manager und anderen Systemen exportieren, schreiben Berichte auf Ihrem Rechner und warten auf eine namentlich genannte Person, bevor Geld bewegt, eine Nachricht verschickt oder ein Live-System geändert wird.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · keine Abhängigkeiten

Weitere Sprachen: [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (von Claude übersetzt; Prüfung durch Muttersprachler steht aus)

## Ausprobieren

Aus einem Klon dieses Repositorys:

```bash
npm ci
node packages/granite-of-rentrolls/bin/granite-of-rentrolls.js demo     # Mieterliste gegen Vertragsauszüge, fiktive Daten
node packages/obsidian-of-trust/bin/obsidian-of-trust.js demo           # Dreifach-Abstimmung eines Treuhandkontos, fiktive Daten
```

Sobald die Pakete auf npm sind, funktioniert dasselbe mit `npx -y granite-of-rentrolls demo`. Jeder Agent hat ein `demo` mit fiktiven Dateien, ein `eval`, das ihn gegen seine eigenen Testfälle prüft, ein `inspect <Datei>`, das zeigt, wie die Spalten einer Datei gelesen wurden, und einen MCP-Server (`<agent> mcp --root <Ordner>`) für Claude Desktop, Claude Code, Cursor und andere MCP-Hosts. Mit `--lang de` erscheinen Berichte auf Deutsch (neun Sprachen verfügbar). Die README jedes Agenten listet seine Werkzeuge.

## Die Agenten

**Mieterliste, Mietverträge und Erträge**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`granite-of-rentrolls`](packages/granite-of-rentrolls) | Mieterliste gegen Ihre Vertragsauszüge, Einheit für Einheit: Mieten, Staffeln, Daten, Kautionen, Flächen, Mieter, Leerstand, Überziehungen | Das Verwaltungssystem ändern oder Belastungen buchen |
| [`slate-of-leases`](packages/slate-of-leases) | Gewerbemietverträge Klausel für Klausel mit Fundstelle ausgezogen; bestehende Auszüge gegen den Text geprüft | Das System ändern oder zur Unterschrift senden |
| [`jade-of-escalations`](packages/jade-of-escalations) | Berechnete Miete gegen die Staffel- und Indexregeln jedes Vertrags (Stufen, Prozente, Index mit Unter- und Obergrenze); anstehende Erhöhungen | Belastungen buchen |
| [`garnet-of-renewals`](packages/garnet-of-renewals) | Anstehende Verlängerungen, Angebotsfristen, Mietvorschläge innerhalb Ihrer eigenen Obergrenze, Angebotsschreiben als Entwurf | Zur Unterschrift senden oder E-Mails schicken |
| [`shale-of-vacancy`](packages/shale-of-vacancy) | Belegung, vermieteter Anteil, Risiko, Leerstandsverlust und Mindermiete aus einer Mieterliste | Das System ändern oder Inserate veröffentlichen |
| [`talc-of-overage`](packages/talc-of-overage) | Umsatzmiete aus Umsatzmeldungen der Mieter, verspätete und fehlende Meldungen, Abrechnung als Entwurf | Belastungen buchen oder eine Umsatzprüfung beginnen |
| [`feldspar-of-estoppels`](packages/feldspar-of-estoppels) | Zurückgesandte Mieterbestätigungen (Estoppels) gegen Ihre Vertragsauszüge vor Verkauf oder Refinanzierung | Zur Unterschrift senden oder in einen Datenraum hochladen |
| [`zircon-of-diligence`](packages/zircon-of-diligence) | Mieterliste eines Verkäufers gegen die Erträge der letzten zwölf Monate vor Kauf oder Finanzierung | Ein Angebot abgeben oder in einen Datenraum hochladen |
| [`tourmaline-of-migration`](packages/tourmaline-of-migration) | Mieterliste des alten Systems gegen die des neuen zum Stichtag: Einheiten, Mieter, Mieten, Kautionen, Salden, Daten, Summen, die nicht aufgehen | Den Go-live freigeben oder alte Daten löschen |

**Mieter, Vermietung und Forderungen**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`quartz-of-delinquency`](packages/quartz-of-delinquency) | Offene-Posten-Liste oder Mieterkonto als Arbeitsliste mit Stufen aus Ihrer eigenen Richtlinie, Prüfung der Mahngebühren, Erinnerungen als Entwurf | Kündigungen zustellen, Räumungsklagen einreichen oder an Auskunfteien melden |
| [`jasper-of-deposits`](packages/jasper-of-deposits) | Kautionsabrechnungen beim Auszug gegen Ihre eigenen Regeln (Frist, Aufstellung, Abnutzung, Nutzungsdauer); Abrechnung als Entwurf | Rückzahlungen leisten oder an ein Inkasso übergeben |
| [`amber-of-insurance`](packages/amber-of-insurance) | Versicherungsnachweise der Mieter gegen Deckungssummen, Mitversicherte und Daten aus dem Mietvertrag | Eine Ersatzversicherung abschließen oder Abmahnungen zustellen |
| [`topaz-of-utilities`](packages/topaz-of-utilities) | Umlage von Versorgungskosten (RUBS) nach Ihrer eigenen Methode neu gerechnet; Überdeckung, belastete Leerstände, Ausreißer | Belastungen buchen oder Versorgerportale ändern |
| [`cobalt-of-listings`](packages/cobalt-of-listings) | Inserate auf allen Portalen gegen die Mieterliste; Formulierungen zur Prüfung durch eine Person markiert | Inserate veröffentlichen, Angebotsmieten ändern oder Interessenten antworten |
| [`mica-of-leads`](packages/mica-of-leads) | Vermietungstrichter aus Interessentenkarten: langsame oder fehlende Antworten, fällige Nachfassungen, Abschlussquote und Kosten je Vertrag nach Quelle | Über Bewerbungen entscheiden, Bonitätsprüfungen starten oder Interessenten anschreiben |
| [`malachite-of-recerts`](packages/malachite-of-recerts) | Fristen und Hinweise für Neuzertifizierungen im geförderten Wohnungsbau nach dem Plan in Ihrer Richtliniendatei. Nur Daten | Haushalte zertifizieren, an eine Behörde übermitteln oder Mieten ändern |
| [`lapis-of-payouts`](packages/lapis-of-payouts) | Auszahlungen von Airbnb, Vrbo und anderen Kurzzeitvermietungs-Kanälen gegen Buchungen und Bankeingänge | Gästen erstatten, Eigentümer auszahlen oder Kanal-Inserate ändern |

**Eigentümer, Treuhandkonten und Buchhaltung**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`obsidian-of-trust`](packages/obsidian-of-trust) | Dreifach-Abstimmung: Kontoauszug, Kassenbuch, Eigentümer- und Mieterkonten | Geld bewegen, Schecks stornieren oder ins Hauptbuch buchen |
| [`onyx-of-statements`](packages/onyx-of-statements) | Eigentümerabrechnungen vor dem Versand geprüft: Rechnung, Vortrag, Rücklagen, Ausschüttungen | Eigentümer auszahlen oder Abrechnungen veröffentlichen |
| [`pyrite-of-fees`](packages/pyrite-of-fees) | Verwaltungs-, Vermietungs- und Aufschlagsgebühren aus jedem Verwaltervertrag neu berechnet | Gutschriften buchen oder Gebühreneinstellungen ändern |
| [`marble-of-cam`](packages/marble-of-cam) | Abrechnung von Nebenkosten (CAM): Kostenpools, Anteile, Hochrechnung, Deckel, Basisjahre, Verwaltungsaufschläge | Belastungen buchen oder das System ändern |
| [`beryl-of-budgets`](packages/beryl-of-budgets) | Budget gegen Ist, Abweichungen, die laut Vertrag zu erklären sind, Jahresprognose, Eigentümer-Memo als Entwurf | Das Budget ändern oder ins Hauptbuch buchen |
| [`pearl-of-filings`](packages/pearl-of-filings) | Vorbereitung der US-Formulare 1099: Summen je Empfänger gegen die von Ihnen genannte Schwelle, fehlende Steuernummern und Adressen; Steuernummern immer maskiert | 1099 einreichen, Steuernummern abgleichen lassen oder Quellensteuer einbehalten |
| [`coral-of-associations`](packages/coral-of-associations) | Eigentümerkonten von Gemeinschaften (HOA, Wohnungseigentum) gegen Ihre Umlage- und Mahnrichtlinie; Verstöße gegen Ihre Hinweisschritte | Pfandrechte eintragen oder Bußgelder buchen |
| [`chert-of-taxes`](packages/chert-of-taxes) | Grundsteuerbescheide, Raten und die von Ihnen eingetragenen Einspruchsfristen; Kalender der Fälligkeiten | Einsprüche einlegen oder Steuern zahlen |

**Betrieb und Dienstleister**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`agate-of-workorders`](packages/agate-of-workorders) | Offene Aufträge nach Ihren Zielzeiten gealtert, Wiederholungen, als Routine erfasste Notfälle, langsame Dienstleister | Dienstleister beauftragen, Rechnungen freigeben oder Aufträge schließen |
| [`basalt-of-turns`](packages/basalt-of-turns) | Wohnungswechsel vom Auszug bis zum Einzug: Tage, Kosten je Gewerk, weiterbelastbare Posten, entgangene Miete | Dienstleister beauftragen oder Belastungen buchen |
| [`flint-of-inspections`](packages/flint-of-inspections) | Auszugs- gegen Einzugsprotokoll Punkt für Punkt, überfällige Begehungen, schlechte Punkte ohne Auftrag | Belastungen buchen oder Dienstleister beauftragen |
| [`gypsum-of-capex`](packages/gypsum-of-capex) | Investitionsprojekte gegen Budget, Verpflichtungen, Zeitplan und Rücklagen | Nachträge oder Rechnungen freigeben |
| [`opal-of-vendors`](packages/opal-of-vendors) | Versicherung, Lizenz und Steuerformular der Dienstleister gegen Ihre Anforderungen; Zahlungen ohne gültige Nachweise | Rechnungen freigeben oder den Dienstleisterstatus ändern |

## Wie sie sicher bleiben

- **Erlaubnisliste je Agent.** Jeder Agent kann nur seine eigenen Werkzeuge aufrufen. Alles andere ist gesperrt, auch Werkzeuge, die sich ein Modell ausdenkt.
- **Verweigerte Werkzeuge.** Jeder Agent benennt die Live-Aktionen in der Nähe seiner Aufgabe (Erstattungen, Belastungen, Räumungsklagen, Meldungen, E-Mail-Versand) und sperrt sie, sodass ein Modell eine klare Absage bekommt.
- **Ein namentlicher Klick.** Das Versenden eines Entwurfs, das Übernehmen von etwas, das der Agent sich merken soll, oder die Freigabe eines Go-live wartet auf eine namentlich genannte Person, auch im Auto-Modus. Die Freigabe ist an den sha256 des geprüften Entwurfs gebunden; ändert sich der Entwurf, passt sie nicht mehr.
- **Prüfprotokoll.** Jeder Aufruf landet in einem hash-verketteten Protokoll unter `.keystone/`, mit Ed25519 signiert, wenn Sie einen Schlüssel einrichten.
- **Notaus.** `<agent> kill` stoppt alle Werkzeuge bis `<agent> unkill`.
- **Gegen feindliche Eingaben getestet.** Tabellenformeln, HTML, Pfadtricks und an das Modell gerichteter Text werden in die Daten jedes Agenten eingeschleust (`npm run hostile`).
- **Wenig personenbezogene Daten.** Steuernummern sind in jedem Bericht maskiert. Das Prüfprotokoll speichert einen Hash der Argumente, nicht die Argumente, und die Agenten behalten keine Kopie Ihrer Dateien.

## Mit Claude Code nutzen

Dieses Repository ist ein Plugin-Marktplatz für Claude Code. Jeder Agent ist ein Plugin, das seinen MCP-Server mit `npx` startet:

```text
/plugin marketplace add <Pfad oder Git-URL dieses Repositorys>
/plugin install granite-of-rentrolls@keystone-property
```

Die Plugins starten `npx -y <agent>@<version>` und brauchen daher diese Version auf npm. Bis dahin einen Agenten aus einem lokalen Klon hinzufügen:

```bash
claude mcp add granite-of-rentrolls -- node /pfad/zu/keystone-agents/packages/granite-of-rentrolls/bin/granite-of-rentrolls.js mcp --root .
```

## Entwickeln

```bash
npm ci
npm test                       # Tests und Evals aller Pakete
npm run hostile                # eingeschleuste feindliche Eingaben in jedem Agenten
npm run bench                  # Laufzeiten bei 1.000 und 10.000 Zeilen
npm run plugin:check           # Plugin-Dateien passen zu den Paketen
npm run intl                   # jedes Eval erneut mit Dateien aus acht weiteren Märkten
npm run mcp:check              # offizieller MCP-SDK-Client gegen jeden Agenten
npm run release:check:offline  # Paketinhalt, Lizenzen, Doku und Versionen
```

Der CI-Workflow läuft auf Node 20, 22 und 24, unter Linux und Windows.

## Grenzen

- Jeder Agent arbeitet mit den Dateien, die Sie ihm geben. Keiner meldet sich bei einem Verwaltungssystem, einer Bank, einem Portal, einem Kanal oder einer Behörde an.
- Die benannten Exportformate wurden aus Kenntnis dieser Exporte geschrieben und nicht gegen Live-Konten geprüft. Weicht eine Kopfzeile ab, zeigt `inspect`, was zugeordnet wurde, und `keystone-sources.json` erlaubt, Spalten von Hand zu benennen.
- Die Ergebnisse sind nur so gut wie diese Dateien. Jeder Bericht sagt, was er angenommen hat.
- Keine Rechts-, Steuer- oder Buchhaltungsberatung und keine Beurteilung, ob eine Anzeige zulässig ist. Schwellen, Fristen und Gebührenregeln kommen aus Ihren eigenen Richtliniendateien. Menschen entscheiden und handeln.
