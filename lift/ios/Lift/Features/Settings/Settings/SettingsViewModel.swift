import Observation

@Observable
final class SettingsViewModel {
    private(set) var state: SettingsState

    private let router: any Navigating

    /// Values and protocols only, no defaults, no work (SCR-3).
    init(info: AppInfo, router: any Navigating) {
        state = SettingsState(info: info)
        self.router = router
    }

    /// Nothing to observe yet: settings are not stored. Kept so the Screen follows the pattern (SCR-4).
    func run() async {}

    @discardableResult
    func send(_ action: SettingsAction) -> Task<Void, Never>? {
        switch action {
        case .unitSelected(let unit):
            state.unit = unit  // Held for this launch; saving settings comes later.
        case .acknowledgementsTapped:
            router.open(.acknowledgements)
        }
        return nil
    }
}
