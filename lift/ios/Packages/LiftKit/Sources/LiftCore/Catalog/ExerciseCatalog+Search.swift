import Foundation

extension ExerciseCatalog {
    /// The entries that match `query` and `filter`, best match first. `library` holds the catalog ids the library
    /// links to, for `filter.inLibrary`. A blank query lists every filtered entry by name. Otherwise, in order: names
    /// that start with the query, names with a word that starts with it, names that contain it, then entries where
    /// every query word starts a word of the name, target muscle, equipment or body part. Ties go to the shorter
    /// name, then alphabetical. Case and accents are ignored.
    public func search(
        _ query: String,
        filter: CatalogFilter = CatalogFilter(),
        library: Set<String> = []
    ) -> [CatalogExercise] {
        var ranked: [(rank: Int, index: Int)] = []
        for (index, rank) in matches(query) where filter.admits(entries[index], library: library) {
            ranked.append((rank, index))
        }
        ranked.sort { lhs, rhs in
            if lhs.rank != rhs.rank { return lhs.rank < rhs.rank }
            let left = searchKeys[lhs.index].name
            let right = searchKeys[rhs.index].name
            let byName = lhs.rank == CatalogSearchKey.Rank.blank.rawValue || left.count == right.count
            return byName ? left < right : left.count < right.count
        }
        return ranked.map { entries[$0.index] }
    }

    /// For every option of every facet, how many entries match `query`, the library choice and every other facet
    /// with that option: what the list would hold with it chosen alone in its facet. The library count keeps every
    /// facet.
    public func facetCounts(
        _ query: String,
        filter: CatalogFilter = CatalogFilter(),
        library: Set<String> = []
    ) -> CatalogFacetCounts {
        var counts = CatalogFacetCounts()
        for (index, _) in matches(query) {
            let entry = entries[index]
            for facet in CatalogFacet.allCases
            where filter.admits(entry, library: library, ignoring: facet) {
                counts.values[facet, default: [:]][facet.value(of: entry), default: 0] += 1
            }
            if library.contains(entry.id), filter.admits(entry, library: library, ignoringLibrary: true) {
                counts.inLibrary += 1
            }
        }
        return counts
    }

    /// The index and match tier of every entry that matches `query`, in catalog order.
    private func matches(_ query: String) -> [(index: Int, rank: Int)] {
        let needle = CatalogSearchKey.fold(query)
        let tokens = needle.split(separator: " ").map(String.init)
        return searchKeys.indices.compactMap { index in
            searchKeys[index].rank(needle: needle, tokens: tokens).map { (index, $0) }
        }
    }
}

/// Precomputed, folded text for searching one entry.
struct CatalogSearchKey: Sendable {
    /// Match tiers, best first.
    enum Rank: Int {
        case namePrefix, wordPrefix, nameContains, allTokens, blank
    }

    let name: String
    let nameWords: [String]
    let otherWords: [String]

    init(_ entry: CatalogExercise) {
        name = Self.fold(entry.name)
        nameWords = Self.words(name)
        otherWords = Self.words(Self.fold("\(entry.target) \(entry.equipment) \(entry.bodyPart)"))
    }

    func rank(needle: String, tokens: [String]) -> Int? {
        guard !needle.isEmpty else { return Rank.blank.rawValue }
        if name.hasPrefix(needle) { return Rank.namePrefix.rawValue }
        if nameWords.contains(where: { $0.hasPrefix(needle) }) { return Rank.wordPrefix.rawValue }
        if name.contains(needle) { return Rank.nameContains.rawValue }
        let words = nameWords + otherWords
        let allMatch = tokens.allSatisfy { token in words.contains { $0.hasPrefix(token) } }
        return allMatch ? Rank.allTokens.rawValue : nil
    }

    /// Lowercased, accent-free, punctuation turned into single spaces ("Sit-Up (Kneeling)" → "sit up kneeling").
    static func fold(_ text: String) -> String {
        let folded = text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            .lowercased()
        let spaced = folded.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "/" ? Character(scalar) : " "
        }
        return String(spaced).split(separator: " ").joined(separator: " ")
    }

    private static func words(_ folded: String) -> [String] {
        folded.split(separator: " ").map(String.init)
    }
}
