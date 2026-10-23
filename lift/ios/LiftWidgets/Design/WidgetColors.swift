import SwiftUI

/// Lift's Coach orange for the extension, which does not link Kobo. The values match `Palette.lift` in
/// `Lift/Design/LiftTheme.swift` (Kobo's `Palette.coach`); change them together. The only place in the extension with
/// raw colours.
nonisolated enum WidgetColors {
    /// The orange accent: the progress bars, the Dynamic Island timer, the Done button and the badge.
    static let accent = rgb(0xEB6834)

    /// The dark ink on orange: the Done button's label (5.9:1; white would be 3.2:1).
    static let ink = rgb(0x1A0F08)

    /// The app icon's dark tile, behind the badge's ring (Design/AppIcon.svg).
    static let iconTile = rgb(0x141413)

    /// Orange for text on the Lock Screen: darker in light mode and lighter in dark mode to keep 4.5:1 contrast.
    static func accentText(for scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0xF39069) : rgb(0xB8430F)
    }

    /// The top of the Lock Screen banner while resting: the accent, faint.
    static let restTint = accent.opacity(0.14)

    /// Behind the exercise photo, whose own background is white.
    static let stillBackground = Color.white

    /// The banner's bottom bar (the load and its check, or the rest and Skip): a lighter panel than the banner.
    static func bottomBar(for scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.08) : Color.white.opacity(0.75)
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
