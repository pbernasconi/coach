import KoboTokens
import SwiftUI

/// One action of a `koboActionSheet`: a title, an optional SF Symbol, a role and whether it can be chosen now.
///
///     ActionSheetItem("Push to next week", systemImage: "calendar.badge.clock", action: pushToNextWeek)
///     ActionSheetItem("Remove", systemImage: "trash", role: .destructive, action: remove)
public struct ActionSheetItem: Identifiable {
    public typealias Role = ActionSheetRole

    /// Unique inside one sheet. Defaults to the title.
    public let id: String
    public let title: Text
    public let systemImage: String?
    public let role: Role
    public let isEnabled: Bool
    public let action: () -> Void

    /// - Parameter id: pass one only when two items could share a title.
    public init(
        _ title: LocalizedStringKey,
        systemImage: String? = nil,
        role: Role = .standard,
        isEnabled: Bool = true,
        id: String? = nil,
        action: @escaping () -> Void
    ) {
        self.id = id ?? String(describing: title)
        self.title = Text(title)
        self.systemImage = systemImage
        self.role = role
        self.isEnabled = isEnabled
        self.action = action
    }

    /// An item whose title is shown as is (a day or a program name).
    public init(
        verbatim title: String,
        systemImage: String? = nil,
        role: Role = .standard,
        isEnabled: Bool = true,
        id: String? = nil,
        action: @escaping () -> Void
    ) {
        self.id = id ?? title
        self.title = Text(verbatim: title)
        self.systemImage = systemImage
        self.role = role
        self.isEnabled = isEnabled
        self.action = action
    }
}

/// Collects `ActionSheetItem`s, with `if` and `for` for the actions a screen only sometimes offers.
@resultBuilder
public enum ActionSheetBuilder {
    public static func buildBlock(_ parts: [ActionSheetItem]...) -> [ActionSheetItem] { Array(parts.joined()) }
    public static func buildExpression(_ item: ActionSheetItem) -> [ActionSheetItem] { [item] }
    public static func buildExpression(_ items: [ActionSheetItem]) -> [ActionSheetItem] { items }
    // swiftlint:disable:next discouraged_optional_collection
    public static func buildOptional(_ items: [ActionSheetItem]?) -> [ActionSheetItem] { items ?? [] }
    public static func buildEither(first items: [ActionSheetItem]) -> [ActionSheetItem] { items }
    public static func buildEither(second items: [ActionSheetItem]) -> [ActionSheetItem] { items }
    public static func buildArray(_ parts: [[ActionSheetItem]]) -> [ActionSheetItem] { Array(parts.joined()) }
    public static func buildLimitedAvailability(_ items: [ActionSheetItem]) -> [ActionSheetItem] { items }
}
