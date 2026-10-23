import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus the state it starts from (TEST-2). The sync token actions are in
/// `SettingsTokenTests`.
@MainActor
@Suite struct SettingsViewModelTests {
    let sync = FakeSyncing()
    let router = RecordingNavigator()
    let now = ManualNow()
    let health = RecordingHealthRecorder(status: .notSaved)
    let units = InMemoryUnitSettings(.kg)

    func makeViewModel(
        _ dataSource: AppInfo.DataSource = .device,
        unit: WeightUnit = .kg,
        data: any AppDataSource = FakeAppData()
    ) -> SettingsViewModel {
        let now = now
        return SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "7", unit: unit, dataSource: dataSource),
            sync: sync,
            health: health,
            units: units,
            practice: RecordingPracticeModeSwitch(),
            data: data,
            now: { now() },
            calendar: SessionBuilder.calendar,
            router: router
        )
    }

    @Test func stateShowsTheInfoItWasGiven() async {
        let vm = makeViewModel(unit: .lb)

        await vm.run()

        let summary = SyncSummary(status: "Not set up", isSyncing: false, hasToken: false)
        var expected = SettingsState(unit: .lb, version: "0.1.0 (7)", dataSource: .device, sync: .available(summary))
        expected.remote = vm.state.remote  // the server's half is tested below
        #expect(vm.state == expected)
    }

    @Test func runLoadsTheConnectionsAndTheCoach() async throws {
        let vm = makeViewModel(data: RoutedAppData([AppSettings.path: RoutedAppData.demo("app-settings")]))
        await vm.run()
        let settings = try #require(vm.state.remote.content.value)
        let connections = try #require(settings.connections.value)
        #expect(connections.items.map(\.id) == ["strava", "garmin", "calendar", "lift", "bodyspec", "function", "scale"])
        #expect(connections.summary.text == "1 of 5 needs attention")
        #expect(settings.coach.value?.nextEvent?.name == "Harbour marathon")
    }

    @Test func refreshPulledSyncsAndReadsTheConnectionsAgain() async {
        let data = RoutedAppData([AppSettings.path: RoutedAppData.demo("app-settings")])
        let vm = makeViewModel(data: data)
        await vm.send(.refreshPulled)?.value
        #expect(sync.syncNowCount == 1)
        #expect(vm.state.remote.content.value != nil)
    }

    @Test func retryTappedReadsTheConnectionsAgain() async {
        let vm = makeViewModel(data: RoutedAppData([AppSettings.path: RoutedAppData.demo("app-settings")]))
        await vm.send(.retryTapped)?.value
        #expect(vm.state.remote.content.value?.connections.value != nil)
    }

    @Test func demoDataIsNeverSynced() async {
        sync.token = "made-up-token"
        let vm = makeViewModel(.demo)

        await vm.run()
        await vm.send(.syncNowTapped)?.value

        #expect(vm.state.dataSource == .demo)
        #expect(vm.state.sync == .demo)
        #expect(sync.syncNowCount == 0)
    }

    @Test func aBuildWithoutAServerShowsUnavailable() async {
        sync.isConfigured = false

        let vm = makeViewModel()
        await vm.run()

        #expect(vm.state.sync == .unavailable)
    }

    @Test func runShowsTheLatestStatus() async {
        sync.token = "made-up-token"
        sync.statuses = [
            SyncStatus(phase: .syncing, lastSyncedAt: nil),
            SyncStatus(phase: .idle, lastSyncedAt: now().addingTimeInterval(-120)),
        ]
        let vm = makeViewModel()

        await vm.run()

        #expect(vm.state.sync == .available(SyncSummary(status: "Synced 2 min ago", isSyncing: false, hasToken: true)))
    }

    @Test func runShowsARejectedToken() async {
        sync.token = "made-up-token"
        sync.statuses = [SyncStatus(phase: .failed(.unauthorized), lastSyncedAt: nil)]
        let vm = makeViewModel()

        await vm.run()

        #expect(vm.state.sync == .available(SyncSummary(status: "Token rejected", isSyncing: false, hasToken: true)))
    }

    @Test func runShowsSyncing() async {
        sync.token = "made-up-token"
        sync.statuses = [SyncStatus(phase: .syncing, lastSyncedAt: nil)]
        let vm = makeViewModel()

        await vm.run()

        #expect(vm.state.sync == .available(SyncSummary(status: "Syncing…", isSyncing: true, hasToken: true)))
    }

    @Test func unitSelectedChangesTheUnit() {
        let vm = makeViewModel()

        let task = vm.send(.unitSelected(.lb))

        #expect(task == nil)
        #expect(vm.state.unit == .lb)
        #expect(units.unit == .lb)  // saved, so new sessions and templates use it
    }

    @Test func platesTappedOpensPlatesAndBars() {
        let vm = makeViewModel()

        let task = vm.send(.platesTapped)

        #expect(task == nil)
        #expect(router.opened == [.plates])
    }

    @Test func acknowledgementsTappedOpensTheList() {
        let vm = makeViewModel()

        let task = vm.send(.acknowledgementsTapped)

        #expect(task == nil)
        #expect(router.opened == [.acknowledgements])
    }

    @Test func syncNowTappedSyncsAndShowsTheResult() async {
        sync.token = "made-up-token"
        sync.syncResult = SyncStatus(phase: .idle, lastSyncedAt: now())
        let vm = makeViewModel()
        await vm.run()

        await vm.send(.syncNowTapped)?.value

        #expect(sync.syncNowCount == 1)
        #expect(vm.state.sync == .available(SyncSummary(status: "Synced just now", isSyncing: false, hasToken: true)))
    }

    @Test func syncNowTappedShowsOffline() async {
        sync.token = "made-up-token"
        sync.syncResult = SyncStatus(phase: .failed(.offline), lastSyncedAt: nil)
        let vm = makeViewModel()
        await vm.run()

        await vm.send(.syncNowTapped)?.value

        #expect(vm.state.sync == .available(SyncSummary(status: "Offline", isSyncing: false, hasToken: true)))
    }

    @Test func syncNowTappedWithoutATokenDoesNothing() async {
        let vm = makeViewModel()
        await vm.run()

        let task = vm.send(.syncNowTapped)

        #expect(task == nil)
        #expect(sync.syncNowCount == 0)
    }

    @Test func syncNowTappedWhileSyncingDoesNothing() async {
        sync.token = "made-up-token"
        sync.statuses = [SyncStatus(phase: .syncing, lastSyncedAt: nil)]
        let vm = makeViewModel()
        await vm.run()

        let task = vm.send(.syncNowTapped)

        #expect(task == nil)
        #expect(sync.syncNowCount == 0)
    }

    @Test func runShowsWhereAppleHealthStands() async {
        health.statusAnswer = .notAsked
        let vm = makeViewModel()

        await vm.run()

        #expect(vm.state.health == .notAsked)
    }

    @Test func healthToggledTurnsSavingOnAndShowsWhatHealthSaid() async {
        health.statusAnswer = .off
        health.answerAfterAsking = .on
        let vm = makeViewModel()
        await vm.run()

        let task = vm.send(.healthToggled(true))
        #expect(vm.state.health == .notAsked)  // the switch moves at once
        await task?.value

        #expect(health.calls == [.setEnabled(true)])
        #expect(vm.state.health == .on)
    }

    @Test func healthToggledDoesNothingForDemoData() async {
        let vm = makeViewModel(.demo)
        await vm.run()

        #expect(vm.send(.healthToggled(true)) == nil)
        #expect(health.calls.isEmpty)
        #expect(vm.state.health == .notSaved)
    }
}
