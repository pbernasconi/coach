import SwiftUI

/// Type roles. Every role scales with Dynamic Type (it maps to a system text style), so text is never a
/// fixed size. Apps change the look through `design` (rounded, serif) or a custom family, not by sizes.
public struct Typography: Sendable, Equatable {
    public enum Role: String, Sendable, CaseIterable {
        case largeTitle, title, title2, headline, body, callout, subheadline, footnote, caption
        /// Big numbers (timers, weights): bold, rounded, tabular.
        case display
        /// Numbers in rows and cells: tabular digits so columns line up.
        case numeric
    }

    public var design: Font.Design
    /// Optional custom family; sizes still follow the role's text style.
    public var customFamily: String?

    public init(design: Font.Design = .default, customFamily: String? = nil) {
        self.design = design
        self.customFamily = customFamily
    }

    public static let system = Typography()
    public static let rounded = Typography(design: .rounded)

    public func font(_ role: Role) -> Font {
        let style = role.textStyle
        let base: Font = if let customFamily {
            .custom(customFamily, size: role.pointSize, relativeTo: style)
        } else {
            .system(style, design: role == .display ? .rounded : design)
        }
        return base.weight(role.weight).monospacedDigitIf(role.isNumeric)
    }
}

extension Typography.Role {
    var textStyle: Font.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .title: .title
        case .title2: .title2
        case .headline: .headline
        case .body, .numeric: .body
        case .callout: .callout
        case .subheadline: .subheadline
        case .footnote: .footnote
        case .caption: .caption
        case .display: .largeTitle
        }
    }

    var weight: Font.Weight {
        switch self {
        case .largeTitle, .title, .display: .bold
        case .title2, .headline: .semibold
        case .numeric: .semibold
        default: .regular
        }
    }

    var pointSize: CGFloat {
        switch self {
        case .largeTitle: 34
        case .display: 48
        case .title: 28
        case .title2: 22
        case .headline, .body, .numeric: 17
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        }
    }

    var isNumeric: Bool { self == .display || self == .numeric }
}

extension Font {
    func monospacedDigitIf(_ condition: Bool) -> Font { condition ? monospacedDigit() : self }
}
