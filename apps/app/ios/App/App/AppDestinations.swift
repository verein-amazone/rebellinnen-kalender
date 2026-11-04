import Foundation

/// The screens iOS can open the app on from outside: a Spotlight result or an App Shortcut.
///
/// A destination is one string the web app parses (`parseAppDestination` in
/// `src/app/interactors/siri-and-search/app-destination.ts`): `today`, `collection`, `services`,
/// `new-event`, `service:<id>` or `content:<id>`. Spotlight item identifiers use the same
/// `service:` / `content:` form, so a tapped result is its own destination.
///
/// A cold start can deliver one before `SiriAndSearchPlugin` is loaded, so they wait here until it
/// attaches. Used on the main thread only: by the scene delegate, the intents (`@MainActor`) and the
/// plugin's `load()`.
final class AppDestinations {

    static let shared = AppDestinations()

    private var pending: [String] = []
    private var deliver: ((String) -> Void)?

    func open(_ destination: String) {
        if let deliver {
            deliver(destination)
        } else {
            pending.append(destination)
        }
    }

    func attach(_ deliver: @escaping (String) -> Void) {
        self.deliver = deliver
        let queued = pending
        pending = []
        queued.forEach(deliver)
    }
}
