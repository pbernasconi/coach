import Foundation

/// One rule a new password must meet, shown as a live checklist under a `KoboSecureField`. Rules never turn red: a
/// rule is met or not yet met, and the screen gates its submit on `allMet`.
///
///     KoboSecureField("New password", text: $password, content: .newPassword, rules: [
///         .minimumLength(12), .mixedCase, .digit, .symbol,
///     ])
nonisolated public struct PasswordRule: Identifiable, Sendable {
    public let id: String
    /// The checklist line ("At least 12 characters").
    public let label: String
    private let test: @Sendable (String) -> Bool

    /// A custom rule whose label is shown as is.
    public init(id: String, label: String, isMet: @escaping @Sendable (String) -> Bool) {
        self.id = id
        self.label = label
        self.test = isMet
    }

    /// Whether `value` meets this rule.
    public func isMet(by value: String) -> Bool { test(value) }

    /// At least `count` characters, counted as people see them.
    public static func minimumLength(_ count: Int, label: String) -> PasswordRule {
        PasswordRule(id: "length-\(count)", label: label) { $0.count >= count }
    }

    /// At least one uppercase and one lowercase letter, in any script.
    public static func mixedCase(label: String) -> PasswordRule {
        PasswordRule(id: "case", label: label) { value in
            value.contains(where: \.isUppercase) && value.contains(where: \.isLowercase)
        }
    }

    /// At least one digit.
    public static func digit(label: String) -> PasswordRule {
        PasswordRule(id: "digit", label: label) { $0.contains(where: \.isNumber) }
    }

    /// At least one character that is neither a letter nor a digit (a space counts).
    public static func symbol(label: String) -> PasswordRule {
        PasswordRule(id: "symbol", label: label) { value in
            value.contains { !$0.isLetter && !$0.isNumber }
        }
    }
}

/// One rule and whether the current value meets it.
nonisolated struct PasswordRuleResult: Identifiable, Equatable, Sendable {
    let id: String
    let label: String
    let isMet: Bool
}

extension Array where Element == PasswordRule {
    /// Every rule over `value`, in order.
    nonisolated func evaluate(_ value: String) -> [PasswordRuleResult] {
        map { PasswordRuleResult(id: $0.id, label: $0.label, isMet: $0.isMet(by: value)) }
    }

    /// True when `value` meets every rule: the submit gate of a new password. An empty rule list is always met.
    nonisolated public func allMet(by value: String) -> Bool {
        allSatisfy { $0.isMet(by: value) }
    }
}
