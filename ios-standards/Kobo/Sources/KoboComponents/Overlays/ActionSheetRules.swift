import Foundation

/// Whether an action sheet item destroys something. Destructive items are drawn in the danger colour, carry the
/// destructive button role, and sit in their own group at the end of the sheet.
nonisolated public enum ActionSheetRole: Sendable, Equatable, CaseIterable {
    case standard
    case destructive
}

/// The ordering and validation rules of an action sheet, apart from SwiftUI so they can be tested.
nonisolated enum ActionSheetRules {
    /// The items split into the standard group and the destructive group, each in the caller's order. Destructive
    /// actions go last, away from the thumb's first reach (Human Interface Guidelines).
    static func grouped<Item>(
        _ items: [Item],
        role: (Item) -> ActionSheetRole
    ) -> (standard: [Item], destructive: [Item]) {
        var standard: [Item] = []
        var destructive: [Item] = []
        for item in items {
            if role(item) == .destructive { destructive.append(item) } else { standard.append(item) }
        }
        return (standard, destructive)
    }

    /// True when any item has an icon: every row then keeps an icon column, so all labels start at one edge.
    static func showsIconColumn(_ icons: [String?]) -> Bool {
        icons.contains { $0 != nil }
    }

    /// The ids used more than once, sorted. Two actions with the same id would be ambiguous to `ForEach` and to the
    /// person reading them.
    static func duplicateIDs(_ ids: [String]) -> [String] {
        var seen: Set<String> = []
        var duplicates: Set<String> = []
        for id in ids where !seen.insert(id).inserted {
            duplicates.insert(id)
        }
        return duplicates.sorted()
    }
}
