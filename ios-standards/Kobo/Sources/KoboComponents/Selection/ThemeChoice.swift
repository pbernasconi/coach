import KoboTokens
import SwiftUI

/// Light, dark, or following the system: the appearance a `ThemePicker` sets. Apply it at the app root with
/// `.preferredColorScheme(appearance.colorScheme)`.
public enum AppearanceMode: String, Sendable, Hashable, CaseIterable, Identifiable {
    /// Follows the device setting.
    case system
    /// Always light.
    case light
    /// Always dark.
    case dark

    public var id: Self { self }

    /// The scheme to force, or `nil` to follow the system.
    public var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    /// The library's name for the mode ("System", "Light", "Dark").
    var title: Text {
        switch self {
        case .system: Text("System", bundle: .module)
        case .light: Text("Light", bundle: .module)
        case .dark: Text("Dark", bundle: .module)
        }
    }
}

/// One theme a `ThemePicker` offers: an id the caller stores, a name, and the `Theme` its preview draws.
///
///     ThemeChoice("amber", title: "Amber", theme: .amber)
///     ThemeChoice(brand.id, verbatim: brand.name, theme: brand.theme)
public struct ThemeChoice<ID: Hashable & Sendable>: Identifiable {
    public let id: ID
    public let title: Text
    public let theme: Theme

    /// A theme with a localized name.
    public init(_ id: ID, title: LocalizedStringKey, theme: Theme) {
        self.id = id
        self.title = Text(title)
        self.theme = theme
    }

    /// A theme whose name is shown as is.
    public init(_ id: ID, verbatim title: String, theme: Theme) {
        self.id = id
        self.title = Text(verbatim: title)
        self.theme = theme
    }
}
