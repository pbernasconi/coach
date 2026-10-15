import Foundation

/// Every user intent on the History screen, named for what happened (SCR-1).
nonisolated enum HistoryAction: Equatable, Sendable {
    case sessionTapped(UUID)
}
