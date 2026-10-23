import Foundation

/// How to get from the plates on one side of the bar now to the plates a new load needs. Plates come off from the
/// outside in, so the plates both loads share from the collar outwards stay on; the rest of the old plates come off and
/// the rest of the new ones go on. 45 + 45 → 45 + 45 + 10 + 5 adds 10 + 5; 45 + 45 + 10 + 5 → 45 + 45 takes off 10 + 5.
public struct PlateChange: Hashable, Sendable {
    /// The plates that stay on, from the collar outwards.
    public let kept: [Double]
    /// The plates to take off, from the collar outwards (the outermost last).
    public let remove: [Double]
    /// The plates to put on after the removals, from the collar outwards.
    public let add: [Double]

    /// `from` and `to` are one side each, heaviest (innermost) first, as `PlateLoad.perSide` gives them.
    public init(from: [Double], to: [Double]) {
        let shared = zip(from, to).prefix(while: { $0 == $1 }).count
        kept = Array(to.prefix(shared))
        remove = Array(from.dropFirst(shared))
        add = Array(to.dropFirst(shared))
    }

    /// True when the bar already holds the new load.
    public var isNone: Bool { remove.isEmpty && add.isEmpty }
}
