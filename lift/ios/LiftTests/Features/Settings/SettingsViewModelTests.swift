import Testing

@testable import Lift

/// One test per Action case, plus the state it starts from (TEST-2).
@MainActor
@Suite struct SettingsViewModelTests {
    @Test func stateShowsTheInfoItWasGiven() async {
        let info = AppInfo(version: "0.1.0", build: "7", unit: .lb, dataSource: .device)
        let vm = SettingsViewModel(info: info)

        await vm.run()

        #expect(vm.state == SettingsState(unit: .lb, version: "0.1.0 (7)", dataSource: .device))
    }

    @Test func demoModeIsShown() {
        let info = AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .demo)

        #expect(SettingsViewModel(info: info).state.dataSource == .demo)
    }

    @Test func unitSelectedChangesTheUnit() {
        let vm = SettingsViewModel(info: AppInfo(version: "0.1.0", build: "1", unit: .kg, dataSource: .device))

        let task = vm.send(.unitSelected(.lb))

        #expect(task == nil)
        #expect(vm.state.unit == .lb)
    }
}
