import Foundation

/// A catalog field the browse list can be narrowed by.
public enum CatalogFacet: String, CaseIterable, Hashable, Sendable, Identifiable {
    case bodyPart
    case target
    case equipment

    public var id: String { rawValue }

    /// The entry's value for this facet ("chest", "pectorals", "barbell").
    public func value(of entry: CatalogExercise) -> String {
        switch self {
        case .bodyPart: entry.bodyPart
        case .target: entry.target
        case .equipment: entry.equipment
        }
    }
}

/// Which entries the browse list keeps. Inside a facet any chosen value matches (OR); every facet with a choice must
/// match (AND); with `inLibrary`, only entries the library links to. A facet with nothing chosen admits everything.
public struct CatalogFilter: Hashable, Sendable {
    /// The chosen values per facet. Never holds an empty set, so equal filters compare equal.
    public private(set) var selections: [CatalogFacet: Set<String>]
    public var inLibrary: Bool

    public init(selections: [CatalogFacet: Set<String>] = [:], inLibrary: Bool = false) {
        self.selections = selections.filter { !$0.value.isEmpty }
        self.inLibrary = inLibrary
    }

    /// The chosen values of one facet; empty for any.
    public subscript(facet: CatalogFacet) -> Set<String> {
        get { selections[facet] ?? [] }
        set { selections[facet] = newValue.isEmpty ? nil : newValue }
    }

    /// Nothing narrows the list.
    public var isEmpty: Bool { selections.isEmpty && !inLibrary }

    /// How many filters are on: one per facet with a choice, plus one for `inLibrary`.
    public var activeCount: Int { selections.count + (inLibrary ? 1 : 0) }

    /// Adds `value` to the facet's choice, or removes it if it was chosen.
    public mutating func toggle(_ value: String, in facet: CatalogFacet) {
        self[facet].formSymmetricDifference([value])
    }

    /// Whether `entry` passes every filter. `ignoring` leaves one facet out and `ignoringLibrary` the library, which
    /// is how a count asks "how many would match with this value instead".
    public func admits(
        _ entry: CatalogExercise,
        library: Set<String>,
        ignoring skipped: CatalogFacet? = nil,
        ignoringLibrary: Bool = false
    ) -> Bool {
        if inLibrary, !ignoringLibrary, !library.contains(entry.id) { return false }
        for (facet, chosen) in selections where facet != skipped {
            if !chosen.contains(facet.value(of: entry)) { return false }
        }
        return true
    }
}

/// How many entries each filter option would show, given the query and the other filters.
public struct CatalogFacetCounts: Equatable, Sendable {
    /// Per facet, per value: entries that match the query, every other facet and the library choice, with this value.
    public var values: [CatalogFacet: [String: Int]]
    /// Entries that match the query and every facet and are in the library.
    public var inLibrary: Int

    public init(values: [CatalogFacet: [String: Int]] = [:], inLibrary: Int = 0) {
        self.values = values
        self.inLibrary = inLibrary
    }

    /// The count for one option; zero when no entry has it.
    public func count(_ value: String, in facet: CatalogFacet) -> Int {
        values[facet]?[value] ?? 0
    }
}
