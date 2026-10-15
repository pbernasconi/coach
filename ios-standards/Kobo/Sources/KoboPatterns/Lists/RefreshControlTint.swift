#if canImport(UIKit)
    import KoboComponents
    import KoboTokens
    import SwiftUI
    import UIKit

    /// Tints the system pull-to-refresh spinner with the theme's accent text colour, which follows light, dark and
    /// increased contrast. Call it once at launch, after picking the theme; `koboRefreshable` plays the pull haptic,
    /// because a tinted control plays none of its own.
    ///
    ///     RefreshControlTint.apply(.amber)
    public enum RefreshControlTint {
        public static func apply(_ theme: Theme) {
            UIRefreshControl.appearance().tintColor = UIColor(theme.palette.accentText)
        }
    }
#endif
