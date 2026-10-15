import KoboTokens
import SwiftUI

/// One choice in a `SelectField`, `SelectSheet`, `RadioGroup` or `ChoiceCardGroup`: a value, its title, an optional
/// subtitle and SF Symbol, and whether it can be chosen. Search reads the title, the subtitle and `keywords` (extra
/// terms such as a short code: "DB" finds Dumbbells).
///
/// Titles written in code are a `LocalizedStringResource` rather than a `LocalizedStringKey`, because search needs
/// the translated string as well as the `Text`; a string literal works for both. Runtime values use `verbatim:`.
///
///     SelectOption("db", title: "Dumbbells", subtitle: "Pairs from 2 to 40 kg", systemImage: "dumbbell")
///     SelectOption(template.id, verbatim: template.name, isEnabled: !template.isArchived)
///     equipment.map { SelectOption($0) }   // from ChoiceOptions (title not searchable; add keywords)
public struct SelectOption<Value: Hashable & Sendable>: Identifiable {
    public let value: Value
    public let title: Text
    public let subtitle: Text?
    public let systemImage: String?
    public let isEnabled: Bool
    /// The searchable text of the title and subtitle, and the extra search terms.
    let candidate: SelectSearch.Candidate

    public var id: Value { value }

    /// An option written in code: the title and subtitle are looked up in the app's String Catalog.
    public init(
        _ value: Value,
        title: LocalizedStringResource,
        subtitle: LocalizedStringResource? = nil,
        systemImage: String? = nil,
        keywords: [String] = [],
        isEnabled: Bool = true
    ) {
        self.value = value
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self.systemImage = systemImage
        self.isEnabled = isEnabled
        candidate = SelectSearch.Candidate(
            title: String(localized: title),
            subtitle: subtitle.map { String(localized: $0) },
            keywords: keywords
        )
    }

    /// An option whose title and subtitle are shown as is (user data, names, numbers).
    public init(
        _ value: Value,
        verbatim title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        keywords: [String] = [],
        isEnabled: Bool = true
    ) {
        self.value = value
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self.systemImage = systemImage
        self.isEnabled = isEnabled
        candidate = SelectSearch.Candidate(title: title, subtitle: subtitle, keywords: keywords)
    }

    /// An option made from a `ChoiceOption`. Its title is a ready-made `Text`, so search finds it only through
    /// `keywords`.
    public init(_ choice: ChoiceOption<Value>, keywords: [String] = [], isEnabled: Bool = true) {
        value = choice.value
        title = choice.title
        subtitle = nil
        systemImage = choice.systemImage
        self.isEnabled = isEnabled
        candidate = SelectSearch.Candidate(title: "", keywords: keywords)
    }
}

/// The title of an option in a search result, with the matched ranges in bold (as `HighlightedText` draws them).
enum SelectHighlight {
    static func title<Value>(_ option: SelectOption<Value>, ranges: [Range<String.Index>]) -> Text {
        let text = option.candidate.title
        guard !ranges.isEmpty else { return option.title }
        var attributed = AttributedString(text)
        for range in ranges where range.upperBound <= text.endIndex {
            guard let target = Range<AttributedString.Index>(range, in: attributed) else { continue }
            attributed[target].inlinePresentationIntent = .stronglyEmphasized
        }
        return Text(attributed)
    }
}
