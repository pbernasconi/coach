import SwiftUI

// ios-guard: allow hex literals — this is the token file.
extension Palette {
    /// A neutral system palette: iOS grouped backgrounds with a blue accent. A safe default for any app.
    public static let system = Palette.make(
        accent: Color(light: Color(hex: 0x0A84FF), dark: Color(hex: 0x0A84FF)),
        onAccent: .white,
        accentText: Color(light: Color(hex: 0x0058D0), dark: Color(hex: 0x6CB4FF))
    )

    /// Amber: a warm amber accent with dark ink on top.
    public static let amber = Palette.make(
        accent: Color(hex: 0xFFC21A),
        onAccent: Color(hex: 0x1A1300),
        accentText: Color(light: Color(hex: 0x8F5F00), dark: Color(hex: 0xFFC21A))
    )

    /// Coach orange: a warm orange accent with dark ink on top (white on it would be only 3.2:1), orange text that
    /// darkens in light mode and lightens in dark mode to keep 4.5:1, and a peach wash for a brand bar or header band.
    public static let coach = Palette.make(
        accent: Color(hex: 0xEB6834),
        onAccent: Color(hex: 0x1A0F08),
        accentText: Color(light: Color(hex: 0xB8430F), dark: Color(hex: 0xF39069)),
        accentSoft: Color(light: Color(hex: 0xEB6834, opacity: 0.14), dark: Color(hex: 0xEB6834, opacity: 0.22)),
        accentWash: Color(light: Color(hex: 0xFBF2EC), dark: Color(hex: 0x1E1612)),
        accentWashSeparator: Color(light: Color(hex: 0xF0DFD3), dark: Color(hex: 0x33261F))
    )

    /// Builds a full palette from an accent. Surfaces, text and status colours are shared iOS-native values;
    /// only the brand roles change between apps. `accentSoft` defaults to the accent at 18%; without a wash,
    /// `accentWash` is the canvas and `accentWashSeparator` the separator.
    public static func make(
        accent: Color,
        onAccent: Color,
        accentText: Color,
        accentSoft: Color? = nil,
        accentWash: Color? = nil,
        accentWashSeparator: Color? = nil
    ) -> Palette {
        let canvas = Color(light: Color(hex: 0xF2F2F7), dark: Color(hex: 0x000000))
        let separator = Color(light: Color(hex: 0x3C3C43, opacity: 0.16), dark: Color(hex: 0x545458, opacity: 0.55))
        return Palette(
            accent: accent,
            onAccent: onAccent,
            accentSoft: accentSoft ?? accent.opacity(0.18),
            accentText: accentText,
            accentWash: accentWash ?? canvas,
            accentWashSeparator: accentWashSeparator ?? separator,
            canvas: canvas,
            surface: Color(light: Color(hex: 0xFFFFFF), dark: Color(hex: 0x1C1C1E)),
            surfaceRaised: Color(light: Color(hex: 0xEBEBF0), dark: Color(hex: 0x2C2C2E)),
            surfaceSunken: Color(light: Color(hex: 0xDEDEE3), dark: Color(hex: 0x3A3A3C)),
            separator: separator,
            scrim: Color(light: Color.black.opacity(0.22), dark: Color.black.opacity(0.48)),
            textPrimary: Color(light: .black, dark: .white),
            textSecondary: Color(light: Color(hex: 0x3C3C43, opacity: 0.80), dark: Color(hex: 0xEBEBF5, opacity: 0.66)),
            textTertiary: Color(light: Color(hex: 0x3C3C43, opacity: 0.36), dark: Color(hex: 0xEBEBF5, opacity: 0.32)),
            success: StatusColors(
                ink: Color(light: Color(hex: 0x1E7F36), dark: Color(hex: 0x32D74B)),
                soft: Color(hex: 0x34C759, opacity: 0.16)
            ),
            warning: StatusColors(
                ink: Color(light: Color(hex: 0x8F5F00), dark: Color(hex: 0xFFD60A)),
                soft: Color(hex: 0xFFCC00, opacity: 0.18)
            ),
            danger: StatusColors(
                ink: Color(light: Color(hex: 0xB42318), dark: Color(hex: 0xFF948C)),
                soft: Color(hex: 0xFF3B30, opacity: 0.14)
            ),
            info: StatusColors(
                ink: Color(light: Color(hex: 0x0B5CB8), dark: Color(hex: 0x8CC4FF)),
                soft: Color(hex: 0x0A84FF, opacity: 0.16)
            ),
            neutral: StatusColors(
                ink: Color(light: Color(hex: 0x3C3C43, opacity: 0.80), dark: Color(hex: 0xEBEBF5, opacity: 0.66)),
                soft: Color(light: Color(hex: 0xEBEBF0), dark: Color(hex: 0x2C2C2E))
            )
        )
    }
}
