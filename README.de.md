# Fairlease-Agenten für die Immobilienverwaltung

Dreißig kleine MCP-Agenten für die Immobilienverwaltung, gedacht für gewerbliche und mittelgroße Wohnungsverwalter. Jeder hat **genau eine Aufgabe**, etwa die Mieterliste gegen die Mietverträge prüfen, ein Treuhandkonto abstimmen, Nebenkosten (CAM) neu berechnen oder Versicherungsnachweise von Mietern anfordern, und kann nichts außerhalb davon tun. Sie lesen die Dateien, die Sie bereits aus AppFolio, Yardi, Buildium, Rent Manager und anderen Systemen exportieren, schreiben Berichte auf Ihrem Rechner, bewegen nie Geld und ändern nie ein Live-System, und warten auf eine namentlich genannte Person, bevor ein Schreiben oder eine Mitteilung hinausgeht.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · keine Abhängigkeiten

Weitere Sprachen: [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (von Claude übersetzt; Prüfung durch Muttersprachler steht aus)

## Ausprobieren

Aus einem Klon dieses Repositorys:

```bash
npm ci
node packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js demo     # Mieterliste gegen Vertragsauszüge, fiktive Daten
node packages/fairlease-trust-reconciliation/bin/fairlease-trust-reconciliation.js demo           # Dreifach-Abstimmung eines Treuhandkontos, fiktive Daten
```

Sobald die Pakete auf npm sind, funktioniert dasselbe mit `npx -y fairlease-rent-roll-audit demo`. Jeder Agent hat ein `demo` mit fiktiven Dateien, ein `eval`, das ihn gegen seine eigenen Testfälle prüft, ein `inspect <Datei>`, das zeigt, wie die Spalten einer Datei gelesen wurden, und einen MCP-Server (`<agent> mcp --root <Ordner>`) für Claude Desktop, Claude Code, Cursor und andere MCP-Hosts. Mit `--lang de` erscheinen Titel, Überschriften und Spaltennamen der Berichte sowie die Freigabeseite auf Deutsch (neun Sprachen verfügbar); die Sätze der Befunde und die Werkzeugergebnisse bleiben auf Englisch. Die README jedes Agenten listet seine Werkzeuge.

## Die Agenten

**Mieterliste, Mietverträge und Erträge**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`fairlease-rent-roll-audit`](packages/fairlease-rent-roll-audit) | Mieterliste gegen Ihre Vertragsauszüge, Einheit für Einheit: Mieten, Staffeln, Daten, Kautionen, Flächen, Mieter, Leerstand, Überziehungen | Das Verwaltungssystem ändern oder Belastungen buchen |
| [`fairlease-lease-abstracts`](packages/fairlease-lease-abstracts) | Gewerbemietverträge Klausel für Klausel mit Fundstelle ausgezogen; bestehende Auszüge gegen den Text geprüft | Das System ändern oder zur Unterschrift senden |
| [`fairlease-rent-escalations`](packages/fairlease-rent-escalations) | Berechnete Miete gegen die Staffel- und Indexregeln jedes Vertrags (Stufen, Prozente, Index mit Unter- und Obergrenze); anstehende Erhöhungen | Belastungen buchen |
| [`fairlease-lease-renewals`](packages/fairlease-lease-renewals) | Anstehende Verlängerungen, Angebotsfristen, Mietvorschläge innerhalb Ihrer eigenen Obergrenze, Angebotsschreiben als Entwurf | Zur Unterschrift senden oder E-Mails schicken |
| [`fairlease-occupancy-and-vacancy`](packages/fairlease-occupancy-and-vacancy) | Belegung, vermieteter Anteil, Risiko, Leerstandsverlust und Mindermiete aus einer Mieterliste | Das System ändern oder Inserate veröffentlichen |
| [`fairlease-percentage-rent`](packages/fairlease-percentage-rent) | Umsatzmiete aus Umsatzmeldungen der Mieter, verspätete und fehlende Meldungen, Abrechnung als Entwurf | Belastungen buchen oder eine Umsatzprüfung beginnen |
| [`fairlease-estoppel-review`](packages/fairlease-estoppel-review) | Zurückgesandte Mieterbestätigungen (Estoppels) gegen Ihre Vertragsauszüge vor Verkauf oder Refinanzierung | Zur Unterschrift senden oder in einen Datenraum hochladen |
| [`fairlease-acquisition-diligence`](packages/fairlease-acquisition-diligence) | Mieterliste eines Verkäufers gegen die Erträge der letzten zwölf Monate vor Kauf oder Finanzierung | Ein Angebot abgeben oder in einen Datenraum hochladen |
| [`fairlease-pms-migration`](packages/fairlease-pms-migration) | Mieterliste des alten Systems gegen die des neuen zum Stichtag: Einheiten, Mieter, Mieten, Kautionen, Salden, Daten, Summen, die nicht aufgehen | Den Go-live freigeben oder alte Daten löschen |

