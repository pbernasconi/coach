import Foundation

/// Every user intent on the Acknowledgements screen, named for what happened (SCR-1).
nonisolated enum AcknowledgementsAction: Equatable, Sendable {
    /// A licence or source link.
    case linkTapped(URL)
}
