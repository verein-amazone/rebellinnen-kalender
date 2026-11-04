import AppIntents

// The App Shortcuts (#167): four ways into the app from Siri, Spotlight and the Shortcuts app. Each
// only opens a screen - „Neuen Termin erstellen“ leaves the appointment to the usual form - so none
// of them needs anything from the web app but the destination (see `AppDestinations`).

struct OpenTodayIntent: AppIntent {
    static var title: LocalizedStringResource = "Heute öffnen"
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("today")
        return .result()
    }
}

struct OpenCollectionIntent: AppIntent {
    static var title: LocalizedStringResource = "Meine Sammlung öffnen"
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("collection")
        return .result()
    }
}

struct OpenSupportServicesIntent: AppIntent {
    static var title: LocalizedStringResource = "Anlaufstellen öffnen"
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("services")
        return .result()
    }
}

struct CreateEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Neuen Termin erstellen"
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppDestinations.shared.open("new-event")
        return .result()
    }
}

struct RebellinnenShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenTodayIntent(),
            phrases: ["Heute in \(.applicationName) öffnen", "\(.applicationName) Heute öffnen"]
        )
        AppShortcut(
            intent: OpenCollectionIntent(),
            phrases: ["Meine Sammlung in \(.applicationName) öffnen", "\(.applicationName) Meine Sammlung"]
        )
        AppShortcut(
            intent: OpenSupportServicesIntent(),
            phrases: ["Anlaufstellen in \(.applicationName) öffnen", "\(.applicationName) Anlaufstellen"]
        )
        AppShortcut(
            intent: CreateEventIntent(),
            phrases: ["Neuen Termin in \(.applicationName) erstellen", "\(.applicationName) Neuer Termin"]
        )
    }
}
