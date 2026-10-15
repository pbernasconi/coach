import Foundation
import LiftCore

/// Every user intent on the catalog browse screen, named for what happened (SCR-1).
nonisolated enum CatalogAction: Equatable, Sendable {
    case queryChanged(String)
    /// The Filters chip: opens every filter at once.
    case filtersTapped
    /// A facet chip: opens that facet's sheet.
    case facetTapped(CatalogFacet)
    /// An option in a filter sheet was checked or unchecked.
    case optionToggled(CatalogFacet, String)
    /// "In my library" was checked or unchecked.
    case libraryToggled
    /// A facet chip's ✕, or Reset in that facet's sheet.
    case facetCleared(CatalogFacet)
    /// Reset in the Filters sheet: every filter off.
    case filtersCleared
    /// "Show N exercises", the close button or a swipe closed the sheet.
    case sheetDismissed
    /// A row scrolled into view: load its still once.
    case rowAppeared(String)
    /// A row: opens the entry's detail.
    case rowTapped(String)
    /// The catalog failed to load: try again.
    case retryTapped
}
