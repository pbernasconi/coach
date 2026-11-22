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
    /// A brand-tinted surface for a bar or header band; the canvas in palettes without one.
    public var accentWash: Color
    /// The hairline under or around `accentWash`; the separator in palettes without a wash.
    public var accentWashSeparator: Color

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

    /// The chat composer's own colours (`ComposerColors`).
    public var composer: ComposerColors

    public init(
        accent: Color,
        onAccent: Color,
        accentSoft: Color,
        accentText: Color,
        accentWash: Color,
        accentWashSeparator: Color,
        canvas: Color,
        surface: Color,
        surfaceRaised: Color,
        surfaceSunken: Color,
        separator: Color,
        scrim: Color,
        textPrimary: Color,
        textSecondary: Color,
        textTertiary: Color,
        success: StatusColors,
        warning: StatusColors,
        danger: StatusColors,
        info: StatusColors,
        neutral: StatusColors,
        composer: ComposerColors = .standard
    ) {
        self.accent = accent; self.onAccent = onAccent; self.accentSoft = accentSoft; self.accentText = accentText
        self.accentWash = accentWash; self.accentWashSeparator = accentWashSeparator
        self.canvas = canvas; self.surface = surface; self.surfaceRaised = surfaceRaised
        self.surfaceSunken = surfaceSunken; self.separator = separator; self.scrim = scrim
        self.textPrimary = textPrimary; self.textSecondary = textSecondary; self.textTertiary = textTertiary
        self.success = success; self.warning = warning; self.danger = danger; self.info = info; self.neutral = neutral
        self.composer = composer
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

/// The chat composer, sampled from the Claude iPhone app: a warm off-white fill a shade off the page, a bright 1 pt
/// edge that catches the light, a soft wide shadow, warm grey round buttons, and Send before there is anything to send
/// (the accent washed out, with a pale arrow). Dark mode keeps the same depth with a lifted fill and a faint edge.
public struct ComposerColors: Sendable, Equatable {
    public var fill: Color
    public var edge: Color
    public var shadow: Color
    /// The round + , microphone and stop buttons.
    public var control: Color
    /// Send before there is anything to send: the fill, laid over `fill`, and its arrow.
    public var sendIdleOpacity: Double
    public var sendIdleInk: Color

    public init(fill: Color, edge: Color, shadow: Color, control: Color, sendIdleOpacity: Double, sendIdleInk: Color) {
        self.fill = fill; self.edge = edge; self.shadow = shadow; self.control = control
        self.sendIdleOpacity = sendIdleOpacity; self.sendIdleInk = sendIdleInk
    }
}

/// The closed set of tones a component can take. Meaning never relies on colour alone:
/// every toned component also shows an icon or a label.
public enum Tone: String, Sendable, CaseIterable {
    case neutral, accent, success, warning, danger, info
}

extension Color {
    /// A colour that resolves per appearance (and increased contrast, when given).
    public init(light: Color, dark: Color, highContrastLight: Color? = nil, highContrastDark: Color? = nil) {
        #if canImport(UIKit)
            self.init(
                uiColor: UIColor { traits in
                    let isDark = traits.userInterfaceStyle == .dark
                    let isHigh = traits.accessibilityContrast == .high
                    switch (isDark, isHigh) {
                    case (false, false): return UIColor(light)
                    case (true, false): return UIColor(dark)
                    case (false, true): return UIColor(highContrastLight ?? light)
                    case (true, true): return UIColor(highContrastDark ?? dark)
                    }
                }
            )
        #elseif canImport(AppKit)
            self.init(
                nsColor: NSColor(name: nil) { appearance in
                    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(dark) : NSColor(light)
                }
            )
        #else
            self = light
        #endif
    }

    /// A colour from a 0xRRGGBB literal. Only token files may use this.
    public init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
