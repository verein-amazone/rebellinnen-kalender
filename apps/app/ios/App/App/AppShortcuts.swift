import AppIntents

// The App Shortcuts (#167): four ways into the app from Siri, Spotlight and the Shortcuts app. Each
// only opens a screen - „Neuen Termin erstellen“ leaves the appointment to the usual form - so none
// of them needs anything from the web app but the destination (see `AppDestinations`).

struct OpenTodayIntent: AppIntent {
    static var title: LocalizedStringResource = "Heute öffnen"
    static var description = IntentDescription("Öffnet die Übersicht für heute.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("today")
        return .result()
    }
}

struct OpenCollectionIntent: AppIntent {
    static var title: LocalizedStringResource = "Meine Sammlung öffnen"
    static var description = IntentDescription("Öffnet die Inhalte, die du mit dem Lesezeichen markiert hast.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("collection")
        return .result()
    }
}

struct OpenSupportServicesIntent: AppIntent {
    static var title: LocalizedStringResource = "Anlaufstellen öffnen"
    static var description = IntentDescription(
        "Öffnet Beratungsstellen, Mädchentreffs und andere Angebote für Mädchen* und junge Frauen*."
    )
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("services")
        return .result()
    }
}

struct CreateEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Neuen Termin erstellen"
    static var description = IntentDescription("Öffnet ein leeres Formular für einen neuen Termin.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("new-event")
        return .result()
    }
}

/// The intent of the screen `destination` names, for `SiriAndSearchPlugin.donate`. Only the four
/// screens above have one.
func appShortcutIntent(for destination: String) -> (any AppIntent)? {
    switch destination {
    case "today": return OpenTodayIntent()
    case "collection": return OpenCollectionIntent()
    case "services": return OpenSupportServicesIntent()
    case "new-event": return CreateEventIntent()
    default: return nil
    }
}

/// Every intent type above, so a data reset can delete their donations.
let appShortcutIntentTypes: [any AppIntent.Type] = [
    OpenTodayIntent.self,
    OpenCollectionIntent.self,
    OpenSupportServicesIntent.self,
    CreateEventIntent.self
]

// `shortTitle` and `systemImageName` are the buttons Spotlight shows next to the app (iOS 17 and
// later). The initializer taking them exists since iOS 16, where they are simply unused.
struct RebellinnenShortcuts: AppShortcutsProvider {
    /// The tiles in the Shortcuts app; red is the closest to the app's primary colour.
    static var shortcutTileColor: ShortcutTileColor = .red

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenTodayIntent(),
            phrases: ["Heute in \(.applicationName) öffnen", "\(.applicationName) Heute öffnen"],
            shortTitle: "Heute",
            systemImageName: "sun.max"
        )
        AppShortcut(
            intent: OpenCollectionIntent(),
            phrases: ["Meine Sammlung in \(.applicationName) öffnen", "\(.applicationName) Meine Sammlung"],
            shortTitle: "Meine Sammlung",
            systemImageName: "bookmark"
        )
        AppShortcut(
            intent: OpenSupportServicesIntent(),
            phrases: ["Anlaufstellen in \(.applicationName) öffnen", "\(.applicationName) Anlaufstellen"],
            shortTitle: "Anlaufstellen",
            systemImageName: "phone"
        )
        AppShortcut(
            intent: CreateEventIntent(),
            phrases: ["Neuen Termin in \(.applicationName) erstellen", "\(.applicationName) Neuer Termin"],
            shortTitle: "Neuer Termin",
            systemImageName: "calendar.badge.plus"
        )
    }
}
