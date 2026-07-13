<p align="center">
  <img src="./logo.png" alt="Rebell*innen Kalender Logo" width="240">
</p>

# Rebell\*innen Kalender

Der Rebell\*innen Kalender wird gemeinsam mit [Verein Amazone](https://www.amazone.or.at/), Workshop-Teilnehmer\*innen
und
[Independo](https://independo.app/) als digitale Version des
bisherigen [Rebell\*innen Kalenders](https://www.amazone.or.at/projekte/rebell-innen-kalender) entwickelt.

Dieses Repository dient als zentraler Ort für Planung, Diskussion und Entwicklung der ersten Version.

## Worum geht es?

Die erste Version soll eine einfache, alltagstaugliche Kalender-App werden, die ohne Login und ohne eigene
Server-Infrastruktur funktioniert.

Im Fokus stehen zunächst:

- eine Heute-Ansicht / ein Startscreen
- eigene Termine und einfache Kalenderfunktionen
- kuratierte Inhalte aus dem Rebell*innen-/Amazone-Kontext
- eine einfache Checkliste
- Customization und Accessibility
- das Teilen einzelner Termine oder Inhalte über bestehende Kanäle

Einige Ideen aus den Workshops bleiben wichtig, sind aber wahrscheinlich spätere Ausbaupfade, zum Beispiel
Freund\*innen-Listen, echte gemeinsame Kalender, Chat, automatische Standortsuche oder automatische Newsfeeds.

## Wie wird geplant?

Die Planung passiert über GitHub Issues und Milestones.

Die ersten Issues sind als Diskussions- und Entscheidungsräume gedacht. Dort können Varianten, Wireframes, Fragen und
Feedback gesammelt werden.

[Aktuelle Milestones](https://github.com/verein-amazone/rebellinnen-kalender/milestones):

1. V1 Produktbild & Wireframes
2. MVP-Basis: lokale Kalender-App
3. Kuratierte Inhalte & Organisations-Termine
4. Teilen & gemeinsames Nutzen
5. Testversion, Release & Open-Source-Grundlage

## Wie kann ich Feedback geben?

Feedback ist direkt in den GitHub Issues willkommen.

Wenn du aus dem Workshop kommst und lieber über die WhatsApp-Gruppe Rückmeldung gibst, ist das auch möglich. Das
Projektteam überträgt relevantes Feedback dann in das passende GitHub Issue, damit Entscheidungen nachvollziehbar
bleiben.

Hilfreich ist Feedback zum Beispiel so:

- Was gefällt dir an einer Idee oder Variante?
- Was ist unklar?
- Was fehlt?
- Was wäre im Alltag besonders nützlich?
- Was sollte einfacher werden?

## Wichtige Issues zum Einstieg

- #4 V1-Scope und App-Struktur festlegen
- #5 Startscreen / Heute-Ansicht & Navigation gestalten
- #6 Kalender & eigene Termine gestalten
- #7 Checkliste & wichtige Dinge des Tages gestalten
- #8 Customization & Accessibility gestalten

Workshop-Ideen, die bereits im Repo sichtbar sind:

- #1 Positive / kuratierte Inhalte des Tages
- #2 Events und Termine von Organisationen anzeigen
- #3 Termine mit anderen teilen

## Mitmachen

Mehr Informationen dazu, wie du mitdiskutieren oder beitragen kannst, findest du
in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Entwicklung

Die App ist eine [Angular](https://angular.dev) 22 Anwendung, die mit
[Capacitor](https://capacitorjs.com) 8 als native iOS- und Android-App gebaut wird.

### Voraussetzungen

- **Node.js 24+** (gepinnt in `.nvmrc` / `.node-version` auf 24.18.0)
- **pnpm 11+** (exakt gepinnt über das `packageManager`-Feld in `package.json`)
- Für native Builds: **Xcode** (iOS) bzw. **Android Studio / JDK** (Android)

### Installation

```bash
pnpm install
```

### Angular-Entwicklungsserver

```bash
pnpm start        # http://localhost:4200
```

### Tests, Linting und Formatierung

```bash
pnpm test         # Unit-Tests (Vitest, Watch-Modus)
pnpm test:ci      # Unit-Tests einmalig (nicht-interaktiv)
pnpm lint         # Angular ESLint
pnpm format       # Prettier anwenden
pnpm format:check # Formatierung prüfen
pnpm e2e          # Playwright-Smoke-Test inkl. Axe-Accessibility-Scan
```

### Build und Capacitor-Synchronisierung

```bash
pnpm build        # Produktions-Build nach dist/rebellinnen-kalender/browser
pnpm cap:sync     # Build + Synchronisierung beider nativer Projekte
```

### Native Projekte öffnen

```bash
pnpm cap:ios      # Öffnet das iOS-Projekt in Xcode
pnpm cap:android  # Öffnet das Android-Projekt in Android Studio
```

### Plattform-Eckdaten

| Eigenschaft           | Wert                                |
| --------------------- | ----------------------------------- |
| App-ID (Bundle-ID)    | `at.or.amazone.rebellinnenkalender` |
| Anzeigename           | `Rebell*innen Kalender`             |
| Minimale iOS-Version  | 16.4                                |
| Minimales Android-API | 24 (Android 7.0)                    |

### Angular CLI MCP

Für versionsgenaue Angular-Unterstützung kann der offizielle
[Angular CLI MCP Server](https://angular.dev/ai/mcp) verwendet werden. Er läuft
projektlokal über die installierte Angular CLI:

```bash
pnpm exec ng mcp
```

Die Einrichtung erfolgt host-/editorseitig und wird bewusst **nicht** im Repository
eingecheckt.

### Hinweise

- Das visuelle Design (Farben, Typografie, Komponenten) wird später aus dem
  freigegebenen Figma-Mockup abgeleitet. Aktuell existiert bewusst kein Design-System.
- Es gibt derzeit **kein** Browser-/PWA-Release-Ziel; die App wird ausschließlich als
  native iOS- und Android-App ausgeliefert.
