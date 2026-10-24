import KoboTokens
import SwiftUI

// ios-guard: allow hex colours — the route's metric colours come from the server as #rrggbb (route-colors.mjs).

extension Color {
    /// A colour sent as `#rrggbb`; nil for anything else.
    init?(routeHex text: String) {
        let digits = text.hasPrefix("#") ? String(text.dropFirst()) : text
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(hex: value)
    }
}
