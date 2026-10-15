import Foundation

/// What the closed `MultiSelectField` shows for its selection, apart from SwiftUI: nothing (the placeholder), the one
/// chosen option's title, "All", or a count ("3 selected"). Values the options no longer list are ignored.
nonisolated enum SelectSummary: Equatable, Sendable {
    /// Nothing chosen: the field shows its placeholder.
    case none
    /// One option, at this index of the options.
    case one(index: Int)
    /// Every option, and there is more than one.
    case all
    /// Several options, but not all of them.
    case count(Int)

    /// The summary of `selection` over the option values, in their order.
    static func of<Value: Hashable>(_ selection: Set<Value>, in values: [Value]) -> SelectSummary {
        let chosen = values.indices.filter { selection.contains(values[$0]) }
        switch chosen.count {
        case 0: return .none
        case 1: return .one(index: chosen[0])
        case values.count: return .all
        default: return .count(chosen.count)
        }
    }

    /// The chosen values in the options' order, for a caller that lists them.
    static func ordered<Value: Hashable>(_ selection: Set<Value>, in values: [Value]) -> [Value] {
        values.filter { selection.contains($0) }
    }
}
