import Foundation

/// Every user intent on the catalog browse screen, named for what happened (SCR-1).
nonisolated enum CatalogAction: Equatable, Sendable {
    case queryChanged(String)
    case bodyPartChanged(CatalogChoice)
    case equipmentChanged(CatalogChoice)
    /// A row scrolled into view: load its still once.
    case rowAppeared(String)
    /// A row: opens the entry's detail.
    case rowTapped(String)
    /// The catalog failed to load: try again.
    case retryTapped
}