**Mieter, Vermietung und Forderungen**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`fairlease-delinquency-worklist`](packages/fairlease-delinquency-worklist) | Offene-Posten-Liste oder Mieterkonto als Arbeitsliste mit Stufen aus Ihrer eigenen Richtlinie, Prüfung der Mahngebühren, Erinnerungen als Entwurf | Kündigungen zustellen, Räumungsklagen einreichen oder an Auskunfteien melden |
| [`fairlease-security-deposits`](packages/fairlease-security-deposits) | Kautionsabrechnungen beim Auszug gegen Ihre eigenen Regeln (Frist, Aufstellung, Abnutzung, Nutzungsdauer); Abrechnung als Entwurf | Rückzahlungen leisten oder an ein Inkasso übergeben |
| [`fairlease-tenant-insurance`](packages/fairlease-tenant-insurance) | Versicherungsnachweise der Mieter gegen Deckungssummen, Mitversicherte und Daten aus dem Mietvertrag | Eine Ersatzversicherung abschließen oder Abmahnungen zustellen |
| [`fairlease-utility-billback`](packages/fairlease-utility-billback) | Umlage von Versorgungskosten (RUBS) nach Ihrer eigenen Methode neu gerechnet; Überdeckung, belastete Leerstände, Ausreißer | Belastungen buchen oder Versorgerportale ändern |
| [`fairlease-listing-checks`](packages/fairlease-listing-checks) | Inserate auf allen Portalen gegen die Mieterliste; Formulierungen zur Prüfung durch eine Person markiert | Inserate veröffentlichen, Angebotsmieten ändern oder Interessenten antworten |
| [`fairlease-leasing-funnel`](packages/fairlease-leasing-funnel) | Vermietungstrichter aus Interessentenkarten: langsame oder fehlende Antworten, fällige Nachfassungen, Abschlussquote und Kosten je Vertrag nach Quelle | Über Bewerbungen entscheiden, Bonitätsprüfungen starten oder Interessenten anschreiben |
| [`fairlease-affordable-recerts`](packages/fairlease-affordable-recerts) | Fristen und Hinweise für Neuzertifizierungen im geförderten Wohnungsbau nach dem Plan in Ihrer Richtliniendatei. Nur Daten | Haushalte zertifizieren, an eine Behörde übermitteln oder Mieten ändern |
| [`fairlease-short-term-rental-payouts`](packages/fairlease-short-term-rental-payouts) | Auszahlungen von Airbnb, Vrbo und anderen Kurzzeitvermietungs-Kanälen gegen Buchungen und Bankeingänge | Gästen erstatten, Eigentümer auszahlen oder Kanal-Inserate ändern |

