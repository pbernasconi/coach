import Foundation

/// One key of the `NumberEntry` keypad.
nonisolated enum NumberEntryKey: Hashable, Sendable, Identifiable {
    case digit(Int)
    case decimal
    case delete

    var id: String {
        switch self {
        case .digit(let digit): "digit-\(digit)"
        case .decimal: "decimal"
        case .delete: "delete"
        }
    }

    /// The keypad rows, phone layout: 1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫. A whole-number keypad leaves the decimal key out.
    static func rows(allowsDecimal: Bool) -> [[NumberEntryKey]] {
        [
            [.digit(1), .digit(2), .digit(3)],
            [.digit(4), .digit(5), .digit(6)],
            [.digit(7), .digit(8), .digit(9)],
            allowsDecimal ? [.decimal, .digit(0), .delete] : [.digit(0), .delete],
        ]
    }
}
