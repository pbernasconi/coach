import Foundation

/// What the launch arguments ask for. CI and the UI smoke test use them; a normal launch passes none.
///
///     -demo                                   in-memory database filled with fabricated sessions
///     -tab week|history|exercises|settings    the tab to open first
///     -appearance dark|light                  forces an appearance (CI usually sets it with simctl)
///     -open workout                           with -demo: pushes today's or the next planned session on Week
nonisolated struct LaunchOptions: Equatable, Sendable {
    enum Appearance: String, Equatable, Sendable {
        case dark
        case light
    }

    /// A screen to push once the data is ready, for screenshots.
    enum Opening: String, Equatable, Sendable {
        case workout
    }

    var isDemo = false
    var initialTab = AppTab.week
    var appearance: Appearance?
    var opening: Opening?

    init(isDemo: Bool = false, initialTab: AppTab = .week, appearance: Appearance? = nil, opening: Opening? = nil) {
        self.isDemo = isDemo
        self.initialTab = initialTab
        self.appearance = appearance
        self.opening = opening
    }

    /// Parses `ProcessInfo.processInfo.arguments`. Unknown arguments and bad values are ignored.
    init(arguments: [String]) {
        self.init()
        isDemo = arguments.contains("-demo") || arguments.contains("--demo")
        if let tab = Self.value(after: "-tab", in: arguments).flatMap(AppTab.init(rawValue:)) {
            initialTab = tab
        }
        appearance = Self.value(after: "-appearance", in: arguments).flatMap(Appearance.init(rawValue:))
        opening = Self.value(after: "-open", in: arguments).flatMap(Opening.init(rawValue:))
    }

    /// The route the Week tab starts on: the workout for `-open workout` in demo mode, given the session to open.
    /// Nil without demo data, so a real launch never opens a screen by itself.
    func initialRoute(upcomingSessionID: UUID?) -> AppRoute? {
        guard isDemo, opening == .workout, let upcomingSessionID else { return nil }
        return .workout(upcomingSessionID)
    }

    private static func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1].lowercased()
    }
}
