import Foundation

/// One fact of an outcome ("Duration", "1 h 12 min"). The label is held resolved, so facts stay `Hashable` and
/// `Sendable` and the share text can use them. Key `ForEach` on `id`, never on the label.
nonisolated public struct OutcomeFact: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let value: String

    /// A fact whose label is shown as is. `id` defaults to the label.
    public init(verbatim label: String, value: String, id: String? = nil) {
        self.id = id ?? label
        self.label = label
        self.value = value
    }
}
