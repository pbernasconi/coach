import KoboTokens
import SwiftUI

extension View {
    /// The strip every full-bleed banner shares (`OfflineBanner`, `NudgeBanner`, `SystemNotice`): the tone's soft fill
    /// and ink, edge to edge with no radius. Its fill reaches under the status bar when the strip sits at the top of a
    /// `BannerStack`, while its content stays below it. Use it for an app's own banner in a stack.
    ///
    ///     HStack { Image(systemName: "bolt"); Text("Low power mode is on") }.shellBanner(tone: .info)
    public func shellBanner(tone: Tone, verticalPadding: CGFloat = Space.sm) -> some View {
        modifier(ShellBannerModifier(tone: tone, verticalPadding: verticalPadding))
    }
}

private struct ShellBannerModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let tone: Tone
    let verticalPadding: CGFloat

    func body(content: Content) -> some View {
        let colors = theme.palette.status(tone)
        content
            .font(theme.font(.subheadline))
            .foregroundStyle(colors.ink)
            .padding(.horizontal, Space.gutter)
            .padding(.vertical, verticalPadding)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
            .background(colors.soft)
    }
}
