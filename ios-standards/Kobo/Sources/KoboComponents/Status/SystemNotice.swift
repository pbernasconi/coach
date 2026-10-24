import KoboTokens
import SwiftUI

/// A full-bleed notice about the whole app, not one screen: planned maintenance, an outage, a read-only mode. Warning
/// tone by default, a glyph that carries the tone, the message, an optional action and an optional close button.
/// VoiceOver hears it when it appears. Queue it in a `BannerStack` with a high or critical priority.
///
///     SystemNotice(verbatim: server.maintenanceMessage, symbol: "wrench.and.screwdriver", onDismiss: hide)
public struct SystemNotice: View {
    @Environment(\.koboTheme) private var theme
    private let message: Text
    private let announcement: String?
    private let symbol: String?
    private let tone: Tone
    private let action: BannerAction?
    private let onDismiss: (() -> Void)?

    /// - Parameters:
    ///   - symbol: an SF Symbol; `nil` uses the tone's glyph.
    ///   - onDismiss: shows a close button when given.
    public init(
        _ message: LocalizedStringKey,
        symbol: String? = nil,
        tone: Tone = .warning,
        action: BannerAction? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.message = Text(message)
        self.announcement = nil
        self.symbol = symbol
        self.tone = tone
        self.action = action
        self.onDismiss = onDismiss
    }

    /// A notice whose message is shown as is (staff copy from a server), spoken to VoiceOver when it appears.
    public init(
        verbatim message: String,
        symbol: String? = nil,
        tone: Tone = .warning,
        action: BannerAction? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.message = Text(verbatim: message)
        self.announcement = message
        self.symbol = symbol
        self.tone = tone
        self.action = action
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: Space.md) {
            Image(systemName: symbol ?? tone.feedbackSymbol)
                .font(theme.font(.body))
                .accessibilityHidden(true)
            message
                .font(theme.font(.subheadline).weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if let action {
                // A glass pill, as iOS 26 draws a banner's action ("Reopen", "Turn off").
                Button(action: action.perform) { action.label.fixedSize() }
                    .buttonStyle(.kobo(.glass, size: .compact))
            }
            if let onDismiss {
                BannerDismissButton(label: Text("Dismiss", bundle: .module), action: onDismiss)
            }
        }
        .padding(.trailing, onDismiss == nil ? 0 : -Space.md)
        .shellBanner(tone: tone, verticalPadding: Space.xxs)
        .accessibilityElement(children: .contain)
        .announceOnRisingEdge(announcement)
    }
}

#if DEBUG
    private struct SystemNoticePreview: View {
        var body: some View {
            VStack(spacing: 0) {
                SystemNotice(
                    "Some features are paused while we perform maintenance.",
                    symbol: "wrench.and.screwdriver",
                    onDismiss: {}
                )
                Separator()
                SystemNotice("Sync is down. Your changes are saved on this device.", tone: .danger)
                Separator()
                SystemNotice("You're viewing a read-only copy.", tone: .info, action: .init("Learn more") {})
                Spacer()
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("System notice") { SystemNoticePreview() }
    #Preview("System notice · dark, Amber") { SystemNoticePreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("System notice · AX3") { SystemNoticePreview().dynamicTypeSize(.accessibility3) }
#endif
