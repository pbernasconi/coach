import Foundation

/// Where a screen link opens: its tab, and the route over the tab's root (nil: the root alone).
nonisolated struct ScreenDestination: Equatable, Sendable {
    var tab: AppTab
    var route: AppRoute?
}

/// Opens a screen link's destination. `TabSwitcher` is the live one; tests record what was opened.
@MainActor
protocol ScreenLinkOpening: AnyObject {
    func open(_ destination: ScreenDestination)
}

extension AppLink {
    /// The tab and screen of a screen link (lift/PUSH.md, "Links"); nil for the links that open a flow instead.
    var destination: ScreenDestination? {
        switch self {
        case .session(let id): ScreenDestination(tab: .lift, route: .liftSession(id))
        case .activity(let id): ScreenDestination(tab: .training, route: .activity(id))
        case .weighIn(let day): ScreenDestination(tab: .today, route: .weighIn(day))
        case .today: ScreenDestination(tab: .today, route: nil)
        case .importNote, .templates, .syncCode: nil
        }
    }
}
