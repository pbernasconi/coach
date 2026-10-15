import Foundation

/// How many sections of an `AccordionGroup` may be open.
nonisolated public enum AccordionMode: Sendable, Equatable, CaseIterable {
    /// One or none: opening a section closes the open one, and the open one closes on a tap.
    case atMostOne
    /// Always one once a section is open: a tap on the open section keeps it open.
    case exactlyOne
}

/// The open-section rule of an `AccordionGroup`, apart from SwiftUI.
nonisolated enum AccordionExpansion {
    /// The open section after a tap on `id`.
    static func toggled<ID: Equatable>(_ id: ID, expanded: ID?, mode: AccordionMode) -> ID? {
        setting(id, isExpanded: expanded != id, expanded: expanded, mode: mode)
    }

    /// The open section after `id` asks to be open (`true`) or closed (`false`). Closing a section that is not the open
    /// one changes nothing; closing the open one leaves none open, unless the mode keeps exactly one.
    static func setting<ID: Equatable>(_ id: ID, isExpanded: Bool, expanded: ID?, mode: AccordionMode) -> ID? {
        if isExpanded { return id }
        guard expanded == id else { return expanded }
        return mode == .atMostOne ? nil : id
    }
}