**Eigentümer, Treuhandkonten und Buchhaltung**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`fairlease-trust-reconciliation`](packages/fairlease-trust-reconciliation) | Dreifach-Abstimmung: Kontoauszug, Kassenbuch, Eigentümer- und Mieterkonten | Geld bewegen, Schecks stornieren oder ins Hauptbuch buchen |
| [`fairlease-owner-statements`](packages/fairlease-owner-statements) | Eigentümerabrechnungen vor dem Versand geprüft: Rechnung, Vortrag, Rücklagen, Ausschüttungen | Eigentümer auszahlen oder Abrechnungen veröffentlichen |
| [`fairlease-management-fees`](packages/fairlease-management-fees) | Verwaltungs-, Vermietungs- und Aufschlagsgebühren aus jedem Verwaltervertrag neu berechnet | Gutschriften buchen oder Gebühreneinstellungen ändern |
| [`fairlease-cam-reconciliation`](packages/fairlease-cam-reconciliation) | Abrechnung von Nebenkosten (CAM): Kostenpools, Anteile, Hochrechnung, Deckel, Basisjahre, Verwaltungsaufschläge | Belastungen buchen oder das System ändern |
| [`fairlease-budget-variance`](packages/fairlease-budget-variance) | Budget gegen Ist, Abweichungen, die laut Vertrag zu erklären sind, Jahresprognose, Eigentümer-Memo als Entwurf | Das Budget ändern oder ins Hauptbuch buchen |
| [`fairlease-1099-filings`](packages/fairlease-1099-filings) | Vorbereitung der US-Formulare 1099: Summen je Empfänger gegen die von Ihnen genannte Schwelle, fehlende Steuernummern und Adressen; Steuernummern immer maskiert | 1099 einreichen, Steuernummern abgleichen lassen oder Quellensteuer einbehalten |
| [`fairlease-hoa-accounts`](packages/fairlease-hoa-accounts) | Eigentümerkonten von Gemeinschaften (HOA, Wohnungseigentum) gegen Ihre Umlage- und Mahnrichtlinie; Verstöße gegen Ihre Hinweisschritte | Pfandrechte eintragen oder Bußgelder buchen |
| [`fairlease-property-taxes`](packages/fairlease-property-taxes) | Grundsteuerbescheide, Raten und die von Ihnen eingetragenen Einspruchsfristen; Kalender der Fälligkeiten | Einsprüche einlegen oder Steuern zahlen |

**Betrieb und Dienstleister**

| Agent | Was er tut | Tut nie (gesperrt) |
|---|---|---|
| [`fairlease-work-orders`](packages/fairlease-work-orders) | Offene Aufträge nach Ihren Zielzeiten gealtert, Wiederholungen, als Routine erfasste Notfälle, langsame Dienstleister | Dienstleister beauftragen, Rechnungen freigeben oder Aufträge schließen |
| [`fairlease-unit-turns`](packages/fairlease-unit-turns) | Wohnungswechsel vom Auszug bis zum Einzug: Tage, Kosten je Gewerk, weiterbelastbare Posten, entgangene Miete | Dienstleister beauftragen oder Belastungen buchen |
| [`fairlease-unit-inspections`](packages/fairlease-unit-inspections) | Auszugs- gegen Einzugsprotokoll Punkt für Punkt, überfällige Begehungen, schlechte Punkte ohne Auftrag | Belastungen buchen oder Dienstleister beauftragen |
| [`fairlease-capital-projects`](packages/fairlease-capital-projects) | Investitionsprojekte gegen Budget, Verpflichtungen, Zeitplan und Rücklagen | Nachträge oder Rechnungen freigeben |
| [`fairlease-vendor-compliance`](packages/fairlease-vendor-compliance) | Versicherung, Lizenz und Steuerformular der Dienstleister gegen Ihre Anforderungen; Zahlungen ohne gültige Nachweise | Rechnungen freigeben oder den Dienstleisterstatus ändern |

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
/plugin install fairlease-rent-roll-audit@keystone-property
```

Die Plugins starten `npx -y <agent>@<version>` und brauchen daher diese Version auf npm. Bis dahin einen Agenten aus einem lokalen Klon hinzufügen:

```bash
claude mcp add fairlease-rent-roll-audit -- node /pfad/zu/fairlease-agents/packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js mcp --root .
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
