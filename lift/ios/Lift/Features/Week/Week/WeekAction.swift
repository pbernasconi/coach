import Foundation

/// Every user intent on the Week screen, named for what happened (SCR-1).
nonisolated enum WeekAction: Equatable, Sendable {
    case daySelected(Date)
    case weekChanged(Int)
    case sessionTapped(UUID)
}
