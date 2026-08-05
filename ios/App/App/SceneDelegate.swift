import UIKit
import Capacitor

/// Bridges the `UIScene` life cycle back onto Capacitor's application delegate proxy.
///
/// Capacitor ships a `SceneDelegateProxy` since 8.5, but the resolved `capacitor-swift-pm`
/// binary is pinned to 8.0 (see `@capacitor-community/sqlite`, which requires the `8.0.0`
/// branch and therefore wins over the app's own `exact: "8.5.0"` requirement). Forwarding to
/// `ApplicationDelegateProxy` produces the same `capacitorOpenURL` / `capacitorOpenUniversalLink`
/// notifications that the plugins observe.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // On a cold start the plugins are not registered yet, so notifications posted here would
        // be missed. Replay the launch URLs and activities once the bridge view has appeared.
        var token: NSObjectProtocol?
        token = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { [weak self] _ in
            if let token {
                NotificationCenter.default.removeObserver(token)
            }
            guard let self else { return }
            if !connectionOptions.urlContexts.isEmpty {
                self.scene(scene, openURLContexts: connectionOptions.urlContexts)
            }
            for userActivity in connectionOptions.userActivities {
                self.scene(scene, continue: userActivity)
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
            if let sourceApplication = context.options.sourceApplication {
                options[.sourceApplication] = sourceApplication
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            options[.openInPlace] = context.options.openInPlace

            _ = ApplicationDelegateProxy.shared.application(.shared, open: context.url, options: options)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(.shared, continue: userActivity) { _ in }
    }
}
