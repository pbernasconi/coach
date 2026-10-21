import SwiftUI

/// Lift's amber for the extension, which does not link Kobo. The values match `Palette.lift` in
/// `Lift/Design/LiftTheme.swift`; change both together. The only place in the extension with raw colours.
nonisolated enum WidgetColors {
    /// The amber accent: the progress bars, the Dynamic Island timer, the Done button and the badge.
    static let accent = rgb(0xFFC21A)

    /// The dark ink on amber: the Done button's label and the badge's barbell, as on the app icon.
    static let ink = rgb(0x1A1300)

    /// Amber for text on the Lock Screen: darker in light mode to keep 4.5:1 contrast.
    static func accentText(for scheme: ColorScheme) -> Color {
        scheme == .dark ? accent : rgb(0x8F5F00)
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
