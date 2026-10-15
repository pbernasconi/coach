import Foundation

/// The dismissal rules of an item sheet, apart from SwiftUI so they can be tested. `presented` is the mirror that
/// `.sheet(item:)` binds; the caller's item stays the source of truth.
nonisolated struct ItemSheetPresentation<Item: Identifiable> {
    var presented: Item?
    private var displayedID: Item.ID?

    /// The sheet of `id` is on screen.
    mutating func sheetDidAppear(_ id: Item.ID) {
        displayedID = id
    }

    /// A sheet closed. True when the sheet started the close (a swipe, its own close button) and the caller must
    /// hear about it: the caller still holds the item that was on screen. A caller that cleared the item, or swapped
    /// it for another one, already knows.
    mutating func sheetDidDismiss(current: Item?) -> Bool {
        let dismissedID = displayedID
        displayedID = nil
        guard let current, let dismissedID else { return false }
        return current.id == dismissedID
    }

    /// The item to render in the sheet of `shown`: the caller's newest payload while the identity is the same, so an
    /// edit to the item updates the open sheet instead of replacing it.
    static func latest(_ shown: Item, current: Item?) -> Item {
        guard let current, current.id == shown.id else { return shown }
        return current
    }
}
