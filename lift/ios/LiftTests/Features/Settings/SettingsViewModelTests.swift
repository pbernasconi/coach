import Testing

@testable import Lift

/// One test per Action case, plus the state it starts from (TEST-2).
@MainActor
@Suite struct SettingsViewModelTests {
    @Test func stateShowsTheInfoItWasGiven() async {
        let info = AppInfo(version: "0.1.0", build: "7", unit: .lb, dataSource: .device)
        let vm = SettingsViewModel(info: info, router: RecordingNavigator())

        await vm.run()

        #expect(vm.state == SettingsState(unit: .lb, version: "0.1.0 (7)", dataSource: .device))
    }

    @Test func demoModeIsShown() {
        let info = AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .demo)

        #expect(SettingsViewModel(info: info, router: RecordingNavigator()).state.dataSource == .demo)
    }

    @Test func unitSelectedChangesTheUnit() {
        let vm = SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .device),
            router: RecordingNavigator()
        )

        let task = vm.send(.unitSelected(.lb))

        #expect(task == nil)
        #expect(vm.state.unit == .lb)
    }

    @Test func acknowledgementsTappedOpensTheList() {
        let router = RecordingNavigator()
        let vm = SettingsViewModel(
            info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .device),
            router: router
        )

        let task = vm.send(.acknowledgementsTapped)

        #expect(task == nil)
        #expect(router.opened == [.acknowledgements])
    }
}
