import KoboTokens
import SwiftUI

/// The live checklist under a `KoboSecureField`: each rule turns from an open circle to a check as the value meets it,
/// and never turns red. Each row reads as one element: the rule, then "Met" or "Not met".
struct PasswordRuleList: View {
    @Environment(\.koboTheme) private var theme
    let results: [PasswordRuleResult]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            ForEach(results) { rule in
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Image(systemName: rule.isMet ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(rule.isMet ? theme.palette.success.ink : theme.palette.textTertiary)
                        .contentTransition(.symbolEffect(.replace))
                        .accessibilityHidden(true)
                    Text(verbatim: rule.label)
                        .foregroundStyle(rule.isMet ? theme.palette.textPrimary : theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(theme.font(.footnote))
                .koboAnimation(.state, value: rule.isMet)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: rule.label))
                .accessibilityValue(rule.isMet ? Text("Met", bundle: .module) : Text("Not met", bundle: .module))
            }
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.palette.surfaceRaised, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
    }
}

extension PasswordRule {
    /// At least `count` characters, with the library's checklist line.
    public static func minimumLength(_ count: Int) -> PasswordRule {
        minimumLength(count, label: String(localized: "At least \(count) characters", bundle: .module))
    }

    /// Upper and lowercase letters, with the library's checklist line.
    public static var mixedCase: PasswordRule {
        mixedCase(label: String(localized: "Upper and lowercase letters", bundle: .module))
    }

    /// At least one number, with the library's checklist line.
    public static var digit: PasswordRule {
        digit(label: String(localized: "At least one number", bundle: .module))
    }

    /// At least one symbol, with the library's checklist line.
    public static var symbol: PasswordRule {
        symbol(label: String(localized: "At least one symbol", bundle: .module))
    }
}
