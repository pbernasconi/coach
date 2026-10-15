import Observation

@Observable
final class SettingsViewModel {
    private(set) var state: SettingsState

    /// Values only, no defaults, no work (SCR-3).
    init(info: AppInfo) {
        state = SettingsState(info: info)
    }

    /// Nothing to observe yet: settings are not stored. Kept so the Screen follows the pattern (SCR-4).
    func run() async {}

    @discardableResult
    func send(_ action: SettingsAction) -> Task<Void, Never>? {
        switch action {
        case .unitSelected(let unit):
            state.unit = unit  // Held for this launch; saving settings comes later.
        }
        return nil
    }
}
