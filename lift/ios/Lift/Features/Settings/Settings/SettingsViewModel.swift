import Foundation
import LiftSync
import Observation

@Observable
final class SettingsViewModel {
    private(set) var state: SettingsState

    private let router: any Navigating
    private let sync: any Syncing
    private let now: @Sendable () -> Date
    /// Saving finished workouts to Apple Health.
    private let health: any WorkoutHealthRecording
    /// The preferred weight unit, kept on this iPhone.
    private let units: any UnitPreference
    /// Opens practice data or the log; the app starts over on it.
    private let practice: any PracticeModeSwitching
    /// The connections and the coach's side, from the server.
    private let remote: AppResource<AppSettings>
    @ObservationIgnored private var isLoading = false
    /// The latest sync status, kept to redraw the status row when the token changes.
    @ObservationIgnored private var latest = SyncStatus.initial

    /// Values and protocols only, no defaults, no work (SCR-3).
    init(
        info: AppInfo,
        sync: any Syncing,
        health: any WorkoutHealthRecording,
        units: any UnitPreference,
        practice: any PracticeModeSwitching,
        data: any AppDataSource,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        router: any Navigating
    ) {
        remote = AppResource(path: AppSettings.path, source: data, now: now, days: DayCalendar(calendar: calendar))
        state = SettingsState(
            info: info,
            sync: Self.section(dataSource: info.dataSource, isConfigured: sync.isConfigured)
        )
        self.router = router
        self.sync = sync
        self.health = health
        self.units = units
        self.practice = practice
        self.now = now
    }

    /// Reads the Apple Health status (it may have changed in the Health settings), then follows the sync status while
    /// the screen is shown (SCR-4). Demo data and builds without a server skip the sync part.
    func run() async {
        state.health = health.status()
        await withDiscardingTaskGroup { group in
            group.addTask { await self.load() }
            group.addTask { await self.followSync() }
        }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await remote.load(current: state.remote) { state.remote = $0 }
    }

    private func followSync() async {
        guard case .available = state.sync else { return }
        let hasToken = await sync.hasToken()
        refresh(hasToken: hasToken)
        for await status in sync.statusUpdates() {
            latest = status
            // The token can change behind this screen (a lift://sync link stores one), so read it again.
            refresh(hasToken: await sync.hasToken())
        }
    }

    @discardableResult
    func send(_ action: SettingsAction) -> Task<Void, Never>? {
        switch action {
        case .unitSelected(let unit):
            units.unit = unit  // saved; new sessions and templates, and screens opened from now, use it
            state.unit = unit
        case .platesTapped:
            router.open(.plates)
        case .acknowledgementsTapped:
            router.open(.acknowledgements)
        case .syncNowTapped:
            return syncNow()
        case .healthToggled(let isOn):
            return setHealth(isOn)
        case .refreshPulled, .retryTapped:
            if action == .retryTapped { state.remote.content = .loading }
            let sync = sync
            let canSync = state.sync != .demo && state.sync != .unavailable
            return Task {
                if canSync { await sync.syncNow() }
                await load()
            }
        case .practiceModeToggled(let isOn):
            // Only the log and practice data can switch; demo and `-fresh` launches keep theirs.
            guard state.practice.isOn != isOn, state.practice != .unavailable else { return nil }
            practice.setPracticeMode(isOn)
        default:
            return sendToken(action)
        }
        return nil
    }

    /// The sync token row and its sheet.
    private func sendToken(_ action: SettingsAction) -> Task<Void, Never>? {
        switch action {
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
        default:
            break
        }
        return nil
    }

    /// The Apple Health switch. Turning it on asks Health the first time; the row then shows what Health said.
    private func setHealth(_ isOn: Bool) -> Task<Void, Never>? {
        guard state.health.canToggle, state.health.isOn != isOn else { return nil }
        state.health = isOn ? .notAsked : .off  // the switch moves at once; the answer follows
        return Task { state.health = await health.setEnabled(isOn) }
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
        case .demo, .fresh, .practice:
            return .demo
        case .device:
            guard isConfigured else { return .unavailable }
            let status = SyncStatusText.describe(.initial, hasToken: false, now: .distantPast)
            return .available(SyncSummary(status: status, isSyncing: false, hasToken: false))
        }
    }
}
