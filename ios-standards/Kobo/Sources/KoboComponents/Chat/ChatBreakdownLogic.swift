import Foundation

/// The bar lengths of a breakdown card: each value over the largest, 0…1; all zero when nothing is above zero.
nonisolated public enum ChatBreakdownLogic {
    public static func fractions(_ values: [Double]) -> [Double] {
        let largest = values.max() ?? 0
        guard largest > 0 else { return values.map { _ in 0 } }
        return values.map { min(1, max(0, $0 / largest)) }
    }
}
