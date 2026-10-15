import Foundation

/// What the launch arguments ask for. CI and the UI smoke test use them; a normal launch passes none.
///
///     -demo                                   in-memory database filled with fabricated sessions
///     -tab week|history|exercises|settings    the tab to open first
///     -appearance dark|light                  forces an appearance (CI usually sets it with simctl)
nonisolated struct LaunchOptions: Equatable, Sendable {
    enum Appearance: String, Equatable, Sendable {
        case dark
        case light
    }

    var isDemo = false
    var initialTab = AppTab.week
    var appearance: Appearance?

    init(isDemo: Bool = false, initialTab: AppTab = .week, appearance: Appearance? = nil) {
        self.isDemo = isDemo
        self.initialTab = initialTab
        self.appearance = appearance
    }

    /// Parses `ProcessInfo.processInfo.arguments`. Unknown arguments and bad values are ignored.
    init(arguments: [String]) {
        self.init()
        isDemo = arguments.contains("-demo") || arguments.contains("--demo")
        if let tab = Self.value(after: "-tab", in: arguments).flatMap(AppTab.init(rawValue:)) {
            initialTab = tab
        }
        appearance = Self.value(after: "-appearance", in: arguments).flatMap(Appearance.init(rawValue:))
    }

    private static func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1].lowercased()
    }
}
