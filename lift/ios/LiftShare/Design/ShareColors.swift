import SwiftUI

/// Lift's Coach orange for the Share extension, which does not link Kobo. The values match `Palette.lift` in
/// `Lift/Design/LiftTheme.swift` (Kobo's `Palette.coach`, and `WidgetColors`); change them together. The only raw colours in the extension.
nonisolated enum ShareColors {
    /// The orange accent, for fills.
    static let accent = rgb(0xEB6834)

    /// Orange for text and tinted controls: darker in light mode and lighter in dark mode to keep 4.5:1 contrast.
    static func accentText(for scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0xF39069) : rgb(0xB8430F)
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
