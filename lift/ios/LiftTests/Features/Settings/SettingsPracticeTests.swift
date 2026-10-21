import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The Practice mode switch on Settings (TEST-2): it shows where the data lives and asks for the other data.
@MainActor
@Suite struct SettingsPracticeTests {
    let practice = RecordingPracticeModeSwitch()

    func makeViewModel(_ dataSource: AppInfo.DataSource) -> SettingsViewModel {
        SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: dataSource),
            sync: FakeSyncing(),
            health: RecordingHealthRecorder(status: .notSaved),
            units: InMemoryUnitSettings(.kg),
            practice: practice,
            now: { ManualNow.start },
            router: RecordingNavigator()
        )
    }

    @Test(arguments: [
        (AppInfo.DataSource.device, PracticeSection.off),
        (.practice, .on),
        (.demo, .unavailable),
        (.fresh, .unavailable),
    ])
    func theSwitchShowsWhereTheDataLives(dataSource: AppInfo.DataSource, expected: PracticeSection) {
        #expect(makeViewModel(dataSource).state.practice == expected)
    }

    @Test func practiceModeToggledOnAsksForPracticeData() {
        let vm = makeViewModel(.device)

        vm.send(.practiceModeToggled(true))

        #expect(practice.calls == [true])
    }

    @Test func practiceModeToggledOffGoesBackToTheLog() {
        let vm = makeViewModel(.practice)

        vm.send(.practiceModeToggled(false))

        #expect(practice.calls == [false])
    }

    @Test func practiceModeToggledDoesNothingWhenAlreadyThereOrForDemoData() {
        makeViewModel(.device).send(.practiceModeToggled(false))
        makeViewModel(.practice).send(.practiceModeToggled(true))
        makeViewModel(.demo).send(.practiceModeToggled(true))

        #expect(practice.calls.isEmpty)
    }

    @Test func practiceDataIsNeverSynced() {
        #expect(makeViewModel(.practice).state.sync == .demo)
    }
}
