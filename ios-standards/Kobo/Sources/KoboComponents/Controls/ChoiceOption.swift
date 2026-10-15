import SwiftUI

/// One choice in a `ChipGroup` or `SegmentedPicker`: a value, its visible title and an optional SF Symbol.
///
///     ChoiceOption(Split.upper, title: "Upper", systemImage: "figure.arms.open")
public struct ChoiceOption<Value: Hashable & Sendable>: Identifiable {
    public let value: Value
    public let title: Text
    public let systemImage: String?

    public var id: Value { value }

    /// A localized title.
    public init(_ value: Value, title: LocalizedStringKey, systemImage: String? = nil) {
        self.value = value
        self.title = Text(title)
        self.systemImage = systemImage
    }

    /// A title shown as is (user data, numbers).
    public init(_ value: Value, verbatim title: String, systemImage: String? = nil) {
        self.value = value
        self.title = Text(verbatim: title)
        self.systemImage = systemImage
    }
}
