import SwiftUI

/// Everything an app customises, in one value. Inject once at the root:
///
///     ContentView().koboTheme(.lift)
///
/// Components read it with `@Environment(\.koboTheme)`. A theme is a plain value, so previews can render
/// any component under any theme, and two apps can share every component with different brands.
public struct Theme: Sendable, Equatable {
    public var palette: Palette
    public var typography: Typography
    /// Default control prominence: `.glass` follows iOS 26 Liquid Glass; `.solid` for flat brands.
    public var surfaceStyle: SurfaceStyle

    public enum SurfaceStyle: Sendable, Equatable { case glass, solid }

    public init(palette: Palette, typography: Typography = .system, surfaceStyle: SurfaceStyle = .glass) {
        self.palette = palette
        self.typography = typography
        self.surfaceStyle = surfaceStyle
    }

    public static let system = Theme(palette: .system)
    public static let lift = Theme(palette: .lift, typography: .system)

    public func font(_ role: Typography.Role) -> Font { typography.font(role) }
}

extension EnvironmentValues {
    @Entry public var koboTheme: Theme = .system
}

extension View {
    /// Applies a theme to this subtree, and its accent as the system tint.
    public func koboTheme(_ theme: Theme) -> some View {
        environment(\.koboTheme, theme).tint(theme.palette.accent)
    }
}
