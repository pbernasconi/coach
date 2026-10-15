import SwiftUI

/// Semantic colours. Views read roles (`textSecondary`), never raw colours. Each role is a dynamic
/// colour that resolves light/dark itself, so a `Palette` covers both appearances.
public struct Palette: Sendable, Equatable {
    // Brand
    public var accent: Color
    public var onAccent: Color
    /// Tinted fill behind accent content (selected chips, highlighted rows).
    public var accentSoft: Color
    /// Accent used as text on the canvas; darker than `accent` in light mode to keep 4.5:1.
    public var accentText: Color

    // Surfaces (depth by tone, not borders)
    public var canvas: Color
    public var surface: Color
    public var surfaceRaised: Color
    public var surfaceSunken: Color
    public var separator: Color
    public var scrim: Color

    // Text
    public var textPrimary: Color
    public var textSecondary: Color
    /// Decoration and disabled text only; never body copy.
    public var textTertiary: Color

    // Status families: ink for text/icons, soft for fills.
    public var success: StatusColors
    public var warning: StatusColors
    public var danger: StatusColors
    public var info: StatusColors
    public var neutral: StatusColors

    public init(
        accent: Color, onAccent: Color, accentSoft: Color, accentText: Color,
        canvas: Color, surface: Color, surfaceRaised: Color, surfaceSunken: Color, separator: Color, scrim: Color,
        textPrimary: Color, textSecondary: Color, textTertiary: Color,
        success: StatusColors, warning: StatusColors, danger: StatusColors, info: StatusColors, neutral: StatusColors
    ) {
        self.accent = accent; self.onAccent = onAccent; self.accentSoft = accentSoft; self.accentText = accentText
        self.canvas = canvas; self.surface = surface; self.surfaceRaised = surfaceRaised
        self.surfaceSunken = surfaceSunken; self.separator = separator; self.scrim = scrim
        self.textPrimary = textPrimary; self.textSecondary = textSecondary; self.textTertiary = textTertiary
        self.success = success; self.warning = warning; self.danger = danger; self.info = info; self.neutral = neutral
    }

    public func status(_ tone: Tone) -> StatusColors {
        switch tone {
        case .success: success
        case .warning: warning
        case .danger: danger
        case .info: info
        case .neutral: neutral
        case .accent: StatusColors(ink: accentText, soft: accentSoft)
        }
    }
}

/// A tinted colour family for badges, banners and pills.
public struct StatusColors: Sendable, Equatable {
    public var ink: Color
    public var soft: Color
    public init(ink: Color, soft: Color) { self.ink = ink; self.soft = soft }
}

/// The closed set of tones a component can take. Meaning never relies on colour alone:
/// every toned component also shows an icon or a label.
public enum Tone: String, Sendable, CaseIterable {
    case neutral, accent, success, warning, danger, info
}

public extension Color {
    /// A colour that resolves per appearance (and increased contrast, when given).
    init(light: Color, dark: Color, highContrastLight: Color? = nil, highContrastDark: Color? = nil) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            let dark = traits.userInterfaceStyle == .dark
            let high = traits.accessibilityContrast == .high
            switch (dark, high) {
            case (false, false): return UIColor(light)
            case (true, false): return UIColor(dark)
            case (false, true): return UIColor(highContrastLight ?? light)
            case (true, true): return UIColor(highContrastDark ?? dark)
            }
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(dark) : NSColor(light)
        })
        #else
        self = light
        #endif
    }

    /// A colour from a 0xRRGGBB literal. Only token files may use this.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
