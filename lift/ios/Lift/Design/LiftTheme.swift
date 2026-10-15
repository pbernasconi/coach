import KoboTokens
import SwiftUI

// ios-guard: allow hex literals — this is Lift's token file.
extension Palette {
    /// Lift's brand: a warm amber accent with dark ink on top. Amber text darkens in light mode to keep 4.5:1.
    static let lift = Palette.make(
        accent: Color(hex: 0xFFC21A),
        onAccent: Color(hex: 0x1A1300),
        accentText: Color(light: Color(hex: 0x8F5F00), dark: Color(hex: 0xFFC21A))
    )
}

extension Theme {
    /// The theme applied at the root with `.koboTheme(.lift)`. It follows the system appearance; light by default.
    static let lift = Theme(palette: .lift)
}
