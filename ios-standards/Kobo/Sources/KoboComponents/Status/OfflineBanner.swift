import KoboTokens
import SwiftUI

/// "No internet connection" across the top of the app, in the warning tone: losing the network is expected and
/// recoverable, so it never blocks input. With `isBackOnline` it says "Back online" with the wifi glyph in the success
/// tone; the glyph, the words and the fill cross-fade. VoiceOver hears it when it appears. A `BannerStack` drives it
/// through `OfflineBannerPhase`, so a short drop never flashes it.
///
///     OfflineBanner()
///     OfflineBanner(isBackOnline: true)
public struct OfflineBanner: View {
    @Environment(\.koboTheme) private var theme
    private let isBackOnline: Bool

    public init(isBackOnline: Bool = false) {
        self.isBackOnline = isBackOnline
    }

    public var body: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: isBackOnline ? "wifi" : "wifi.slash")
                .font(theme.font(.footnote).weight(.semibold))
                .accessibilityHidden(true)
            Text(verbatim: message)
                .font(theme.font(.subheadline).weight(.semibold))
                .multilineTextAlignment(.center)
        }
        .contentTransition(.opacity)
        .shellBanner(tone: isBackOnline ? .success : .warning)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
        .announceOnRisingEdge(message)
    }

    private var message: String {
        isBackOnline
            ? String(localized: "Back online", bundle: .module)
            : String(localized: "No internet connection", bundle: .module)
    }
}

#if DEBUG
    private struct OfflineBannerPreview: View {
        var body: some View {
            VStack(spacing: 0) {
                OfflineBanner()
                Separator()
                OfflineBanner(isBackOnline: true)
                Spacer()
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Offline banner") { OfflineBannerPreview() }
    #Preview("Offline banner · dark, Lift") { OfflineBannerPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Offline banner · AX3") { OfflineBannerPreview().dynamicTypeSize(.accessibility3) }
#endif
