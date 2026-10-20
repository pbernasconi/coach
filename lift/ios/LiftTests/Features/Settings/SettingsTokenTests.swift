import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The sync token sheet's Actions, one test each (TEST-2). Tokens here are made up (TEST-8).
@MainActor
@Suite struct SettingsTokenTests {
    let sync = FakeSyncing()
    let now = ManualNow()

    func makeViewModel() async -> SettingsViewModel {
        let now = now
        let vm = SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .device),
            sync: sync,
            health: RecordingHealthRecorder(status: .notSaved),
            units: InMemoryUnitSettings(.kg),
            now: { now() },
            router: RecordingNavigator()
        )
        await vm.run()
        return vm
    }

    @Test func aTokenStoredBehindTheScreenShowsOnTheNextStatus() async {
        // A lift://sync link stores the token after Settings first read it; the next status update shows it.
        sync.hasTokenAnswers = [false, true]
        sync.statuses = [SyncStatus(phase: .idle, lastSyncedAt: nil)]

        let vm = await makeViewModel()

        guard case .available(let summary) = vm.state.sync else {
            Issue.record("sync section not available")
            return
        }
        #expect(summary.hasToken)
    }

    @Test func tokenRowTappedOpensAnEmptySheet() async {
        let vm = await makeViewModel()

        let task = vm.send(.tokenRowTapped)

        #expect(task == nil)
        #expect(vm.state.tokenEditor == TokenEditor(draft: "", canRemove: false))
    }

    @Test func tokenRowTappedOffersRemoveWhenATokenIsStored() async {
        sync.token = "made-up-token"
        let vm = await makeViewModel()

        vm.send(.tokenRowTapped)

        #expect(vm.state.tokenEditor?.canRemove == true)
    }

    @Test func tokenRowTappedInDemoModeDoesNothing() async {
        let vm = SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .demo),
            sync: sync,
            health: RecordingHealthRecorder(status: .notSaved),
            units: InMemoryUnitSettings(.kg),
            now: { ManualNow.start },
            router: RecordingNavigator()
        )

        vm.send(.tokenRowTapped)

        #expect(vm.state.tokenEditor == nil)
    }

    @Test func tokenDraftChangedUpdatesTheDraft() async {
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)

        vm.send(.tokenDraftChanged("made-up"))

        #expect(vm.state.tokenEditor?.draft == "made-up")
        #expect(vm.state.tokenEditor?.canSave == true)
    }

    @Test func tokenSaveTappedSavesTrimmedClosesAndSyncs() async {
        sync.syncResult = SyncStatus(phase: .idle, lastSyncedAt: now())
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)
        vm.send(.tokenDraftChanged("  made-up-token\n"))

        let first = vm.send(.tokenSaveTapped)
        let second = vm.send(.tokenSaveTapped)  // double tap is ignored
        await first?.value

        #expect(second == nil)
        #expect(sync.savedTokens == ["made-up-token"])
        #expect(sync.syncNowCount == 1)
        #expect(vm.state.tokenEditor == nil)
        #expect(vm.state.sync == .available(SyncSummary(status: "Synced just now", isSyncing: false, hasToken: true)))
    }

    @Test func tokenSaveTappedWithABlankDraftDoesNothing() async {
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)
        vm.send(.tokenDraftChanged("   "))

        let task = vm.send(.tokenSaveTapped)

        #expect(task == nil)
        #expect(sync.savedTokens.isEmpty)
    }

    @Test func tokenSaveFailureKeepsTheSheetOpen() async {
        sync.setTokenError = AppError(.unknown)
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)
        vm.send(.tokenDraftChanged("made-up-token"))

        await vm.send(.tokenSaveTapped)?.value

        #expect(vm.state.tokenEditor?.save == .failed)
        #expect(sync.syncNowCount == 0)

        vm.send(.tokenDraftChanged("made-up-token2"))  // typing again clears the error
        #expect(vm.state.tokenEditor?.save == .idle)
    }

    @Test func tokenRemoveTappedRemovesTheToken() async {
        sync.token = "made-up-token"
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)

        await vm.send(.tokenRemoveTapped)?.value

        #expect(sync.savedTokens == [nil])
        #expect(vm.state.tokenEditor == nil)
        #expect(vm.state.sync == .available(SyncSummary(status: "Not set up", isSyncing: false, hasToken: false)))
    }

    @Test func tokenRemoveTappedWithoutATokenDoesNothing() async {
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)

        let task = vm.send(.tokenRemoveTapped)

        #expect(task == nil)
        #expect(sync.savedTokens.isEmpty)
    }

    @Test func tokenEditorDismissedClosesTheSheet() async {
        let vm = await makeViewModel()
        vm.send(.tokenRowTapped)
        vm.send(.tokenDraftChanged("made-up"))

        let task = vm.send(.tokenEditorDismissed)

        #expect(task == nil)
        #expect(vm.state.tokenEditor == nil)
        #expect(sync.savedTokens.isEmpty)
    }
}
