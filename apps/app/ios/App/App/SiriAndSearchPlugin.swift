import Capacitor
import CoreSpotlight
import UniformTypeIdentifiers

/// Core Spotlight for the web app (#167): replaces or clears the app's entries in iOS search, and
/// hands on the destinations Spotlight results and App Shortcuts open (see `AppDestinations`).
///
/// The app's only local plugin; `MainViewController` registers it. What to index, and when, is
/// decided in TypeScript (`SiriAndSearchInteractor`) - this side only writes what it is given.
@objc(SiriAndSearchPlugin)
public class SiriAndSearchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiriAndSearchPlugin"
    public let jsName = "SiriAndSearch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "replaceDomain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteAll", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        // Kept until a listener consumes it: on a cold start the destination arrives before the web
        // app has registered one.
        AppDestinations.shared.attach { [weak self] destination in
            self?.notifyListeners("destinationOpened", data: ["destination": destination], retainUntilConsumed: true)
        }
    }

    /// Makes `items` the complete set of entries in `domain`. The old entries are removed first, as
    /// Core Spotlight cannot list what it holds, and the call only resolves once both steps did - a
    /// rejected call is simply repeated on the next sync.
    @objc func replaceDomain(_ call: CAPPluginCall) {
        guard let domain = call.getString("domain"), !domain.isEmpty else {
            call.reject("domain is required")
            return
        }
        let items = (call.getArray("items", JSObject.self) ?? []).compactMap { searchableItem($0, domain: domain) }

        let index = CSSearchableIndex.default()
        index.deleteSearchableItems(withDomainIdentifiers: [domain]) { error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            if items.isEmpty {
                call.resolve()
                return
            }
            index.indexSearchableItems(items) { error in
                if let error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func deleteAll(_ call: CAPPluginCall) {
        CSSearchableIndex.default().deleteAllSearchableItems { error in
            if let error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    private func searchableItem(_ item: JSObject, domain: String) -> CSSearchableItem? {
        guard let id = item["id"] as? String, let title = item["title"] as? String else {
            return nil
        }
        let attributes = CSSearchableItemAttributeSet(contentType: UTType.text)
        attributes.title = title
        attributes.contentDescription = item["description"] as? String
        attributes.keywords = (item["keywords"] as? [Any])?.compactMap { $0 as? String }
        return CSSearchableItem(uniqueIdentifier: id, domainIdentifier: domain, attributeSet: attributes)
    }
}
