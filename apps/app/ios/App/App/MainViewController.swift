import Capacitor

/// The bridge view controller, subclassed only to register the app's own plugin: Capacitor finds the
/// npm plugins through `capacitor.config.json`, but a plugin compiled into the app target has to be
/// handed over here. `Main.storyboard` names this class.
class MainViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SiriAndSearchPlugin())
    }
}
