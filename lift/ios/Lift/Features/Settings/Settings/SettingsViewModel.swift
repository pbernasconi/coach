import Foundation
import LiftSync
import Observation

@Observable
final class SettingsViewModel {
    private(set) var state: SettingsState

    private let router: any Navigating
    private let sync: any Syncing
    private let now: @Sendable () -> Date
    /// The latest sync status, kept to redraw the status row when the token changes.
    @ObservationIgnored private var latest = SyncStatus.initial

    /// Values and protocols only, no defaults, no work (SCR-3).
    init(info: AppInfo, sync: any Syncing, now: @escaping @Sendable () -> Date, router: any Navigating) {
        state = SettingsState(
            info: info,
            sync: Self.section(dataSource: info.dataSource, isConfigured: sync.isConfigured)
        )
        self.router = router
        self.sync = sync
        self.now = now
    }

    /// Follows the sync status while the screen is shown (SCR-4). Demo data and builds without a server skip it.
    func run() async {
        guard case .available = state.sync else { return }
        let hasToken = await sync.hasToken()
        refresh(hasToken: hasToken)
        for await status in sync.statusUpdates() {
            latest = status
            refresh()
        }
    }

    @discardableResult
    func send(_ action: SettingsAction) -> Task<Void, Never>? {
        switch action {
        case .unitSelected(let unit):
            state.unit = unit  // Held for this launch; saving settings comes later.
        case .acknowledgementsTapped:
            router.open(.acknowledgements)
        case .syncNowTapped:
            return syncNow()
        case .tokenRowTapped:
            guard case .available(let summary) = state.sync else { return nil }
            state.tokenEditor = TokenEditor(draft: "", canRemove: summary.hasToken)
        case .tokenDraftChanged(let draft):
            state.tokenEditor?.draft = draft
            if state.tokenEditor?.save == .failed { state.tokenEditor?.save = .idle }
        case .tokenSaveTapped:
            return saveToken()
        case .tokenRemoveTapped:
            return removeToken()
        case .tokenEditorDismissed:
            state.tokenEditor = nil
        }
        return nil
    }

    private func syncNow() -> Task<Void, Never>? {
        guard case .available(let summary) = state.sync, summary.canSyncNow else { return nil }
        return Task {
            latest = await sync.syncNow()
            refresh()
        }
    }

    /// Saves the trimmed draft, closes the sheet and syncs straight away. The token is never logged.
    private func saveToken() -> Task<Void, Never>? {
        guard let editor = state.tokenEditor, editor.canSave else { return nil }  // double tap guard
        let token = editor.trimmedDraft
        state.tokenEditor?.save = .saving  // set before the Task starts
        return Task {
            do {
                try await sync.setToken(token)
            } catch {
                state.tokenEditor?.save = .failed
                return
            }
            state.tokenEditor = nil
            refresh(hasToken: true)
            latest = await sync.syncNow()
            refresh()
        }
    }

    private func removeToken() -> Task<Void, Never>? {
        guard let editor = state.tokenEditor, editor.canRemove, editor.save != .saving else { return nil }
        state.tokenEditor?.save = .saving
        return Task {
            do {
                try await sync.setToken(nil)
            } catch {
                state.tokenEditor?.save = .failed
                return
            }
            state.tokenEditor = nil
            refresh(hasToken: false)
        }
    }

    /// Records whether a token is stored, then redraws the sync rows.
    private func refresh(hasToken: Bool) {
        guard case .available(var summary) = state.sync else { return }
        summary.hasToken = hasToken
        state.sync = .available(summary)
        refresh()
    }

    /// Redraws the sync rows from `latest`, the token flag and the time now.
    private func refresh() {
        guard case .available(var summary) = state.sync else { return }
        summary.isSyncing = latest.phase == .syncing
        summary.status = SyncStatusText.describe(latest, hasToken: summary.hasToken, now: now())
        state.sync = .available(summary)
    }

    private static func section(dataSource: AppInfo.DataSource, isConfigured: Bool) -> SyncSection {
        switch dataSource {
        case .demo:
            return .demo
        case .device:
            guard isConfigured else { return .unavailable }
            let status = SyncStatusText.describe(.initial, hasToken: false, now: .distantPast)
            return .available(SyncSummary(status: status, isSyncing: false, hasToken: false))
        }
    }
}
