import KoboComponents
import KoboTokens
import SwiftUI

/// The share control in an outcome's bar: the system share sheet with the outcome's words. A bare glyph, because the
/// system draws the glass circle around a toolbar item.
struct OutcomeShareButton: View {
    let text: String

    var body: some View {
        ShareLink(item: text) {
            Image(systemName: "square.and.arrow.up")
                .accessibilityHidden(true)
        }
        .accessibilityLabel(Text("Share", bundle: .module))
    }
}

extension OutcomeLandingFeedback {
    /// The Kobo haptic this landing plays.
    var haptic: HapticFeedback {
        switch self {
        case .success: .success
        case .warning: .warning
        case .error: .error
        }
    }
}
