import Foundation

/// A label and its ready-made value text: weather rows and relative effort stats.
nonisolated struct LabelledValue: Decodable, Equatable, Sendable, Hashable {
    var label: String
    var valueText: String
}
