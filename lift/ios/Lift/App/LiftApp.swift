import KoboTokens
import SwiftUI

@main
struct LiftApp: App {
    private let options: LaunchOptions
    private let launch: CompositionRoot.Launch

    init() {
        let options = LaunchOptions(arguments: ProcessInfo.processInfo.arguments)
        self.options = options
        let launch = CompositionRoot.launch(options: options)
        self.launch = launch
        // The workout Live Activity's buttons run in this process, also when they launch Lift in the background.
        if case .ready(let dependencies) = launch {
            WorkoutActivityButtons.center = dependencies.workoutActivity
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(launch: launch, options: options)
                .koboTheme(.lift)
                .preferredColorScheme(colorScheme)
        }
    }

    /// `nil` follows the system appearance; light is the default look.
    private var colorScheme: ColorScheme? {
        switch options.appearance {
        case .dark: .dark
        case .light: .light
        case nil: nil
        }
    }
}
