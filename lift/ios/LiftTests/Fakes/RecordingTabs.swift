@testable import Lift

/// A `TabSwitching` that records each tab it was asked to show.
@MainActor
final class RecordingTabs: TabSwitching {
    private(set) var shown: [AppTab] = []

    func show(_ tab: AppTab) {
        shown.append(tab)
    }
}
