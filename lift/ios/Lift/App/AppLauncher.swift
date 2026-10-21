import Foundation
import Observation

/// Holds the app's open data and swaps it when practice mode is turned on or off. `LiftApp` makes one; `RootView`
/// shows its `launch` and starts the shell over whenever `generation` changes.
@Observable
final class AppLauncher: PracticeModeSwitching {
    private(set) var launch: CompositionRoot.Launch
    /// Goes up with each switch, so the shell and every screen are made again over the new data.
    private(set) var generation = 0
    @ObservationIgnored private let options: LaunchOptions
    @ObservationIgnored private let setting: any PracticeModeSetting
    @ObservationIgnored private var switching: Task<Void, Never>?

    init(options: LaunchOptions, setting: any PracticeModeSetting) {
        self.options = options
        self.setting = setting
        launch = .failed
        open()
    }

    /// Practice data when practice mode is on, for a normal launch only: `-demo` and `-fresh` keep their own data.
    var source: AppInfo.DataSource {
        let source = options.dataSource
        return source == .device && setting.isOn ? .practice : source
    }

    /// Saves the choice, ends the workout Live Activity of the data being left, and opens the other data. Turning it
    /// on starts over with new sample workouts.
    func setPracticeMode(_ isOn: Bool) {
        guard options.dataSource == .device, setting.isOn != isOn, switching == nil else { return }
        let previous = launch
        switching = Task {
            if case .ready(let dependencies) = previous {
                await dependencies.workoutActivity.stop()
            }
            setting.isOn = isOn
            if isOn { CompositionRoot.removePracticeData() }
            open()
            switching = nil
        }
    }

    private func open() {
        launch = CompositionRoot.launch(source: source, practice: self)
        // The workout Live Activity's buttons run in this process, also when they launch Lift in the background.
        if case .ready(let dependencies) = launch {
            WorkoutActivityButtons.center = dependencies.workoutActivity
        } else {
            WorkoutActivityButtons.center = nil
        }
        generation += 1
    }
}
