import Foundation
import LiftCore

/// Display text for catalog values, which the dataset writes in lower case ("upper legs", "body weight").
nonisolated enum CatalogText {
    /// "upper legs" → "Upper legs". "body weight" reads "Bodyweight", the word the library uses for the same
    /// equipment.
    static func label(_ value: String) -> String {
        if value == "body weight" { return String(localized: "Bodyweight") }
        guard let first = value.first else { return value }
        return first.uppercased() + value.dropFirst()
    }

    /// A catalog name in sentence case, like the names in the person's library ("Barbell Bent Over Row" → "Barbell bent
    /// over row"). The first word keeps its case; later words are lowered unless they are an initialism ("EZ", "JM"),
    /// a single letter ("L-sit", "T-bar") or a name ("Romanian", "Smith", "Zottman").
    static func name(_ raw: String) -> String {
        var result = ""
        var word = ""
        var isFirstWord = true
        func flush() {
            guard !word.isEmpty else { return }
            result += isFirstWord || keepsCase(word) ? word : word.lowercased()
            isFirstWord = false
            word = ""
        }
        for character in raw {
            if character.isLetter {
                word.append(character)
            } else {
                flush()
                result.append(character)
            }
        }
        flush()
        return result
    }

    /// Words a sentence-case name keeps as written.
    private static func keepsCase(_ word: String) -> Bool {
        word.count == 1 || word == word.uppercased() || properNames.contains(word)
    }

    /// People, places and brands in the dataset's names.
    private static let properNames: Set<String> = [
        "Arnold", "Bosu", "Bradford", "Bulgarian", "Cossack", "Cuban", "Frankenstein", "French", "Gironda", "Hindu",
        "Hyght", "Janda", "Jefferson", "Korean", "London", "Maltese", "Olympic", "Otis", "Pallof", "Pendlay",
        "Romanian", "Russian", "Scott", "Smith", "Svend", "Tate", "Thibaudeau", "Turkish", "Zercher", "Zottman",
    ]

    /// "Glutes · Barbell": the target muscle, then the equipment.
    static func detail(_ entry: CatalogExercise) -> String {
        "\(label(entry.target)) · \(label(entry.equipment))"
    }

    /// The name of a facet, on its chip and over its options.
    static func title(_ facet: CatalogFacet) -> String {
        switch facet {
        case .bodyPart: String(localized: "Body part")
        case .target: String(localized: "Muscle")
        case .equipment: String(localized: "Equipment")
        }
    }

    /// A filter sheet's title: "Filters", or the facet's name.
    static func title(sheet: CatalogSheet) -> String {
        switch sheet {
        case .all: String(localized: "Filters")
        case .facet(let facet): title(facet)
        }
    }

    /// "1,324 exercises", or "12 of 1,324 exercises" while the search or a filter narrows the list.
    static func count(shown: Int, total: Int, isFiltered: Bool) -> String {
        isFiltered
            ? String(localized: "\(shown) of \(total) exercises")
            : String(localized: "\(total) exercises")
    }
}
