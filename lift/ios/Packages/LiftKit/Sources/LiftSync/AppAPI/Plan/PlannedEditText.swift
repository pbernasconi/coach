import Foundation

/// The Edit form's text fields, read and written as the web's form does (CreateWorkout.tsx): a duration as "1:30",
/// "90" or "1h30", numbers with a comma or a point, and the TSS a time at an effort gives. Pure.
public enum PlannedEditText {
    /// "1:30", "1h30", "90" or "90 min" as minutes; nil when empty or not a time.
    public static func minutes(_ text: String) -> Int? {
        let s = text.trimmingCharacters(in: .whitespaces).lowercased()
        guard !s.isEmpty else { return nil }
        let clock = s.split(whereSeparator: { $0 == ":" || $0 == "h" }).map(String.init)
        if clock.count == 2, s.contains(":") || s.contains("h") {
            let minutePart = clock[1].hasSuffix("m") ? String(clock[1].dropLast()) : clock[1]
            guard (1...2).contains(clock[0].count), (1...2).contains(minutePart.count),
                let hours = Int(clock[0]), let mins = Int(minutePart)
            else { return nil }
            return hours * 60 + mins
        }
        var plain = s
        for suffix in ["min", "m"] where plain.hasSuffix(suffix) {
            plain = String(plain.dropLast(suffix.count)).trimmingCharacters(in: .whitespaces)
            break
        }
        guard (1...4).contains(plain.count), plain.allSatisfy(\.isASCIIDigit) else { return nil }
        return Int(plain)
    }

    /// Minutes as "1:30", the way the form shows a duration.
    public static func clock(_ minutes: Int) -> String {
        String(format: "%d:%02d", minutes / 60, minutes % 60)
    }

    /// A number typed with a point or a comma ("10,5"); nil when empty or not a number.
    public static func number(_ text: String) -> Double? {
        let s = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard !s.isEmpty, let value = Double(s), value.isFinite else { return nil }
        return value
    }

    /// A number as the form shows it: "10.5", "80".
    public static func text(_ value: Double?) -> String {
        guard let value else { return "" }
        return value.rounded() == value ? String(Int(value)) : String(value)
    }

    /// TSS = hours × IF² × 100, rounded, as the web's `estimateTss`.
    public static func estimatedTss(minutes: Int, intensityFactor: Double) -> Int {
        Int((Double(minutes) / 60 * intensityFactor * intensityFactor * 100).rounded())
    }
}

extension Character {
    fileprivate var isASCIIDigit: Bool { isASCII && isNumber }
}
