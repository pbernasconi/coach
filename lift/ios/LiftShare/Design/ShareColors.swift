import SwiftUI

/// Lift's amber for the Share extension, which does not link Kobo. The values match `Palette.lift` in
/// `Lift/Design/LiftTheme.swift` (and `WidgetColors`); change them together. The only raw colours in the extension.
nonisolated enum ShareColors {
    /// The amber accent, for fills.
    static let accent = rgb(0xFFC21A)

    /// Amber for text and tinted controls: darker in light mode to keep 4.5:1 contrast.
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
