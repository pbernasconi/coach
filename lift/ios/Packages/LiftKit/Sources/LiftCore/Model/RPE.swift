import Foundation

/// Rate of perceived exertion for one set: 6 to 10 in half steps, where 10 means no rep was left and 8 means about
/// two were. It is optional on every set; nil means it was not recorded.
public enum RPE {
    /// Every value the scale allows, in order: 6, 6.5, … 10.
    public static let scale: [Double] = Array(stride(from: 6.0, through: 10.0, by: 0.5))

    /// True when `value` is on the scale.
    public static func isValid(_ value: Double) -> Bool { scale.contains(value) }
}

/// Free-text notes as they are stored: trimmed, and nil when nothing is left.
public enum NoteText {
    public static func normalized(_ text: String?) -> String? {
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}
