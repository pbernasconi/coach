import KoboTokens
import SwiftUI

@main
struct LiftApp: App {
    private let options: LaunchOptions
    /// Opens the data now, in `init`, so the workout Live Activity's buttons find it also when they launch Lift in the
    /// background (`AppLauncher` hands them the center).
    @State private var launcher: AppLauncher

    init() {
        let options = LaunchOptions(arguments: ProcessInfo.processInfo.arguments)
        self.options = options
        _launcher = State(
            initialValue: AppLauncher(options: options, setting: UserDefaultsPracticeModeSettings.standard())
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView(launcher: launcher, options: options)
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
