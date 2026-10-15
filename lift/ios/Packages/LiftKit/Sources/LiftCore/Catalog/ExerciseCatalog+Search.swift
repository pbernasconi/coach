import Foundation

/// Filters for `ExerciseCatalog.search`. Nil means "any".
public struct CatalogFilter: Hashable, Sendable {
    public var bodyPart: String?
    public var equipment: String?

    public init(bodyPart: String? = nil, equipment: String? = nil) {
        self.bodyPart = bodyPart
        self.equipment = equipment
    }

    func admits(_ entry: CatalogExercise) -> Bool {
        (bodyPart.map { $0 == entry.bodyPart } ?? true) && (equipment.map { $0 == entry.equipment } ?? true)
    }
}

extension ExerciseCatalog {
    /// The entries that match `query` and `filter`, best match first. A blank query lists every filtered entry by
    /// name. Otherwise, in order: names that start with the query, names with a word that starts with it, names that
    /// contain it, then entries where every query word starts a word of the name, target muscle, equipment or body
    /// part. Ties go to the shorter name, then alphabetical. Case and accents are ignored.
    public func search(_ query: String, filter: CatalogFilter = CatalogFilter()) -> [CatalogExercise] {
        let needle = CatalogSearchKey.fold(query)
        let tokens = needle.split(separator: " ").map(String.init)
        var ranked: [(rank: Int, index: Int)] = []
        for (index, entry) in entries.enumerated() where filter.admits(entry) {
            if let rank = searchKeys[index].rank(needle: needle, tokens: tokens) {
                ranked.append((rank, index))
            }
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
        let folded = text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil).lowercased()
        let spaced = folded.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "/" ? Character(scalar) : " "
        }
        return String(spaced).split(separator: " ").joined(separator: " ")
    }

    private static func words(_ folded: String) -> [String] {
        folded.split(separator: " ").map(String.init)
    }
}
