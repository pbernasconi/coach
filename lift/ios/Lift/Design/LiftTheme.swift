import KoboTokens
import SwiftUI

extension Palette {
    /// Lift's brand is the Coach orange, the web app's primary: Kobo's `.coach` palette (accent #EB6834 with dark ink
    /// #1A0F08 on top, orange text #B8430F light / #F39069 dark, a peach wash). `WidgetColors` and `ShareColors` repeat
    /// these values for the extensions, which do not link Kobo; change them together.
    static let lift = Palette.coach
}

extension Theme {
    /// The theme applied at the root with `.koboTheme(.lift)`. It follows the system appearance; light by default.
    static let lift = Theme(palette: .lift)
}
